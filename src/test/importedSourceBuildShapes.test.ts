// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { intakeLooseFiles } from '@/services/import/secureIntake';
import { analyzeImportedProject } from '@/services/import/importCompatibilityProfile';
import { planSourceBuild } from '@/services/import/sourceBuild/sourceBuildPlan';

/** Universal import: each common project shape is recognised from its own files and gets a source build. */
const enc = (s: string) => new TextEncoder().encode(s);
const pkg = (deps: Record<string, string>, dev: Record<string, string> = {}, extra: Record<string, unknown> = {}) => JSON.stringify({ name: 'app', dependencies: deps, devDependencies: dev, ...extra });
const VITE_HTML = (src: string) => `<!doctype html><html><body><div id="app"></div><script type="module" src="${src}"></script></body></html>`;

async function planOf(files: Record<string, string>) {
  const intake = await intakeLooseFiles(Object.entries(files).map(([path, text]) => ({ path, bytes: enc(text) })));
  const profile = analyzeImportedProject({ manifest: intake.manifest, textFiles: intake.textFiles });
  const vfs = Object.fromEntries(Object.entries(intake.textFiles).map(([p, t]) => [`/${p}`, t]));
  return planSourceBuild(profile, vfs);
}

describe('universal imported project shapes', () => {
  it('Vue + Vite compiles single-file components with the project\'s own Vue version', async () => {
    const plan = await planOf({
      'package.json': pkg({ vue: '3.5.13' }, { vite: '6.0.0', '@vitejs/plugin-vue': '5.2.0' }),
      'index.html': VITE_HTML('/src/main.ts'),
      'src/main.ts': "import { createApp } from 'vue';\nimport App from './App.vue';\ncreateApp(App).mount('#app');",
      'src/App.vue': '<template><h1>Hi</h1></template>',
    });
    expect(plan.status).toBe('supported');
    expect(plan.kind).toBe('vite-html');
    expect(plan.entry).toBe('/src/main.ts');
    expect(plan.compilers.vue).toBe('3.5.13');
    expect(plan.packages.react).toBeUndefined();
  });

  it('Svelte + Vite uses the project\'s Svelte compiler', async () => {
    const plan = await planOf({
      'package.json': pkg({}, { svelte: '5.28.1', vite: '6.0.0', '@sveltejs/vite-plugin-svelte': '5.0.0' }),
      'index.html': VITE_HTML('/src/main.ts'),
      'src/main.ts': "import { mount } from 'svelte';\nimport App from './App.svelte';\nmount(App, { target: document.getElementById('app')! });",
      'src/App.svelte': '<h1>Hi</h1>',
    });
    expect(plan.kind).toBe('vite-html');
    expect(plan.compilers.svelte).toBe('5.28.1');
  });

  it('plain TypeScript + Vite never pulls in React', async () => {
    const plan = await planOf({
      'package.json': pkg({}, { vite: '6.0.0', typescript: '5.0.0' }),
      'index.html': VITE_HTML('/src/main.ts'),
      'src/main.ts': "document.querySelector('#app')!.innerHTML = '<h1>Hi</h1>';",
    });
    expect(plan.kind).toBe('vite-html');
    expect(plan.packages.react).toBeUndefined();
    expect(plan.compilers).toEqual({ vue: null, svelte: null, solid: null, sass: null, less: null });
  });

  it('Next.js App Router pages and dynamic segments become client routes', async () => {
    const plan = await planOf({
      'package.json': pkg({ next: '15.3.0', react: '19.1.0', 'react-dom': '19.1.0' }),
      'app/layout.tsx': 'export default function L({ children }) { return <html><body>{children}</body></html>; }',
      'app/page.tsx': 'export default function P() { return <h1>Home</h1>; }',
      'app/blog/[slug]/page.tsx': 'export default function B() { return <h1>Post</h1>; }',
    });
    expect(plan.status).toBe('supported');
    expect(plan.kind).toBe('next-client');
    expect(plan.next?.router).toBe('app');
    expect(plan.next?.routes.map((r) => r.path).sort()).toEqual(['/', '/blog/:slug']);
    expect(plan.next?.routes.find((r) => r.path === '/')?.layouts).toEqual(['/app/layout.tsx']);
  });

  it('Next.js Pages Router under src/pages uses its custom App', async () => {
    const plan = await planOf({
      'package.json': pkg({ next: '15.3.0', react: '19.1.0', 'react-dom': '19.1.0' }),
      'src/pages/_app.tsx': 'export default function A({ Component, pageProps }) { return <Component {...pageProps} />; }',
      'src/pages/index.tsx': 'export default function P() { return <h1>Home</h1>; }',
      'src/pages/about.tsx': 'export default function P() { return <h1>About</h1>; }',
    });
    expect(plan.kind).toBe('next-client');
    expect(plan.next?.router).toBe('pages');
    expect(plan.next?.app).toBe('/src/pages/_app.tsx');
    expect(plan.next?.routes.map((r) => r.path).sort()).toEqual(['/', '/about']);
  });

  it('Create React App starts from public/index.html and src/index', async () => {
    const plan = await planOf({
      'package.json': pkg({ react: '18.3.1', 'react-dom': '18.3.1', 'react-scripts': '5.0.1' }),
      'public/index.html': '<!doctype html><html><body><div id="root"></div></body></html>',
      'src/index.js': "import ReactDOM from 'react-dom/client';\nReactDOM.createRoot(document.getElementById('root')).render(<h1>Hi</h1>);",
    });
    expect(plan.kind).toBe('script-entry');
    expect(plan.htmlTemplate).toBe('/public/index.html');
    expect(plan.entry).toBe('/src/index.js');
  });

  it('a workspace monorepo builds its web app and links local packages from source', async () => {
    const plan = await planOf({
      'package.json': JSON.stringify({ name: 'acme', private: true, workspaces: ['apps/*', 'packages/*'] }),
      'apps/web/package.json': pkg({ react: '18.3.1', 'react-dom': '18.3.1', '@acme/ui': 'workspace:*' }, { vite: '5.0.0' }),
      'apps/web/index.html': VITE_HTML('/src/main.tsx'),
      'apps/web/src/main.tsx': "import { Button } from '@acme/ui';\nexport const x = Button;",
      'packages/ui/package.json': JSON.stringify({ name: '@acme/ui', main: 'src/index.tsx' }),
      'packages/ui/src/index.tsx': 'export const Button = () => <button>Go</button>;',
    });
    expect(plan.status).toBe('supported');
    expect(plan.root).toBe('/apps/web');
    expect(plan.localPackages['@acme/ui']).toBe('/packages/ui');
    expect(plan.packages['@acme/ui']).toBeUndefined();
  });
});
