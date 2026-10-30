import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { themePresetToThemeTokens } from '@/components/onboarding/themePresetToTokens';
import { compileResolvedSiteDesignContext } from '@/services/launch/resolvedSiteDesignContext';
import { buildCanonicalLaunchPlan } from '@/services/launch/canonicalLaunchPlan';
import { resolveBusinessLaunchPlan } from '@/services/launch/launchCapabilities';
import { getAllIndustries } from '@/platform/core/industryMatrix';
import { createUnisonAppBuilder } from '@/services/app-builder/UnisonAppBuilder';
import { APP_BUILDER_PROTOCOL_VERSION, buildAppBuildContract, type AppBuildContract } from '@/services/app-builder/appBuilderContracts';
import { buildAppBuilderGenerationContext, renderHomeObjectContext } from '@/services/app-builder/appBuilderGenerationContext';
import { applyDesignSources } from '@/services/app-builder/design/designSourceMaterializer';
import { materializeAppBuilderSiteShell } from '@/services/app-builder/design/appBuilderSiteShell';
import type { ComposerLoopResult } from '@/services/builder/aiRepairLoop';
import { listContentTypes } from '@/services/cmsRecordService';
import { saveAppBuilderAISettings } from '@/services/app-builder/appBuilderAISettings';
import { buildWizardAggregatedRegistryContext } from '@/services/launch/wizardRegistryAggregation';
import { deriveDesignSourceSelection } from '@/services/app-builder/appBuilderContracts';
import { buildWizardBindingGuide } from '@/services/wizardBindingBridge';
import { resolvedCompositionPathFor } from '@/platform/core/resolvedComposition';
import { materializeDeterministicAppBuilderScaffold } from '@/services/app-builder/design/appBuilderScaffold';
import { planSiteComposition } from '@/services/composition';
import {
  getAppBuilderSharedShellImplementationIds,
  materializeAppBuilderSectionModelsWithDiagnostics,
} from '@/services/app-builder/appBuilderSectionModel';
import type { WizardSelections } from '@/types/playground';

vi.mock('@/services/cmsRecordService', () => ({ listContentTypes: vi.fn(async () => []) }));

const baseFiles = {
  '/src/pages/Home.tsx': 'export default function Home(){return <main>Before</main>}',
  '/package.json': JSON.stringify({ dependencies: { react: '^18.3.1' } }),
};

function scaffoldAuthoredPages(
  appContract: AppBuildContract,
  additions: Record<string, { imports?: string; body?: string }> = {},
  initialFiles: Record<string, string> = baseFiles,
): Record<string, string> {
  const designManifest = JSON.parse(initialFiles['/.unison/design-source-manifest.json'] ?? '{}') as {
    implementations?: Record<string, { modulePath: string; sectionType: string; props?: string }>;
    eligibleByPage?: Record<string, string[]>;
  };
  const files = {
    ...initialFiles,
    ...materializeDeterministicAppBuilderScaffold(appContract, {
      implementations: designManifest.implementations ?? {},
      eligibleByPage: designManifest.eligibleByPage ?? {},
    }),
  };
  for (const [path, addition] of Object.entries(additions)) {
    let source = files[path];
    if (!source) throw new Error(`Missing scaffold page ${path}`);
    if (addition.imports) {
      source = source.replace('export default function', `${addition.imports}\nexport default function`);
    }
    if (addition.body) source = source.replace('</main>', `${addition.body}</main>`);
    files[path] = source;
  }
  return files;
}

function expectedSectionIds(pageId: string, sectionOrder: readonly string[]): string[] {
  const counts = new Map<string, number>();
  return sectionOrder.map((sectionType) => {
    const occurrence = counts.get(sectionType) ?? 0;
    counts.set(sectionType, occurrence + 1);
    return `${pageId}:${sectionType}:${occurrence}`;
  });
}

function contract(industry = 'salon', pageRoles: readonly string[] = ['home']): AppBuildContract {
  const roles = [...new Set(['home', ...pageRoles])];
  const pages = roles.map((role) => {
    const title = role.split(/[-_\s]+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
    const path = role === 'home' ? '/' : `/${role.replace(/_/g, '-')}`;
    const id = role === 'home' ? 'home' : `page-${role}`;
    return {
      id, name: role, title, route: path, role, filePath: `/src/pages/${title.replace(/\s+/g, '')}.tsx`,
      visibleInNav: role !== 'checkout', isHome: role === 'home', generatedBy: 'wizard' as const,
    };
  });
  const designContext = compileResolvedSiteDesignContext({
    designSeed: 'app-builder-test',
    businessModel: 'general' as never,
    industry,
    roles,
  });
  const registryContext = buildWizardAggregatedRegistryContext({
    industry, templateId: `${industry}-premium`, themePresetId: 'editorial', seed: 'app-builder-test',
  });
  const compositionPlan = planSiteComposition(
    industry,
    pages.map((page) => ({ pageId: page.id, role: page.role })),
    'app-builder-test',
    { artDirection: designContext.contract.artDirectionPackId, availableCapabilities: [] },
  );
  return {
    protocolVersion: APP_BUILDER_PROTOCOL_VERSION,
    identity: { projectId: 'project-1', businessId: 'business-1', siteId: 'site-1', systemType: 'website' },
    topology: {
      sitePlan: {
        siteId: 'topology-1', industry, businessName: 'Northstar', homePageId: 'home',
        pages,
        navItems: pages.filter((page) => page.visibleInNav).map((page) => page.id),
        funnels: [], redirects: [], generatedAt: '2026-09-30T12:00:00.000Z',
      },
      pageRegistry: {
        pages: Object.fromEntries(pages.map((page, navOrder) => [page.id, {
          pageId: page.id, title: page.title, path: page.route, filePath: page.filePath,
          pageType: page.role, pageRole: page.role, isHome: page.isHome,
          showInNav: page.visibleInNav, navOrder,
        }])),
        funnels: {}, homePageId: 'home', version: 1,
      },
    },
    business: {
      industry, businessName: 'Northstar', goals: [], intents: [], capabilities: [], bindingGuide: '',
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
      uiFoundation: {} as never, registryContext,
      compositionPlan,
      sourceSelection: deriveDesignSourceSelection(registryContext),
    },
    runtime: {
      framework: 'react-vite', language: 'typescript', styling: 'tailwind',
      protectedPaths: [], approvedDependencies: [], approvedExperienceCapabilities: [],
    },
  };
}

function ecommerceContract(): AppBuildContract {
  const result = contract();
  const pages = [
    { id: 'home', name: 'home', title: 'Home', route: '/', role: 'home', filePath: '/src/pages/Home.tsx', visibleInNav: true, isHome: true, generatedBy: 'wizard' as const },
    { id: 'about', name: 'about', title: 'About', route: '/about', role: 'about', filePath: '/src/pages/About.tsx', visibleInNav: true, isHome: false, generatedBy: 'wizard' as const },
    { id: 'contact', name: 'contact', title: 'Contact', route: '/contact', role: 'contact', filePath: '/src/pages/Contact.tsx', visibleInNav: true, isHome: false, generatedBy: 'wizard' as const },
    { id: 'checkout', name: 'checkout', title: 'Checkout', route: '/checkout', role: 'checkout', filePath: '/src/pages/Checkout.tsx', visibleInNav: false, isHome: false, generatedBy: 'wizard' as const },
    { id: 'shop', name: 'shop', title: 'Shop', route: '/shop', role: 'shop', filePath: '/src/pages/Shop.tsx', visibleInNav: true, isHome: false, generatedBy: 'wizard' as const },
  ];
  result.topology.sitePlan = { ...result.topology.sitePlan, industry: 'ecommerce', businessName: 'Northstar Market', pages };
  result.topology.pageRegistry = {
    pages: Object.fromEntries(pages.map((page, navOrder) => [page.id, {
      pageId: page.id, title: page.title, path: page.route, filePath: page.filePath,
      pageType: page.id === 'checkout' ? 'checkout' : page.id, pageRole: page.role,
      isHome: page.isHome, showInNav: page.visibleInNav, navOrder,
    }])),
    funnels: {}, homePageId: 'home', version: 1,
  } as never;
  result.business.industry = 'ecommerce';
  result.business.businessName = 'Northstar Market';
  result.business.intents = ['nav.goto', 'cart.checkout'];
  result.business.capabilities = ['commerce'];
  result.business.bindingGuide = [
    '- Page Checkout (/checkout), slot cart.checkout: label "Return to shop", marker data-ut-cta="cta.nav-link", intent nav.goto, target Shop (/shop)',
    '- Page Shop (/shop), slot cart.checkout: label "Checkout", marker data-ut-cta="cta.checkout", intent cart.checkout, target cart-overlay',
  ].join('\n');
  result.business.intentBindings = [
    {
      bindingId: 'bind-checkout-return', pageId: 'checkout', route: '/checkout', elementKey: 'checkout.cart.checkout',
      sourceSection: 'cart', sourceSlot: 'checkout-cta', sourceLabel: 'Return to shop', coreIntent: 'nav.goto', domIntent: 'nav.goto',
      ctaMarkers: ['cta.nav-link'], intentHandler: 'client', targetType: 'page', targetId: 'shop',
      requiredCapabilities: [], missingCapabilities: [],
    },
    {
      bindingId: 'bind-shop-checkout', pageId: 'shop', route: '/shop', elementKey: 'shop.cart.checkout',
      sourceSection: 'cart', sourceSlot: 'checkout-cta', sourceLabel: 'Checkout', coreIntent: 'cart.checkout', domIntent: 'cart.checkout',
      ctaMarkers: ['cta.checkout'], intentHandler: 'client', targetType: 'url', targetId: 'cart-overlay',
      requiredCapabilities: ['commerce'], missingCapabilities: [],
    },
  ] as never;
  result.design.resolvedSiteDesignContext = compileResolvedSiteDesignContext({
    designSeed: 'app-builder-test-ecommerce', businessModel: 'general' as never,
    industry: 'ecommerce', roles: pages.map((page) => page.role),
  });
  result.design.compositionPlan = planSiteComposition(
    'ecommerce', pages.map((page) => ({ pageId: page.id, role: page.role })),
    'app-builder-test-ecommerce',
    { artDirection: result.design.resolvedSiteDesignContext.contract.artDirectionPackId, availableCapabilities: result.business.capabilities },
  );
  const registryContext = buildWizardAggregatedRegistryContext({
    industry: 'ecommerce', templateId: 'ecommerce-premium', themePresetId: 'editorial', seed: 'app-builder-test-ecommerce',
  });
  result.design.registryContext = registryContext;
  result.design.sourceSelection = deriveDesignSourceSelection(registryContext);
  return result;
}

const createTestBuilder = (dependencies: Parameters<typeof createUnisonAppBuilder>[0] = {}) =>
  createUnisonAppBuilder({ loadContentTypes: async () => [], ...dependencies });

describe('UnisonAppBuilder facade', () => {
  it('materializes a page-matched section sidecar through runtime for every canonical industry', () => {
    const industries = getAllIndustries();
    for (const profile of industries) {
      const pageRoles = [...new Set(profile.defaultPages.map((page) => page.purpose))];
      const appContract = contract(profile.industry, pageRoles);
      const generation = buildAppBuilderGenerationContext(appContract);
      const shellFiles = materializeAppBuilderSiteShell({
        registry: appContract.topology.pageRegistry,
        businessName: appContract.business.businessName,
        bundle: generation.designSources,
        materialization: generation.materialization,
      });
      const base = {
        ...applyDesignSources({}, generation.materialization),
        ...shellFiles,
      };
      const pages = appContract.topology.sitePlan.pages.map((page) => ({
        id: page.id, filePath: page.filePath, route: page.route,
      }));
      const candidate = {
        ...base,
        ...materializeDeterministicAppBuilderScaffold(appContract, {
          implementations: generation.materialization.manifest.implementations,
          eligibleByPage: generation.designSources.eligibleByPage,
        }),
      };
      const sharedShellIds = getAppBuilderSharedShellImplementationIds(
        base,
        generation.materialization.manifest.implementations,
      );
      const materialization = materializeAppBuilderSectionModelsWithDiagnostics(
        candidate,
        pages,
        generation.materialization.manifest.implementations,
        generation.designSources.eligibleByPage,
        sharedShellIds,
      );

      expect(materialization.diagnostics, profile.industry).toEqual([]);
      expect(materialization.pages, profile.industry).toHaveLength(pages.length);
      for (const page of materialization.pages) {
        const sidecar = JSON.parse(materialization.files[page.sidecarPath] ?? 'null') as {
          compiledBy?: string;
          pageFilePath?: string;
          sections?: unknown[];
          variantOverrides?: Record<string, string>;
        } | null;
        expect(sidecar, `${profile.industry}:${page.filePath}`).toMatchObject({
          compiledBy: 'app-builder', pageFilePath: page.filePath,
        });
        expect(sidecar?.sections).toEqual(page.inspection.sections);
        expect(page.sidecarContents).toBe(materialization.files[page.sidecarPath]);
      }
    }
  });

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

  it('projects canonical Home objects and bindings before handing the page forward', async () => {
    const appContract = contract('salon', ['home', 'about']);
    let homeFiles: Record<string, string> = {};
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => {
      const home = input.pages.find(page => page.pageId === 'home');
      if (!home || !input.preparePage) throw new Error('Missing canonical page projection');
      const drafted = scaffoldAuthoredPages(appContract, {}, input.files);
      expect(input.pageCheck?.(home.filePath, drafted[home.filePath], drafted)).toEqual([]);
      homeFiles = input.preparePage(drafted, home);
      const composition = JSON.parse(homeFiles[resolvedCompositionPathFor(home.filePath)]);
      expect(composition.compiledBy).toBe('app-builder');
      expect(composition.sections.length).toBeGreaterThan(2);
      expect(composition.sections.every((section: { data?: unknown }) => section.data)).toBe(true);
      const nextContext = input.runtimeContextForPage?.('page-about', homeFiles, 'home') ?? '';
      expect(nextContext).toContain('HOME OBJECT CONTRACT');
      expect(nextContext).toContain(composition.sections[0].sectionId);
      return { files: homeFiles, outcomes: [] };
    });
    const result = await createTestBuilder({ authorSite, runComposer: vi.fn() }).generate({
      operationId: 'wired-home-handoff', contract: appContract, initialFiles: baseFiles,
      entryPoint: '/src/main.tsx', budgetMs: 1,
    });
    expect(result.candidate.status).toBe('ready-for-commit');
    expect(result.candidateFiles[resolvedCompositionPathFor('/src/pages/Home.tsx')]).toBeDefined();
  });

  it('Home context retains inactive capability requirements without granting them or exposing private values', () => {
    const appContract = ecommerceContract();
    const binding = { ...appContract.business.intentBindings[1], pageId: 'home',
      bindingId: 'bind-home-checkout', requiredCapabilities: ['commerce', 'payments'], missingCapabilities: ['payments'] };
    appContract.business.intentBindings = [binding];
    const files = { [resolvedCompositionPathFor('/src/pages/Home.tsx')]: JSON.stringify({
      version: '1.0', compiledBy: 'app-builder', pageFilePath: '/src/pages/Home.tsx',
      sections: [{ sectionId: 'home:services:0', semanticType: 'services', variantId: 'services:card-grid',
        data: { headline: 'Owner headline', notificationEmail: 'private@example.test' } }],
    }) };
    const context = renderHomeObjectContext(appContract, files, 'home');
    const projection = JSON.parse(context.split('\n')[1]);
    expect(projection.bindings[0].missingCapabilities).toEqual(['payments']);
    expect(projection.enabledCapabilities).toEqual(['commerce']);
    expect(projection.objects).toHaveLength(1);
    expect(context).not.toContain('private@example.test');
    expect(renderHomeObjectContext(appContract, {}, 'home')).toBe('');
  });

  it('rejects an incomplete Home handoff even when baseline pages pass final closure', async () => {
    const appContract = contract('salon', ['home', 'about']);
    const result = await createTestBuilder({
      authorSite: async input => ({ files: scaffoldAuthoredPages(appContract, {}, input.files), outcomes: [
        { page: input.pages[0], status: 'kept-baseline', reason: 'gates_exhausted', attempts: 3,
          errors: ['Home binding did not pass.'] },
        { page: input.pages[1], status: 'skipped', reason: 'paused', attempts: 0, errors: [] },
      ] }),
      runComposer: vi.fn(),
    }).generate({ operationId: 'incomplete-home', contract: appContract, initialFiles: baseFiles,
      entryPoint: '/src/main.tsx', budgetMs: 1 });
    expect(result.candidate.closure.ok).toBe(true);
    expect(result.candidate.status).toBe('rejected');
    expect(result.candidate.provenance.authoredPageIds).toEqual([]);
    expect(result.candidate.diagnostics).toContain('Home binding did not pass.');
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
    expect(result.candidate.diagnostics).toEqual([
      'AI request failed (credits): Payment required. Please add credits to your OpenAI account.',
    ]);
    expect(runComposer).not.toHaveBeenCalled();
  });

  it('surfaces a closure-repair provider failure instead of masking it as section validation', async () => {
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({
      files: { ...input.files, '/src/pages/Home.tsx': 'export default function Home(){return <main>Authored home</main>}' },
      revisionId: input.revisionId,
      outcomes: [{ page: input.pages[0], status: 'authored' as const, reason: 'accepted' as const, attempts: 1, errors: [] }],
    }));
    const runComposer = vi.fn(async (): Promise<ComposerLoopResult> => ({
      ok: false,
      reason: 'provider',
      attempts: 1,
      errors: ['AI providers failed to produce a response. Gemini timed out.'],
    }));

    const result = await createTestBuilder({ authorSite, runComposer }).generate({
      operationId: 'closure-repair-provider-failure', contract: contract(), initialFiles: baseFiles,
      entryPoint: '/src/main.tsx', baseRevisionId: null,
      pageCheck: () => ['Registered section closure needs repair.'],
    });

    expect(runComposer).toHaveBeenCalledOnce();
    expect(result.stopReason).toBe('provider-error');
    expect(result.candidate.diagnostics[0]).toContain('Gemini timed out');
    expect(result.candidate.diagnostics).toContain('Registered section closure needs repair.');
  });

  it('builds a validated five-page ecommerce scaffold without claiming AI authorship', async () => {
    const authorSite = vi.fn();
    const runComposer = vi.fn();
    const pages = ecommerceContract().topology.sitePlan.pages;
    const appBuildContract = ecommerceContract();
    appBuildContract.runtime.protectedPaths = ['/.unison/compositions/pages/About.json'];
    appBuildContract.business.intents = ['nav.goto', 'cart.checkout', 'cart.view', 'favorite.toggle'];
    appBuildContract.business.bindingGuide = [
      appBuildContract.business.bindingGuide,
      '- Page Home (/), slot navbar.icon-cart: label "Open cart", marker data-ut-cta="icon.cart", intent cart.view, target cart-overlay',
      '- Page Home (/), slot hero.cart-trigger: label "Open cart summary", marker data-ut-cta="icon.cart", intent cart.view, target cart-overlay',
      '- Page Home (/), slot navbar.icon-search: label "Search", marker data-ut-cta="icon.search", intent nav.goto, target Shop (/shop)',
      '- Page Shop (/shop), slot toolbar.icon-favorite: label "Save favorite", marker data-ut-cta="icon.favorite", intent favorite.toggle, target product-1',
      '- Page Shop (/shop), slot toolbar.icon-filter: label "Filter products", marker data-ut-cta="icon.filter", intent nav.goto, target Shop (/shop)',
      '- Page Shop (/shop), slot toolbar.icon-sort: label "Sort products", marker data-ut-cta="icon.sort", intent nav.goto, target Shop (/shop)',
    ].join('\n');
    appBuildContract.business.intentBindings.push(
      {
        bindingId: 'bind-home-cart', pageId: 'home', route: '/', elementKey: 'home.navbar.cart',
        sourceSection: 'navbar', sourceSlot: 'icon-cart', sourceLabel: 'Open cart', coreIntent: 'cart.view', domIntent: 'cart.view',
        ctaMarkers: ['icon.cart'], intentHandler: 'client', targetType: 'popup', targetId: 'cart-overlay',
        requiredCapabilities: [], missingCapabilities: [],
      },
      {
        bindingId: 'bind-home-cart-compact', pageId: 'home', route: '/', elementKey: 'home.hero.cart',
        sourceSection: 'hero', sourceSlot: 'cart-trigger', sourceLabel: 'Open cart summary', coreIntent: 'cart.view', domIntent: 'cart.view',
        ctaMarkers: ['icon.cart'], intentHandler: 'client', targetType: 'popup', targetId: 'cart-overlay',
        requiredCapabilities: [], missingCapabilities: [],
      },
      {
        bindingId: 'bind-home-search', pageId: 'home', route: '/', elementKey: 'home.navbar.search',
        sourceSection: 'navbar', sourceSlot: 'icon-search', sourceLabel: 'Search', coreIntent: 'nav.goto', domIntent: 'nav.goto',
        ctaMarkers: ['icon.search'], intentHandler: 'client', targetType: 'page', targetId: 'shop',
        requiredCapabilities: [], missingCapabilities: [],
      },
      {
        bindingId: 'bind-shop-favorite', pageId: 'shop', route: '/shop', elementKey: 'shop.toolbar.favorite',
        sourceSection: 'toolbar', sourceSlot: 'icon-favorite', sourceLabel: 'Save favorite', coreIntent: 'favorite.toggle', domIntent: 'favorite.toggle',
        ctaMarkers: ['icon.favorite'], intentHandler: 'client', targetType: 'product', targetId: 'product-1',
        requiredCapabilities: [], missingCapabilities: [],
      },
      {
        bindingId: 'bind-shop-filter', pageId: 'shop', route: '/shop', elementKey: 'shop.toolbar.filter',
        sourceSection: 'toolbar', sourceSlot: 'icon-filter', sourceLabel: 'Filter products', coreIntent: 'nav.goto', domIntent: 'nav.goto',
        ctaMarkers: ['icon.filter'], intentHandler: 'client', targetType: 'page', targetId: 'shop',
        requiredCapabilities: [], missingCapabilities: [],
      },
      {
        bindingId: 'bind-shop-sort', pageId: 'shop', route: '/shop', elementKey: 'shop.toolbar.sort',
        sourceSection: 'toolbar', sourceSlot: 'icon-sort', sourceLabel: 'Sort products', coreIntent: 'nav.goto', domIntent: 'nav.goto',
        ctaMarkers: ['icon.sort'], intentHandler: 'client', targetType: 'page', targetId: 'shop',
        requiredCapabilities: [], missingCapabilities: [],
      },
    );
    const navLinks = pages.filter((page) => page.visibleInNav).map((page) => `<a href="#${page.route}">${page.title}</a>`).join('');
    const initialFiles = {
      ...baseFiles,
      '/.unison/compositions/pages/About.json': '{"pageId":"about","source":"canonical"}',
      '/src/App.tsx': 'export default function App(){return <></>}',
      '/src/project-components/site/SiteNav.tsx': `export function SiteNav(){return <header><nav>${navLinks}</nav></header>}`,
      '/src/project-components/site/SiteFooter.tsx': `export function SiteFooter(){return <footer>${navLinks}</footer>}`,
    };

    const result = await createTestBuilder({ authorSite, runComposer }).generate({
      operationId: 'deterministic-ecommerce', contract: appBuildContract, initialFiles,
      entryPoint: '/src/App.tsx', baseRevisionId: null, generationMode: 'deterministic',
    });

    expect(authorSite).not.toHaveBeenCalled();
    expect(runComposer).not.toHaveBeenCalled();
    expect(result.stopReason, result.candidate.diagnostics.join('\n')).toBe('complete');
    expect(result.candidate.status, JSON.stringify({
      diagnostics: result.candidate.diagnostics,
      issues: result.candidate.closure?.issues,
    }, null, 2)).toBe('ready-for-commit');
    expect(result.candidate.closure?.ok).toBe(true);
    expect(result.candidate.provenance).toMatchObject({ strategy: 'deterministic-scaffold', authoredPageIds: [] });
    expect(result.outcomes).toEqual([]);
    expect(result.candidateFiles['/src/pages/Checkout.tsx']).toContain('data-ut-cta="cta.nav-link"');
    expect(result.candidateFiles['/src/pages/Checkout.tsx']).toContain('data-ut-intent="nav.goto"');
    expect(result.candidateFiles['/src/pages/Checkout.tsx']).toContain('data-ut-path="/shop"');
    expect(result.candidateFiles['/src/pages/Shop.tsx']).toContain('data-ut-cta="cta.checkout"');
    expect(result.candidateFiles['/src/pages/Shop.tsx']).toContain('data-ut-intent="cart.checkout"');
    expect(result.candidateFiles['/src/pages/Home.tsx'].match(/data-ut-cta="icon\.cart"/g)).toHaveLength(2);
    expect(result.candidateFiles['/src/pages/Home.tsx']).toContain('data-ut-cta="icon.search"');
    expect(result.candidateFiles['/src/pages/Shop.tsx']).toContain('data-ut-cta="icon.favorite"');
    expect(result.candidateFiles['/src/pages/Shop.tsx']).toContain('data-ut-cta="icon.filter"');
    expect(result.candidateFiles['/src/pages/Shop.tsx']).toContain('data-ut-cta="icon.sort"');
    const aboutComposition = JSON.parse(result.candidateFiles['/.unison/compositions/pages/About.json']) as {
      compiledBy?: string;
      pageFilePath?: string;
      sections?: Array<{ sectionId: string; semanticType: string; sourcePath?: string }>;
    };
    const aboutSectionOrder = appBuildContract.design.compositionPlan.pages
      .find((page) => page.pageId === 'about')!.target.sectionOrder;
    expect(aboutComposition).toMatchObject({ compiledBy: 'app-builder', pageFilePath: '/src/pages/About.tsx' });
    expect(aboutComposition.sections?.filter((section) => section.sourcePath === '/src/pages/About.tsx')
      .map((section) => section.semanticType)).toEqual(aboutSectionOrder);
    expect(aboutComposition.sections?.filter((section) => section.sourcePath === '/src/pages/About.tsx')
      .map((section) => section.sectionId)).toEqual(expectedSectionIds('about', aboutSectionOrder));
    expect(aboutComposition.sections?.filter((section) => section.sectionId.startsWith('about:'))
      .every((section) => section.sourcePath === '/src/pages/About.tsx')).toBe(true);
    for (const page of pages) expect(result.candidateFiles[page.filePath]).toContain('<SiteNav />');
  });

  it('builds and materializes deterministic Home without invoking an AI provider', async () => {
    const businessName = 'App Builder Probe';
    const preset = THEME_PRESETS.find((candidate) => candidate.id === 'minimalist')!;
    const selections: WizardSelections = {
      visionPrompt: 'Informational seaside guesthouse showcase with a story link.',
      businessName,
      businessModel: 'portfolio_creator',
      industryOverlay: 'portfolio',
      systemType: 'portfolio',
      primaryGoal: 'showcase_work',
      secondaryGoals: [],
      needsBooking: false,
      sellsProducts: false,
      wantsLeadCapture: false,
      requestedPages: ['about'],
      scaffoldMode: 'selected-pages',
      templateId: 'portfolio-premium',
      themePresetId: preset.id,
      themeTokens: themePresetToThemeTokens(preset),
      wizardSeedId: 'deterministic-home-no-ai',
      businessId: 'business-1',
    };
    const launchPlan = buildCanonicalLaunchPlan(selections);
    const businessLaunchPlan = resolveBusinessLaunchPlan({
      industry: selections.industryOverlay,
      primaryGoal: 'showcase_work',
      customerNeeds: [],
      selectedPages: ['about'],
    });
    const homePage = launchPlan.sitePlan.pages.find((page) => page.isHome)!;
    const storyPage = launchPlan.sitePlan.pages.find((page) => page.route === '/about')!;
    const homeRegistryPage = launchPlan.playground.pageRegistry.pages[homePage.id];
    launchPlan.playground.bindings['bind-home-story'] = {
      bindingId: 'bind-home-story',
      sourcePageId: homePage.id,
      elementKey: `${homePage.id}.hero.story`,
      sourceSection: 'hero',
      sourceSlot: 'primary-cta',
      sourceLabel: 'The House Story',
      coreIntent: 'nav.goto',
      intent: 'nav.goto_page',
      targetId: storyPage.id,
      targetType: 'page',
      confidence: 1,
      source: 'wizard',
      isValid: true,
      readiness: 'preview-ready',
    } as never;
    const unrequestedActionIntents = new Set([
      'booking.create', 'newsletter.subscribe', 'cart.add', 'cart.checkout',
      'donation.start', 'quote.request', 'lead.capture', 'contact.submit', 'contact.call', 'contact.email',
    ]);
    const canonicalBindings = Object.values(launchPlan.playground.bindings)
      .filter((binding) => !binding.coreIntent || !unrequestedActionIntents.has(binding.coreIntent));
    const activeIntents = [...new Set(canonicalBindings.flatMap((binding) => binding.coreIntent ? [binding.coreIntent] : []))];
    const designContext = compileResolvedSiteDesignContext({
      industry: selections.industryOverlay,
      roles: launchPlan.sitePlan.pages.map((page) => page.role),
      artDirectionPackId: launchPlan.artDirection.storagePackId as never,
      experience: selections.designSelection?.experience,
      mode: selections.designSelection?.mode,
      designSeed: launchPlan.designIntervention.seed,
      businessModel: selections.businessModel,
    });
    const appContract = buildAppBuildContract({
      identity: { projectId: 'project-1', businessId: 'business-1', siteId: 'site-1', systemType: 'portfolio' },
      sitePlan: launchPlan.sitePlan,
      pageRegistry: launchPlan.playground.pageRegistry,
      industry: selections.industryOverlay,
      businessName,
      businessProfile: launchPlan.playground.creatorData.businessInfo,
      businessParameters: selections.businessParameters,
      canonicalBindings,
      registeredComponentInstances: Object.values(launchPlan.playground.creatorData.componentInstances),
      goals: [selections.primaryGoal],
      intents: activeIntents,
      capabilities: businessLaunchPlan.operationalCapabilities,
      bindingGuide: buildWizardBindingGuide(launchPlan.playground, {
        industry: selections.industryOverlay,
        enabledCapabilities: businessLaunchPlan.operationalCapabilities,
        activeIntents,
      }),
      seed: launchPlan.designIntervention.seed,
      themePresetId: launchPlan.themePresetId,
      themeTokens: selections.themeTokens,
      artDirection: launchPlan.artDirection,
      designContext,
      uiFoundation: launchPlan.uiFoundationContract,
      registryContext: launchPlan.registryContext,
      protectedPaths: [],
    });
    const authorSite = vi.fn();
    const runComposer = vi.fn();

    const result = await createTestBuilder({ authorSite, runComposer }).generate({
      operationId: 'deterministic-home-no-ai', contract: appContract, initialFiles: launchPlan.infrastructureFiles,
      entryPoint: '/src/main.tsx', baseRevisionId: null, generationMode: 'deterministic',
    });
    const normalizedHome = result.candidateFiles[homePage.filePath];
    const compositionPath = resolvedCompositionPathFor(homePage.filePath);
    const manifest = JSON.parse(result.candidateFiles['/.unison/design-source-manifest.json'] ?? '{}') as {
      implementations?: Record<string, { modulePath: string; sectionType: string; exportName?: string }>;
      eligibleByPage?: Record<string, string[]>;
    };
    const sharedShellIds = getAppBuilderSharedShellImplementationIds(result.candidateFiles, manifest.implementations ?? {});
    const materializationProbe = materializeAppBuilderSectionModelsWithDiagnostics(
      result.candidateFiles,
      [{ id: homePage.id, filePath: homePage.filePath, route: homePage.route }],
      manifest.implementations ?? {},
      manifest.eligibleByPage,
      sharedShellIds,
    );
    const composition = JSON.parse(result.candidateFiles[compositionPath] ?? 'null') as {
      compiledBy?: string;
      pageFilePath?: string;
      sections?: Array<{ sectionId: string; semanticType: string; variantId?: string; sourcePath?: string }>;
    };

    expect(authorSite).not.toHaveBeenCalled();
    expect(runComposer).not.toHaveBeenCalled();
    expect(result.stopReason, JSON.stringify({
      diagnostics: result.candidate.diagnostics,
      closureIssues: result.candidate.closure?.issues,
      eligibleByPage: manifest.eligibleByPage,
      sharedShellIds,
      materializationProbe: materializationProbe.pages,
      materializationDiagnostics: materializationProbe.diagnostics,
      sectionRoots: materializationProbe.pages[0]?.sourcePaths.map((path) => ({
        path,
        roots: [...(result.candidateFiles[path] ?? '').matchAll(/<(?:section|nav|header|footer)\b[^>]*>/g)].map((match) => match[0]),
      })),
      siteNav: result.candidateFiles['/src/project-components/site/SiteNav.tsx'],
      siteFooter: result.candidateFiles['/src/project-components/site/SiteFooter.tsx'],
      normalizedHome,
    }, null, 2)).toBe('complete');
    expect(result.candidate.status).toBe('ready-for-commit');
    expect(normalizedHome).toContain('data-ut-binding-id="bind-home-story"');
    expect(normalizedHome).toContain(`data-ut-target-id="${storyPage.id}"`);
    expect(normalizedHome).toContain('data-ut-path="/about"');
    expect(normalizedHome).not.toContain('data-ut-component-slug="contact-form"');
    expect(normalizedHome).not.toContain('data-ut-component-slug="newsletter-signup"');
    const homeSectionOrder = appContract.design.compositionPlan.pages
      .find((page) => page.pageId === homePage.id)!.target.sectionOrder;
    expect([...normalizedHome.matchAll(/<section\b[^>]*data-ut-section-id=/g)]).toHaveLength(homeSectionOrder.length);
    expect(composition).toMatchObject({ compiledBy: 'app-builder', pageFilePath: homePage.filePath });
    expect(composition.sections?.filter((section) => section.sourcePath === homePage.filePath)
      .map((section) => section.sectionId)).toEqual(expectedSectionIds(homePage.id, homeSectionOrder));
    expect(composition.sections?.every((section) => Boolean(section.variantId))).toBe(true);
    expect(composition.sections?.filter((section) => section.sectionId.startsWith(`${homePage.id}:`))
      .every((section) => section.sourcePath === '/src/pages/Home.tsx')).toBe(true);
    expect(composition.sections?.find((section) => section.sectionId === 'site:navbar')?.sourcePath)
      .toBe('/src/project-components/site/SiteNav.tsx');
    expect(composition.sections?.find((section) => section.sectionId === 'site:footer')?.sourcePath)
      .toBe('/src/project-components/site/SiteFooter.tsx');
  });

  it.each([true, false])('rechecks preview dependencies after closure repair (standalone: %s)', async (standalone) => {
    const previewFiles = { ...baseFiles,
      '/src/pages/Home.tsx': 'import Preview from "../marketplace/selectedPreview"; export default function Home(){return <Preview/>}',
      '/src/marketplace/selectedPreview.tsx': 'export default function Preview(){return <main>Lowtide House</main>}',
    };
    let repairedFiles = previewFiles;
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => {
      if (standalone) {
        repairedFiles = scaffoldAuthoredPages(contract(), {
          '/src/pages/Home.tsx': { body: '<p>Standalone Lowtide House</p>' },
        }, input.files);
      }
      return {
        files: input.files, outcomes: [{ page: input.pages[0], status: 'kept-baseline' as const, reason: 'gates_exhausted' as const, attempts: 1, errors: ['Still imports preview'] }],
      };
    });
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
      targetType: 'url', targetId: '/', requiredCapabilities: [], missingCapabilities: [],
    }];
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({
      files: scaffoldAuthoredPages(appContract, {}, input.files),
      revisionId: input.revisionId,
      outcomes: [{ page: input.pages[0], status: 'authored' as const, reason: 'accepted' as const, attempts: 1, errors: [] }],
    }));

    const result = await createTestBuilder({ authorSite }).generate({
      operationId: 'semantic-binding-closure', contract: appContract, initialFiles: baseFiles,
      entryPoint: '/src/main.tsx', baseRevisionId: null,
    });

    expect(result.candidate.status, JSON.stringify({
      diagnostics: result.candidate.diagnostics,
      issues: result.candidate.closure?.issues,
    }, null, 2)).toBe('ready-for-commit');
    expect(result.candidateFiles['/src/pages/Home.tsx']).toContain('data-ut-cta="icon.search"');
    expect(result.candidate.closure?.issues.some((issue) => issue.code === 'wizard-binding-marker-missing')).toBe(false);
    expect(result.candidate.graph?.pages).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'home', route: '/' }),
    ]));
    expect(result.candidate.graph?.aliases['page:/']).toBe('home');
    expect(authorSite.mock.calls[0]?.[0].runtimeContextForPage('home'))
      .toContain('CANONICAL PAGE NODE: persist page ID "home"');
  });

  it('accepts an AI-authored route link using canonical target-page metadata', async () => {
    const appContract = contract();
    appContract.topology.pageRegistry.pages = {
      home: {
        pageId: 'home', title: 'Home', path: '/', filePath: '/src/pages/Home.tsx',
        pageType: 'home', pageRole: 'home', isHome: true,
      } as never,
      'the-house': {
        pageId: 'the-house', title: 'The House', path: '/the-house', filePath: '/src/pages/TheHouse.tsx',
        pageType: 'about', pageRole: 'about', isHome: false,
      } as never,
    };
    appContract.business.intents = ['nav.goto'];
    appContract.business.bindingGuide = '- Page Home (/), slot hero.primary-cta: label "The House Story", marker data-ut-cta="cta.hero", intent nav.goto, target The House (/the-house)';
    appContract.business.intentBindings = [{
      bindingId: 'bind-home-house', pageId: 'home', route: '/', elementKey: 'home.hero.house-story',
      sourceSection: 'hero', sourceSlot: 'primary-cta', sourceLabel: 'The House Story',
      coreIntent: 'nav.goto', domIntent: 'nav.goto', ctaMarkers: ['cta.hero'], intentHandler: 'client',
      targetType: 'page', targetId: 'the-house', requiredCapabilities: [], missingCapabilities: [],
    }];
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({
      files: scaffoldAuthoredPages(appContract, {}, input.files),
      revisionId: input.revisionId,
      outcomes: [{ page: input.pages[0], status: 'authored' as const, reason: 'accepted' as const, attempts: 1, errors: [] }],
    }));

    const result = await createTestBuilder({ authorSite }).generate({
      operationId: 'canonical-page-target-binding', contract: appContract, initialFiles: baseFiles,
      entryPoint: '/src/main.tsx', baseRevisionId: null,
    });
    const home = result.candidateFiles['/src/pages/Home.tsx'];

    expect(result.candidate.status, JSON.stringify({ diagnostics: result.candidate.diagnostics, issues: result.candidate.closure?.issues }, null, 2))
      .toBe('ready-for-commit');
    expect(result.candidate.closure?.issues.some((issue) => issue.code === 'binding-marker-unresolved')).toBe(false);
    expect(home.match(/href="#\/the-house"/g)).toHaveLength(1);
    expect(home).toContain('data-ut-binding-id="bind-home-house"');
    expect(home).toContain('data-ut-target-id="the-house"');
    expect(home).toContain('data-ut-cta="cta.hero"');
    expect(home).toContain('data-ut-path="/the-house"');
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
      files: scaffoldAuthoredPages(contract(), { '/src/pages/Home.tsx': { body: '<p>After</p>' } }, input.files),
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
    await createUnisonAppBuilder({ authorSite, loadContentTypes }).generate({ operationId: 'scoped-generation', contract: contract(), initialFiles: baseFiles, entryPoint: '/src/main.tsx', baseRevisionId: 'accepted-revision-1' });
    expect(loadContentTypes).toHaveBeenCalledWith({ businessId: 'business-1', projectId: 'project-1' });
    expect(authorSite.mock.calls[0]?.[0].runtimeContextForPage?.('home')).toContain('content:articles');
    expect(authorSite.mock.calls[0]?.[0].runtimeContextForPage?.('home')).toContain('body:textarea');
  });
  it('skips CMS scope discovery before the first project revision is accepted', async () => {
    const loadContentTypes = vi.fn(async () => [{ id: 'article-type', api_key: 'articles', field_schema: { fields: [] } }]);
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({ files: input.files, revisionId: input.revisionId, outcomes: [] }));
    await createUnisonAppBuilder({ authorSite, loadContentTypes }).generate({
      operationId: 'fresh-launch-no-cms-scope', contract: contract(), initialFiles: baseFiles,
      entryPoint: '/src/main.tsx', baseRevisionId: null,
    });

    expect(loadContentTypes).not.toHaveBeenCalled();
  });
  it('continues authoring without optional CMS schema hints when scoped discovery fails', async () => {
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({
      files: scaffoldAuthoredPages(contract(), { '/src/pages/Home.tsx': { body: '<p>Authored without CMS hints</p>' } }, input.files),
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
    let repairedFiles: Record<string, string> = {};
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => {
      const brokenFiles = scaffoldAuthoredPages(contract(), {
        '/src/pages/Home.tsx': {
          imports: 'import Card from "../project-components/Card";',
          body: '<Card />',
        },
      }, input.files);
      repairedFiles = {
        ...brokenFiles,
        '/src/project-components/Card.tsx': 'export default function Card(){return <article>Card</article>}',
      };
      return {
        files: brokenFiles,
        revisionId: input.revisionId,
        outcomes: [{ page: input.pages[0], status: 'authored' as const, reason: 'accepted' as const, attempts: 1, errors: [] }],
      };
    });
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
    multiPage.design.compositionPlan = planSiteComposition('salon',
      multiPage.topology.sitePlan.pages.map((page) => ({ pageId: page.id, role: page.role })),
      'app-builder-test-multi-page',
      { artDirection: multiPage.design.resolvedSiteDesignContext.contract.artDirectionPackId, availableCapabilities: multiPage.business.capabilities },
    );
    let candidateFiles: Record<string, string> = {};
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => {
      candidateFiles = {
      ...scaffoldAuthoredPages(multiPage, {
        '/src/pages/Home.tsx': {
          imports: 'import Mark from "../project-components/Mark";',
          body: '<Mark />',
        },
        '/src/pages/Contact.tsx': { body: '<p>Contact us</p>' },
      }, input.files),
      '/src/project-components/Mark.tsx': 'export default function Mark(){return <span>Northstar</span>}',
      };
      return {
        files: candidateFiles,
        revisionId: input.revisionId,
        outcomes: input.pages.map((page) => ({ page, status: 'authored' as const, reason: 'accepted' as const, attempts: 1, errors: [] })),
      };
    });
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
    expect(firstCall?.[0].gatewayOptions).toEqual({ selectedModelId: 'google/gemini-3.8-flash', reasoningEffort: 'high', timeoutMs: 110_000 });
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
