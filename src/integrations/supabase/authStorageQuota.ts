/** Auth-only fallback: never evict project data to recover storage space. */

const COOKIE_CHUNK_SIZE = 3600;
const COOKIE_MAX_CHUNKS = 4;
const COOKIE_META_SUFFIX = '__chunks';

const isQuotaError = (error: unknown): boolean =>
  error instanceof DOMException &&
  ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(error.name);

/** Transient, safe-to-drop keys — never project or draft data. */
const TRANSIENT_KEY_PREFIXES = ['supabase_bootstrap_v3', 'unison:web-builder-module-retry'];

function sweepTransientKeys(store: Storage): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key && TRANSIENT_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        doomed.push(key);
      }
    }
    doomed.forEach((key) => store.removeItem(key));
  } catch {
    // Best-effort sweep only.
  }
}

function writeCookie(name: string, value: string): void {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Strict${secure}`;
  } catch {
    // Cookie write failed; backup is best-effort.
  }
}

function readCookie(name: string): string | null {
  try {
    const prefix = `${name}=`;
    const entry = document.cookie.split('; ').find((part) => part.startsWith(prefix));
    return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
  } catch {
    return null;
  }
}

function deleteCookie(name: string): void {
  try {
    document.cookie = `${name}=; path=/; max-age=0`;
  } catch {
    // ignore
  }
}

function writeCookieBackup(authKey: string, value: string): void {
  const chunks: string[] = [];
  for (let offset = 0; offset < value.length && chunks.length < COOKIE_MAX_CHUNKS; offset += COOKIE_CHUNK_SIZE) {
    chunks.push(value.slice(offset, offset + COOKIE_CHUNK_SIZE));
  }
  if (chunks.length === 0 || chunks.join('').length !== value.length) {
    // Session too large for a cookie backup — skip rather than store a corrupt copy.
    clearCookieBackup(authKey);
    return;
  }
  chunks.forEach((chunk, index) => writeCookie(`${authKey}__bak${index}`, chunk));
  writeCookie(`${authKey}${COOKIE_META_SUFFIX}`, String(chunks.length));
}

function readCookieBackup(authKey: string): string | null {
  const count = Number(readCookie(`${authKey}${COOKIE_META_SUFFIX}`));
  if (!Number.isInteger(count) || count < 1 || count > COOKIE_MAX_CHUNKS) return null;
  let value = '';
  for (let index = 0; index < count; index += 1) {
    const chunk = readCookie(`${authKey}__bak${index}`);
    if (chunk === null) return null;
    value += chunk;
  }
  return value || null;
}

function clearCookieBackup(authKey: string): void {
  deleteCookie(`${authKey}${COOKIE_META_SUFFIX}`);
  for (let index = 0; index < COOKIE_MAX_CHUNKS; index += 1) {
    deleteCookie(`${authKey}__bak${index}`);
  }
}

/**
 * Keeps the auth session readable when localStorage is full and across tab
 * crashes. Order of recovery for an auth-key read: localStorage →
 * sessionStorage bridge → crash-safe cookie backup (rehydrated into
 * localStorage so the SDK sees a normal session again).
 */
export function installAuthStorageQuotaRecovery(authKey: string, primary: Storage, fallback: Storage): () => void {
  const prototype = Object.getPrototypeOf(primary) as Storage;
  const get = prototype.getItem;
  const set = prototype.setItem;
  const remove = prototype.removeItem;
  const matches = (key: string) => key === authKey || key.startsWith(`${authKey}-`);

  prototype.getItem = function (key: string): string | null {
    if (this === primary && matches(key)) {
      const bridged = get.call(fallback, key);
      if (bridged !== null) return bridged;
      const local = get.call(this, key);
      if (local !== null) return local;
      // Crash recovery: sessionStorage died with the tab; restore from the
      // cookie backup so the user is not signed out by a browser crash.
      const backup = readCookieBackup(key);
      if (backup !== null) {
        try {
          set.call(this, key, backup);
        } catch (error) {
          if (isQuotaError(error)) {
            sweepTransientKeys(this);
            try {
              set.call(this, key, backup);
            } catch {
              try {
                set.call(fallback, key, backup);
              } catch {
                // Nowhere to put it; still return the value for this read.
              }
            }
          }
        }
        return backup;
      }
      return null;
    }
    return get.call(this, key);
  };

  prototype.setItem = function (key: string, value: string): void {
    if (this !== primary || !matches(key)) return set.call(this, key, value);
    try {
      set.call(primary, key, value);
      remove.call(fallback, key);
    } catch (error) {
      if (!isQuotaError(error)) throw error;
      sweepTransientKeys(primary);
      try {
        set.call(primary, key, value);
        remove.call(fallback, key);
      } catch (retryError) {
        if (!isQuotaError(retryError)) throw retryError;
        set.call(fallback, key, value);
        remove.call(primary, key);
      }
    }
    writeCookieBackup(key, value);
  };

  prototype.removeItem = function (key: string): void {
    if (this === primary && matches(key)) {
      remove.call(fallback, key);
      clearCookieBackup(key);
    }
    remove.call(this, key);
  };

  return () => {
    prototype.getItem = get;
    prototype.setItem = set;
    prototype.removeItem = remove;
  };
}
