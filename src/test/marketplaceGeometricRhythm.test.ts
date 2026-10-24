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
