import { describe, expect, it } from 'vitest';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import { scanReleaseSource } from '@/marketplace/certification/scanReleaseSource';

function makeSnapshot(files: Record<string, string>): SiteBundleSnapshot {
  return { vfsFiles: files } as unknown as SiteBundleSnapshot;
}

describe('scanReleaseSource', () => {
  it('blocks high-confidence secret patterns without returning secret values', () => {
    const token = 'sk_live_12345678901234567890';
    const result = scanReleaseSource(makeSnapshot({ '/src/config.ts': `export const paymentKey = '${token}';` }));

    expect(result).toEqual({
      passed: false,
      issues: [{ code: 'credential-pattern', path: '/src/config.ts' }],
    });
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it('blocks trusted owner-specific values found in release files', () => {
    const result = scanReleaseSource(makeSnapshot({
      '/src/contact.tsx': "export const contact = 'owner@private.test';",
      '/src/App.tsx': 'export default function App() { return null; }',
    }), [' owner@private.test ']);

    expect(result).toEqual({
      passed: false,
      issues: [{ code: 'private-value-present', path: '/src/contact.tsx' }],
    });
  });

  it('scans canonical snapshot metadata outside the source file map', () => {
    const result = scanReleaseSource({
      ...makeSnapshot({ '/src/App.tsx': 'export default function App() { return null; }' }),
      creatorData: { customerEmail: 'customer@private.example' },
    }, ['customer@private.example']);

    expect(result.issues).toEqual([{
      code: 'private-value-present',
      path: '/.unison/site-bundle-snapshot.json',
    }]);
  });

  it('ignores short private values and passes clean source', () => {
    const result = scanReleaseSource(makeSnapshot({
      '/src/App.tsx': "export default function App() { return <main>Welcome</main>; }",
    }), ['NY']);

    expect(result).toEqual({ passed: true, issues: [] });
  });
});