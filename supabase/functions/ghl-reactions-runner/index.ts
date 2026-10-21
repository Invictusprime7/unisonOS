/**
 * GHL Reactions Runner
 *
 * Given a `ghl_webhook_events.id`, look up matching `ghl_event_reactions`
 * for the same business and execute their actions:
 *   - notify     → insert into notifications table (if present) + log
 *   - create_task→ insert into crm_tasks (best-effort)
 *   - update_lead→ update crm_leads stage by contact_id
 *   - http       → POST action_config.url with the event payload
 *
 * Marks the source event processed when at least one rule matched.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { verifyAuth, verifyBusinessAccess } from '../_shared/auth.ts';
import { updateCrmLead } from '../_shared/canonicalCrm.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Reaction {
  id: string;
  business_id: string;
  event_type: string;
  stage_filter: string | null;
  pipeline_filter: string | null;
  workflow_filter: string | null;
  action_type: string;
  action_config: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let payload: { eventId?: string };
  try { payload = await req.json(); } catch { payload = {}; }
  if (!payload.eventId) {
    return new Response(JSON.stringify({ error: 'eventId required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Authenticate before touching any event so outsiders learn nothing.
  const caller = await verifyAuth(req);
  if (!caller.user) {
    return new Response(JSON.stringify({ error: caller.error || 'Unauthorized' }), {
      status: caller.status || 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: event, error: evtErr } = await supabase
    .from('ghl_webhook_events')
    .select('*')
    .eq('id', payload.eventId)
    .maybeSingle();

  if (evtErr || !event) {
    return new Response(JSON.stringify({ error: 'Event not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!event.business_id) {
    return new Response(JSON.stringify({ ok: true, skipped: 'no business_id' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Only a signed-in member of the event's business may run its reactions.
  const auth = await verifyAuth(req);
  if (!auth.user) {
    return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
      status: auth.status || 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const access = await verifyBusinessAccess(auth.user.id, event.business_id);
  if (!access.allowed) {
    return new Response(JSON.stringify({ error: 'Access denied' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (event.processed) {
    return new Response(JSON.stringify({ ok: true, skipped: 'already processed' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: rules } = await supabase
    .from('ghl_event_reactions')
    .select('*')
    .eq('business_id', event.business_id)
    .eq('enabled', true)
    .eq('event_type', event.event_type);

  const matched: Reaction[] = (rules || []).filter((r: Reaction) => {
    if (r.stage_filter && r.stage_filter !== event.stage_id) return false;
    if (r.pipeline_filter && r.pipeline_filter !== event.pipeline_id) return false;
    if (r.workflow_filter && r.workflow_filter !== event.workflow_id) return false;
    return true;
  });

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const rule of matched) {
    try {
      const cfg = rule.action_config || {};
      switch (rule.action_type) {
        case 'http': {
          const url = String(cfg.url || '');
          if (!url) throw new Error('missing url');
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rule: rule.id, event }),
          });
          break;
        }
        case 'create_task': {
          await supabase.from('crm_tasks').insert({
            business_id: event.business_id,
            title: String(cfg.title || `GHL: ${event.event_type}`),
            description: String(cfg.description || ''),
            status: 'open',
            metadata: { source: 'ghl_reaction', rule_id: rule.id, event_id: event.id },
          });
          break;
        }
        case 'update_lead': {
          if (event.contact_id) {
            const { data: contact, error: contactError } = await supabase
              .from('crm_contacts')
              .select('id')
              .eq('business_id', event.business_id)
              .eq('external_id', event.contact_id)
              .maybeSingle();
            if (contactError) throw contactError;
            if (contact?.id) {
              const { data: lead, error: leadError } = await supabase
                .from('crm_leads')
                .select('id')
                .eq('business_id', event.business_id)
                .eq('contact_id', contact.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (leadError) throw leadError;
              if (lead?.id) {
                await updateCrmLead(supabase, { businessId: event.business_id }, lead.id, {
                  stage: String(cfg.stage || 'qualified'),
                });
              }
            }
          }
          break;
        }
        case 'notify':
        default: {
          // Best-effort: append to a generic notifications table if it exists.
          await supabase.from('notifications').insert({
            business_id: event.business_id,
            kind: 'ghl_event',
            title: String(cfg.title || `GHL ${event.event_type}`),
            body: String(cfg.body || ''),
            metadata: { rule_id: rule.id, event_id: event.id },
          }).then(() => {}, () => {});
          break;
        }
      }

      await supabase.from('ghl_event_reactions')
        .update({
          last_triggered_at: new Date().toISOString(),
          trigger_count: (rule as unknown as { trigger_count?: number }).trigger_count
            ? ((rule as unknown as { trigger_count: number }).trigger_count + 1)
            : 1,
        })
        .eq('id', rule.id);

      results.push({ id: rule.id, ok: true });
    } catch (err) {
      results.push({ id: rule.id, ok: false, error: (err as Error).message });
    }
  }

  if (matched.length) {
    await supabase.from('ghl_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', event.id);
  }

  return new Response(
    JSON.stringify({ ok: true, matched: matched.length, results }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
