import type { CSSProperties } from 'react';
import { ART_DIRECTION_PACKS, buildArtDirectionTokens, buildPageScaleTokens, type ArtDirectionPackId } from '@/sections/variants/artDirectionPacks';
import { resolvePageScale } from '@/sections/pageArchetypeContract';

/**
 * Same geometric rhythm App Builder emits through Stage 4b: the sealed pack's
 * site-wide tokens, then the page-archetype spacing subset for this route.
 */
export function buildMarketplaceRhythmTokens(packId: ArtDirectionPackId, pageRole: string): Record<string, string> {
  const pack = ART_DIRECTION_PACKS[packId];
  const { rhythm, density } = resolvePageScale(pageRole, pack);
  return { ...buildArtDirectionTokens(pack), ...buildPageScaleTokens(rhythm, density) };
}

export const marketplaceRhythmStyle = (packId: ArtDirectionPackId, pageRole: string): CSSProperties =>
  buildMarketplaceRhythmTokens(packId, pageRole) as CSSProperties;
