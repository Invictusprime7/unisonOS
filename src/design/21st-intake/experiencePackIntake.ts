/**
 * 21st Intake — Experience-pack classification (motion / 3D).
 *
 * Development-time only. Turns a quarantined 21st source record into the
 * capability + compatibility + lifecycle contracts a motion or 3D design must
 * carry before it can be promoted into VARIANT_REGISTRY. It never registers
 * anything itself and never ships raw three.js into generated sites:
 * 3D sources must be adapted onto the canonical experience primitives
 * (`@/unison/ui/experience`), which own WebGL guards, budgets and fallbacks.
 */

import type { TwentyFirstComponentRecord } from './provenance';
import { auditDependencies } from './dependencyResolver';
import type {
  VariantCapabilityContract,
  VariantCompatibilityContract,
} from '@/sections/variants/types';

export type ExperienceMotionLevel = 'none' | 'restrained' | 'motion-rich' | 'immersive';

export interface ExperiencePackIntakeAssessment {
  sourceId: string;
  motionLevel: ExperienceMotionLevel;
  requiresThreeD: boolean;
  /** Runtime capability the site must be approved for. */
  requiredCapabilities: string[];
  dependencyAudit: ReturnType<typeof auditDependencies>;
  capabilities: Pick<VariantCapabilityContract, 'motion'>;
  compatibility: Pick<VariantCompatibilityContract, 'experiencePreferences'>;
  /** Promotion blockers; empty means it may advance to `candidate`. */
  blockers: string[];
  lifecycleStatus: 'experimental' | 'candidate';
}

const THREE_D_DEPS = ['three', '@react-three/fiber', '@react-three/drei'];

export function assessExperiencePackIntake(record: TwentyFirstComponentRecord): ExperiencePackIntakeAssessment {
  const deps = record.dependencies ?? [];
  const caps = (record.capabilities ?? {}) as Record<string, boolean | undefined>;
  const requiresThreeD = Boolean(caps.threeD) || deps.some((d) => THREE_D_DEPS.some((t) => d === t || d.startsWith(`${t}/`)));
  const motion = Boolean(caps.motion) || deps.includes('framer-motion');

  const motionLevel: ExperienceMotionLevel = requiresThreeD ? 'immersive' : motion ? 'motion-rich' : 'none';
  const dependencyAudit = auditDependencies(deps, requiresThreeD ? ['threeD'] : []);

  const adaptation = (record.adaptation ?? {}) as Record<string, boolean | undefined>;
  const blockers: string[] = [];
  if (dependencyAudit.rejected.length) blockers.push(`rejected-dependencies:${dependencyAudit.rejected.join(',')}`);
  if (dependencyAudit.unknown.length) blockers.push(`unreviewed-dependencies:${dependencyAudit.unknown.join(',')}`);
  if (motionLevel !== 'none' && !adaptation.reducedMotionSupported) blockers.push('reduced-motion-fallback-missing');
  if (requiresThreeD && !adaptation.importsNormalized) blockers.push('three-d-must-adapt-onto-unison-experience-primitives');
  if (!adaptation.tokensNormalized) blockers.push('tokens-not-normalized');
  if (record.licenseReview?.status !== 'verified') blockers.push('license-review-pending');

  const experiencePreferences: VariantCompatibilityContract['experiencePreferences'] =
    motionLevel === 'immersive' ? ['immersive']
      : motionLevel === 'motion-rich' ? ['motion-rich', 'immersive']
        : ['standard', 'motion-rich', 'immersive'];

  return {
    sourceId: record.sourceId,
    motionLevel,
    requiresThreeD,
    requiredCapabilities: requiresThreeD ? ['experience.three-d'] : [],
    dependencyAudit,
    capabilities: { motion: { level: motionLevel, reducedMotionRequired: motionLevel !== 'none' } },
    compatibility: { experiencePreferences },
    blockers,
    lifecycleStatus: blockers.length === 0 ? 'candidate' : 'experimental',
  };
}
