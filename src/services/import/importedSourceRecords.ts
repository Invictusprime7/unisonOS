/**
 * Source-project records: the one project format Unison creates, imports,
 * previews, edits and publishes.
 *
 * A source project's VFS holds its own files byte-for-byte at their
 * root-relative paths (prefixed with `/`), plus a small read-only record
 * folder. The project either came from outside (`external-import`) or was
 * written by Affinity (`affinity-authored`); both are the same format and go
 * through the same acceptance, preview, edit and publish paths. The presence
 * of a valid provenance record switches every Unison stage (normalization,
 * router sync, preview, commit acceptance) into source-preservation mode.
 */
import type { ImportManifest } from './secureIntake';
import type { ImportCompatibilityProfile } from './importCompatibilityProfile';

/** Dedicated record root; an imported source that already uses it is refused. */
export const IMPORT_RECORD_ROOT = '/.unison-import';
export const IMPORT_PROVENANCE_PATH = `${IMPORT_RECORD_ROOT}/provenance.json`;
export const IMPORT_MANIFEST_PATH = `${IMPORT_RECORD_ROOT}/manifest.json`;
export const IMPORT_PROFILE_PATH = `${IMPORT_RECORD_ROOT}/compatibility.json`;
export const IMPORT_ASSETS_PATH = `${IMPORT_RECORD_ROOT}/assets.json`;
export const IMPORTED_SOURCE_ACCEPTANCE_PROFILE = 'imported-source' as const;

export type VerificationState = 'verified' | 'partial' | 'failed' | 'unverified' | 'blocked' | 'not-applicable';

export interface ImportedAssetRecord {
  path: string;
  sha256: string;
  size: number;
  mime: string;
  kind: string;
  bucket: string;
  /** Durable storage location; links are issued on demand, never persisted. */
  storagePath: string | null;
  status: 'stored' | 'failed';
  error?: string;
}

export interface ImportedAssetsRecord {
  version: 1;
  assets: ImportedAssetRecord[];
  /** Original upload, kept for audit/re-intake (ZIP input only). */
  originalArchive: { bucket: string; storagePath: string | null; sha256: string; status: 'stored' | 'failed'; error?: string } | null;
}

export interface ImportReadiness {
  /** Every text file in the VFS matches the manifest hash (checked at acceptance). */
  sourcePreserved: VerificationState;
  /** Every binary file stored durably with a matching hash. */
  assetsPreserved: VerificationState;
  /** A source-compatible runtime adapter exists for this project's toolchain. */
  runtimeCompatibility: 'supported' | 'blocked';
  /** The accepted revision rendered in an isolated source-compatible Preview. */
  previewRendered: VerificationState;
  /** Screenshot/DOM parity against the source's own build. */
  visualParity: VerificationState;
  /** Scoped Affinity source edits via the canonical writer. */
  affinityEditable: 'source-edits' | 'none';
  publishReady: boolean;
  blockers: Array<{ code: string; message: string }>;
}

/** Where a source project's files came from. Both origins share every downstream path. */
export const SOURCE_PROJECT_ORIGINS = ['external-import', 'affinity-authored'] as const;
export type SourceProjectOrigin = (typeof SOURCE_PROJECT_ORIGINS)[number];

export interface ImportProvenanceRecord {
  version: 1;
  origin: SourceProjectOrigin;
  acceptanceProfile: typeof IMPORTED_SOURCE_ACCEPTANCE_PROFILE;
  importedAt: string;
  importedBy: string;
  inputKind: ImportManifest['inputKind'];
  inputName: string;
  /** Content address of the original source (manifest.snapshotHash). */
  originalSnapshotHash: string;
  archiveSha256?: string;
  framework: ImportCompatibilityProfile['framework'];
  readiness: ImportReadiness;
  /** Set when an older Unison-composed site was converted into this source project. */
  convertedFromRevisionId?: string;
  /**
   * Who wrote the files when `origin` had to use the older backend label
   * (`external-import`) because the live save rule predates `affinity-authored`.
   */
  authoredBy?: 'affinity';
}

const ORIGIN_MARKER = /"origin"\s*:\s*"(?:external-import|affinity-authored)"/;

/** Cheap check used on hot paths (normalization, router sync, preview). */
export function isImportedSourceVfs(files: Record<string, string> | null | undefined): boolean {
  const record = files?.[IMPORT_PROVENANCE_PATH];
  return typeof record === 'string' && ORIGIN_MARKER.test(record);
}

export function isImportRecordPath(path: string): boolean {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized === IMPORT_RECORD_ROOT || normalized.startsWith(`${IMPORT_RECORD_ROOT}/`);
}

function parseJson<T>(text: string | undefined): T | null {
  if (typeof text !== 'string') return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export interface ImportedSourceRecords {
  provenance: ImportProvenanceRecord;
  manifest: ImportManifest;
  profile: ImportCompatibilityProfile;
  assets: ImportedAssetsRecord;
}

/** Parses the record folder; returns null when any record is missing or malformed. */
export function readImportedSourceRecords(files: Record<string, string> | null | undefined): ImportedSourceRecords | null {
  if (!isImportedSourceVfs(files)) return null;
  const provenance = parseJson<ImportProvenanceRecord>(files![IMPORT_PROVENANCE_PATH]);
  const manifest = parseJson<ImportManifest>(files![IMPORT_MANIFEST_PATH]);
  const profile = parseJson<ImportCompatibilityProfile>(files![IMPORT_PROFILE_PATH]);
  const assets = parseJson<ImportedAssetsRecord>(files![IMPORT_ASSETS_PATH]);
  if (!provenance || !SOURCE_PROJECT_ORIGINS.includes(provenance.origin) || !manifest || !Array.isArray(manifest.files)
    || !profile || !assets || !Array.isArray(assets.assets)) return null;
  return { provenance, manifest, profile, assets };
}

/** Root-relative manifest path → VFS path. */
export function toVfsPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const IMPORTED_ENTRY_CANDIDATES = [
  '/index.html',
  '/src/routes/index.tsx', '/src/routes/index.jsx', '/app/routes/index.tsx', '/app/routes/_index.tsx',
  '/src/App.tsx', '/src/App.jsx', '/src/main.tsx', '/src/main.jsx',
  '/app/page.tsx', '/src/app/page.tsx', '/pages/index.tsx', '/src/pages/index.tsx', '/src/pages/Index.tsx',
];

/**
 * The file the builder opens first for an imported project. Imported versions
 * carry no Unison page registry, so the saved choice is used when it still
 * exists, otherwise the project's own entry, otherwise its first source file.
 */
export function resolveImportedActivePagePath(
  files: Record<string, string>,
  requested?: string | null,
): string | null {
  const has = (path: string) => Object.prototype.hasOwnProperty.call(files, path) && !isImportRecordPath(path);
  if (requested?.trim() && has(requested)) return requested;
  const known = IMPORTED_ENTRY_CANDIDATES.find(has);
  if (known) return known;
  const source = Object.keys(files).filter((path) => has(path) && /\.(html?|[jt]sx?)$/i.test(path)).sort();
  return source[0] ?? Object.keys(files).filter(has).sort()[0] ?? null;
}
