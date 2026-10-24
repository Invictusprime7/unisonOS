import {
  buildProviderPlan,
  parseProviderDistribution,
  selectParallelProvider,
} from "../_shared/providerRouter.ts";
import type { ClassifiedTask } from "../_shared/taskClassifier.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

const task: ClassifiedTask = {
  type: "single_file_edit",
  fastPath: false,
  shouldUseMemory: false,
  shouldUseCompactContext: false,
  prefersJsonOutput: true,
  skipResearch: true,
  skipThinking: false,
};

const wizardTask: ClassifiedTask = {
  ...task,
  type: "wizard_seed_generation",
};

const wizardContentTask: ClassifiedTask = {
  ...task,
  type: "wizard_content_enrichment",
  fastPath: true,
  shouldUseCompactContext: true,
  skipThinking: true,
};

const bothProviders = (name: string): string | undefined => ({
  GEMINI_API_KEY: "gemini-test-key",
  OPENAI_API_KEY: "openai-test-key",
  AI_PROVIDER_MODE: "hybrid",
}[name]);

// Explicit Gemini-only deployments retain their provider restriction.
const geminiOnlyMode = (name: string): string | undefined => ({
  GEMINI_API_KEY: "gemini-test-key",
  OPENAI_API_KEY: "openai-test-key",
  AI_PROVIDER_MODE: "gemini-only",
}[name]);

Deno.test("complex and advanced edits use capable models with larger bounded budgets", () => {
  for (const [tier, budget] of [['complex', 48000], ['advanced', 64000]] as const) {
    const plan = buildProviderPlan(task, true, undefined, tier, 'edit',
      (name) => name === 'OPENAI_API_KEY' ? 'test-key' : undefined);
    assertEquals(plan.gatewayModels[0].id, 'openai/gpt-4.1');
    assertEquals(plan.gatewayModels[0].maxTokens, 16384);
    assertEquals(plan.gatewayModels.some((model) => model.id.includes('gpt-5')), false);
    assertEquals(plan.gatewayModels.find((model) => model.id.startsWith('google/'))?.maxTokens, budget);
    assertEquals(plan.gatewayModels.find((model) => model.id === 'openai/gpt-4.1')?.maxTokens, 16384);
    assertEquals(plan.preferLongLeadAttempt, true);
  }
});

Deno.test("Composer has a dedicated 48k budget and honors explicit lower caps", () => {
  const authorTask = { ...task, type: 'site_page_author' as const };
  const readEnv = (name: string) => name === 'OPENAI_API_KEY' ? 'test-key' : undefined;
  const plan = buildProviderPlan(authorTask, true, undefined, 'simple', 'author', readEnv);
  assertEquals(plan.gatewayModels[0].id, 'google/gemini-3.8-flash');
  assertEquals(plan.gatewayModels[0].maxTokens, 48_000);
  const capped = buildProviderPlan(authorTask, true, { maxTokens: 8000, timeoutMs: 20000 }, 'advanced', 'author', readEnv);
  assertEquals(capped.gatewayModels.every((model) => model.maxTokens <= 8000), true);
  assertEquals(capped.perModelTimeoutMs, 20000);
});

Deno.test("parses explicit Gemini/OpenAI traffic weights", () => {
  assertEquals(parseProviderDistribution("gemini=70,openai=30"), { gemini: 70, openai: 30 });
  assertEquals(parseProviderDistribution("invalid"), { gemini: 100, openai: 0 });
});

Deno.test('App Builder page writing, repair and Builder edits use only Gemini', () => {
  const env = (name: string) => name === 'LOVABLE_API_KEY' ? 'lovable-test-key'
    : name === 'AI_PROVIDER_DISTRIBUTION' ? 'gemini=0,openai=100' : bothProviders(name);
  for (const type of ['site_page_author', 'site_page_repair', 'builder_source_edit'] as const) {
    const plan = buildProviderPlan({ ...task, type }, true, undefined, 'complex', 'composer', env);
    assertEquals(plan.primaryProvider, 'gemini');
    assertEquals(plan.geminiOnly, true);
    assertEquals(plan.gatewayLeads, undefined);
    assertEquals(plan.gatewayModels.map(model => model.id), ['google/gemini-3.8-flash']);
  }
});

Deno.test("honors fixed Gemini and OpenAI distributions", () => {
  assertEquals(selectParallelProvider("any-key", { gemini: 100, openai: 0 }), "gemini");
  assertEquals(selectParallelProvider("any-key", { gemini: 0, openai: 100 }), "openai");
});

Deno.test("uses a stable routing key for weighted assignment", () => {
  const distribution = { gemini: 50, openai: 50 };
  assertEquals(
    selectParallelProvider("user-42:edit landing page", distribution),
    selectParallelProvider("user-42:edit landing page", distribution),
  );
});

Deno.test("moves the selected provider models to the front of the plan", () => {
  const geminiPlan = buildProviderPlan(
    task,
    true,
    undefined,
    "moderate",
    "route-gemini",
    (name) => name === "AI_PROVIDER_DISTRIBUTION" ? "gemini=100,openai=0" : bothProviders(name),
  );
  const openAIPlan = buildProviderPlan(
    task,
    true,
    undefined,
    "moderate",
    "route-openai",
    (name) => name === "AI_PROVIDER_DISTRIBUTION" ? "gemini=0,openai=100" : bothProviders(name),
  );

  assertEquals(geminiPlan.primaryProvider, "gemini");
  assertEquals(geminiPlan.gatewayModels[0]?.id.startsWith("google/"), true);
  assertEquals(openAIPlan.primaryProvider, "openai");
  assertEquals(openAIPlan.gatewayModels[0]?.id.startsWith("openai/"), true);
});

Deno.test("migrates a stale GPT-5 selection to GPT-4.1 ahead of weighted routing", () => {
  const plan = buildProviderPlan(
    task,
    true,
    { autoModelSelection: false, selectedModelId: "openai/gpt-5" },
    "moderate",
    "route-gemini",
    (name) => name === "AI_PROVIDER_DISTRIBUTION" ? "gemini=100,openai=0" : bothProviders(name),
  );

  assertEquals(plan.primaryProvider, undefined);
  assertEquals(plan.gatewayModels[0]?.id, "openai/gpt-4.1");
  assertEquals(plan.gatewayModels.some((model) => model.id.includes('gpt-5')), false);
});

Deno.test("Builder and Wizard plans never select GPT-5 and respect OpenAI limits", () => {
  for (const type of ['single_file_edit', 'multi_file_edit', 'debug_fix', 'site_page_author', 'site_page_repair', 'builder_source_edit', 'wizard_seed_generation'] as const) {
    for (const tier of ['simple', 'moderate', 'complex', 'advanced'] as const) {
      const plan = buildProviderPlan({ ...task, type }, true, undefined, tier, 'test', bothProviders);
      assertEquals(plan.gatewayModels.some((model) => model.id.includes('gpt-5')), false);
      for (const model of plan.gatewayModels.filter((model) => model.id.startsWith('openai/'))) {
        assertEquals(model.maxTokens <= (model.id.includes('gpt-4.1') ? 32768 : 16384), true);
      }
    }
  }
});

Deno.test("uses the only configured text provider", () => {
  const plan = buildProviderPlan(
    task,
    true,
    undefined,
    "moderate",
    "any-key",
    (name) => ({ OPENAI_API_KEY: "openai-test-key", AI_PROVIDER_MODE: "hybrid" }[name]),
  );

  assertEquals(plan.primaryProvider, "openai");
});

Deno.test("uses Gemini exclusively when AI_PROVIDER_MODE opts out of the OpenAI fallback", () => {
  const plan = buildProviderPlan(
    wizardTask,
    true,
    { timeoutMs: 120_000 },
    "advanced",
    "wizard-route",
    geminiOnlyMode,
  );

  assertEquals(plan.primaryProvider, "gemini");
  assertEquals(plan.gatewayModels.map((model) => model.id), [
    "google/gemini-3.8-flash",
  ]);
});

Deno.test("retains configured OpenAI when AI_PROVIDER_MODE is omitted", () => {
  const plan = buildProviderPlan(
    wizardTask,
    true,
    { timeoutMs: 85_000 },
    "advanced",
    "wizard-route",
    (name) => ({
      GEMINI_API_KEY: "gemini-test-key",
      OPENAI_API_KEY: "openai-test-key",
    }[name]),
  );

  assertEquals(plan.primaryProvider, "gemini");
  assertEquals(plan.perModelTimeoutMs, 85_000);
  assertEquals(plan.gatewayModels.some((model) => model.id.startsWith("openai/")), true);
});

Deno.test("keeps a funded Gemini Wizard leading, with OpenAI retained as a fallback", () => {
  const plan = buildProviderPlan(
    wizardTask,
    true,
    { timeoutMs: 130_000 },
    "advanced",
    "wizard-route",
    bothProviders,
  );

  assertEquals(plan.gatewayModels.map((model) => model.id), [
    "google/gemini-3.8-flash",
    "openai/gpt-4.1",
  ]);
  assertEquals(plan.primaryProvider, "gemini");
  assertEquals(plan.perModelTimeoutMs, 125_000);
  assertEquals(plan.preferLongLeadAttempt, false);
});

Deno.test("gives focused Wizard page completion one model with its full budget, no fallback split", () => {
  const plan = buildProviderPlan(
    wizardTask,
    true,
    {
      timeoutMs: 50_000,
      maxTokens: 20_000,
      autoModelSelection: false,
      selectedModelId: "google/gemini-3.8-flash",
    },
    "advanced",
    "wizard-page-route",
    bothProviders,
  );

  assertEquals(plan.gatewayModels.map((model) => model.id), [
    "google/gemini-3.8-flash",
  ]);
  assertEquals(plan.gatewayModels.map((model) => model.maxTokens), [20_000]);
  assertEquals(plan.fallbackMaxTokens, 20_000);
  assertEquals(plan.perModelTimeoutMs, 50_000);
  assertEquals(plan.preferLongLeadAttempt, false);
  assertEquals(plan.balancedProviderAttempts, true);
});

Deno.test("keeps Wizard content enrichment bounded to small structured-output models", () => {
  const plan = buildProviderPlan(
    wizardContentTask,
    true,
    undefined,
    "moderate",
    "wizard-content-route",
    bothProviders,
  );

  assertEquals(plan.gatewayModels.map((model) => model.id), [
    "google/gemini-3.8-flash",
  ]);
  assertEquals(plan.gatewayModels.map((model) => model.maxTokens), [6_000]);
  assertEquals(plan.fallbackMaxTokens, 6_000);
  assertEquals(plan.perModelTimeoutMs, 35_000);
});

Deno.test("Gemini-primary mode keeps App Builder page writing on Gemini only", () => {
  const plan = buildProviderPlan({ ...task, type: "site_page_author" }, true, undefined, "complex", "composer",
    name => name === "AI_PROVIDER_MODE" ? "gemini-primary" : name === "LOVABLE_API_KEY" ? "test-key" : bothProviders(name));
  assertEquals(plan.primaryProvider, "gemini");
  assertEquals(plan.gatewayLeads, undefined);
  assertEquals(plan.gatewayModels.some(model => model.id.startsWith("openai/")), false);
});
