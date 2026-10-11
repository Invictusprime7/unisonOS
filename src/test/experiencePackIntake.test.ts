import { describe, it, expect } from 'vitest';
import { assessExperiencePackIntake } from '@/design/21st-intake/experiencePackIntake';
import { TWENTY_FIRST_INTAKE_MANIFEST } from '@/design/21st-intake/manifest';
import { createIntakeRecord } from '@/design/21st-intake/provenance';

describe('experience-pack intake', () => {
  it('gates a three.js source behind the 3D capability and keeps it experimental until adapted', () => {
    const tunnel = TWENTY_FIRST_INTAKE_MANIFEST.find((r) => r.sourceId === '21st:6588');
    expect(tunnel).toBeTruthy();
    const a = assessExperiencePackIntake(tunnel!);
    expect(a.motionLevel).toBe('immersive');
    expect(a.requiredCapabilities).toEqual(['experience.three-d']);
    expect(a.dependencyAudit.rejected).toEqual([]);
    expect(a.blockers).toContain('three-d-must-adapt-onto-unison-experience-primitives');
    expect(a.lifecycleStatus).toBe('experimental');
    expect(a.compatibility.experiencePreferences).toEqual(['immersive']);
  });

  it('motion-only sources need no 3D capability and require reduced-motion fallbacks', () => {
    const reveal = TWENTY_FIRST_INTAKE_MANIFEST.find((r) => r.sourceId === '21st:19240');
    const a = assessExperiencePackIntake(reveal!);
    expect(a.requiresThreeD).toBe(false);
    expect(a.capabilities.motion?.reducedMotionRequired).toBe(true);
    expect(a.blockers).toContain('reduced-motion-fallback-missing');
  });

  it('a fully adapted, license-verified motion source may advance to candidate', () => {
    const base = createIntakeRecord({ sourceId: '21st:test', name: 'T', sourceUrl: 'x', dependencies: ['framer-motion'] } as never);
    const record = {
      ...base,
      capabilities: { ...base.capabilities, motion: true },
      adaptation: { ...base.adaptation, reducedMotionSupported: true, tokensNormalized: true, importsNormalized: true },
      licenseReview: { status: 'verified' as const },
    };
    const a = assessExperiencePackIntake(record);
    expect(a.blockers).toEqual([]);
    expect(a.lifecycleStatus).toBe('candidate');
  });
});

import { getDesignImplementation } from '@/services/designImplementationRegistry';
import { resolveEligibleImplementations } from '@/services/designImplementationEligibility';
import { heroTunnelImmersiveJSX } from '@/sections/variants/jsxTemplates';

describe('tunnel-immersive promotion', () => {
  it('is registered with 21st provenance and only offered to immersive sites', () => {
    expect(getDesignImplementation('hero:tunnel-immersive' as never)).toBeTruthy();
    const base = { sectionType: 'hero' as const, pageRole: 'home' as const };
    const standard = resolveEligibleImplementations({ ...base, experiencePreference: 'standard' }).map((c) => c.implementationId);
    expect(standard).not.toContain('hero:tunnel-immersive');
    const immersive = resolveEligibleImplementations({ ...base, experiencePreference: 'immersive', availableCapabilities: ['experience.three-d'] }).map((c) => c.implementationId);
    expect(immersive).toContain('hero:tunnel-immersive');
  });
  it('generated markup honours reduced motion and ships no raw three.js', () => {
    const jsx = heroTunnelImmersiveJSX({ heading: 'Into depth', ctaButtons: [{ text: 'Start', href: '#', isPrimary: true }] });
    expect(jsx).toContain('prefers-reduced-motion');
    expect(jsx).not.toMatch(/three/);
  });
});
