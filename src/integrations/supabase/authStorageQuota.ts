/** Auth-only fallback: never evict project data to recover storage space. */
export function installAuthStorageQuotaRecovery(authKey: string, primary: Storage, fallback: Storage): () => void {
  const prototype = Object.getPrototypeOf(primary) as Storage;
  const get = prototype.getItem;
  const set = prototype.setItem;
  const remove = prototype.removeItem;
  const matches = (key: string) => key === authKey || key.startsWith(`${authKey}-`);
  prototype.getItem = function (key: string): string | null {
    if (this === primary && matches(key)) {
      const value = get.call(fallback, key);
      if (value !== null) return value;
    }
    return get.call(this, key);
  };
  prototype.setItem = function (key: string, value: string): void {
    if (this !== primary || !matches(key)) return set.call(this, key, value);
    try {
      set.call(primary, key, value);
    } catch (error) {
      if (!(error instanceof DOMException) || !['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(error.name)) throw error;
      set.call(fallback, key, value);
      remove.call(primary, key);
      return;
    }
    remove.call(fallback, key);
  };
  prototype.removeItem = function (key: string): void {
    if (this === primary && matches(key)) remove.call(fallback, key);
    remove.call(this, key);
  };
  return () => {
    prototype.getItem = get;
    prototype.setItem = set;
    prototype.removeItem = remove;
  };
}