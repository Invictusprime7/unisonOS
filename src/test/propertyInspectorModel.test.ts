import { describe, it, expect } from 'vitest';
import {
  resolveInspectorModel,
  buildInspectorPatchPlan,
  buildContextualAIPrompt,
  resolveInspectorCanonicalSections,
  resolveSlotSectionType,
  sectionSelector,
  slotSelector,
  type InspectorSelection,
} from '@/services/builder/propertyInspectorModel';
import { getGenerationVariantsForSection } from '@/sections/variants/registry';
import { buildWizardDesignIntervention, readWizardDesignIntervention } from '@/services/wizardDesignIntervention';

function heroSelection(overrides: Partial<InspectorSelection> = {}): InspectorSelection {
  const variantId = getGenerationVariantsForSection('hero')[0]?.id;
  return {
    tagName: 'h1',
    selector: '[data-ut-slot="hero.headline"]',
    attributes: { 'data-ut-variant': variantId as string },
    scopeAncestors: {
      sectionId: 'hero-1',
      sectionType: 'hero',
      slotId: 'hero.headline',
      pagePath: '/src/pages/Index.tsx',
      intents: [],
      primaryIntent: null,
      clickedTag: 'h1',
    },
    ...overrides,
  };
}

describe('property inspector model (M9)', () => {
  it('recovers section family from a canonical slot when DOM ancestors omit it', () => {
    expect(resolveSlotSectionType(null, 'hero.headline')).toBe('hero');
    expect(resolveSlotSectionType('services', 'hero.headline')).toBe('services');
    expect(resolveSlotSectionType(null, null)).toBeNull();
  });

  it('resolves canonical section + slot identity from a preview selection', () => {
    const model = resolveInspectorModel(heroSelection());
    expect(model.scope).toBe('slot');
    expect(model.sectionId).toBe('hero-1');
    expect(model.sectionType).toBe('hero');
    expect(model.contract).not.toBeNull();
    expect(model.activeSlot?.id).toBe('hero.headline');
    expect(model.targetSelector).toBe(slotSelector('hero-1', 'hero.headline'));
  });

  it('recovers a missing DOM section ID from one matching canonical composition entry', () => {
    const model = resolveInspectorModel({
      attributes: { 'data-ut-variant': 'hero:full-bleed' },
      scopeAncestors: { sectionType: 'hero' },
      canonicalSections: [{ sectionId: 'hero-canonical', sectionType: 'hero', variantId: 'hero:full-bleed' }],
    });

    expect(model.sectionId).toBe('hero-canonical');
    const fullBleed = model.variants.find((variant) => variant.id === 'hero:full-bleed');
    expect(fullBleed?.current).toBe(true);
    const nextVariant = model.variants.find((variant) => variant.id !== 'hero:full-bleed')!;
    const plan = buildInspectorPatchPlan(model, { kind: 'variant', variantId: nextVariant.id });
    expect(plan).toMatchObject({ ok: true, op: { type: 'set-variant', sectionId: 'hero-canonical' } });
  });

  it('recovers section identity from active variants when a legacy page has no composition descriptor', () => {
    const canonicalSections = resolveInspectorCanonicalSections(undefined, {
      'home-hero': 'hero:launch-showcase',
    });
    const model = resolveInspectorModel({
      attributes: { 'data-ut-variant': 'hero:launch-showcase' },
      scopeAncestors: { sectionType: 'hero' },
      canonicalSections,
    });

    expect(model.sectionId).toBe('home-hero');
    expect(model.warnings).not.toContain('This element has no canonical section identity, so edits cannot be scoped.');
    const plan = buildInspectorPatchPlan(model, { kind: 'variant', variantId: 'hero:image-fan' as never });
    expect(plan).toMatchObject({ ok: true, op: { type: 'set-variant', sectionId: 'home-hero' } });
  });

  it('resolves the same active variants stored in the canonical VFS mirror', () => {
    const intervention = buildWizardDesignIntervention({
      businessName: 'Preview Studio',
      businessModel: 'appointment_service',
      industryOverlay: 'salon',
      templateId: 'salon-premium',
      themePresetId: 'organic',
      wizardSeedId: 'inspector-mirror-test',
    });
    intervention.activeVariants['home-hero'] = 'hero:launch-showcase';
    const canonicalIntervention = readWizardDesignIntervention({
      '/.unison/design-intervention.json': JSON.stringify(intervention),
    });
    const canonicalSections = resolveInspectorCanonicalSections(undefined, canonicalIntervention?.activeVariants);
    const model = resolveInspectorModel({
      attributes: { 'data-ut-variant': 'hero:launch-showcase' },
      scopeAncestors: { sectionType: 'hero' },
      canonicalSections,
    });

    expect(model.sectionId).toBe('home-hero');
  });

  it('keeps variant mutations disabled when canonical section identity is ambiguous', () => {
    const model = resolveInspectorModel({
      attributes: { 'data-ut-variant': 'hero:full-bleed' },
      scopeAncestors: { sectionType: 'hero' },
      canonicalSections: [
        { sectionId: 'hero-one', sectionType: 'hero', variantId: 'hero:full-bleed' },
        { sectionId: 'hero-two', sectionType: 'hero', variantId: 'hero:full-bleed' },
      ],
    });

    expect(model.sectionId).toBeNull();
    expect(model.warnings[0]).toContain('multiple canonical sections');
    expect(buildInspectorPatchPlan(model, { kind: 'variant', variantId: 'hero:centered' as never })).toMatchObject({ ok: false });
  });

  it('offers only generation-eligible variants and marks the current one', () => {
    const model = resolveInspectorModel(heroSelection());
    expect(model.variants.length).toBeGreaterThan(0);
    expect(model.variants.filter((v) => v.current)).toHaveLength(1);
    const eligible = new Set(getGenerationVariantsForSection('hero').map((v) => v.id));
    for (const option of model.variants) expect(eligible.has(option.id)).toBe(true);
  });

  it('exposes real component states including reduced motion', () => {
    const model = resolveInspectorModel(heroSelection());
    expect(model.states?.supported).toContain('hover');
    expect(model.states?.responsive).toContain('reduced-motion');
    expect(model.states?.interaction.reducedMotion).toBeTruthy();
  });

  it('degrades to element scope without throwing for unknown identity', () => {
    const model = resolveInspectorModel({ tagName: 'div', selector: 'div > span' });
    expect(model.scope).toBe('element');
    expect(model.contract).toBeNull();
    expect(model.variants).toHaveLength(0);
    expect(model.warnings.length).toBeGreaterThan(0);
    expect(resolveInspectorModel(null).scope).toBe('element');
  });

  it('falls back to section scope when no slot was clicked', () => {
    const selection = heroSelection();
    const model = resolveInspectorModel({
      ...selection,
      selector: sectionSelector('hero-1'),
      scopeAncestors: { ...selection.scopeAncestors!, slotId: null },
    });
    expect(model.scope).toBe('section');
    expect(model.targetSelector).toBe(sectionSelector('hero-1'));
  });

  it('builds a canonical variant-switch plan and rejects uncertified variants', () => {
    const model = resolveInspectorModel(heroSelection());
    const other = model.variants.find((v) => !v.current)!;
    const plan = buildInspectorPatchPlan(model, { kind: 'variant', variantId: other.id });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.op.type).toBe('set-variant');
      expect(plan.op.selector).toBe(sectionSelector('hero-1'));
    }

    const rejected = buildInspectorPatchPlan(model, {
      kind: 'variant',
      variantId: 'hero:not-a-real-design' as never,
    });
    expect(rejected.ok).toBe(false);
  });

  it('rejects slot mutations that do not match the artifact contract', () => {
    const model = resolveInspectorModel(heroSelection());
    const unknown = buildInspectorPatchPlan(model, { kind: 'slot-text', slotId: 'hero.invented', value: 'x' });
    expect(unknown.ok).toBe(false);

    const wrongKind = buildInspectorPatchPlan(model, {
      kind: 'slot-asset',
      slotId: 'hero.headline',
      assetUrl: 'https://example.com/a.jpg',
    });
    expect(wrongKind.ok).toBe(false);

    const ok = buildInspectorPatchPlan(model, { kind: 'slot-text', slotId: 'hero.headline', value: 'New' });
    expect(ok.ok).toBe(true);
  });

  it('keeps styling on documented theme tokens only', () => {
    const model = resolveInspectorModel(heroSelection());
    const good = buildInspectorPatchPlan(model, { kind: 'token', token: model.editableTokens[0], value: '0 0% 10%' });
    expect(good.ok).toBe(true);
    const bad = buildInspectorPatchPlan(model, { kind: 'token', token: '--made-up', value: 'red' });
    expect(bad.ok).toBe(false);
  });

  it('only binds intents the artifact declares', () => {
    const model = resolveInspectorModel(heroSelection());
    const bad = buildInspectorPatchPlan(model, { kind: 'intent', intent: 'totally.invented' });
    expect(bad.ok).toBe(false);
    if (model.intents.length) {
      const good = buildInspectorPatchPlan(model, { kind: 'intent', intent: model.intents[0] });
      expect(good.ok).toBe(true);
    }
  });

  it('grounds contextual AI edits in canonical identity', () => {
    const model = resolveInspectorModel(heroSelection());
    const prompt = buildContextualAIPrompt(model, 'make this headline punchier');
    expect(prompt).toContain('hero-1');
    expect(prompt).toContain('hero.headline');
    expect(prompt).toContain('theme tokens');
  });
});
