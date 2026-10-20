/**
 * THE canonical Theme Family → Art Direction Pack resolver.
 *
 * Order: 1 sealed pack · 2 explicit pack · 3 explicit Theme Family ·
 * 4 industry compatibility · 5 page coverage · 6 experience compatibility ·
 * 7 certification · 8 deterministic seed · 9 family default.
 *
 * Industry, coverage, experience and certification only NARROW the family's
 * candidates; they never escape an explicitly chosen family. The result is
 * sealed — downstream layers must pass `sealedPackId` back, never re-resolve.
 */
import {
  ART_DIRECTION_PACKS,
  ART_DIRECTION_PACK_IDS,
  DEFAULT_ART_DIRECTION_PACK_ID,
  isArtDirectionPackId,
  type ArtDirectionPackId,
} from '../contracts/art-direction';
import {
  ART_DIRECTION_FAMILY_REGISTRY,
  familyDefaultPack,
  industryPackCapability,
  isThemeFamilyId,
  packsForThemeFamily,
  type ThemeFamilyId,
} from '../contracts/theme-family';
import { resolvePageArchetype } from '../contracts/page-archetypes';
import { normalizeIndustryKey } from '../contracts/industry-key';
import type { WizardExperiencePreference } from '../contracts/selection';
import { getGenerationVariantsForSection } from '../components/registry';
import { childSeed, seededPick } from '@/platform/core/generationSeed';

export interface ArtDirectionResolutionRequest {
  sealedPackId?: string | null;
  artDirectionPackId?: string | null;
  themeFamilyId?: ThemeFamilyId | null;
  /** Compatibility alias for themeFamilyId. */
  themePresetId?: string | null;
  industry?: string | null;
  pageRoles?: readonly string[];
  experience?: WizardExperiencePreference;
  designSeed?: string | null;
}

export type ArtDirectionResolutionSource = 'sealed' | 'explicit-pack' | 'theme-family' | 'industry' | 'default';

export interface SealedArtDirection {
  readonly packId: ArtDirectionPackId;
  readonly themeFamilyId: ThemeFamilyId;
  readonly source: ArtDirectionResolutionSource;
  readonly candidates: readonly ArtDirectionPackId[];
  readonly sealed: true;
}

const narrow = (list: ArtDirectionPackId[], keep: (id: ArtDirectionPackId) => boolean) => {
  const next = list.filter(keep);
  return next.length ? next : list;
};

function coversPages(id: ArtDirectionPackId, roles: readonly string[], industry: string): boolean {
  const pack = ART_DIRECTION_PACKS[id];
  return roles.every((role) => resolvePageArchetype(role, industry).requiredFamilies
    .every((family) => getGenerationVariantsForSection(family, pack, role).length > 0));
}

function certified(id: ArtDirectionPackId): boolean {
  return getGenerationVariantsForSection('hero', ART_DIRECTION_PACKS[id]).length > 0;
}

function seal(packId: ArtDirectionPackId, source: ArtDirectionResolutionSource, candidates: readonly ArtDirectionPackId[], family?: ThemeFamilyId): SealedArtDirection {
  return Object.freeze({
    packId,
    themeFamilyId: family ?? ART_DIRECTION_FAMILY_REGISTRY[packId].primaryFamily,
    source,
    candidates: Object.freeze([...candidates]),
    sealed: true as const,
  });
}

export function resolveUnisonArtDirection(input: ArtDirectionResolutionRequest): SealedArtDirection {
  const requestedFamily = input.themeFamilyId ?? input.themePresetId?.trim().toLowerCase();
  const family = isThemeFamilyId(requestedFamily) ? requestedFamily : undefined;

  if (isArtDirectionPackId(input.sealedPackId)) return seal(input.sealedPackId, 'sealed', [input.sealedPackId]);
  if (isArtDirectionPackId(input.artDirectionPackId)) {
    const id = input.artDirectionPackId;
    const families = [ART_DIRECTION_FAMILY_REGISTRY[id].primaryFamily, ...ART_DIRECTION_FAMILY_REGISTRY[id].secondaryFamilies];
    return seal(id, 'explicit-pack', [id], family && families.includes(family) ? family : undefined);
  }

  const industry = normalizeIndustryKey(input.industry ?? '');
  const capability = industryPackCapability(industry) ?? industryPackCapability(input.industry);
  const base = family ? packsForThemeFamily(family) : capability ?? [];
  if (!base.length) return seal(DEFAULT_ART_DIRECTION_PACK_ID, 'default', [DEFAULT_ART_DIRECTION_PACK_ID]);

  let candidates = [...base];
  if (family && capability) candidates = narrow(candidates, (id) => capability.includes(id)); // 4
  const roles = input.pageRoles?.length ? input.pageRoles : ['home'];
  candidates = narrow(candidates, (id) => coversPages(id, roles, industry)); // 5
  const experience = input.experience ?? 'standard';
  candidates = narrow(candidates, (id) => ART_DIRECTION_FAMILY_REGISTRY[id].experiences.includes(experience)); // 6
  candidates = narrow(candidates, certified); // 7

  const source: ArtDirectionResolutionSource = family ? 'theme-family' : 'industry';
  const seed = input.designSeed?.trim();
  if (seed && candidates.length > 1) {
    return seal(seededPick(childSeed(seed, 'art-direction', family ?? industry), candidates), source, candidates, family); // 8
  }
  const fallback = family && candidates.includes(familyDefaultPack(family)) ? familyDefaultPack(family) : candidates[0]; // 9
  return seal(fallback, source, candidates, family);
}

/** Invariant helper: every released pack belongs to at least one family. */
export function orphanedArtDirectionPacks(): ArtDirectionPackId[] {
  return ART_DIRECTION_PACK_IDS.filter((id) => !ART_DIRECTION_FAMILY_REGISTRY[id]);
}
