/** Optional owner preferences shared by all App Builder entry points. No credentials. */
export interface GatewayConfig {
  selectedModelId: string;
  reasoningEffort: 'none' | 'low' | 'medium' | 'high';
  timeoutMs: number;
  autoModelSelection: boolean;
  streamResponse: boolean;
  maxTokens: number;
}

const SETTINGS_KEY = 'unison:app-builder:ai-settings';
let current: GatewayConfig | undefined;

export function readAppBuilderAISettings(): GatewayConfig | undefined {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return current;
    const value = JSON.parse(raw);
    if (typeof value?.selectedModelId !== 'string'
      || !['none', 'low', 'medium', 'high'].includes(value.reasoningEffort)
      || !Number.isFinite(value.timeoutMs) || value.timeoutMs <= 0
      || !Number.isFinite(value.maxTokens) || value.maxTokens <= 0
      || typeof value.autoModelSelection !== 'boolean'
      || typeof value.streamResponse !== 'boolean') return current;
    current = value;
  } catch { /* Preferences are optional; retain server defaults or current choices. */ }
  return current ? { ...current } : undefined;
}

export function saveAppBuilderAISettings(config: GatewayConfig): void {
  current = { ...config };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(current)); } catch { /* optional cache */ }
}

export function resolveAppBuilderAIOptions(overrides?: Record<string, unknown>): Record<string, unknown> | undefined {
  // Explicit request options remain intact; only unset callers inherit preferences.
  if (overrides) return overrides;
  const config = readAppBuilderAISettings();
  if (!config) return overrides;
  return {
    selectedModelId: config.selectedModelId,
    reasoningEffort: config.reasoningEffort,
    timeoutMs: config.timeoutMs,
    autoModelSelection: config.autoModelSelection,
    maxTokens: config.maxTokens,
    ...overrides,
  };
}