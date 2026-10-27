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
