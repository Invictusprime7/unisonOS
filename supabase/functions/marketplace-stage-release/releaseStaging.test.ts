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

Deno.test('asset extraction finds storage URLs and asset paths, deduped and sorted', async () => {
  const { extractAssetReferences } = await import('./releaseStaging.ts');
  const refs = extractAssetReferences({
    '/src/App.tsx': 'const a = "https://x.supabase.co/storage/v1/object/public/site/hero.webp"; const b = "/assets/logo.svg"; const c = "https://x.supabase.co/storage/v1/object/public/site/hero.webp";',
    '/src/page.tsx': 'const d = `https://fonts.example.test/inter.woff2`; const e = "https://example.test/page";',
  });
  assertEquals(refs, [
    '/assets/logo.svg',
    'https://fonts.example.test/inter.woff2',
    'https://x.supabase.co/storage/v1/object/public/site/hero.webp',
  ]);
});

Deno.test('fingerprinting hashes fetched bytes and falls back to a URL hash when unreachable', async () => {
  const { fingerprintAssetReferences, sha256Bytes } = await import('./releaseStaging.ts');
  const bytes = new TextEncoder().encode('image-bytes');
  const assets = await fingerprintAssetReferences(
    ['https://cdn.example.test/ok.webp', 'https://cdn.example.test/missing.webp', '/assets/local.svg'],
    (() => Promise.resolve(new Response(bytes))) as unknown as typeof fetch,
  );
  assertEquals(assets[0].sha256, await sha256Bytes(bytes));
  assertEquals(assets[0].contentAddressed, true);
  assertEquals(assets[1].contentAddressed, true); // same fetcher stub
  assertEquals(assets[2].contentAddressed, false); // local path is never fetched
  assert(assets.every((asset) => asset.licenseClass === 'reference-only'));
});

Deno.test('package build rewrites excluded assets to the placeholder and adds it', async () => {
  const { buildReleasePackageFiles, PLACEHOLDER_ASSET_PATH } = await import('./releaseStaging.ts');
  const result = buildReleasePackageFiles({
    '/src/App.tsx': 'const hero = "https://cdn.example.test/private.webp"; const logo = "/assets/logo.svg";',
    '/src/index.css': 'body { margin: 0; }',
  }, ['https://cdn.example.test/private.webp']);
  assertEquals(result.rewrittenRefs, ['https://cdn.example.test/private.webp']);
  assert(result.files['/src/App.tsx'].includes(PLACEHOLDER_ASSET_PATH));
  assert(result.files['/src/App.tsx'].includes('/assets/logo.svg'));
  assertEquals(result.files['/src/index.css'], 'body { margin: 0; }');
  assert(typeof result.files[PLACEHOLDER_ASSET_PATH] === 'string');
});

Deno.test('manifest lists extracted assets', async () => {
  const { buildDesignOnlyManifest } = await import('./releaseStaging.ts');
  const m = buildDesignOnlyManifest({
    revisionId: 'r', snapshotSha256: 'h', industryKey: 'agency', meta: {},
    assets: [{ path: '/assets/logo.svg', sha256: 'b'.repeat(64), licenseClass: 'reference-only', contentAddressed: false }],
  });
  assertEquals(m.assets, [{ path: '/assets/logo.svg', sha256: 'b'.repeat(64), licenseClass: 'reference-only' }]);
});

Deno.test('snapshot cover resolution picks an external raster image without executing source', async () => {
  const { resolveSnapshotCoverImage } = await import('./releaseStaging.ts');
  assertEquals(resolveSnapshotCoverImage({
    '/src/pages/Home.tsx': 'throw new Error(); const hero = "https://images.unsplash.com/photo-123?w=1600";',
    '/src/index.css': 'body { color: red; }',
  }), 'https://images.unsplash.com/photo-123?w=1600');
  assertEquals(resolveSnapshotCoverImage({ '/src/Home.tsx': '<img src="/assets/local.png" /><img src="javascript:alert(1)" />' }), undefined);
  assertEquals(resolveSnapshotCoverImage({ '/assets/logo.svg': '<svg></svg>' }), undefined);
});
