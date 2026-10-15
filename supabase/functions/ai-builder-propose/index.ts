// ai-builder-propose
// Lets the AI Builder (or a human) submit a *proposed* backend change — SQL
// migration, edge-function edit, or config change — for user approval before
// anything runs. Performs light dry-run validation and persists a row in
// `ai_builder_proposals` with status='pending'.
//
// No SQL is executed here. That happens in `ai-builder-apply` only after the
// user explicitly approves the proposal.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { publicCorsHeaders as corsHeaders } from '../_shared/cors.ts';
import { z } from 'https://esm.sh/zod@3.23.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const KIND = z.enum(['sql_migration', 'edge_function', 'config_change']);
const BodySchema = z.object({
  kind: KIND,
  title: z.string().min(3).max(200),
  summary: z.string().max(2000).optional(),
  rationale: z.string().max(4000).optional(),
  project_id: z.string().uuid().optional(),
  business_id: z.string().uuid().optional(),
  payload: z.record(z.unknown()).default({}),
});

// Conservative deny-list. `ai-builder-apply` re-checks these too.
const SQL_DENYLIST = [
  /\bdrop\s+database\b/i,
  /\bdrop\s+schema\b\s+(auth|storage|realtime|supabase_functions|vault)\b/i,
  /\balter\s+database\b/i,
  /\btruncate\s+.*auth\./i,
  /\bgrant\s+.*\s+to\s+public\b/i,
  /\bsecurity\s+definer\b/i, // require explicit human review
  /\bcreate\s+role\b/i,
  /\bdrop\s+role\b/i,
];

interface DryRunReport {
  ok: boolean;
  warnings: string[];
  blockers: string[];
  statementCount?: number;
  affectedSchemas?: string[];
}

function dryRunSql(sql: string): DryRunReport {
  const report: DryRunReport = { ok: true, warnings: [], blockers: [] };
  const trimmed = String(sql || '').trim();
  if (!trimmed) {
    report.ok = false;
    report.blockers.push('SQL payload is empty.');
    return report;
  }
  for (const rx of SQL_DENYLIST) {
    if (rx.test(trimmed)) {
      report.ok = false;
      report.blockers.push(`Blocked pattern: ${rx.source}`);
    }
  }
  const statements = trimmed.split(/;\s*(?:\n|$)/).filter((s) => s.trim().length > 0);
  report.statementCount = statements.length;
  const schemas = new Set<string>();
  const schemaRe = /(?:from|join|into|update|table|schema)\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = schemaRe.exec(trimmed))) schemas.add(m[1].toLowerCase());
  report.affectedSchemas = [...schemas];
  if (report.affectedSchemas.includes('auth') || report.affectedSchemas.includes('storage')) {
    report.warnings.push('Touches managed schema (auth/storage) — extra review recommended.');
  }
  if (/\bcreate\s+table\s+public\./i.test(trimmed) && !/\bgrant\b/i.test(trimmed)) {
    report.warnings.push('CREATE TABLE without GRANT — Data API will 403.');
  }
  if (!/\brow\s+level\s+security\b/i.test(trimmed) && /\bcreate\s+table\b/i.test(trimmed)) {
    report.warnings.push('CREATE TABLE without RLS — tables should enable RLS.');
  }
  return report;
}

Deno.serve(async (req) => {
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
    const body = parsed.data;

    // Dry-run per kind
    let dryRun: DryRunReport = { ok: true, warnings: [], blockers: [] };
    if (body.kind === 'sql_migration') {
      const sql = String((body.payload as Record<string, unknown>).sql ?? '');
      dryRun = dryRunSql(sql);
    } else if (body.kind === 'edge_function') {
      const name = String((body.payload as Record<string, unknown>).name ?? '');
      const src = String((body.payload as Record<string, unknown>).source ?? '');
      if (!name) dryRun.blockers.push('edge_function proposal needs a name.');
      if (!src) dryRun.blockers.push('edge_function proposal needs source.');
      dryRun.ok = dryRun.blockers.length === 0;
      dryRun.warnings.push('Edge-function proposals require manual deployment via review UI.');
    } else if (body.kind === 'config_change') {
      dryRun.warnings.push('Config-change proposals apply metadata only; no destructive effect.');
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Targets must belong to the caller: project membership, business
    // membership, and the project must actually sit in that business.
    if (body.project_id) {
      const { data: pm } = await admin.rpc('is_project_member', { _user_id: userId, _project_id: body.project_id });
      if (!pm) return new Response(JSON.stringify({ error: 'Not a member of this project' }), { status: 403, headers: jsonHeaders });
      if (body.business_id) {
        const { data: project } = await admin.from('projects').select('business_id').eq('id', body.project_id).maybeSingle();
        if (project?.business_id && project.business_id !== body.business_id) {
          return new Response(JSON.stringify({ error: 'Project does not belong to this business' }), { status: 403, headers: jsonHeaders });
        }
      }
    }
    if (body.business_id) {
      const { data: role } = await admin.rpc('user_business_role', { _user_id: userId, _business_id: body.business_id });
      if (!role) return new Response(JSON.stringify({ error: 'Not a member of this business' }), { status: 403, headers: jsonHeaders });
    }
    if (!body.project_id && !body.business_id) {
      return new Response(JSON.stringify({ error: 'A proposal needs a project or business target' }), { status: 400, headers: jsonHeaders });
    }

    const { data: inserted, error: insertErr } = await admin
      .from('ai_builder_proposals')
      .insert({
        kind: body.kind,
        title: body.title,
        summary: body.summary ?? null,
        rationale: body.rationale ?? null,
        project_id: body.project_id ?? null,
        business_id: body.business_id ?? null,
        payload: body.payload ?? {},
        dry_run_report: dryRun,
        status: dryRun.ok ? 'pending' : 'rejected',
        proposed_by: userId,
      })
      .select('*')
      .maybeSingle();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ proposal: inserted, dryRun }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
