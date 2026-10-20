// supabase/functions/ai-code-assistant/providerRouter.ts
// Selects AI models and timeouts based on classified task type + prompt complexity.
// Lane-aware: lighter models for simple edits, stronger for debug/multi-file.
// Complexity-aware: auto-upgrades model tier for complex/advanced prompts.

import type { ClassifiedTask } from "./taskClassifier.ts";
import type { PromptComplexity } from "./promptPreprocessor.ts";
import { DEFAULT_GEMINI_GATEWAY_MODEL, configuredComposerGeminiModel } from './geminiModel.ts';

export interface ModelSpec {
  id: string;
  maxTokens: number;
  label: string;
}

export interface ProviderPlan {
  /** Ordered list of direct-provider models to try. */
  gatewayModels: ModelSpec[];
  /** Provider selected by the weighted runtime before fallbacks. */
  primaryProvider?: ParallelTextProvider;
  /** Per-model timeout in ms */
  perModelTimeoutMs: number;
  /** Max tokens hint for direct fallback APIs */
  fallbackMaxTokens: number;
  /** Give the lead model nearly the whole turn; quick failures may still fall through. */
  preferLongLeadAttempt?: boolean;
  /** Split a bounded focused turn across compatible provider attempts. */
  balancedProviderAttempts?: boolean;
  /** Keep a usable window for the non-reasoning fallback after a slow lead. */
  fallbackReserveMs?: number;
  /** Run the lead model and the managed gateway simultaneously; first valid answer wins. */
  raceGateway?: boolean;
  /** Hybrid page writing: the managed gateway writes first; direct keys take over only if it fails. */
  gatewayLeads?: boolean;
}

export interface GatewayOverrides {
  selectedModelId?: string;
  reasoningEffort?: "none" | "low" | "medium" | "high";
  timeoutMs?: number;
  autoModelSelection?: boolean;
  maxTokens?: number;
}

export type ParallelTextProvider = "gemini" | "openai";
type EnvReader = (name: string) => string | undefined;

export interface ProviderDistribution {
  gemini: number;
  openai: number;
}

export function isGeminiExclusiveProviderMode(
  readEnv: EnvReader = (name) => Deno.env.get(name),
): boolean {
  const mode = (readEnv('AI_PROVIDER_MODE') || 'hybrid').trim().toLowerCase();
  if (mode !== 'gemini-only') return false;
  // Never lock to Gemini when it has no key but OpenAI does.
  if (!readEnv('GEMINI_API_KEY') && !readEnv('GOOGLE_API_KEY') && !readEnv('UNISONGEMINI_API_KEY')) return false;
  return true;
}

// Funded Gemini leads; configured OpenAI remains a hybrid fallback.
const DEFAULT_PROVIDER_DISTRIBUTION: ProviderDistribution = { gemini: 100, openai: 0 };

/** Parses `gemini=50,openai=50` or `gemini:50,openai:50`. */
export function parseProviderDistribution(raw?: string): ProviderDistribution {
  if (!raw?.trim()) return { ...DEFAULT_PROVIDER_DISTRIBUTION };

  const parsed: Partial<ProviderDistribution> = {};
  for (const entry of raw.split(',')) {
    const [name, value] = entry.split(/[:=]/, 2).map((part) => part.trim().toLowerCase());
    if ((name !== 'gemini' && name !== 'openai') || !value) continue;
    const weight = Number(value);
    if (Number.isFinite(weight) && weight >= 0) parsed[name] = weight;
  }

  const gemini = parsed.gemini ?? 0;
  const openai = parsed.openai ?? 0;
  return gemini + openai > 0 ? { gemini, openai } : { ...DEFAULT_PROVIDER_DISTRIBUTION };
}

function stableBucket(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

export function selectParallelProvider(
  routingKey: string,
  distribution: ProviderDistribution,
): ParallelTextProvider {
  const total = distribution.gemini + distribution.openai;
  if (total <= 0) return 'gemini';
  return stableBucket(routingKey || 'unison-default') * total < distribution.gemini
    ? 'gemini'
    : 'openai';
}

function providerForModel(modelId: string): ParallelTextProvider | null {
  if (modelId.startsWith('google/') || modelId.startsWith('gemini-')) return 'gemini';
  if (modelId.startsWith('openai/') || modelId.startsWith('gpt-')) return 'openai';
  return null;
}

function selectPrimaryProvider(
  routingKey: string | undefined,
  readEnv: EnvReader,
): ParallelTextProvider | undefined {
  const hasGemini = Boolean(readEnv('GEMINI_API_KEY') || readEnv('GOOGLE_API_KEY') || readEnv('UNISONGEMINI_API_KEY'));
  const hasOpenAI = !isGeminiExclusiveProviderMode(readEnv) && Boolean(readEnv('OPENAI_API_KEY'));
  if (!hasGemini && !hasOpenAI) return undefined;
  if (!hasGemini) return 'openai';
  if (!hasOpenAI) return 'gemini';
  return selectParallelProvider(
    routingKey || 'unison-default',
    parseProviderDistribution(readEnv('AI_PROVIDER_DISTRIBUTION')),
  );
}

function prioritizeProviderModels(models: ModelSpec[], primaryProvider?: ParallelTextProvider): ModelSpec[] {
  if (!primaryProvider) return models;
  return [
    ...models.filter((model) => providerForModel(model.id) === primaryProvider),
    ...models.filter((model) => providerForModel(model.id) !== primaryProvider),
  ];
}

// ── Model tiers ─────────────────────────────────────────────────────────────

const MODELS = {
  // Gemini 3.8 Flash is the one supported Gemini text model. Provider
  // failover is handled by OpenAI and Lovable, not a stale Gemini version.
  geminiFlash: { id: DEFAULT_GEMINI_GATEWAY_MODEL, label: "Gemini 3.8 Flash" },
  gpt41: { id: "openai/gpt-4.1", label: "GPT-4.1" },
  gpt41Mini: { id: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
  gpt4oMini: { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  gpt4o: { id: "openai/gpt-4o", label: "GPT-4o" },
} as const;

/** Direct-Gemini composition model; GEMINI_COMPOSER_MODEL can name a newer one the key can use. */
export function composerGeminiModel(readEnv: EnvReader): { id: string; label: string } {
  const raw = configuredComposerGeminiModel(readEnv);
  return { id: `google/${raw}`, label: raw };
}

function m(spec: typeof MODELS[keyof typeof MODELS], maxTokens: number): ModelSpec {
  return { id: spec.id, maxTokens, label: spec.label };
}

/**
 * Upgrade a model list based on prompt complexity tier.
 * - simple: keep as-is
 * - moderate: keep as-is (task type already handled)
 * - complex: prepend a stronger model if not already primary
 * - advanced: use strongest models, increase tokens
 */
function applyComplexityUpgrade(
  models: ModelSpec[],
  complexity: PromptComplexity,
): { models: ModelSpec[]; timeoutBoostMs: number } {
  if (complexity === "simple" || complexity === "moderate") {
    return { models, timeoutBoostMs: 0 };
  }

  if (complexity === "advanced") {
    const advancedTokens = 64_000;
    const advancedModels: ModelSpec[] = [
      m(MODELS.gpt41, 32_768),
      m(MODELS.gpt4o, 16_384),
      m(MODELS.geminiFlash, advancedTokens),
      m(MODELS.gpt4oMini, advancedTokens),
    ];
    return { models: advancedModels, timeoutBoostMs: 45000 };
  }

  return { models: [
    m(MODELS.gpt41, 32_768),
    m(MODELS.gpt4o, 16_384),
    m(MODELS.geminiFlash, 48_000),
    m(MODELS.gpt4oMini, 48_000),
  ], timeoutBoostMs: 30000 };
}

/**
 * Build the provider/model plan for a classified task.
 * Lane-aware routing + complexity-aware auto-upgrade:
 *   - Wizard: fast structured models, protected from overrides AND complexity upgrades
 *   - Debug/multi-file: stronger reasoning models
 *   - Single-file/style edits: cheaper/faster models (upgraded if complex)
 *   - Nav page: lightweight models
 */
export function buildProviderPlan(
  task: ClassifiedTask,
  hasConfiguredTextProvider: boolean,
  overrides?: GatewayOverrides,
  complexity: PromptComplexity = "moderate",
  routingKey?: string,
  readEnv: EnvReader = (name) => Deno.env.get(name),
): ProviderPlan {
  if (!hasConfiguredTextProvider) {
    return {
      gatewayModels: [],
      perModelTimeoutMs: 25000,
      fallbackMaxTokens: 32000,
    };
  }

  let plan: ProviderPlan;

  switch (task.type) {
    // Repair turns apply targeted diagnostics to existing files: a smaller model leads, full models back it up.
    case "site_page_repair":
      plan = {
        gatewayModels: [
          m(MODELS.gpt41Mini, 16_384),
          m(MODELS.gpt41, 16_384),
          m(composerGeminiModel(readEnv), 48_000),
        ],
        perModelTimeoutMs: 110_000,
        fallbackMaxTokens: 32_000,
        preferLongLeadAttempt: true,
        fallbackReserveMs: 30_000,
      };
      break;
    case "site_page_author":
    case "builder_source_edit":
      plan = {
        gatewayModels: [
          m(MODELS.gpt41, 16_384),
          m(MODELS.gpt4o, 16_384),
          // Stronger Gemini leads composition when funded Gemini serves the turn.
          m(composerGeminiModel(readEnv), 48_000),
        ],
        // Full-page authoring gets the platform window; scoped EDIT turns are small.
        perModelTimeoutMs: task.type === "site_page_author" ? 135_000 : 110_000,
        fallbackMaxTokens: 32_000,
        preferLongLeadAttempt: true,
        fallbackReserveMs: 30_000,
      };
      break;
    // ── Lane B: Wizard seed (full builder-brain path — sole wizard lane) ──
    case "wizard_seed_generation":
      // Two-model lineup so a single provider blip (prose leak, soft-fail,
      // token cutoff) can't strand a Wizard launch with an empty/partial
      // bundle. Both honor the same multi-file JSON output contract.
      plan = {
        gatewayModels: [
          // Current stable model for full-site generation.
          m(MODELS.geminiFlash, 36_000),
          // GPT-4.1 has a 32k output window without a reasoning phase, making
          // it a better bounded fallback for this large structured response.
          m(MODELS.gpt41, 32_000),
        ],
        // Production Wizard responses commonly exceed 20k output tokens.
        // Production traces include valid large Wizard generations that run
        // beyond 95 seconds. Keep this below the provider loop's 135-second
        // ceiling while allowing funded Gemini requests to finish.
        // Fast failures (auth/429) still fall through to the next provider.
        perModelTimeoutMs: 125_000,
        fallbackMaxTokens: 36000,
        preferLongLeadAttempt: true,
      };
      break;

    case "wizard_composition":
    case "wizard_content_enrichment":
      plan = {
        gatewayModels: [
          m(MODELS.geminiFlash, 6000),
        ],
        perModelTimeoutMs: 35000,
        fallbackMaxTokens: 6000,
      };
      break;

    case "nav_page_generation":
      plan = {
        gatewayModels: [
          m(MODELS.geminiFlash, 12000),
          m(MODELS.gpt41, 12000),
          m(MODELS.gpt4oMini, 12000),
        ],
        perModelTimeoutMs: 30000,
        fallbackMaxTokens: 10000,
      };
      break;

    case "single_file_edit":
      plan = {
        gatewayModels: [
          m(MODELS.geminiFlash, 24000),
          m(MODELS.gpt41, 24000),
          m(MODELS.gpt4oMini, 24000),
          m(MODELS.gpt4o, 24000),
        ],
        perModelTimeoutMs: 40000,
        fallbackMaxTokens: 24000,
      };
      break;

    // ── Lane B: Heavy reasoning tasks ───────────────────────────────────
    case "debug_fix":
      plan = {
        gatewayModels: [
          m(MODELS.geminiFlash, 32000),
          m(MODELS.gpt41, 32000),
          m(MODELS.gpt4oMini, 32000),
          m(MODELS.gpt4o, 32000),
        ],
        perModelTimeoutMs: 45000,
        fallbackMaxTokens: 32000,
      };
      break;

    case "multi_file_edit":
    case "surgical_edit":
      plan = {
        gatewayModels: [
          m(MODELS.geminiFlash, 32000),
          m(MODELS.gpt41, 32000),
          m(MODELS.gpt4oMini, 32000),
          m(MODELS.gpt4o, 32000),
        ],
        perModelTimeoutMs: 45000,
        fallbackMaxTokens: 32000,
      };
      break;

    // ── Lane B: Default ─────────────────────────────────────────────────
    // ── Launch Desk ──────────────────────────────────────────────────────
    case "launch_desk":
    default:
      plan = {
        gatewayModels: [
          m(MODELS.geminiFlash, 32000),
          m(MODELS.gpt41, 32000),
          m(MODELS.gpt4oMini, 32000),
          m(MODELS.gpt4o, 32000),
        ],
        perModelTimeoutMs: 45000,
        fallbackMaxTokens: 32000,
      };
      break;
  }

  // Apply complexity-based auto-upgrade (wizard seed is protected — the
  // wizard seed lineup is intentionally tuned for first-shot success and
  // must not be swapped out for slower advanced-tier models).
  const usesProtectedWizardPlan = task.type === "wizard_seed_generation"
    || task.type === "wizard_composition"
    || task.type === "wizard_content_enrichment"
    || task.type === "wizard_interaction_enrichment"
    || task.type === "site_page_author"
    || task.type === "site_page_repair"
    || task.type === "builder_source_edit";
  if (!usesProtectedWizardPlan) {
    const upgrade = applyComplexityUpgrade(plan.gatewayModels, complexity);
    plan.gatewayModels = upgrade.models;
    plan.perModelTimeoutMs += upgrade.timeoutBoostMs;
    if (complexity === 'complex' || complexity === 'advanced') {
      plan.fallbackMaxTokens = complexity === 'advanced' ? 64_000 : 48_000;
      plan.preferLongLeadAttempt = true;
      plan.fallbackReserveMs = 60_000;
    }
  }

  // Wizard seed generation is protected from model swaps, but focused page
  // completion requests must still be able to lower resource ceilings. If
  // these caps are ignored, the server keeps producing a 36k/95s response
  // after the browser's shorter isolated-page deadline has already aborted.
  // 20k (not 12k) because the role-aware content gate (4+ body regions, role
  // evidence, 1200+ chars) can genuinely need more tokens for card-heavy
  // pages like Services/Pricing — a tighter cap here was truncating output.
  const FOCUSED_WIZARD_COMPLETION_MAX_TOKENS = 20_000;
  if (overrides) {
    const isFocusedWizardCompletion =
      task.type === "wizard_seed_generation" && (overrides.maxTokens ?? Infinity) <= FOCUSED_WIZARD_COMPLETION_MAX_TOKENS;
    if (
      (task.type !== "wizard_seed_generation" || isFocusedWizardCompletion)
      && overrides.autoModelSelection === false
      && overrides.selectedModelId
    ) {
      const tokens = overrides.maxTokens ?? plan.gatewayModels[0]?.maxTokens ?? 32000;
      // Older tabs can retain a GPT-5 selection after the menu is updated.
      const modelId = /^(?:openai\/)?gpt-5/.test(overrides.selectedModelId)
        ? 'openai/gpt-4.1' : overrides.selectedModelId;
      const label = modelId.split("/").pop() ?? modelId;
      const userModel: ModelSpec = { id: modelId, maxTokens: tokens, label };
      // A focused isolated-page completion gets ONE model with its FULL
      // per-model timeout — appending fallbacks here means the provider loop
      // divides the already-short browser budget across two model attempts
      // instead of giving the explicitly requested model its whole window.
      plan.gatewayModels = isFocusedWizardCompletion
        ? [userModel]
        : [userModel, ...plan.gatewayModels.filter(m => m.id !== modelId)];
    }
    if (overrides.timeoutMs) {
      plan.perModelTimeoutMs = task.type === "wizard_seed_generation"
        ? Math.min(plan.perModelTimeoutMs, overrides.timeoutMs)
        : overrides.timeoutMs;
    }
    if (overrides.maxTokens) {
      plan.gatewayModels = plan.gatewayModels.map((model) => ({
        ...model,
        maxTokens: Math.min(model.maxTokens, overrides.maxTokens!),
      }));
      plan.fallbackMaxTokens = Math.min(plan.fallbackMaxTokens, overrides.maxTokens);
      if (task.type === "wizard_seed_generation" && overrides.maxTokens <= FOCUSED_WIZARD_COMPLETION_MAX_TOKENS) {
        plan.preferLongLeadAttempt = false;
        plan.balancedProviderAttempts = true;
      }
    }
  }

  // Explicit user model selections always win. A funded Gemini Wizard is a
  // long-output, single-provider contract: an exhausted OpenAI fallback can
  // only consume the tail of the launch deadline after Gemini has timed out.
  // Other tasks retain the stable weighted provider split.
  const hasExplicitModel = overrides?.autoModelSelection === false && Boolean(overrides.selectedModelId);
  const wizardGeminiConfigured = task.type === "wizard_seed_generation"
    && Boolean(readEnv('GEMINI_API_KEY') || readEnv('GOOGLE_API_KEY') || readEnv('UNISONGEMINI_API_KEY'));
  const isComposerTask = task.type === "site_page_author" || task.type === "site_page_repair" || task.type === "builder_source_edit";
  if (!hasExplicitModel && isComposerTask) {
    plan.primaryProvider = (readEnv('GEMINI_API_KEY') || readEnv('GOOGLE_API_KEY') || readEnv('UNISONGEMINI_API_KEY'))
      ? 'gemini' : selectPrimaryProvider(routingKey, readEnv);
    plan.gatewayModels = prioritizeProviderModels(plan.gatewayModels, plan.primaryProvider);
    // Hybrid: launch page writing/repair goes to the managed gateway first (the
    // model that produced the Oct 1 baseline); funded Gemini is the backup.
    if (isComposerTask && readEnv('LOVABLE_API_KEY') && readEnv('AI_PROVIDER_MODE') !== 'gemini-primary') {
      plan.gatewayLeads = true;
    }
  } else if (!hasExplicitModel) {
    plan.primaryProvider = wizardGeminiConfigured
      ? 'gemini'
      : selectPrimaryProvider(routingKey, readEnv);
    plan.gatewayModels = prioritizeProviderModels(plan.gatewayModels, plan.primaryProvider);
  }

  // Gemini leads the Wizard when funded, but OpenAI models stay in the chain as
  // fallbacks so a Gemini billing 429 does not fail the whole turn.
  if (wizardGeminiConfigured) {
    const openAiFallbackAvailable = !isGeminiExclusiveProviderMode(readEnv)
      && Boolean(readEnv('OPENAI_API_KEY'));
    const geminiModels = plan.gatewayModels.filter((model) => providerForModel(model.id) === 'gemini');
    const openAiModels = openAiFallbackAvailable
      ? plan.gatewayModels.filter((model) => providerForModel(model.id) === 'openai')
      : [];
    plan.gatewayModels = [...geminiModels, ...openAiModels];
    if (openAiModels.length > 0) plan.preferLongLeadAttempt = false;
    plan.primaryProvider = geminiModels.length > 0
      ? 'gemini'
      : (openAiModels.length > 0 ? 'openai' : undefined);
  }

  // Respect an explicit Gemini-only deployment policy; otherwise use configured providers.
  if (isGeminiExclusiveProviderMode(readEnv)) {
    plan.gatewayModels = plan.gatewayModels.filter((model) => providerForModel(model.id) === 'gemini');
    plan.primaryProvider = plan.gatewayModels.length > 0 ? 'gemini' : undefined;
  }

  plan.gatewayModels = plan.gatewayModels.filter((model, index, models) =>
    models.findIndex(candidate => candidate.id === model.id) === index);
  plan.gatewayModels = plan.gatewayModels.map((model) => ({
    ...model,
    maxTokens: /^(?:openai\/)?gpt-4o(?:-|$)/.test(model.id)
      ? Math.min(model.maxTokens, 16_384)
      : /^(?:openai\/)?gpt-4\.1(?:-|$)/.test(model.id)
        ? Math.min(model.maxTokens, 16_384) : model.maxTokens,
  }));
  return plan;
}
