const STORAGE_PREFIX = 'unison:external-preview:';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface ExternalPreviewSession {
  files: Record<string, string>;
  title: string;
  createdAt: number;
}

export type ExternalPreviewChannelMessage =
  | { type: 'request' }
  | { type: 'files'; files: Record<string, string> };

const getStorageKey = (previewKey: string) => `${STORAGE_PREFIX}${previewKey}`;

export function createExternalPreviewChannel(previewKey: string): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(`${getStorageKey(previewKey)}:live`);
}

export function isExternalPreviewFilesMessage(value: unknown): value is Extract<ExternalPreviewChannelMessage, { type: 'files' }> {
  if (!value || typeof value !== 'object') return false;
  const message = value as { type?: unknown; files?: unknown };
  return message.type === 'files'
    && typeof message.files === 'object'
    && message.files !== null
    && Object.values(message.files).every((content) => typeof content === 'string');
}

function isQuotaExceededError(error: unknown): boolean {
  return error instanceof DOMException
    && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
}

/** Drop every stored session, expired or not — they're all ephemeral/recreatable. */
function clearAllExternalPreviewSessions(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) keysToRemove.push(key);
    }
    for (const key of keysToRemove) localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable; the live channel can still bootstrap preview files.
  }
}

export function createExternalPreviewSession(
  files: Record<string, string>,
  title: string,
): string {
  const previewKey = crypto.randomUUID();
  const session: ExternalPreviewSession = {
    files,
    title,
    createdAt: Date.now(),
  };
  const serialized = JSON.stringify(session);

  try {
    localStorage.setItem(getStorageKey(previewKey), serialized);
    return previewKey;
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      if (typeof BroadcastChannel !== 'undefined') return previewKey;
      throw error;
    }
  }

  // Full generated sites (all pages + UI foundation modules) can exceed
  // localStorage's ~5-10MB quota on their own, but stale prior sessions
  // (up to a 24h TTL) are a common contributor. Free that space and retry
  // once before giving callers a clear, catchable failure instead of an
  // uncaught DOMException.
  clearAllExternalPreviewSessions();
  try {
    localStorage.setItem(getStorageKey(previewKey), serialized);
    return previewKey;
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      if (typeof BroadcastChannel !== 'undefined') return previewKey;
      throw error;
    }
  }

  // The opener streams the full VFS over BroadcastChannel. Keep only the
  // bootstrap metadata in storage when the source itself exceeds its quota.
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      localStorage.setItem(getStorageKey(previewKey), JSON.stringify({ ...session, files: {} }));
      return previewKey;
    } catch {
      return previewKey;
    }
  }

  throw new Error('This site is too large to open in a new preview tab (browser storage limit). Preview it from the Web Builder instead.');
}

export function readExternalPreviewSession(previewKey: string): ExternalPreviewSession | null {
  const storageKey = getStorageKey(previewKey);
  let serializedSession: string | null;
  try {
    serializedSession = localStorage.getItem(storageKey);
  } catch {
    return null;
  }
  if (!serializedSession) return null;

  try {
    const session = JSON.parse(serializedSession) as ExternalPreviewSession;
    if (
      !session
      || typeof session.createdAt !== 'number'
      || typeof session.title !== 'string'
      || typeof session.files !== 'object'
      || session.files === null
      || Date.now() - session.createdAt > SESSION_TTL_MS
    ) {
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
      return null;
    }

    return session;
  } catch {
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    return null;
  }
}