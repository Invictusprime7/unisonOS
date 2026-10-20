/**
 * GoHighLevel Intent Bridge
 *
 * Runtime helper invoked from the unified Intent Executor when a binding's
 * payload_schema declares a `ghl` block. Routes the action to the
 * `gohighlevel-crm` edge function (which holds the API key) and returns
 * a normalized result. Failures are non-fatal — they are logged and the
 * intent continues so UX is never blocked by a CRM hiccup.
 *
 * Binding payload_schema shape:
 *   {
 *     "ghl": {
 *       "action": "triggerWorkflow" | "upsertContact" | "createOpportunity" | "addContactTag",
 *       "workflowId"?: string,
 *       "locationId"?: string,
 *       "pipelineId"?: string,
 *       "stageId"?: string,
 *       "contact"?: { email, phone, firstName, lastName, tags },
 *       "tags"?: string[]
 *     }
 *   }
 */

import { supabase } from '@/integrations/supabase/client';

export interface GhlBindingDirective {
  action: 'triggerWorkflow' | 'upsertContact' | 'createOpportunity' | 'addContactTag';
  workflowId?: string;
  locationId?: string;
  pipelineId?: string;
  stageId?: string;
  contactId?: string;
  contact?: Record<string, unknown>;
  opportunity?: Record<string, unknown>;
  tags?: string[];
}

export interface GhlBridgeResult {
  ok: boolean;
  action: string;
  data?: Record<string, unknown>;
  error?: string;
}

const VALID_ACTIONS = new Set([
  'triggerWorkflow',
  'upsertContact',
  'createOpportunity',
  'addContactTag',
]);

export function extractGhlDirective(
  payloadSchema: Record<string, unknown> | undefined,
  intentPayload: Record<string, unknown> | undefined,
): GhlBindingDirective | null {
  const raw = (payloadSchema?.ghl ?? null) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') return null;
  const action = String(raw.action || '');
  if (!VALID_ACTIONS.has(action)) return null;

  // Allow runtime payload to fill contact details (e.g. from a contact form)
  const contact = {
    ...(raw.contact as Record<string, unknown> | undefined),
    ...(intentPayload?.email ? { email: intentPayload.email } : {}),
    ...(intentPayload?.phone ? { phone: intentPayload.phone } : {}),
    ...(intentPayload?.name ? { name: intentPayload.name } : {}),
  };

  return {
    action: action as GhlBindingDirective['action'],
    workflowId: (raw.workflowId as string) || (intentPayload?.workflowId as string) || undefined,
    locationId: (raw.locationId as string) || undefined,
    pipelineId: (raw.pipelineId as string) || undefined,
    stageId: (raw.stageId as string) || undefined,
    contactId: (raw.contactId as string) || (intentPayload?.contactId as string) || undefined,
    contact: Object.keys(contact).length ? contact : undefined,
    opportunity: raw.opportunity as Record<string, unknown> | undefined,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : undefined,
  };
}

export async function executeGhlDirective(
  directive: GhlBindingDirective,
  projectId: string | null | undefined,
): Promise<GhlBridgeResult> {
  if (!projectId) return { ok: false, action: directive.action, error: 'Project scope is required for GoHighLevel.' };
  try {
    const { data, error } = await supabase.functions.invoke('gohighlevel-crm', {
      body: { action: directive.action, projectId, ...directive },
    });
    if (error) {
      console.warn('[GhlIntentBridge] Edge function error:', error.message);
      return { ok: false, action: directive.action, error: error.message };
    }
    return { ok: true, action: directive.action, data: data as Record<string, unknown> };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown GHL bridge error';
    console.warn('[GhlIntentBridge] Exception:', msg);
    return { ok: false, action: directive.action, error: msg };
  }
}
