import { describe, expect, it, beforeEach } from "vitest";

import {
  buildLauncherNavigationState,
  clearLauncherHandoff,
  persistAndBuildLauncherHandoff,
  persistLauncherHandoff,
  readLauncherHandoff,
} from "@/services/launcherHandoffPersistence";
import { findUnresolvedLocalImports } from '@/services/laneBCompanionModules';
import {
  CANONICAL_METADATA_FILE_PATHS,
  PUBLISHED_RUNTIME_MODULE_PATH,
} from '@/services/canonicalLaunchVfs';
import { prepareSandpackFiles } from '@/utils/sandpackFilePrep';

const PUBLISHED_RUNTIME_METADATA_PATH = CANONICAL_METADATA_FILE_PATHS.publishedRuntime;

describe("launcher handoff persistence", () => {
  beforeEach(() => {
    clearLauncherHandoff();
  });

  it("keeps a launcher handoff available across dashboard redirects", () => {
    persistLauncherHandoff({
      routeState: {
        fromLauncher: true,
        startInPreview: true,
        templateName: "Shine Site",
        systemType: "store",
        vfsFiles: {
          "/src/App.tsx": "export default function App(){return <main />}",
        },
      },
    });

    const handoff = readLauncherHandoff();

    expect(handoff?.targetPath).toBe("/web-builder");
    expect(handoff?.routeState.fromLauncher).toBe(true);
    expect(handoff?.routeState.templateName).toBe("Shine Site");
    expect(handoff?.routeState.vfsFiles).toEqual({
      "/src/App.tsx": "export default function App(){return <main />}",
    });
  });

  it('keeps a compact VFS recovery copy in both session storage and browser history', () => {
    const routeState = {
      fromLauncher: true,
      startInPreview: true,
      vfsFiles: {
        '/src/App.tsx': 'export default function App(){ return <main />; }',
        '/.unison/site-bundle-snapshot.json': JSON.stringify({
          snapshotId: 'snap_1',
          vfsFiles: { '/src/App.tsx': 'duplicate source' },
        }),
      },
      siteBundleSnapshot: {
        snapshotId: 'snap_1',
        vfsFiles: { '/src/App.tsx': 'duplicate source' },
      },
      compiledPlayground: {
        vfsFiles: { '/src/App.tsx': 'duplicate source' },
      },
    };

    persistLauncherHandoff({ routeState });
    const handoff = readLauncherHandoff();
    const navigationState = buildLauncherNavigationState(routeState);

    expect(handoff?.routeState.vfsFiles).toMatchObject({
      '/src/App.tsx': 'duplicate source',
    });
    expect((handoff?.routeState.siteBundleSnapshot as { vfsFiles?: unknown }).vfsFiles).toBeUndefined();
    expect(handoff?.routeState.snapshotVfsCompacted).toBe(true);
    expect((handoff?.routeState.compiledPlayground as { vfsFiles?: unknown }).vfsFiles).toBeUndefined();
    expect((navigationState as { vfsFiles?: unknown }).vfsFiles).toMatchObject({
      '/src/App.tsx': 'duplicate source',
    });
    expect((navigationState.siteBundleSnapshot as { vfsFiles?: unknown }).vfsFiles).toBeUndefined();
    expect(navigationState.snapshotVfsCompacted).toBe(true);
    expect((navigationState.compiledPlayground as { vfsFiles?: unknown }).vfsFiles).toBeUndefined();
  });

  it('uses snapshot VFS, not divergent outer VFS, as the compact recovery source', () => {
    const routeState = {
      vfsFiles: {
        '/src/App.tsx': 'export default function App(){ return <main>Template preset</main>; }',
      },
      siteBundleSnapshot: {
        snapshotId: 'snap_manifest',
        vfsFiles: {
          '/src/App.tsx': 'export default function App(){ return <main>Deterministic manifest</main>; }',
          '/src/index.css': ':root { --primary: 25 80% 45%; }',
        },
      },
    };

    const navigationState = buildLauncherNavigationState(routeState);

    expect((navigationState.vfsFiles as Record<string, string>)['/src/App.tsx']).toContain('Deterministic manifest');
    expect(navigationState.snapshotVfsCompacted).toBe(true);
  });

  it('uses the committed outer VFS when snapshot files omit a registered page', () => {
    const navigationState = buildLauncherNavigationState({
      vfsFiles: {
        '/src/App.tsx': "import Home from './pages/Home'; export default Home;",
        '/src/pages/Home.tsx': 'export default function Home(){ return <main>Committed home</main>; }',
        '/src/index.css': ':root { --primary: 25 80% 45%; }',
      },
      siteBundleSnapshot: {
        snapshotId: 'snap_stale_files',
        pageRegistry: {
          pages: {
            home: { filePath: '/src/pages/Home.tsx', path: '/', isHome: true },
          },
        },
        vfsFiles: {
          '/src/App.tsx': "import Home from './pages/Home'; export default Home;",
          '/src/index.css': ':root { --primary: 25 80% 45%; }',
        },
      },
    });

    const files = navigationState.vfsFiles as Record<string, string>;
    expect(files['/src/pages/Home.tsx']).toContain('Committed home');
    expect(navigationState.snapshotVfsCompacted).toBe(true);
  });

  it('preserves and canonicalizes Sandpack page paths and root companion modules', () => {
    const navigationState = buildLauncherNavigationState({
      siteBundleSnapshot: {
        snapshotId: 'snap_sandpack_paths',
        pageRegistry: {
          pages: {
            home: { filePath: '/src/pages/Home.tsx', path: '/', isHome: true },
          },
        },
        vfsFiles: {
          '/App.tsx': "import Home from './pages/Home'; export default Home;",
          '/pages/Home.tsx': "import { helper } from '../site-runtime'; export default function Home(){ return <main>{helper}</main>; }",
          '/site-runtime.ts': "export const helper = 'ready';",
          'components/Hero.tsx': 'export default function Hero(){ return <section />; }',
        },
      },
    });

    const files = navigationState.vfsFiles as Record<string, string>;
    expect(files['/src/App.tsx']).toContain("./pages/Home");
    expect(files['/src/pages/Home.tsx']).toContain('function Home');
    expect(files['/src/components/Hero.tsx']).toContain('function Hero');
    expect(files['/src/site-runtime.ts']).toContain("helper = 'ready'");
    expect(navigationState.snapshotVfsCompacted).toBe(true);
  });

  it('preserves arbitrary nested source companions under one canonical root', () => {
    const navigationState = buildLauncherNavigationState({
      vfsFiles: {
        '/App.tsx': "import Home from './pages/Home'; export default Home;",
        '/pages/Home.tsx': "import { format } from '../lib/format'; import { useCart } from '../hooks/useCart'; export default function Home(){ useCart(); return <main>{format('ready')}</main>; }",
        '/lib/format.ts': 'export const format = (value: string) => value;',
        '/hooks/useCart.ts': 'export const useCart = () => null;',
        '/data/catalog.json': '{}',
      },
    });

    const files = navigationState.vfsFiles as Record<string, string>;
    expect(files['/src/lib/format.ts']).toContain('format');
    expect(files['/src/hooks/useCart.ts']).toContain('useCart');
    expect(files['/src/data/catalog.json']).toBe('{}');
    expect(files['/lib/format.ts']).toBeUndefined();
    expect(findUnresolvedLocalImports(files)).toEqual([]);

    const previewFiles = prepareSandpackFiles(files);
    expect(previewFiles['/pages/Home.tsx']).toContain("../lib/format");
    expect(previewFiles['/lib/format.ts']).toContain('format');
    expect(previewFiles['/hooks/useCart.ts']).toContain('useCart');
  });

  it('keeps the published runtime contract and repairs its source module before handoff closure', () => {
    const runtime = {
      version: '1.0',
      runtimeVersion: '1.0',
      siteId: 'site-handoff',
      businessId: null,
      projectId: null,
      snapshotId: 'snap-handoff-runtime',
      endpoint: null,
      runtimeEndpoint: null,
      formEndpoint: null,
      controllerEndpoints: {},
    };
    const navigationState = buildLauncherNavigationState({
      vfsFiles: {
        '/src/App.tsx': "import { hydrate } from './components/catalogHydration'; export default function App(){ return <main>{hydrate()}</main>; }",
        '/src/components/catalogHydration.ts': "import { PUBLISHED_RUNTIME_CONFIG } from '../unison/publishedRuntime'; export const hydrate = () => PUBLISHED_RUNTIME_CONFIG.siteId;",
        [PUBLISHED_RUNTIME_METADATA_PATH]: JSON.stringify(runtime),
      },
    });

    const files = navigationState.vfsFiles as Record<string, string>;
    expect(files[PUBLISHED_RUNTIME_METADATA_PATH]).toBe(JSON.stringify(runtime));
    expect(files[PUBLISHED_RUNTIME_MODULE_PATH]).toContain('site-handoff');
    expect(findUnresolvedLocalImports(files)).toEqual([]);
  });

  it('uses the same canonical artifact for persisted recovery and immediate preview', () => {
    const routeState = {
      fromLauncher: true,
      vfsFiles: {
        '/App.tsx': "import Home from './pages/Home'; export default Home;",
        '/pages/Home.tsx': "import Card from '../components/Card'; export default function Home(){ return <Card />; }",
        '/components/Card.tsx': 'export default function Card(){ return <article>Ready</article>; }',
      },
      siteBundleSnapshot: {
        snapshotId: 'snap_exact_handoff',
        pageRegistry: {
          homePageId: 'home',
          pages: {
            home: { filePath: '/src/pages/Home.tsx', path: '/', isHome: true },
          },
        },
        vfsFiles: {
          '/App.tsx': "import Home from './pages/Home'; export default Home;",
          '/pages/Home.tsx': "import Card from '../components/Card'; export default function Home(){ return <Card />; }",
          '/components/Card.tsx': 'export default function Card(){ return <article>Ready</article>; }',
        },
      },
    };

    const immediate = persistAndBuildLauncherHandoff({ routeState });
    const persisted = readLauncherHandoff()?.routeState;
    expect(persisted).toEqual(immediate);
    const files = immediate.vfsFiles as Record<string, string>;
    expect(findUnresolvedLocalImports(files)).toEqual([]);
    expect(files['/src/components/Card.tsx']).toContain('Ready');
  });

  it('rejects conflicting source files that collapse to the same canonical path', () => {
    expect(() => buildLauncherNavigationState({
      vfsFiles: {
        '/src/lib/format.ts': "export const format = 'canonical';",
        '/lib/format.ts': "export const format = 'stale';",
      },
    })).toThrow(/conflicting files/);
  });

  it('opens a durable revision when compact handoff validation finds an unresolved import', () => {
    const navigationState = persistAndBuildLauncherHandoff({
      routeState: {
        fromLauncher: true,
        businessId: 'business-1',
        siteId: 'site-1',
        projectId: 'project-1',
        draftId: 'draft-1',
        revisionId: 'revision-1',
        entryPoint: '/src/App.tsx',
        vfsFiles: {
          '/src/App.tsx': "import Missing from './Missing'; export default Missing;",
          '/src/index.css': ':root { --primary: 221 83% 53%; }',
        },
      },
    });

    expect(navigationState).toMatchObject({
      fromLauncher: true,
      startInPreview: true,
      businessId: 'business-1',
      projectId: 'project-1',
      draftId: 'draft-1',
      revisionId: 'revision-1',
      handoffRecoveryMode: 'durable-revision',
    });
    expect(navigationState.vfsFiles).toBeUndefined();
    expect(String(navigationState.handoffWarning)).toContain('unresolved local imports');
    expect(readLauncherHandoff()?.routeState).toEqual(navigationState);
  });

  it('ignores unresolved imports in imported toolchain config while preserving the original file', () => {
    const navigationState = buildLauncherNavigationState({
      fromImportedSource: true,
      importToolchainConfigFiles: ['vite.config.ts'],
      vfsFiles: {
        '/src/main.tsx': 'export default function App() { return <main>Imported</main>; }',
        '/vite.config.ts': "import mockupPreviewPlugin from './mockupPreviewPlugin'; export default { plugins: [mockupPreviewPlugin()] };",
      },
    });

    expect((navigationState.vfsFiles as Record<string, string>)['/vite.config.ts']).toContain('./mockupPreviewPlugin');
  });

  it('still rejects unresolved imports in imported application source', () => {
    expect(() => buildLauncherNavigationState({
      fromImportedSource: true,
      importToolchainConfigFiles: ['vite.config.ts'],
      vfsFiles: {
        '/src/main.tsx': "import App from './MissingApp'; export default App;",
        '/vite.config.ts': "import mockupPreviewPlugin from './mockupPreviewPlugin'; export default { plugins: [mockupPreviewPlugin()] };",
      },
    })).toThrow(/canonical handoff has unresolved local imports: \/src\/main\.tsx/);
  });

  it('uses revision-only recovery when canonical path compaction fails after commit', () => {
    const navigationState = persistAndBuildLauncherHandoff({
      routeState: {
        businessId: 'business-1',
        projectId: 'project-1',
        draftId: 'draft-1',
        revisionId: 'revision-1',
        vfsFiles: {
          '/src/lib/format.ts': "export const format = 'canonical';",
          '/lib/format.ts': "export const format = 'stale';",
        },
      },
    });

    expect(navigationState.handoffRecoveryMode).toBe('durable-revision');
    expect(navigationState.revisionId).toBe('revision-1');
    expect(navigationState.vfsFiles).toBeUndefined();
  });
  it('builds one compact payload for both navigation and recovery', () => {
    const routeState = {
      fromLauncher: true,
      vfsFiles: {
        '/src/App.tsx': 'export default function App(){ return <main>Generated</main>; }',
      },
      siteBundleSnapshot: {
        snapshotId: 'snap_atomic',
        vfsFiles: {
          '/src/App.tsx': 'export default function App(){ return <main>Canonical</main>; }',
        },
      },
    };

    const navigationState = persistAndBuildLauncherHandoff({ routeState });
    const recoveryState = readLauncherHandoff()?.routeState;

    expect(navigationState).toEqual(recoveryState);
    expect((navigationState.vfsFiles as Record<string, string>)['/src/App.tsx']).toContain('Canonical');
  });
});
