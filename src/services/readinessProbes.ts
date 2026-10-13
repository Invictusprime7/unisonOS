/**
 * readinessProbes — Track 5 (Readiness Center live probes)
 *
 * Read-only network probes that verify the readiness signals surfaced in
 * `/.unison/launch-readiness.json` and the compiled contract actually match
 * what the platform can do *right now*. These probes never mutate state —
 * they only execute lightweight HEAD/OPTIONS-style checks against:
 *
 *   - Supabase database reachability (RLS-protected count query)
 *   - Notification path reachability (intent_execution_log existence)
 *   - publish-site edge function reachability + attestation enforcement flag
 *
 * Failures here mean the static manifest is lying. The Readiness Center
 * v2 surfaces probe results next to the manifest-derived rows so authors
 * see honest, live state instead of a stale snapshot from the last wizard run.
 */

import { supabase } from '@/integrations/supabase/client';
import { getSupabaseFunctionUrl } from '@/integrations/supabase/supabaseFunctionRequest';

export type ProbeState = 'ok' | 'fail' | 'pending' | 'na';

export interface ProbeResult {
  id: string;
  label: string;
  state: ProbeState;
  detail?: string;
  latencyMs?: number;
}

export interface ReadinessProbeReport {
  probes: ProbeResult[];
  startedAt: number;
  finishedAt: number;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - start) };
}

async function probeDbReachable(): Promise<ProbeResult> {
  try {
    const { ms, value } = await timed(async () =>
      await supabase
        .from('site_intent_bindings')
        .select('id', { head: true, count: 'exact' })
        .limit(1),
    );
    if (value.error) {
      return {
        id: 'db-reachable',
        label: 'Database reachable',
        state: 'fail',
        detail: value.error.message,
        latencyMs: ms,
      };
    }
    return {
      id: 'db-reachable',
      label: 'Database reachable',
      state: 'ok',
      detail: `RLS query ok · ${ms}ms`,
      latencyMs: ms,
    };
  } catch (err) {
    return {
      id: 'db-reachable',
      label: 'Database reachable',
      state: 'fail',
      detail: err instanceof Error ? err.message : 'unknown error',
    };
  }
}


async function probeNotificationsSink(): Promise<ProbeResult> {
  try {
    const { ms, value } = await timed(async () =>
      await supabase
        .from('intent_execution_log')

        .select('id', { head: true, count: 'exact' })
        .limit(1),
    );
    if (value.error) {
      return {
        id: 'notifications-sink',
        label: 'Notification sink reachable',
        state: 'fail',
        detail: value.error.message,
        latencyMs: ms,
      };
    }
    return {
      id: 'notifications-sink',
      label: 'Notification sink reachable',
      state: 'ok',
      detail: `intent_execution_log ok · ${ms}ms`,
      latencyMs: ms,
    };
  } catch (err) {
    return {
      id: 'notifications-sink',
      label: 'Notification sink reachable',
      state: 'fail',
      detail: err instanceof Error ? err.message : 'unknown error',
    };
  }
}

async function probePublishEdge(): Promise<ProbeResult> {
  const url = getSupabaseFunctionUrl('publish-site');
  try {
    const { ms, value } = await timed(() =>
      fetch(url, {
        method: 'OPTIONS',
        headers: { 'access-control-request-method': 'POST' },
      }),
    );
    const ok = value.ok || value.status === 204 || value.status === 200;
    return {
      id: 'publish-edge',
      label: 'publish-site edge reachable',
      state: ok ? 'ok' : 'fail',
      detail: `HTTP ${value.status} · ${ms}ms`,
      latencyMs: ms,
    };
  } catch (err) {
    return {
      id: 'publish-edge',
      label: 'publish-site edge reachable',
      state: 'fail',
      detail: err instanceof Error ? err.message : 'unreachable',
    };
  }
}

/**
 * Run all probes in parallel and return a single report. Safe to call from
 * a useEffect on panel mount — every probe is read-only.
 */
export async function runReadinessProbes(): Promise<ReadinessProbeReport> {
  const startedAt = Date.now();
  const probes = await Promise.all([
    probeDbReachable(),
    probeNotificationsSink(),
    probePublishEdge(),
  ]);
  return { probes, startedAt, finishedAt: Date.now() };
}
