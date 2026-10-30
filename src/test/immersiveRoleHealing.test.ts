import { resolveTopologyPageRoleAlias } from '@/platform/core/siteTopologyPlanner';
import { describe, expect, it } from 'vitest';
import { commitToPipeline } from '@/platform/core/commitToPipeline';
import { compilePlayground } from '@/services/playgroundCompiler';
import { getCompositionById } from '@/sections/templates';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { themePresetToThemeTokens } from '@/components/onboarding/themePresetToTokens';
import { resolvedCompositionPathFor } from '@/platform/core/resolvedComposition';

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

  it.each(['visit', '/visit', '/src/pages/visit.tsx'])('classifies informational Visit identity %s as contact, not booking', (identity) => {
    expect(resolveTopologyPageRoleAlias(identity)).toBe('contact');
  });

  it.each(['custom', 'contact'] as const)('recompiles a saved Visit page with legacy custom role and %s type without replacing its source', (pageType) => {
    const launched = launch('real_estate', 'real-estate-premium');
    const page = Object.values(launched.playground.pageRegistry.pages).find((candidate) => candidate.path === '/experience');
    if (!page?.filePath) throw new Error('Expected the launch fixture to include Experience');
    const oldPath = page.filePath;
    const files = { ...launched.siteBundleSnapshot.vfsFiles };
    const source = files[oldPath];
    const oldSidecar = resolvedCompositionPathFor(oldPath);
    const sidecar = JSON.parse(files[oldSidecar]);
    page.path = '/visit';
    page.filePath = '/src/pages/visit.tsx';
    page.pageRole = 'custom';
    page.pageType = pageType;
    files[page.filePath] = source;
    files[resolvedCompositionPathFor(page.filePath)] = JSON.stringify({ ...sidecar, pageFilePath: page.filePath });
    delete files[oldPath];
    delete files[oldSidecar];

    const result = compilePlayground(launched.playground, files, 'Sorella House', {
      selectedTemplateId: 'sorella-house',
      stage4bCss: files['/src/index.css'],
    });

    expect(page.pageRole).toBe('contact');
    expect(page.pageType).toBe('contact');
    expect(result.vfsFiles[page.filePath]).toBe(source);
    expect(result.previewManifest.routes).toContain('/visit');
    expect(result.routerFile.content).toContain('/visit');
  });

  it('prefers an explicit booking type over the informational Visit route alias', () => {
    const launched = launch('real_estate', 'real-estate-premium');
    const page = Object.values(launched.playground.pageRegistry.pages).find((candidate) => candidate.path === '/experience');
    if (!page) throw new Error('Expected the launch fixture to include Experience');
    page.path = '/visit';
    page.pageRole = 'custom';
    page.pageType = 'booking';
    const files = launched.siteBundleSnapshot.vfsFiles;
    compilePlayground(launched.playground, files, 'Role Healing Co', {
      selectedTemplateId: 'real-estate-premium', stage4bCss: files['/src/index.css'],
    });
    expect(page.pageRole).toBe('booking');
    expect(page.pageType).toBe('booking');
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
