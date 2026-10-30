import { describe, expect, it, vi } from 'vitest';
vi.mock('@/services/builderBrainClient', () => ({ runBuilderTurn: vi.fn() }));
import { createSectionAuthoringInvoke, partitionPageSections } from '@/services/launch/sectionAuthoringInvoke';
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