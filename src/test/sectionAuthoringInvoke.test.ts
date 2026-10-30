import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/services/builderBrainClient', () => ({ runBuilderTurn: vi.fn() }));
import { clearSectionAuthoringCheckpoints, createSectionAuthoringInvoke, partitionPageSections, sectionPageBudgetMs, sectionSiteBudgetMs } from '@/services/launch/sectionAuthoringInvoke';
import { runComposerRepairLoop, type ComposerInvoke } from '@/services/builder/aiRepairLoop';
import type { AIComposerRequest } from '@/contracts/aiComposerContract';

const path = '/src/pages/Home.tsx';
const request: AIComposerRequest = {
  task: 'site_page_author', page: { role: 'home', title: 'Home', route: '/', filePath: path },
  brief: 'Keep all five products and the verified photo.', files: { [path]: 'export default function Home(){return <main>Baseline</main>}' }, routes: [],
};
const turn = { mode: 'site-page-author', messages: [{ role: 'user', content: JSON.stringify(request) }], gatewayOptions: { selectedModelId: 'gemini', maxTokens: 10000 } };
const reply = (source: string) => ({ data: { content: JSON.stringify({ summary: 'Batch', fileOps: [{ type: 'replace', path, content: source }] }) }, error: null });

describe('bounded page-section authoring', () => {
  beforeEach(() => clearSectionAuthoringCheckpoints());
  it('sizes a page for all batches and site for Home plus parallel waves', () => {
    const order = ['hero', 'services', 'gallery', 'testimonials', 'cta'];
    expect(sectionPageBudgetMs(order)).toBe(255_000);
    expect(sectionSiteBudgetMs([order, order, order, order, order])).toBe(585_000);
  });
  it('resumes only the failed batch across invoke instances without changing accepted files', async () => {
    const first = 'export default function Home(){return <main><section>Paid hero</section></main>}';
    const final = first.replace('</main>', '<section>Contact</section></main>');
    const failure = { status: 500, message: 'timeout' };
    const invoke = vi.fn().mockResolvedValueOnce(reply(first)).mockResolvedValueOnce({ data: null, error: failure }).mockResolvedValueOnce(reply(final));
    const order = ['hero', 'services', 'gallery', 'contact'];
    expect((await createSectionAuthoringInvoke(invoke as ComposerInvoke, order)(turn)).error).toBe(failure);
    expect(request.files[path]).toContain('Baseline');
    const recovered = await createSectionAuthoringInvoke(invoke as ComposerInvoke, order)(turn);
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(JSON.parse(invoke.mock.calls[2][0].messages[0].content).files[path]).toBe(first);
    expect(JSON.parse(recovered.data?.content as string).fileOps[0].content).toBe(final);
  });
  it('does not reuse checkpoints when input source changes', async () => {
    const first = 'export default function Home(){return <main>Paid hero</main>}';
    const invoke = vi.fn().mockResolvedValueOnce(reply(first)).mockResolvedValueOnce({ data: null, error: { status: 500 } }).mockResolvedValue(reply(first));
    const order = ['hero', 'services', 'gallery', 'contact'];
    await createSectionAuthoringInvoke(invoke as ComposerInvoke, order)(turn);
    const changed = { ...turn, messages: [{ role: 'user', content: JSON.stringify({ ...request, files: { [path]: 'export default function Home(){return <main>New baseline</main>}' } }) }] };
    await createSectionAuthoringInvoke(invoke as ComposerInvoke, order)(changed);
    expect(JSON.parse(invoke.mock.calls[2][0].messages[0].content).instruction).toContain('1/2');
  });
  it.each(['<section>fragment</section>', '<<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE', 'export default function Home(){return <main>'])('rejects incomplete or unapplied source: %s', async source => {
    const invoke = vi.fn().mockResolvedValue(reply(source));
    const result = await createSectionAuthoringInvoke(invoke as ComposerInvoke, ['hero', 'services', 'contact'])(turn);
    expect(result.error).toMatchObject({ status: 400 });
    expect(invoke).toHaveBeenCalledOnce();
  });
  it('keeps completed sections immutable and leaves failed batch out of the checkpoint', async () => {
    const first = 'export default function Home(){return <main><section>Five products</section></main>}';
    const corrupt = first.replace('Five products', 'One product');
    const final = first.replace('</main>', '<section>Gallery</section></main>');
    const invoke = vi.fn().mockResolvedValueOnce(reply(first)).mockResolvedValueOnce(reply(corrupt)).mockResolvedValueOnce(reply(final));
    const order = ['hero', 'services', 'gallery', 'contact'];
    const result = await createSectionAuthoringInvoke(invoke as ComposerInvoke, order)(turn);
    expect(result.error).toMatchObject({ status: 400, message: expect.stringContaining('completed section') });
    await createSectionAuthoringInvoke(invoke as ComposerInvoke, order)(turn);
    expect(JSON.parse(invoke.mock.calls[2][0].messages[0].content).files[path]).toBe(first);
  });
  it('finishes three bounded batches beyond the old 150-second page cap', async () => {
    let clock = 0;
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => clock);
    let source = 'export default function Home(){return <main></main>}';
    const invoke = vi.fn(async (_input: unknown, options?: { timeoutMs?: number }) => { expect(options?.timeoutMs).toBe(65_000); clock += 59_000; source = source.replace('</main>', `<section>${clock}</section></main>`); return reply(source); });
    try {
      const order = ['hero', 'services', 'gallery', 'testimonials', 'cta'];
      const result = await createSectionAuthoringInvoke(invoke as ComposerInvoke, order)(turn, { timeoutMs: sectionPageBudgetMs(order) });
      expect(result.error).toBeNull();
      expect(invoke).toHaveBeenCalledTimes(3);
      expect(clock).toBe(177_000);
    } finally { spy.mockRestore(); }
  });
  it('preserves repeated sections and their full order without reducing content', () => {
    expect(partitionPageSections(['navbar', 'hero', 'services', 'services', 'gallery', 'cta', 'footer']))
      .toEqual([['hero', 'services'], ['services', 'gallery'], ['cta']]);
  });
  it('carries the completed source into the next disjoint batch with the same owner settings', async () => {
    const first = 'export default function Home(){return <main><section>Hero</section><section>Products 1 2 3 4 5</section></main>}';
    const final = first.replace('</main>', '<section>Gallery</section><section>Contact</section></main>');
    const invoke = vi.fn().mockResolvedValueOnce(reply(first)).mockResolvedValueOnce(reply(final));
    const result = await createSectionAuthoringInvoke(invoke as ComposerInvoke, ['hero', 'services', 'gallery', 'contact'])(turn, { timeoutMs: 150000 });
    const requests = invoke.mock.calls.map(([input]) => JSON.parse(input.messages[0].content));
    expect(requests[0].instruction).toContain('hero, services');
    expect(requests[1].instruction).toContain('gallery, contact');
    expect(requests[1].files[path]).toBe(first);
    expect(requests[1].brief).toBe(request.brief);
    expect(invoke.mock.calls[0][0].gatewayOptions).toMatchObject({ selectedModelId: 'gemini', maxTokens: 10000 });
    expect(JSON.parse(result.data?.content as string).fileOps[0].content).toBe(final);
  });
  it('validates the assembled page, never accepting an incomplete first batch', async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce(reply('export default function Home(){return <main>Hero</main>}'))
      .mockResolvedValueOnce(reply('export default function Home(){return <main>Hero Contact</main>}'));
    const pageCheck = vi.fn((_path: string, source: string) => source.includes('Contact') ? [] : ['Contact missing']);
    const result = await runComposerRepairLoop({ request, baseFiles: request.files, pageCheck, invoke: createSectionAuthoringInvoke(invoke as ComposerInvoke, ['hero', 'services', 'gallery', 'contact']) });
    expect(result.ok).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(pageCheck.mock.calls.every(([, source]) => source.includes('Contact'))).toBe(true);
  });
  it.each([402, 403, 429, 500])('stops on status %s without replaying paid work', async status => {
    const error = { status, message: status === 500 ? 'Gemini timeout' : 'Provider stopped' };
    const invoke = vi.fn().mockResolvedValueOnce(reply('export default function Home(){return <main>Paid first batch</main>}')).mockResolvedValueOnce({ data: null, error });
    const result = await createSectionAuthoringInvoke(invoke as ComposerInvoke, ['hero', 'services', 'gallery', 'contact', 'cta'])(turn);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(result.error).toBe(error);
    expect(result.data).toBeNull();
  });
  it('refuses a chunk that changes a different page', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { content: JSON.stringify({ summary: 'Wrong page', fileOps: [{ type: 'replace', path: '/src/pages/Shop.tsx', content: 'export default function Shop(){return <main/>}' }] }) }, error: null });
    const result = await createSectionAuthoringInvoke(invoke as ComposerInvoke, ['hero', 'services', 'gallery'])(turn);
    expect(result.error).toMatchObject({ status: 400 });
    expect(invoke).toHaveBeenCalledOnce();
  });
});