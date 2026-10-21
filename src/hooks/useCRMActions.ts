/**
 * CRM Action Hooks
 *
 * Wraps CRM Supabase operations with automation event emission.
 * Every CRM write operation (create/update/delete) emits an Inngest event
 * so that automation recipes fire automatically.
 *
 * Usage:
 *   const crm = useCRMActions({ businessId, projectId });
 *   await crm.createDeal({ title, stage, value });     // → DB insert + deal.created event
 *   await crm.moveDealStage(dealId, old, new);         // → DB update + deal.stage.changed event
 *   await crm.createLead({ title, email, source });    // → DB insert + lead.created event
 *   await crm.updateLeadStatus(leadId, old, new);      // → DB update + lead.status.changed event
 *
 * The hook re-exports Supabase results so callers keep their existing UI flow.
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { dispatchAutomation } from '@/services/automationOrchestrator';
import { sendInngestEvent } from '@/services/inngestService';
import { isAutomatable } from '@/runtime/intentClassifier';
import type { IntentContext, IntentResult } from '@/runtime/intentExecutor';
import { applyResourceOp } from '@/services/resources/resourceRuntime';

// ============================================================================
// Types
// ============================================================================

export interface CRMDealInput {
  title: string;
  stage: string;
  value?: number | null;
  expected_close_date?: string | null;
  contact_id?: string | null;
  lead_id?: string | null;
}

export interface CRMLeadInput {
  title: string;
  status?: string;
  value?: number | null;
  source?: string | null;
  notes?: string | null;
  email?: string;
  phone?: string;
  business_id?: string | null;
}

export interface CRMContactInput {
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  tags?: string[];
}

interface CRMActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

interface CRMScopeOptions {
  businessId?: string;
  projectId?: string;
}

// ============================================================================
// Hook
// ============================================================================

export function useCRMActions(scope?: string | CRMScopeOptions) {
  const normalizedScope: CRMScopeOptions =
    typeof scope === 'string' ? { businessId: scope } : scope || {};
  const businessId = normalizedScope.businessId;
  const projectId = normalizedScope.projectId;
  const resourceContext = { businessId: businessId || '', projectId, mode: 'cloud' as const };
  // ---- DEALS ----

  const createDeal = useCallback(async (input: CRMDealInput): Promise<CRMActionResult<{ id: string }>> => {
    try {
      const data = await applyResourceOp({
        op: 'create',
        resourceKey: 'crm:deals',
        values: {
          title: input.title,
          stage: input.stage,
          value: input.value ?? null,
          expected_close_date: input.expected_close_date ?? null,
          contact_id: input.contact_id ?? null,
          lead_id: input.lead_id ?? null,
        },
      }, resourceContext);

      // Deterministic: CRM deal events are always automatable
      if (businessId && data?.id && isAutomatable('deal.won')) {
        sendInngestEvent('crm/deal.created', {
          dealId: data.id,
          businessId,
          projectId,
          title: input.title,
          value: input.value ?? undefined,
          stage: input.stage,
        }).catch(console.warn);
      }

      return { success: true, data: { id: data.id } };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }, [businessId, projectId, resourceContext]);

  const moveDealStage = useCallback(async (
    dealId: string,
    previousStage: string,
    newStage: string,
    contactEmail?: string
  ): Promise<CRMActionResult> => {
    try {
      await applyResourceOp({
        op: 'update',
        ref: { resourceKey: 'crm:deals', kind: 'crm', recordId: dealId },
        values: { stage: newStage },
      }, resourceContext);

      // Fire automation: stage changed → crm/deal.stage.changed
      if (businessId) {
        sendInngestEvent('crm/deal.stage.changed', {
          dealId,
          businessId,
          projectId,
          previousStage,
          newStage,
          contactEmail,
        }).catch(console.warn);
      }

      // Dispatch through orchestrator ONLY for terminal stages (automatable lifecycle events)
      if (businessId) {
        const intent = newStage === 'closed_won' ? 'deal.won' : newStage === 'closed_lost' ? 'deal.lost' : null;
        if (intent && isAutomatable(intent)) {
          const ctx: IntentContext = { businessId, payload: { dealId, projectId, previousStage, newStage, contactEmail } };
          const result: IntentResult = { ok: true, data: { dealId } };
          dispatchAutomation(intent, ctx, result).catch(console.warn);
        }
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }, [businessId, projectId, resourceContext]);

  const deleteDeal = useCallback(async (dealId: string): Promise<CRMActionResult> => {
    try {
      await applyResourceOp({
        op: 'delete',
        ref: { resourceKey: 'crm:deals', kind: 'crm', recordId: dealId },
      }, resourceContext);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }, [resourceContext]);

  // ---- LEADS ----

  const createLead = useCallback(async (input: CRMLeadInput): Promise<CRMActionResult<{ id: string }>> => {
    try {
      const data = await applyResourceOp({
        op: 'create',
        resourceKey: 'crm:leads',
        values: {
          title: input.title,
          status: input.status || 'new',
          value: input.value ?? null,
          source: input.source ?? null,
          notes: input.notes ?? null,
          email: input.email,
          phone: input.phone,
        },
      }, resourceContext);

      // Fire automation: lead created → crm/lead.created
      if (businessId && data?.id) {
        sendInngestEvent('crm/lead.created', {
          leadId: data.id,
          businessId,
          projectId,
          email: input.email,
          phone: input.phone,
          source: input.source ?? 'crm',
        }).catch(console.warn);
      }

      return { success: true, data: { id: data.id } };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }, [businessId, projectId, resourceContext]);

  const updateLead = useCallback(async (
    leadId: string,
    updates: Partial<CRMLeadInput>
  ): Promise<CRMActionResult> => {
    try {
      await applyResourceOp({
        op: 'update',
        ref: { resourceKey: 'crm:leads', kind: 'crm', recordId: leadId },
        values: Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined)),
      }, resourceContext);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }, [resourceContext]);

  const updateLeadStatus = useCallback(async (
    leadId: string,
    previousStatus: string,
    newStatus: string,
    email?: string
  ): Promise<CRMActionResult> => {
    try {
      await applyResourceOp({
        op: 'update',
        ref: { resourceKey: 'crm:leads', kind: 'crm', recordId: leadId },
        values: { status: newStatus },
      }, resourceContext);

      // Fire automation: status changed → crm/lead.status.changed
      if (businessId) {
        sendInngestEvent('crm/lead.status.changed', {
          leadId,
          businessId,
          projectId,
          previousStatus,
          newStatus,
        }).catch(console.warn);
      }

      // Dispatch through orchestrator ONLY for terminal lead states (automatable lifecycle)
      if (businessId && (newStatus === 'won' || newStatus === 'qualified') && isAutomatable('lead.capture')) {
        const ctx: IntentContext = { businessId, payload: { leadId, projectId, email, previousStatus, newStatus } };
        const result: IntentResult = { ok: true };
        dispatchAutomation('lead.capture', ctx, result).catch(console.warn);
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }, [businessId, projectId, resourceContext]);

  const deleteLead = useCallback(async (leadId: string): Promise<CRMActionResult> => {
    try {
      await applyResourceOp({
        op: 'delete',
        ref: { resourceKey: 'crm:leads', kind: 'crm', recordId: leadId },
      }, resourceContext);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }, [resourceContext]);

  // ---- CONTACTS ----

  const createContact = useCallback(async (input: CRMContactInput): Promise<CRMActionResult<{ id: string }>> => {
    try {
      const data = await applyResourceOp({
        op: 'create',
        resourceKey: 'crm:contacts',
        values: {
          first_name: input.first_name,
          last_name: input.last_name ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          company: input.company ?? null,
          tags: input.tags ?? [],
        },
      }, resourceContext);

      // Fire automation: contact created → crm/contact.created
      if (businessId && data?.id) {
        sendInngestEvent('crm/contact.created', {
          contactId: data.id,
          businessId,
          projectId,
          email: input.email,
          phone: input.phone,
          firstName: input.first_name,
          lastName: input.last_name,
        }).catch(console.warn);
      }

      return { success: true, data: { id: data.id } };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }, [businessId, projectId, resourceContext]);

  const deleteContact = useCallback(async (contactId: string): Promise<CRMActionResult> => {
    try {
      await applyResourceOp({
        op: 'delete',
        ref: { resourceKey: 'crm:contacts', kind: 'crm', recordId: contactId },
      }, resourceContext);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }, [resourceContext]);

  // ---- WORKFLOWS ----

  const triggerWorkflow = useCallback(async (
    workflowId: string,
    triggerData: Record<string, unknown> = {}
  ): Promise<CRMActionResult> => {
    try {
      // Send via Inngest for durable execution instead of supabase.functions.invoke
      if (businessId) {
        const result = await sendInngestEvent('automation/trigger', {
          automationId: `workflow-${workflowId}`,
          businessId,
          projectId,
          triggerId: `manual_${Date.now()}`,
          triggerType: 'workflow.manual',
          payload: { workflowId, ...triggerData },
          source: 'crm-ui',
        });
        if (!result.success) {
          return { success: false, error: result.error || 'Failed to trigger workflow' };
        }
        return { success: true };
      }

      // Fallback: direct function invoke
      const { error } = await supabase.functions.invoke('workflow-trigger', {
        body: { workflowId, triggerData: { triggered_by: 'manual', ...triggerData } },
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }, [businessId, projectId]);

  // ---- BOOKINGS ----

  const createBooking = useCallback(async (input: {
    serviceId?: string;
    datetime: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    notes?: string;
  }): Promise<CRMActionResult<{ bookingId: string }>> => {
    const bookingId = `booking_${Date.now()}`;

    // Fire automation: booking created → booking/created
    if (businessId) {
      sendInngestEvent('booking/created', {
        bookingId,
        businessId,
        projectId,
        contactEmail: input.customerEmail,
        contactPhone: input.customerPhone,
        service: input.serviceId || 'General',
        scheduledAt: input.datetime,
      }).catch(console.warn);
    }

    return { success: true, data: { bookingId } };
  }, [businessId, projectId]);

  return {
    // Deals
    createDeal,
    moveDealStage,
    deleteDeal,
    // Leads
    createLead,
    updateLead,
    updateLeadStatus,
    deleteLead,
    // Contacts
    createContact,
    deleteContact,
    // Workflows
    triggerWorkflow,
    // Bookings
    createBooking,
  };
}
