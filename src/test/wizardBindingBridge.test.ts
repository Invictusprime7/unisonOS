import { describe, expect, it } from 'vitest';
import { resolveCapabilities } from '@/services/wizardCapabilityResolver';
import { materializePlayground } from '@/services/wizardPlaygroundMaterializer';
import { applyWizardBindingsToVfs } from '@/services/wizardBindingBridge';
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
  it('resolves booking, contact, and newsletter aliases to materialized canonical forms', () => {
    const capabilities = resolveCapabilities(salonSelections);
    const { playground, warnings } = materializePlayground(salonSelections, capabilities);
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
});
