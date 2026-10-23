import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';

function stableJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Snapshot contains a non-finite number.');
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => entry === undefined ? 'null' : stableJson(entry)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`);
    return `{${entries.join(',')}}`;
  }

  throw new TypeError(`Snapshot contains a non-JSON value: ${typeof value}.`);
}

export async function computeSiteBundleSnapshotSha256(snapshot: SiteBundleSnapshot): Promise<string> {
  const canonical = new TextEncoder().encode(stableJson(snapshot));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', canonical);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}