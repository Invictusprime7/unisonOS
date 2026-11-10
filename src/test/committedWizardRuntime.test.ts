import { describe, expect, it } from 'vitest';

import { projectCommittedWizardRuntime } from '@/services/committedWizardRuntime';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';

function sealedSnapshot(files: Record<string, string>): SiteBundleSnapshot {
  return {
    snapshotId: 'snapshot-single-runtime',
    businessName: 'Single Runtime Studio',
    industry: 'agency',
    pageRegistry: {
      homePageId: 'home',
      pages: {
        home: {
          pageId: 'home',
          title: 'Home',
          path: '/',
          filePath: '/src/pages/Home.tsx',
          isHome: true,
          navOrder: 0,
        },
      },
    },
    vfsFiles: files,
    meta: {
      source: 'wizard',
      themePresetId: 'modern',
      themeInjection: {
        version: '1.0',
        stage: '4b',
        presetId: 'modern',
        cssPath: '/src/index.css',
      },
      seal: {
        version: '1.0',
        sealedAt: '2026-08-29T00:00:00.000Z',
        sealedBy: 'wizard-launch',
        compileArtifactId: 'snapshot-single-runtime',
        fileCount: Object.keys(files).length,
      },
    },
  } as unknown as SiteBundleSnapshot;
}

describe('committed Wizard runtime projection', () => {
  it('renders the saved VFS bytes over the sealed snapshot copy, keeping Stage 4b CSS when tokens were lost', () => {
    const canonicalFiles = {
      '/src/App.tsx': "import Home from './pages/Home'; export default Home;",
      '/src/pages/Home.tsx': "export default function Home(){ return <main data-ut-variant='hero:split-image'>Stage 4b</main>; }",
      '/src/index.css': ':root { --primary: 221 83% 53%; --ut-motion-duration: 420ms; } /* STAGE_4B_CSS */',
      '/src/unison/ui/motion.tsx': '/* STAGE_4B_MOTION */ export const Reveal = ({ children }: any) => children;',
    };
    const snapshot = sealedSnapshot(canonicalFiles);

    const result = projectCommittedWizardRuntime({
      files: {
        ...canonicalFiles,
        '/src/pages/Home.tsx': 'export default function Home(){ return <main>AI authored festival home</main>; }',
        '/src/index.css': 'body { color: #111; background: #fff; } /* LEGACY_CSS */',
      },
      siteBundleSnapshot: snapshot,
    });

    expect(result.files['/src/pages/Home.tsx']).toContain('AI authored festival home');
    expect(result.files['/src/index.css']).toContain('STAGE_4B_CSS');
    expect(result.files['/src/index.css']).not.toContain('LEGACY_CSS');
    expect(result.files['/src/unison/ui/motion.tsx']).toContain('STAGE_4B_MOTION');
  });

  it('refuses to synthesize CSS for a sealed snapshot whose Stage 4b stylesheet lost tokens', () => {
    const files = {
      '/src/App.tsx': "import Home from './pages/Home'; export default Home;",
      '/src/pages/Home.tsx': 'export default function Home(){ return <main>Home</main>; }',
      '/src/index.css': 'body { color: #111; }',
    };

    expect(() => projectCommittedWizardRuntime({
      files,
      siteBundleSnapshot: sealedSnapshot(files),
    })).toThrow(/refusing to synthesize fallback preview CSS/);
  });
});
