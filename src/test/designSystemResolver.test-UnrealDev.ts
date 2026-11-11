import { describe, expect, it } from 'vitest';
import { buildAppBuildContract, type BuildAppBuildContractInput } from '@/services/app-builder/appBuilderContracts';
import { resolveDesignSourceBundle } from '@/services/app-builder/design/designSystemResolver';
import type { WizardRegistryImplementationSummary } from '@/services/launch/wizardRegistryAggregation';
import { createBuilderPage, type PageRegistry } from '@/types/pageRegistry';
import type { GeneratedSitePlan } from '@/platform/core/siteTopologyPlanner';
import { compileResolvedSiteDesignContext } from '@/services/launch/resolvedSiteDesignContext';
import { projectResolvedArtDirection } from '@/sections/variants/resolvedArtDirection';

const at = '2026-09-30T12:00:00.000Z';
const home = createBuilderPage('page-home', 'Home', '/', 'home', { filePath: '/src/pages/Home.tsx', isHome: true, pageRole: 'home', createdAt: at, updatedAt: at });
const pageRegistry: PageRegistry = { pages: { [home.pageId]: home }, funnels: {}, homePageId: home.pageId, version: 1 };
const sitePlan: GeneratedSitePlan = {
  siteId: 's', industry: 'salon', businessName: 'N', homePageId: home.pageId,
  pages: [{ id: home.pageId, name: 'home', title: 'Home', route: '/', role: 'home', filePath: home.filePath!, visibleInNav: true, isHome: true, generatedBy: 'wizard' }],
  navItems: [home.pageId], funnels: [], redirects: [], generatedAt: at, selectedTemplateId: 't', selectedThemePresetId: 'editorial',
};

const impl = (id: string, sectionType: string, pageRoles: string[] = ['home'], certification: 'approved' | 'portable' = 'portable') =>
  ({ id, sectionType, name: id, certification, pageRoles, vocabularyRefs: [], radixPrimitives: [] }) as unknown as WizardRegistryImplementationSummary;

function makeInput(implementations: WizardRegistryImplementationSummary[], seed = 'seed'): BuildAppBuildContractInput {
  const designContext = compileResolvedSiteDesignContext({ designSeed: 'seed', businessModel: 'service_booking' as never, industry: 'salon', roles: ['home'] });
  const artDirection = projectResolvedArtDirection({ themePresetId: 'editorial', artDirectionPackId: designContext.contract.artDirectionPackId });
  if (!artDirection) throw new Error('art direction');
  return {
    identity: { projectId: 'p', businessId: 'b', siteId: 's', systemType: 'appointments' },
    sitePlan, pageRegistry, industry: 'salon', businessName: 'N', goals: [], intents: [], capabilities: [], bindingGuide: '',
    seed, themePresetId: 'editorial', themeTokens: {} as never, artDirection, designContext,
    uiFoundation: { version: '1.12', manifestPath: '/.unison/ui-manifest.json', importRoot: '@/unison/ui', runtimeProfile: 'react-18', experienceCapabilities: [] } as never,
    registryContext: {
      version: '2.0', generatedAt: at, industry: 'salon', templateId: 't', themePresetId: 'editorial', designRegistrySignature: 'sig',
      sections: [], artifacts: [], catalogSurfaces: [], motionPrimitives: [], implementations,
      runtimeDependencies: { react: '^18.3.1' },
    },
    protectedPaths: [],
  };
}

describe('DesignSystemResolver', () => {
  it('uses the composition role for a legacy Landing page without allowing unrelated roles', () => {
    const contract = buildAppBuildContract(makeInput([
      impl('hero:home', 'hero', ['home']), impl('hero:contact', 'hero', ['contact']),
    ]));
    contract.topology.sitePlan.pages = contract.topology.sitePlan.pages.map((page) => ({ ...page, role: 'landing' }));
    const bundle = resolveDesignSourceBundle(contract);
    expect(bundle.eligibleByPage['page-home']).toEqual(['hero:home']);
  });

  it('keeps composition-sealed families eligible across topology role aliases', () => {
    const contract = buildAppBuildContract(makeInput([
      impl('about:editorial-split', 'about', ['about']),
      impl('testimonials:grid', 'testimonials', ['about']),
      impl('hero:prisma-cinematic', 'hero', ['home']),
      impl('cta:gradient-banner', 'cta', ['home']),
    ]));
    contract.topology.sitePlan.pages = contract.topology.sitePlan.pages.map((page) => ({
      ...page,
      role: 'immersive',
    }));
    contract.design.compositionPlan = {
      ...contract.design.compositionPlan,
      pages: contract.design.compositionPlan.pages.map((page) => page.pageId === 'page-home'
        ? { ...page, target: { ...page.target, sectionOrder: ['hero', 'about', 'testimonials', 'cta'] } }
        : page),
    };

    const bundle = resolveDesignSourceBundle(contract);

    expect(bundle.eligibleByPage['page-home']).toEqual(expect.arrayContaining([
      'about:editorial-split',
      'testimonials:grid',
      'hero:prisma-cinematic',
      'cta:gradient-banner',
    ]));
  });

  it('derives sourceSelection from the sealed registry context', () => {
    const contract = buildAppBuildContract(makeInput([impl('hero:b', 'hero'), impl('hero:a', 'hero', ['home'], 'approved')]));
    expect(contract.design.sourceSelection.implementationIds).toEqual(['hero:a', 'hero:b']);
    expect(contract.design.sourceSelection.portableRecipeIds).toEqual(['hero:b']);
  });

  it('is deterministic, role-scoped, and excludes generic ids when richer ones exist', () => {
    const impls = [
      impl('hero:generic', 'hero'), impl('hero:prisma-cinematic', 'hero'),
      impl('services:generic', 'services'),
      impl('gallery:case-study', 'gallery', ['about']),
    ];
    const contract = buildAppBuildContract(makeInput(impls));
    const bundle = resolveDesignSourceBundle(contract);
    expect(bundle).toEqual(resolveDesignSourceBundle(contract));
    expect(bundle.eligibleByPage['page-home']).toContain('hero:prisma-cinematic');
    expect(bundle.eligibleByPage['page-home']).not.toContain('hero:generic');
    expect(bundle.eligibleByPage['page-home']).toContain('services:generic');
    expect(bundle.eligibleByPage['page-home']).not.toContain('gallery:case-study');
    expect(bundle.implementations.map((i) => i.implementationId)).not.toContain('gallery:case-study');
    expect(bundle.dependencies).toEqual({ react: '^18.3.1' });
  });
});

describe('AppBuilderGenerationContext (R0/R1)', () => {
  it('requires original body design while keeping forms on-system and chat opt-in', async () => {
    const { buildAppBuilderGenerationContext } = await import('@/services/app-builder/appBuilderGenerationContext');
    const context = buildAppBuilderGenerationContext(buildAppBuildContract(makeInput([])));

    expect(context.runtimeContext).toContain('@/unison/ui/form-fields');
    expect(context.runtimeContext).toContain('ORIGINAL BODY DESIGN IS REQUIRED');
    expect(context.runtimeContext).toContain('Do not import or render registry design-source modules');
    expect(context.runtimeContext).toContain('A contact, quote, newsletter, or lead-capture form does not imply a floating chat widget');
    expect(context.runtimeContext).toContain('registered intents and exact Wizard CTA markers');
  });

  it('derives runtime policy from the contract and reports design-source usage', async () => {
    const { buildAppBuilderGenerationContext, reportDesignSourceUsage } = await import('@/services/app-builder/appBuilderGenerationContext');
    const contract = buildAppBuildContract(makeInput([impl('hero:prisma-cinematic', 'hero'), impl('hero:generic', 'hero')]));
    const ctx = buildAppBuilderGenerationContext(contract);
    expect(ctx.runtimeContext).toContain('Available runtime dependencies (already pinned for this site): react');
    expect(ctx.runtimeContext).toContain('CANONICAL ICON CONTEXT');
    expect(ctx.runtimeContext).toContain('CANONICAL LOGO CONTRACT');
    expect(ctx.runtimeContext).toContain('owner-authored entries');
    expect(ctx.runtimeContext).toContain('render the text wordmark');
    const used = reportDesignSourceUsage(contract, ctx.designSources, { '/src/pages/Home.tsx': 'data-ut-variant="hero:prisma-cinematic"' });
    expect(used.referencedPerPage['page-home']).toEqual(['hero:prisma-cinematic']);
    const bare = reportDesignSourceUsage(contract, ctx.designSources, { '/src/pages/Home.tsx': '<Section/>' });
    expect(bare.primitiveOnlyPages).toEqual(['page-home']);
  });

  it('keeps seeded variant eligibility deterministic without exposing renderable registry variants', async () => {
    const { buildAppBuilderGenerationContext } = await import('@/services/app-builder/appBuilderGenerationContext');
    const implementations = [
      impl('hero:alpha', 'hero'), impl('hero:beta', 'hero'), impl('hero:gamma', 'hero'),
      impl('services:alpha', 'services'), impl('services:beta', 'services'),
    ];
    const contextFor = (seed: string) => buildAppBuilderGenerationContext(
      buildAppBuildContract(makeInput(implementations, seed)),
    );
    const heroEligibility = (seed: string) => contextFor(seed).designSources.eligibleByPage['page-home']
      .filter(id => id.startsWith('hero:'));
    const first = contextFor('project-seed-a');
    const firstPrompt = first.runtimeContextForPage('page-home', 12_000);

    expect(firstPrompt).toContain('READ-ONLY REGISTRY VOCABULARY');
    expect(firstPrompt).toContain('PAGE-SCOPED REGISTRY CONTEXT');
    expect(firstPrompt).toContain('Do not use registered variants from other pages');
    expect(firstPrompt).toContain('ORIGINAL BODY DESIGN IS REQUIRED');
    expect(firstPrompt).toContain('Forms are interaction widgets, not body-section layouts');
    expect(firstPrompt).toContain('Every section must render meaningful visible content');
    expect(firstPrompt).not.toContain('hero:alpha');
    expect(new Set(heroEligibility('project-seed-a'))).toEqual(new Set(['hero:alpha', 'hero:beta', 'hero:gamma']));
    expect(heroEligibility('project-seed-a')).toEqual(heroEligibility('project-seed-a'));
    expect(new Set(['project-seed-a', 'project-seed-b', 'project-seed-c', 'project-seed-d', 'project-seed-e']
      .map(seed => heroEligibility(seed).join(','))).size).toBeGreaterThan(1);
  });

  it('does not expose another page\'s implementations when this page has no eligible sources', async () => {
    const { buildAppBuilderGenerationContext } = await import('@/services/app-builder/appBuilderGenerationContext');
    const contract = buildAppBuildContract(makeInput([impl('hero:home-only', 'hero', ['home'])]));
    const homePage = contract.topology.sitePlan.pages[0];
    contract.topology.sitePlan.pages.push({
      ...homePage,
      id: 'page-blog',
      name: 'blog',
      title: 'Blog',
      route: '/blog',
      filePath: '/src/pages/Blog.tsx',
      role: 'blog',
      visibleInNav: true,
      isHome: false,
    });

    const pageContext = buildAppBuilderGenerationContext(contract).runtimeContextForPage('page-blog');

    expect(pageContext).toContain('no certified design-source implementations are eligible for this page');
    expect(pageContext).not.toContain('eligible families (hero)');
    expect(pageContext).not.toContain('hero:home-only');
  });

  it('projects registered component capabilities onto only their bound page', async () => {
    const { buildAppBuilderGenerationContext } = await import('@/services/app-builder/appBuilderGenerationContext');
    const contract = buildAppBuildContract(makeInput([
      impl('hero:home-approved', 'hero', ['home'], 'approved'),
      impl('hero:pricing-only', 'hero', ['pricing'], 'approved'),
    ]));
    contract.business.capabilities = ['contact'];
    contract.business.registeredComponents = [{
      runtime: {
        instanceId: 'cmp-contact', componentSlug: 'contact-form', usedOnPages: ['page-home'],
        requiredCapabilities: ['contact'], catalogSurfaces: [], writeIntent: 'contact.submit',
        slotBindings: ['form-submit'], status: 'ready', blockers: [],
      },
      label: 'Contact form', targetType: 'form', instanceStatus: 'ready',
      bindings: { formId: 'form-contact' }, requiredBindingKeys: ['formId'],
      requiredNativeFormFields: ['name', 'email', 'message'], formFields: [],
      requiredBusinessFields: [], requiredSetupSteps: [],
    } as never];
    contract.business.intentBindings = [{
      bindingId: 'binding-contact', pageId: 'page-home', route: '/',
      sourceSection: 'contact', sourceSlot: 'form-submit', sourceLabel: 'Send',
      coreIntent: 'contact.submit', domIntent: 'contact.submit', ctaMarkers: ['cta.form-submit'],
      intentHandler: 'intent-exec', targetType: 'form', targetId: 'form-contact',
      requiredCapabilities: ['contact'], missingCapabilities: [], componentInstanceId: 'cmp-contact',
      componentSlug: 'contact-form', componentWriteIntent: 'contact.submit',
    } as never];

    const context = buildAppBuilderGenerationContext(contract);
    const home = context.runtimeContextForPage('page-home', 12_000);
    const unrelated = context.runtimeContextForPage('unrelated-page', 12_000);

    expect(home).toContain('VERIFIED COMPONENT-CAPABILITY PROJECTION');
    expect(home).toContain('ORIGINAL BODY DESIGN IS REQUIRED');
    expect(home).toContain('custom:<kebab-slug>');
    expect(home).toContain('Do not import or render registry design-source modules');
    expect(home).toContain('cmp-contact');
    expect(home).toContain('required capabilities contact');
    expect(home).toContain('form-contact');
    expect(home).toContain('binding-contact');
    expect(home).toContain('intent-exec');
    expect(home).toContain('cta.form-submit');
    expect(home).not.toContain('Preserve every planned section');
    expect(home).toContain('READ-ONLY REGISTRY VOCABULARY: available semantic families are hero');
    expect(home).not.toContain('hero:pricing-only');
    expect(unrelated).not.toContain('cmp-contact');
    expect(unrelated).not.toContain('form-contact');
    expect(unrelated).not.toContain('hero:home-approved');
  });
});
