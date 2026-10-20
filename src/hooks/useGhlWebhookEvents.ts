/**
 * useGhlWebhookEvents
 *
 * Subscribes to `ghl_webhook_events` for the current business and exposes a
 * live tail of incoming GHL webhook events (contact created, opportunity
 * stage changed, workflow fired, etc). Use this in task views, CRM
 * dashboards, or builder panels to react to GHL stage changes in real time.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GhlWebhookEvent {
  id: string;
  business_id: string | null;
  project_id: string | null;
  event_type: string;
  location_id: string | null;
  contact_id: string | null;
  opportunity_id: string | null;
  workflow_id: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  previous_stage_id: string | null;
  payload: Record<string, unknown>;
  processed: boolean;
  created_at: string;
}

interface Options {
  projectId?: string | null;
  limit?: number;
  eventTypes?: string[];
}

export function useGhlWebhookEvents({
  projectId,
  limit = 50,
  eventTypes,
}: Options) {
  const [events, setEvents] = useState<GhlWebhookEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setEvents([]);
      return;
    }
    setLoading(true);
    let q = supabase
      .from('ghl_webhook_events')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (eventTypes && eventTypes.length) q = q.in('event_type', eventTypes);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    else setEvents((data || []) as GhlWebhookEvent[]);
    setLoading(false);
  }, [projectId, limit, eventTypes]);

  const markProcessed = useCallback(async (id: string) => {
    if (!projectId) return;
    await supabase
      .from('ghl_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('project_id', projectId);
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, processed: true } : e)),
    );
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { events, loading, error, refresh, markProcessed };
}
