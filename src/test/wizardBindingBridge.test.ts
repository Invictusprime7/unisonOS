import { describe, expect, it } from 'vitest';
import { resolveCapabilities } from '@/services/wizardCapabilityResolver';
import { materializePlayground } from '@/services/wizardPlaygroundMaterializer';
import { applyWizardBindingsToVfs, buildWizardBindingGuide, getWizardBindingMarkers, normalizeWizardBindingMarkers } from '@/services/wizardBindingBridge';
import type { WizardSelections } from '@/types/playground';

const salonSelections: WizardSelections = {
  businessName: 'STELLAR BEAUTY',
  businessModel: 'appointment_service',
  industryOverlay: 'salon',
  primaryGoal: 'book',
  secondaryGoals: ['contact'],
  needsBooking: true,
  wantsLeadCapture: true,
  requestedPages: ['about', 'services', 'gallery', 'booking', 'contact', 'faq'],
  scaffoldMode: 'selected-pages',
  templateId: 'salon-premium',
  themePresetId: 'editorial',
};

describe('Wizard form binding aliases', () => {
  it('normalizes a uniquely matched icon binding before closure and stamps its final intent afterward', () => {
    const capabilities = resolveCapabilities(salonSelections);
    const { playground } = materializePlayground(salonSelections, capabilities);
    const binding = Object.values(playground.bindings).find((candidate) => candidate.sourceSlot === 'icon-search');
    expect(binding).toBeDefined();
    const home = playground.pageRegistry.pages[binding!.sourcePageId];
    const files = {
      [home.filePath!]: 'export default function Home(){return <main><button type="button" aria-label="Search"><span><SearchIcon /></span></button></main>}',
    };

    const normalized = normalizeWizardBindingMarkers(files, playground.pageRegistry, [{
      bindingId: binding!.bindingId,
      pageId: binding!.sourcePageId,
      sourceLabel: binding!.sourceLabel,
      sourceSlot: binding!.sourceSlot!,
      markers: getWizardBindingMarkers(binding!),
    }]);
    const wired = applyWizardBindingsToVfs(
      normalized.files,
      { ...playground, bindings: { [binding!.bindingId]: binding! } } as any,
    );

    expect(normalized.unresolvedBindingIds).toEqual([]);
    expect(normalized.files[home.filePath!]).toContain('data-ut-cta="icon.search"');
    expect(wired.missingBindings).toEqual([]);
    expect(wired.files[home.filePath!]).toContain('data-ut-intent=');
  });

  it('normalizes each same-marker slot independently and stamps persistable runtime identity', () => {
    const capabilities = resolveCapabilities(salonSelections);
    const { playground } = materializePlayground(salonSelections, capabilities);
    const home = Object.values(playground.pageRegistry.pages).find((page) => page.isHome)!;
    const source = '<nav><a data-ut-cta="cta.nav-link">Home</a><a data-ut-cta="cta.nav-link">Treatments</a></nav>';
    const result = normalizeWizardBindingMarkers({ [home.filePath!]: source }, playground.pageRegistry, [
      {
        bindingId: 'home-link', pageId: home.pageId, sourceSection: 'navbar', sourceSlot: 'nav-link',
        sourceLabel: 'Home', domIntent: 'nav.anchor', markers: ['cta.nav-link'],
      },
      {
        bindingId: 'treatments-link', pageId: home.pageId, sourceSection: 'navbar', sourceSlot: 'nav-link',
        sourceLabel: 'Treatments', domIntent: 'nav.anchor', markers: ['cta.nav-link'],
      },
    ]);
    const normalized = result.files[home.filePath!];

    expect(result.unresolvedBindingIds).toEqual([]);
    expect(normalized).toContain('data-ut-binding-id="home-link"');
    expect(normalized).toContain('data-ut-binding-id="treatments-link"');
    expect(normalized.match(/data-ut-intent="nav.anchor"/g)).toHaveLength(2);
    expect(normalized.match(/data-ut-slot-id=/g)).toHaveLength(2);
  });

  it('maps portable marketplace slot names to canonical marker families', () => {
    expect(getWizardBindingMarkers({ sourceSection: 'booking', sourceSlot: 'booking-submit' } as any)).toEqual(['cta.form-submit']);
    expect(getWizardBindingMarkers({ sourceSection: 'navbar', sourceSlot: 'brand-link' } as any)).toEqual(['cta.nav-link']);
    expect(getWizardBindingMarkers({ sourceSection: 'navbar', sourceSlot: 'route-materials-link' } as any)).toEqual(['cta.nav-link']);
  });

  it('resolves nav anchors by exact href and form slots by a unique submit control when copy changes', () => {
    const capabilities = resolveCapabilities(salonSelections);
    const { playground } = materializePlayground(salonSelections, capabilities);
    const home = Object.values(playground.pageRegistry.pages).find((page) => page.isHome)!;
    const files = {
      [home.filePath!]: '<main><nav><a href="#treatments">Explore care</a></nav><section><form><button type="submit">Reserve a visit</button></form></section></main>',
    };
    const result = normalizeWizardBindingMarkers(files, playground.pageRegistry, [
      {
        bindingId: 'treatments-nav', pageId: home.pageId, sourceLabel: 'Treatments', sourceSection: 'navbar',
        sourceSlot: 'treatments-link', domIntent: 'nav.anchor', targetType: 'url', targetId: '#treatments',
        targetPath: '#treatments', markers: ['cta.nav-link'],
      },
      {
        bindingId: 'booking-submit', pageId: home.pageId, sourceLabel: 'Request an appointment', sourceSection: 'booking',
        sourceSlot: 'booking-submit', domIntent: 'booking.create', targetType: 'calendar', targetId: 'buyer-calendar',
        markers: ['cta.form-submit'],
      },
    ]);
    const normalized = result.files[home.filePath!];

    expect(result.unresolvedBindingIds).toEqual([]);
    expect(normalized).toContain('<a href="#treatments" data-ut-cta="cta.nav-link"');
    expect(normalized).toContain('data-ut-binding-id="treatments-nav"');
    expect(normalized).toContain('<button type="submit" data-ut-cta="cta.form-submit"');
    expect(normalized).toContain('data-ut-binding-id="booking-submit"');
  });

  it('does not seed commerce products for an ecommerce industry without purchase intent', () => {
    const selections: WizardSelections = {
      ...salonSelections,
      businessModel: 'general',
      industryOverlay: 'ecommerce',
      sellsProducts: false,
    };
    const capabilities = resolveCapabilities(selections);
    const { playground } = materializePlayground(selections, capabilities);

    expect(capabilities.requiredProducts).toEqual([]);
    expect(Object.values(playground.creatorData.componentInstances).some(
      (component) => component.componentSlug === 'checkout-cta',
    )).toBe(false);
  });

  it('resolves booking, contact, and newsletter aliases to materialized canonical forms', () => {
    const capabilities = resolveCapabilities(salonSelections);
    const { playground, warnings } = materializePlayground(salonSelections, capabilities);
    expect(Object.values(playground.creatorData.componentInstances).some((component) => component.componentSlug === 'chat-widget')).toBe(false);
    const formsByName = Object.fromEntries(
      Object.values(playground.creatorData.forms).map((form) => [form.name, form]),
    );

    expect(formsByName['Booking Intake']).toBeDefined();
    expect(formsByName['Contact Form']).toBeDefined();
    expect(formsByName['Newsletter Subscription']).toBeDefined();
    expect(warnings.filter((warning) => warning.includes('could not be resolved'))).toEqual([]);

    const selectedBindings = Object.fromEntries(
      Object.entries(playground.bindings).filter(([, binding]) =>
        binding.elementKey === 'booking.contact.form-submit'
        || binding.elementKey === 'contact.contact.form-submit'
        || binding.elementKey === 'home.footer.newsletter-submit'),
    );
    expect(Object.keys(selectedBindings)).toHaveLength(3);

    const bindingByKey = Object.fromEntries(
      Object.values(selectedBindings).map((binding) => [binding.elementKey, binding]),
    );
    expect(bindingByKey['booking.contact.form-submit'].targetId).toBe(formsByName['Booking Intake'].formId);
    expect(bindingByKey['contact.contact.form-submit'].targetId).toBe(formsByName['Contact Form'].formId);
    expect(bindingByKey['home.footer.newsletter-submit'].targetId).toBe(formsByName['Newsletter Subscription'].formId);

    const pageByRole = Object.fromEntries(
      Object.values(playground.pageRegistry.pages).map((page) => [page.pageRole || page.pageType, page]),
    );
    const result = applyWizardBindingsToVfs(
      {
        [pageByRole.home.filePath!]: 'export default function Home(){ return <button data-ut-cta="cta.newsletter-submit">Subscribe</button>; }',
        [pageByRole.booking.filePath!]: 'export default function Booking(){ return <button data-ut-cta="cta.form-submit">Book Now</button>; }',
        [pageByRole.contact.filePath!]: 'export default function Contact(){ return <button data-ut-cta="cta.form-submit">Send Message</button>; }',
      },
      { ...playground, bindings: selectedBindings } as any,
    );

    expect(result.missingBindings).toEqual([]);
    expect(result.appliedBindings).toBe(3);
  });

  it('stamps a page binding whose marker lives in a shared footer the page renders', () => {
    const capabilities = resolveCapabilities(salonSelections);
    const { playground } = materializePlayground(salonSelections, capabilities);
    const newsletter = Object.fromEntries(
      Object.entries(playground.bindings).filter(([, binding]) => binding.elementKey === 'home.footer.newsletter-submit'),
    );
    const home = Object.values(playground.pageRegistry.pages).find((page) => (page.pageRole || page.pageType) === 'home')!;
    const result = applyWizardBindingsToVfs(
      {
        [home.filePath!]: "import SiteFooter from '@/project-components/SiteFooter';\nexport default function Home(){ return <main><SiteFooter /></main>; }",
        '/src/project-components/SiteFooter.tsx': 'export default function SiteFooter(){ return <footer><button data-ut-cta="cta.newsletter-submit">Subscribe</button></footer>; }',
      },
      { ...playground, bindings: newsletter } as any,
    );

    expect(result.missingBindings).toEqual([]);
    expect(result.files['/src/project-components/SiteFooter.tsx']).toMatch(/data-ut-intent=/);
  });

  it('omits disabled capability bindings from the guide and final VFS stamping', () => {
    const capabilities = resolveCapabilities(salonSelections);
    const { playground } = materializePlayground(salonSelections, capabilities);
    const home = Object.values(playground.pageRegistry.pages).find((page) => (page.pageRole || page.pageType) === 'home')!;
    const binding = {
      ...Object.values(playground.bindings)[0],
      bindingId: 'bind-account-disabled',
      sourcePageId: home.pageId,
      sourceLabel: 'Account',
      intent: 'nav.goto_page' as const,
      targetId: home.pageId,
      targetType: 'page' as const,
      sourceSection: 'navbar' as const,
      sourceSlot: 'primary-cta' as const,
      coreIntent: 'account.open',
      requiredCapabilities: ['auth'],
      readiness: 'blocked' as const,
    };
    const snapshot = { ...playground, bindings: { [binding.bindingId]: binding } } as any;
    const enabledCapabilities = ['booking'];
    const guide = buildWizardBindingGuide(snapshot, { enabledCapabilities });
    const pageContent = 'export default function Home(){ return <button data-ut-cta="cta.nav">Account</button>; }';
    const application = applyWizardBindingsToVfs(
      { [home.filePath!]: pageContent },
      snapshot,
      undefined,
      enabledCapabilities,
    );

    expect(guide).not.toContain('Account');
    expect(application.appliedBindings).toBe(0);
    expect(application.missingBindings).toEqual([]);
    expect(application.files[home.filePath!]).toBe(pageContent);
  });
});
