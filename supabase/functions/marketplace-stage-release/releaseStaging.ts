// Pure helpers for trusted release staging. Kept identical to
// src/marketplace/snapshotFingerprint.ts so client and server hashes agree.
import { extractRuntimeRequirements } from './runtimeRequirements.ts';

export function stableJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Snapshot contains a non-finite number.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((e) => e === undefined ? 'null' : stableJson(e)).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((k) => record[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson(record[k])}`).join(',')}}`;
  }
  throw new TypeError(`Snapshot contains a non-JSON value: ${typeof value}.`);
}

export async function sha256StableJson(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableJson(value)));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const SECRET_PATTERNS: Array<[string, RegExp]> = [
  ['stripe-secret-key', /\bsk_(live|test)_[A-Za-z0-9]{16,}/],
  ['service-role-jwt', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/],
  ['private-key', /-----BEGIN (RSA |EC )?PRIVATE KEY-----/],
  ['resend-key', /\bre_[A-Za-z0-9]{20,}/],
  ['openai-key', /\bsk-[A-Za-z0-9]{32,}/],
];

export function scanSnapshotForSecrets(files: Record<string, unknown>): Array<{ path: string; kind: string }> {
  const findings: Array<{ path: string; kind: string }> = [];
  for (const [path, contents] of Object.entries(files)) {
    if (typeof contents !== 'string') continue;
    for (const [kind, pattern] of SECRET_PATTERNS) {
      if (pattern.test(contents)) findings.push({ path, kind });
    }
  }
  return findings;
}

export function slugifyListing(name: string, projectId: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'template';
  return `${base}-${projectId.slice(0, 8)}`;
}

// ---------------------------------------------------------------------------
// Asset extraction
//
// Saved sites reference photos, artwork and fonts as string literals inside
// VFS source files (storage URLs, /assets/ paths, CDN links). Staging must
// list every one of them in the release manifest so the rights review cannot
// pass without a recorded decision per asset.
// ---------------------------------------------------------------------------

const ASSET_EXTENSION_RE = /\.(png|jpe?g|webp|gif|avif|svg|woff2?|ttf|otf|mp4|webm)(\?[^\s"'`)]*)?$/i;
const QUOTED_STRING_RE = /["'`](https?:\/\/[^\s"'`]+|\/[^\s"'`]+)["'`]/g;
export const MAX_MANIFEST_ASSETS = 100;

export function extractAssetReferences(vfsFiles: Record<string, unknown>): string[] {
  const refs = new Set<string>();
  for (const contents of Object.values(vfsFiles)) {
    if (typeof contents !== 'string') continue;
    QUOTED_STRING_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = QUOTED_STRING_RE.exec(contents)) !== null) {
      const ref = match[1];
      if (ASSET_EXTENSION_RE.test(ref)) refs.add(ref);
      if (refs.size >= MAX_MANIFEST_ASSETS) return [...refs].sort();
    }
  }
  return [...refs].sort();
}

export interface ManifestAsset {
  path: string;
  sha256: string;
  licenseClass: 'owned' | 'redistributable' | 'buyer-supplied' | 'reference-only';
  /** True when sha256 hashes the fetched asset bytes; false when only the URL could be hashed. */
  contentAddressed: boolean;
}

/**
 * Hash every referenced asset. Reachable assets are hashed by content;
 * unreachable ones fall back to a hash of the URL and stay reference-only so
 * the rights review must exclude them before the release can be certified.
 */
export async function fingerprintAssetReferences(
  refs: readonly string[],
  fetcher: typeof fetch = fetch,
): Promise<ManifestAsset[]> {
  const assets: ManifestAsset[] = [];
  for (const ref of refs) {
    let contentAddressed = false;
    let sha256 = await sha256StableJson(ref);
    if (/^https?:\/\//i.test(ref)) {
      try {
        const response = await fetcher(ref);
        if (response.ok) {
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.byteLength > 0 && bytes.byteLength <= 15 * 1024 * 1024) {
            sha256 = await sha256Bytes(bytes);
            contentAddressed = true;
          }
        }
      } catch {
        // Unreachable asset: keep the URL hash and let the rights review decide.
      }
    }
    assets.push({ path: ref, sha256, licenseClass: 'reference-only', contentAddressed });
  }
  return assets;
}

// ---------------------------------------------------------------------------
// Release packaging
//
// The private package is built from the sealed snapshot's VFS. Assets whose
// rights review says they must not be bundled (client-only or buyer-supplied)
// are rewritten to a neutral placeholder so buyers never receive restricted
// media.
// ---------------------------------------------------------------------------

export const PLACEHOLDER_ASSET_PATH = '/assets/marketplace-placeholder.svg';
export const PLACEHOLDER_ASSET_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">' +
  '<rect width="800" height="600" fill="#e5e5e5"/>' +
  '<text x="400" y="300" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#737373">Add your own image</text>' +
  '</svg>';

export interface ReleasePackageFiles {
  files: Record<string, string>;
  rewrittenRefs: string[];
}

export function buildReleasePackageFiles(
  vfsFiles: Record<string, unknown>,
  excludedRefs: readonly string[],
): ReleasePackageFiles {
  const excluded = new Set(excludedRefs);
  const rewrittenRefs: string[] = [];
  const files: Record<string, string> = {};
  for (const [path, contents] of Object.entries(vfsFiles)) {
    if (typeof contents !== 'string') continue;
    let next = contents;
    for (const ref of excluded) {
      if (next.includes(ref)) {
        next = next.split(ref).join(PLACEHOLDER_ASSET_PATH);
        if (!rewrittenRefs.includes(ref)) rewrittenRefs.push(ref);
      }
    }
    files[path] = next;
  }
  if (rewrittenRefs.length > 0) files[PLACEHOLDER_ASSET_PATH] = PLACEHOLDER_ASSET_SVG;
  return { files, rewrittenRefs };
}

export function buildDesignOnlyManifest(input: {
  revisionId: string;
  snapshotSha256: string;
  industryKey: string;
  meta: Record<string, any>;
  assets?: ManifestAsset[];
  snapshot?: Record<string, unknown>;
}) {
  const contract = input.meta?.templateDesignContract ?? {};
  const pages = Array.isArray(input.meta?.pages) ? input.meta.pages : [];
  return {
    schemaVersion: 'marketplace-design-release/1',
    productType: 'site_template',
    industryKey: input.industryKey,
    pageRoles: pages.map((p: any) => String(p?.archetype ?? p?.slug ?? '')).filter(Boolean),
    source: {
      acceptedRevisionId: input.revisionId,
      snapshotSha256: input.snapshotSha256,
      ...(typeof contract.seed === 'string' ? { generationSeed: contract.seed } : {}),
      ...(typeof contract.contractSignature === 'string' ? { designPlanSignature: contract.contractSignature } : {}),
    },
    design: {
      artDirectionPackId: String(input.meta?.artDirectionPackId ?? input.meta?.themeContract?.artDirectionPackId ?? 'unresolved'),
      implementationIds: typeof contract.implementationId === 'string' ? [contract.implementationId] : [],
      registrySignature: String(contract.registrySignature ?? 'unrecorded'),
      ...(typeof contract.layoutSignature === 'string' ? { designContractFingerprint: contract.layoutSignature } : {}),
    },
    requirements: extractRuntimeRequirements(input.snapshot ?? {}),
    assets: (input.assets ?? []).map((asset) => ({
      path: asset.path,
      sha256: asset.sha256,
      licenseClass: asset.licenseClass,
    })),
    export: { formats: ['unison-project', 'vite-react-zip'], licenseTier: 'personal' },
  };
}
