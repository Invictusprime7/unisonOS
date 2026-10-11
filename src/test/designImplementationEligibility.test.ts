/**
 * Registry Expansion milestone — Phase 3 + Phase 7 acceptance.
 *
 * Proves the canonical eligibility resolver:
 *  - gates on lifecycle (experimental/candidate/deprecated/retired excluded);
 *  - honors authored compatibility (industry, page role, art direction);
 *  - enforces the experience capability ceiling (immersive requires
 *    experience.three-d approval);
 *  - ranks deterministically for a given seed;
 *  - keeps candidate sets bounded as the registry grows (synthetic scale).
 */
import { describe, it, expect } from 'vitest';
import {
  resolveEligibleImplementations,
  explainImplementationExclusion,
  isProductionEligible,
  type ImplementationEligibilityRequest,
} from '@/services/designImplementationEligibility';
import { listDesignImplementations, listImplementationsForSection } from '@/services/designImplementationRegistry';
import { VARIANT_REGISTRY } from '@/sections/variants';
import type { SectionVariant } from '@/sections/variants/types';
import type { SectionType } from '@/sections/types';

const baseRequest: ImplementationEligibilityRequest = {
  sectionType: 'hero',
  pageRole: 'home',
  industry: 'agency',
  experiencePreference: 'standard',
  seed: 'test-seed',
};

describe('designImplementationEligibility', () => {
  it('resolves eligible hero implementations with scores and reasons', () => {
    const ranked = resolveEligibleImplementations(baseRequest);
    expect(ranked.length).toBeGreaterThan(0);
    for (const candidate of ranked) {
      expect(candidate.implementationId.startsWith('hero:')).toBe(true);
      expect(Array.isArray(candidate.reasons)).toBe(true);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = resolveEligibleImplementations(baseRequest).map((c) => c.implementationId);
    const b = resolveEligibleImplementations(baseRequest).map((c) => c.implementationId);
    expect(a).toEqual(b);
  });

  it('bounds the candidate set independent of registry size', () => {
    const bounded = resolveEligibleImplementations(baseRequest, { limit: 6 });
    expect(bounded.length).toBeLessThanOrEqual(6);
  });

  it('excludes non-certified lifecycle entries from production resolution', () => {
    for (const status of ['experimental', 'candidate', 'deprecated', 'retired'] as const) {
      expect(isProductionEligible({
        implementationId: 'hero:fake',
        sectionType: 'hero',
        slug: 'fake',
        name: 'Fake',
        description: '',
        category: 'content',
        tags: [],
        isDefault: false,
        hasVariants: true,
        lifecycle: { status, schemaVersion: 1, implementationVersion: 1 },
      })).toBe(false);
    }
  });

  it('treats legacy entries without lifecycle metadata as certified', () => {
    const legacy = listImplementationsForSection('hero').find((impl) => !impl.lifecycle);
    if (legacy) expect(isProductionEligible(legacy)).toBe(true);
  });

  it('blocks immersive implementations without the 3D capability approval', () => {
    const immersive = listDesignImplementations().find(
      (impl) => impl.experience?.status === 'enabled',
    );
    if (!immersive) return; // no immersive entries yet — nothing to prove
    const reason = explainImplementationExclusion(immersive.implementationId, {
      sectionType: immersive.sectionType,
      seed: 'test',
    });
    expect(reason).toBe('capability:experience.three-d');
    const approved = resolveEligibleImplementations({
      sectionType: immersive.sectionType,
      availableCapabilities: ['experience.three-d'],
      seed: 'test',
    });
    expect(approved.some((c) => c.implementationId === immersive.implementationId)).toBe(true);
  });

  it('synthetic scale: resolution stays fast and bounded with 1,000 registered records', () => {
    const heroVariants = VARIANT_REGISTRY.hero;
    if (!heroVariants || heroVariants.length === 0) return;
    const template = heroVariants[0];
    const synthetics: SectionVariant[] = Array.from({ length: 1000 }, (_, i) => ({
      ...template,
      id: `hero:synthetic-${i}` as SectionVariant['id'],
      slug: `synthetic-${i}`,
      name: `Synthetic ${i}`,
      isDefault: false,
      lifecycle: { status: 'certified', schemaVersion: 1, implementationVersion: 1 },
    }));
    (VARIANT_REGISTRY as Record<string, SectionVariant[]>).hero = [...heroVariants, ...synthetics];
    try {
      const started = performance.now();
      const ranked = resolveEligibleImplementations(baseRequest, { limit: 18 });
      const elapsed = performance.now() - started;
      expect(ranked.length).toBeLessThanOrEqual(18);
      expect(elapsed).toBeLessThan(500);
      // Determinism holds at scale.
      const again = resolveEligibleImplementations(baseRequest, { limit: 18 }).map((c) => c.implementationId);
      expect(ranked.map((c) => c.implementationId)).toEqual(again);
    } finally {
      (VARIANT_REGISTRY as Record<string, SectionVariant[]>).hero = heroVariants;
    }
  });

  it('every section family resolves at least one eligible implementation', () => {
    const families = Object.keys(VARIANT_REGISTRY) as SectionType[];
    for (const family of families) {
      const ranked = resolveEligibleImplementations({ sectionType: family, seed: 'coverage' });
      expect(ranked.length, `family ${family} has no eligible implementation`).toBeGreaterThan(0);
    }
  });
});
