/**
 * ProjectBackendResolver (guidebook §64) — the only place that decides which
 * backend a site uses. UI components never choose a backend (§65).
 */
import { supabase } from '@/integrations/supabase/client';
import type { ProjectBackendDescriptor } from './projectBackendTypes';

const cache = new Map<string, Promise<ProjectBackendDescriptor>>();

export function parseProjectBackendDescriptor(raw: unknown): ProjectBackendDescriptor {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (typeof r.projectId !== 'string' || (r.mode !== 'shared-legacy' && r.mode !== 'dedicated')) {
    throw new Error('Project backend could not be resolved.');
  }
  return {
    bindingId: String(r.bindingId),
    projectId: r.projectId,
    siteId: typeof r.siteId === 'string' ? r.siteId : null,
    mode: r.mode,
    provider: 'supabase',
    status: r.status === 'failed' ? 'failed' : r.status === 'provisioning' ? 'provisioning' : 'ready',
    projectUrl: typeof r.projectUrl === 'string' ? r.projectUrl : null,
    publishableKey: typeof r.publishableKey === 'string' ? r.publishableKey : null,
  };
}

export const projectBackendResolver = {
  resolve(projectId: string): Promise<ProjectBackendDescriptor> {
    if (!projectId) return Promise.reject(new Error('A site is required to reach its saved items.'));
    let hit = cache.get(projectId);
    if (!hit) {
      hit = (async () => {
        const { data, error } = await supabase.functions.invoke('resolve-project-backend', {
          body: { projectId },
        });
        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error || 'Project backend could not be resolved.');
        return parseProjectBackendDescriptor(data.data);
      })();
      hit.catch(() => cache.delete(projectId));
      cache.set(projectId, hit);
    }
    return hit;
  },
  invalidate(projectId?: string) { if (projectId) cache.delete(projectId); else cache.clear(); },
};
