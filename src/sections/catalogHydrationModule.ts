/**
 * catalogHydrationModule — VFS-injected runtime hook.
 *
 * Emits `/src/components/catalogHydration.ts` into every generated site so
 * pages can request live catalog rows from the Builder host via postMessage.
 *
 * The host (VFSPreview) listens for `CATALOG_HYDRATE_REQUEST`, calls
 * `resolveHydrationRequest` in `@/services/catalogRuntime`, and posts back a
 * `CATALOG_HYDRATE_RESPONSE` with the projected rows.
 */

export const CATALOG_HYDRATION_PATH = '/src/components/catalogHydration.ts';

export const CATALOG_HYDRATION_MODULE = `import { useEffect, useRef, useState } from 'react';
import { TRUSTED_PREVIEW_ORIGIN_SOURCE } from '@/utils/trustedPreviewOrigin';
import { PUBLISHED_RUNTIME_CONFIG } from '@/unison/publishedRuntime';

// ─────────────────────────────────────────────────────────────────────────────
// Shape returned to callers
// ─────────────────────────────────────────────────────────────────────────────
export type SectionHydrationState = {
  loading: boolean;
  rows: any[] | null;
  cardBinding: any | null;
  fallback: 'ok' | 'empty_state' | 'hide_section' | 'show_placeholder' | null;
  error: string | null;
};

let __seq = 0;
const nextId = () => \`h_\${Date.now().toString(36)}_\${(++__seq).toString(36)}\`;
// Published sites revalidate through the public runtime gateway rather than
// subscribing directly to Supabase tables or credentials.
const PUBLISHED_CATALOG_REVALIDATE_MS = 60_000;

// One shared long-poll per page: the gateway answers as soon as a saved
// catalog/content row changes, and every live section re-reads.
const __liveListeners = new Set<() => void>();
let __liveRunning = false;
function subscribePublishedLive(listener: () => void): () => void {
  __liveListeners.add(listener);
  if (!__liveRunning) {
    __liveRunning = true;
    void (async () => {
      let failures = 0;
      while (__liveListeners.size > 0) {
        const runtime: any = PUBLISHED_RUNTIME_CONFIG;
        if (!runtime.siteId || !runtime.endpoint) break;
        if (typeof document !== 'undefined' && document.hidden) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        try {
          const res = await fetch(runtime.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'watch', runtimeVersion: runtime.runtimeVersion, siteId: runtime.siteId }),
          });
          const data: any = res.ok ? await res.json() : null;
          if (!res.ok) throw new Error(String(res.status));
          failures = 0;
          if (data?.changed) __liveListeners.forEach((fn) => fn());
        } catch {
          failures += 1;
          await new Promise((r) => setTimeout(r, Math.min(60_000, 2000 * 2 ** failures)));
        }
      }
      __liveRunning = false;
    })();
  }
  return () => { __liveListeners.delete(listener); };
}

/**
 * Request live catalog rows for a generated section. Falls back gracefully
 * when there is no parent (published/standalone) or when the host has no
 * binding — callers should retain their static \`items\` prop as the seed.
 */
export function useSectionData(
  sectionId: string,
  sectionType?: string,
  occurrenceIndex?: number,
): SectionHydrationState {
  const [state, setState] = useState<SectionHydrationState>({
    loading: true,
    rows: null,
    cardBinding: null,
    fallback: null,
    error: null,
  });
  const [bump, setBump] = useState(0);
  const mounted = useRef(true);
  // This identity comes from the host's canonical binding, never from a
  // generated component's local state. It lets resource invalidations stay
  // scoped to the affected live section.
  const bindingRef = useRef<{ bindingId: string | null; sourceTable: string | null }>({ bindingId: null, sourceTable: null });


  useEffect(() => {
    mounted.current = true;
    if (typeof window === 'undefined' || window.parent === window) {
      let activeController: AbortController | null = null;
      const refreshPublishedCatalog = async (initial: boolean) => {
        activeController?.abort();
        const controller = new AbortController();
        activeController = controller;
        const timer = window.setTimeout(() => controller.abort(), 1500);
        const runtime = PUBLISHED_RUNTIME_CONFIG;
        // Live reads go to the public read gateway (site-runtime-read), which
        // expects a flat body — not the action runtime's { operation, read } shape.
        if (!runtime.siteId || !runtime.endpoint || controller.signal.aborted) {
          window.clearTimeout(timer);
          if (mounted.current) setState({ loading: false, rows: null, cardBinding: null, fallback: null, error: null });
          return;
        }
        // Published sites route by hash (HashRouter); bindings are keyed by the
        // hash path, so prefer it over the static pathname.
        const publishedPath = (() => {
          if (typeof window === 'undefined') return '/';
          const hash = (window.location.hash || '').replace(/^#/, '');
          if (hash.startsWith('/')) return hash;
          return window.location.pathname || '/';
        })();
        try {
          const response = await fetch(runtime.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              type: 'catalog',
              runtimeVersion: runtime.runtimeVersion,
              siteId: runtime.siteId,
              pagePath: publishedPath,
              sectionId,
              sectionType: sectionType || null,
              occurrenceIndex: typeof occurrenceIndex === 'number' ? occurrenceIndex : null,
            }),
          });
          const data: any = response.ok ? await response.json() : null;
          if (!mounted.current) return;
          setState({
            loading: false,
            rows: Array.isArray(data?.rows) ? data.rows : null,
            cardBinding: data?.cardBinding ?? null,
            fallback: data?.fallback ?? null,
            error: data?.error ?? null,
          });
        } catch {
          if (initial && mounted.current) {
            setState({ loading: false, rows: null, cardBinding: null, fallback: null, error: null });
          }
        } finally {
          window.clearTimeout(timer);
        }
      };

      void refreshPublishedCatalog(true);
      const interval = window.setInterval(() => {
        if (!document.hidden) void refreshPublishedCatalog(false);
      }, PUBLISHED_CATALOG_REVALIDATE_MS);
      const onVisibilityChange = () => {
        if (!document.hidden) void refreshPublishedCatalog(false);
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      const stopLive = subscribePublishedLive(() => { void refreshPublishedCatalog(false); });

      return () => {
        stopLive();
        mounted.current = false;
        window.clearInterval(interval);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        activeController?.abort();
      };
    }

    const requestId = nextId();
    const pagePath =
      (typeof window.location !== 'undefined' && window.location.hash)
        ? window.location.hash.replace(/^#/, '') || '/'
        : '/';

    const onMessage = (event: MessageEvent) => {
      // Catalog data is only accepted from the builder hosting this preview.
      if ((event.source !== window.parent) || !(${TRUSTED_PREVIEW_ORIGIN_SOURCE})(event.origin)) return;
      const data: any = event.data;
      if (!data) return;
      if (data.type === 'CATALOG_BINDINGS_CHANGED') {
        const invalidation = data.invalidation as {
          bindingIds?: unknown;
          sourceTables?: unknown;
        } | undefined;
        if (invalidation) {
          const bindingIds = Array.isArray(invalidation.bindingIds) ? invalidation.bindingIds : [];
          const sourceTables = Array.isArray(invalidation.sourceTables) ? invalidation.sourceTables : [];
          const bindingMatches = bindingRef.current.bindingId && bindingIds.includes(bindingRef.current.bindingId);
          const tableMatches = bindingRef.current.sourceTable && sourceTables.includes(bindingRef.current.sourceTable);
          // A legacy/incomplete invalidation contains neither identity list;
          // retain the safe broad refresh only for that compatibility case.
          if (!bindingMatches && !tableMatches && (bindingIds.length || sourceTables.length)) return;
        }
        // Force a fresh hydration request.
        setState((prev) => ({ ...prev, loading: true }));
        setBump((b) => b + 1);
        return;
      }
      if (data.type !== 'CATALOG_HYDRATE_RESPONSE') return;
      if (data.requestId !== requestId) return;
      if (!mounted.current) return;
      bindingRef.current = {
        bindingId: typeof data.bindingId === 'string' ? data.bindingId : null,
        sourceTable: typeof data.sourceTable === 'string' ? data.sourceTable : null,
      };
      setState({
        loading: false,
        rows: Array.isArray(data.rows) ? data.rows : null,
        cardBinding: data.cardBinding ?? null,
        fallback: data.fallback ?? null,
        error: data.error ?? null,
      });
    };
    window.addEventListener('message', onMessage);


    try {
      window.parent.postMessage(
        {
          type: 'CATALOG_HYDRATE_REQUEST',
          requestId,
          pagePath,
          sectionId,
          sectionType: sectionType || null,
          occurrenceIndex: typeof occurrenceIndex === 'number' ? occurrenceIndex : null,
        },
        '*',
      );
    } catch (err) {
      setState({ loading: false, rows: null, cardBinding: null, fallback: null, error: String(err) });
    }

    // Give the host ~1.5s; if nothing arrives, resolve to null so seeds render.
    const timer = window.setTimeout(() => {
      if (!mounted.current) return;
      setState((prev) => (prev.loading ? { loading: false, rows: null, cardBinding: null, fallback: null, error: null } : prev));
    }, 1500);

    return () => {
      mounted.current = false;
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timer);
    };
  }, [sectionId, sectionType, occurrenceIndex, bump]);

  return state;
}

/**
 * Merge live rows into a section's items prop. When hydration returns rows,
 * the live rows win. When it returns null (no binding / no parent /
 * timeout), the seed items are preserved. When it returns an empty array
 * with fallback 'hide_section', callers can hide the block.
 */
export function mergeHydratedItems(
  seedItems: any[] | undefined,
  hydration: SectionHydrationState,
): { items: any[]; hide: boolean } {
  if (hydration.loading) return { items: seedItems || [], hide: false };
  if (hydration.rows && hydration.rows.length > 0) {
    return { items: hydration.rows, hide: false };
  }
  if (hydration.rows && hydration.rows.length === 0 && hydration.fallback === 'hide_section') {
    return { items: [], hide: true };
  }
  return { items: seedItems || [], hide: false };
}
`;

/**
 * Section-type strings (in the composition's `s.type` vocabulary) that should
 * subscribe to live catalog hydration in the preview. Derived from the
 * canonical `catalogSurfaceRegistry` so there is no drift.
 */
import { listHydratableSectionTypes } from '@/platform/core/catalogSurfaceRegistry';

export const HYDRATABLE_SECTION_TYPES: readonly string[] = // from catalogSurfaceRegistry
  listHydratableSectionTypes();


