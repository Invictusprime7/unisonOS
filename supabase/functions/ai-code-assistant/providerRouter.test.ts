import { buildProviderPlan } from "../_shared/providerRouter.ts";
import type { ClassifiedTask } from "../_shared/taskClassifier.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

const task: ClassifiedTask = {
  type: "single_file_edit", fastPath: false, shouldUseMemory: false,
  shouldUseCompactContext: false, prefersJsonOutput: true, skipResearch: true, skipThinking: false,
};
const wizardTask: ClassifiedTask = { ...task, type: "wizard_seed_generation" };
const wizardContentTask: ClassifiedTask = {
  ...task, type: "wizard_content_enrichment", fastPath: true, shouldUseCompactContext: true, skipThinking: true,
};

const geminiEnv = (name: string): string | undefined => ({ GEMINI_API_KEY: 'test-gemini-key' }[name]);
const geminiOnlyEnv = (name: string): string | undefined => ({
  GEMINI_API_KEY: 'test-gemini-key', AI_PROVIDER_MODE: 'gemini-only',
}[name]);

Deno.test('complexity selects only Gemini with larger bounded budgets', () => {
  for (const [tier, maxTokens] of [['complex', 48_000], ['advanced', 64_000]] as const) {
    const plan = buildProviderPlan(task, true, undefined, tier, 'edit', geminiEnv);
    assertEquals(plan.primaryProvider, 'gemini');
    assertEquals(plan.gatewayModels.map((model) => model.id), ['google/gemini-3.8-flash']);
    assertEquals(plan.gatewayModels[0].maxTokens, maxTokens);
  }
});

Deno.test('Composer uses the configured Gemini model and honors lower request caps', () => {
  const authorTask = { ...task, type: 'site_page_author' as const };
  const env = (name: string) => name === 'GEMINI_COMPOSER_MODEL' ? 'gemini-custom-composer' : geminiEnv(name);
  const plan = buildProviderPlan(authorTask, true, undefined, 'simple', 'author', env);
  assertEquals(plan.gatewayModels.map((model) => model.id), ['google/gemini-custom-composer']);
  assertEquals(plan.gatewayModels[0].maxTokens, 48_000);
  const capped = buildProviderPlan(authorTask, true, { maxTokens: 8000, timeoutMs: 20000 }, 'advanced', 'author', env);
  assertEquals(capped.gatewayModels.every((model) => model.maxTokens <= 8000), true);
  assertEquals(capped.perModelTimeoutMs, 20000);
});

Deno.test('OpenAI-only configuration never creates a provider plan', () => {
  const plan = buildProviderPlan(task, true, undefined, 'moderate', 'stale-openai',
    (name) => name === 'OPENAI_API_KEY' ? 'must-be-ignored' : undefined);
  assertEquals(plan.primaryProvider, undefined);
  assertEquals(plan.gatewayModels.every((model) => model.id.startsWith('google/') || model.id.startsWith('gemini-')), true);
});

Deno.test('App Builder plans never include OpenAI even when its key is configured', () => {
  const env = (name: string) => name === 'OPENAI_API_KEY' ? 'must-be-ignored' : geminiEnv(name);
  for (const type of ['site_page_author', 'site_page_repair', 'builder_source_edit'] as const) {
    const plan = buildProviderPlan({ ...task, type }, true, undefined, 'complex', 'composer', env);
    assertEquals(plan.primaryProvider, 'gemini');
    assertEquals(plan.gatewayModels.map((model) => model.id), ['google/gemini-3.8-flash']);
  }
});

Deno.test('stale saved OpenAI and GPT-5 choices migrate to Gemini', () => {
  for (const selectedModelId of ['openai/gpt-4.1', 'openai/gpt-5']) {
    const plan = buildProviderPlan(task, true, { autoModelSelection: false, selectedModelId }, 'moderate', 'legacy', geminiEnv);
    assertEquals(plan.gatewayModels.map((model) => model.id), ['google/gemini-3.8-flash']);
    assertEquals(plan.primaryProvider, 'gemini');
  }
});

Deno.test('all direct task plans use Gemini only', () => {
  for (const type of ['single_file_edit', 'multi_file_edit', 'debug_fix', 'nav_page_generation', 'site_page_author', 'site_page_repair', 'builder_source_edit', 'wizard_seed_generation'] as const) {
    for (const tier of ['simple', 'moderate', 'complex', 'advanced'] as const) {
      const plan = buildProviderPlan({ ...task, type }, true, undefined, tier, 'all-tasks', geminiEnv);
      assertEquals(plan.gatewayModels.length > 0, true);
      assertEquals(plan.gatewayModels.every((model) => model.id.startsWith('google/') || model.id.startsWith('gemini-')), true);
    }
  }
});

Deno.test('Gemini-only deployment policy and Gemini-primary policy both keep one direct provider', () => {
  const authorTask = { ...task, type: 'site_page_author' as const };
  for (const env of [geminiOnlyEnv, geminiEnv]) {
    const plan = buildProviderPlan(authorTask, true, undefined, 'complex', 'composer', env);
    assertEquals(plan.primaryProvider, 'gemini');
    assertEquals(plan.gatewayModels.map((model) => model.id), ['google/gemini-3.8-flash']);
  }
});

Deno.test('Wizard keeps the full Gemini lead budget and focused completion caps', () => {
  const wizardPlan = buildProviderPlan(wizardTask, true, { timeoutMs: 130_000 }, 'advanced', 'wizard', geminiEnv);
  assertEquals(wizardPlan.gatewayModels.map((model) => model.id), ['google/gemini-3.8-flash']);
  assertEquals(wizardPlan.perModelTimeoutMs, 125_000);
  assertEquals(wizardPlan.preferLongLeadAttempt, true);

  const focused = buildProviderPlan(wizardTask, true, {
    timeoutMs: 50_000, maxTokens: 20_000, autoModelSelection: false, selectedModelId: 'google/gemini-3.8-flash',
  }, 'advanced', 'wizard-page', geminiEnv);
  assertEquals(focused.gatewayModels.map((model) => model.id), ['google/gemini-3.8-flash']);
  assertEquals(focused.gatewayModels[0].maxTokens, 20_000);
  assertEquals(focused.perModelTimeoutMs, 50_000);
  assertEquals(focused.balancedProviderAttempts, true);
});

Deno.test('Wizard content enrichment stays bounded to a single Gemini model', () => {
  const plan = buildProviderPlan(wizardContentTask, true, undefined, 'moderate', 'wizard-content', geminiEnv);
  assertEquals(plan.gatewayModels.map((model) => model.id), ['google/gemini-3.8-flash']);
  assertEquals(plan.gatewayModels[0].maxTokens, 6_000);
  assertEquals(plan.perModelTimeoutMs, 35_000);
});
