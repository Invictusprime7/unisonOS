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
import {
  CANONICAL_COMPONENT_DEFINITIONS,
  createCanonicalComponentInstance,
  validateCanonicalComponentRegistry,
} from '@/services/canonicalComponentRegistry';
import { resolveComponentRuntimeContract } from '@/services/componentRuntimeContract';
import { buildAppBuilderGenerationContext } from '@/services/app-builder/appBuilderGenerationContext';
import type { PlaygroundBinding } from '@/platform/core/playground';

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
    businessParameters: {
      ownerEmail: 'owner@example.test',
      notificationEmail: 'owner@example.test',
      publicEmail: 'hello@example.test',
      phone: '+1 555 0100',
      ctaDestinations: { call: 'tel:+15550100', email: 'mailto:hello@example.test' },
      industry: { bookingType: 'consultation' },
    },
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
  it('verifies every approved canonical component against its runtime registry contract', () => {
    const issues = validateCanonicalComponentRegistry();
    expect(issues).toEqual([]);

    const input = makeInput();
    input.capabilities = [...new Set(CANONICAL_COMPONENT_DEFINITIONS.flatMap((definition) => definition.requiredCapabilities))];
    input.registeredComponentInstances = [];
    for (const definition of CANONICAL_COMPONENT_DEFINITIONS) {
      const component = createCanonicalComponentInstance(definition.slug, {
        usedOnPages: ['page-home'],
        bindings: Object.fromEntries(definition.requiredBindingKeys.map((key) => [key, `${key}-registered`])),
      });
      expect(component, definition.slug).not.toBeNull();
      const runtime = resolveComponentRuntimeContract(component!, definition.requiredCapabilities);
      expect(runtime, definition.slug).toMatchObject({
        componentSlug: definition.slug,
        requiredCapabilities: definition.requiredCapabilities,
        writeIntent: definition.writeIntent ?? null,
        slotBindings: definition.slotBindings,
        status: 'ready',
        blockers: [],
      });
      input.registeredComponentInstances.push(component!);
    }
    const contract = buildAppBuildContract(input);
    const registeredComponents = contract.business.registeredComponents;
    expect(registeredComponents.map((component) => component.runtime.componentSlug).sort())
      .toEqual(CANONICAL_COMPONENT_DEFINITIONS.map((definition) => definition.slug).sort());
    expect(registeredComponents.find((component) => component.runtime.componentSlug === 'booking-scheduler')?.nativeComponentTemplate)
      .toContain('data-ut-component-slug="booking-scheduler"');
    expect(registeredComponents.find((component) => component.runtime.componentSlug === 'booking-scheduler')?.nativeComponentTemplate)
      .toContain('name="serviceId"');
      const modelContext = buildAppBuilderGenerationContext(contract).runtimeContext.slice(0, 12_000);
      expect(modelContext).toContain('booking-scheduler');
      expect(modelContext).toContain('name="serviceId"');
      expect(modelContext).toContain('contact-form');
      expect(modelContext).toContain('newsletter-signup');
      expect(modelContext).toContain('PERSISTABLE SECTION CONTRACT');
      expect(modelContext).toContain('custom:<kebab-slug>');
  });

  it('fails closed instead of dropping an unknown registered component slug', () => {
    const input = makeInput();
    input.registeredComponentInstances = [{
      instanceId: 'cmp-unregistered', componentType: 'future-widget', componentSlug: 'future-widget',
      label: 'Future Widget', bindings: {}, props: {}, usedOnPages: [], status: 'ready',
    }];

    expect(() => buildAppBuildContract(input)).toThrow('component future-widget is not registered');
  });

  it('keeps canonical binding and component IDs together in page-scoped context', () => {
    const input = makeInput();
    input.capabilities = ['booking', 'contact'];
    const booking = createCanonicalComponentInstance('booking-scheduler', {
      usedOnPages: ['page-home'],
      bindings: { calendarId: 'calendar-home-1' },
    });
    const contactForm = createCanonicalComponentInstance('contact-form', {
      usedOnPages: ['page-contact'],
      bindings: { formId: 'form-contact-1' },
    });
    expect(booking).not.toBeNull();
    expect(contactForm).not.toBeNull();
    input.registeredComponentInstances = [booking!, contactForm!];
    input.canonicalBindings = [
      {
        bindingId: 'binding-home-booking', sourcePageId: 'page-home', sourceLabel: 'Book now',
        intent: 'calendar.open', targetId: 'calendar-home-1', targetType: 'calendar',
        confidence: 1, source: 'wizard', isValid: true, sourceSection: 'hero', sourceSlot: 'booking-submit',
        coreIntent: 'booking.create', requiredCapabilities: ['booking'],
      },
      {
        bindingId: 'binding-contact-form', sourcePageId: 'page-contact', sourceLabel: 'Send a message',
        intent: 'form.open', targetId: 'form-contact-1', targetType: 'form',
        confidence: 1, source: 'wizard', isValid: true, sourceSection: 'contact', sourceSlot: 'form-submit',
        coreIntent: 'contact.submit', requiredCapabilities: ['contact'],
      },
    ] satisfies PlaygroundBinding[];

    const contract = buildAppBuildContract(input);
    const generation = buildAppBuilderGenerationContext(contract);
    const homeContext = generation.runtimeContextForPage('page-home');
    const contactContext = generation.runtimeContextForPage('page-contact');

    expect(homeContext).toContain('binding-home-booking');
    expect(homeContext).toContain('calendar:calendar-home-1');
    expect(homeContext).toContain(`booking-scheduler instance ${booking!.instanceId}`);
    expect(homeContext).not.toContain('binding-contact-form');
    expect(homeContext).not.toContain(contactForm!.instanceId);
    expect(contactContext).toContain('binding-contact-form');
    expect(contactContext).toContain('form:form-contact-1');
    expect(contactContext).toContain(`contact-form instance ${contactForm!.instanceId}`);
    expect(contactContext).not.toContain('binding-home-booking');
    expect(contactContext).not.toContain(booking!.instanceId);
  });

  it('projects canonical icon CoreIntent into the App Builder contract despite a legacy UI intent', () => {
    const input = makeInput();
    input.canonicalBindings = [{
      bindingId: 'binding-search', sourcePageId: 'page-home', sourceLabel: 'Search',
      intent: 'nav.goto_page', targetId: 'search-panel', targetType: 'popup',
      confidence: 1, source: 'wizard', isValid: true, sourceSection: 'navbar', sourceSlot: 'icon-search',
      coreIntent: 'search.open', requiredCapabilities: [],
    }];

    const contract = buildAppBuildContract(input);
    const generationContext = buildAppBuilderGenerationContext(contract).runtimeContextForPage('page-home');

    expect(contract.business.intentBindings[0]).toMatchObject({
      bindingId: 'binding-search', coreIntent: 'search.open', domIntent: 'search.open',
      targetType: 'popup', targetId: 'search-panel',
    });
    const bindingLine = generationContext.split('\n').find((line) => line.includes('binding-search'));
    expect(bindingLine).toContain('DOM intent search.open');
    expect(bindingLine).toContain('target popup:search-panel');
    expect(bindingLine).not.toContain('DOM intent nav.goto');
  });

  it('keeps payment setup readiness from blocking checkout authoring', () => {
    const input = makeInput();
    const checkout = createCanonicalComponentInstance('checkout-cta', {
      usedOnPages: ['page-home'],
      bindings: { productId: 'product-1' },
    });
    expect(checkout).not.toBeNull();
    input.registeredComponentInstances = [checkout!];

    const context = buildAppBuilderGenerationContext(buildAppBuildContract(input)).runtimeContext;

    expect(context).toContain('checkout-cta');
    expect(context).toContain('data-intent-trigger="pay.checkout"');
    expect(context).toContain('PAYMENT SETUP IS A PUBLISH READINESS ITEM, NOT A SITE-AUTHORING FAILURE.');
    expect(context).toContain('preserve the registered checkout CTA and pay.checkout intent');
    expect(context).not.toContain('checkout-cta requires business fields:');
  });

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
    expect(contract.business.parameters).toEqual(expect.objectContaining({
      publicEmail: 'hello@example.test',
      phone: '+1 555 0100',
      ctaDestinations: { call: 'tel:+15550100', email: 'mailto:hello@example.test' },
    }));
    expect(contract.business.parameters).not.toHaveProperty('ownerEmail');
    expect(contract.business.configuredBusinessFields).toEqual(expect.arrayContaining(['ownerEmail', 'notificationEmail']));
    expect(contract.design.resolvedSiteDesignContext).toBe(input.designContext);
    expect(contract.design.resolvedSiteDesignContext.contract).toBe(input.designContext.contract);
    expect(contract.design.registryContext).toBe(input.registryContext);
    expect(contract.design.compositionPlan.pages.map((page) => page.pageId)).toEqual(['page-home', 'page-contact']);
    expect(contract.runtime.protectedPaths).toEqual(['/src/App.tsx', '/src/main.tsx']);
    expect(contract.runtime.availableRuntimeDependencies).toEqual(['react', 'react-dom']);
    expect(contract.runtime.approvedExperienceCapabilities).toEqual(['motion.core']);
    const generationContext = buildAppBuilderGenerationContext(contract);
    expect(generationContext.runtimeContext).toContain('Available runtime dependencies');
    expect(generationContext.runtimeContext).toContain('any valid browser npm package');
    expect(generationContext.runtimeContext).not.toContain('Work only within approved dependencies');
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

  it('prioritizes exact wizard slot markers before context that may be truncated', () => {
    const input = makeInput();
    input.bindingGuide = '- Page Home (/), slot navbar.icon-search: label "Search", marker data-ut-cta="icon.search", intent nav.goto, target /search';
    const runtimeContext = buildAppBuilderGenerationContext(buildAppBuildContract(input)).runtimeContext;

    expect(runtimeContext.startsWith('WIZARD BINDING MARKERS (HARD CANDIDATE ACCEPTANCE REQUIREMENTS)')).toBe(true);
    expect(runtimeContext.slice(0, 12_000)).toContain('data-ut-cta="icon.search"');
  });

  it('keeps private routing out of serialized contracts and generation context', () => {
    const input = makeInput();
    input.visionBrief = 'Send confirmations to owner-secret@example.test and crm-private-destination.';
    input.businessParameters = {
      ...input.businessParameters,
      ownerEmail: 'owner-secret@example.test',
      notificationEmail: 'owner-secret@example.test',
      notificationPhone: '+1-555-999-0000',
      crmDestination: 'crm-private-destination',
      bookingOwner: 'booking-owner-secret',
      paymentProvider: 'payment-private-provider',
      followUpChannel: 'private-followup-channel',
    };
    input.businessProfile = {
      businessName: 'Northstar Studio',
      email: 'hello@example.test',
      notificationEmail: 'owner-secret@example.test',
      notificationPhone: '+1-555-999-0000',
      crmDestination: 'crm-private-destination',
      bookingOwner: 'booking-owner-secret',
      paymentProvider: 'payment-private-provider',
      followUpChannel: 'private-followup-channel',
      customValues: { privateRecipient: 'owner-secret@example.test' },
    };

    const contract = buildAppBuildContract(input);
    const modelContext = buildAppBuilderGenerationContext(contract).runtimeContext;
    const serializedContract = serializeAppBuildContract(contract);

    for (const privateValue of [
      'owner-secret@example.test', '+1-555-999-0000', 'crm-private-destination',
      'booking-owner-secret', 'payment-private-provider', 'private-followup-channel',
    ]) {
      expect(serializedContract).not.toContain(privateValue);
      expect(modelContext).not.toContain(privateValue);
    }
    expect(modelContext).toContain('hello@example.test');
    expect(contract.business.configuredBusinessFields).toEqual(expect.arrayContaining([
      'notificationEmail', 'notificationPhone', 'crmDestination', 'bookingOwner', 'paymentProvider',
    ]));
  });

  it('joins a CRM form binding to its registered component and intent handler', () => {
    const input = makeInput();
    input.capabilities = ['contact'];
    input.intents = ['contact.submit'];
    input.businessParameters = {
      ownerEmail: 'owner@example.test',
      notificationEmail: 'owner@example.test',
      crmDestination: 'unison_crm',
    };
    input.registeredComponentInstances = [{
      instanceId: 'cmp-contact',
      componentType: 'contact-form',
      componentSlug: 'contact-form',
      label: 'Contact Form',
      category: 'leads',
      targetType: 'form',
      bindings: { formId: 'form-contact' },
      props: {},
      usedOnPages: ['page-contact'],
      requiredCapabilities: ['contact'],
      outputEvents: ['lead.created'],
      status: 'ready',
    }];
    input.canonicalBindings = [{
      bindingId: 'bind-contact',
      sourcePageId: 'page-contact',
      sourceLabel: 'Send message',
      intent: 'form.open',
      targetId: 'form-contact',
      targetType: 'form',
      confidence: 1,
      source: 'wizard',
      isValid: true,
      elementKey: 'contact.contact.form-submit',
      sourceSection: 'contact',
      sourceSlot: 'form-submit',
      coreIntent: 'contact.submit',
      uiAction: 'overlay',
      requiredCapabilities: ['contact'],
    }];

    const contract = buildAppBuildContract(input);

    expect(contract.business.registeredComponents).toEqual(expect.arrayContaining([
      expect.objectContaining({ runtime: expect.objectContaining({
        instanceId: 'cmp-contact', componentSlug: 'contact-form', writeIntent: 'contact.submit', status: 'ready',
      }) }),
    ]));
    expect(contract.business.intentBindings).toEqual([expect.objectContaining({
      bindingId: 'bind-contact',
      route: '/contact',
      coreIntent: 'contact.submit',
      domIntent: 'contact.submit',
      ctaMarkers: ['cta.form-submit'],
      intentHandler: 'intent-exec',
      componentInstanceId: 'cmp-contact',
      componentSlug: 'contact-form',
      componentWriteIntent: 'contact.submit',
      missingCapabilities: [],
    })]);
    const generationContext = buildAppBuilderGenerationContext(contract);
    expect(generationContext.runtimeContext).toContain('DOM intent contact.submit');
    expect(generationContext.runtimeContext).toContain('data-ut-cta="cta.form-submit"');
    expect(generationContext.runtimeContext).toContain('REGISTERED COMPONENT BLUEPRINTS');
    expect(generationContext.runtimeContext).toContain('data-ut-component-slug="contact-form"');
    expect(generationContext.runtimeContext).toContain('<form data-intent-form="contact.submit"');
    expect(generationContext.runtimeContext).toContain('name="message"');
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
