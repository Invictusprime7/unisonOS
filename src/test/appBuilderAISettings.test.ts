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

  it('migrates stale saved and explicit provider selections to Gemini', () => {
    const stored = new Map<string, string>([['unison:app-builder:ai-settings', JSON.stringify({
      selectedModelId: 'openai/gpt-4.1', reasoningEffort: 'high', timeoutMs: 110000,
      maxTokens: 32768, autoModelSelection: false, streamResponse: true,
    })]]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    });

    expect(readAppBuilderAISettings()?.selectedModelId).toBe('google/gemini-3.8-flash');
    expect(resolveAppBuilderAIOptions({ selectedModelId: 'openai/gpt-5' })?.selectedModelId)
      .toBe('google/gemini-3.8-flash');
  });
});