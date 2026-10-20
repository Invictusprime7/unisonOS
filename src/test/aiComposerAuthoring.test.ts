import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('@/services/builderBrainClient', () => ({ runBuilderTurn: vi.fn() }));

import { repairBuilderCandidate, runComposerRepairLoop } from '@/services/builder/aiRepairLoop';
import type { AICandidateChangeSet } from '@/services/builder/aiCandidateChangeSet';
import { authorSitePages, orderAuthoringPages } from '@/services/launch/siteAuthoringOrchestrator';
import { planSiteComposition } from '@/services/composition';

const base = {
  '/src/pages/Home.tsx': 'export default function Home(){return <main>Old</main>}',
  '/src/pages/About.tsx': 'export default function About(){return <main>About</main>}',
};
const good = (path: string, text: string) => ({ data: { content: JSON.stringify({ summary: text, fileOps: [{ type: 'replace', path, content: `export default function P(){return <main>${text}</main>}` }] }) }, error: null });
const bad = (path: string) => ({ data: { content: JSON.stringify({ summary: 'x', fileOps: [{ type: 'replace', path, content: "import X from './Nope';\nexport default function P(){return <X/>}" }] }) }, error: null });
const request = { task: 'site_page_author' as const, page: { role: 'home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx' }, brief: 'b', files: base, routes: [] };

describe('AI composer repair loop', () => {
  it('gives full-page prompts the minimum viable generation window', async () => {
    const pages = ['Home', 'About', 'Contact', 'Gallery', 'Shop'].map((title, index) => ({ pageId: title.toLowerCase(), title, route: index ? `/${title.toLowerCase()}` : '/', filePath: `/src/pages/${title}.tsx`, role: title.toLowerCase() }));
    const invoke = vi.fn(async (input: { messages: Array<{ content: string }> }, _options: { timeoutMs: number }) => {
      const request = JSON.parse(input.messages[0].content);
      return good(request.page.filePath, request.page.title);
    });
    const result = await authorSitePages({ pages, homePageId: 'home', designContext: null, businessName: 'Budget test', files: base, concurrency: 2, budgetMs: 180_000, now: () => 100_000, invoke: invoke as never, commitPage: async files => ({ files }) });
    expect(invoke.mock.calls[0][1].timeoutMs).toBe(120_000);
    expect(result.outcomes).toHaveLength(5);
    expect(result.outcomes.every(outcome => outcome.status === 'authored')).toBe(true);
  });
  it('shares one deadline across repair attempts and forwards the shorter server budget', async () => {
    let clock = 100_000;
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => clock);
    const invoke = vi.fn().mockImplementationOnce(async () => { clock += 30_000; return bad('/src/pages/Home.tsx'); }).mockResolvedValueOnce(good('/src/pages/Home.tsx', 'Fixed'));
    try {
      expect((await runComposerRepairLoop({ request, baseFiles: base, invoke: invoke as never, timeoutMs: 90_000 })).ok).toBe(true);
      expect(invoke.mock.calls[0][1].timeoutMs).toBe(90_000);
      expect(invoke.mock.calls[1][1].timeoutMs).toBe(60_000);
      expect(invoke.mock.calls[1][0].gatewayOptions.timeoutMs).toBe(55_000);
    } finally { spy.mockRestore(); }
  });
  it('uses the selected model settings on the first Composer generation', async () => {
    const invoke = vi.fn().mockResolvedValue(good('/src/pages/Home.tsx', 'First-pass edit'));
    const gatewayOptions = {
      selectedModelId: 'openai/gpt-4.1',
      reasoningEffort: 'high',
      timeoutMs: 110_000,
      autoModelSelection: false,
      maxTokens: 32_768,
    };

    const result = await runComposerRepairLoop({
      request,
      baseFiles: base,
      invoke: invoke as never,
      timeoutMs: 420_000,
      gatewayOptions,
    });

    expect(result.ok).toBe(true);
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke.mock.calls[0][0].gatewayOptions).toEqual(gatewayOptions);
  });

  it('forwards one guest operation ID across the initial and repair Composer requests', async () => {
    const guestDemoOperationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const invoke = vi.fn()
      .mockResolvedValueOnce(bad('/src/pages/Home.tsx'))
      .mockResolvedValueOnce(good('/src/pages/Home.tsx', 'Repaired'));

    const result = await runComposerRepairLoop({
      request,
      baseFiles: base,
      invoke: invoke as never,
      guestDemoOperationId,
    });

    expect(result.ok).toBe(true);
    expect(invoke.mock.calls).toHaveLength(2);
    expect(invoke.mock.calls.map(([input]) => input.runContext?.operationId)).toEqual([
      guestDemoOperationId,
      guestDemoOperationId,
    ]);
  });

  it("skips a repair turn when less than a minute is left", async () => {
    let clock = 100_000;
    const spy = vi.spyOn(Date, "now").mockImplementation(() => clock);
    const invoke = vi.fn().mockImplementationOnce(async () => { clock += 45_000; return bad("/src/pages/Home.tsx"); });
    try {
      const result = await runComposerRepairLoop({ request, baseFiles: base, invoke: invoke as never, timeoutMs: 90_000 });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("gates_exhausted");
      expect(invoke).toHaveBeenCalledTimes(1);
    } finally { spy.mockRestore(); }
  });
  it('does not start another provider request after the shared repair budget expires', async () => {
    let clock = 100_000;
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => clock);
    const invoke = vi.fn(async () => { clock += 89_000; return bad('/src/pages/Home.tsx'); });
    try {
      const result = await runComposerRepairLoop({ request, baseFiles: base, invoke: invoke as never, timeoutMs: 90_000 });
      expect(result.ok).toBe(false);
      expect(result.errors.join(' ')).toContain('shared time budget');
      expect(invoke).toHaveBeenCalledOnce();
    } finally { spy.mockRestore(); }
  });
  it('accepts on first pass', async () => {
    const invoke = vi.fn().mockResolvedValue(good('/src/pages/Home.tsx', 'New'));
    const r = await runComposerRepairLoop({ request, baseFiles: base, invoke: invoke as never });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(1);
    expect(r.prepared!.nextFiles['/src/pages/Home.tsx']).toContain('New');
  }, 20000);

  it('repairs with diagnostics, then accepts', async () => {
    const invoke = vi.fn().mockResolvedValueOnce(bad('/src/pages/Home.tsx')).mockResolvedValueOnce(good('/src/pages/Home.tsx', 'Fixed'));
    const r = await runComposerRepairLoop({ request, baseFiles: base, invoke: invoke as never });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
    const second = JSON.parse(invoke.mock.calls[1][0].messages[0].content);
    expect(second.task).toBe('site_page_repair');
    expect(second.diagnostics[0]).toMatch(/does not resolve/);
  }, 20000);

  it('accumulates valid files across repair attempts', async () => {
    const first = {
      data: {
        content: JSON.stringify({
          summary: 'Card plus broken home',
          fileOps: [
            { type: 'create', path: '/src/project-components/Card.tsx', content: 'export default function Card(){return <article>Card</article>}' },
            { type: 'replace', path: '/src/pages/Home.tsx', content: "import Missing from './Missing'; export default function Home(){return <Missing/>}" },
          ],
        }),
      },
      error: null,
    };
    const second = {
      data: {
        content: JSON.stringify({
          summary: 'Repair home only',
          fileOps: [{
            type: 'replace',
            path: '/src/pages/Home.tsx',
            content: "import Card from '../project-components/Card'; export default function Home(){return <main><Card/></main>}",
          }],
        }),
      },
      error: null,
    };
    const invoke = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    const result = await runComposerRepairLoop({ request, baseFiles: base, invoke: invoke as never });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.prepared!.nextFiles['/src/project-components/Card.tsx']).toContain('<article>Card</article>');
    expect(result.prepared!.nextFiles['/src/pages/Home.tsx']).toContain("../project-components/Card");
    const repairRequest = JSON.parse(invoke.mock.calls[1][0].messages[0].content);
    expect(repairRequest.files['/src/project-components/Card.tsx']).toContain('<article>Card</article>');
  }, 20000);

  it('retains typed route intent while repairing page source', async () => {
    const first = {
      data: {
        content: JSON.stringify({
          summary: 'Add pricing page',
          fileOps: [{
            type: 'create', path: '/src/pages/Pricing.tsx',
            content: "import Missing from './Missing'; export default function Pricing(){return <Missing/>}",
          }],
          routeOps: [{ type: 'add_page', pageId: 'pricing', title: 'Pricing', route: '/pricing', pageType: 'pricing' }],
        }),
      },
      error: null,
    };
    const second = {
      data: {
        content: JSON.stringify({
          summary: 'Repair pricing source',
          fileOps: [{
            type: 'create', path: '/src/pages/Pricing.tsx',
            content: 'export default function Pricing(){return <main>Pricing</main>}',
          }],
        }),
      },
      error: null,
    };
    const invoke = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    const result = await runComposerRepairLoop({ request, baseFiles: base, invoke: invoke as never });

    expect(result.ok).toBe(true);
    expect(result.prepared!.build.changeSet.routeOps).toEqual([
      { type: 'add_page', pageId: 'pricing', title: 'Pricing', route: '/pricing', pageType: 'pricing' },
    ]);
    const repairRequest = JSON.parse(invoke.mock.calls[1][0].messages[0].content);
    expect(JSON.parse(repairRequest.previousResponse).routeOps).toEqual(result.prepared!.build.changeSet.routeOps);
  }, 20000);

  it('gives up after 3 attempts', async () => {
    const invoke = vi.fn().mockResolvedValue(bad('/src/pages/Home.tsx'));
    const r = await runComposerRepairLoop({ request, baseFiles: base, invoke: invoke as never });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('gates_exhausted');
    expect(invoke).toHaveBeenCalledTimes(3);
  }, 20000);

  it('stops on credit errors without retrying', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: { context: { status: 402 } } });
    const r = await runComposerRepairLoop({ request, baseFiles: base, invoke: invoke as never });
    expect(r.reason).toBe('credits');
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

describe('site authoring orchestrator', () => {
  const pages = [
    { pageId: 'about', title: 'About', route: '/about', filePath: '/src/pages/About.tsx', role: 'about' },
    { pageId: 'home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx', role: 'home' },
  ];

  it('orders Home first deterministically', () => {
    expect(orderAuthoringPages(pages, 'home').map((p) => p.pageId)).toEqual(['home', 'about']);
  });

  it('commits each accepted page and keeps baseline for failures', async () => {
    const invoke = vi.fn(async (input: { messages: Array<{ content: string }> }) => {
      const req = JSON.parse(input.messages[0].content);
      return req.page.role === 'home' ? good('/src/pages/Home.tsx', 'AI Home') : bad('/src/pages/About.tsx');
    });
    const commitPage = vi.fn(async (
      next: Record<string, string>,
      _page: unknown,
      _beforeFiles: Record<string, string>,
      _candidate: AICandidateChangeSet,
    ) => ({ files: next, revisionId: 'rev' }));
    const r = await authorSitePages({ pages, homePageId: 'home', designContext: null, businessName: 'B', files: base, commitPage, invoke: invoke as never });
    expect(commitPage).toHaveBeenCalledTimes(1);
    expect(commitPage.mock.calls[0][3]).toMatchObject({
      baseRevisionId: undefined,
      targetPages: ['/src/pages/Home.tsx'],
    });
    expect(commitPage.mock.calls[0][3].fileOps).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'replace', path: '/src/pages/Home.tsx' }),
    ]));
    expect(r.files['/src/pages/Home.tsx']).toContain('AI Home');
    expect(r.files['/src/pages/About.tsx']).toBe(base['/src/pages/About.tsx']);
    expect(r.outcomes.map((o) => o.status)).toEqual(['authored', 'kept-baseline']);
  }, 30000);

  it('keeps planned route operations on Builder-authored page candidates', async () => {
    const page = { pageId: 'focus', title: 'Focus', route: '/focus', filePath: '/src/pages/Focus.tsx', role: 'custom' };
    const routeOp = { type: 'add_page' as const, pageId: 'focus', title: 'Focus', route: '/focus', pageType: 'custom' as const, showInNav: true };
    let committedCandidate: AICandidateChangeSet | undefined;
    const r = await authorSitePages({
      pages: [page],
      designContext: null,
      businessName: 'B',
      files: base,
      candidateOrigin: 'builder',
      initialRouteOps: [routeOp],
      invoke: vi.fn(async (input: { messages: Array<{ content: string }> }) => {
        const req = JSON.parse(input.messages[0].content);
        return good(req.page.filePath, 'Focus page');
      }) as never,
      commitPage: async (files, _page, _before, candidate) => {
        committedCandidate = candidate;
        return { files, revisionId: 'revision-focus' };
      },
    });

    expect(r.outcomes[0].status).toBe('authored');
    expect(committedCandidate?.provenance.origin).toBe('builder');
    expect(committedCandidate?.routeOps).toContainEqual(routeOp);
  });

  it('carries the accepted Home language into a distinct loose-fit fashion page', async () => {
    const fashionPages = [
      { pageId: 'story', title: 'Our Story', route: '/our-story', filePath: '/src/pages/About.tsx', role: 'brand-story' },
      { pageId: 'home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx', role: 'home' },
    ];
    const homeSource = `
      import { ArrowRight } from 'lucide-react';
      export default function Home(){return <main>
        <nav data-ut-variant="navbar:editorial-minimal" className="ut-surface text-foreground" />
        <section data-ut-variant="hero:fashion-cinematic" className="ut-section text-left">
          <h1 className="ut-hero">STYLE THAT SPEAKS FOR ITSELF.</h1><ArrowRight />
        </section>
      </main>}`;
    const storySource = `
      import { ArrowRight } from 'lucide-react';
      export default function Story(){return <main>
        <nav data-ut-variant="navbar:editorial-minimal" className="ut-surface text-foreground" />
        <section data-ut-variant="hero:editorial-intro" className="ut-section text-center">
          <p className="ut-eyebrow">ABOUT OUR TEAM</p><h1 className="ut-title">OUR STORY</h1><ArrowRight />
        </section>
      </main>}`;
    const requests: Array<Record<string, unknown>> = [];
    const invoke = vi.fn(async (input: { messages: Array<{ content: string }> }) => {
      const req = JSON.parse(input.messages[0].content);
      requests.push(req);
      const path = req.page.filePath;
      const content = req.page.role === 'home' ? homeSource : storySource;
      return { data: { content: JSON.stringify({ summary: `Authored ${req.page.title}`, fileOps: [{ type: 'replace', path, content }] }) }, error: null };
    });
    const commitPage = vi.fn(async (next: Record<string, string>) => ({ files: next, revisionId: 'rev' }));

    const result = await authorSitePages({
      pages: fashionPages,
      homePageId: 'home',
      designContext: null,
      businessName: 'Dream Fashion',
      files: base,
      commitPage,
      invoke: invoke as never,
    });

    expect(result.outcomes.map((outcome) => outcome.status)).toEqual(['authored', 'authored']);
    expect(requests[1].brief).toContain('HOMEPAGE VISUAL LANGUAGE');
    expect(requests[1].brief).toContain('navbar: navbar:editorial-minimal');
    expect(requests[1].brief).toContain('Select a distinct role-appropriate hero');
    expect(requests[0].brief).toContain('never a whitelist');
    expect(result.files['/src/pages/Home.tsx']).toContain('hero:fashion-cinematic');
    expect(result.files['/src/pages/About.tsx']).toContain('hero:editorial-intro');
    expect(result.files['/src/pages/About.tsx']).toContain('navbar:editorial-minimal');
  }, 30000);

  it('uses the sealed contract compositionPlan instead of replanning', async () => {
    const sealed = planSiteComposition('restaurant', pages.map((p) => ({ pageId: p.pageId, role: p.role })), 'sealed-seed');
    sealed.pages = sealed.pages.map((p) => ({ ...p, compositionKey: `SEALED-${p.pageId}` }));
    const requests: Array<Record<string, unknown>> = [];
    const invoke = vi.fn(async (input: { messages: Array<{ content: string }> }) => {
      const req = JSON.parse(input.messages[0].content);
      requests.push(req);
      return bad(req.page.filePath);
    });
    await authorSitePages({
      pages, homePageId: 'home', designContext: null, businessName: 'B', files: base,
      commitPage: vi.fn(), invoke: invoke as never, compositionPlan: sealed,
    });
    const home = requests.find((r) => (r.page as { role: string }).role === 'home');
    expect(home?.brief).toContain('SEALED-home');
  }, 30000);

  it('pauses remaining pages after a credit error', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: { context: { status: 402 } } });
    const r = await authorSitePages({ pages, designContext: null, businessName: 'B', files: base, commitPage: vi.fn(), invoke: invoke as never });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(r.outcomes.map((o) => o.status)).toEqual(['kept-baseline', 'skipped']);
  });

  it('uses the same mandatory knowledge policy for a Builder repair request', async () => {
    const invoke = vi.fn().mockResolvedValue(good('/src/pages/Home.tsx', 'Recovered'));
    await repairBuilderCandidate({
      rawFiles: { '/src/pages/Home.tsx': 'bad source' },
      failed: { errors: ['Import failed'], ok: false } as never,
      baseFiles: base,
      activeFilePath: '/src/pages/Home.tsx',
      prompt: 'Create an Aria-inspired editorial portfolio home',
      invoke: invoke as never,
    });
    const sent = JSON.parse(invoke.mock.calls[0][0].messages[0].content);
    expect(sent.brief).toContain('never a whitelist');
    expect(sent.brief).toContain('ARIA');
    expect(sent.brief).toContain('not a mandatory recipe');
  });
});

describe('AI composer contract mirror', () => {
  it('client and edge contracts are byte-identical', () => {
    const a = readFileSync(resolve(process.cwd(), 'src/contracts/aiComposerContract.ts'), 'utf8');
    const b = readFileSync(resolve(process.cwd(), 'supabase/functions/_shared/aiComposerContract.ts'), 'utf8');
    expect(a).toBe(b);
  });
});
