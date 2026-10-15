// ai-builder-apply
// Marks an AI Builder proposal as approved/rejected/applied. Executing raw SQL
// from an edge function is intentionally forbidden by the hosted runtime — SQL
// migrations must go through the platform migration tool, which requires a
// human review step. So this function's job for `sql_migration` proposals is:
//   - verify caller has rights (owner or project/business member)
//   - flip status to 'approved' and echo back the SQL so the UI can hand it to
//     the migration flow
//   - or flip to 'rejected' with reviewer metadata
// For `config_change` kind we can persist the payload against related tables
// safely (e.g., set businesses.settings JSONB). For `edge_function` we mark
// approved so the operator knows to redeploy — no auto-deploy from here.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import { describeLintResult, lintMigrationSql } from '../_shared/migrationSqlLint.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const BodySchema = z.object({
  proposal_id: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'mark_applied']),
  reviewer_note: z.string().max(2000).optional(),
});

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
    const { proposal_id, action, reviewer_note } = parsed.data;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: proposal, error: readErr } = await admin
      .from('ai_builder_proposals')
      .select('*')
      .eq('id', proposal_id)
      .maybeSingle();
    if (readErr || !proposal) {
      return new Response(JSON.stringify({ error: 'Proposal not found' }), { status: 404, headers: jsonHeaders });
    }

    // Authorization: owner OR project/business member
    let authorized = proposal.proposed_by === userId;
    if (!authorized && proposal.project_id) {
      const { data: pm } = await admin.rpc('is_project_member', {
        _user_id: userId,
        _project_id: proposal.project_id,
      });
      if (pm) authorized = true;
    }
    if (!authorized && proposal.business_id) {
      const { data: bm } = await admin
        .from('business_members')
        .select('id')
        .eq('business_id', proposal.business_id)
        .eq('user_id', userId)
        .maybeSingle();
      if (bm) authorized = true;
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Not authorized for this proposal' }), { status: 403, headers: jsonHeaders });
    }

    // Approving applies changes (business settings, migrations). Members may
    // reject; only a business admin, or the project owner when there is no
    // business, may approve or mark applied.
    if (action !== 'reject') {
      let canApprove = false;
      let targetBusiness: string | null = proposal.business_id ?? null;
      let projectOwner: string | null = null;
      if (proposal.project_id) {
        const { data: project } = await admin
          .from('projects').select('owner_id, business_id').eq('id', proposal.project_id).maybeSingle();
        projectOwner = project?.owner_id ?? null;
        if (targetBusiness && project?.business_id && project.business_id !== targetBusiness) {
          return new Response(JSON.stringify({ error: 'Proposal targets a business this project does not belong to.' }), { status: 403, headers: jsonHeaders });
        }
        targetBusiness = targetBusiness ?? project?.business_id ?? null;
      }
      if (targetBusiness) {
        const { data: isAdmin } = await admin.rpc('is_business_admin', { _user_id: userId, _business_id: targetBusiness });
        canApprove = Boolean(isAdmin);
      } else {
        canApprove = projectOwner === userId;
      }
      if (!canApprove) {
        return new Response(JSON.stringify({ error: 'Only the business owner or an admin can approve this change.' }), { status: 403, headers: jsonHeaders });
      }
    }

    const now = new Date().toISOString();
    const applyResult: Record<string, unknown> = { reviewer_note: reviewer_note ?? null };
    let nextStatus: 'approved' | 'rejected' | 'applied' | 'failed' = 'approved';

    if (action === 'reject') {
      nextStatus = 'rejected';
    } else if (action === 'approve') {
      nextStatus = 'approved';
      if (proposal.kind === 'sql_migration') {
        const sql = String((proposal.payload as Record<string, unknown>)?.sql ?? '');
        const lint = lintMigrationSql(sql);
        if (!lint.ok) {
          await admin
            .from('ai_builder_proposals')
            .update({
              status: 'failed',
              reviewed_by: userId,
              reviewed_at: now,
              apply_result: { reviewer_note: reviewer_note ?? null, lint, error: describeLintResult(lint) },
            })
            .eq('id', proposal_id);
          return new Response(
            JSON.stringify({ error: describeLintResult(lint), lint }),
            { status: 422, headers: jsonHeaders },
          );
        }
        applyResult.lint = lint;
        applyResult.migration_sql = sql;
        applyResult.next_step = 'run_via_supabase_migration_tool';
      } else if (proposal.kind === 'edge_function') {
        applyResult.next_step = 'redeploy_edge_function_manually';
      } else if (proposal.kind === 'config_change') {
        // Safe metadata apply: shallow merge into businesses.settings when
        // business_id is present.
        const cfg = (proposal.payload as Record<string, unknown>)?.settings;
        if (proposal.business_id && cfg && typeof cfg === 'object') {
          const { data: biz } = await admin
            .from('businesses')
            .select('settings')
            .eq('id', proposal.business_id)
            .maybeSingle();
          const merged = { ...(biz?.settings ?? {}), ...(cfg as Record<string, unknown>) };
          const { error: updErr } = await admin
            .from('businesses')
            .update({ settings: merged })
            .eq('id', proposal.business_id);
          if (updErr) {
            applyResult.error = updErr.message;
            nextStatus = 'failed';
          } else {
            nextStatus = 'applied';
            applyResult.applied = merged;
          }
        }
      }
    } else if (action === 'mark_applied') {
      nextStatus = 'applied';
    }

    const { data: updated, error: updateErr } = await admin
      .from('ai_builder_proposals')
      .update({
        status: nextStatus,
        reviewed_by: userId,
        reviewed_at: now,
        applied_at: nextStatus === 'applied' ? now : proposal.applied_at,
        apply_result: applyResult,
      })
      .eq('id', proposal_id)
      .select('*')
      .maybeSingle();

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ proposal: updated }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
