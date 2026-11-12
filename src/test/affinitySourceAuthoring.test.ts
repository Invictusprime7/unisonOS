// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AIComposerRequest, AIComposerResponse } from '@/contracts/aiComposerContract';
import { composerProposalViolations } from '@/contracts/aiComposerContract';
import { authorSourceProject, clearSourceAuthoringCheckpoint, missingModules, SourceAuthoringError, staticSourceProblems } from '@/services/source-authoring/affinitySourceAuthor';
import { sourceProjectEditTargets } from '@/services/source-authoring/sourceProjectEditTargets';
import { intakeLooseFiles } from '@/services/import/secureIntake';
import { analyzeImportedProject } from '@/services/import/importCompatibilityProfile';
import { buildImportedSourceVfs, evaluateImportedSourceCandidate } from '@/services/import/importedSourceAcceptance';
import { isImportedSourceVfs, readImportedSourceRecords } from '@/services/import/importedSourceRecords';
import { planSourceBuild } from '@/services/import/sourceBuild/sourceBuildPlan';

const PKG = JSON.stringify({
  name: 'harbour-bakery', type: 'module',
  dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1', 'react-router-dom': '^6.28.0' },
  devDependencies: { vite: '^5.4.0', '@vitejs/plugin-react': '^4.3.0', tailwindcss: '^4.0.0', '@tailwindcss/vite': '^4.0.0' },
}, null, 2);
const FOUNDATION: AIComposerResponse = {
  summary: 'Harbour Bakery foundation',
  fileOps: [
    { type: 'create', path: '/package.json', content: PKG },
    { type: 'create', path: '/index.html', content: '<!doctype html><html><head><title>Harbour Bakery</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>' },
    { type: 'create', path: '/vite.config.ts', content: "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nimport tailwindcss from '@tailwindcss/vite';\nexport default defineConfig({ plugins: [react(), tailwindcss()] });\n" },
    { type: 'create', path: '/src/main.tsx', content: "import { createRoot } from 'react-dom/client';\nimport { BrowserRouter } from 'react-router-dom';\nimport App from './App';\nimport './index.css';\ncreateRoot(document.getElementById('root')!).render(<BrowserRouter><App /></BrowserRouter>);\n" },
    { type: 'create', path: '/src/index.css', content: '@import "tailwindcss";\n@theme { --color-crust: #7a4b25; }\n' },
    { type: 'create', path: '/src/App.tsx', content: "import { Route, Routes } from 'react-router-dom';\nimport Layout from './components/Layout';\nimport Home from './pages/Home';\nimport Menu from './pages/Menu';\nexport default function App() { return <Layout><Routes><Route path=\"/\" element={<Home />} /><Route path=\"/menu\" element={<Menu />} /></Routes></Layout>; }\n" },
    { type: 'create', path: '/src/components/Layout.tsx', content: "import type { ReactNode } from 'react';\nimport { Link } from 'react-router-dom';\nexport default function Layout({ children }: { children: ReactNode }) { return <><nav><Link to=\"/\">Home</Link><Link to=\"/menu\">Menu</Link></nav><main>{children}</main></>; }\n" },
  ],
  routeOps: [
    { type: 'add_page', pageId: 'Home', title: 'Home', route: '/', showInNav: true },
    { type: 'add_page', pageId: 'Menu', title: 'Menu', route: '/menu', showInNav: true },
  ],
};
const page = (path: string, body: string): AIComposerResponse => ({ summary: `Wrote ${path}`, fileOps: [{ type: 'create', path, content: body }] });

function fakeAffinity(responses: Array<(request: AIComposerRequest) => AIComposerResponse>) {
  const requests: AIComposerRequest[] = [];
  const invoke = (async (input: { messages: Array<{ content: unknown }> }) => {
    const request = JSON.parse(String(input.messages[0].content)) as AIComposerRequest;
    requests.push(request);
    const next = responses.shift();
    if (!next) throw new Error('unexpected turn');
    return { data: { content: JSON.stringify(next(request)) }, error: null };
  }) as never;
  return { invoke, requests };
}

describe('Affinity source authorship', () => {
  it('writes the foundation, then one turn per page it routes to, and builds as a React + Vite project', async () => {
    const { invoke, requests } = fakeAffinity([
      () => FOUNDATION,
      () => page('/src/pages/Home.tsx', 'export default function Home() { return <h1>Fresh bread at dawn</h1>; }\n'),
      () => page('/src/pages/Menu.tsx', 'export default function Menu() { return <h1>Menu</h1>; }\n'),
    ]);
    const result = await authorSourceProject({ prompt: 'A harbour-side bakery with a menu page', projectName: 'Harbour Bakery', invoke });

    expect(requests.map((r) => r.task)).toEqual(['source_project_author', 'source_project_author', 'source_project_author']);
    expect(requests[0].sourceTargets).toBeUndefined();
    expect(requests[1].sourceTargets).toEqual(['/src/pages/Home.tsx']);
    expect(requests[2].sourceTargets).toEqual(['/src/pages/Menu.tsx']);
    expect(result.pages.map((p) => p.route)).toEqual(['/', '/menu']);
    expect(result.repairs).toBe(0);
    expect(result.files['/src/App.tsx']).toBe(FOUNDATION.fileOps[5].type === 'create' ? FOUNDATION.fileOps[5].content : '');
    expect(missingModules(result.files)).toEqual([]);

    const intake = await intakeLooseFiles(Object.entries(result.files).map(([path, text]) => ({ path: path.slice(1), bytes: new TextEncoder().encode(text) })));
    const profile = analyzeImportedProject({ manifest: intake.manifest, textFiles: intake.textFiles });
    const plan = planSourceBuild(profile, result.files);
    expect(plan.status).toBe('supported');
    expect(plan.entry).toBe('/src/main.tsx');
    expect(plan.tailwind).toBe('4');
  });

  it('sends undeclared packages back for one targeted repair that may change package.json', async () => {
    const withPackage = JSON.stringify({ ...JSON.parse(PKG), dependencies: { ...JSON.parse(PKG).dependencies, 'lucide-react': '^0.462.0' } });
    const { invoke, requests } = fakeAffinity([
      () => FOUNDATION,
      () => page('/src/pages/Home.tsx', "import { Croissant } from 'lucide-react';\nexport default function Home() { return <h1><Croissant /> Bread</h1>; }\n"),
      () => page('/src/pages/Menu.tsx', 'export default function Menu() { return <h1>Menu</h1>; }\n'),
      () => ({ summary: 'Declared lucide-react', fileOps: [{ type: 'replace', path: '/package.json', content: withPackage }] }),
    ]);
    const result = await authorSourceProject({ prompt: 'Bakery', projectName: 'Harbour Bakery', invoke });
    expect(result.repairs).toBe(1);
    expect(requests[3].sourceTargets).toContain('/package.json');
    expect(requests[3].diagnostics?.join('\n')).toContain('lucide-react');
    expect(await staticSourceProblems(result.files)).toEqual([]);
  });

  it('stops honestly when the build check keeps failing', async () => {
    const { invoke } = fakeAffinity([
      () => FOUNDATION,
      () => page('/src/pages/Home.tsx', 'export default function Home() { return <h1>Home</h1>; }\n'),
      () => page('/src/pages/Menu.tsx', 'export default function Menu() { return <h1>Menu</h1>; }\n'),
      () => ({ summary: 'try', fileOps: [{ type: 'replace', path: '/src/App.tsx', content: 'export default function App() { return null; }\n' }] }),
      () => ({ summary: 'try again', fileOps: [{ type: 'replace', path: '/src/App.tsx', content: 'export default function App() { return null; }\n' }] }),
    ]);
    await expect(authorSourceProject({
      prompt: 'Bakery', projectName: 'Harbour Bakery', invoke,
      buildCheck: async () => ({ ok: false, errors: [{ path: '/src/App.tsx', message: 'Could not resolve "./Missing"' }] }),
    })).rejects.toThrow('could not finish a site that builds cleanly');
  });
});

const TIMEOUT = 'AI providers failed to produce a response. gemini-3.8-flash: timeout.';
function scriptedAffinity(steps: Array<(request: AIComposerRequest) => AIComposerResponse | 'timeout'>) {
  const requests: AIComposerRequest[] = [];
  const invoke = (async (input: { messages: Array<{ content: unknown }> }) => {
    const request = JSON.parse(String(input.messages[0].content)) as AIComposerRequest;
    requests.push(request);
    const next = steps.shift();
    if (!next) throw new Error('unexpected turn');
    const out = next(request);
    if (out === 'timeout') return { data: { success: false, error: TIMEOUT, errorType: 'ai_unavailable' }, error: { message: TIMEOUT, status: 500 } };
    return { data: { content: JSON.stringify(out) }, error: null };
  }) as never;
  return { invoke, requests };
}
const LEAN_FOUNDATION: AIComposerResponse = { ...FOUNDATION, fileOps: FOUNDATION.fileOps.filter((op) => op.path !== '/src/components/Layout.tsx') };
const LAYOUT = page('/src/components/Layout.tsx', "import type { ReactNode } from 'react';\nexport default function Layout({ children }: { children: ReactNode }) { return <main>{children}</main>; }\n");

describe('Affinity source authorship under provider time limits', () => {
  it('asks the foundation for build files, tokens and router only; shared chrome gets its own turn', async () => {
    const { invoke, requests } = scriptedAffinity([
      () => LEAN_FOUNDATION,
      () => LAYOUT,
      () => page('/src/pages/Home.tsx', 'export default function Home() { return <h1>Home</h1>; }\n'),
      () => page('/src/pages/Menu.tsx', 'export default function Menu() { return <h1>Menu</h1>; }\n'),
    ]);
    const result = await authorSourceProject({ prompt: 'Bakery', projectName: 'Harbour Bakery', invoke, libraryBrief: '' });
    expect(requests[0].instruction).toContain('do not write those files now');
    expect(requests[1].sourceTargets).toEqual(['/src/components/Layout.tsx']);
    expect(requests[1].page.role).toBe('component');
    expect(result.files['/src/components/Layout.tsx']).toBeDefined();
  });

  it('retries a timed-out page as a smaller page built from section files, then writes each section', async () => {
    const { invoke, requests } = scriptedAffinity([
      () => FOUNDATION,
      () => 'timeout',
      () => page('/src/pages/Home.tsx', "import Hero from '../components/home/Hero';\nexport default function Home() { return <Hero />; }\n"),
      () => page('/src/components/home/Hero.tsx', 'export default function Hero() { return <h1>Fresh bread</h1>; }\n'),
      () => page('/src/pages/Menu.tsx', 'export default function Menu() { return <h1>Menu</h1>; }\n'),
    ]);
    const result = await authorSourceProject({ prompt: 'Bakery', projectName: 'Harbour Bakery', invoke, libraryBrief: '' });
    expect(requests[2].sourceTargets).toEqual(['/src/pages/Home.tsx']);
    expect(requests[2].instruction).not.toBe(requests[1].instruction);
    expect(requests[2].instruction).toContain('section components in /src/components/home/');
    expect(requests[3].sourceTargets).toEqual(['/src/components/home/Hero.tsx']);
    expect(requests[3].page.route).toBe('/');
    expect(missingModules(result.files)).toEqual([]);
  });

  it('keeps finished turns when a page times out twice, so Try again continues instead of starting over', async () => {
    const resumeKey = 'owner\nHarbour Bakery\nBakery';
    clearSourceAuthoringCheckpoint(resumeKey);
    const first = scriptedAffinity([
      () => FOUNDATION,
      () => page('/src/pages/Home.tsx', 'export default function Home() { return <h1>Home</h1>; }\n'),
      () => 'timeout',
      () => 'timeout',
    ]);
    const failure = await authorSourceProject({ prompt: 'Bakery', projectName: 'Harbour Bakery', invoke: first.invoke, libraryBrief: '', resumeKey }).catch((e) => e);
    expect(failure).toBeInstanceOf(SourceAuthoringError);
    expect((failure as SourceAuthoringError).options).toEqual({ timedOut: true, resumable: true });
    expect((failure as Error).message).toBe('Affinity ran out of time while writing the Menu page.');

    const again = scriptedAffinity([() => page('/src/pages/Menu.tsx', 'export default function Menu() { return <h1>Menu</h1>; }\n')]);
    const result = await authorSourceProject({ prompt: 'Bakery', projectName: 'Harbour Bakery', invoke: again.invoke, libraryBrief: '', resumeKey });
    expect(again.requests.map((r) => r.sourceTargets)).toEqual([['/src/pages/Menu.tsx']]);
    expect(result.files['/src/pages/Home.tsx']).toContain('Home');
    expect(result.pages.map((p) => p.route)).toEqual(['/', '/menu']);
  });

  it('does not retry billing refusals', async () => {
    const requests: unknown[] = [];
    const invoke = (async () => { requests.push(1); return { data: null, error: { message: 'Payment required', status: 402 } }; }) as never;
    await expect(authorSourceProject({ prompt: 'Bakery', projectName: 'Harbour Bakery', invoke, libraryBrief: '' })).rejects.toThrow('Payment required');
    expect(requests).toHaveLength(1);
  });
});

describe('source project contract', () => {
  const base = { brief: '', files: {}, routes: [], page: { role: 'project', title: 'Site', route: '/', filePath: '/src/App.tsx' } } as const;

  it('whole-project authorship may create root build files but never deletes or replaces unlisted files', () => {
    const request = { ...base, task: 'source_project_author' } as AIComposerRequest;
    expect(composerProposalViolations(request, FOUNDATION)).toEqual([]);
    expect(composerProposalViolations(request, { summary: 'x', fileOps: [{ type: 'delete', path: '/src/App.tsx' }] })).not.toEqual([]);
    expect(composerProposalViolations(request, { summary: 'x', fileOps: [{ type: 'create', path: '/.unison-import/provenance.json', content: '{}' }] })).not.toEqual([]);
    const repair = { ...base, task: 'source_project_author', files: { '/src/App.tsx': 'a', '/src/pages/Home.tsx': 'b' }, sourceTargets: ['/src/App.tsx'] } as AIComposerRequest;
    expect(composerProposalViolations(repair, { summary: 'x', fileOps: [{ type: 'replace', path: '/src/App.tsx', content: 'c' }] })).toEqual([]);
    expect(composerProposalViolations(repair, { summary: 'x', fileOps: [{ type: 'replace', path: '/src/pages/Home.tsx', content: 'c' }] })).not.toEqual([]);
  });

  it('AI Builder edits on a source project may change the router and add new modules; Unison sites still protect them', () => {
    const files = { '/src/App.tsx': 'export default function App() { return null; }\n' };
    const response: AIComposerResponse = {
      summary: 'Add a gallery page',
      fileOps: [
        { type: 'replace', path: '/src/App.tsx', content: "import Gallery from './pages/Gallery';\nexport default function App() { return <Gallery />; }\n" },
        { type: 'create', path: '/src/pages/Gallery.tsx', content: 'export default function Gallery() { return <h1>Gallery</h1>; }\n' },
      ],
    };
    const edit = { ...base, task: 'builder_source_edit', files, sourceTargets: ['/src/App.tsx'] } as AIComposerRequest;
    expect(composerProposalViolations({ ...edit, sourceProject: true }, response)).toEqual([]);
    expect(composerProposalViolations(edit, response).some((v) => v.includes('/src/App.tsx: canonical runtime file'))).toBe(true);
  });
});

describe('Affinity-written projects are source projects', () => {
  it('are accepted byte-for-byte with the same records as imports, and edits may target the whole project', async () => {
    const authored: Record<string, string> = {
      '/package.json': PKG,
      '/index.html': '<div id="root"></div><script type="module" src="/src/main.tsx"></script>',
      '/src/main.tsx': "import App from './App';\nexport { App };\n",
      '/src/App.tsx': "import Home from './pages/Home';\nexport default function App() { return <Home />; }\n",
      '/src/pages/Home.tsx': "import Hero from '../components/Hero';\nexport default function Home() { return <Hero />; }\n",
      '/src/components/Hero.tsx': 'export default function Hero() { return <h1>Hi</h1>; }\n',
      '/src/index.css': '@import "tailwindcss";\n',
    };
    const intake = await intakeLooseFiles(Object.entries(authored).map(([path, text]) => ({ path: path.slice(1), bytes: new TextEncoder().encode(text) })));
    const profile = analyzeImportedProject({ manifest: intake.manifest, textFiles: intake.textFiles });
    const { files, provenance } = buildImportedSourceVfs({
      intake, profile, assets: { version: 1, assets: [], originalArchive: null },
      importedBy: 'user-1', importedAt: '2026-11-12T00:00:00.000Z', origin: 'affinity-authored',
    });
    expect(provenance.origin).toBe('affinity-authored');
    expect(provenance.readiness.publishReady).toBe(false);
    expect(isImportedSourceVfs(files)).toBe(true);
    expect(readImportedSourceRecords(files)?.provenance.origin).toBe('affinity-authored');
    for (const [path, text] of Object.entries(authored)) expect(files[path]).toBe(text);

    const evaluation = await evaluateImportedSourceCandidate({ before: {}, after: files });
    expect(evaluation.ok).toBe(true);

    const targets = sourceProjectEditTargets(files, '/src/pages/Home.tsx');
    expect(targets).toEqual(expect.arrayContaining(['/src/pages/Home.tsx', '/src/components/Hero.tsx', '/src/App.tsx', '/src/index.css', '/package.json', '/index.html']));
    expect(targets.some((path) => path.startsWith('/.unison-import/'))).toBe(false);
  });
});
