/**
 * businessProfileHydrationModule — VFS-injected runtime helper.
 *
 * Emits `/src/components/businessProfile.ts` into every generated site so
 * Hero/Footer/Contact/Booking sections can read the live BusinessProfileDTO
 * without prop-drilling from wizard state or seeds.
 *
 * Contract:
 *   - Host writes the profile to `window.top.__UNISON_BUSINESS__`
 *     (BusinessProfileProvider does this).
 *   - Iframe reads via `useBusinessProfile()` below and re-renders on the
 *     `unison:business-profile-changed` event bubbled from the parent
 *     via postMessage (`BUSINESS_PROFILE_CHANGED`).
 *   - When there is no parent (published/standalone), the hook returns
 *     `null` and callers preserve their seed props.
 */

export const BUSINESS_PROFILE_HYDRATION_PATH = '/src/components/businessProfile.ts';

export const BUSINESS_PROFILE_HYDRATION_MODULE = `import { useEffect, useState } from 'react';
import { TRUSTED_PREVIEW_ORIGIN_SOURCE } from '@/utils/trustedPreviewOrigin';
import { PUBLISHED_RUNTIME_CONFIG } from '@/unison/publishedRuntime';

export interface BusinessProfileLive {
  businessId: string;
  name: string;
  slug?: string | null;
  industry?: string | null;
  tagline?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  notificationEmail?: string | null;
  timezone?: string;
  address?: { line1?: string; city?: string; region?: string; postalCode?: string; country?: string };
  hours?: Array<{ day: string; open?: string; close?: string; closed?: boolean }>;
  socialLinks?: Record<string, string>;
}

function readFromWindow(): BusinessProfileLive | null {
  if (typeof window === 'undefined') return null;
  try {
    const local = (window as any).__UNISON_BUSINESS__;
    if (local) return local as BusinessProfileLive;
    if (window.parent && window.parent !== window) {
      const remote = (window.parent as any).__UNISON_BUSINESS__;
      if (remote) return remote as BusinessProfileLive;
    }
  } catch {
    /* cross-origin — will hydrate via postMessage below */
  }
  return null;
}

async function readPublishedBusinessProfile(): Promise<BusinessProfileLive | null> {
  try {
    const runtime = PUBLISHED_RUNTIME_CONFIG;
    // Live reads go to the public read gateway (site-runtime-read), which
    // expects a flat body — not the action runtime's { operation, read } shape.
    if (!runtime.siteId || !runtime.endpoint) return null;
    const response = await fetch(runtime.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'profile',
        runtimeVersion: runtime.runtimeVersion,
        siteId: runtime.siteId,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { profile?: BusinessProfileLive | null };
    return data.profile ?? null;
  } catch {
    return null;
  }
}

export function useBusinessProfile(): BusinessProfileLive | null {
  const [profile, setProfile] = useState<BusinessProfileLive | null>(() => readFromWindow());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.parent === window) {
      let active = true;
      void readPublishedBusinessProfile().then((nextProfile) => {
        if (active && nextProfile) setProfile(nextProfile);
      });
      return () => { active = false; };
    }

    // Ask the host to re-broadcast the profile on mount.
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'BUSINESS_PROFILE_REQUEST' }, '*');
      }
    } catch { /* noop */ }

    const onMessage = (event: MessageEvent) => {
      if ((event.source !== window.parent) || !(${TRUSTED_PREVIEW_ORIGIN_SOURCE})(event.origin)) return;
      const data = event.data as { type?: string; profile?: BusinessProfileLive | null } | null;
      if (!data || data.type !== 'BUSINESS_PROFILE_CHANGED') return;
      setProfile(data.profile ?? null);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return profile;
}

/** Convenience: merge live profile into a seeded value; live wins when present. */
export function mergeProfileField<T>(seed: T | undefined, live: T | undefined | null): T | undefined {
  if (live !== undefined && live !== null && live !== '' as unknown as T) return live as T;
  return seed;
}
`;
