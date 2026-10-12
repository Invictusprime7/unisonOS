const COMMIT_EVENT = 'unison:pipeline:commit';

let bypassWarningInstalled = false;

/**
 * Install the lightweight development observer used by the Debug Agent and
 * Intent Inspector. This module deliberately has no dependency on the
 * canonical compiler so the application shell can start before builder code
 * is requested.
 */
export function installPipelineBypassGuard(): void {
  if (bypassWarningInstalled) return;
  if (typeof window === 'undefined') return;
  if (!import.meta.env?.DEV) return;
  bypassWarningInstalled = true;

  const counter = { commits: 0, bypasses: 0 };
  (window as unknown as { __unisonPipelineStats?: typeof counter }).__unisonPipelineStats = counter;

  window.addEventListener(COMMIT_EVENT, () => {
    counter.commits += 1;
  });
}
