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
import { isValidUUID } from '../_shared/validate.ts';
import { isUnresolvedGhlIdentifier } from './webhookIdentity.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-ghl-signature, x-wh-signature, x-webhook-secret',
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
  const businessIdQuery = url.searchParams.get('businessId')?.trim() || null;
  const projectIdQuery = url.searchParams.get('projectId')?.trim() || null;
  const sharedSecret = Deno.env.get('GHL_WEBHOOK_SECRET');
  const sigHeader =
    req.headers.get('x-ghl-signature') ||
    req.headers.get('x-wh-signature') ||
    req.headers.get('x-webhook-secret');

  // Fail closed: without a configured secret no caller can be authenticated.
  if (!sharedSecret) {
    console.error('[ghl-webhook] GHL_WEBHOOK_SECRET is not configured; rejecting');
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!sigHeader || sigHeader !== sharedSecret) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if ((businessIdQuery && !uuidRe.test(businessIdQuery)) || (projectIdQuery && !uuidRe.test(projectIdQuery))) {
    return new Response(JSON.stringify({ error: 'Invalid identifiers' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const configuredProjectId = Deno.env.get('GHL_PROJECT_ID');
  if (!configuredProjectId || !isValidUUID(configuredProjectId)) {
    return new Response(JSON.stringify({ error: 'Webhook project is not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!projectIdQuery || !isValidUUID(projectIdQuery)) {
    return new Response(JSON.stringify({ error: 'A valid projectId query parameter is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (projectIdQuery !== configuredProjectId) {
    return new Response(JSON.stringify({ error: 'Project scope does not match this GHL integration' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (businessIdQuery && !isValidUUID(businessIdQuery)) {
    return new Response(JSON.stringify({ error: 'businessId must be a valid UUID' }), {
      status: 400,
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

  if ([locationId, contactId, opportunityId].some(isUnresolvedGhlIdentifier)) {
    return new Response(JSON.stringify({ error: 'Webhook contains an unresolved GoHighLevel merge field' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (eventType === 'contact.test_webhook' && (!locationId || !contactId)) {
    return new Response(JSON.stringify({ error: 'Test events require locationId and contactId' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, business_id')
    .eq('id', projectIdQuery)
    .maybeSingle();
  if (projectError) {
    console.error('[ghl-webhook] project lookup failed', projectError);
    return new Response(JSON.stringify({ error: 'Could not resolve project scope' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!project) {
    return new Response(JSON.stringify({ error: 'Project not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (businessIdQuery && businessIdQuery !== project.business_id) {
    return new Response(JSON.stringify({ error: 'businessId does not match project scope' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const businessId = project.business_id as string | null;

  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (!/^(authorization|apikey|x-ghl-signature|x-wh-signature|x-webhook-secret)$/i.test(k)) headers[k] = v;
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
      signature: null,
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
