/**
 * AssetRef (guidebook §16–18): editing deals with asset records, not raw URLs,
 * wherever possible. A ref always names its owning project/site so an image
 * can never be reused across sites by accident.
 */
export type AssetStorageBucket = 'site-assets' | 'context-artifacts' | 'private-uploads';

export interface AssetRef {
  /** Saved asset record id; null for an external URL that is not stored yet. */
  assetId: string | null;
  projectId: string | null;
  siteId: string | null;
  bucket: AssetStorageBucket | null;
  path: string | null;
  url: string;
  alt: string;
  mimeType?: string | null;
}

/** Recommended storage paths inside a site's own storage (§17). */
export function assetStoragePath(kind: 'image' | 'logo' | 'video' | 'document' | 'screenshot' | 'markdown', fileName: string): { bucket: AssetStorageBucket; path: string } {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'file';
  switch (kind) {
    case 'image': return { bucket: 'site-assets', path: `public/images/${safe}` };
    case 'logo': return { bucket: 'site-assets', path: `public/logos/${safe}` };
    case 'video': return { bucket: 'site-assets', path: `public/videos/${safe}` };
    case 'document': return { bucket: 'context-artifacts', path: `ai/documents/${safe}` };
    case 'screenshot': return { bucket: 'context-artifacts', path: `ai/screenshots/${safe}` };
    case 'markdown': return { bucket: 'context-artifacts', path: `ai/markdown/${safe}` };
  }
}

const ALLOWED_SCHEMES = ['https:', 'http:'];

/** Validates a picked image and turns it into an AssetRef. Throws a user-facing message. */
export function toAssetRef(input: { url: string; alt?: string | null; assetId?: string | null; projectId?: string | null; siteId?: string | null }): AssetRef {
  const url = String(input.url ?? '').trim();
  if (!url) throw new Error('Pick an image first.');
  const isRelative = url.startsWith('/') && !url.startsWith('//');
  if (!isRelative) {
    let scheme = '';
    try { scheme = new URL(url).protocol; } catch { throw new Error('That image link isn’t valid.'); }
    if (!ALLOWED_SCHEMES.includes(scheme)) throw new Error('That image link isn’t allowed.');
  }
  return {
    assetId: input.assetId ?? null,
    projectId: input.projectId ?? null,
    siteId: input.siteId ?? null,
    bucket: null,
    path: null,
    url,
    alt: (input.alt ?? '').trim(),
  };
}

/** An asset record may only be used on the site that owns it. */
export function assetBelongsTo(ref: AssetRef, projectId: string | null | undefined): boolean {
  if (ref.assetId && (!ref.projectId || !projectId)) return false;
  if (!ref.projectId || !projectId) return true;
  return ref.projectId === projectId;
}
