import { describe, expect, it } from 'vitest';
import { compileResolvedSiteDesignContext } from '@/services/launch/resolvedSiteDesignContext';
import { validateAppBuildCandidate } from '@/services/app-builder/appBuilderCandidate';
import { materializeRegisteredComponents } from '@/services/app-builder/registeredComponentMaterializer';
import { APP_BUILDER_PROTOCOL_VERSION, type AppBuildContract } from '@/services/app-builder/appBuilderContracts';
import { getCanonicalComponentDefinition } from '@/services/canonicalComponentRegistry';
import { materializeAppBuilderSectionModels } from '@/services/app-builder/appBuilderSectionModel';

function contract(): AppBuildContract {
  const resolvedSiteDesignContext = compileResolvedSiteDesignContext({
    designSeed: 'candidate-closure', businessModel: 'general' as never,
    industry: 'salon', roles: ['home', 'contact'],
  });
  return {
    protocolVersion: APP_BUILDER_PROTOCOL_VERSION,
    identity: { projectId: 'project-1', businessId: 'business-1', siteId: 'site-1', systemType: 'website' },
    topology: {
      sitePlan: {
        siteId: 'topology-1', industry: 'salon', businessName: 'Northstar', homePageId: 'home',
        pages: [
          { id: 'home', name: 'home', title: 'Home', route: '/', role: 'home', filePath: '/src/pages/Home.tsx', visibleInNav: true, isHome: true, generatedBy: 'wizard' },
          { id: 'contact', name: 'contact', title: 'Contact', route: '/contact', role: 'contact', filePath: '/src/pages/Contact.tsx', visibleInNav: true, isHome: false, generatedBy: 'wizard' },
        ],
        navItems: ['home', 'contact'], funnels: [], redirects: [], generatedAt: '2026-09-30T12:00:00.000Z',
      },
      pageRegistry: { pages: {}, funnels: {}, homePageId: 'home', version: 1 },
    },
    business: {
      industry: 'salon', businessName: 'Northstar', goals: [], intents: [], capabilities: [], bindingGuide: '',
      parameters: {}, configuredBusinessFields: [], registeredComponents: [], intentBindings: [],
      businessProfile: { businessName: 'Northstar' },
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
      seed: 'candidate-closure', themePresetId: 'editorial', themeTokens: {} as never,
      artDirection: {} as never, resolvedSiteDesignContext, uiFoundation: {} as never,
      registryContext: {} as never, compositionPlan: { industryId: 'salon', seed: 'candidate-closure', pages: [] },
      sourceSelection: { implementationIds: [], portableRecipeIds: [], primitiveFamilyIds: [], experiencePrimitiveIds: [], pageCompositionIds: [] },
    },
    runtime: {
      framework: 'react-vite', language: 'typescript', styling: 'tailwind',
      protectedPaths: ['/src/main.tsx'], approvedDependencies: [], approvedExperienceCapabilities: [],
    },
  };
}

const initialFiles = {
  '/src/main.tsx': 'import React from "react";',
  '/src/pages/Home.tsx': 'export default function Home(){return <main>Baseline</main>}',
  '/src/pages/Contact.tsx': 'export default function Contact(){return <main>Baseline</main>}',
};

function bookingContract(): AppBuildContract {
  const value = contract();
  value.business.capabilities = ['booking'];
  value.business.configuredBusinessFields = ['notificationEmail', 'bookingOwner'];
  value.topology.sitePlan.pages.push({
    id: 'booking', name: 'booking', title: 'Booking', route: '/booking', role: 'booking',
    filePath: '/src/pages/Booking.tsx', visibleInNav: true, isHome: false, generatedBy: 'wizard',
  });
  value.business.registeredComponents = [{
    runtime: {
      instanceId: 'cmp-booking', componentSlug: 'booking-scheduler', usedOnPages: ['booking'],
      requiredCapabilities: ['booking'], catalogSurfaces: ['services', 'availability_slots'],
      writeIntent: 'booking.create', slotBindings: ['form-submit', 'primary-cta', 'card-cta'], status: 'ready', blockers: [],
    },
    label: 'Booking Scheduler', targetType: 'calendar', instanceStatus: 'ready',
    bindings: { calendarId: 'calendar-main' }, requiredBindingKeys: ['calendarId'],
    nativeComponentTemplate: getCanonicalComponentDefinition('booking-scheduler')!.htmlTemplate,
    requiredBusinessFields: ['notificationEmail', 'bookingOwner'],
    requiredNativeFormFields: ['serviceId', 'slotId', 'customerName', 'customerEmail'],
    requiredSetupSteps: ['booking_calendar'],
  }];
  return value;
}

function registeredComponentFixture(slug: string, instanceId: string, pageId: string, bindings: Record<string, string>) {
  const definition = getCanonicalComponentDefinition(slug)!;
  return {
    runtime: {
      instanceId,
      componentSlug: slug,
      usedOnPages: [pageId],
      requiredCapabilities: [...definition.requiredCapabilities],
      catalogSurfaces: [...(definition.catalogSurfaces ?? [])],
      writeIntent: definition.writeIntent ?? null,
      slotBindings: [...definition.slotBindings],
      status: 'ready' as const,
      blockers: [],
    },
    label: definition.name,
    targetType: definition.targetType,
    instanceStatus: 'ready' as const,
    bindings,
    requiredBindingKeys: [...definition.requiredBindingKeys],
    requiredWhenCapabilitiesEnabled: [...(definition.requiredWhenCapabilitiesEnabled ?? [])],
    requiredNativeFormFields: [...(definition.requiredNativeFormFields ?? [])],
    nativeComponentTemplate: definition.htmlTemplate,
    requiredBusinessFields: [...(definition.requiredBusinessFields ?? [])],
    requiredSetupSteps: [...(definition.requiredSetupSteps ?? [])],
  };
}

function contactCrmContract(): AppBuildContract {
  const value = contract();
  value.business.capabilities = ['contact'];
  value.business.intents = ['contact.submit'];
  value.business.parameters = {
    publicEmail: 'hello@example.test',
  };
  value.business.configuredBusinessFields = ['notificationEmail', 'crmDestination', 'bookingOwner'];
  value.business.businessProfile = {
    businessName: 'Northstar',
  };
  value.business.bindingGuide = '- Page Contact (/contact), slot contact.form-submit: label "Send", marker data-ut-cta="cta.form-submit", intent contact.submit, target form-contact';
  value.business.registeredComponents = [{
    runtime: {
      instanceId: 'cmp-contact', componentSlug: 'contact-form', usedOnPages: ['contact'],
      requiredCapabilities: ['contact'], catalogSurfaces: [], writeIntent: 'contact.submit',
      slotBindings: ['form-submit'], status: 'ready', blockers: [],
    },
    label: 'Contact Form', targetType: 'form', instanceStatus: 'ready', bindings: { formId: 'form-contact' },
    requiredBindingKeys: ['formId'], requiredSetupSteps: [],
    requiredBusinessFields: ['notificationEmail', 'crmDestination'],
  }];
  value.business.intentBindings = [{
    bindingId: 'bind-contact', pageId: 'contact', route: '/contact',
    elementKey: 'contact.contact.form-submit', sourceSection: 'contact', sourceSlot: 'form-submit',
    coreIntent: 'contact.submit', domIntent: 'contact.submit', intentHandler: 'site-runtime', targetType: 'form', targetId: 'form-contact',
    requiredCapabilities: ['contact'], missingCapabilities: [], componentInstanceId: 'cmp-contact',
    componentSlug: 'contact-form', componentWriteIntent: 'contact.submit',
  }];
  return value;
}

const contactCrmPage = '<section data-ut-component-slug="contact-form"><form data-intent-form="contact.submit"><input name="name" /><input name="email" /><button type="submit" data-ut-cta="cta.form-submit">Send</button></form></section>';

describe('App Builder candidate closure', () => {
  it('reports missing page bodies without cascading source-dependent binding blockers', async () => {
    const missingPageSources = contract();
    missingPageSources.business.bindingGuide = '- Page Home (/), slot hero.primary-cta: label "Contact", marker data-ut-cta="cta.hero", intent contact.submit, target /contact';
    const report = await validateAppBuildCandidate({
      contract: missingPageSources,
      files: { '/src/main.tsx': initialFiles['/src/main.tsx'] },
      initialFiles,
    });

    expect(report.issues.filter((issue) => issue.code === 'page-body-missing').map((issue) => issue.path))
      .toEqual(['/src/pages/Home.tsx', '/src/pages/Contact.tsx']);
    expect(report.issues.some((issue) => issue.code === 'wizard-binding-marker-missing')).toBe(false);
  });

  it('materializes registered booking forms on assigned pages before candidate closure', () => {
    const booking = bookingContract();
    const files = {
      ...initialFiles,
      '/src/pages/Booking.tsx': 'export default function Booking(){return <div className="page"><h1>Schedule a viewing</h1></div>}',
    };

    const first = materializeRegisteredComponents(booking, files);
    const second = materializeRegisteredComponents(booking, first.files);
    const bookingPage = first.files['/src/pages/Booking.tsx'];

    expect(bookingPage).toContain('data-ut-component-slug="booking-scheduler"');
    expect(bookingPage).toContain('data-ut-component-instance-id="cmp-booking"');
    expect(bookingPage).toContain('<form data-intent-form="booking.create"');
    expect(bookingPage).toContain('name="serviceId"');
    expect(bookingPage).toContain('name="slotId"');
    expect(bookingPage).toContain('name="customerName"');
    expect(bookingPage).toContain('name="customerEmail"');
    expect(first.files['/src/pages/Home.tsx']).toBe(files['/src/pages/Home.tsx']);
    expect(second.files).toEqual(first.files);
  });

  it('repairs an existing registered scheduler host when its native form is missing', () => {
    const booking = bookingContract();
    const files = {
      ...initialFiles,
      '/src/pages/Booking.tsx': 'export default function Booking(){return <section data-ut-component-slug="booking-scheduler"><h1>Schedule a viewing</h1></section>}',
    };

    const result = materializeRegisteredComponents(booking, files);
    const bookingPage = result.files['/src/pages/Booking.tsx'];

    expect(bookingPage).toContain('<h1>Schedule a viewing</h1>');
    expect(bookingPage).toContain('data-ut-component-instance-id="cmp-booking"');
    expect(bookingPage).toContain('<form data-intent-form="booking.create"');
    expect(bookingPage).toContain('name="serviceId"');
    expect(bookingPage).toContain('name="slotId"');
    expect(bookingPage).toContain('name="customerName"');
    expect(bookingPage).toContain('name="customerEmail"');
  });

  it('replaces a malformed registered form instead of preserving a local success handler', () => {
    const booking = bookingContract();
    const files = {
      ...initialFiles,
      '/src/pages/Booking.tsx': 'export default function Booking(){return <section data-ut-component-slug="booking-scheduler"><form data-intent-form="booking.create" onSubmit={()=>true}><button>Confirm</button></form></section>}',
    };

    const result = materializeRegisteredComponents(booking, files);
    const bookingPage = result.files['/src/pages/Booking.tsx'];

    expect(bookingPage.match(/<form\b/g)).toHaveLength(1);
    expect(bookingPage).not.toContain('onSubmit=');
    expect(bookingPage).toContain('name="serviceId"');
    expect(bookingPage).toContain('name="slotId"');
    expect(bookingPage).toContain('name="customerName"');
    expect(bookingPage).toContain('name="customerEmail"');
  });

  it('repairs a registered booking form in an imported project component', async () => {
    const booking = bookingContract();
    const files = {
      ...initialFiles,
      '/src/pages/Booking.tsx': 'import BookingPanel from "../project-components/BookingPanel"; export default function Booking(){return <main><div data-ut-component-instance-id="cmp-booking"><BookingPanel /></div></main>}',
      '/src/project-components/BookingPanel.tsx': 'export default function BookingPanel(){return <section data-ut-component-slug="booking-scheduler"><form data-intent-form="booking.create" onSubmit={()=>true}><button>Confirm</button></form></section>}',
    };

    const result = materializeRegisteredComponents(booking, files);
    const panel = result.files['/src/project-components/BookingPanel.tsx'];
    const report = await validateAppBuildCandidate({ contract: booking, files: result.files, initialFiles });

    expect(panel).not.toContain('onSubmit=');
    expect(panel).toContain('name="serviceId"');
    expect(panel).toContain('name="slotId"');
    expect(panel).toContain('name="customerName"');
    expect(panel).toContain('name="customerEmail"');
    expect(report.issues.some((issue) => issue.code === 'registered-component-native-form-incomplete')).toBe(false);
  });

  it('closes a booking/contact/newsletter candidate with several registered instances', async () => {
    const launchContract = bookingContract();
    launchContract.business.capabilities = ['booking', 'contact', 'newsletter'];
    launchContract.business.configuredBusinessFields = ['notificationEmail', 'crmDestination', 'bookingOwner'];
    launchContract.business.registeredComponents = [
      registeredComponentFixture('booking-scheduler', 'cmp-booking', 'booking', { calendarId: 'calendar-main' }),
      registeredComponentFixture('contact-form', 'cmp-contact-home', 'home', { formId: 'form-home' }),
      registeredComponentFixture('contact-form', 'cmp-contact', 'contact', { formId: 'form-contact' }),
      registeredComponentFixture('newsletter-signup', 'cmp-newsletter', 'home', { formId: 'form-newsletter' }),
    ];
    const authoredFiles = {
      ...initialFiles,
      '/src/pages/Home.tsx': 'export default function Home(){return <div><h1>Estate listings</h1></div>}',
      '/src/pages/Contact.tsx': 'export default function Contact(){return <section><h1>Contact</h1></section>',
      '/src/pages/Booking.tsx': 'export default function Booking(){return <div><h1>Book a viewing</h1></div>',
    };
    const materializedFiles = materializeRegisteredComponents(launchContract, authoredFiles).files;
    const report = await validateAppBuildCandidate({ contract: launchContract, files: materializedFiles, initialFiles });

    expect(report.issues.filter((issue) => [
      'required-capability-host-missing',
      'registered-component-not-rendered',
      'registered-component-native-form-incomplete',
      'registered-component-business-fields-missing',
    ].includes(issue.code))).toEqual([]);
    expect(materializedFiles['/src/pages/Home.tsx']).toContain('data-ut-component-slug="contact-form"');
    expect(materializedFiles['/src/pages/Home.tsx']).toContain('data-ut-component-slug="newsletter-signup"');
    expect(materializedFiles['/src/pages/Contact.tsx']).toContain('data-ut-component-slug="contact-form"');
    expect(materializedFiles['/src/pages/Booking.tsx']).toContain('data-ut-component-slug="booking-scheduler"');
  });

  it('blocks locally fabricated booking confirmations without the registered runtime form', async () => {
    const files = {
      ...initialFiles,
      '/src/pages/Booking.tsx': `import { useState } from 'react'; export default function Booking(){ const [sent,setSent]=useState(false); return <main>{sent ? <p>Consultation Request Dispatched</p> : <button onClick={()=>setSent(true)}>Confirm Booking</button>}</main>}`,
    };
    const report = await validateAppBuildCandidate({ contract: bookingContract(), files, initialFiles });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({
      severity: 'blocker',
      code: 'registered-component-not-rendered',
      path: '/src/pages/Booking.tsx',
    }));
  });

  it('accepts a booking page only with the registered runtime host and required form fields', async () => {
    const files = {
      ...initialFiles,
      '/src/pages/Booking.tsx': '<section data-ut-component-slug="booking-scheduler"><form data-intent-form="booking.create"><select name="serviceId" /><select name="slotId" /><input name="customerName" /><input name="customerEmail" type="email" /></form></section>',
    };
    const report = await validateAppBuildCandidate({ contract: bookingContract(), files, initialFiles });

    expect(report.issues.some((issue) => issue.code === 'registered-component-native-form-incomplete')).toBe(false);
  });

  it('keeps payment setup pending from blocking a selected checkout page', async () => {
    const checkout = contract();
    checkout.business.capabilities = ['commerce'];
    checkout.business.registeredComponents = [registeredComponentFixture(
      'checkout-cta', 'cmp-checkout', 'home', { productId: 'product-1' },
    )];
    const files = {
      ...initialFiles,
      '/src/pages/Home.tsx': 'export default function Home(){return <main><section data-ut-component-slug="checkout-cta"><button data-intent-trigger="pay.checkout">Checkout</button></section></main>}',
      '/src/pages/Contact.tsx': 'export default function Contact(){return <main>Contact</main>}',
    };

    const report = await validateAppBuildCandidate({ contract: checkout, files, initialFiles });

    expect(report.ok).toBe(true);
    expect(report.issues).toContainEqual(expect.objectContaining({
      severity: 'advisory',
      code: 'registered-component-business-fields-missing',
    }));
  });

  it('accepts a complete multi-page candidate with project-local companion modules', async () => {
    const files = {
      ...initialFiles,
      '/src/pages/Home.tsx': 'import Card from "../project-components/Card"; export default function Home(){return <main><Card /></main>}',
      '/src/pages/Contact.tsx': 'export default function Contact(){return <main>Contact</main>}',
      '/src/project-components/Card.tsx': 'export default function Card(){return <section>Card</section>}',
    };
    const report = await validateAppBuildCandidate({ contract: contract(), files, initialFiles });

    expect(report.ok, JSON.stringify(report.issues)).toBe(true);
    expect(report.issues.filter((issue) => issue.severity === 'blocker')).toEqual([]);
    expect(report.sourceHash).toMatch(/^fnv1a:/);
  });

  it('blocks missing pages, unresolved companions and protected infrastructure changes', async () => {
    const files = {
      '/src/main.tsx': 'changed canonical entry',
      '/src/pages/Home.tsx': 'import Missing from "../project-components/Missing"; export default function Home(){return <Missing />}',
    };
    const report = await validateAppBuildCandidate({ contract: contract(), files, initialFiles });
    const codes = report.issues.filter((issue) => issue.severity === 'blocker').map((issue) => issue.code);

    expect(report.ok).toBe(false);
    expect(codes).toEqual(expect.arrayContaining([
      'page-body-missing',
      'protected-source-changed',
      'module-closure-unresolved-import',
    ]));
  });

  it('allows only the exact App Builder-materialized composition sidecar under protected .unison paths', async () => {
    const compositionPath = '/.unison/compositions/pages/Home.json';
    const originalComposition = JSON.stringify({
      version: '1.0', compiledBy: 'stage-4b', pageFilePath: '/src/pages/Home.tsx', sections: [],
    });
    const materializedComposition = JSON.stringify({
      version: '1.0', compiledBy: 'app-builder', pageFilePath: '/src/pages/Home.tsx', sections: [],
    });
    const baseline = {
      ...initialFiles,
      [compositionPath]: originalComposition,
    };
    const files = {
      ...baseline,
      '/src/pages/Home.tsx': 'export default function Home(){return <main>Authored</main>}',
      '/src/main.tsx': 'unauthorized entry edit',
      [compositionPath]: materializedComposition,
      '/.unison/ui-manifest.json': '{"changed":true}',
    };
    const appContract = contract();
    appContract.runtime.protectedPaths = ['/src/main.tsx', '/.unison'];

    const report = await validateAppBuildCandidate({
      contract: appContract,
      files,
      initialFiles: baseline,
      systemMaterializedCompositionFiles: { [compositionPath]: materializedComposition },
    });
    const protectedIssues = report.issues.filter((issue) => issue.code === 'protected-source-changed');

    expect(protectedIssues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      '/src/main.tsx',
      '/.unison/ui-manifest.json',
    ]));
    expect(protectedIssues.some((issue) => issue.path === compositionPath)).toBe(false);
  });

  it('blocks a candidate that omits a wizard-selected binding marker', async () => {
    const withBindingGuide = contract();
    withBindingGuide.business.bindingGuide = [
      '--- INTERACTION WIRING CONTRACT ---',
      '- Page Home (/), slot hero.primary-cta: label "Book now", marker data-ut-cta="cta.hero-book", intent booking.create, target booking-form',
    ].join('\n');
    const files = {
      ...initialFiles,
      '/src/pages/Home.tsx': 'export default function Home(){return <main><button>Book now</button></main>}',
      '/src/pages/Contact.tsx': 'export default function Contact(){return <main>Contact</main>}',
    };

    const report = await validateAppBuildCandidate({ contract: withBindingGuide, files, initialFiles });

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'wizard-binding-marker-missing', path: '/src/pages/Home.tsx' }),
    ]));
  });

  it('accepts a candidate that carries the requested binding marker', async () => {
    const withBindingGuide = contract();
    withBindingGuide.business.bindingGuide = '- Page Home (/), slot hero.primary-cta: label "Book now", marker data-ut-cta="cta.hero-book", intent booking.create, target booking-form';
    const files = {
      ...initialFiles,
      '/src/pages/Home.tsx': 'export default function Home(){return <main><button data-ut-cta="cta.hero-book">Book now</button></main>}',
      '/src/pages/Contact.tsx': 'export default function Contact(){return <main>Contact</main>}',
    };

    const report = await validateAppBuildCandidate({ contract: withBindingGuide, files, initialFiles });

    expect(report.issues.some((issue) => issue.code === 'wizard-binding-marker-missing')).toBe(false);
  });

  it('recognizes binding markers provided by an imported protected shared component', async () => {
    const withBindingGuide = contract();
    withBindingGuide.business.bindingGuide = '- Page Home (/), slot navbar.icon-search: label "Search", marker data-ut-cta="icon.search", intent nav.goto, target /search';
    const sharedNavigation = '<button type="button" aria-label="Search" data-ut-cta="icon.search">Search</button>';
    const sourceFiles = {
      ...initialFiles,
      '/src/components/SiteNavigation.tsx': `export default function SiteNavigation(){return ${sharedNavigation}}`,
    };
    const files = {
      ...sourceFiles,
      '/src/pages/Home.tsx': 'import SiteNavigation from "../components/SiteNavigation"; export default function Home(){return <main><SiteNavigation /></main>}',
    };

    const report = await validateAppBuildCandidate({ contract: withBindingGuide, files, initialFiles: sourceFiles });

    expect(report.issues.some((issue) => issue.code === 'wizard-binding-marker-missing')).toBe(false);
  });

  it('accepts a CRM form only when its registered component, intent, and business routing are connected', async () => {
    const files = {
      ...initialFiles,
      '/src/pages/Contact.tsx': contactCrmPage,
    };
    const report = await validateAppBuildCandidate({ contract: contactCrmContract(), files, initialFiles });

    expect(report.ok).toBe(true);
    expect(report.issues.filter((issue) => issue.code.startsWith('crm-') || issue.code.startsWith('intent-binding-'))).toEqual([]);
  });

  it('blocks CRM forms that omit the assigned registered component host', async () => {
    const files = {
      ...initialFiles,
      '/src/pages/Contact.tsx': contactCrmPage.replace('data-ut-component-slug="contact-form"', 'data-ut-component-slug="request-quote"'),
    };
    const report = await validateAppBuildCandidate({ contract: contactCrmContract(), files, initialFiles });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'registered-component-not-rendered' }));
  });

  it('blocks a registered CRM component whose write intent differs from the assigned binding', async () => {
    const mismatched = contactCrmContract();
    mismatched.business.registeredComponents[0].runtime.writeIntent = 'quote.request';
    mismatched.business.intentBindings[0].componentWriteIntent = 'quote.request';
    const report = await validateAppBuildCandidate({
      contract: mismatched,
      files: { ...initialFiles, '/src/pages/Contact.tsx': contactCrmPage },
      initialFiles,
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'registered-component-intent-mismatch' }));
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'intent-binding-component-intent-mismatch' }));
  });

  it('does not require UI markers or runtime hosts for optional bindings with disabled capabilities', async () => {
    const inactive = contract();
    inactive.business.capabilities = [];
    inactive.business.bindingGuide = [
      '- Page Home (/), slot navbar.primary-cta: label "Account", marker data-ut-cta="cta.nav", intent nav.goto, target account',
      '- Page Contact (/contact), slot contact.form-submit: label "Request quote", marker data-ut-cta="cta.form-submit", intent quote.request, target quote-form',
    ].join('\n');
    inactive.business.intentBindings = [
      {
        bindingId: 'bind-account', pageId: 'home', route: '/', sourceSection: 'navbar', sourceSlot: 'primary-cta',
        coreIntent: 'account.open', domIntent: 'nav.goto', ctaMarkers: ['cta.nav'], intentHandler: 'client',
        targetType: 'url', targetId: '/account', requiredCapabilities: ['auth'], missingCapabilities: ['auth'],
      },
      {
        bindingId: 'bind-quote', pageId: 'contact', route: '/contact', sourceSection: 'contact', sourceSlot: 'form-submit',
        coreIntent: 'quote.request', domIntent: 'quote.request', ctaMarkers: ['cta.form-submit'], intentHandler: 'intent-exec',
        targetType: 'form', targetId: 'quote-form', requiredCapabilities: ['quoting'], missingCapabilities: ['quoting'],
        componentInstanceId: 'cmp-quote', componentSlug: 'request-quote', componentWriteIntent: 'quote.request',
      },
    ];
    inactive.business.registeredComponents = [{
      ...contactCrmContract().business.registeredComponents[0],
      targetType: 'form', instanceStatus: 'ready', requiredCapabilities: ['quoting'],
      runtime: { ...contactCrmContract().business.registeredComponents[0].runtime, componentSlug: 'request-quote', requiredCapabilities: ['quoting'], writeIntent: 'quote.request', status: 'blocked', blockers: ['Missing required capability: quoting.'] },
    }];
    const report = await validateAppBuildCandidate({ contract: inactive, files: initialFiles, initialFiles });

    expect(report.ok, JSON.stringify(report.issues)).toBe(true);
    expect(report.issues.some((issue) => issue.code === 'wizard-binding-marker-missing')).toBe(false);
    expect(report.issues.some((issue) => issue.code.startsWith('registered-component-'))).toBe(false);
  });

  it('validates registered non-form writers through their declared native action target', async () => {
    const checkout = contactCrmContract();
    checkout.business.capabilities = ['commerce'];
    checkout.business.configuredBusinessFields.push('paymentProvider');
    checkout.business.bindingGuide = '- Page Home (/), slot shop-grid.card-cta: label "Buy", marker data-ut-cta="cta.card", intent pay.checkout, target product-1';
    checkout.business.registeredComponents[0] = {
      ...checkout.business.registeredComponents[0],
      targetType: 'checkout',
      bindings: { productId: 'product-1' },
      requiredBindingKeys: ['productId'],
      requiredBusinessFields: ['paymentProvider'],
      runtime: {
        ...checkout.business.registeredComponents[0].runtime,
        componentSlug: 'checkout-cta',
        requiredCapabilities: ['commerce'],
        writeIntent: 'pay.checkout',
      },
    };
    checkout.business.intentBindings[0] = {
      ...checkout.business.intentBindings[0],
      pageId: 'home',
      route: '/',
      sourceSection: 'shop-grid',
      sourceSlot: 'card-cta',
      coreIntent: 'pay.checkout',
      domIntent: 'pay.checkout',
      intentHandler: 'stripe-checkout',
      targetType: 'product',
      targetId: 'product-1',
      requiredCapabilities: ['commerce'],
      missingCapabilities: [],
      componentSlug: 'checkout-cta',
      componentWriteIntent: 'pay.checkout',
    };
    const files = {
      ...initialFiles,
      '/src/pages/Home.tsx': '<section data-ut-component-slug="checkout-cta"><button data-ut-cta="cta.card" data-intent-trigger="pay.checkout">Buy</button></section>',
      '/src/pages/Contact.tsx': 'export default function Contact(){return <main>Contact</main>}',
    };

    const report = await validateAppBuildCandidate({ contract: checkout, files, initialFiles });

    expect(report.ok, JSON.stringify(report.issues)).toBe(true);
    expect(report.issues.filter((issue) => issue.code.startsWith('registered-component-'))).toEqual([]);
  });

  it('accepts binding markers placed in the shared nav and footer a page renders', async () => {
    const withBindingGuide = contract();
    withBindingGuide.business.bindingGuide = [
      '- Page Home (/), slot nav.menu: label "Menu", marker data-ut-cta="icon.menu", intent nav.goto, target menu',
      '- Page Home (/), slot footer.newsletter: label "Subscribe", marker data-ut-cta="cta.newsletter-submit" or data-ut-cta="cta.newsletter", intent newsletter.subscribe, target newsletter',
    ].join('\n');
    const files = {
      ...initialFiles,
      '/src/pages/Home.tsx': "import SiteNav from '@/project-components/SiteNav';\nimport SiteFooter from '../project-components/SiteFooter';\nexport default function Home(){return <main><SiteNav /><SiteFooter /></main>}",
      '/src/project-components/SiteNav.tsx': 'export default function SiteNav(){return <nav><button data-ut-cta="icon.menu">Menu</button></nav>}',
      '/src/project-components/SiteFooter.tsx': 'export default function SiteFooter(){return <footer><button data-ut-cta="cta.newsletter">Subscribe</button></footer>}',
      '/src/pages/Contact.tsx': 'export default function Contact(){return <main>Contact</main>}',
    };

    const report = await validateAppBuildCandidate({ contract: withBindingGuide, files, initialFiles });

    expect(report.issues.filter((issue) => issue.code === 'wizard-binding-marker-missing')).toEqual([]);
  });

  it('blocks pages that reach into recipe internals', async () => {
    const files = {
      ...initialFiles,
      '/src/pages/Home.tsx': 'import { HeroImageStream } from "@/components/recipes/Hero"; export default function Home(){return <main><HeroImageStream /></main>}',
      '/src/pages/Contact.tsx': 'import { REGISTERED_VARIANTS } from "../unison/design-sources/recipes/Hero"; export default function Contact(){return <main />}',
    };
    const report = await validateAppBuildCandidate({ contract: contract(), files, initialFiles });
    const blocked = report.issues.filter((issue) => issue.code === 'recipe-internal-import').map((issue) => issue.path);

    expect(blocked.sort()).toEqual(['/src/pages/Contact.tsx', '/src/pages/Home.tsx']);
  });

  it('blocks design-source components rendered without required array props', async () => {
    const manifest = JSON.stringify({ implementations: { 'services:editorial-rows': { exportName: 'ServicesEditorialRows', props: 'headline, items[]' } } });
    const base = { ...initialFiles, '/.unison/design-source-manifest.json': manifest };
    const page = (body: string) => `import { ServicesEditorialRows } from "@/unison/design-sources/Services"; export default function Home(){return <main>${body}</main>}`;
    const run = async (body: string) => (await validateAppBuildCandidate({
      contract: contract(),
      files: { ...base, '/src/pages/Home.tsx': page(body) },
      initialFiles: base,
    })).issues.filter((issue) => issue.code === 'design-source-missing-props');

    expect(await run('<ServicesEditorialRows headline="x" />')).toHaveLength(1);
    expect(await run('<ServicesEditorialRows headline="x" items={[{ title: "a" }]} />')).toHaveLength(0);
    expect(await run('<ServicesEditorialRows {...props} />')).toHaveLength(0);
  });

  it('blocks empty, incomplete and nested-markup design-source usage', async () => {
    const manifest = JSON.stringify({ implementations: { 'services:editorial-rows': { exportName: 'ServicesEditorialRows', props: 'headline, items[]{title|description|price?}' } } });
    const base = { ...initialFiles, '/.unison/design-source-manifest.json': manifest };
    const codes = async (body: string) => (await validateAppBuildCandidate({
      contract: contract(),
      files: { ...base, '/src/pages/Home.tsx': `import { ServicesEditorialRows } from "@/unison/design-sources/Services"; export default function Home(){return <main>${body}</main>}` },
      initialFiles: base,
    })).issues.map((issue) => issue.code);

    expect(await codes('<ServicesEditorialRows headline="x" items={[]} />')).toContain('design-source-empty-array');
    expect(await codes('<ServicesEditorialRows headline="x" items={[{ title: "a" }]} />')).toContain('design-source-incomplete-items');
    expect(await codes('<ServicesEditorialRows headline={<h2>x</h2>} items={[{ title: "a", description: "b" }]} />')).toContain('design-source-nested-block');
    const clean = await codes('<ServicesEditorialRows headline="x" items={[{ title: "a", description: "b" }, { title: "c", description: "d" }]} />');
    expect(clean.filter((code) => code.startsWith('design-source-'))).toEqual([]);
  });

  it('blocks navigation descriptor objects rendered directly as JSX children', async () => {
    const files = {
      ...initialFiles,
      '/src/pages/Home.tsx': `const links = [{ text: 'Home', href: '/', intent: 'nav.goto', dataUiPath: '/home' }]; export default function Home(){return <nav>{links}</nav>}`,
    };
    const report = await validateAppBuildCandidate({ contract: contract(), files, initialFiles });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({
      severity: 'blocker',
      code: 'jsx-child-not-renderable',
      path: '/src/pages/Home.tsx',
    }));

    const mappedObject = await validateAppBuildCandidate({
      contract: contract(),
      files: {
        ...initialFiles,
        '/src/pages/Home.tsx': `const links = [{ text: 'Home', href: '/', intent: 'nav.goto', dataUiPath: '/home' }]; export default function Home(){return <nav>{links.map(link => link)}</nav>}`,
      },
      initialFiles,
    });
    expect(mappedObject.issues.some((issue) => issue.code === 'jsx-child-not-renderable')).toBe(true);
  });

  it('accepts navigation descriptor objects mapped to renderable elements', async () => {
    const files = {
      ...initialFiles,
      '/src/pages/Home.tsx': `const links = [{ text: 'Home', href: '/', intent: 'nav.goto', dataUiPath: '/home' }]; export default function Home(){return <nav>{links.map(link => <a key={link.href} href={link.href}>{link.text}</a>)}</nav>}`,
    };
    const report = await validateAppBuildCandidate({ contract: contract(), files, initialFiles });

    expect(report.issues.some((issue) => issue.code === 'jsx-child-not-renderable')).toBe(false);

    const passedAsProps = await validateAppBuildCandidate({
      contract: contract(),
      files: {
        ...initialFiles,
        '/src/pages/Home.tsx': `const links = [{ text: 'Home', href: '/', intent: 'nav.goto', dataUiPath: '/home' }]; function Navbar({ links }) { return <nav>{links.map(link => <a key={link.href} href={link.href}>{link.text}</a>)}</nav> } export default function Home(){return <Navbar links={links} />}`,
      },
      initialFiles,
    });
    expect(passedAsProps.issues.some((issue) => issue.code === 'jsx-child-not-renderable')).toBe(false);
  });

  it('requires stable registered section identities and matching serialized page models', async () => {
    const app = contract();
    app.topology.sitePlan.pages.splice(1);
    const manifestPath = '/.unison/design-source-manifest.json';
    const implementations = {
      'navbar:standard': { modulePath: '/src/unison/design-sources/Navbar.tsx', sectionType: 'navbar', exportName: 'NavbarStandard' },
      'services:editorial-rows': { modulePath: '/src/unison/design-sources/Services.tsx', sectionType: 'services', exportName: 'ServicesEditorialRows' },
      'footer:columns': { modulePath: '/src/unison/design-sources/Footer.tsx', sectionType: 'footer', exportName: 'FooterColumns' },
    };
    const files = {
      ...initialFiles,
      [manifestPath]: JSON.stringify({ implementations }),
      '/src/unison/design-sources/Navbar.tsx': 'export default function Navbar(){return null}',
      '/src/unison/design-sources/Services.tsx': 'export default function Services(){return null}',
      '/src/unison/design-sources/Footer.tsx': 'export default function Footer(){return null}',
      '/src/pages/Home.tsx': `import Navbar from "@/unison/design-sources/Navbar";
import Services from "@/unison/design-sources/Services";
import Footer from "@/unison/design-sources/Footer";
    export default function Home(){return <><header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:standard"><Navbar sectionId="site:navbar" variantId="navbar:standard" props={{ links: [] }} /></header><main><section data-ut-section-id="home:services:0" data-ut-section-type="services" data-ut-variant="services:editorial-rows"><Services sectionId="home:services:0" variantId="services:editorial-rows" props={{ headline: "Care", items: [{ title: "Cut", description: "Tailored" }] }} /></section></main><footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:columns"><Footer sectionId="site:footer" variantId="footer:columns" props={{ links: [] }} /></footer></>}`,
    };
    const sourceImplementations = Object.fromEntries(Object.entries(implementations).map(([id, entry]) => [id, {
      modulePath: entry.modulePath,
      sectionType: entry.sectionType,
    }]));
    const validFiles = materializeAppBuilderSectionModels(files, [{ id: 'home', filePath: '/src/pages/Home.tsx' }], sourceImplementations);
    const valid = await validateAppBuildCandidate({ contract: app, files: validFiles, initialFiles: files });
    expect(valid.issues.filter((issue) => issue.code.startsWith('section-model-'))).toEqual([]);

    const invalidFiles = {
      ...validFiles,
      '/src/pages/Home.tsx': files['/src/pages/Home.tsx'].replace('data-ut-section-id="home:services:0" ', ''),
    };
    const invalid = await validateAppBuildCandidate({ contract: app, files: invalidFiles, initialFiles: files });
    expect(invalid.issues).toContainEqual(expect.objectContaining({ code: 'section-model-invalid' }));
  });
});
