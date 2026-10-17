/**
 * PlaygroundSyncController — Phase A4 of the builder refactor.
 *
 * Read-only compatibility projection of accepted VFS into Playground metadata.
 * No compile API is exposed: source edits and topology operations must use
 * canonical candidates and commitMutation, never a hydration round-trip.
 *
 * Per project rules custom hook files are prohibited — consumers call
 * `useContext(...)` / `useSyncExternalStore(...)` inline against
 * `subscribe()` rather than importing a `usePlaygroundSync()` hook.
 *
 * Out of scope for A4:
 *   - Persistence of PlaygroundState to `builder_drafts`. That stays with
 *     the existing draft persistence service; this controller only exposes
 *     the last hydration result.
 *   - Triggering preview reloads. That belongs to PreviewRuntimeController
 *     (A2).
 */

import {
  hydratePlaygroundFromVFS,
  mergeHydrationResult,
  type HydrationResult,
} from '@/services/playgroundHydrator';
import type { VirtualNode } from '@/hooks/useVirtualFileSystem';
import type { CreatorData } from '@/types/creatorData';
import type { PageRegistry } from '@/types/pageRegistry';

export type {
  HydrationResult,
};

export interface PlaygroundSyncControllerOptions {
  label?: string;
}

type Listener = () => void;

export class PlaygroundSyncController {
  readonly label: string;
  private lastHydration: HydrationResult | null = null;
  private listeners = new Set<Listener>();

  constructor(opts: PlaygroundSyncControllerOptions = {}) {
    this.label = opts.label ?? 'playground-sync';
  }

  // -------------------------------------------------------------- snapshots

  getLastHydration(): HydrationResult | null {
    return this.lastHydration;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  // ------------------------------------------------------------- hydration

  /**
   * Scan a VFS snapshot and infer a PageRegistry + CreatorData. The result
   * is cached on the controller (`getLastHydration()`) and subscribers are
   * notified so panes can refresh.
   */
  hydrateFromVFS(
    nodes: VirtualNode[],
    sandpackFiles: Record<string, string>,
  ): HydrationResult {
    const result = hydratePlaygroundFromVFS(nodes, sandpackFiles);
    this.lastHydration = result;
    this.emit();
    return result;
  }

  /** Idempotent merge of a fresh hydration into an existing snapshot. */
  merge(
    existing: { pageRegistry: PageRegistry; creatorData: CreatorData },
    incoming: HydrationResult,
  ) {
    return mergeHydrationResult(existing, incoming);
  }

}

/** Shared singleton for the live builder surface. */
export const livePlaygroundSync = new PlaygroundSyncController({
  label: 'playground-sync:live',
});
