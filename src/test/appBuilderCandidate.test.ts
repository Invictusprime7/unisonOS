import { describe, expect, it } from 'vitest';
import { compileResolvedSiteDesignContext } from '@/services/launch/resolvedSiteDesignContext';
import { validateAppBuildCandidate } from '@/services/app-builder/appBuilderCandidate';
import { APP_BUILDER_PROTOCOL_VERSION, type AppBuildContract } from '@/services/app-builder/appBuilderContracts';

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
      parameters: {}, registeredComponents: [], intentBindings: [],
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
  value.topology.sitePlan.pages.push({
    id: 'booking', name: 'booking', title: 'Booking', route: '/booking', role: 'booking',
    filePath: '/src/pages/Booking.tsx', visibleInNav: true, isHome: false, generatedBy: 'wizard',
  });
  return value;
}

function contactCrmContract(): AppBuildContract {
  const value = contract();
  value.business.capabilities = ['contact'];
  value.business.intents = ['contact.submit'];
  value.business.parameters = {
    ownerEmail: 'owner@example.test',
    notificationEmail: 'owner@example.test',
    crmDestination: 'unison_crm',
  };
  value.business.businessProfile = {
    businessName: 'Northstar',
    notificationEmail: 'owner@example.test',
    bookingOwner: 'owner@example.test',
    crmDestination: 'unison_crm',
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
  it('blocks locally fabricated booking confirmations without the registered runtime form', async () => {
    const files = {
      ...initialFiles,
      '/src/pages/Booking.tsx': `import { useState } from 'react'; export default function Booking(){ const [sent,setSent]=useState(false); return <main>{sent ? <p>Consultation Request Dispatched</p> : <button onClick={()=>setSent(true)}>Confirm Booking</button>}</main>}`,
    };
    const report = await validateAppBuildCandidate({ contract: bookingContract(), files, initialFiles });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({
      severity: 'blocker',
      code: 'booking-runtime-contract-missing',
      path: '/src/pages/Booking.tsx',
    }));
  });

  it('accepts a booking page only with the registered runtime host and required form fields', async () => {
    const files = {
      ...initialFiles,
      '/src/pages/Booking.tsx': '<section data-ut-component-slug="booking-scheduler"><form data-intent-form="booking.create"><select name="serviceId" /><select name="slotId" /><input name="customerName" /><input name="customerEmail" type="email" /></form></section>',
    };
    const report = await validateAppBuildCandidate({ contract: bookingContract(), files, initialFiles });

    expect(report.issues.some((issue) => issue.code === 'booking-runtime-contract-missing')).toBe(false);
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
    checkout.business.parameters.paymentProvider = 'connected';
    checkout.business.businessProfile.paymentProvider = 'connected';
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
});
