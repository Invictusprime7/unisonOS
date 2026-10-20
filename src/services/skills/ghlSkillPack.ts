/**
 * GoHighLevel Skill Pack
 *
 * Registers GHL operations as composable AI skills with the global skill
 * registry, and exposes a programmatic API the in-builder AI uses to wire
 * site elements to GHL workflows without an LLM round-trip.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  globalSkillRegistry,
  type AISkill,
  type SkillTool,
} from '@/services/aiSkillRegistry';
import { upsertIntentBinding } from '@/services/intentBindingService';

// ============ Tool implementations (proxy through gohighlevel-crm) ============

async function invokeCrm<T = Record<string, unknown>>(
  action: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('gohighlevel-crm', {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message || `gohighlevel-crm[${action}] failed`);
  return data as T;
}

const ghlListWorkflows: SkillTool = {
  id: 'ghl-list-workflows',
  name: 'List GHL Workflows',
  description: 'List automation workflows for a GoHighLevel location.',
  inputSchema: {
    type: 'object',
    properties: { projectId: { type: 'string' }, locationId: { type: 'string' } },
    required: ['projectId', 'locationId'],
  },
  execute: async (input) => invokeCrm('getWorkflows', input as Record<string, unknown>),
};

const ghlTriggerWorkflow: SkillTool = {
  id: 'ghl-trigger-workflow',
  name: 'Trigger GHL Workflow',
  description: 'Trigger a GoHighLevel workflow for a contact.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string' },
      workflowId: { type: 'string' },
      contactId: { type: 'string' },
      payload: { type: 'object' },
    },
    required: ['projectId', 'workflowId', 'contactId'],
  },
  execute: async (input) => invokeCrm('triggerWorkflow', input as Record<string, unknown>),
};

const ghlUpsertContact: SkillTool = {
  id: 'ghl-upsert-contact',
  name: 'Upsert GHL Contact',
  description: 'Create or update a GoHighLevel contact by email or phone.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string' },
      locationId: { type: 'string' },
      contact: { type: 'object' },
    },
    required: ['projectId', 'locationId', 'contact'],
  },
  execute: async (input) => invokeCrm('upsertContact', input as Record<string, unknown>),
};

const ghlCreateOpportunity: SkillTool = {
  id: 'ghl-create-opportunity',
  name: 'Create GHL Opportunity',
  description: 'Create a sales opportunity in a GoHighLevel pipeline.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string' },
      locationId: { type: 'string' },
      pipelineId: { type: 'string' },
      stageId: { type: 'string' },
      contactId: { type: 'string' },
      opportunity: { type: 'object' },
    },
    required: ['projectId', 'locationId', 'pipelineId', 'stageId'],
  },
  execute: async (input) => invokeCrm('createOpportunity', input as Record<string, unknown>),
};

export const SKILL_GHL: AISkill = {
  id: 'gohighlevel',
  name: 'GoHighLevel CRM Automation',
  description:
    'Wire site interactions (button clicks, form submissions, navigation) to GoHighLevel workflows, contacts, and opportunities.',
  version: '1.0.0',
  enabled: true,
  systemPrompt: `You are a GoHighLevel automation expert.

When the user asks to wire a button, form, or any interactive element to a
GoHighLevel workflow:
1. Identify the target element (use the current selection if present, otherwise
   resolve by section + label, e.g. "the hero CTA").
2. Identify the workflow (by name or id) and any contact mapping.
3. Call wire_ghl_binding to persist the binding — DO NOT generate raw code.
4. Confirm what was wired and what fires when the element is clicked.

Bindings are stored in site_intent_bindings.payload_schema.ghl and executed
automatically by the runtime intent executor.`,
  tools: [ghlListWorkflows, ghlTriggerWorkflow, ghlUpsertContact, ghlCreateOpportunity],
};

// Auto-register on import
globalSkillRegistry.registerSkill(SKILL_GHL);

// ============ Programmatic binding writer (used by AI Builder fast-path) ============

export interface WireGhlBindingInput {
  businessId: string;
  projectId: string;
  pagePath?: string;
  elementKey: string;
  elementLabel?: string;
  intent?: string;
  workflowId: string;
  locationId?: string;
  contactMapping?: { emailFrom?: string; phoneFrom?: string; nameFrom?: string };
}

export async function wireGhlBinding(input: WireGhlBindingInput) {
  const payloadSchema = {
    ghl: {
      action: 'triggerWorkflow' as const,
      workflowId: input.workflowId,
      locationId: input.locationId,
    },
    contactMapping: input.contactMapping ?? {},
  };

  const binding = await upsertIntentBinding({
    businessId: input.businessId,
    projectId: input.projectId,
    pagePath: input.pagePath || '/',
    elementKey: input.elementKey,
    elementLabel: input.elementLabel ?? null,
    intent: input.intent || 'button.click',
    workflowId: null, // GHL workflow lives on payload_schema; native workflow_id stays null
    payloadSchema,
    enabled: true,
  });

  return binding;
}
