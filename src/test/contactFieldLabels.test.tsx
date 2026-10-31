// @vitest-environment node
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContactMinimalInline } from '@/sections/variants/contact/ContactMinimalInline';
import { ContactCompactCard } from '@/sections/variants/contact/ContactCompactCard';
import { ContactMapStudio } from '@/sections/variants/contact/ContactMapStudio';
import { getVariantById } from '@/sections/variants';
import { renderCompositionBrief } from '@/services/composition/pageAuthoringBrief';
import { extractCompositionSignature } from '@/services/composition/compositionSimilarity';

const fields = [
  { name: 'name', type: 'text', label: 'Name', required: true },
  { name: 'email', type: 'email', label: 'Email', required: true },
  { name: 'message', type: 'textarea', label: 'Message', required: true },
  { name: 'phone', type: 'tel', label: 'Phone', required: true },
];

function render(Component: React.ComponentType<any>, variantId: string) {
  const theme = (getVariantById(variantId as never) as any)?.defaultTheme;
  const section = { id: 'contact', type: 'contact', variant: variantId, props: { headline: 'Talk to us', fields, address: '1 Main St' } };
  return renderToStaticMarkup(<Component section={section} theme={theme ?? fallbackTheme} />);
}

const fallbackTheme = {
  colors: new Proxy({}, { get: () => '0 0% 50%' }),
  typography: { headingFont: 'serif', bodyFont: 'sans-serif', headingWeight: 600 },
  radius: '0', sectionPadding: '0', containerWidth: '100%',
} as any;

describe('contact designs render every selected field with its caption', () => {
  it.each([
    ['minimal inline', ContactMinimalInline, 'contact:minimal-inline'],
    ['compact card', ContactCompactCard, 'contact:compact-card'],
    ['map studio', ContactMapStudio, 'contact:map-studio'],
  ])('%s keeps all four fields', (_label, Component, variantId) => {
    const html = render(Component, variantId);
    for (const field of fields) expect(html).toContain(`name="${field.name}"`);
  });
  it('captions a custom field by its label, never its submitted key', () => {
    const html = render(ContactMapStudio, 'contact:map-studio');
    expect(html).toContain('>Phone<');
    expect(render(ContactCompactCard, 'contact:compact-card')).toContain('>Phone<');
  });
});

describe('page briefs carry variants used on earlier pages', () => {
  it('lists earlier body variants so the next page picks different ones', () => {
    const signature = extractCompositionSignature('<header data-ut-variant="navbar:standard"></header><section data-ut-section-type="hero" data-ut-variant="hero:image-fan"></section><section data-ut-section-type="services" data-ut-variant="services:card-grid"></section>');
    expect(signature.variants).toEqual(['hero:image-fan', 'services:card-grid']);
    const brief = renderCompositionBrief({
      pageId: 'work', role: 'work', compositionKey: 'k',
      profile: { industryId: '*', pageRole: 'work', narrativeGoals: ['show work'], compositionCharacter: { mediaDominance: 0.5, typographyDominance: 0.5, editoriality: 0.5, informationDensity: 0.5, conversionPressure: 0.5 }, preferredCompositionPatterns: [], discouragedCompositionPatterns: [], noveltyBudget: 0.3 },
      target: { hero: 'split-media', geometry: 'split', density: 'medium', sectionOrder: ['hero', 'gallery'] },
    } as any, [{ pageId: 'home', role: 'home', signature }]);
    expect(brief).toContain('VARIANTS ALREADY USED ON OTHER PAGES: hero:image-fan, services:card-grid');
  });
});
