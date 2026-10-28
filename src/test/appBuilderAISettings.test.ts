import { afterEach, describe, expect, it, vi } from 'vitest';
import { readAppBuilderAISettings, resolveAppBuilderAIOptions, saveAppBuilderAISettings } from '@/services/app-builder/appBuilderAISettings';

afterEach(() => vi.unstubAllGlobals());

describe('shared App Builder AI preferences', () => {
  it('reuses the owner settings for marketplace instead of independent model options', () => {
    const stored = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    });
    saveAppBuilderAISettings({ selectedModelId: 'google/gemini-3.8-flash', reasoningEffort: 'high',
      timeoutMs: 110000, maxTokens: 32768, autoModelSelection: false, streamResponse: true });
    expect(readAppBuilderAISettings()?.selectedModelId).toBe('google/gemini-3.8-flash');
    expect(resolveAppBuilderAIOptions()).toEqual({ selectedModelId: 'google/gemini-3.8-flash',
      reasoningEffort: 'high', timeoutMs: 110000, maxTokens: 32768, autoModelSelection: false });
    expect(resolveAppBuilderAIOptions({ timeoutMs: 60000 })?.timeoutMs).toBe(60000);
  });
});