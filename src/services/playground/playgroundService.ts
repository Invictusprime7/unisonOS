/**
 * PlaygroundService — read facade over the Resource Runtime, setup progress
 * and capability records. It stores nothing; it gathers the real state that
 * deriveLaunchTasks() needs.
 */
import { supabase } from '@/integrations/supabase/client';
import { queryResource } from '@/services/resources/resourceRuntime';
import { BUSINESS_PROFILE_RESOURCE_KEY } from '@/services/resources/resourceRegistry';
import { listAssetTypes } from '@/services/resources/assetCatalog';
import type { LaunchReadinessInput } from './launchReadiness';

export interface LoadLaunchReadinessArgs {
  businessId: string;
  projectId?: string | null;
  siteId?: string | null;
  industry?: string | null;
  vfsFiles?: Record<string, string>;
}

export async function loadLaunchReadinessInput(args: LoadLaunchReadinessArgs): Promise<LaunchReadinessInput> {
  const ctx = { businessId: args.businessId, projectId: args.projectId ?? null, siteId: args.siteId ?? null, mode: 'builder' as const };
  const used = listAssetTypes({ industry: args.industry, vfsFiles: args.vfsFiles ?? {} })
    .filter((t) => t.used && t.def && t.group !== 'business');

  const [profileRows, counts, capRows, stepRows] = await Promise.all([
    queryResource(BUSINESS_PROFILE_RESOURCE_KEY, ctx).catch(() => []),
    Promise.all(used.map((t) => queryResource(t.key, ctx).then((r) => r.length).catch(() => 0))),
    args.siteId
      ? supabase.from('site_capabilities').select('capability_id').eq('site_id', args.siteId).eq('status', 'enabled').then((r) => r.data ?? [])
      : Promise.resolve([] as { capability_id: string }[]),
    args.siteId
      ? supabase.from('site_setup_steps').select('step_id, status').eq('site_id', args.siteId).then((r) => r.data ?? [])
      : Promise.resolve([] as { step_id: string; status: string }[]),
  ]);

  const profile = profileRows[0] ?? null;
  return {
    siteConnected: Boolean(args.businessId && args.projectId && args.siteId),
    businessProfile: profile,
    usedResources: used.map((t, i) => ({ key: t.key, label: t.label, count: counts[i] })),
    capabilities: capRows.map((r) => r.capability_id),
    setupSteps: stepRows.map((r) => ({ id: r.step_id, status: r.status })),
  };
}
