import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * R6 — the standalone AI page generator was a parallel visual pipeline:
 * its own PageRenderer, its own noir/warm/vibrant/minimal/luxury theme
 * presets, and no SiteBundleSnapshot. The endpoint remains only as a thin
 * compatibility adapter to the canonical AI assistant handler.
 */
describe('R6 — legacy AI page generator surface stays deleted', () => {
  const deleted = [
    'src/components/creatives/AIPageGenerator.tsx',
    'src/components/creatives/PageRenderer.tsx',
    'src/hooks/usePageGenerator.ts',
    'src/components/onboarding/SystemsAIPanel.tsx',
    'src/test/systemsAiPanelThemePipeline.test.ts',
    'src/utils/stripComposerTrailer.ts',
  ];

  it.each(deleted)('%s does not exist', (path) => {
    expect(existsSync(path)).toBe(false);
  });

  it('page transport delegates to the existing canonical authenticated handler', () => {
    const source = readFileSync('supabase/functions/generate-page/index.ts', 'utf8');
    expect(source).toContain('handleAssistant(req, true)');
    expect(source).not.toContain('PageRenderer');
    expect(source).not.toContain('commitMutation');
  });

  it('/ai-generator redirects to the canonical builder', () => {
    const source = readFileSync('src/routes/routeConfig.tsx', 'utf8');
    expect(source).toContain('path: "/ai-generator"');
    expect(source).toContain('element: <Navigate to="/web-builder" replace />');
    expect(source).not.toContain('AIPageGenerator');
  });

  it('keeps the legacy Edge Function as a canonical-handler adapter only', () => {
    const source = readFileSync('supabase/functions/generate-page/index.ts', 'utf8');
    expect(source).toContain("from '../ai-code-assistant/handler.ts'");
    expect(source).toContain('handleAssistant(req, true)');
    expect(source).not.toMatch(/(?:commitMutation|site_revisions|buildCanonicalLaunchArtifacts)/);
  });

  it('no surface links to the deleted generator', () => {
    const creatives = readFileSync('src/pages/Creatives.tsx', 'utf8');
    expect(creatives).not.toContain('/ai-generator');
  });

  it('keeps the Wizard launch surface delegated to the canonical launch orchestrator', () => {
    const launcher = readFileSync('src/components/onboarding/wizard/LauncherWizard.tsx', 'utf8');
    expect(launcher).toContain('runLaunchPipeline({ ...input, demoGeneration }, callbacks)');
    expect(launcher).toContain('navigate("/web-builder"');

    const onboardingRoot = resolve(process.cwd(), 'src/components/onboarding');
    const alternateAuthors = readdirSync(onboardingRoot, { recursive: true })
      .map(String)
      .filter((path) => /\.(?:ts|tsx)$/.test(path))
      .filter((path) => {
        const source = readFileSync(resolve(onboardingRoot, path), 'utf8');
        return /\b(?:commitToPipeline|buildCanonicalLaunchArtifacts(?:Async)?)\s*\(/.test(source);
      });
    expect(alternateAuthors).toEqual([]);
  });
});
