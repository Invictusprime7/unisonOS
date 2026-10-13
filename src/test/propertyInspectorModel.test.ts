import { describe, it, expect } from 'vitest';
import {
  resolveInspectorModel,
  buildInspectorPatchPlan,
  buildContextualAIPrompt,
  resolveSlotSectionType,
  sectionSelector,
  slotSelector,
  type InspectorSelection,
} from '@/services/builder/propertyInspectorModel';
import { getGenerationVariantsForSection } from '@/sections/variants/registry';

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
