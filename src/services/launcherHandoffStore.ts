import type { LaunchState } from '@/types/launchState';

export const LAUNCHER_HANDOFF_KEY = 'unison.systemLauncher.pendingHandoff.v1';
export const HANDOFF_TTL_MS = 30 * 60 * 1000;

export interface LauncherHandoffSnapshot {
  targetPath: '/web-builder';
  createdAt: string;
  expiresAt: number;
  routeState: Record<string, unknown>;
  launchState?: LaunchState;
}

export function launcherHandoffStorageAvailable() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function readLauncherHandoff(): LauncherHandoffSnapshot | null {
  if (!launcherHandoffStorageAvailable()) return null;

  try {
    const raw = window.sessionStorage.getItem(LAUNCHER_HANDOFF_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as LauncherHandoffSnapshot;
    if (!parsed || parsed.targetPath !== '/web-builder' || Date.now() > parsed.expiresAt) {
      window.sessionStorage.removeItem(LAUNCHER_HANDOFF_KEY);
      return null;
    }

    return parsed;
  } catch {
    window.sessionStorage.removeItem(LAUNCHER_HANDOFF_KEY);
    return null;
  }
}

export function clearLauncherHandoff() {
  if (!launcherHandoffStorageAvailable()) return;
  try {
    window.sessionStorage.removeItem(LAUNCHER_HANDOFF_KEY);
  } catch {
    // Ignore storage failures; the handoff expires independently.
  }
}
