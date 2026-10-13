const cleanEnvValue = (value: unknown): string => {
  if (typeof value !== 'string') return '';

  // Trim and defensively strip pasted quotes/newlines that commonly leak from
  // copied dashboard values and break Supabase auth headers.
  const normalized = value
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/[\r\n]/g, '')
    .replace(/%0d|%0a/gi, '')
    .replace(/\s+/g, '');

  // Decode once so encoded control characters can be removed if present.
  try {
    return decodeURIComponent(normalized)
      .replace(/[\r\n]/g, '')
      .replace(/%0d|%0a/gi, '')
      .replace(/\s+/g, '');
  } catch {
    return normalized;
  }
};

const REMOTE_SUPABASE_URL =
  cleanEnvValue(import.meta.env.VITE_SUPABASE_URL) ||
  'https://nfrdomdvyrbwuokathtw.supabase.co';

export function resolveSupabaseClientUrl(remoteUrl: string, isDev: boolean, browserOrigin?: string | null): string {
  if (!isDev || !browserOrigin) return remoteUrl;
  try {
    return `${new URL(browserOrigin).origin}/__supabase`;
  } catch {
    return remoteUrl;
  }
}

export function resolveSupabaseAuthStorageKey(remoteUrl: string): string | undefined {
  try {
    const projectRef = new URL(remoteUrl).hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)?.[1];
    return projectRef ? `sb-${projectRef}-auth-token` : undefined;
  } catch {
    return undefined;
  }
}

export const SUPABASE_AUTH_STORAGE_KEY = resolveSupabaseAuthStorageKey(REMOTE_SUPABASE_URL);
export const SUPABASE_URL = resolveSupabaseClientUrl(
  REMOTE_SUPABASE_URL,
  import.meta.env.DEV === true && import.meta.env.VITE_SUPABASE_DEV_PROXY !== 'false',
  typeof window === 'undefined' ? null : window.location.origin,
);
export const SUPABASE_PUBLISHABLE_KEY =
  cleanEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  cleanEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  // Public browser credential for this connected backend. Keeping the
  // canonical fallback beside the URL prevents direct function transports
  // from becoming unavailable when a preview build omits injected Vite vars.
    'sb_publishable_9ggSZpWep1qxInwm3qRVkw_3Oc-tTtP';
export const isSupabaseEnvConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
