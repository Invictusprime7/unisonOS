// capability-migration-apply
//
// Executes the DDL for an approved capability pack proposal: GRANTs, RLS
// enablement and guarded policy creation. The SQL is re-derived server-side
// from `_shared/capabilityPackContracts.ts` — the request only names the
// capabilities, never the SQL — so an approval can never execute arbitrary
// statements.
//
// Gates, in order:
//   1. valid bearer token
//   2. caller is an admin/owner of the target business (or the project owner)
//   3. statements are re-generated here and each one is matched against the
//      generator output before execution (assertExecutable)
//   4. everything runs in a single transaction; any failure rolls back
//
// The run is recorded in `ai_builder_proposals` for audit and replay.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { Client as PgClient } from 'https://deno.land/x/postgres@v0.19.3/mod.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  assertExecutable,
  buildSiteCapabilityInstallRecord,
  buildContractMigration,
  resolveDatabaseContracts,
  type MigrationStatement,
} from '../_shared/capabilityPackContracts.ts';
import { describeLintResult, lintMigrationSql } from '../_shared/migrationSqlLint.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_DB_URL = Deno.env.get('SUPABASE_DB_URL')!;

const BodySchema = z.object({
  capabilities: z.array(z.string().min(1).max(120)).min(1).max(24),
  businessId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  /** Generate + authorize + validate, but roll back instead of committing. */
  dryRun: z.boolean().optional(),
  summary: z.string().max(2000).optional(),
});

interface StatementResult {
  id: string;
  kind: string;
  table: string;
  status: 'applied' | 'skipped' | 'failed';
  error?: string;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing bearer token' }), { status: 401, headers: jsonHeaders });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: jsonHeaders });
    }
    const userId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: jsonHeaders },
      );
    }
    const { capabilities, businessId, projectId, siteId, dryRun, summary } = parsed.data;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ---- Gate 2: the caller must administer the target -------------------
    let authorized = false;
    let targetBusinessId = businessId ?? null;
    let installSiteId: string | null = null;
    if (siteId) {
      const { data: site } = await admin
        .from('sites').select('id, business_id').eq('id', siteId).maybeSingle();
      if (!site || (businessId && site.business_id !== businessId)) {
        return new Response(JSON.stringify({ error: 'The site does not match the requested business.' }), { status: 403, headers: jsonHeaders });
      }

      if (projectId) {
        const { data: project } = await admin
          .from('projects').select('business_id, site_id').eq('id', projectId).maybeSingle();
        const { data: draft } = project ? { data: null } : await admin
          .from('builder_drafts').select('business_id, site_id').eq('id', projectId).maybeSingle();
        const scope = project ?? draft;
        if (!scope || scope.site_id !== siteId || scope.business_id !== site.business_id) {
          return new Response(JSON.stringify({ error: 'The project does not belong to the requested site and business.' }), { status: 403, headers: jsonHeaders });
        }
      }

      const { data: isAdmin } = await admin.rpc('is_business_admin', {
        _user_id: userId,
        _business_id: site.business_id,
      });
      authorized = Boolean(isAdmin);
      targetBusinessId = site.business_id;
      installSiteId = site.id;
    } else if (businessId) {
      const { data: isAdmin } = await admin.rpc('is_business_admin', {
        _user_id: userId,
        _business_id: businessId,
      });
      authorized = Boolean(isAdmin);
    } else if (projectId) {
      // Installing capabilities runs privileged SQL: a plain project member is
      // not enough. Require the owning business's admin, or the project owner
      // when the project has no business yet.
      const { data: project } = await admin
        .from('projects').select('owner_id, business_id').eq('id', projectId).maybeSingle();
      if (project?.business_id) {
        targetBusinessId = project.business_id;
        const { data: isAdmin } = await admin.rpc('is_business_admin', {
          _user_id: userId, _business_id: project.business_id,
        });
        authorized = Boolean(isAdmin);
      } else {
        authorized = Boolean(project && project.owner_id === userId);
      }
    }
    if (!authorized) {
      return new Response(
        JSON.stringify({ error: 'You must be an admin of this business to install capabilities.' }),
        { status: 403, headers: jsonHeaders },
      );
    }

    // ---- Gate 3: SQL is generated here, never accepted from the client ---
    const { order, unsupported } = resolveDatabaseContracts(capabilities);
    if (order.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No installable capability packs in this request.', unsupported }),
        { status: 400, headers: jsonHeaders },
      );
    }
    const migration = buildContractMigration(order);
    for (const statement of migration.statements) {
      assertExecutable(statement, migration.statements);
    }

    // ---- Gate 3b: mandatory SQL lint (blockers stop execution) -----------
    const lint = lintMigrationSql(migration.sql);
    if (!lint.ok) {
      return new Response(
        JSON.stringify({
          error: describeLintResult(lint),
          status: 'failed',
          lint,
          sql: migration.sql,
        }),
        { status: 422, headers: jsonHeaders },
      );
    }

    // ---- Gate 4: one transaction, rolled back on any failure -------------
    const results: StatementResult[] = [];
    const pg = new PgClient(SUPABASE_DB_URL);
    let executionError: string | null = null;

    await pg.connect();
    try {
      await pg.queryArray('BEGIN');
      for (const statement of migration.statements as MigrationStatement[]) {
        try {
          await pg.queryArray(statement.sql);
          results.push({ id: statement.id, kind: statement.kind, table: statement.table, status: dryRun ? 'skipped' : 'applied' });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results.push({ id: statement.id, kind: statement.kind, table: statement.table, status: 'failed', error: message });
          throw new Error(`${statement.id}: ${message}`);
        }
      }
      if (installSiteId) {
        for (const pack of order) {
          const install = buildSiteCapabilityInstallRecord(installSiteId, userId, pack);
          await pg.queryArray(
            `INSERT INTO public.site_capabilities
              (site_id, capability_id, status, configuration, enabled_by)
             VALUES ($1, $2, $3, $4::jsonb, $5)
             ON CONFLICT (site_id, capability_id) DO UPDATE SET
               status = EXCLUDED.status,
               configuration = EXCLUDED.configuration,
               enabled_by = EXCLUDED.enabled_by,
               updated_at = now()`,
            [install.siteId, install.capabilityId, install.status, JSON.stringify(install.configuration), install.enabledBy],
          );
          results.push({
            id: `site-capability-${install.capabilityId}`,
            kind: 'site-capability',
            table: 'site_capabilities',
            status: dryRun ? 'skipped' : 'applied',
          });
        }
      }
      if (dryRun) {
        await pg.queryArray('ROLLBACK');
      } else {
        await pg.queryArray('COMMIT');
      }
    } catch (err) {
      executionError = err instanceof Error ? err.message : String(err);
      try { await pg.queryArray('ROLLBACK'); } catch { /* connection already unusable */ }
    } finally {
      try { await pg.end(); } catch { /* ignore */ }
    }

    const status = executionError ? 'failed' : dryRun ? 'approved' : 'applied';
    const now = new Date().toISOString();

    // ---- Audit trail ------------------------------------------------------
    const { data: proposal } = await admin
      .from('ai_builder_proposals')
      .insert({
        kind: 'sql_migration',
        status,
        business_id: targetBusinessId,
        project_id: projectId ?? null,
        proposed_by: userId,
        reviewed_by: userId,
        reviewed_at: now,
        applied_at: status === 'applied' ? now : null,
        title: `Capability install: ${order.map((pack) => pack.id).join(', ')}`,
        summary: summary ?? `Applied grants, RLS and policies for ${migration.tables.join(', ')}.`,
        payload: {
          capabilities,
          packs: order.map((pack) => pack.id),
          siteId: installSiteId,
          tables: migration.tables,
          sql: migration.sql,
          dryRun: Boolean(dryRun),
        },
        apply_result: { results, error: executionError, unsupported },
      })
      .select('id')
      .maybeSingle();

    return new Response(
      JSON.stringify({
        status,
        dryRun: Boolean(dryRun),
        packs: order.map((pack) => pack.id),
        siteId: installSiteId,
        installedCapabilities: installSiteId && !dryRun ? order.map((pack) => pack.id) : [],
        tables: migration.tables,
        unsupported,
        statements: migration.statements.map((statement) => ({
          id: statement.id,
          kind: statement.kind,
          table: statement.table,
          description: statement.description,
        })),
        results,
        sql: migration.sql,
        error: executionError,
        proposalId: proposal?.id ?? null,
      }),
      { status: executionError ? 500 : 200, headers: jsonHeaders },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: getCorsHeaders(req) },
    );
  }
});
