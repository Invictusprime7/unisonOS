/**
 * Synchronous recovery journal for Web Builder state.
 *
 * Cloud persistence is authoritative once acknowledged, but browser/process
 * shutdown can interrupt an in-flight request. Every edit writes the complete
 * VFS here before starting the remote save so the next session can replay it.
 */

export type BuilderSaveReason =
  | 'interval_autosave'
  | 'manual_save'
  | 'ai_edit'
  | 'ai_recovery'
  | 'navigation_flush';

export interface BuilderRecoverySnapshot {
  version: 2;
  code: string;
  editorCode: string;
  savedAt: string;
  persistedAt?: string;
  /** Canonical revision returned by the server for this exact journal snapshot. */
  acknowledgedRevisionId?: string;
  templateId: string | null;
  vfsSignature: string;
  vfsFiles: Record<string, string>;
  /** Pending VFS operations preserve preview projection while a cloud revision catches up. */
  pendingVfsOperations?: unknown[];
  reason: BuilderSaveReason;
  pendingRemote: boolean;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const UNSCOPED_RECOVERY_KEY = 'webbuilder_autosave_draft';
const SCOPED_RECOVERY_PREFIX = 'webbuilder_autosave_';

function isFileMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every((content) => typeof content === 'string');
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function getBuilderRecoveryKey(draftId?: string | null): string {
  return draftId ? `${SCOPED_RECOVERY_PREFIX}${draftId}` : UNSCOPED_RECOVERY_KEY;
}

/**
 * Full-content signature. Unlike the previous length + tail heuristic, edits
 * near the start or middle of a same-length file always change this value.
 */
export function computeBuilderVfsSignature(files: Record<string, string>): string {
  const paths = Object.keys(files).sort();
  if (paths.length === 0) return '';

  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b9;
  let totalLength = 0;
  const feed = (value: string) => {
    totalLength += value.length;
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      hashA = Math.imul(hashA ^ code, 0x01000193);
      hashB = Math.imul(hashB ^ (code + index), 0x85ebca6b);
    }
  };

  for (const path of paths) {
    feed(path);
    feed('\0');
    feed(files[path] ?? '');
    feed('\u0001');
  }

  return `v2:${paths.length}:${totalLength}:${hashA >>> 0}:${hashB >>> 0}`;
}

export function readBuilderRecoverySnapshot(
  draftId?: string | null,
  storage: StorageLike | null = defaultStorage(),
): BuilderRecoverySnapshot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(getBuilderRecoveryKey(draftId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BuilderRecoverySnapshot>;
    if (
      parsed.version !== 2 ||
      typeof parsed.code !== 'string' ||
      typeof parsed.editorCode !== 'string' ||
      typeof parsed.savedAt !== 'string' ||
      typeof parsed.vfsSignature !== 'string' ||
      typeof parsed.pendingRemote !== 'boolean' ||
      !isFileMap(parsed.vfsFiles) ||
      (parsed.pendingVfsOperations !== undefined && !Array.isArray(parsed.pendingVfsOperations))
    ) {
      return null;
    }
    return parsed as BuilderRecoverySnapshot;
  } catch {
    return null;
  }
}

export function writeBuilderRecoverySnapshot(
  snapshot: BuilderRecoverySnapshot,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(getBuilderRecoveryKey(snapshot.templateId), JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

/**
 * Mark a journal entry as durably mirrored and move an unscoped first-save
 * entry under the newly-created builder_drafts id.
 */
export function markBuilderRecoveryPersisted(
  snapshot: BuilderRecoverySnapshot,
  resolvedDraftId: string | null,
  storage: StorageLike | null = defaultStorage(),
  acknowledgedRevisionId?: string | null,
): boolean {
  if (!storage) return false;
  const previousKey = getBuilderRecoveryKey(snapshot.templateId);
  const latest = readBuilderRecoverySnapshot(snapshot.templateId, storage);
  // A newer edit may have written its journal while this older Cloud request
  // was in flight. Never downgrade that recovery point when the older request
  // finally resolves; the serialized writer will acknowledge the newer entry
  // on its own turn.
  if (
    !latest ||
    latest.savedAt !== snapshot.savedAt ||
    latest.vfsSignature !== snapshot.vfsSignature
  ) {
    return false;
  }
  const persisted: BuilderRecoverySnapshot = {
    ...snapshot,
    templateId: resolvedDraftId,
    pendingRemote: false,
    persistedAt: new Date().toISOString(),
    acknowledgedRevisionId: acknowledgedRevisionId || undefined,
  };
  try {
    storage.setItem(getBuilderRecoveryKey(resolvedDraftId), JSON.stringify(persisted));
    // Anonymous/local projects have no Cloud "latest draft" lookup on refresh,
    // so retain the generic recovery alias as their session resume entry.
    if (resolvedDraftId?.startsWith('local-')) {
      storage.setItem(UNSCOPED_RECOVERY_KEY, JSON.stringify(persisted));
      return true;
    }
    const nextKey = getBuilderRecoveryKey(resolvedDraftId);
    if (previousKey !== nextKey) storage.removeItem(previousKey);
    return true;
  } catch {
    return false;
  }
}
