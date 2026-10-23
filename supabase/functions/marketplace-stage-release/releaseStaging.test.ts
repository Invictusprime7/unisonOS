import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildDesignOnlyManifest, scanSnapshotForSecrets, sha256StableJson, slugifyListing } from './releaseStaging.ts';

Deno.test('hash ignores key order', async () => {
  assertEquals(await sha256StableJson({ a: 1, b: [2] }), await sha256StableJson({ b: [2], a: 1 }));
});

Deno.test('secret scan flags stripe secret keys only', () => {
  assertEquals(scanSnapshotForSecrets({ '/a.ts': 'const k = "sk_live_abcdefghijklmnop1234"' })[0].kind, 'stripe-secret-key');
  assertEquals(scanSnapshotForSecrets({ '/a.ts': 'const k = "pk_live_abc"' }).length, 0);
});

Deno.test('manifest is design-only and hash-pinned', () => {
  const m = buildDesignOnlyManifest({ revisionId: 'r', snapshotSha256: 'h', industryKey: 'agency', meta: {} });
  assertEquals(m.requirements.runtimeMode, 'design-only');
  assertEquals(m.source.snapshotSha256, 'h');
  assertEquals(m.productType, 'site_template');
});

Deno.test('slug is url-safe and project-scoped', () => {
  const s = slugifyListing('FLIXX By. Ariann!', '59c5ef14-4fd0-4c57-bedf-6a6659d6cfaf');
  assertEquals(s, 'flixx-by-ariann-59c5ef14');
  assert(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s));
});
