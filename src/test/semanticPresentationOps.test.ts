import { describe, expect, it } from 'vitest';
import { buildWizardDesignIntervention, type WizardDesignIntervention } from '@/services/wizardDesignIntervention';
import { applySemanticPresentationOps, toCompositionRole } from '@/services/builder/semanticPresentationOps';
import { getGenerationVariantsForSection } from '@/sections/variants/registry';
import { ART_DIRECTION_PACKS } from '@/sections/variants/artDirectionPacks';
import { assertPatchPlan, emptyPatchPlan, type PresentationOp } from '@/types/patchPlan';

function buildFixture(): WizardDesignIntervention {
  const intervention = buildWizardDesignIntervention({
    businessName: 'Northstar Salon',
    businessModel: 'appointment_service',
    industryOverlay: 'salon',
    templateId: 'salon-premium',
    themePresetId: 'organic',
    wizardSeedId: 'wizard-salon-1',
    needsBooking: true,
  });

  const pack = ART_DIRECTION_PACKS[intervention.artDirectionPackId];
  const families = ['navbar', 'hero', 'services', 'testimonials', 'footer'] as const;
  const variants: Record<string, string> = {};
  for (const family of families) {
    const option = getGenerationVariantsForSection(family, pack, 'home')[0];
    expect(option, `no certified ${family} implementation`).toBeTruthy();
    variants[family] = option.id;
  }

  return {
    ...intervention,
    compositionPlan: {
      version: '1.0',
      pages: [{
        role: 'home',
        sectionOrder: [...families],
        copy: { hero: { headline: 'Original headline' } },
        variants,
      }],
    },
  } as WizardDesignIntervention;
}

describe('semantic presentation ops', () => {
  it('maps builder page roles onto the composition vocabulary', () => {
    expect(toCompositionRole('service')).toBe('services');
    expect(toCompositionRole('landing')).toBe('home');
    expect(toCompositionRole('Thank_You')).toBe('thank_you');
    expect(toCompositionRole('nonsense-role')).toBeNull();
  });

  it('writes section copy into the snapshot-owned composition plan', () => {
    const next = applySemanticPresentationOps(buildFixture(), [
      { type: 'setSectionCopy', pageRole: 'home', sectionType: 'hero', copy: { headline: 'New headline' } },
    ]);
    expect(next.compositionPlan?.pages[0].copy?.hero?.headline).toBe('New headline');
  });

  it('records a variant for a section missing from the hydrated intervention', () => {
    const fixture = buildFixture();
    const next = applySemanticPresentationOps(fixture, [
      { type: 'setVariant', sectionId: 'treatment-menu', variantId: 'services:expandable' },
    ]);

    expect(next.activeVariants['treatment-menu']).toBe('services:expandable');
    expect(fixture.activeVariants['treatment-menu']).toBeUndefined();
  });

  it('reorders only the sections the page already owns and keeps chrome pinned', () => {
    const fixture = buildFixture();
    const next = applySemanticPresentationOps(fixture, [
      { type: 'reorderSections', pageRole: 'home', sectionOrder: ['navbar', 'hero', 'testimonials', 'services', 'footer'] },
    ]);
    expect(next.compositionPlan?.pages[0].sectionOrder).toEqual(['navbar', 'hero', 'testimonials', 'services', 'footer']);

    expect(() => applySemanticPresentationOps(fixture, [
      { type: 'reorderSections', pageRole: 'home', sectionOrder: ['hero', 'navbar', 'testimonials', 'services', 'footer'] },
    ])).toThrow(/site shell/);

    expect(() => applySemanticPresentationOps(fixture, [
      { type: 'reorderSections', pageRole: 'home', sectionOrder: ['navbar', 'hero', 'pricing', 'services', 'footer'] },
    ])).toThrow(/rearrange/);
  });

  it('removes a body section with its copy and variant, never the chrome', () => {
    const fixture = buildFixture();
    const next = applySemanticPresentationOps(fixture, [
      { type: 'removeSection', pageRole: 'home', sectionType: 'testimonials' },
    ]);
    expect(next.compositionPlan?.pages[0].sectionOrder).not.toContain('testimonials');
    expect(next.compositionPlan?.pages[0].variants.testimonials).toBeUndefined();

    expect(() => applySemanticPresentationOps(fixture, [
      { type: 'removeSection', pageRole: 'home', sectionType: 'footer' },
    ])).toThrow(/cannot be removed/);
  });

  it('accepts design-level recipe changes and rejects unknown ones', () => {
    const fixture = buildFixture();
    expect(applySemanticPresentationOps(fixture, [{ type: 'setMotionBudget', motionBudget: 'expressive' }]).motionBudget)
      .toBe('expressive');
    expect(applySemanticPresentationOps(fixture, [{ type: 'setLayoutRecipe', layoutRecipe: 'bento-features' }]).layoutRecipe)
      .toBe('bento-features');
    expect(() => applySemanticPresentationOps(fixture, [
      { type: 'setLayoutRecipe', layoutRecipe: 'kitchen-sink' } as unknown as PresentationOp,
    ])).toThrow(/unknown layout recipe/);
  });

  it('rejects edits to a page the site never composed', () => {
    expect(() => applySemanticPresentationOps(buildFixture(), [
      { type: 'setSectionCopy', pageRole: 'pricing', sectionType: 'hero', copy: { headline: 'x' } },
    ])).toThrow(/no composed page/);
  });

  it('validates the expanded op shapes at the patch plan boundary', () => {
    const plan = emptyPatchPlan('inspector edit');
    plan.presentationOps = [
      { type: 'setSectionCopy', pageRole: 'home', sectionType: 'hero', copy: { headline: 'Hello' } },
      { type: 'setMotionBudget', motionBudget: 'restrained' },
    ];
    expect(() => assertPatchPlan(plan)).not.toThrow();

    plan.presentationOps = [{ type: 'setSectionCopy', pageRole: 'home', sectionType: 'hero', copy: {} } as PresentationOp];
    expect(() => assertPatchPlan(plan)).toThrow(/invalid PresentationOp/);

    plan.presentationOps = [{ type: 'setSectionCopy', pageRole: 'home', sectionType: 'hero', copy: { tagline: 'x' } } as unknown as PresentationOp];
    expect(() => assertPatchPlan(plan)).toThrow(/invalid PresentationOp/);
  });
});
