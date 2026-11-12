import { describe, expect, it, vi } from 'vitest';

const sent: Array<{ sourceProject?: boolean; files: Record<string, string>; sourceTargets?: string[] }> = [];
// Simulates an edge still running the contract from before source-project edits.
let edgeRefusesSourceProject = false;
vi.mock('@/services/builderBrainClient', async (orig) => ({
  ...(await orig() as object),
  runBuilderTurn: vi.fn(async (body: { messages: Array<{ content: string }> }) => {
    const request = JSON.parse(body.messages[0].content);
    sent.push(request);
    if (edgeRefusesSourceProject && request.sourceProject) {
      const error = Object.assign(new Error('Invalid composer request'), { context: { status: 400, body: JSON.stringify({ error: 'Invalid composer request', errorType: 'composer_request' }) } });
      return { data: null, error };
    }
    const page = request.files['/src/routes/index.tsx'] as string;
    return { data: { content: JSON.stringify({ summary: 'Renamed the heading.', fileOps: [{ type: 'replace', path: '/src/routes/index.tsx', content: page.replace('>ARIA</h1>', '>ARIANN</h1>') }] }) }, error: null };
  }),
}));

import { intakeLooseFiles } from '@/services/import/secureIntake';
import { analyzeImportedProject } from '@/services/import/importCompatibilityProfile';
import { buildImportedSourceVfs } from '@/services/import/importedSourceAcceptance';
import { instrumentSourceForSelection } from '@/services/import/sourceBuild/previewInstrumentation';
import { selectedSourceFinder } from '@/components/creatives/web-builder/selectedSourceMutation';
import { mutateJSXStyles, mutateJSXText } from '@/utils/jsxElementMutation';
import { unisonAppBuilder } from '@/services/app-builder/UnisonAppBuilder';
import { resolveCanonicalAuthoringPage } from '@/services/builder/canonicalAuthoringRequest';
import { sourceProjectApplySettings } from '@/services/source-authoring/sourceProjectApply';
import { checkEditAgainstIntent, editIntentForRequest } from '@/services/editor/editIntentContract';
import { aiComposerRequestSchema, conformComposerRequest, isSourceProjectComposerPath } from '@/contracts/aiComposerContract';

const enc = (s: string) => new TextEncoder().encode(s);
const PAGE = '/src/routes/index.tsx';
const PAGE_SOURCE = [
  "import { createFileRoute } from '@tanstack/react-router';",
  "import { SiteChrome } from '@/components/SiteChrome';",
  "export const Route = createFileRoute('/')({ component: Home });",
  'function Home() {',
  '  return (',
  '    <SiteChrome>',
  '      <section className="hero">',
  '        <h1 className="font-display text-7xl">ARIA</h1>',
  '        <p>Design studio</p>',
  '      </section>',
  '    </SiteChrome>',
  '  );',
  '}',
].join('\n');

async function importedProject() {
  const intake = await intakeLooseFiles([
    { path: 'aria/package.json', bytes: enc(JSON.stringify({ name: 'aria', dependencies: { '@tanstack/react-start': '^1.120.0', '@tanstack/react-router': '^1.120.0', react: '^19.0.0' }, devDependencies: { vite: '^6.0.0' } })) },
    { path: 'aria/tsconfig.json', bytes: enc('{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }') },
    { path: 'aria/src/styles.css', bytes: enc('body { margin: 0; }\n') },
    { path: 'aria/src/routes/__root.tsx', bytes: enc("import '../styles.css';\nexport const Route = 1;\n") },
    { path: 'aria/src/routes/index.tsx', bytes: enc(PAGE_SOURCE) },
    { path: 'aria/src/routes/about.tsx', bytes: enc('export const Route = 1;\n') },
    { path: 'aria/src/components/SiteChrome.tsx', bytes: enc('export const SiteChrome = ({ children }: { children: React.ReactNode }) => <div>ARIA {children}</div>;\n') },
  ]);
  const profile = analyzeImportedProject(intake);
  return buildImportedSourceVfs({ intake, profile, assets: { version: 1, assets: [], originalArchive: null }, importedBy: 'u', importedAt: '2026-11-10T00:00:00Z' }).files;
}

describe('editing imported source projects', () => {
  it('toolbar text and style edits change the clicked element in its own file', async () => {
    const files = await importedProject();
    const built = instrumentSourceForSelection({ [PAGE]: files[PAGE] }, 'rev-1')[PAGE];
    const attrs = /<h1[^>]*data-ut-source-locator="([^"]+)" data-ut-source-ast="([^"]+)" data-ut-source-hash="([^"]+)" data-ut-source-revision="([^"]+)"/.exec(built)!;
    const finder = selectedSourceFinder({ tagName: 'H1', html: '<h1>ARIA</h1>', descriptor: { sourceLocator: attrs[1], astIdentity: attrs[2], sourceHash: attrs[3], sourceRevisionId: attrs[4], revisionId: 'rev-1' } });
    const selector = 'div > section > h1';
    const text = mutateJSXText(files[PAGE], selector, 'ARIANN NORORI', finder);
    expect(text).toContain('<h1 className="font-display text-7xl">ARIANN NORORI</h1>');
    const styled = mutateJSXStyles(files[PAGE], selector, { color: 'var(--primary)' }, finder);
    expect(styled).toMatch(/<h1 className="font-display text-7xl" style=\{\{\s*color: ["']var\(--primary\)["']\s*\}\}>ARIA<\/h1>/);
  });

  it('an AI Builder edit reaches the AI with the page and root files and comes back ready to save', async () => {
    const files = await importedProject();
    sent.length = 0;
    const page = resolveCanonicalAuthoringPage(files, PAGE, PAGE)!;
    const result = await unisonAppBuilder.edit({
      operationId: 'builder:test', page, brief: 'Edit the project.', instruction: 'Change the ARIA heading to ARIANN',
      currentFiles: files, baseRevisionId: 'rev-1', connectorContext: { revisionId: 'rev-1' },
      sourceTargets: [PAGE], routes: [], runtimeContext: '',
    } as unknown as Parameters<typeof unisonAppBuilder.edit>[0]);
    expect(sent).toHaveLength(1);
    expect(sent[0].sourceProject).toBe(true);
    expect(sent[0].sourceTargets).toEqual(expect.arrayContaining([PAGE, '/src/components/SiteChrome.tsx', '/package.json']));
    expect(result.candidate.status).toBe('ready-for-commit');
    expect(result.changeSet?.fileOps.map((op) => op.path)).toEqual([PAGE]);
  });

  it('the save keeps the edit inside the page, its parts and project files, and allows new files', async () => {
    const files = await importedProject();
    const settings = sourceProjectApplySettings(files, PAGE, PAGE, [PAGE, '/src/components/Badge.tsx', '/src/routes/contact.tsx'])!;
    expect(settings.gate.resolveDependencies).toBe(false);
    const contract = editIntentForRequest({ prompt: 'Change the heading', activePagePath: settings.scope.pagePath, pageImports: settings.scope.sharedPaths, expectedRevisionId: 'rev-1' });
    const check = (changed: Record<string, string>) => checkEditAgainstIntent(contract, { baseRevisionId: 'rev-1', files: changed, previousFiles: files });
    expect(check({ [PAGE]: 'x', '/src/components/SiteChrome.tsx': 'y', '/package.json': '{}', '/src/routes/contact.tsx': 'z' })).toEqual([]);
    expect(check({ '/src/routes/about.tsx': 'changed' }).map((v) => v.code)).toEqual(['cross-page-consent']);
  });

  it('is not used for ordinary Unison projects', () => {
    expect(sourceProjectApplySettings({ '/src/App.tsx': 'x' }, '/src/App.tsx')).toBeNull();
  });

  it('still saves the edit when the live AI service refuses the source-project request shape', async () => {
    const files = await importedProject();
    sent.length = 0;
    edgeRefusesSourceProject = true;
    try {
      const page = resolveCanonicalAuthoringPage(files, PAGE, PAGE)!;
      const result = await unisonAppBuilder.edit({
        operationId: 'builder:test-legacy', page, brief: 'Edit the project.', instruction: 'Change the ARIA heading to ARIANN',
        currentFiles: files, baseRevisionId: 'rev-1', connectorContext: { revisionId: 'rev-1' },
        sourceTargets: [PAGE], routes: [], runtimeContext: '',
      } as unknown as Parameters<typeof unisonAppBuilder.edit>[0]);
      expect(sent).toHaveLength(2);
      expect(sent[1].sourceProject).toBeUndefined();
      expect(sent[1].sourceTargets).toContain(PAGE);
      expect(sent[1].sourceTargets).not.toContain('/package.json');
      expect(result.candidate.status).toBe('ready-for-commit');
      expect(result.changeSet?.fileOps.map((op) => op.path)).toEqual([PAGE]);
    } finally {
      edgeRefusesSourceProject = false;
    }
  });

  it('lets AI edit framework route files, root settings files and asset pointers of a source project', () => {
    for (const path of ['/src/routes/process.$slug.tsx', '/src/routes/[__mockup].preview.$.tsx', '/mockupPreviewPlugin.ts', '/tailwind.config.ts', '/src/assets/hero.jpg.asset.json']) {
      expect(isSourceProjectComposerPath(path), path).toBe(true);
    }
    for (const path of ['/package-lock.json', '/.env.json', '/node_modules/x/index.js']) {
      expect(isSourceProjectComposerPath(path), path).toBe(false);
    }
    const request = {
      task: 'builder_source_edit', sourceProject: true,
      page: { role: 'page', title: 'process', route: '/process/$slug', filePath: '/src/routes/process.$slug.tsx' },
      brief: 'x'.repeat(150_000), instruction: 'Make the hero red', routes: [], images: [],
      files: { '/src/routes/process.$slug.tsx': 'export const a = 1;', '/src/huge.ts': 'y'.repeat(250_000) },
      sourceTargets: ['/src/routes/process.$slug.tsx', '/.unison-import/manifest.json', '/mockupPreviewPlugin.ts'],
    };
    const conformed = conformComposerRequest(request);
    const parsed = aiComposerRequestSchema.safeParse(conformed.request);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.sourceTargets).toEqual(['/src/routes/process.$slug.tsx', '/mockupPreviewPlugin.ts']);
    expect(parsed.data.brief.length).toBe(100_000);
    expect(parsed.data.files['/src/huge.ts']).toBeUndefined();
    expect(parsed.data.images).toBeUndefined();
  });
});

describe('sending large source-project requests', () => {
  it('drops read-only context before files the edit may write, for edits and Affinity site writing', async () => {
    const { shrinkBuilderTurnPayload } = await import('@/services/builderPayloadBudget');
    for (const mode of ['builder-source-edit', 'source-project-author']) {
      const request = {
        task: mode === 'builder-source-edit' ? 'builder_source_edit' : 'source_project_author',
        page: { role: 'page', title: 'index', route: '/', filePath: PAGE },
        sourceTargets: [PAGE, '/src/components/SiteChrome.tsx'],
        files: { [PAGE]: 'a'.repeat(20_000), '/src/components/SiteChrome.tsx': 'b'.repeat(30_000), '/src/lib/data.ts': 'c'.repeat(30_000) },
      };
      const { payload } = shrinkBuilderTurnPayload({ mode, messages: [{ role: 'user', content: JSON.stringify(request) }] }, 70_000);
      const sentRequest = JSON.parse((payload.messages as Array<{ content: string }>)[0].content);
      expect(Object.keys(sentRequest.files).sort(), mode).toEqual([PAGE, '/src/components/SiteChrome.tsx'].sort());
    }
  });
});
