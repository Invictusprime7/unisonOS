/**
 * Project media (OS8 P4): uploaded files are tracked as project-owned assets
 * in a manifest saved with each revision, keyed by stable storage path. Links
 * may expire and be re-issued; the path is the identity. Pure functions only.
 */
export const PROJECT_MEDIA_MANIFEST = '/public/media/manifest.json';

export interface ProjectMediaAsset {
  storagePath: string;
  bucket: string;
  name: string;
  kind: string;
  mimeType: string;
  url: string;
  /** Saved files whose source references this asset (by path). */
  usedBy: string[];
}

export interface ProjectMediaManifest { version: 1; assets: ProjectMediaAsset[] }

export function readProjectMedia(files: Record<string, string>): ProjectMediaManifest {
  try {
    const parsed = JSON.parse(files[PROJECT_MEDIA_MANIFEST] ?? '');
    if (parsed?.version === 1 && Array.isArray(parsed.assets)) return parsed;
  } catch { /* absent or malformed: start empty */ }
  return { version: 1, assets: [] };
}

function usage(files: Record<string, string>, storagePath: string): string[] {
  return Object.keys(files)
    .filter((p) => p !== PROJECT_MEDIA_MANIFEST && typeof files[p] === 'string' && files[p].includes(storagePath))
    .sort();
}

/** Adds uploads (deduped by storage path) and refreshes usage. Deterministic output. */
export function recordProjectMedia(
  files: Record<string, string>,
  uploads: Array<{ name: string; kind: string; mimeType: string; url: string; bucket?: string; storagePath?: string }>,
): string {
  const byPath = new Map(readProjectMedia(files).assets.map((a) => [a.storagePath, a]));
  for (const u of uploads) {
    if (!u.storagePath || !u.bucket) continue;
    byPath.set(u.storagePath, { storagePath: u.storagePath, bucket: u.bucket, name: u.name, kind: u.kind, mimeType: u.mimeType, url: u.url, usedBy: [] });
  }
  const assets = [...byPath.values()]
    .map((a) => ({ ...a, usedBy: usage(files, a.storagePath) }))
    .sort((a, b) => a.storagePath.localeCompare(b.storagePath));
  return `${JSON.stringify({ version: 1, assets }, null, 2)}\n`;
}

/** Assets no saved file references any more (safe-to-remove candidates). */
export function unusedProjectMedia(files: Record<string, string>): ProjectMediaAsset[] {
  return readProjectMedia(files).assets.filter((a) => usage(files, a.storagePath).length === 0);
}
