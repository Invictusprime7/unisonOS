import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { createEmptyCreatorData } from '@/types/creatorData';
import { createBuilderPage, createEmptyPageRegistry } from '@/types/pageRegistry';
import { exportSourceProject } from '@/services/export/exportSourceProject';
import { importUnisonSiteZip } from '@/services/export/importUnisonSiteZip';
import { importSourceProjectZip } from '@/services/export/importSourceProjectZip';
import { normalizeLauncherFiles } from '@/utils/sandpackFilePrep';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';

function createSnapshot(): SiteBundleSnapshot {
  const pageRegistry = createEmptyPageRegistry();
  const homePage = createBuilderPage('home', 'Home', '/', 'home', {
    isHome: true,
    filePath: '/src/pages/Home.tsx',
  });
  pageRegistry.pages[homePage.pageId] = homePage;
  pageRegistry.homePageId = homePage.pageId;

  return {
    snapshotId: 'snapshot-export-test',
    businessName: 'Export Test',
    industry: 'agency',
    pageRegistry,
    vfsFiles: {
      '/src/main.tsx': "import React from 'react'; import { createRoot } from 'react-dom/client'; import App from './App'; import './index.css'; createRoot(document.getElementById('root')!).render(<App />);",
      '/src/App.tsx': "import { Routes, Route } from 'react-router-dom'; import Home from './pages/Home'; export default function App() { return <Routes><Route path='/' element={<Home />} /></Routes>; }",
      '/src/pages/Home.tsx': 'export default function Home() { return <main>Export test</main>; }',
      '/src/index.css': ':root { --background: 0 0% 100%; --foreground: 0 0% 0%; }',
      '/src/unison/ui/zod.ts': "export * from 'zod';",
      '/src/unison/ui/forms.ts': "export * from 'react-hook-form'; export * from '@hookform/resolvers';",
      '/src/unison/ui/radix/accordion.ts': "export * from '@radix-ui/react-accordion';",
      '/src/unison/ui/radix/dialog.ts': "export * from '@radix-ui/react-dialog';",
      '/public/brand.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    },
    routerFile: {
      path: '/src/App.tsx',
      content: "import { Routes, Route } from 'react-router-dom'; import Home from './pages/Home'; export default function App() { return <Routes><Route path='/' element={<Home />} /></Routes>; }",
    },
    manifest: {
      routes: [{ path: '/', pageId: homePage.pageId, isHome: true }],
      nav: [{ label: 'Home', path: '/', pageId: homePage.pageId }],
      layout: { header: 'none', footer: 'none' },
      metadata: { title: 'Export Test', description: 'Export round-trip fixture' },
    },
    bindings: {},
    calendars: {},
    popups: {},
    creatorData: createEmptyCreatorData('Export Test'),
    componentInstances: {},
    routes: ['/'],
    homeRoute: '/',
    createdAt: '2026-10-22T00:00:00.000Z',
    appContext: {
      businessName: 'Export Test',
      systemType: 'agency',
      systemName: 'Agency',
      themePresetId: 'editorial',
      templateId: 'agency-editorial',
      generatedAt: '2026-10-22T00:00:00.000Z',
    },
    meta: {
      source: 'import',
      snapshotOrigin: 'manual',
      systemId: 'agency',
      industry: 'agency',
      verticalContractId: 'agency',
      themePresetId: 'editorial',
      templateId: 'agency-editorial',
      seal: { version: '1.0' },
      themeInjection: {
        version: '1.0',
        stage: '4b',
        presetId: 'editorial',
        cssPath: '/src/index.css',
      },
    },
  } as unknown as SiteBundleSnapshot;
}

describe('exportSourceProject', () => {
  it('includes Unison snapshot and sidecar metadata for round-trip import', async () => {
    const siteSnapshot = createSnapshot();
    const snapshot = JSON.stringify(siteSnapshot);
    const wizardSeed = JSON.stringify({ industry: 'agency', themePresetId: 'editorial' });
    const playground = JSON.stringify({ pageRegistry: { pages: {} } });
    const result = await exportSourceProject({
      ...siteSnapshot.vfsFiles,
      '/src/index.css': "@import url('https://fonts.example.test/site.woff2?token=private');\n:root { --background: 0 0% 100%; --foreground: 0 0% 0%; }",
      '/.unison/site-bundle-snapshot.json': snapshot,
      '/.unison/wizard-seed.json': wizardSeed,
      '/.unison/canonical-playground.json': playground,
      '/.unison/custom-sidecar.json': '{"preserve":true}',
    }, {
      projectName: 'Export Test',
      entryPoint: '/src/main.tsx',
      snapshot: siteSnapshot,
      manifest: {
        entryPoint: '/src/main.tsx',
        backendRequired: true,
        previewEngine: 'sandpack',
        routes: ['/'],
        dependencies: { react: '19.1.0' },
        envRequirements: ['VITE_PUBLIC_ENDPOINT'],
      },
    });

    const archive = await JSZip.loadAsync(result.blob);
    const read = async (path: string) => {
      const file = archive.file(`export-test/${path}`);
      expect(file, `${path} should be in the source archive`).not.toBeNull();
      return file!.async('string');
    };

    expect(await read('.unison/site-bundle-snapshot.json')).toBe(snapshot);
    expect(await read('.unison/wizard-seed.json')).toBe(wizardSeed);
    expect(await read('.unison/canonical-playground.json')).toBe(playground);
    expect(await read('.unison/custom-sidecar.json')).toBe('{"preserve":true}');
    expect(await read('.unison/runtime-manifest.json')).toContain('"themePresetId": "editorial"');

    const packageJson = JSON.parse(await read('package.json'));
    expect(packageJson.dependencies.react).toBe('19.2.1');
    expect(packageJson.dependencies['react-router-dom']).toBe('7.18.4');
      expect(packageJson.dependencies.zod).toBe('4.6.5');
      expect(packageJson.dependencies['react-hook-form']).toBe('7.68.0');
      expect(packageJson.dependencies['@hookform/resolvers']).toBe('5.2.2');
      expect(packageJson.dependencies['@radix-ui/react-accordion']).toBeDefined();
      expect(packageJson.dependencies['@radix-ui/react-dialog']).toBeDefined();
      expect(packageJson.dependencies).not.toHaveProperty('@/unison');
      expect(packageJson.dependencies).not.toHaveProperty('@/project-components');
      expect(packageJson.dependencies).not.toHaveProperty('path');
    expect(packageJson.devDependencies.vite).toBe('7.3.6');
    expect(JSON.stringify(packageJson)).not.toContain('latest');

    const projectManifest = JSON.parse(await read('project-manifest.json'));
    expect(projectManifest.schemaVersion).toBe('unison-project-manifest/1');
    expect(projectManifest.snapshot.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(projectManifest.sourceFileCount).toBeGreaterThan(0);

    const designContext = JSON.parse(await read('design-context.json'));
    expect(designContext.schemaVersion).toBe('unison-design-context/1');
    expect(designContext.themePresetId).toBe('editorial');

    const exportedRuntime = JSON.parse(await read('unison.runtime.json'));
    expect(exportedRuntime.backendRequired).toBe(true);
    expect(exportedRuntime.envRequirements).toEqual(['VITE_PUBLIC_ENDPOINT']);

    const backend = JSON.parse(await read('backend-capabilities.json'));
    expect(backend.schemaVersion).toBe('unison-backend-capabilities/1');

    const assets = JSON.parse(await read('asset-manifest.json'));
    expect(assets.localAssets.map((asset: { path: string }) => asset.path)).toContain('public/brand.svg');
    expect(assets.externalReferences).toContainEqual(expect.objectContaining({ host: 'fonts.example.test' }));
    expect(JSON.stringify(assets)).not.toContain('token=private');

    const preflight = JSON.parse(await read('export-preflight.json'));
    expect(preflight.schemaVersion).toBe('unison-export-preflight/1');
    expect(preflight.passed).toBe(true);
    expect(preflight.warnings).toContainEqual({ code: 'lockfile-missing' });

    expect(await read('AGENTS.md')).toContain('never commit secret values');
    expect(await read('UNISON_PROJECT.md')).toContain('design-context.json');

    expect(result.fileCount).toBe(Object.values(archive.files).filter((entry) => !entry.dir).length);

    const importedSource = await importSourceProjectZip(result.blob);
    expect(importedSource.vfsFiles['/src/pages/Home.tsx']).toContain('Export test');
    const normalizedImport = normalizeLauncherFiles(importedSource.vfsFiles, {
      entryPoint: '/src/main.tsx',
      themePresetId: 'editorial',
      injectCssIfMissing: false,
    });
    expect(normalizedImport['/src/pages/Home.tsx']).toContain('Export test');
    const restored = await importUnisonSiteZip(result.blob);
    expect(restored.vfsFiles['/.unison/site-bundle-snapshot.json']).toContain('snapshot-export-test');
    expect(restored.vfsFiles['/src/pages/Home.tsx']).toContain('Export test');
    const restoredHomeId = restored.siteBundleSnapshot.pageRegistry.homePageId;
    expect(restored.siteBundleSnapshot.pageRegistry.pages[restoredHomeId].filePath).toBe('/src/pages/Home.tsx');
    expect(restored.themePresetId).toBe('editorial');
  });

  it('refuses to create a ZIP when the project has an unresolved local import', async () => {
    const siteSnapshot = createSnapshot();
    const files = {
      ...siteSnapshot.vfsFiles,
      '/src/pages/Home.tsx': "import Missing from './Missing'; export default function Home(){ return <Missing />; }",
    };

    await expect(exportSourceProject(files, {
      projectName: 'Broken Export',
      entryPoint: '/src/main.tsx',
      snapshot: siteSnapshot,
      manifest: {
        entryPoint: '/src/main.tsx',
        backendRequired: false,
        previewEngine: 'sandpack',
        routes: ['/'],
        dependencies: {},
        envRequirements: [],
      },
    })).rejects.toThrow(/unresolved local imports/i);
  });
});