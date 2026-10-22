/**
 * useSupabaseBootstrap
 *
 * Fires ONCE per browser session after the user is authenticated.
 * Automates the Supabase provisioning tasks that must run for every
 * authenticated business in Unison:
 *
 *  1. Resolve the current user's businesses.
 *  2. For each business without a `unison_ai` plugin instance,
 *     fire `install-system` to provision agents + recipe packs.
 *
 * All steps are best-effort — failures are logged but never throw or
 * block the UI render.
 *
 * Usage: mount `<SupabaseBootstrap />` once inside App.tsx (or any root
 * component that lives inside the auth provider).
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Bump these keys if the bootstrap logic changes so existing sessions
// re-run the new checks automatically. Persistent cache prevents refresh loops.
const BOOTSTRAP_CACHE_KEY = 'supabase_bootstrap_v3';
const BOOTSTRAP_PERSIST_PREFIX = 'supabase_bootstrap_v3:last_run:';
const BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_BOOTSTRAP_PROVISION_ATTEMPTS = 3;
const WEB_BUILDER_PATH = '/web-builder';

interface BootstrapBusiness {
  id: string;
  name: string;
  industry: string | null;
}

async function resolveUserBusinesses(userId: string): Promise<BootstrapBusiness[]> {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, industry')
    .eq('owner_id', userId)
    .limit(20);

  if (error) {
    console.warn('[SupabaseBootstrap] Could not resolve businesses:', error.message);
    return [];
  }
  return (data ?? []) as BootstrapBusiness[];
}

async function hasPluginInstance(businessId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('ai_plugin_instances')
    .select('id')
    .eq('business_id', businessId)
    .limit(1)
    .maybeSingle();

  if (error) {
    // Permission-sensitive checks must never trigger install retries from the
    // root shell. Treat unknown/forbidden as already provisioned; explicit user
    // actions can still run install-system later.
    console.warn('[SupabaseBootstrap] Plugin check skipped:', error.message);
    return true;
  }
  return !!data;
}

type InstallSystemType = 'booking' | 'portfolio' | 'store' | 'agency' | 'content' | 'saas';

const INDUSTRY_TO_SYSTEM: Record<string, InstallSystemType> = {
  booking: 'booking', salon: 'booking', spa: 'booking', restaurant: 'booking',
  contractor: 'booking', coaching: 'booking', fitness: 'booking', local_service: 'booking',
  portfolio: 'portfolio', photography: 'portfolio', creative: 'portfolio',
  store: 'store', ecommerce: 'store', retail: 'store',
  agency: 'agency', realestate: 'agency', real_estate: 'agency', consulting: 'agency',
  content: 'content', blog: 'content', nonprofit: 'content', media: 'content',
  saas: 'saas', software: 'saas',
};

/** install-system accepts only canonical system types; industries map onto them. */
export function resolveInstallSystemType(industry: string | null): InstallSystemType {
  const key = (industry ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return INDUSTRY_TO_SYSTEM[key] ?? 'agency';
}

async function provisionBusiness(business: BootstrapBusiness): Promise<void> {
  console.log('[SupabaseBootstrap] Provisioning business:', business.id, business.name);
  const { error } = await supabase.functions.invoke('install-system', {
    body: {
      businessId: business.id,
      systemType: resolveInstallSystemType(business.industry),
      industry: business.industry ?? undefined,
      source: 'bootstrap',
    },
  });
  if (error) console.warn('[SupabaseBootstrap] install-system declined:', error.message);
}

function isWebBuilderRoute(): boolean {
  return typeof window !== 'undefined' && window.location.pathname === WEB_BUILDER_PATH;
}

function hasFreshPersistentRun(userId: string): boolean {
  try {
    const value = localStorage.getItem(`${BOOTSTRAP_PERSIST_PREFIX}${userId}`);
    const timestamp = value ? Number(value) : 0;
    return Number.isFinite(timestamp) && Date.now() - timestamp < BOOTSTRAP_TTL_MS;
  } catch {
    return false;
  }
}

function markPersistentRun(userId: string): void {
  try {
    localStorage.setItem(`${BOOTSTRAP_PERSIST_PREFIX}${userId}`, String(Date.now()));
  } catch {
    // Storage can be unavailable in private mode; session cache still applies.
  }
}

export function useSupabaseBootstrap(): void {
  const ran = useRef(false);

  useEffect(() => {
    // Only run once per React mount lifetime and once per browser session.
    if (ran.current) return;
    if (sessionStorage.getItem(BOOTSTRAP_CACHE_KEY)) return;
    if (isWebBuilderRoute()) return;
    ran.current = true;

    const run = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) return; // unauthenticated — nothing to do

        const userId = session.user.id;
        if (hasFreshPersistentRun(userId)) {
          sessionStorage.setItem(BOOTSTRAP_CACHE_KEY, '1');
          return;
        }

        // Mark before network work so failures cannot create re-entrant loops
        // or a frozen shell on refresh/navigation.
        sessionStorage.setItem(BOOTSTRAP_CACHE_KEY, '1');
        markPersistentRun(userId);

        // Auto-provision plugin instances for unprovisioned businesses.
        const businesses = await resolveUserBusinesses(userId);
        for (const biz of businesses.slice(0, MAX_BOOTSTRAP_PROVISION_ATTEMPTS)) {
          const alreadyProvisioned = await hasPluginInstance(biz.id);
          if (!alreadyProvisioned) {
            await provisionBusiness(biz).catch((err) =>
              console.warn('[SupabaseBootstrap] Provisioning failed for', biz.id, err?.message)
            );
          }
        }

        console.log('[SupabaseBootstrap] Bootstrap complete for user:', userId);
      } catch (err) {
        // Bootstrap failures are always non-fatal.
        console.warn('[SupabaseBootstrap] Non-fatal bootstrap error:', err);
      }
    };

    const timer = window.setTimeout(run, 1500);
    return () => window.clearTimeout(timer);
  }, []);
}

/**
 * Thin component wrapper so the hook can be placed declaratively in JSX.
 *
 * @example
 * // In App.tsx:
 * import { SupabaseBootstrap } from '@/hooks/useSupabaseBootstrap';
 * // Inside the provider tree:
 * <SupabaseBootstrap />
 */
export function SupabaseBootstrap(): null {
  useSupabaseBootstrap();
  return null;
}
