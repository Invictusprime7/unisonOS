/**
 * GoHighLevel Webhook Ingestion
 *
 * Public endpoint (verify_jwt = false). GHL posts workflow / contact /
 * opportunity events here. We:
 *   1. Optionally verify a shared-secret signature (GHL_WEBHOOK_SECRET)
 *   2. Normalize the event (type, contact, opportunity, workflow, stage)
 *   3. Resolve business_id from locationId via business_integrations (best-effort)
 *   4. Persist to public.ghl_webhook_events for realtime fan-out
 *
 * Clients subscribe via Supabase Realtime to update task/app state when a
 * stage changes (e.g. opportunity moved, contact created).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-ghl-signature, x-wh-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface GhlWebhookPayload {
  type?: string;
  event?: string;
  locationId?: string;
  location_id?: string;
  contactId?: string;
  contact_id?: string;
  opportunityId?: string;
  opportunity_id?: string;
  workflowId?: string;
  workflow_id?: string;
  pipelineId?: string;
  pipeline_id?: string;
  pipelineStageId?: string;
  stageId?: string;
  stage_id?: string;
  previousStageId?: string;
  previous_stage_id?: string;
  [k: string]: unknown;
}

function pick(obj: GhlWebhookPayload, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.length) return v;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const businessIdQuery = url.searchParams.get('businessId');
  const projectIdQuery = url.searchParams.get('projectId');
  const sharedSecret = Deno.env.get('GHL_WEBHOOK_SECRET');
  const sigHeader =
    req.headers.get('x-ghl-signature') ||
    req.headers.get('x-wh-signature') ||
    req.headers.get('x-webhook-secret');

  // Optional shared-secret check (recommended in GHL workflow webhook config)
  if (sharedSecret && sigHeader !== sharedSecret) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: GhlWebhookPayload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const eventType = pick(body, 'type', 'event') || 'unknown';
  const locationId = pick(body, 'locationId', 'location_id');
  const contactId = pick(body, 'contactId', 'contact_id');
  const opportunityId = pick(body, 'opportunityId', 'opportunity_id');
  const workflowId = pick(body, 'workflowId', 'workflow_id');
  const pipelineId = pick(body, 'pipelineId', 'pipeline_id');
  const stageId = pick(body, 'stageId', 'stage_id', 'pipelineStageId');
  const previousStageId = pick(body, 'previousStageId', 'previous_stage_id');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Resolve business_id: query param wins, else look up by GHL location mapping.
  let businessId: string | null = businessIdQuery;
  if (!businessId && locationId) {
    const { data } = await supabase
      .from('business_integrations')
      .select('business_id')
      .eq('provider', 'gohighlevel')
      .eq('external_id', locationId)
      .maybeSingle();
    if (data?.business_id) businessId = data.business_id as string;
  }

  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (!/^authorization$/i.test(k)) headers[k] = v;
  });

  const { data: inserted, error } = await supabase
    .from('ghl_webhook_events')
    .insert({
      business_id: businessId,
      project_id: projectIdQuery,
      event_type: eventType,
      location_id: locationId,
      contact_id: contactId,
      opportunity_id: opportunityId,
      workflow_id: workflowId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      previous_stage_id: previousStageId,
      payload: body as unknown as Record<string, unknown>,
      headers,
      signature: sigHeader,
    })
    .select('id, created_at')
    .single();

  if (error) {
    console.error('[ghl-webhook] insert error', error);
    return new Response(JSON.stringify({ error: 'Failed to record event' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, eventId: inserted.id, receivedAt: inserted.created_at }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
