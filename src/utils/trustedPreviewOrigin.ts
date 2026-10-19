/**
 * Origins allowed to exchange builder ↔ preview messages: this app, its
 * sandboxed preview bundlers, and Unison/Lovable-hosted surfaces.
 * `TRUSTED_PREVIEW_ORIGIN_SOURCE` is the same check for injected preview code.
 */
export const TRUSTED_PREVIEW_ORIGIN_SOURCE = `function(origin) {
  if (!origin || typeof origin !== 'string') return false;
  if (origin === 'null') return true;
  try { if (origin === window.location.origin) return true; } catch (_) {}
  var m = /^(https?):\\/\\/([^/:]+)(?::\\d+)?$/.exec(origin);
  if (!m) return false;
  var proto = m[1], host = m[2].toLowerCase();
  if (proto === 'http') return host === 'localhost' || host === '127.0.0.1';
  var suffixes = ['.codesandbox.io', '.csb.app', '.lovable.app', '.lovableproject.com', '.lovable.dev', '.unisontasks.com', '.unisonos.ai', '.unisonai.dev'];
  var exact = ['codesandbox.io', 'unisontasks.com', 'unisonos.ai', 'unisonai.dev', 'unison-tasks.vercel.app', 'unisonai.vercel.app', 'unisonos.vercel.app', 'unison-tasks-official.vercel.app', 'unison-tasks.netlify.app'];
  if (exact.indexOf(host) !== -1) return true;
  for (var i = 0; i < suffixes.length; i++) { if (host.slice(-suffixes[i].length) === suffixes[i]) return true; }
  return false;
}`;

const EXACT = ['codesandbox.io', 'unisontasks.com', 'unisonos.ai', 'unisonai.dev', 'unison-tasks.vercel.app', 'unisonai.vercel.app', 'unisonos.vercel.app', 'unison-tasks-official.vercel.app', 'unison-tasks.netlify.app'];
const SUFFIXES = ['.codesandbox.io', '.csb.app', '.lovable.app', '.lovableproject.com', '.lovable.dev', '.unisontasks.com', '.unisonos.ai', '.unisonai.dev'];

export function isTrustedPreviewOrigin(origin: string): boolean {
  if (!origin || typeof origin !== 'string') return false;
  if (origin === 'null') return true;
  if (typeof window !== 'undefined' && origin === window.location.origin) return true;
  const m = /^(https?):\/\/([^/:]+)(?::\d+)?$/.exec(origin);
  if (!m) return false;
  const host = m[2].toLowerCase();
  if (m[1] === 'http') return host === 'localhost' || host === '127.0.0.1';
  return EXACT.includes(host) || SUFFIXES.some((s) => host.endsWith(s));
}
