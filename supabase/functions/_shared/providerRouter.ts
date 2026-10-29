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
  /** Gemini is the sole supported direct text provider. */
  primaryProvider?: ParallelTextProvider;
  /** Per-model timeout in ms */
  perModelTimeoutMs: number;
  /** Max tokens hint for direct fallback APIs */
  fallbackMaxTokens: number;
  /** Give the lead model nearly the whole turn; quick failures may still fall through. */
  preferLongLeadAttempt?: boolean;
  /** Split a bounded focused turn across compatible provider attempts. */
  balancedProviderAttempts?: boolean;
  /** Run the lead model and the managed gateway simultaneously; first valid answer wins. */
  raceGateway?: boolean;
  /** Only Gemini models may serve this turn (direct Gemini API first, Gemini on the managed gateway as backup). */
  geminiOnly?: boolean;
}

export interface GatewayOverrides {
  selectedModelId?: string;
  reasoningEffort?: "none" | "low" | "medium" | "high";
  timeoutMs?: number;
  autoModelSelection?: boolean;
  maxTokens?: number;
}

export type ParallelTextProvider = 'gemini';

type EnvReader = (name: string) => string | undefined;

export function isGeminiExclusiveProviderMode(
  readEnv: EnvReader = (name) => Deno.env.get(name),
): boolean {
  const mode = (readEnv('AI_PROVIDER_MODE') || 'hybrid').trim().toLowerCase();
  if (mode !== 'gemini-only') return false;
  if (!readEnv('GEMINI_API_KEY') && !readEnv('GOOGLE_API_KEY') && !readEnv('UNISONGEMINI_API_KEY')) return false;
  return true;
}

function providerForModel(modelId: string): ParallelTextProvider | null {
  if (modelId.startsWith('google/') || modelId.startsWith('gemini-')) return 'gemini';
  return null;
}

function selectPrimaryProvider(readEnv: EnvReader): ParallelTextProvider | undefined {
  const hasGemini = Boolean(readEnv('GEMINI_API_KEY') || readEnv('GOOGLE_API_KEY') || readEnv('UNISONGEMINI_API_KEY'));
  return hasGemini ? 'gemini' : undefined;
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
  // Gemini 3.8 Flash is the sole supported direct text model.
  geminiFlash: { id: DEFAULT_GEMINI_GATEWAY_MODEL, label: "Gemini 3.8 Flash" },
} as const;

/** Direct-Gemini composition model; GEMINI_COMPOSER_MODEL can name a newer one the key can use. */
export function composerGeminiModel(readEnv: EnvReader): { id: string; label: string } {
  const raw = configuredComposerGeminiModel(readEnv);
  return { id: `google/${raw}`, label: raw };
}

function m(spec: { readonly id: string; readonly label: string }, maxTokens: number): ModelSpec {
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
    const advancedModels: ModelSpec[] = [m(MODELS.geminiFlash, advancedTokens)];
    return { models: advancedModels, timeoutBoostMs: 45000 };
  }

  return { models: [m(MODELS.geminiFlash, 48_000)], timeoutBoostMs: 30000 };
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
    // Repair turns apply targeted diagnostics to existing files.
    case "site_page_repair":
      plan = {
        gatewayModels: [m(composerGeminiModel(readEnv), 48_000)],
        perModelTimeoutMs: 110_000,
        fallbackMaxTokens: 32_000,
        preferLongLeadAttempt: true,
      };
      break;
    case "site_page_author":
    case "builder_source_edit":
      plan = {
        gatewayModels: [m(composerGeminiModel(readEnv), 48_000)],
        // Full-page authoring gets the platform window; scoped EDIT turns are small.
        perModelTimeoutMs: task.type === "site_page_author" ? 135_000 : 110_000,
        fallbackMaxTokens: 32_000,
        preferLongLeadAttempt: true,
      };
      break;
    // ── Lane B: Wizard seed (full builder-brain path — sole wizard lane) ──
    case "wizard_seed_generation":
      // Gemini owns the complete long-output Wizard turn; the managed gateway
      // remains the managed fallback after direct Gemini fails.
      plan = {
        gatewayModels: [m(MODELS.geminiFlash, 36_000)],
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
        gatewayModels: [m(MODELS.geminiFlash, 12000)],
        perModelTimeoutMs: 30000,
        fallbackMaxTokens: 10000,
      };
      break;

    case "single_file_edit":
      plan = {
        gatewayModels: [m(MODELS.geminiFlash, 24000)],
        perModelTimeoutMs: 40000,
        fallbackMaxTokens: 24000,
      };
      break;

    // ── Lane B: Heavy reasoning tasks ───────────────────────────────────
    case "debug_fix":
      plan = {
        gatewayModels: [m(MODELS.geminiFlash, 32000)],
        perModelTimeoutMs: 45000,
        fallbackMaxTokens: 32000,
      };
      break;

    case "multi_file_edit":
    case "surgical_edit":
      plan = {
        gatewayModels: [m(MODELS.geminiFlash, 32000)],
        perModelTimeoutMs: 45000,
        fallbackMaxTokens: 32000,
      };
      break;

    // ── Lane B: Default ─────────────────────────────────────────────────
    // ── Launch Desk ──────────────────────────────────────────────────────
    case "launch_desk":
    default:
      plan = {
        gatewayModels: [m(MODELS.geminiFlash, 32000)],
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
      // Older tabs may retain a provider choice that is no longer supported.
      const selectedModelId = overrides.selectedModelId;
      const modelId = selectedModelId.startsWith('google/') || selectedModelId.startsWith('gemini-')
        ? selectedModelId
        : composerGeminiModel(readEnv).id;
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

  // Gemini is the only supported direct provider. Stale saved selections are
  // normalized above and never create an alternate provider route.
  const hasExplicitModel = overrides?.autoModelSelection === false && Boolean(overrides.selectedModelId);
  const wizardGeminiConfigured = task.type === "wizard_seed_generation"
    && Boolean(readEnv('GEMINI_API_KEY') || readEnv('GOOGLE_API_KEY') || readEnv('UNISONGEMINI_API_KEY'));
  const isComposerTask = task.type === "site_page_author" || task.type === "site_page_repair" || task.type === "builder_source_edit";
  if (isComposerTask) {
    const geminiModel = m(composerGeminiModel(readEnv), Math.min(48_000, overrides?.maxTokens ?? 48_000));
    plan.gatewayModels = [geminiModel];
    plan.primaryProvider = 'gemini';
    plan.geminiOnly = isGeminiExclusiveProviderMode(readEnv);
    plan.raceGateway = false;
  } else if (!hasExplicitModel) {
    plan.primaryProvider = wizardGeminiConfigured
      ? 'gemini'
      : selectPrimaryProvider(readEnv);
    plan.gatewayModels = prioritizeProviderModels(plan.gatewayModels, plan.primaryProvider);
  }

  // The funded Gemini key owns all direct Wizard turns.
  if (wizardGeminiConfigured) {
    const geminiModels = plan.gatewayModels.filter((model) => providerForModel(model.id) === 'gemini');
    plan.gatewayModels = geminiModels;
    plan.primaryProvider = geminiModels.length > 0 ? 'gemini' : undefined;
  }

  // Respect an explicit Gemini-only deployment policy; otherwise use configured providers.
  if (isGeminiExclusiveProviderMode(readEnv)) {
    plan.gatewayModels = plan.gatewayModels.filter((model) => providerForModel(model.id) === 'gemini');
    plan.primaryProvider = plan.gatewayModels.length > 0 ? 'gemini' : undefined;
  }

  const geminiConfigured = Boolean(readEnv('GEMINI_API_KEY') || readEnv('GOOGLE_API_KEY') || readEnv('UNISONGEMINI_API_KEY'));
  if (geminiConfigured && !plan.geminiOnly) {
    const geminiModels = plan.gatewayModels.filter((model) => providerForModel(model.id) === 'gemini');
    if (geminiModels.length > 0) {
      plan.gatewayModels = [...geminiModels, ...plan.gatewayModels.filter((model) => providerForModel(model.id) !== 'gemini')];
      plan.primaryProvider = 'gemini';
    }
  }

  plan.gatewayModels = plan.gatewayModels.filter((model, index, models) =>
    models.findIndex(candidate => candidate.id === model.id) === index);
  return plan;
}
