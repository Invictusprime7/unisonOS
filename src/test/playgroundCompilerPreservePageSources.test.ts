import { describe, expect, it } from 'vitest';
import { compilePlayground } from '@/services/playgroundCompiler';
import { resolveCapabilities } from '@/services/wizardCapabilityResolver';
import { materializePlayground } from '@/services/wizardPlaygroundMaterializer';
import type { WizardSelections } from '@/platform/core/playground';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { buildThemedIndexCss } from '@/components/onboarding/themePresetToIndexCss';

const selections: WizardSelections = {
  businessName: 'NBA LIVE',
  businessModel: 'general',
  industryOverlay: 'general',
  primaryGoal: '',
  secondaryGoals: [],
  requestedPages: ['home', 'blog'],
  universalCreation: {
    mode: 'open-ended',
    originalPrompt: 'A multi-page live basketball publication',
    sitePurpose: 'Sports publication',
    subject: 'NBA LIVE',
    pages: [
      { route: '/', title: 'Home', purpose: 'Introduce NBA LIVE', suggestedRole: 'home' },
      { route: '/blog', title: 'Blog', purpose: 'Publish reporting', suggestedRole: 'blog' },
    ],
    visualRequirements: [],
    requestedCapabilities: [],
  },
};

describe('preserve page sources during canonical recompiles', () => {
  it('keeps accepted open-ended pages when no industry composition exists', () => {
    const state = materializePlayground(selections, resolveCapabilities(selections)).playground;
    const pages = Object.values(state.pageRegistry.pages);
    const existingFiles = Object.fromEntries(pages.map((page) => [
      page.filePath!,
      `export default function ${page.title.replace(/\W+/g, '') || 'Page'}(){return <main><h1>${page.title}</h1></main>}`,
    ]));
    const stage4bCss = buildThemedIndexCss(THEME_PRESETS.find((preset) => preset.id === 'editorial')!);

    const options = {
      industry: 'universal',
      selectedTemplateId: 'open-ended',
      stage4bCss,
    };
    expect(() => compilePlayground(state, existingFiles, 'NBA LIVE', {
      ...options,
      preservePageSources: true,
    })).not.toThrow();

    const result = compilePlayground(state, existingFiles, 'NBA LIVE', { ...options, preservePageSources: true });
    for (const [path, source] of Object.entries(existingFiles)) {
      expect(result.vfsFiles[path]).toBe(source);
    }
    expect(result.vfsFiles['/src/App.tsx']).toContain('./pages/Blog.tsx');
  });

  it('keeps fresh Wizard launches strict when existing sources are absent', () => {
    const state = materializePlayground(selections, resolveCapabilities(selections)).playground;
    const pages = Object.values(state.pageRegistry.pages);
    const existingFiles = Object.fromEntries(pages.map((page) => [
      page.filePath!,
      `export default function ${page.title.replace(/\W+/g, '') || 'Page'}(){return <main><h1>${page.title}</h1></main>}`,
    ]));
    const stage4bCss = buildThemedIndexCss(THEME_PRESETS.find((preset) => preset.id === 'editorial')!);
    expect(() => compilePlayground(state, existingFiles, 'NBA LIVE', {
      industry: 'universal',
      selectedTemplateId: 'open-ended',
      stage4bCss,
    })).toThrow(/no composition for .* wizard page\(s\)/);
  });
});