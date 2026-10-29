import { DEFAULT_GEMINI_MODEL_ID } from '@/config/aiModels';

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

function normalizedConfig(config: GatewayConfig): GatewayConfig {
  const selectedModelId = config.selectedModelId;
  return {
    ...config,
    selectedModelId: selectedModelId.startsWith('google/') || selectedModelId.startsWith('gemini-')
      ? selectedModelId
      : DEFAULT_GEMINI_MODEL_ID,
  };
}

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
    current = normalizedConfig(value as GatewayConfig);
  } catch { /* Preferences are optional; retain server defaults or current choices. */ }
  return current ? { ...current } : undefined;
}

export function saveAppBuilderAISettings(config: GatewayConfig): void {
  current = normalizedConfig(config);
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(current)); } catch { /* optional cache */ }
}

export function resolveAppBuilderAIOptions(overrides?: Record<string, unknown>): Record<string, unknown> | undefined {
  // Explicit request options remain intact except stale provider model choices.
  if (overrides) {
    const selectedModelId = overrides.selectedModelId;
    if (typeof selectedModelId !== 'string'
      || selectedModelId.startsWith('google/') || selectedModelId.startsWith('gemini-')) return overrides;
    return { ...overrides, selectedModelId: DEFAULT_GEMINI_MODEL_ID };
  }
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