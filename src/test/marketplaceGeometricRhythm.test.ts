import { describe, expect, it } from 'vitest';
import { buildMarketplaceRhythmTokens } from '@/marketplace/marketplaceGeometricRhythm';
import { MARKETPLACE_TEMPLATE_VARIANT_PROFILES } from '@/marketplace/MarketplaceRegisteredSection';
import { ART_DIRECTION_PACKS, buildArtDirectionTokens, buildPageScaleTokens } from '@/sections/variants/artDirectionPacks';
import { resolvePageScale } from '@/sections/pageArchetypeContract';

describe('marketplace geometric rhythm', () => {
  it('matches the App Builder pack + page-archetype tokens for every template', () => {
    for (const [id, profile] of Object.entries(MARKETPLACE_TEMPLATE_VARIANT_PROFILES)) {
      const pack = ART_DIRECTION_PACKS[profile.artDirectionPackId];
      for (const role of ['home', 'services', 'contact']) {
        const { rhythm, density } = resolvePageScale(role, pack);
        const expected = { ...buildArtDirectionTokens(pack), ...buildPageScaleTokens(rhythm, density) };
        expect(buildMarketplaceRhythmTokens(profile.artDirectionPackId, role), `${id}:${role}`).toEqual(expected);
      }
    }
  });

  it('keeps site-wide geometry identical across pages of one template', () => {
    const [profile] = Object.values(MARKETPLACE_TEMPLATE_VARIANT_PROFILES);
    const home = buildMarketplaceRhythmTokens(profile.artDirectionPackId, 'home');
    const contact = buildMarketplaceRhythmTokens(profile.artDirectionPackId, 'contact');
    expect(contact['--ut-radius-base']).toBe(home['--ut-radius-base']);
    expect(contact['--ut-type-hero']).toBe(home['--ut-type-hero']);
  });
});

describe('registered sections follow the sealed pack geometry', () => {
  it('renders every template section with its pack radius, not the colour preset radius', async () => {
    const { render, cleanup } = await import('@testing-library/react');
    const { createElement } = await import('react');
    const { MarketplaceRegisteredSection } = await import('@/marketplace/MarketplaceRegisteredSection');
    const { getMarketplaceVariantTheme } = await import('@/marketplace/marketplaceTemplatePrimitives');
    const theme = { ...getMarketplaceVariantTheme('modern', {}), radius: '99rem' };
    const section = { id: 'faq', type: 'faq', props: { heading: 'FAQ', items: [{ question: 'Q', answer: 'A' }] } } as never;
    for (const id of ['pollen-objects', 'relay-operations', 'openbook-academy', 'aster-skin-studio'] as const) {
      const { container } = render(createElement(MarketplaceRegisteredSection, { templateId: id, section, theme }));
      const radius = ART_DIRECTION_PACKS[MARKETPLACE_TEMPLATE_VARIANT_PROFILES[id].artDirectionPackId].design.radius;
      expect(container.innerHTML, id).not.toContain('99rem');
      expect(container.innerHTML.includes(`border-radius: ${radius}`) || radius === '0', id).toBe(true);
      cleanup();
    }
  });
});
