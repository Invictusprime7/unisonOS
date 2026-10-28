import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/services/builderBrainClient', () => ({ runBuilderTurn: vi.fn() }));
import { runBuilderTurn } from '@/services/builderBrainClient';
import { createUnisonAppBuilder } from '@/services/app-builder/UnisonAppBuilder';
import { composerProposalViolations, type AIComposerRequest } from '@/contracts/aiComposerContract';
import { isCanonicalPageRequest } from '../../supabase/functions/_shared/canonicalPageRequest';

const home = 'export default function Start(){return <main className="ut-body bg-background"><nav data-ut-variant="navbar:minimal-dark">Northstar</nav><h1>Northstar</h1><footer data-ut-variant="footer:columns">Northstar</footer></main>}';
const files = {
  '/src/pages/Start.tsx': home,
  '/src/index.css': ':root { --ut-font-body: var(--ut-font-sans); }',
  '/package.json': JSON.stringify({ dependencies: { react: '^18.3.1' } }),
  '/.unison/site-bundle-snapshot.json': JSON.stringify({ pageRegistry: { homePageId: 'start', pages: { start: { title: 'Home', path: '/', filePath: '/src/pages/Start.tsx' } } } }),
};
const page = { pageId: 'contact', title: 'Contact', route: '/contact', filePath: '/src/pages/Contact.tsx', role: 'contact', pageType: 'contact' as const };
const addition = { type: 'add_page' as const, pageId: 'contact', title: 'Contact', route: '/contact', pageType: 'contact' as const };
const source = 'export default function Contact(){return <><nav data-ut-variant="navbar:minimal-dark">Northstar</nav><main className="ut-body bg-background"><h1>Contact</h1></main><footer data-ut-variant="footer:columns">Northstar</footer></>}';

describe('Affinity same-site page generation', () => {
  beforeEach(() => vi.clearAllMocks());
  it('invokes generate-page, inherits the registered Home, and returns source plus topology without replacing Home', async () => {
    vi.mocked(runBuilderTurn).mockResolvedValue({ data: { content: JSON.stringify({ summary: 'Prepared Contact', fileOps: [{ type: 'create', path: page.filePath, content: source }] }) }, error: null });
    const result = await createUnisonAppBuilder().generatePages({ operationId: 'new-contact', baseRevisionId: 'r1', currentFiles: files, businessName: 'Northstar', pages: [page], existingRoutes: [{ title: 'Home', route: '/' }] });
    expect(result.status).toBe('ready-for-commit');
    const [input, options] = vi.mocked(runBuilderTurn).mock.calls[0];
    expect(options?.functionName).toBe('generate-page');
    const request = JSON.parse(String(input.messages[0].content));
    expect(request.brief).toContain('navbar:minimal-dark');
    expect(request.brief).toContain('footer:columns');
    expect(request.brief).toContain('ut-body');
    expect(result.candidateFiles['/src/pages/Start.tsx']).toBe(home);
    expect(result.changeSet?.fileOps.map(op => op.path)).toEqual([page.filePath]);
    expect(result.changeSet?.routeOps).toContainEqual(expect.objectContaining(addition));
    expect(result.baseRevisionId).toBe('r1');
  });
  it('allows a requested new page plan but still refuses unrelated source changes', () => {
    const request: AIComposerRequest = { task: 'builder_source_edit', page, instruction: 'Generate a Contact page', brief: '', files, routes: [], sourceTargets: ['/src/pages/Start.tsx'] };
    const response = { summary: '', routeOps: [addition], fileOps: [{ type: 'create' as const, path: page.filePath, content: source }] };
    expect(composerProposalViolations(request, response)).toEqual([]);
    expect(composerProposalViolations({ ...request, instruction: 'Change the heading' }, response)).toContain('add_page:contact: route operation is not approved for this request');
    expect(composerProposalViolations(request, { ...response, fileOps: [{ type: 'replace', path: '/src/pages/Other.tsx', content: source }] })).toContain('/src/pages/Other.tsx: outside this request\'s source targets');
  });
  it('rejects arbitrary edits and malformed input at the page-only endpoint', () => {
    const request = { task: 'site_page_author', page, brief: '', files: {}, routes: [] };
    const body = { mode: 'site-page-author', messages: [{ role: 'user', content: JSON.stringify(request) }] };
    expect(isCanonicalPageRequest(body)).toBe(true);
    expect(isCanonicalPageRequest({ ...body, mode: 'builder-source-edit' })).toBe(false);
    expect(isCanonicalPageRequest({ ...body, messages: [{ role: 'user', content: '{bad' }] })).toBe(false);
    expect(isCanonicalPageRequest({ ...body, messages: [{ role: 'user', content: JSON.stringify({ ...request, task: 'builder_source_edit' }) }] })).toBe(false);
  });
});