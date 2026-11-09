import { readFileSync } from 'node:fs';
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

  it('offers the starter fallback only when the AI provider is unavailable', () => {
    const panel = read('src/components/launch/PromptLaunchPanel.tsx');
    expect(panel).toContain("failure.stage === 'app-build' && mode === 'ai' && AI_UNAVAILABLE_PATTERN.test(failure.message)");
  });
});
