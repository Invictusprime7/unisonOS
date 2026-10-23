import { describe, expect, it } from 'vitest';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { ALL_COMPOSITIONS } from '@/sections/templates';
import { curateMarketplaceTemplate } from '@/marketplace/curateMarketplaceTemplate';
import { getMarketplaceTemplateDesignPreset, MARKETPLACE_TEMPLATE_DESIGN_PRESETS } from '@/marketplace/templateDesignPresets';
import { buildWizardDesignIntervention } from '@/services/wizardDesignIntervention';

describe('Marketplace template curation', () => {
  it('uses canonical topology, intent bindings, theme seeds, and portable 21st sources', () => {
    const template = ALL_COMPOSITIONS.find((composition) => composition.id === 'salon-premium');
    const themePreset = THEME_PRESETS.find((preset) => preset.id === 'editorial');
    expect(template).toBeDefined();
    expect(themePreset).toBeDefined();

    const curated = curateMarketplaceTemplate(template!, themePreset!);
    const metadata = JSON.parse(curated.files['/.unison/marketplace-curation.json']);

    expect(curated.contract.topology.sitePlan.pages.length).toBeGreaterThan(1);
    expect(curated.contract.topology.pageRegistry.pages).toBeDefined();
    expect(curated.contract.business.intentBindings.some((binding) => binding.coreIntent === 'booking.create')).toBe(true);
    expect(curated.contract.design.themePresetId).toBe(themePreset!.id);
    expect(curated.designSourceBundle.identity.seed).toBe(curated.contract.design.seed);
    expect(curated.contract.design.registryContext.generationPolicy).toBe('21st-only');
    expect(curated.designSourceBundle.implementations.length).toBeGreaterThan(0);
    expect(curated.designSourceBundle.implementations.every((source) => source.execution.mode === 'portable-recipe')).toBe(true);
    expect(curated.designSourceBundle.primitives.families.length).toBeGreaterThan(0);
    expect(Object.keys(curated.contract.design.uiFoundation)).toContain('manifestPath');
    expect(Object.keys(curated.files).some((path) => path.startsWith('/src/pages/'))).toBe(true);
    expect(curated.files['/.unison/marketplace-curation.json']).toBeDefined();
    expect(metadata.themePresetId).toBe(themePreset!.id);
    expect(metadata.topology).toHaveLength(curated.routeCount);
    expect(metadata.intentBindings.some((binding: { coreIntent: string }) => binding.coreIntent === 'booking.create')).toBe(true);
    expect(metadata.portableRecipeIds.length).toBeGreaterThan(0);

    const baselineSeed = buildWizardDesignIntervention({
      ...curated.selections,
      projectId: curated.selections.businessId,
    }).seed;
    const alternateThemeSeed = buildWizardDesignIntervention({
      ...curated.selections,
      projectId: curated.selections.businessId,
      themePresetId: 'modern',
    }).seed;
    expect(curated.contract.design.seed).toBe(baselineSeed);
    expect(alternateThemeSeed).not.toBe(baselineSeed);
  });

  it('curates every registered composition into a routed, registry-backed preview', () => {
    const usedPresets = new Set<string>();
    const usedPacks = new Set<string>();
    for (const template of ALL_COMPOSITIONS) {
      const designPreset = getMarketplaceTemplateDesignPreset(template.id);
      const themePreset = THEME_PRESETS.find((preset) => preset.id === designPreset.themePresetId)!;
      const curated = curateMarketplaceTemplate(template, themePreset, designPreset.artDirectionPackId);
      const pageFiles = curated.contract.topology.sitePlan.pages.map((page) => page.filePath);

      usedPresets.add(themePreset.id);
      usedPacks.add(designPreset.artDirectionPackId);
      expect(curated.contract.design.themePresetId, template.id).toBe(themePreset.id);
      expect(curated.contract.design.registryContext.generationPolicy, template.id).toBe('21st-only');
      expect(curated.designSourceBundle.implementations.length, template.id).toBeGreaterThan(0);
      expect(pageFiles.every((path) => Boolean(curated.files[path])), template.id).toBe(true);
      expect(curated.files['/.unison/marketplace-curation.json'], template.id).toBeDefined();
    }

    expect(Object.keys(MARKETPLACE_TEMPLATE_DESIGN_PRESETS).sort()).toEqual(ALL_COMPOSITIONS.map((template) => template.id).sort());
    expect(usedPresets.size).toBeGreaterThan(1);
    expect(usedPacks.size).toBeGreaterThan(1);
  });

  it('includes generic profile-derived portfolio and property templates without source-project branding', () => {
    const portfolio = ALL_COMPOSITIONS.find((template) => template.id === 'profile-derived-modernist-studio');
    const property = ALL_COMPOSITIONS.find((template) => template.id === 'profile-derived-warm-property-collection');

    expect(portfolio).toMatchObject({ name: 'Modernist Studio Portfolio', industry: 'portfolio' });
    expect(property).toMatchObject({ name: 'Warm Property Collection', industry: 'realestate' });
    expect(portfolio?.tags).toContain('profile-derived');
    expect(property?.tags).toContain('profile-derived');
    expect(JSON.stringify([portfolio, property])).not.toMatch(/Zen Site|Esteem Site/);
  });
});