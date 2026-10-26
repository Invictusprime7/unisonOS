import type { PatchSource } from '@/types/patchPlan';
import { normalizeAuthoredPath } from '@/services/builder/authoredSourcePreservation';

export type FileOwnership = 'ai' | 'user' | 'compiler' | 'system';
export type FileAuthorshipOrigin = PatchSource | 'legacy';

export interface FileProvenanceRecord {
  version: '1.0';
  path: string;
  creatorOrigin: FileAuthorshipOrigin;
  lastEditorOrigin: FileAuthorshipOrigin;
  ownership: FileOwnership;
  priorHash: string | null;
  currentHash: string | null;
  candidateId: string | null;
  lastOperationIds: string[];
  authoredRevisionId: string | null;
  deleted: boolean;
}

export type FileProvenanceMap = Record<string, FileProvenanceRecord>;

function matchesOwnedPath(path: string, ownedPaths: readonly string[]): boolean {
  return ownedPaths.some((raw) => {
    const owned = normalizeAuthoredPath(raw);
    return owned === path || (owned.endsWith('/**') && path.startsWith(owned.slice(0, -2)));
  });
}

function ownershipFor(source: PatchSource, path: string, compilerOwnedPaths: readonly string[]): FileOwnership {
  if (matchesOwnedPath(path, compilerOwnedPaths)) return 'compiler';
  if (source === 'ai-builder' || source === 'wizard-launch') return 'ai';
  if (source === 'playground-edit' || source === 'layout-fast-path' || source === 'preview-toolbar') return 'user';
  return 'system';
}

async function hashFile(contents: string): Promise<string> {
  const bytes = new TextEncoder().encode(contents);
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest('SHA-256', bytes);
    return `sha256:${Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')}`;
  }
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a:${hash.toString(16).padStart(8, '0')}`;
}

export async function fileProvenanceMatchesContent(
  contents: string,
  provenance: FileProvenanceRecord | undefined,
): Promise<boolean> {
  if (!provenance || provenance.deleted || !provenance.currentHash) return false;
  return provenance.currentHash === await hashFile(contents);
}

/**
 * Produce ledger metadata only. This never changes source, chooses layouts,
 * or grants ownership from a filename convention. Supabase stamps the actual
 * accepted revision ID inside the same CAS transaction.
 */
export async function buildFileProvenance(input: {
  previousFiles: Record<string, string>;
  files: Record<string, string>;
  previousProvenance?: FileProvenanceMap | null;
  parentRevisionId?: string | null;
  source: PatchSource;
  operationIds: readonly string[];
  candidateId?: string | null;
  compilerOwnedPaths: readonly string[];
}): Promise<FileProvenanceMap> {
  const previous = new Map(Object.entries(input.previousFiles).map(([path, contents]) => [normalizeAuthoredPath(path), contents]));
  const current = new Map(Object.entries(input.files).map(([path, contents]) => [normalizeAuthoredPath(path), contents]));
  const provenance: FileProvenanceMap = {};

  for (const path of [...new Set([...previous.keys(), ...current.keys()])].sort()) {
    const before = previous.get(path);
    const after = current.get(path);
    const prior = input.previousProvenance?.[path];
    const changed = before !== after;

    if (!changed && prior && after !== undefined) {
      provenance[path] = { ...prior, path, deleted: false };
      continue;
    }

    const origin = prior?.creatorOrigin ?? (before === undefined ? input.source : 'legacy');
    const currentHash = after === undefined ? null : await hashFile(after);
    provenance[path] = {
      version: '1.0',
      path,
      creatorOrigin: origin,
      lastEditorOrigin: changed ? input.source : prior?.lastEditorOrigin ?? 'legacy',
      ownership: changed
        ? ownershipFor(input.source, path, input.compilerOwnedPaths)
        : prior?.ownership ?? ownershipFor(input.source, path, input.compilerOwnedPaths),
      priorHash: before === undefined ? null : await hashFile(before),
      currentHash,
      candidateId: changed ? input.candidateId ?? null : prior?.candidateId ?? null,
      lastOperationIds: changed ? [...input.operationIds] : prior?.lastOperationIds ?? [],
      authoredRevisionId: changed ? null : prior?.authoredRevisionId ?? input.parentRevisionId ?? null,
      deleted: after === undefined,
    };
  }

  return provenance;
}

export function stampAcceptedRevision(
  provenance: FileProvenanceMap,
  revisionId: string,
): FileProvenanceMap {
  return Object.fromEntries(Object.entries(provenance).map(([path, record]) => [
    path,
    record.authoredRevisionId ? record : { ...record, authoredRevisionId: revisionId },
  ]));
}
