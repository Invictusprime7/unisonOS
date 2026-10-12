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

export const SUPABASE_URL =
  cleanEnvValue(import.meta.env.VITE_SUPABASE_URL) ||
  'https://oruwtgdjurstvhgqcvbv.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  cleanEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  cleanEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  // Public browser credential for this connected backend. Keeping the
  // canonical fallback beside the URL prevents direct function transports
  // from becoming unavailable when a preview build omits injected Vite vars.
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ydXd0Z2RqdXJzdHZoZ3FjdmJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyOTE5NzIsImV4cCI6MjA3NTg2Nzk3Mn0.aOV9uab2niXhszfqCg81yzDRDg1-15XS9BL3-2bhhYM';
export const isSupabaseEnvConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
