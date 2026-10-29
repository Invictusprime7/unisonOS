import { resolveTopologyPageRoleAlias } from '@/platform/core/siteTopologyPlanner';
import { describe, expect, it } from 'vitest';
import { commitToPipeline } from '@/platform/core/commitToPipeline';
import { compilePlayground } from '@/services/playgroundCompiler';
import { getCompositionById } from '@/sections/templates';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { themePresetToThemeTokens } from '@/components/onboarding/themePresetToTokens';

function launch(industryOverlay: 'real_estate', templateId: string) {
  const template = getCompositionById(templateId)!;
  const preset = THEME_PRESETS[0];
  return commitToPipeline({
    selections: {
      businessName: 'Role Healing Co',
      businessModel: 'appointment_service',
      industryOverlay,
      primaryGoal: 'showcase',
      secondaryGoals: [],
      requestedPages: ['immersive'],
      templateId: template.id,
      themePresetId: preset.id,
      themeTokens: themePresetToThemeTokens(preset),
    },
  }, 'wizard-launch');
}

describe('immersive page role wiring (all industries)', () => {
    it('normalizes route and legacy role aliases to canonical topology roles', () => {
      expect(resolveTopologyPageRoleAlias('/rooms')).toBe('services');
      expect(resolveTopologyPageRoleAlias('accommodation')).toBe('services');
      expect(resolveTopologyPageRoleAlias('booking_confirmation')).toBe('thank_you');
      expect(resolveTopologyPageRoleAlias('/experience')).toBe('immersive');
    });

  it('registers the immersive page with a classified role at launch', () => {
    const launched = launch('real_estate', 'real-estate-premium');
    const pages = Object.values(launched.playground.pageRegistry.pages);
    const immersive = pages.find((page) => page.path === '/experience');
    expect(immersive).toBeDefined();
    expect(immersive!.pageRole).toBe('immersive');
  });

  it('self-heals legacy drafts whose immersive page persisted pageRole custom', () => {
    const launched = launch('real_estate', 'real-estate-premium');
    const registry = launched.playground.pageRegistry;
    const immersive = Object.values(registry.pages).find((page) => page.path === '/experience')!;
    // Simulate a draft saved before the immersive role existed.
    immersive.pageRole = 'custom';
    immersive.pageType = 'custom';

    const existing = launched.siteBundleSnapshot.vfsFiles;
    expect(() =>
      compilePlayground(launched.playground, existing, 'Role Healing Co', {
        selectedTemplateId: 'real-estate-premium',
        stage4bCss: existing['/src/index.css'],
      }),
    ).not.toThrow();
    expect(immersive.pageRole).toBe('immersive');
  });
});
