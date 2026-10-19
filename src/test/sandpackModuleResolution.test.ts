import { describe, expect, it } from 'vitest';
import { prepareSandpackFiles, processCode } from '@/utils/sandpackFilePrep';
import { buildPreviewArtifacts } from '@/utils/previewArtifacts';
import { getDependenciesForSandpack } from '@/utils/dependencyExtractor';

describe('Sandpack local module resolution', () => {
  it('supports saved Shop pages importing Paragraph from an older content foundation', () => {
    const shop = `import { Paragraph } from '../unison/ui/content'; export default function Shop(){return <Paragraph id="shop-copy">Original shop copy</Paragraph>}`;
    const saved = {
      '/src/App.tsx': `import Shop from './pages/Shop'; export default function App(){return <Shop />}`,
      '/src/pages/Shop.tsx': shop,
      '/src/unison/ui/content.tsx': `export function Body(props){return <p {...props} />}`,
      '/src/index.css': 'body { color: black; }',
    };
    const prepared = prepareSandpackFiles(saved);
    expect(prepared['/unison/ui/content.tsx']).toContain('export const Paragraph = Body;');
    expect(prepared['/unison/ui/index.ts']).toContain('Body, Paragraph');
    expect(prepared['/pages/Shop.tsx']).toContain('<Paragraph id="shop-copy">Original shop copy</Paragraph>');
    expect(saved['/src/pages/Shop.tsx']).toBe(shop);
    expect(saved['/src/unison/ui/content.tsx']).not.toContain('Paragraph');
  });
  it('preserves initial saved App props in the entry module', () => {
    const files = buildPreviewArtifacts({ sourceFiles: {
      '/src/main.tsx': `import React from 'react';import {createRoot} from 'react-dom/client';import App from './App';createRoot(document.getElementById('root')!).render(<App title="Saved project state" />);`,
      '/src/App.tsx': `export default function App({title}:{title:string}){return <h1>{title}</h1>}`,
      '/src/index.css': 'body {color: black}',
    } }).sandpackFiles;
    expect(files['/index.tsx']).toContain('<App title="Saved project state" />');
  });
  it('preserves a saved provider bootstrap instead of mounting App outside its context', () => {
    const files = buildPreviewArtifacts({ sourceFiles: {
      '/src/main.tsx': `import React from 'react'; import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App'; import { SiteContext } from './context';
createRoot(document.getElementById('root')!).render(<Router><SiteContext.Provider value="Saved state"><App /></SiteContext.Provider></Router>);`,
      '/src/context.tsx': `import { createContext } from 'react'; export const SiteContext = createContext<string | null>(null);`,
      '/src/App.tsx': `import {useContext} from 'react'; import {SiteContext} from './context'; export default function App(){const state=useContext(SiteContext);return state ? <h1>{state}</h1> : null;}`,
      '/src/index.css': 'body { color: black; }',
    } }).sandpackFiles;
    expect(files['/index.tsx']).toContain('<SiteContext.Provider value="Saved state">');
    expect(files['/index.tsx']).toContain('HashRouter as Router');
    expect(files['/index.tsx']).not.toContain('__RouterGuard');
    expect(files['/index.tsx']).toContain('UNISON_PREVIEW_RENDER_READY');
    expect(files['/index.tsx']).toContain('const __savedPreviewObserver = new MutationObserver(__reportSavedPreviewReady)');
    expect(files['/index.tsx']).toContain('__savedPreviewObserver.observe(document.body, { childList: true, subtree: true });\n__reportSavedPreviewReady();');
    expect(files['/index.tsx']).toContain('__initUnisonPreviewNavBridge');
  });
  it('resolves multiline aliased component imports after flattening /src', () => {
    const files = prepareSandpackFiles({
      '/src/App.tsx': `import {
  Hero
} from '@/components/Hero';
export default function App() { return <Hero />; }`,
      '/src/components/Hero.tsx': 'export function Hero() { return <h1>Authored hero</h1>; }',
      '/src/index.css': ':root { --primary: 0 0% 10%; }',
    });
    expect(files['/App.tsx']).toContain("from './components/Hero'");
    expect(files['/App.tsx']).not.toContain('@/');
    expect(files['/components/Hero.tsx']).toContain('Authored hero');
  });

  it('resolves alias re-exports and dynamic imports without altering ordinary strings', () => {
    const code = `export { Hero } from '@/components/Hero';
export * from '@/components/content';
export const load = () => import('@/components/Detail');
export const example = "import('@/components/example')";`;
    const prepared = processCode(code, '/pages/index.ts');
    expect(prepared).toContain("from '../components/Hero'");
    expect(prepared).toContain("from '../components/content'");
    expect(prepared).toContain("import('../components/Detail')");
    expect(prepared).toContain('"import(\'@/components/example\')"');
  });

  it('preserves escaped hash-route regexes in the generated Sandpack entry', () => {
    const files = prepareSandpackFiles({
      '/src/main.tsx': `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
createRoot(document.getElementById('root')!).render(<App />);`,
      '/src/App.tsx': 'export default function App() { return <main>Ready</main>; }',
      '/src/index.css': 'body { color: black; }',
    });

    expect(files['/index.tsx']).toContain(String.raw`navPath.replace(/^#\/?/, '')`);
    expect(files['/index.tsx']).not.toContain("navPath.replace(/^#/?/");
  });

  it('projects a sealed Wizard snapshot using multiline absolute imports and re-exports', () => {
    const authoredFiles = {
      '/src/App.tsx': `import {
  Hero
} from '/src/components';
export default function App() { return <Hero />; }`,
      '/src/components/index.ts': "export { Hero } from '@/components/Hero';",
      '/src/components/Hero.tsx': 'export function Hero() { return <h1>Selected design</h1>; }',
      '/src/index.css': ':root { --primary: 0 0% 10%; }',
    };
    const snapshot = {
      snapshotId: 'module-resolution', pageRegistry: { pages: {} }, vfsFiles: authoredFiles,
      meta: {
        themePresetId: 'modern',
        themeInjection: { version: '1.0', stage: '4b', presetId: 'modern', cssPath: '/src/index.css' },
        seal: { version: '1.0', sealedAt: '2026-10-04T00:00:00Z', sealedBy: 'wizard-launch', compileArtifactId: 'module-resolution', fileCount: 4 },
      },
    };
    const result = buildPreviewArtifacts({ sourceFiles: { '/.unison/site-bundle-snapshot.json': JSON.stringify(snapshot) } });
    expect(result.sandpackFiles['/App.tsx']).toContain("from './components'");
    expect(result.sandpackFiles['/components/index.ts']).toContain("from './Hero'");
    expect(result.sandpackFiles['/components/Hero.tsx']).toContain('Selected design');
    expect(authoredFiles['/src/App.tsx']).toContain("from '/src/components'");
  });

  it('installs packages reached through a namespace re-export', () => {
    const result = getDependenciesForSandpack({
      '/index.tsx': "import { Content } from './components'; export default Content;",
      '/components/index.ts': "export * as Content from './content';",
      '/components/content.tsx': "import { clsx } from 'clsx'; export const title = clsx('Title');",
    }, {}, { entryPoints: ['/index.tsx'] });
    expect(result.dependencies.clsx).toBeTruthy();
  });

  it('uses the existing runtime facades for multiline UI and utility imports', () => {
    const files = prepareSandpackFiles({
      '/src/App.tsx': `import {
  Button
} from '@/components/ui/button';
import {
  cn
} from '@/lib/utils';
export default function App() { return <Button className={cn('action')}>Continue</Button>; }`,
      '/src/index.css': ':root { --primary: 0 0% 10%; }',
    });
    expect(files['/App.tsx']).toContain("from './ui-shim'");
    expect(files['/App.tsx']).toContain("from './lib-utils-shim'");
    expect(files['/App.tsx']).not.toContain('@/');
  });

  it('resolves a declared sibling component before trusting an external export-star', () => {
    const files = prepareSandpackFiles({
      '/src/App.tsx': `import { Reveal as Panel, RevealGroup, AnimatePresence as Presence } from './components/animation';
export default function App() { return <RevealGroup><Presence><Panel>Ready</Panel></Presence></RevealGroup>; }`,
      '/src/components/animation.tsx': "export * from 'framer-motion'; export function RevealGroup({ children }) { return <div>{children}</div>; }",
      '/src/components/motion.tsx': 'export function Reveal({ children }) { return <section>{children}</section>; }',
    });
    expect(files['/App.tsx']).toContain("import { Reveal as Panel } from './components/motion';");
    expect(files['/App.tsx']).toContain("import { RevealGroup, AnimatePresence as Presence } from './components/animation';");
    expect(files['/App.tsx']).toContain('<Panel>Ready</Panel>');
  });
});
