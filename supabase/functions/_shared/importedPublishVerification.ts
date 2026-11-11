/**
 * UIMP-01 Phase G — server check for publishing an imported-source revision.
 *
 * Imported projects publish the files their saved check covered: the artifact
 * hash recorded by `record_imported_source_verification` must equal the hash
 * of the submitted files, the check must have passed with the owner's
 * confirmation, and every binary placement must name a stored import asset
 * with the same hash. Pure (no Deno APIs) so it is unit-tested in Vitest.
 */
import { computeCanonicalVfsHash } from './canonicalPublishRevision.ts';

export const IMPORTED_PUBLISH_PLACEMENTS_PATH = '_unison/publish-assets.json';
const IMPORT_ASSETS_RECORD = '/.unison-import/assets.json';
const SAFE_PATH = /^(?!\/)(?!.*\.\.)(?!.*\\)[A-Za-z0-9._/@ ()+-]+$/;

export interface ImportedVerificationRow {
  revision_id: string;
  vfs_hash: string;
  artifact_hash: string;
  status: string;
  owner_confirmed: boolean;
}

export interface ImportedBinaryPlacement {
  path: string;
  bucket: string;
  storagePath: string;
  sha256: string;
  mime: string;
}

export type ImportedPublishVerdict =
  | { ok: true; files: Record<string, string>; placements: ImportedBinaryPlacement[] }
  | { ok: false; code: string; message: string };

export function isImportedSourceRevision(readinessReport: unknown): boolean {
  return Boolean(readinessReport && typeof readinessReport === 'object'
    && (readinessReport as Record<string, unknown>).acceptanceProfile === 'imported-source');
}

export async function verifyImportedPublish(input: {
  revision: { id: string; vfs_hash: string | null; vfs_files: Record<string, string> };
  verification: ImportedVerificationRow | null;
  submittedFiles: Record<string, string>;
}): Promise<ImportedPublishVerdict> {
  const { revision, verification } = input;
  if (!verification || verification.revision_id !== revision.id || verification.vfs_hash !== revision.vfs_hash) {
    return { ok: false, code: 'imported-verification-missing', message: 'This imported version has not been checked. Open the preview, use "Check pages" and confirm it matches before publishing.' };
  }
  if (verification.status !== 'passed' || verification.owner_confirmed !== true) {
    return { ok: false, code: 'imported-verification-not-passed', message: 'The last page check of this version did not pass or was not confirmed, so it cannot be published.' };
  }
  const files: Record<string, string> = {};
  for (const [raw, content] of Object.entries(input.submittedFiles)) {
    const path = raw.replace(/^\/+/, '');
    if (typeof content !== 'string' || !path || Object.prototype.hasOwnProperty.call(files, path)) {
      return { ok: false, code: 'imported-artifact-invalid', message: 'Published file paths or contents are invalid.' };
    }
    if (path === '.unison-import' || path.startsWith('.unison-import/')) {
      return { ok: false, code: 'imported-artifact-invalid', message: 'Import records are never published.' };
    }
    files[path] = content;
  }
  if (await computeCanonicalVfsHash(files) !== verification.artifact_hash) {
    return { ok: false, code: 'imported-artifact-mismatch', message: 'The files to publish differ from the ones that were checked. Check the pages again, then publish.' };
  }

  const placements: ImportedBinaryPlacement[] = [];
  const listing = files[IMPORTED_PUBLISH_PLACEMENTS_PATH];
  delete files[IMPORTED_PUBLISH_PLACEMENTS_PATH];
  if (listing !== undefined) {
    let assets: Array<{ path: string; sha256: string; bucket: string; storagePath: string | null; status: string; mime: string }> = [];
    let parsed: { placements?: Array<{ path?: unknown; source?: unknown; sha256?: unknown }> };
    try {
      parsed = JSON.parse(listing);
      assets = (JSON.parse(revision.vfs_files[IMPORT_ASSETS_RECORD] ?? '{"assets":[]}') as { assets: typeof assets }).assets ?? [];
    } catch {
      return { ok: false, code: 'imported-artifact-invalid', message: 'The published media list is invalid.' };
    }
    const bySource = new Map(assets.map((a) => [a.path, a]));
    for (const entry of parsed.placements ?? []) {
      const path = typeof entry.path === 'string' ? entry.path : '';
      const source = typeof entry.source === 'string' ? bySource.get(entry.source) : undefined;
      if (!path || !SAFE_PATH.test(path) || Object.prototype.hasOwnProperty.call(files, path) || placements.some((p) => p.path === path)) {
        return { ok: false, code: 'imported-artifact-invalid', message: `Invalid published media path: ${String(entry.path)}` };
      }
      if (!source || source.status !== 'stored' || !source.storagePath || source.sha256 !== entry.sha256 || source.bucket !== 'user-files') {
        return { ok: false, code: 'imported-asset-unverified', message: `Media file ${String(entry.source)} is not a stored file of this imported version.` };
      }
      placements.push({ path, bucket: source.bucket, storagePath: source.storagePath, sha256: source.sha256, mime: source.mime || 'application/octet-stream' });
    }
  }
  return { ok: true, files, placements };
}
