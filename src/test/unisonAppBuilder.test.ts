import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { compileResolvedSiteDesignContext } from '@/services/launch/resolvedSiteDesignContext';
import { createUnisonAppBuilder } from '@/services/app-builder/UnisonAppBuilder';
import { APP_BUILDER_PROTOCOL_VERSION, type AppBuildContract } from '@/services/app-builder/appBuilderContracts';
import type { ComposerLoopResult } from '@/services/builder/aiRepairLoop';
import { listContentTypes } from '@/services/cmsRecordService';
import { saveAppBuilderAISettings } from '@/services/app-builder/appBuilderAISettings';
import { buildWizardAggregatedRegistryContext } from '@/services/launch/wizardRegistryAggregation';
import { deriveDesignSourceSelection } from '@/services/app-builder/appBuilderContracts';

vi.mock('@/services/cmsRecordService', () => ({ listContentTypes: vi.fn(async () => []) }));

const baseFiles = {
  '/src/pages/Home.tsx': 'export default function Home(){return <main>Before</main>}',
  '/package.json': JSON.stringify({ dependencies: { react: '^18.3.1' } }),
};

function contract(): AppBuildContract {
  const designContext = compileResolvedSiteDesignContext({
    designSeed: 'app-builder-test',
    businessModel: 'general' as never,
    industry: 'salon',
    roles: ['home'],
  });
  return {
    protocolVersion: APP_BUILDER_PROTOCOL_VERSION,
    identity: { projectId: 'project-1', businessId: 'business-1', siteId: 'site-1', systemType: 'website' },
    topology: {
      sitePlan: {
        siteId: 'topology-1', industry: 'salon', businessName: 'Northstar', homePageId: 'home',
        pages: [{ id: 'home', name: 'home', title: 'Home', route: '/', role: 'home', filePath: '/src/pages/Home.tsx', visibleInNav: true, isHome: true, generatedBy: 'wizard' }],
        navItems: ['home'], funnels: [], redirects: [], generatedAt: '2026-09-30T12:00:00.000Z',
      },
      pageRegistry: { pages: {}, funnels: {}, homePageId: 'home', version: 1 },
    },
    business: {
      industry: 'salon', businessName: 'Northstar', goals: [], intents: [], capabilities: [], bindingGuide: '',
      registeredComponents: [], intentBindings: [], configuredBusinessFields: [], parameters: {}, businessProfile: { businessName: 'Northstar' },
      branding: {
        version: '1.0',
        brandMark: {
          source: { kind: 'business-profile', field: 'logoUrl' },
          placements: [{ artifactId: 'navbar', slotId: 'navbar.brand' }, { artifactId: 'footer', slotId: 'footer.brand' }],
          image: { objectFit: 'contain', preserveAspectRatio: true, maxWidthPx: 180, maxHeightPx: 48 },
          accessibleName: 'Northstar', missingAssetFallback: { kind: 'text-wordmark', text: 'Northstar' },
        },
        logoCloud: { artifactId: 'logo-cloud', source: 'owner-authored', minimumItems: 4, emptyBehavior: 'hide_section', generatedEntriesAllowed: false },
      },
    },
    design: {
      seed: 'app-builder-test', themePresetId: 'editorial', themeTokens: {} as never,
      artDirection: {} as never, resolvedSiteDesignContext: designContext,
      uiFoundation: {} as never, registryContext: {} as never,
      compositionPlan: { industryId: 'salon', seed: 'app-builder-test', pages: [] },
      sourceSelection: { implementationIds: [], portableRecipeIds: [], primitiveFamilyIds: [], experiencePrimitiveIds: [], pageCompositionIds: [] },
    },
    runtime: {
      framework: 'react-vite', language: 'typescript', styling: 'tailwind',
      protectedPaths: [], approvedDependencies: [], approvedExperienceCapabilities: [],
    },
  };
}

const createTestBuilder = (dependencies: Parameters<typeof createUnisonAppBuilder>[0] = {}) =>
  createUnisonAppBuilder({ loadContentTypes: async () => [], ...dependencies });

describe('UnisonAppBuilder facade', () => {
  it('keeps the union design context out of page authoring turns', async () => {
    let globalContext = 'not captured';
    let pageContext = '';
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => {
      globalContext = input.runtimeContext ?? '';
      pageContext = input.runtimeContextForPage?.('home') ?? '';
      return { files: input.files, outcomes: [] };
    });
    await createTestBuilder({ authorSite, runComposer: vi.fn() }).generate({
      operationId: 'page-scoped-design-context', contract: contract(), initialFiles: baseFiles,
      entryPoint: '/src/main.tsx', baseRevisionId: null, budgetMs: 1,
    });

    expect(globalContext).toBe('');
    expect(pageContext).toContain('PERSISTABLE SECTION CONTRACT');
    expect(authorSite).toHaveBeenCalledOnce();
  });

  it('reports exhausted provider credits instead of accepting unchanged preview material', async () => {
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({
      files: input.files,
      outcomes: [{ page: input.pages[0], status: 'kept-baseline' as const, reason: 'credits' as const, attempts: 1,
        errors: ['AI request failed (credits): Payment required. Please add credits to your OpenAI account.'] }],
    }));
    const runComposer = vi.fn();
    const result = await createTestBuilder({ authorSite, runComposer }).generate({
      operationId: 'lowtide-credit-failure', contract: contract(), initialFiles: baseFiles,
      entryPoint: '/src/main.tsx', baseRevisionId: null,
    });
    expect(result.candidate.status).toBe('rejected');
    expect(result.stopReason).toBe('provider-error');
    expect(result.candidate.diagnostics).toContain('AI request failed (credits): Payment required. Please add credits to your OpenAI account.');
    expect(runComposer).not.toHaveBeenCalled();
  });

  it.each([true, false])('rechecks preview dependencies after closure repair (standalone: %s)', async (standalone) => {
    const previewFiles = { ...baseFiles,
      '/src/pages/Home.tsx': 'import Preview from "../marketplace/selectedPreview"; export default function Home(){return <Preview/>}',
      '/src/marketplace/selectedPreview.tsx': 'export default function Preview(){return <main>Lowtide House</main>}',
    };
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({
      files: input.files, outcomes: [{ page: input.pages[0], status: 'kept-baseline' as const, reason: 'gates_exhausted' as const, attempts: 1, errors: ['Still imports preview'] }],
    }));
    const repairedFiles = standalone
      ? { ...previewFiles, '/src/pages/Home.tsx': 'export default function Home(){return <main>Standalone Lowtide House</main>}' }
      : previewFiles;
    const runComposer = vi.fn(async (): Promise<ComposerLoopResult> => ({
      ok: true, reason: 'accepted', attempts: 1, errors: [],
      prepared: { ok: true, nextFiles: repairedFiles, errors: [],
        gates: { passed: true, failures: [], advisories: [] },
        build: { changeSet: { id: 'repair', fileOps: [], routeOps: [], targetPages: ['home'], attempt: 1,
          provenance: { origin: 'repair', knowledgeVersion: 'test' } }, candidateFiles: repairedFiles, refused: [] } },
    }));
    saveAppBuilderAISettings({ selectedModelId: 'google/gemini-3.8-flash', reasoningEffort: 'high',
      timeoutMs: 110000, maxTokens: 32768, autoModelSelection: false, streamResponse: true });
    const result = await createTestBuilder({ authorSite, runComposer }).generate({
      operationId: 'lowtide-preview-repair', contract: contract(), initialFiles: previewFiles,
      entryPoint: '/src/main.tsx', baseRevisionId: null,
      runtimeContext: 'Marketplace material must become standalone buyer-owned pages.',
      pageCheck: (_path, source) => source.includes('marketplace/selectedPreview') ? ['Remove preview-only selectedPreview dependency'] : [],
    });
    expect(runComposer).toHaveBeenCalledOnce();
    expect(authorSite.mock.calls[0]?.[0].gatewayOptions).toMatchObject({
      selectedModelId: 'google/gemini-3.8-flash', reasoningEffort: 'high', timeoutMs: 110000, maxTokens: 32768,
    });
    expect(runComposer).toHaveBeenCalledWith(expect.objectContaining({ gatewayOptions: authorSite.mock.calls[0]?.[0].gatewayOptions }));
    const repair = runComposer.mock.calls[0] as unknown as [{ request: { diagnostics: string[]; runtimeContext: string } }];
    expect(repair[0].request.diagnostics.some(message => message.includes('Remove preview-only selectedPreview dependency'))).toBe(true);
    expect(repair[0].request.runtimeContext).toContain('Marketplace material must become standalone buyer-owned pages.');
    expect(result.candidate.status).toBe(standalone ? 'ready-for-commit' : 'rejected');
    expect(result.candidateFiles['/src/pages/Home.tsx'].includes('selectedPreview')).toBe(!standalone);
  });

  it('stops before inference when the edited source exceeds its budget', async () => {
    const runComposer = vi.fn();
    const result = await createTestBuilder({ runComposer }).edit({
      operationId: 'missing-source', baseRevisionId: 'r1', currentFiles: {
        ...baseFiles,
        '/src/pages/Home.tsx': 'x'.repeat(150001),
      },
      instruction: 'Change navbar', page: { title: 'Home', route: '/', role: 'home', filePath: '/src/pages/Home.tsx' },
      sourceTargets: ['/src/pages/Home.tsx'],
    });
    expect(result.candidate.status).toBe('rejected');
    expect(result.candidate.attempts).toBe(0);
    expect(runComposer).not.toHaveBeenCalled();
    expect(result.changeSet).toBeUndefined();
  });
  it('checks page generation connector identity before invoking the page author', async () => {
    const authorSite = vi.fn();
    await expect(createTestBuilder({ authorSite: authorSite as never }).generatePages({
      operationId: 'wrong-project', baseRevisionId: 'r2', currentFiles: baseFiles,
      pages: [{ pageId: 'new', title: 'New', route: '/new', filePath: '/src/pages/New.tsx', role: 'custom', pageType: 'custom' }],
      businessName: 'Northstar', connectorContext: { projectId: 'p1', selection: { projectId: 'p2' } },
    })).rejects.toThrow('another project');
    expect(authorSite).not.toHaveBeenCalled();
  });
  it('rejects stale connector ownership before source authoring', async () => {
    const runComposer = vi.fn();
    const builder = createTestBuilder({ runComposer: runComposer as never });
    await expect(builder.edit({
      operationId: 'stale-connector', baseRevisionId: 'revision-2',
      currentFiles: baseFiles, instruction: 'Change this heading',
      page: { title: 'Home', route: '/', role: 'home', filePath: '/src/pages/Home.tsx' },
      sourceTargets: ['/src/pages/Home.tsx'],
      connectorContext: { projectId: 'project-1', selection: { revisionId: 'revision-1' } },
    })).rejects.toThrow('older revision');
    expect(runComposer).not.toHaveBeenCalled();
  });
  it('is the shared product boundary for Launcher generation and Builder source edits', () => {
    const launcher = readFileSync('src/services/launch/launchOrchestrator.ts', 'utf8');
    const builder = readFileSync('src/components/creatives/web-builder/AIBuilderPanel.tsx', 'utf8');

    expect(launcher).toContain('unisonAppBuilder.generate({');
    expect(builder).toContain('unisonAppBuilder.edit({');
    expect(builder).toContain('promptAnalysis.structuredDirective');
    expect(launcher).not.toContain('authorSitePages({');
    expect(builder).not.toContain('runComposerRepairLoop({');
    const orchestrator = readFileSync('src/services/app-builder/appBuilderOrchestrator.ts', 'utf8');
    expect(orchestrator).not.toContain('commitMutation');
    expect(orchestrator).not.toContain('persistAiCommit');
  });

  it('normalizes a semantic wizard binding before candidate closure validation', async () => {
    const appContract = contract();
    appContract.topology.pageRegistry.pages = {
      home: {
        pageId: 'home', title: 'Home', path: '/', filePath: '/src/pages/Home.tsx',
        pageType: 'home', pageRole: 'home', isHome: true,
      } as never,
    };
    appContract.business.bindingGuide = '- Page Home (/), slot navbar.icon-search: label "Search", marker data-ut-cta="icon.search", intent nav.goto, target /search';
    appContract.business.intentBindings = [{
      bindingId: 'bind-search', pageId: 'home', route: '/', elementKey: 'home.navbar.icon-search',
      sourceSection: 'navbar', sourceSlot: 'icon-search', sourceLabel: 'Search',
      coreIntent: 'search.open', domIntent: 'nav.goto', ctaMarkers: ['icon.search'], intentHandler: 'client',
      targetType: 'url', targetId: '/search', requiredCapabilities: [], missingCapabilities: [],
    }];
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({
      files: { ...input.files, '/src/pages/Home.tsx': 'export default function Home(){return <main><button type="button" aria-label="Search">Search</button></main>}' },
      revisionId: input.revisionId,
      outcomes: [{ page: input.pages[0], status: 'authored' as const, reason: 'accepted' as const, attempts: 1, errors: [] }],
    }));

    const result = await createTestBuilder({ authorSite }).generate({
      operationId: 'semantic-binding-closure', contract: appContract, initialFiles: baseFiles,
      entryPoint: '/src/main.tsx', baseRevisionId: null,
    });

    expect(result.candidate.status).toBe('ready-for-commit');
    expect(result.candidateFiles['/src/pages/Home.tsx']).toContain('data-ut-cta="icon.search"');
    expect(result.candidate.closure?.issues.some((issue) => issue.code === 'wizard-binding-marker-missing')).toBe(false);
    expect(result.candidate.graph?.pages).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'home', route: '/' }),
    ]));
    expect(result.candidate.graph?.aliases['page:/']).toBe('home');
    expect(authorSite.mock.calls[0]?.[0].runtimeContextForPage('home'))
      .toContain('CANONICAL PAGE NODE: persist page ID "home"');
  });

  it('normalizes registered section dispatchers before per-page candidate gates run', async () => {
    const appContract = contract();
    const registryContext = buildWizardAggregatedRegistryContext({
      industry: 'salon', templateId: 'salon-premium', themePresetId: 'editorial', seed: 'page-check-normalization',
    });
    const page = {
      pageId: 'home', title: 'Home', path: '/', filePath: '/src/pages/Home.tsx',
      pageType: 'home', pageRole: 'home', isHome: true,
    };
    appContract.topology.pageRegistry.pages = { home: page as never };
    appContract.design.registryContext = registryContext;
    appContract.design.sourceSelection = deriveDesignSourceSelection(registryContext);
    const pageCheckMessages: string[][] = [];
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => {
      const manifest = JSON.parse(input.files['/.unison/design-source-manifest.json'] ?? '{}') as {
        implementations?: Record<string, { sectionType: string }>;
      };
      const variantFor = (sectionType: string) => {
        const variant = Object.entries(manifest.implementations ?? {}).find(([, entry]) => entry.sectionType === sectionType)?.[0];
        if (!variant) throw new Error(`Missing registered ${sectionType} test variant`);
        return variant;
      };
      const navbarVariant = variantFor('navbar');
      const servicesVariant = variantFor('services');
      const footerVariant = variantFor('footer');
      const source = `import Navbar from "@/unison/design-sources/Navbar";
import Services from "@/unison/design-sources/Services";
import Footer from "@/unison/design-sources/Footer";
export default function Home(){return <><header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="${navbarVariant}"><Navbar links={[]} /></header><main><section data-ut-section-id="home:services:0" data-ut-section-type="services" data-ut-variant="${servicesVariant}"><Services headline="Care" items={[]} /></section></main><footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="${footerVariant}"><Footer links={[]} /></footer></>}`;
      pageCheckMessages.push(input.pageCheck?.(page.filePath, source, { ...input.files, [page.filePath]: source }) ?? []);
      return {
        files: { ...input.files, [page.filePath]: source },
        revisionId: input.revisionId,
        outcomes: [{ page: input.pages[0], status: 'authored' as const, reason: 'accepted' as const, attempts: 1, errors: [] }],
      };
    });

    await createTestBuilder({ authorSite }).generate({
      operationId: 'registered-section-page-check', contract: appContract, initialFiles: baseFiles,
      entryPoint: '/src/main.tsx', baseRevisionId: null,
    });

    expect(pageCheckMessages).toHaveLength(1);
    expect(pageCheckMessages[0].filter((message) => message.includes('section "')
      || message.includes('every section requires literal'))).toEqual([]);
  });

  it('adapts site authoring behind generate and preserves the candidate result', async () => {
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({
      files: { ...input.files, '/src/pages/Home.tsx': 'export default function Home(){return <main>After</main>}' },
      revisionId: 'revision-2',
      outcomes: [{ page: input.pages[0], status: 'authored' as const, reason: 'accepted' as const, attempts: 1, errors: [] }],
    }));
    const builder = createUnisonAppBuilder({ authorSite });
    const result = await builder.generate({
      operationId: 'operation-1', contract: contract(), initialFiles: baseFiles,
      entryPoint: '/src/main.tsx', baseRevisionId: 'revision-1',
      runtimeContext: 'Preserve the selected marketplace preview material.',
    });

    expect(authorSite).toHaveBeenCalledOnce();
    expect(authorSite.mock.calls[0]?.[0].runtimeContextForPage?.('home')).toContain('Preserve the selected marketplace preview material.');
    expect(listContentTypes).toHaveBeenCalledWith({ businessId: 'business-1', projectId: 'project-1' });
    expect(result.candidate.status).toBe('ready-for-commit');
    expect(result.candidate.files['/src/pages/Home.tsx']).toContain('After');
    expect(result.candidateFiles).toBe(result.candidate.files);
    expect(result.candidate.closure?.ok).toBe(true);
    expect(result.candidate.provenance?.strategy).toBe('ai-candidate');
    expect(result.revisionId).toBe('revision-2');
  });
  it('loads only the contract project CMS schemas before page authoring', async () => {
    const loadContentTypes = vi.fn(async () => [{ id: 'article-type', api_key: 'articles', field_schema: { fields: [{ key: 'body', type: 'textarea' }] } }]);
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({ files: input.files, revisionId: input.revisionId, outcomes: [] }));
    await createUnisonAppBuilder({ authorSite, loadContentTypes }).generate({ operationId: 'scoped-generation', contract: contract(), initialFiles: baseFiles, entryPoint: '/src/main.tsx', baseRevisionId: null });
    expect(loadContentTypes).toHaveBeenCalledWith({ businessId: 'business-1', projectId: 'project-1' });
    expect(authorSite.mock.calls[0]?.[0].runtimeContextForPage?.('home')).toContain('content:articles');
    expect(authorSite.mock.calls[0]?.[0].runtimeContextForPage?.('home')).toContain('body:textarea');
  });
  it('continues authoring without optional CMS schema hints when scoped discovery fails', async () => {
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({
      files: { ...input.files, '/src/pages/Home.tsx': 'export default function Home(){return <main>Authored without CMS hints</main>}' },
      revisionId: input.revisionId,
      outcomes: [],
    }));
    const result = await createUnisonAppBuilder({
      authorSite,
      loadContentTypes: async () => { throw new Error('Content CMS content-type-list (403): Site, project, or business scope is invalid'); },
    }).generate({ operationId: 'failed-schemas', contract: contract(), initialFiles: baseFiles, entryPoint: '/src/main.tsx', baseRevisionId: null });
    expect(authorSite).toHaveBeenCalledOnce();
    expect(authorSite.mock.calls[0]?.[0].runtimeContext).not.toContain('content:articles');
    expect(result.candidate.status).toBe('ready-for-commit');
    expect(result.candidate.files['/src/pages/Home.tsx']).toContain('Authored without CMS hints');
  });

  it('repairs site-wide closure in memory before returning a candidate', async () => {
    const brokenFiles = {
      ...baseFiles,
      '/src/pages/Home.tsx': 'import Card from "../project-components/Card"; export default function Home(){return <Card />}',
    };
    const repairedFiles = {
      ...brokenFiles,
      '/src/project-components/Card.tsx': 'export default function Card(){return <section>Card</section>}',
    };
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({
      files: brokenFiles,
      revisionId: input.revisionId,
      outcomes: [{ page: input.pages[0], status: 'authored' as const, reason: 'accepted' as const, attempts: 1, errors: [] }],
    }));
    const changeSet = {
      id: 'cand_closure', provenance: { origin: 'repair' as const, knowledgeVersion: 'test' },
      fileOps: [{ type: 'create' as const, path: '/src/project-components/Card.tsx', content: repairedFiles['/src/project-components/Card.tsx'] }],
      routeOps: [], targetPages: ['home'], attempt: 1,
    };
    const runComposer = vi.fn(async (): Promise<ComposerLoopResult> => ({
      ok: true, reason: 'accepted', attempts: 1, errors: [],
      prepared: {
        ok: true,
        build: { changeSet, candidateFiles: repairedFiles, refused: [] },
        gates: { passed: true, failures: [], advisories: [] },
        nextFiles: repairedFiles,
        errors: [],
      },
    }));
    const result = await createTestBuilder({ authorSite, runComposer }).generate({
      operationId: 'operation-closure', contract: contract(), initialFiles: baseFiles,
      entryPoint: '/src/main.tsx', baseRevisionId: null,
    });

    expect(runComposer).toHaveBeenCalledOnce();
    expect(result.candidate.status).toBe('ready-for-commit');
    expect(result.candidateFiles['/src/project-components/Card.tsx']).toContain('Card');
    expect(result.candidate.closure?.ok).toBe(true);
    expect(result.candidate.provenance?.strategy).toBe('ai-candidate+closure-repair');
    expect(result.revisionId).toBeNull();
  });

  it('bounds and reports the site-wide closure repair phase', async () => {
    const brokenFiles = {
      ...baseFiles,
      '/src/pages/Home.tsx': 'import Card from "../project-components/Card"; export default function Home(){return <Card />} ',
    };
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({
      files: brokenFiles,
      revisionId: input.revisionId,
      outcomes: [{ page: input.pages[0], status: 'authored' as const, reason: 'accepted' as const, attempts: 1, errors: [] }],
    }));
    let repairTimeoutMs = 0;
    const runComposer = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['runComposer']>>[0]): Promise<ComposerLoopResult> => {
      repairTimeoutMs = input.timeoutMs ?? 0;
      return { ok: false, reason: 'provider', attempts: 1, errors: ['repair provider timeout'] };
    });
    const statuses: string[] = [];

    await createTestBuilder({ authorSite, runComposer }).generate({
      operationId: 'bounded-closure-repair', contract: contract(), initialFiles: brokenFiles,
      entryPoint: '/src/main.tsx', baseRevisionId: null, budgetMs: 250_000,
      onStatus: (status) => statuses.push(status),
    });

    expect(runComposer).toHaveBeenCalledOnce();
    expect(repairTimeoutMs).toBeGreaterThan(0);
    expect(repairTimeoutMs).toBeLessThanOrEqual(90_000);
    expect(statuses).toContain('Repairing final checks (up to 1:30)');
  });

  it('generates a complete multi-page candidate without a canonical commit callback', async () => {
    const multiPage = contract();
    multiPage.topology.sitePlan.pages.push({
      id: 'contact', name: 'contact', title: 'Contact', route: '/contact', role: 'contact',
      filePath: '/src/pages/Contact.tsx', visibleInNav: true, isHome: false, generatedBy: 'wizard',
    });
    multiPage.design.resolvedSiteDesignContext = compileResolvedSiteDesignContext({
      designSeed: 'app-builder-test', businessModel: 'general' as never,
      industry: 'salon', roles: ['home', 'contact'],
    });
    const candidateFiles = {
      ...baseFiles,
      '/src/pages/Home.tsx': 'import Mark from "../project-components/Mark"; export default function Home(){return <main><Mark /></main>}',
      '/src/pages/Contact.tsx': 'export default function Contact(){return <main>Contact us</main>}',
      '/src/project-components/Mark.tsx': 'export default function Mark(){return <span>Northstar</span>}',
    };
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({
      files: candidateFiles,
      revisionId: input.revisionId,
      outcomes: input.pages.map((page) => ({ page, status: 'authored' as const, reason: 'accepted' as const, attempts: 1, errors: [] })),
    }));
    const result = await createTestBuilder({ authorSite }).generate({
      operationId: 'operation-multi-page', contract: multiPage, initialFiles: baseFiles,
      entryPoint: '/src/main.tsx', baseRevisionId: null,
    });

    expect(authorSite.mock.calls[0][0].commitPage).toBeTypeOf('function');
    expect(result.candidate.status).toBe('ready-for-commit');
    expect(result.candidate.closure?.ok).toBe(true);
    expect(result.candidateFiles['/src/pages/Contact.tsx']).toContain('Contact us');
    expect(result.candidateFiles['/src/project-components/Mark.tsx']).toContain('Northstar');
    expect(result.revisionId).toBeNull();
  });

  it('generates an in-builder page candidate with scoped files and topology ops', async () => {
    const page = {
      pageId: 'focus', title: 'Focus', route: '/focus', filePath: '/src/pages/Focus.tsx',
      role: 'custom', pageType: 'custom' as const, showInNav: true,
    };
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({
      files: { ...input.files, [page.filePath]: 'export default function Focus(){return <main>Focus</main>}' },
      revisionId: input.revisionId,
      outcomes: input.pages.map((target) => ({ page: target, status: 'authored' as const, reason: 'accepted' as const, attempts: 1, errors: [] })),
    }));
    const result = await createTestBuilder({ authorSite }).generatePages({
      operationId: 'operation-page-generation',
      baseRevisionId: 'revision-1',
      currentFiles: baseFiles,
      pages: [page],
      existingRoutes: [{ title: 'Home', route: '/' }],
      businessName: 'Northstar',
      industry: 'salon',
    });

    expect(authorSite).toHaveBeenCalledOnce();
    expect(authorSite.mock.calls[0][0].candidateOrigin).toBe('builder');
    expect(authorSite.mock.calls[0][0].initialRouteOps).toEqual([
      expect.objectContaining({ type: 'add_page', pageId: 'focus', route: '/focus' }),
    ]);
    expect(result.status).toBe('ready-for-commit');
    expect(result.candidateFiles[page.filePath]).toContain('Focus');
    expect(result.changeSet?.provenance.origin).toBe('builder');
    expect(result.changeSet?.routeOps).toEqual([
      expect.objectContaining({ type: 'add_page', pageId: 'focus', route: '/focus' }),
    ]);
  });

  it('rejects an existing route before invoking the page author', async () => {
    const authorSite = vi.fn();
    const result = await createTestBuilder({ authorSite: authorSite as never }).generatePages({
      operationId: 'operation-page-collision',
      currentFiles: baseFiles,
      pages: [{
        pageId: 'about-new', title: 'About', route: '/about', filePath: '/src/pages/AboutNew.tsx',
        role: 'about', pageType: 'about',
      }],
      existingRoutes: [{ title: 'About', route: '/About/' }],
      businessName: 'Northstar',
    });

    expect(result.status).toBe('rejected');
    expect(result.diagnostics[0]).toContain('Route already exists');
    expect(authorSite).not.toHaveBeenCalled();
  });

  it('rejects files outside the generated page directory before authoring', async () => {
    const authorSite = vi.fn();
    const result = await createTestBuilder({ authorSite: authorSite as never }).generatePages({
      operationId: 'operation-page-scope',
      currentFiles: baseFiles,
      pages: [{
        pageId: 'runtime', title: 'Runtime', route: '/runtime', filePath: '/.unison/runtime-manifest.json',
        role: 'custom', pageType: 'custom',
      }],
      businessName: 'Northstar',
    });

    expect(result.status).toBe('rejected');
    expect(result.diagnostics[0]).toContain('must be TypeScript files under /src/pages/');
    expect(authorSite).not.toHaveBeenCalled();
  });

  it('routes Builder edits through the existing Composer repair gates', async () => {
    const nextFiles = { ...baseFiles, '/src/pages/Home.tsx': 'export default function Home(){return <main>Edited</main>}' };
    const changeSet = {
      id: 'cand_edit', baseRevisionId: 'revision-1',
      provenance: { origin: 'builder' as const, knowledgeVersion: 'test' },
      fileOps: [{ type: 'replace' as const, path: '/src/pages/Home.tsx', content: nextFiles['/src/pages/Home.tsx'] }],
      routeOps: [], targetPages: ['home'], attempt: 1,
    };
    const composer: ComposerLoopResult = {
      ok: true, reason: 'accepted', attempts: 1, errors: [], response: { summary: 'Edited safely' } as never,
      prepared: {
        ok: true,
        build: { changeSet, candidateFiles: nextFiles, refused: [] },
        gates: { passed: true, failures: [], advisories: [] },
        nextFiles,
        errors: [],
      },
    };
    const runComposer = vi.fn(async () => composer);
    const builder = createTestBuilder({ runComposer });
    const result = await builder.edit({
      operationId: 'operation-edit', baseRevisionId: 'revision-1', currentFiles: baseFiles,
      instruction: 'Change the headline',
      page: { title: 'Home', route: '/', role: 'home', filePath: '/src/pages/Home.tsx' },
      sourceTargets: ['/src/pages/Home.tsx'],
      gatewayOptions: { selectedModelId: 'openai/gpt-4.1', reasoningEffort: 'high', timeoutMs: 110_000 },
    });

    expect(runComposer).toHaveBeenCalledOnce();
    const firstCall = runComposer.mock.calls[0] as unknown as [{ gatewayOptions?: unknown }] | undefined;
    expect(firstCall?.[0].gatewayOptions).toEqual({ selectedModelId: 'openai/gpt-4.1', reasoningEffort: 'high', timeoutMs: 110_000 });
    expect(result.stopReason).toBe('complete');
    expect(result.changeSet).toBe(changeSet);
    expect(result.candidate.files).toEqual(nextFiles);
    expect(result.summary).toBe('Edited safely');
  });

  it('returns rejected candidates instead of bypassing failed gates', async () => {
    const runComposer = vi.fn(async (): Promise<ComposerLoopResult> => ({
      ok: false, reason: 'gates_exhausted', attempts: 3, errors: ['import-graph failed'],
    }));
    const result = await createTestBuilder({ runComposer }).edit({
      operationId: 'operation-rejected', baseRevisionId: 'revision-1', currentFiles: baseFiles,
      instruction: 'Break imports',
      page: { title: 'Home', route: '/', role: 'home', filePath: '/src/pages/Home.tsx' },
      sourceTargets: ['/src/pages/Home.tsx'],
    });

    expect(result.candidate.status).toBe('rejected');
    expect(result.stopReason).toBe('repair-exhausted');
    expect(result.candidate.files).toBe(baseFiles);
    expect(result.changeSet).toBeUndefined();
  });
});
