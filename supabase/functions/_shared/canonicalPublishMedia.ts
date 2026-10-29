export const PROJECT_MEDIA_MANIFEST_PATH = '/public/media/manifest.json';

const MAX_ASSET_BYTES = 500_000;
const MAX_TOTAL_MEDIA_BYTES = 3_000_000;
const ALLOWED_PORTABLE_TYPES = new Set(['application/pdf', 'image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']);

interface ProjectMediaManifest {
  version: 1;
  assets: Array<{
    name?: string;
    storagePath: string;
    bucket: string;
    mimeType: string;
    url: string;
    usedBy: string[];
  }>;
}

function manifestFrom(files: Record<string, string>): ProjectMediaManifest | null {
  const contents = files[PROJECT_MEDIA_MANIFEST_PATH]
    ?? files[PROJECT_MEDIA_MANIFEST_PATH.replace(/^\/+/, '')];
  if (!contents) return null;
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    throw new Error('Project media manifest is invalid JSON.');
  }
  if (!value || typeof value !== 'object' || (value as ProjectMediaManifest).version !== 1
    || !Array.isArray((value as ProjectMediaManifest).assets)) {
    throw new Error('Project media manifest has an unsupported format.');
  }
  return value as ProjectMediaManifest;
}

function validateStorageUrl(url: string, bucket: string, storagePath: string, storageOrigin: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Project media contains an invalid source URL.');
  }
  if (parsed.origin !== new URL(storageOrigin).origin || parsed.protocol !== 'https:') {
    throw new Error('Project media source is not from this project storage host.');
  }
  const match = /^\/storage\/v1\/object\/(?:sign|public)\/([^/]+)\/(.+)$/.exec(parsed.pathname);
  if (!match || decodeURIComponent(match[1]) !== bucket || decodeURIComponent(match[2]) !== storagePath) {
    throw new Error('Project media URL does not match its stable storage identity.');
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

export async function materializeCanonicalProjectMedia(input: {
  files: Record<string, string>;
  manifestFiles: Record<string, string>;
  userId: string;
  storageOrigin: string;
  download: (bucket: string, storagePath: string) => Promise<Uint8Array>;
}): Promise<{ files: Record<string, string>; mediaCount: number }> {
  const manifest = manifestFrom(input.manifestFiles);
  if (!manifest) return { files: input.files, mediaCount: 0 };

  const files = { ...input.files };
  let totalBytes = 0;
  let mediaCount = 0;
  for (const asset of manifest.assets) {
    if (!asset || typeof asset.storagePath !== 'string' || typeof asset.bucket !== 'string'
      || typeof asset.mimeType !== 'string' || typeof asset.url !== 'string' || !Array.isArray(asset.usedBy)) {
      throw new Error('Project media manifest contains a malformed asset.');
    }
    if (asset.usedBy.length === 0) continue;
    if (asset.bucket !== 'user-files' || !asset.storagePath.startsWith(`${input.userId}/`)
      || asset.storagePath.split('/').some((part) => !part || part === '.' || part === '..')) {
      throw new Error("Project media asset is outside the publishing user's storage ownership.");
    }
    if (!ALLOWED_PORTABLE_TYPES.has(asset.mimeType)) {
      throw new Error(`Project media type ${asset.mimeType} is not supported for portable publishing.`);
    }
    validateStorageUrl(asset.url, asset.bucket, asset.storagePath, input.storageOrigin);

    const bytes = await input.download(asset.bucket, asset.storagePath);
    if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > MAX_ASSET_BYTES) {
      throw new Error(`Project media asset ${asset.name ?? asset.storagePath} is empty or exceeds the ${MAX_ASSET_BYTES}-byte publish limit.`);
    }
    totalBytes += bytes.length;
    if (totalBytes > MAX_TOTAL_MEDIA_BYTES) {
      throw new Error(`Project media exceeds the ${MAX_TOTAL_MEDIA_BYTES}-byte total publish limit.`);
    }

    const dataUrl = `data:${asset.mimeType};base64,${encodeBase64(bytes)}`;
    let replaced = false;
    for (const sourcePath of asset.usedBy) {
      if (typeof sourcePath !== 'string') throw new Error('Project media manifest contains an invalid source path.');
      const path = sourcePath.replace(/^\/+/, '');
      const source = files[path] ?? files[`/${path}`];
      if (typeof source !== 'string' || !source.includes(asset.url)) {
        throw new Error(`Project media reference in ${sourcePath} no longer matches the accepted source.`);
      }
      const updated = source.split(asset.url).join(dataUrl);
      if (path in files) files[path] = updated;
      else files[`/${path}`] = updated;
      replaced = true;
    }
    if (!replaced) continue;
    mediaCount += 1;
  }

  delete files[PROJECT_MEDIA_MANIFEST_PATH];
  delete files[PROJECT_MEDIA_MANIFEST_PATH.replace(/^\/+/, '')];
  return { files, mediaCount };
}
