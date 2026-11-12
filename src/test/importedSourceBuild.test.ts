// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as esbuild from 'esbuild';
import { intakeLooseFiles } from '@/services/import/secureIntake';
import { analyzeImportedProject, resolveImportPreviewAdapter } from '@/services/import/importCompatibilityProfile';
import { buildImportedSourceVfs } from '@/services/import/importedSourceAcceptance';
import { readImportedSourceRecords } from '@/services/import/importedSourceRecords';
import { planSourceBuild, readLockedVersions, SOURCE_BUILD_ADAPTER } from '@/services/import/sourceBuild/sourceBuildPlan';
import { buildImportedSource } from '@/services/import/sourceBuild/sourceBundler';
import { buildImportedPublishArtifact, IMPORTED_PUBLISH_PLACEMENTS_PATH } from '@/services/import/importedPublishArtifact';
import { summarizeVerification } from '@/services/import/importedSourceVerification';
import { hashVfsFiles } from '@/services/vfsCommitService';
import { verifyImportedPublish } from '../../supabase/functions/_shared/importedPublishVerification';

const enc = (s: string) => new TextEncoder().encode(s);
const APP = `import { createRoot } from 'react-dom/client';\nimport './index.css';\nimport hero from '@/assets/hero.png';\nimport { Card } from '@/components/Card';\ncreateRoot(document.getElementById('root')!).render(<main><img src={hero} /><Card /></main>);\n`;

async function viteProject() {
  const intake = await intakeLooseFiles([
    { path: 'site/package.json', bytes: enc(JSON.stringify({ name: 'site', scripts: { dev: 'vite' }, dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0', clsx: '^2.0.0' }, devDependencies: { vite: '^5.0.0', '@vitejs/plugin-react': '^4.0.0' } })) },
    { path: 'site/package-lock.json', bytes: enc(JSON.stringify({ packages: { 'node_modules/react': { version: '18.3.1' }, 'node_modules/react-dom': { version: '18.3.1' } } })) },
    { path: 'site/tsconfig.json', bytes: enc('{ "compilerOptions": { "jsx": "react-jsx", "paths": { "@/*": ["./src/*"] } } }') },
    { path: 'site/index.html', bytes: enc('<!doctype html><html><head><link rel="icon" href="/favicon.svg"></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>') },
    { path: 'site/public/favicon.svg', bytes: enc('<svg xmlns="http://www.w3.org/2000/svg"/>') },
    { path: 'site/src/main.tsx', bytes: enc(APP) },
    { path: 'site/src/index.css', bytes: enc('body { background: url(./assets/hero.png); }') },
    { path: 'site/src/components/Card.tsx', bytes: enc("import clsx from 'clsx';\nexport const Card = () => <p className={clsx('card')}>Hello</p>;") },
    { path: 'site/src/assets/hero.png', bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]) },
  ]);
  const profile = analyzeImportedProject(intake);
  const sha = intake.manifest.files.find((f) => f.path === 'src/assets/hero.png')!.sha256;
  const assets = { version: 1 as const, assets: [{ path: 'src/assets/hero.png', sha256: sha, size: 12, mime: 'image/png', kind: 'image', bucket: 'user-files', storagePath: `u/imports/p/blobs/${sha}.png`, status: 'stored' as const }], originalArchive: null };
  const { files } = buildImportedSourceVfs({ intake, profile, assets, importedBy: 'u', importedAt: '2026-11-11T00:00:00Z' });
  return { profile, files, records: readImportedSourceRecords(files)!, sha };
}

const build = (files: Record<string, string>, plan: ReturnType<typeof planSourceBuild>, assetUrls: Record<string, string>) =>
  buildImportedSource({ esbuild, plan, files, assetUrls, fetchText: async () => '' });

describe('imported source build plan', () => {
  it('pins packages to the lockfile and runs a React + Vite project in the source build', async () => {
    const { profile, files } = await viteProject();
    const plan = planSourceBuild(profile, files);
    expect(plan.status).toBe('supported');
    expect(plan.kind).toBe('vite-html');
    expect(plan.entry).toBe('/src/main.tsx');
    expect(plan.packages.react).toBe('18.3.1');
    expect(plan.unpinned).toEqual(['clsx']);
    expect(plan.packages.vite).toBeUndefined();
    expect(resolveImportPreviewAdapter(profile, files).adapter).toBe(SOURCE_BUILD_ADAPTER);
  });

  it('reads exact versions from bun.lock', () => {
    const lock = '{\n  "packages": {\n    "react": ["react@19.2.7", "", {}],\n    "@tanstack/react-router": ["@tanstack/react-router@1.170.41", "", {}],\n  }\n}';
    expect(readLockedVersions({ '/bun.lock': lock }, ['react', '@tanstack/react-router'])).toEqual({ react: '19.2.7', '@tanstack/react-router': '1.170.41' });
  });

  it('refuses frameworks that need their own server', async () => {
    const intake = await intakeLooseFiles([
      { path: 'n/package.json', bytes: enc(JSON.stringify({ dependencies: { next: '15.0.0', react: '19.0.0' } })) },
      { path: 'n/app/page.tsx', bytes: enc('export default () => null') },
    ]);
    const profile = analyzeImportedProject(intake);
    const files = Object.fromEntries(Object.entries(intake.textFiles).map(([p, t]) => [`/${p}`, t]));
    expect(planSourceBuild(profile, files).status).toBe('unsupported');
  });
});

describe('imported source bundler', () => {
  it('bundles the original source unchanged with exact package URLs and stored image links', async () => {
    const { profile, files } = await viteProject();
    const plan = planSourceBuild(profile, files);
    const result = await build(files, plan, { '/src/assets/hero.png': 'https://storage.test/hero.png' });
    expect(result.ok).toBe(true);
    expect(result.importMap.imports['react-dom/client']).toMatch(/^https:\/\/esm\.sh\/react-dom@18\.3\.1\/client\?external=/);
    expect(result.document).toContain('https://storage.test/hero.png');
    expect(result.document).toContain('Hello');
    expect(result.document).not.toContain('src="/src/main.tsx"');
    expect(result.document).toMatch(/<link rel="icon" href="data:image\/svg\+xml/);
    expect(result.publicUrls['/favicon.svg']).toMatch(/^data:image\/svg\+xml/);
  });

  it('builds identical bytes from identical input', async () => {
    const { profile, files } = await viteProject();
    const plan = planSourceBuild(profile, files);
    const a = await build(files, plan, {});
    const b = await build(files, plan, {});
    expect(a.document).toBe(b.document);
  });
});

describe('imported page check', () => {
  it('passes only when every page rendered without errors or broken images', () => {
    const ok = { path: '/', textLength: 120, elementCount: 40, imagesBroken: [], errors: [] };
    expect(summarizeVerification([ok], ['/']).status).toBe('passed');
    expect(summarizeVerification([{ ...ok, errors: ['TypeError: x'] }], ['/']).status).toBe('failed');
    expect(summarizeVerification([{ ...ok, imagesBroken: ['https://x/y.png'] }], ['/']).status).toBe('failed');
    expect(summarizeVerification([{ ...ok, textLength: 0, elementCount: 1 }], ['/']).status).toBe('failed');
    expect(summarizeVerification([ok], ['/', '/work']).status).toBe('failed');
  });
});

describe('imported publish', () => {
  it('publishes the checked build with stored media at stable paths', async () => {
    const { profile, files, records, sha } = await viteProject();
    const plan = planSourceBuild(profile, files);
    const artifact = await buildImportedPublishArtifact({ adapter: SOURCE_BUILD_ADAPTER, records, files, build: ({ files: f, assetUrls }) => build(f, plan, assetUrls) });
    const placed = `_unison/assets/${sha.slice(0, 32)}.png`;
    expect(artifact.files['index.html']).toContain(`/${placed}`);
    expect(artifact.files['favicon.svg']).toBe('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(artifact.placements).toEqual([{ path: placed, source: 'src/assets/hero.png', sha256: sha }]);
    expect(Object.keys(artifact.files).some((p) => p.startsWith('.unison-import'))).toBe(false);
    expect(artifact.hash).toBe(await hashVfsFiles(artifact.files));
  });

  it('server accepts only the checked files of a passed, owner-confirmed check', async () => {
    const { profile, files, records } = await viteProject();
    const plan = planSourceBuild(profile, files);
    const artifact = await buildImportedPublishArtifact({ adapter: SOURCE_BUILD_ADAPTER, records, files, build: ({ files: f, assetUrls }) => build(f, plan, assetUrls) });
    const vfsHash = await hashVfsFiles(files);
    const revision = { id: 'r1', vfs_hash: vfsHash, vfs_files: files };
    const verification = { revision_id: 'r1', vfs_hash: vfsHash, artifact_hash: artifact.hash, status: 'passed', owner_confirmed: true };

    const ok = await verifyImportedPublish({ revision, verification, submittedFiles: artifact.files });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.placements).toHaveLength(1);
      expect(ok.files[IMPORTED_PUBLISH_PLACEMENTS_PATH]).toBeUndefined();
    }
    expect((await verifyImportedPublish({ revision, verification: null, submittedFiles: artifact.files })).ok).toBe(false);
    expect((await verifyImportedPublish({ revision, verification: { ...verification, owner_confirmed: false }, submittedFiles: artifact.files })).ok).toBe(false);
    expect((await verifyImportedPublish({ revision, verification: { ...verification, status: 'failed' }, submittedFiles: artifact.files })).ok).toBe(false);
    const tampered = { ...artifact.files, 'index.html': `${artifact.files['index.html']}<!-- changed -->` };
    expect(await verifyImportedPublish({ revision, verification, submittedFiles: tampered })).toMatchObject({ ok: false, code: 'imported-artifact-mismatch' });
  });
});
