import type { EffectiveCompositionProjection } from '@/services/effectiveCompositionProjector';

/**
 * P1 — revision-backed design authority.
 *
 * `effectiveComposition` is a derived index of accepted VFS bytes. It is
 * durable only when the database trigger stamped it with the exact row id and
 * its hash/parent match that row. Anything else (absent, unstamped, stale, or
 * an in-memory snapshot) is provisional and must be rebuilt from source; it is
 * never proof of what was accepted.
 */
export type EffectiveCompositionAuthorityStatus = 'durable' | 'provisional';

export type EffectiveCompositionAuthorityReason =
  | 'revision-stamped'
  | 'absent'
  | 'malformed'
  | 'unstamped'
  | 'revision-mismatch'
  | 'vfs-hash-mismatch'
  | 'parent-mismatch'
  | 'not-committed';

export interface EffectiveCompositionAuthority {
  status: EffectiveCompositionAuthorityStatus;
  reason: EffectiveCompositionAuthorityReason;
  revisionId: string | null;
  /** Page ids whose projection records unresolved source facts. */
  uncertainPages: string[];
  /** False whenever any page is uncertain: projection never claims full coverage. */
  complete: boolean;
  /** True when the index was rebuilt from saved files on open (still provisional). */
  rebuilt?: boolean;
}

export function assessEffectiveCompositionAuthority(row: {
  id: string;
  status?: string | null;
  vfsHash: string | null;
  parentRevisionId: string | null;
  siteBundleSnapshot: unknown;
}): EffectiveCompositionAuthority {
  const projection = (row.siteBundleSnapshot as { meta?: { effectiveComposition?: unknown } } | null)
    ?.meta?.effectiveComposition as Partial<EffectiveCompositionProjection> | undefined;
  const provisional = (reason: EffectiveCompositionAuthorityReason): EffectiveCompositionAuthority => ({
    status: 'provisional', reason, revisionId: null, uncertainPages: [], complete: false,
  });
  if (row.status && row.status !== 'committed') return provisional('not-committed');
  if (!projection) return provisional('absent');
  if (projection.schemaVersion !== '1.0' || !projection.pages || typeof projection.pages !== 'object') {
    return provisional('malformed');
  }
  const uncertainPages = Object.entries(projection.pages)
    .filter(([, page]) => Array.isArray(page?.uncertain) && page.uncertain.length > 0)
    .map(([pageId]) => pageId)
    .sort();
  const withCoverage = (base: EffectiveCompositionAuthority): EffectiveCompositionAuthority => ({
    ...base, uncertainPages, complete: base.status === 'durable' && uncertainPages.length === 0,
  });
  if (!projection.revisionId) return withCoverage(provisional('unstamped'));
  if (projection.revisionId !== row.id) return withCoverage(provisional('revision-mismatch'));
  if (!row.vfsHash || projection.vfsHash !== row.vfsHash) return withCoverage(provisional('vfs-hash-mismatch'));
  if ((projection.baseRevisionId ?? null) !== (row.parentRevisionId ?? null)) {
    return withCoverage(provisional('parent-mismatch'));
  }
  return withCoverage({
    status: 'durable', reason: 'revision-stamped', revisionId: row.id, uncertainPages: [], complete: false,
  });
}
