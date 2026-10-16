import { describe, expect, it } from 'vitest';
import { createBuilderPage, type PageRegistry } from '@/types/pageRegistry';
import type { GeneratedSitePlan } from '@/platform/core/siteTopologyPlanner';
import { compileResolvedSiteDesignContext } from '@/services/launch/resolvedSiteDesignContext';
import { projectResolvedArtDirection } from '@/sections/variants/resolvedArtDirection';
import {
  APP_BUILDER_PROTOCOL_VERSION,
  buildAppBuildContract,
  parseAppBuildContract,
  serializeAppBuildContract,
  type BuildAppBuildContractInput,
} from '@/services/app-builder/appBuilderContracts';

const createdAt = '2026-09-30T12:00:00.000Z';
const home = createBuilderPage('page-home', 'Home', '/', 'home', {
  filePath: '/src/pages/Home.tsx',
  isHome: true,
  pageRole: 'home',
  createdAt,
  updatedAt: createdAt,
});
const contact = createBuilderPage('page-contact', 'Contact', '/contact', 'contact', {
  filePath: '/src/pages/Contact.tsx',
  pageRole: 'contact',
  createdAt,
  updatedAt: createdAt,
});

const pageRegistry: PageRegistry = {
  pages: { [home.pageId]: home, [contact.pageId]: contact },
  funnels: {},
  homePageId: home.pageId,
  version: 1,
};

const sitePlan: GeneratedSitePlan = {
  siteId: 'site-1',
  industry: 'salon',
  businessName: 'Northstar Studio',
  homePageId: home.pageId,
  pages: [
    { id: home.pageId, name: 'home', title: 'Home', route: '/', role: 'home', filePath: home.filePath!, visibleInNav: true, isHome: true, generatedBy: 'wizard' },
    { id: contact.pageId, name: 'contact', title: 'Contact', route: '/contact', role: 'contact', filePath: contact.filePath!, visibleInNav: true, isHome: false, generatedBy: 'wizard' },
  ],
  navItems: [home.pageId, contact.pageId],
  funnels: [],
  redirects: [],
  generatedAt: createdAt,
  selectedTemplateId: 'salon-editorial',
  selectedThemePresetId: 'editorial',
};

function makeInput(): BuildAppBuildContractInput {
  const designContext = compileResolvedSiteDesignContext({
    designSeed: 'northstar:seed',
    businessModel: 'service_booking' as never,
    industry: 'salon',
    roles: ['home', 'contact'],
  });
  const artDirection = projectResolvedArtDirection({
    themePresetId: 'editorial',
    artDirectionPackId: designContext.contract.artDirectionPackId,
  });
  if (!artDirection) throw new Error('Expected a registered art direction.');
  return {
    identity: { projectId: 'project-1', businessId: 'business-1', siteId: 'site-1', systemType: 'appointments' },
    sitePlan,
    pageRegistry,
    industry: 'salon',
    businessName: 'Northstar Studio',
    goals: ['book_appointments', 'build_trust'],
    intents: ['booking.create', 'nav.goto'],
    capabilities: ['booking'],
    bindingGuide: 'Bind booking.create to the primary CTA.',
    seed: 'northstar:seed',
    themePresetId: 'editorial',
    themeTokens: {
      colors: {
        primary: '10 20% 30%', primaryForeground: '0 0% 100%',
        secondary: '20 30% 40%', secondaryForeground: '0 0% 100%',
        accent: '30 40% 50%', accentForeground: '0 0% 100%',
        background: '0 0% 100%', foreground: '0 0% 0%', muted: '0 0% 95%',
        mutedForeground: '0 0% 40%', card: '0 0% 100%', cardForeground: '0 0% 0%', border: '0 0% 90%',
      },
      typography: { headingFont: 'serif', bodyFont: 'sans-serif', headingWeight: '700', bodyWeight: '400' },
      radius: '0.5rem', sectionPadding: '5rem 1rem', containerWidth: '1200px',
    },
    artDirection,
    designContext,
    uiFoundation: {
      version: '1.12',
      manifestPath: '/.unison/ui-manifest.json',
      importRoot: '@/unison/ui',
      runtimeProfile: 'react-18',
      experienceCapabilities: ['motion.core'],
      approvedExperienceCapabilities: ['motion.core'],
    },
    registryContext: {
      version: '2.0',
      generatedAt: createdAt,
      industry: 'salon',
      templateId: 'salon-editorial',
      themePresetId: 'editorial',
      designRegistrySignature: 'registry-1',
      sections: [], artifacts: [], catalogSurfaces: [], motionPrimitives: [],
      runtimeDependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
    },
    protectedPaths: ['/src/main.tsx', '/src/App.tsx', '/src/main.tsx'],
  };
}

describe('AppBuildContract', () => {
  it('derives topology, design, runtime and registry context without a second schema', () => {
    const input = makeInput();
    const contract = buildAppBuildContract(input);

    expect(contract.protocolVersion).toBe(APP_BUILDER_PROTOCOL_VERSION);
    expect(contract.topology.sitePlan).toBe(input.sitePlan);
    expect(contract.topology.pageRegistry).toBe(input.pageRegistry);
    expect(contract.business.branding.brandMark).toEqual(expect.objectContaining({
      source: { kind: 'business-profile', field: 'logoUrl' },
      placements: [{ artifactId: 'navbar', slotId: 'navbar.brand' }, { artifactId: 'footer', slotId: 'footer.brand' }],
      accessibleName: input.businessName,
      missingAssetFallback: { kind: 'text-wordmark', text: input.businessName },
    }));
    expect(contract.business.branding.logoCloud).toEqual(expect.objectContaining({
      artifactId: 'logo-cloud', source: 'owner-authored', minimumItems: 4,
      emptyBehavior: 'hide_section', generatedEntriesAllowed: false,
    }));
    expect(contract.design.resolvedSiteDesignContext).toBe(input.designContext);
    expect(contract.design.resolvedSiteDesignContext.contract).toBe(input.designContext.contract);
    expect(contract.design.registryContext).toBe(input.registryContext);
    expect(contract.design.compositionPlan.pages.map((page) => page.pageId)).toEqual(['page-home', 'page-contact']);
    expect(contract.runtime.protectedPaths).toEqual(['/src/App.tsx', '/src/main.tsx']);
    expect(contract.runtime.approvedDependencies).toEqual(['react', 'react-dom']);
    expect(contract.runtime.approvedExperienceCapabilities).toEqual(['motion.core']);
  });

  it('serializes deterministically and round-trips the versioned contract', () => {
    const contract = buildAppBuildContract(makeInput());
    const first = serializeAppBuildContract(contract);
    const second = serializeAppBuildContract(buildAppBuildContract(makeInput()));
    const parsed = parseAppBuildContract(first);

    expect(first).toBe(second);
    expect(parsed).toEqual(contract);
    expect(serializeAppBuildContract(parsed)).toBe(first);
  });

  it('rejects unknown protocol versions and incomplete topology', () => {
    const contract = buildAppBuildContract(makeInput());
    expect(() => parseAppBuildContract(JSON.stringify({ ...contract, protocolVersion: 'unison-app-builder/unsupported' }))).toThrow('Unsupported AppBuildContract protocol');
    expect(() => parseAppBuildContract(JSON.stringify({
      ...contract,
      topology: { ...contract.topology, sitePlan: { ...contract.topology.sitePlan, pages: [] } },
    }))).toThrow('topology must include at least one page');
  });

  it('rejects contracts without the explicit logo contract', () => {
    const contract = buildAppBuildContract(makeInput());
    const { branding: _branding, ...business } = contract.business;
    expect(() => parseAppBuildContract(JSON.stringify({ ...contract, business })))
      .toThrow('valid logo and brand-mark contract');
  });

  it('rejects logo rules that drift from the canonical artifact registry', () => {
    const contract = buildAppBuildContract(makeInput());
    const tampered = {
      ...contract,
      business: {
        ...contract.business,
        branding: {
          ...contract.business.branding,
          brandMark: { ...contract.business.branding.brandMark, placements: [] },
        },
      },
    };
    expect(() => parseAppBuildContract(JSON.stringify(tampered)))
      .toThrow('logo rules must match the canonical artifact registry');
  });
});
