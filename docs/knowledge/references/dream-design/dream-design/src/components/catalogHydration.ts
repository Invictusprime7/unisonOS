/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { PUBLISHED_RUNTIME_CONFIG } from '../unison/publishedRuntime';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Type = __LucideIcons['Type'] || __LucideFallback;

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
const nextId = () => `h_${Date.now().toString(36)}_${(++__seq).toString(36)}`;
// Published sites revalidate through the public runtime gateway rather than
// subscribing directly to Supabase tables or credentials.
const PUBLISHED_CATALOG_REVALIDATE_MS = 60_000;

/**
 * Request live catalog rows for a generated section. Falls back gracefully
 * when there is no parent (published/standalone) or when the host has no
 * binding — callers should retain their static `items` prop as the seed.
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
        if (!runtime.siteId || !runtime.runtimeEndpoint || controller.signal.aborted) {
          window.clearTimeout(timer);
          if (mounted.current) setState({ loading: false, rows: null, cardBinding: null, fallback: null, error: null });
          return;
        }
        try {
          const response = await fetch(runtime.runtimeEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              operation: 'read',
              runtimeVersion: runtime.runtimeVersion,
              siteId: runtime.siteId,
              read: {
                type: 'catalog',
                pagePath: typeof window.location !== 'undefined' ? (window.location.pathname || '/') : '/',
                sectionId,
                sectionType: sectionType || null,
                occurrenceIndex: typeof occurrenceIndex === 'number' ? occurrenceIndex : null,
              },
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

      return () => {
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
      const data: any = event.data;
      if (!data) return;
      if (data.type === 'CATALOG_BINDINGS_CHANGED') {
        // Force a fresh hydration request.
        setState((prev) => ({ ...prev, loading: true }));
        setBump((b) => b + 1);
        return;
      }
      if (data.type !== 'CATALOG_HYDRATE_RESPONSE') return;
      if (data.requestId !== requestId) return;
      if (!mounted.current) return;
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
