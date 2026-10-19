/** Keep refreshes serial, with one trailing read when data changes mid-request. */
export function createCoalescedRefresh(load: () => Promise<void>) {
  let active: Promise<void> | null = null;
  let requested = false;
  let disposed = false;
  return {
    refresh(): Promise<void> {
      if (disposed) return Promise.resolve();
      requested = true;
      if (active) return active;
      active = (async () => {
        try {
          while (requested && !disposed) {
            requested = false;
            await load();
          }
        } finally { active = null; }
      })();
      return active;
    },
    dispose() { disposed = true; requested = false; },
  };
}