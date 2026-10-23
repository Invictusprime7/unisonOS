import { describe, expect, it } from 'vitest';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import { computeSiteBundleSnapshotSha256 } from '@/marketplace/snapshotFingerprint';

function snapshot(value: Record<string, unknown>): SiteBundleSnapshot {
  return value as unknown as SiteBundleSnapshot;
}

function reverseObjectKeyOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeyOrder);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).reverse().map(([key, nested]) => [key, reverseObjectKeyOrder(nested)]),
  );
}

const canonicalSnapshot = snapshot({
  snapshotId: 'snapshot-1',
  industry: 'salon',
  vfsFiles: { '/src/App.tsx': 'export default function App() { return null; }' },
  pageRegistry: { pages: { home: { filePath: '/src/pages/Home.tsx' } } },
  creatorData: { records: [] },
  meta: { generationSeed: 'seed-1', source: 'wizard' },
});

describe('computeSiteBundleSnapshotSha256', () => {
  it('returns a SHA-256 digest independent of object key order', async () => {
    const first = await computeSiteBundleSnapshotSha256(canonicalSnapshot);
    const reordered = await computeSiteBundleSnapshotSha256(
      snapshot(reverseObjectKeyOrder(canonicalSnapshot) as Record<string, unknown>),
    );

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(reordered).toBe(first);
  });

  it('changes when canonical snapshot content changes', async () => {
    const first = await computeSiteBundleSnapshotSha256(canonicalSnapshot);
    const changed = await computeSiteBundleSnapshotSha256(snapshot({
      ...canonicalSnapshot,
      vfsFiles: { '/src/App.tsx': 'export default function App() { return <main />; }' },
    }));

    expect(changed).not.toBe(first);
  });
});