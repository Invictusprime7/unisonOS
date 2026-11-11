import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

// UPG-01: the Affinity chat is the only new-project creation surface.
describe('prompt-first creation entry points', () => {
  it.each([
    'src/components/home/sections/HeroSection.tsx',
    'src/pages/Onboarding.tsx',
    'src/components/creatives/WebBuilder.tsx',
  ])('%s does not mount the guided setup wizard', (path) => {
    expect(read(path)).not.toMatch(/<LauncherWizard\b/);
  });

  it.each([
    'src/components/home/sections/HeroSection.tsx',
    'src/pages/Onboarding.tsx',
  ])('%s creates sites through the chat-native panel', (path) => {
    expect(read(path)).toContain('<PromptLaunchPanel');
  });

  it('runs the one canonical launch pipeline from the prompt-only input', () => {
    const panel = read('src/components/launch/PromptLaunchPanel.tsx');
    expect(panel).toContain('runLaunchPipeline(input');
    expect(panel).toContain('buildPromptLaunchInput(brief');
    expect(panel).not.toMatch(/commitMutation|vfsCommitService/);
  });

  it('shows the UniversalCreation launch plan in Affinity before generation', () => {
    const panel = read('src/components/launch/PromptLaunchPanel.tsx');
    expect(panel).toContain('data-testid="prompt-launch-plan"');
    expect(panel).toContain('Motion & experience');
    expect(panel).toContain('Section treatments');
    expect(panel).toContain('UI Foundation');
    expect(panel).toContain('Requested pages');
  });

  it('offers the starter fallback only when the AI provider is unavailable', () => {
    const panel = read('src/components/launch/PromptLaunchPanel.tsx');
    expect(panel).toContain("failure.stage === 'app-build' && mode === 'ai' && AI_UNAVAILABLE_PATTERN.test(failure.message)");
  });

  it.each([
    'src/components/onboarding/wizard/LauncherWizard.tsx',
    'src/components/onboarding/wizard/DesignContractInspector.tsx',
    'src/services/launch/interviewDraftService.ts',
    'src/services/launch/chatWizardStep.ts',
  ])('retired guided-setup file %s stays deleted', (path) => {
    expect(existsSync(path)).toBe(false);
  });

  it('no app source imports the retired guided setup', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) { if (entry.name !== 'test' && entry.name !== 'design-system') walk(path); continue; }
        if (!/\.(?:ts|tsx)$/.test(entry.name) || /-3manBeatz\./.test(entry.name)) continue;
        if (/from ['"][^'"]*(?:LauncherWizard|interviewDraftService|chatWizardStep|DesignContractInspector)['"]/.test(read(path))) offenders.push(path);
      }
    };
    walk('src');
    expect(offenders).toEqual([]);
  });

  it('keeps project import available from the chat creation card', () => {
    const panel = read('src/components/launch/PromptLaunchPanel.tsx');
    expect(panel).toContain('<ImportProjectZipButton');
    expect(panel).toContain('<ImportUnisonSiteZipButton businessId={prefill.businessId}');
  });
});
