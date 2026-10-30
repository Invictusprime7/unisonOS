import { describe, expect, it } from 'vitest';
import { INDUSTRY_INTENT_PROFILES } from '@/platform/core/industryIntentProfiles';
import { closeRequiredIndustryIntents } from '@/services/requiredIntentClosure';
import { runFullPreflight } from '@/services/runFullPreflight';

const HARDENED_INDUSTRIES = [
  'salon', 'local-service', 'contractor', 'coaching', 'restaurant',
  'ecommerce', 'agency', 'nonprofit', 'portfolio', 'real-estate',
] as const;

const page = '<main><section><h1>Ready</h1></section></main>';

describe('closeRequiredIndustryIntents', () => {
  it('adds required actions at the canonical page boundary, outside repeated section renderers', () => {
    const source = 'function SectionRenderer(){return <div>Section</div>}\nexport default function Home(){return <SiteLayout>{sections.map(renderSection)}</SiteLayout>}';
    const result = closeRequiredIndustryIntents({ '/src/pages/Home.tsx': source }, 'salon').files['/src/pages/Home.tsx'];
    expect(result.slice(0, result.indexOf('export default'))).toBe(source.slice(0, source.indexOf('export default')));
    expect(result.indexOf('data-ut-generated-intent')).toBeGreaterThan(result.indexOf('<SiteLayout>'));
  });
  it.each(HARDENED_INDUSTRIES)('closes every required renderable intent for %s', (industry) => {
    const result = closeRequiredIndustryIntents({ '/src/pages/Home.tsx': page }, industry);
    const source = result.files['/src/pages/Home.tsx'];

    expect(result.missing).toEqual([]);
    for (const intent of INDUSTRY_INTENT_PROFILES[industry].required.filter((intent) => intent !== 'nav.goto')) {
      expect(source).toContain(`data-ut-intent="${intent}"`);
    }
  });

  it('is idempotent for an already-closed ecommerce page', () => {
    const first = closeRequiredIndustryIntents({ '/src/pages/Home.tsx': page }, 'ecommerce');
    const second = closeRequiredIndustryIntents(first.files, 'ecommerce');

    expect(second.injected).toEqual([]);
    expect(second.files).toEqual(first.files);
  });

  it('does not inject industry-required actions excluded by an explicit launch intent set', () => {
    const result = runFullPreflight({
      '/src/pages/Home.tsx': 'export default function Home() { return <main>Work</main>; }',
    }, { industry: 'portfolio', activeIntents: ['nav.goto'] });

    expect(result.stages.requiredIntentClosure.injected).toEqual([]);
    expect(result.files['/src/pages/Home.tsx']).not.toContain('contact.submit');
    expect(result.files['/src/pages/Home.tsx']).not.toContain('newsletter.subscribe');
  });

  it('runs required-intent closure before the final shared syntax gate', () => {
    const result = runFullPreflight({
      '/src/pages/Home.tsx': 'export default function Home() { return <main><section>Shop</section></main>; }',
    }, { industry: 'ecommerce' });

    expect(result.stages.requiredIntentClosure.missing).toEqual([]);
    expect(result.stages.requiredIntentClosure.injected).toEqual(expect.arrayContaining([
      'cart.add', 'cart.view', 'cart.checkout',
    ]));
    expect(result.files['/src/pages/Home.tsx']).toContain('data-ut-intent="cart.view"');
  });
});
