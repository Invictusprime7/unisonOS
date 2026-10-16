/**
 * Published Site Runtime (guidebook Phase 7): resolves which backend a
 * published site's public visitors read from. Public-safe — uses
 * resolve_published_site_backend, which only answers for published sites and
 * only returns public identity (never secrets).
 *
 * Shared-legacy mode returns `null` callers then use the existing
 * site-runtime-read path unchanged. Dedicated mode returns a ready client
 * pointed at the site's own backend.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface PublishedBackendDescriptor {
  projectId: string;
  siteId: string | null;
  mode: 'shared-legacy' | 'dedicated';
  status: 'ready';
  projectUrl: string | null;
  publishableKey: string | null;
}

const cache = new Map<string, Promise<PublishedBackendDescriptor>>();
const clients = new Map<string, SupabaseClient>();

export function parsePublishedBackendDescriptor(raw: unknown): PublishedBackendDescriptor {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (typeof r.projectId !== 'string' || (r.mode !== 'shared-legacy' && r.mode !== 'dedicated')) {
    throw new Error('Published site backend could not be resolved.');
  }
  return {
    projectId: r.projectId,
    siteId: typeof r.siteId === 'string' ? r.siteId : null,
    mode: r.mode,
    status: 'ready',
    projectUrl: typeof r.projectUrl === 'string' ? r.projectUrl : null,
    publishableKey: typeof r.publishableKey === 'string' ? r.publishableKey : null,
  };
}

/** Resolves the public backend for a published site. Throws when not published. */
export function resolvePublishedSiteBackend(projectId: string): Promise<PublishedBackendDescriptor> {
  let hit = cache.get(projectId);
  if (!hit) {
    hit = (async () => {
      const { data, error } = await supabase.functions.invoke('resolve-published-site-backend', {
        body: { projectId },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Published site backend could not be resolved.');
      return parsePublishedBackendDescriptor(data.data);
    })();
    hit.catch(() => cache.delete(projectId));
    cache.set(projectId, hit);
  }
  return hit;
}

/**
 * Returns a read client for the published site's own backend, or null when the
 * site still runs on the shared backend (caller keeps the existing read path).
 */
export async function publishedSiteReadClient(projectId: string): Promise<SupabaseClient | null> {
  const backend = await resolvePublishedSiteBackend(projectId);
  if (backend.mode !== 'dedicated' || !backend.projectUrl || !backend.publishableKey) return null;
  let client = clients.get(backend.projectId);
  if (!client) {
    client = createClient(backend.projectUrl, backend.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    clients.set(backend.projectId, client);
  }
  return client;
}

export function invalidatePublishedBackend(projectId?: string): void {
  if (projectId) cache.delete(projectId);
  else cache.clear();
}
