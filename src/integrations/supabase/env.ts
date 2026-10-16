/**
 * Browser backend identity. UNISON (ref below) is the single authoritative
 * database for every environment — Lovable Preview, local dev and Vercel.
 * Injected Vite values that point at any other project (e.g. the Lovable Cloud
 * built-in instance) are ignored together with their publishable key, so a
 * client can never pair one project's URL with another's key.
 */
export const AUTHORITATIVE_SUPABASE_PROJECT_REF = 'nfrdomdvyrbwuokathtw';
export const AUTHORITATIVE_SUPABASE_URL = `https://${AUTHORITATIVE_SUPABASE_PROJECT_REF}.supabase.co`;
// Public browser credential for UNISON (publishable, RLS-protected).
const AUTHORITATIVE_PUBLISHABLE_KEY = 'sb_publishable_9ggSZpWep1qxInwm3qRVkw_3Oc-tTtP';
export const SUPABASE_DEV_PROXY_PATH = '/__supabase';

const cleanEnvValue = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const normalized = value
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/[\r\n]/g, '')
    .replace(/%0d|%0a/gi, '')
    .replace(/\s+/g, '');
  try {
    return decodeURIComponent(normalized).replace(/[\r\n]/g, '').replace(/%0d|%0a/gi, '').replace(/\s+/g, '');
  } catch {
    return normalized;
  }
};

export function projectRefFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export interface SupabaseConfigInput {
  url?: unknown;
  publishableKey?: unknown;
  anonKey?: unknown;
}

/** Injected values win only when they name UNISON; otherwise UNISON defaults are used. */
export function resolveAuthoritativeSupabaseConfig(input: SupabaseConfigInput): {
  url: string; publishableKey: string; ignoredInjectedRef: string | null;
} {
  const injectedUrl = cleanEnvValue(input.url);
  const injectedRef = injectedUrl ? projectRefFromUrl(injectedUrl) : null;
  if (injectedRef === AUTHORITATIVE_SUPABASE_PROJECT_REF) {
    const key = cleanEnvValue(input.publishableKey) || cleanEnvValue(input.anonKey) || AUTHORITATIVE_PUBLISHABLE_KEY;
    return { url: injectedUrl.replace(/\/+$/, ''), publishableKey: key, ignoredInjectedRef: null };
  }
  return {
    url: AUTHORITATIVE_SUPABASE_URL,
    publishableKey: AUTHORITATIVE_PUBLISHABLE_KEY,
    ignoredInjectedRef: injectedUrl ? (injectedRef ?? injectedUrl) : null,
  };
}

export function resolveSupabaseClientUrl(remoteUrl: string, isDev: boolean, browserOrigin?: string | null): string {
  if (!isDev || !browserOrigin) return remoteUrl;
  try {
    return `${new URL(browserOrigin).origin}${SUPABASE_DEV_PROXY_PATH}`;
  } catch {
    return remoteUrl;
  }
}

export function resolveSupabaseAuthStorageKey(remoteUrl: string): string | undefined {
  const ref = projectRefFromUrl(remoteUrl);
  return ref ? `sb-${ref}-auth-token` : undefined;
}

/**
 * Startup identity guard. Accepts the direct UNISON URL, or the same-origin
 * dev proxy only when its upstream (remote) URL is UNISON.
 */
export function verifySupabaseIdentity(clientUrl: string, remoteUrl: string, browserOrigin?: string | null):
  { ok: true } | { ok: false; reason: string } {
  const remoteRef = projectRefFromUrl(remoteUrl);
  if (remoteRef !== AUTHORITATIVE_SUPABASE_PROJECT_REF) {
    return { ok: false, reason: `Backend points to "${remoteRef ?? remoteUrl}", expected ${AUTHORITATIVE_SUPABASE_PROJECT_REF}.` };
  }
  if (clientUrl.replace(/\/+$/, '') === remoteUrl.replace(/\/+$/, '')) return { ok: true };
  try {
    const parsed = new URL(clientUrl);
    const sameOrigin = browserOrigin ? parsed.origin === new URL(browserOrigin).origin : false;
    if (sameOrigin && parsed.pathname.replace(/\/+$/, '') === SUPABASE_DEV_PROXY_PATH) return { ok: true };
  } catch { /* fall through */ }
  return { ok: false, reason: `Backend client URL "${clientUrl}" does not target ${AUTHORITATIVE_SUPABASE_PROJECT_REF}.` };
}

const resolved = resolveAuthoritativeSupabaseConfig({
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});
if (resolved.ignoredInjectedRef && typeof console !== 'undefined') {
  console.info(`[supabase] Ignoring injected backend "${resolved.ignoredInjectedRef}"; using UNISON.`);
}

const BROWSER_ORIGIN = typeof window === 'undefined' ? null : window.location.origin;
export const SUPABASE_REMOTE_URL = resolved.url;
export const SUPABASE_AUTH_STORAGE_KEY = resolveSupabaseAuthStorageKey(SUPABASE_REMOTE_URL);
export const SUPABASE_URL = resolveSupabaseClientUrl(
  SUPABASE_REMOTE_URL,
  import.meta.env.DEV === true && import.meta.env.VITE_SUPABASE_DEV_PROXY !== 'false',
  BROWSER_ORIGIN,
);
export const SUPABASE_PUBLISHABLE_KEY = resolved.publishableKey;
export const SUPABASE_IDENTITY = verifySupabaseIdentity(SUPABASE_URL, SUPABASE_REMOTE_URL, BROWSER_ORIGIN);
export const isSupabaseEnvConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && SUPABASE_IDENTITY.ok);
