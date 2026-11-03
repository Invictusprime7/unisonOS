/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import * as React from 'react';
import { useEffect, useState } from 'react';
import { PUBLISHED_RUNTIME_CONFIG } from '../unison/publishedRuntime';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Type = __LucideIcons['Type'] || __LucideFallback;

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
    if (!runtime.siteId || !runtime.runtimeEndpoint) return null;
    const response = await fetch(runtime.runtimeEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'read',
        runtimeVersion: runtime.runtimeVersion,
        siteId: runtime.siteId,
        read: { type: 'profile' },
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
