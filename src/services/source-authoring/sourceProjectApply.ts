/**
 * Host-side settings for saving an AI Builder edit to a source project
 * (imported or Affinity-written). The Composer already validated the candidate
 * under source-project rules; the host re-check must use the same rules and
 * never run Unison preflight rewrites (nav stamping, intent stripping, syntax
 * "repair") over the project's own source.
 */
import { isImportedSourceVfs, readImportedSourceRecords } from '@/services/import/importedSourceRecords';
import { sourceProjectEditTargets } from './sourceProjectEditTargets';

export interface SourceProjectApplySettings {
  /** Candidate gate options matching the Composer's own source-project check. */
  gate: { resolveDependencies: false; importAliases?: Readonly<Record<string, string>> };
  /** Page the edit belongs to and the files it may change. */
  scope: { pagePath: string; sharedPaths: string[] };
}

export function sourceProjectApplySettings(
  files: Readonly<Record<string, string>>,
  pagePath: string | null | undefined,
  selectionOwnerPath?: string | null,
  proposedPaths: readonly string[] = [],
): SourceProjectApplySettings | null {
  if (!isImportedSourceVfs(files as Record<string, string>)) return null;
  const page = [pagePath, selectionOwnerPath].find((p): p is string => typeof p === 'string' && typeof files[p] === 'string')
    ?? pagePath ?? selectionOwnerPath ?? '/src/App.tsx';
  // New modules are always allowed in a source project; existing files stay
  // limited to the page, what it imports and the project-wide files.
  const created = proposedPaths.filter((p) => typeof files[p] !== 'string');
  const sharedPaths = [...new Set([...sourceProjectEditTargets(files, page, selectionOwnerPath ? [selectionOwnerPath] : []), ...created])];
  return {
    gate: { resolveDependencies: false, importAliases: readImportedSourceRecords(files as Record<string, string>)?.profile.aliases },
    scope: { pagePath: page, sharedPaths },
  };
}
