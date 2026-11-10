/**
 * UIMP-01 — records that make an externally imported project canonical
 * without rewriting its source.
 *
 * An imported revision's VFS holds the original files byte-for-byte at their
 * original root-relative paths (prefixed with `/`), plus a small read-only
 * record folder. The presence of a valid provenance record switches every
 * Unison stage (normalization, router sync, preview, commit acceptance) into
 * source-preservation mode.
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

export interface ImportProvenanceRecord {
  version: 1;
  origin: 'external-import';
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
}

const ORIGIN_MARKER = /"origin"\s*:\s*"external-import"/;

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
  if (!provenance || provenance.origin !== 'external-import' || !manifest || !Array.isArray(manifest.files)
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
