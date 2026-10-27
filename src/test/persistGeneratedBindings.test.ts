import { describe, expect, it } from 'vitest';
import { countExpectedGeneratedBindingReceipts, extractGeneratedBindings } from '@/services/persistGeneratedBindings';

describe('generated intent binding extraction', () => {
  it('uses the originating registry route for bindings inside shared component files', () => {
    const rows = extractGeneratedBindings({
      '/src/project-components/SharedForms.tsx': '<button data-ut-slot-id="page-contact:contact:form-submit" data-ut-slot="form-submit" data-ut-intent="contact.submit">Contact</button><button data-ut-slot-id="page-about:about:form-submit" data-ut-slot="form-submit" data-ut-intent="contact.submit">About</button>',
    }, { 'page-contact': '/contact', 'page-about': '/about' });

    expect(rows).toEqual([
      expect.objectContaining({ pagePath: '/contact', slot: 'form-submit', intent: 'contact.submit' }),
      expect.objectContaining({ pagePath: '/about', slot: 'form-submit', intent: 'contact.submit' }),
    ]);
    const persistedKeys = new Set(rows.map((row) => `${row.pagePath}::${row.slot}`));
    expect(persistedKeys).toHaveLength(2);
  });

  it('expands one shared component binding across each importing route with a matching registry binding', () => {
    const files = {
      '/src/pages/Home.tsx': 'import SharedNav from "../project-components/SharedNav"; export default function Home(){return <SharedNav/>}',
      '/src/pages/Contact.tsx': 'import SharedNav from "../project-components/SharedNav"; export default function Contact(){return <SharedNav/>}',
      '/src/pages/About.tsx': 'export default function About(){return <main>About</main>}',
      '/src/project-components/SharedNav.tsx': '<button data-ut-slot-id="page-home:navbar:icon-search" data-ut-slot="icon-search" data-ut-intent="nav.goto">Search</button>',
    };
    const rows = extractGeneratedBindings(files, { 'page-home': '/' }, [
      { route: '/', filePath: '/src/pages/Home.tsx', bindings: [{ sourceSlot: 'icon-search', intent: 'nav.goto' }] },
      { route: '/contact', filePath: '/src/pages/Contact.tsx', bindings: [{ sourceSlot: 'icon-search', intent: 'nav.goto' }] },
      { route: '/about', filePath: '/src/pages/About.tsx', bindings: [{ sourceSlot: 'icon-search', intent: 'nav.goto' }] },
    ]);

    expect(rows.map((row) => row.pagePath).sort()).toEqual(['/', '/contact']);
  });
});

describe('generated intent binding receipt counts', () => {
  it('matches the persister page-slot deduplication key and excludes inactive bindings', () => {
    expect(countExpectedGeneratedBindingReceipts([
      { route: '/', sourceSlot: 'primary-cta', missingCapabilities: [] },
      { route: '/', sourceSlot: 'primary-cta', missingCapabilities: [] },
      { route: '/', sourceSlot: 'icon-search', missingCapabilities: [] },
      { route: '/contact', sourceSlot: 'form-submit', missingCapabilities: [] },
      { route: '/booking', sourceSlot: 'form-submit', missingCapabilities: ['booking'] },
    ])).toBe(3);
  });
});