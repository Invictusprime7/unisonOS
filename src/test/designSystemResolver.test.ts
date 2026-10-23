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

function makeInput(implementations: WizardRegistryImplementationSummary[]): BuildAppBuildContractInput {
  const designContext = compileResolvedSiteDesignContext({ designSeed: 'seed', businessModel: 'service_booking' as never, industry: 'salon', roles: ['home'] });
  const artDirection = projectResolvedArtDirection({ themePresetId: 'editorial', artDirectionPackId: designContext.contract.artDirectionPackId });
  if (!artDirection) throw new Error('art direction');
  return {
    identity: { projectId: 'p', businessId: 'b', siteId: 's', systemType: 'appointments' },
    sitePlan, pageRegistry, industry: 'salon', businessName: 'N', goals: [], intents: [], capabilities: [], bindingGuide: '',
    seed: 'seed', themePresetId: 'editorial', themeTokens: {} as never, artDirection, designContext,
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
  it('keeps generated forms on the design system and chat opt-in', async () => {
    const { buildAppBuilderGenerationContext } = await import('@/services/app-builder/appBuilderGenerationContext');
    const context = buildAppBuilderGenerationContext(buildAppBuildContract(makeInput([])));

    expect(context.runtimeContext).toContain('@/unison/ui/form-fields');
    expect(context.runtimeContext).toContain('page-eligible certified design-source implementation');
    expect(context.runtimeContext).toContain('Registered 21st.dev-derived designs may only be used through certified');
    expect(context.runtimeContext).toContain('A contact, quote, newsletter, or lead-capture form does not imply a floating chat widget');
    expect(context.runtimeContext).toContain('registered intents and exact Wizard CTA markers');
  });

  it('derives runtime policy from the contract and reports design-source usage', async () => {
    const { buildAppBuilderGenerationContext, reportDesignSourceUsage } = await import('@/services/app-builder/appBuilderGenerationContext');
    const contract = buildAppBuildContract(makeInput([impl('hero:prisma-cinematic', 'hero'), impl('hero:generic', 'hero')]));
    const ctx = buildAppBuilderGenerationContext(contract);
    expect(ctx.runtimeContext).toContain('Approved dependencies: react');
    expect(ctx.runtimeContext).toContain('CANONICAL ICON CONTEXT');
    expect(ctx.runtimeContext).toContain('CANONICAL LOGO CONTRACT');
    expect(ctx.runtimeContext).toContain('owner-authored entries');
    expect(ctx.runtimeContext).toContain('render the text wordmark');
    const used = reportDesignSourceUsage(contract, ctx.designSources, { '/src/pages/Home.tsx': 'data-ut-variant="hero:prisma-cinematic"' });
    expect(used.referencedPerPage['page-home']).toEqual(['hero:prisma-cinematic']);
    const bare = reportDesignSourceUsage(contract, ctx.designSources, { '/src/pages/Home.tsx': '<Section/>' });
    expect(bare.primitiveOnlyPages).toEqual(['page-home']);
  });
});
