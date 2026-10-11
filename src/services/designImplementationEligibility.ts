/**
 * Canonical Design Implementation Eligibility Resolver
 * (Registry Expansion milestone, Phase 3)
 *
 * One resolver every generation consumer uses. Ranking pipeline:
 *
 *   implementation lifecycle
 *       ↓
 *   section family
 *       ↓
 *   page role
 *       ↓
 *   industry compatibility
 *       ↓
 *   art-direction compatibility
 *       ↓
 *   experience/runtime capability ceiling
 *       ↓
 *   scored + seeded ranking with reasons
 *
 * Legacy entries without authored compatibility metadata remain universally
 * eligible (backward compatibility); newly certified entries declare their
 * compatibility explicitly. Registry growth narrows the candidate set — it
 * never grows the AI context beyond the caller's bound.
 */

import { listDesignImplementations, listImplementationsForSection, type DesignImplementation, type ImplementationId } from '@/services/designImplementationRegistry';
import { deriveImplementationVisualSignature } from '@/services/implementationVisualSignature';
import { compatibleExperiencePreferences } from '@/services/designCompatibilityGraph';
import type { SectionType, TemplatePageRole } from '@/sections/types';
import type { WizardExperiencePreference } from '@/services/wizardDesignSelection';
import { hashSeed } from '@/platform/core/generationSeed';

export interface ImplementationEligibilityRequest {
  sectionType: SectionType;
  pageRole?: TemplatePageRole;
  industry?: string;
  themePresetId?: string;
  artDirectionFamilyId?: string;
  artDirectionPackId?: string;
  experiencePreference?: WizardExperiencePreference;
  /** Runtime capabilities the site is approved for (e.g. 'experience.three-d'). */
  availableCapabilities?: readonly string[];
  /** Deterministic tie-breaker; identical inputs must rank identically. */
  seed?: string;
}

export interface RankedImplementationCandidate {
  implementationId: ImplementationId;
  score: number;
  reasons: string[];
}

const EXPERIENCE_RANK: Record<string, number> = { standard: 0, 'motion-rich': 1, immersive: 2 };

/** Legacy entries (no lifecycle block) are treated as certified. */
export function isProductionEligible(implementation: DesignImplementation): boolean {
  const status = implementation.lifecycle?.status ?? 'certified';
  if (status === 'deprecated' || status === 'retired') return false;
  if (status === 'experimental' || status === 'candidate') return false;
  if (implementation.generationStatus === 'retired' || implementation.generationStatus === 'legacy') return false;
  return true;
}

interface EligibilityFailure { implementationId: ImplementationId; reason: string }

function checkEligibility(
  implementation: DesignImplementation,
  request: ImplementationEligibilityRequest,
): EligibilityFailure | null {
  if (!isProductionEligible(implementation)) {
    return { implementationId: implementation.implementationId, reason: 'lifecycle:not-certified' };
  }
  const compat = implementation.compatibility;
  if (compat) {
    if (request.pageRole) {
      const roles = compat.pageRoles ?? implementation.pageRoles;
      if (roles && roles.length > 0 && !roles.includes(request.pageRole)) {
        return { implementationId: implementation.implementationId, reason: `pageRole:${request.pageRole}` };
      }
    }
    if (request.industry) {
      if (compat.excludedIndustries?.includes(request.industry)) {
        return { implementationId: implementation.implementationId, reason: `industry-excluded:${request.industry}` };
      }
      if (compat.industries && compat.industries.length > 0 && !compat.industries.includes(request.industry)) {
        return { implementationId: implementation.implementationId, reason: `industry:${request.industry}` };
      }
    }
    if (request.artDirectionFamilyId && compat.artDirectionFamilies && compat.artDirectionFamilies.length > 0
      && !compat.artDirectionFamilies.includes(request.artDirectionFamilyId)) {
      return { implementationId: implementation.implementationId, reason: `artDirectionFamily:${request.artDirectionFamilyId}` };
    }
    if (request.artDirectionPackId && compat.artDirectionPacks && compat.artDirectionPacks.length > 0
      && !compat.artDirectionPacks.includes(request.artDirectionPackId)) {
      return { implementationId: implementation.implementationId, reason: `artDirectionPack:${request.artDirectionPackId}` };
    }
    if (request.themePresetId && compat.themePresets && compat.themePresets.length > 0
      && !compat.themePresets.includes(request.themePresetId)) {
      return { implementationId: implementation.implementationId, reason: `themePreset:${request.themePresetId}` };
    }
    if (request.experiencePreference && compat.experiencePreferences && compat.experiencePreferences.length > 0
      && !compat.experiencePreferences.includes(request.experiencePreference)) {
      return { implementationId: implementation.implementationId, reason: `experiencePreference:${request.experiencePreference}` };
    }
  } else if (request.pageRole && implementation.pageRoles && implementation.pageRoles.length > 0
    && !implementation.pageRoles.includes(request.pageRole)) {
    return { implementationId: implementation.implementationId, reason: `pageRole:${request.pageRole}` };
  }

  // Experience/runtime capability ceiling: immersive implementations require
  // the site to be approved for the 3D experience layer.
  const signature = deriveImplementationVisualSignature(implementation);
  if (signature.experienceLevel === 'immersive' || implementation.experience?.status === 'enabled') {
    if (!(request.availableCapabilities ?? []).includes('experience.three-d')) {
      return { implementationId: implementation.implementationId, reason: 'capability:experience.three-d' };
    }
  }
  return null;
}

function scoreImplementation(
  implementation: DesignImplementation,
  request: ImplementationEligibilityRequest,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const compat = implementation.compatibility;

  if (implementation.generationStatus === 'preferred') { score += 4; reasons.push('preferred'); }
  if (implementation.isDefault) { score += 1; reasons.push('family-default'); }
  if (implementation.vfs?.certification === 'approved') { score += 3; reasons.push('portable-certified'); }

  if (compat && request.industry && compat.industries?.includes(request.industry)) {
    score += 3; reasons.push(`industry-match:${request.industry}`);
  }
  if (compat && request.pageRole && (compat.pageRoles ?? []).includes(request.pageRole)) {
    score += 2; reasons.push(`pageRole-match:${request.pageRole}`);
  }
  if (compat && request.artDirectionFamilyId && compat.artDirectionFamilies?.includes(request.artDirectionFamilyId)) {
    score += 2; reasons.push(`artDirection-match:${request.artDirectionFamilyId}`);
  }

  const signature = deriveImplementationVisualSignature(implementation);
  if (request.experiencePreference) {
    const compatible = compatibleExperiencePreferences(signature);
    if (compatible.includes(request.experiencePreference)) {
      score += 2; reasons.push(`experience-match:${request.experiencePreference}`);
      // Prefer the closest experience level rather than over- or under-shooting.
      const distance = Math.abs(EXPERIENCE_RANK[signature.experienceLevel] - EXPERIENCE_RANK[request.experiencePreference]);
      score += Math.max(0, 2 - distance);
    }
  }
  if (implementation.capabilities?.layout) { score += 1; reasons.push('authored-capabilities'); }
  return { score, reasons };
}

/**
 * Ranked, eligible implementations for one section slot. Deterministic for a
 * given request + seed; bounded by `limit` when provided.
 */
export function resolveEligibleImplementations(
  request: ImplementationEligibilityRequest,
  options?: { limit?: number },
): RankedImplementationCandidate[] {
  const candidates = listImplementationsForSection(request.sectionType)
    .filter((implementation) => !checkEligibility(implementation, request));
  const seed = request.seed ?? 'unison-eligibility';
  const ranked = candidates.map((implementation) => {
    const { score, reasons } = scoreImplementation(implementation, request);
    return { implementationId: implementation.implementationId, score, reasons, tiebreak: hashSeed(`${seed}|${implementation.implementationId}`) };
  });
  ranked.sort((a, b) => b.score - a.score || a.tiebreak - b.tiebreak || a.implementationId.localeCompare(b.implementationId));
  const bounded = options?.limit ? ranked.slice(0, options.limit) : ranked;
  return bounded.map(({ implementationId, score, reasons }) => ({ implementationId, score, reasons }));
}

/** Why an implementation was excluded — diagnostics for the coverage report. */
export function explainImplementationExclusion(
  implementationId: string,
  request: ImplementationEligibilityRequest,
): string | null {
  const implementation = listDesignImplementations().find((impl) => impl.implementationId === implementationId);
  if (!implementation) return 'unknown-implementation';
  return checkEligibility(implementation, request)?.reason ?? null;
}
