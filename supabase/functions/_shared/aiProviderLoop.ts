/**
 * AI provider call loop using direct provider APIs.
 * Returns content, reasoning, and the model that succeeded.
 */

import { isGeminiExclusiveProviderMode, type ProviderPlan } from "./providerRouter.ts";
import { extractThinkingTags } from "./responseNormalizer.ts";
import {
  createLastResortGatewayChatCompletion,
  createPlannedChatCompletion,
  normalizeOpenAIModel,
  toAnthropicMessages,
} from "../_shared/ai/providerClient.ts";
import type { ChatCompletionRequest, ChatMessage } from "../_shared/ai/providerClient.ts";
import type { ModelSpec } from './providerRouter.ts';
import { DEFAULT_GEMINI_GATEWAY_MODEL, configuredComposerGeminiModel } from './geminiModel.ts';
import type { GuestDemoUsageMeter } from './guestDemo.ts';

export interface ProviderEarlyError {
  status: number;
  error: string;
}

export interface RawToolCall {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
  name?: string;
  arguments?: unknown;
}

export interface ProviderCallResult {
  content: string;
  reasoning: string;
  /** Which model produced the successful response */
  modelUsed?: string;
  /** Direct provider that served the successful response. */
  providerUsed?: string;
  /** OpenAI-shaped tool_calls returned by the model (chat completions style). */
  toolCalls?: RawToolCall[];
  /** Non-null when we should return an early HTTP error (rate limit, payment required) */
  earlyError?: ProviderEarlyError;
}

const providerForRace = (id: string) =>
  id.startsWith('google/') || id.startsWith('gemini-') ? 'gemini' : 'openai';

async function countGuestPromptTokens(
  aiMessages: Array<{ role: string; content: unknown }>,
  modelId: string,
  signal: AbortSignal,
): Promise<number> {
  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('UNISONGEMINI_API_KEY');
  if (!apiKey) throw new Error('Guest demo Gemini token counter is unavailable');

  const systemText = aiMessages
    .filter((message) => message.role === 'system')
    .map((message) => typeof message.content === 'string' ? message.content : JSON.stringify(message.content))
    .join('\n\n');
  const contents = aiMessages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof message.content === 'string' ? message.content : JSON.stringify(message.content) }],
    }));
  const model = modelId.replace(/^google\//, '');
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:countTokens`, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generateContentRequest: {
          contents,
          ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
        },
      }),
      signal,
    });
  } catch (error) {
    throw new Error(`Guest demo token count failed: ${error instanceof Error ? error.message : 'provider error'}`);
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 180);
    throw new Error(`Guest demo token count failed: ${response.status}${detail ? ` ${detail}` : ''}`);
  }
  const result = await response.json();
  if (!Number.isSafeInteger(result.totalTokens) || result.totalTokens < 0) {
    throw new Error('Guest demo token count failed: invalid provider response');
  }
  return result.totalTokens + aiMessages.length * 64 + 128;
}

export const PROVIDER_LOOP_TOTAL_BUDGET_MS = 145_000;

// A billing/quota-exhausted direct key fails the same way on every request, so
// remember it per isolate for a while instead of rediscovering it (and
// reserving deadline time for it) on every page.
const DIRECT_QUOTA_COOLDOWN_MS = 15 * 60_000;
const directQuotaCooldownUntil: Record<'gemini' | 'openai', number> = { gemini: 0, openai: 0 };
const markDirectQuotaExhausted = (provider: 'gemini' | 'openai') => {
  directQuotaCooldownUntil[provider] = Date.now() + DIRECT_QUOTA_COOLDOWN_MS;
  console.warn(`[AI-Hybrid] ${provider} key is out of credit; skipping it for ${DIRECT_QUOTA_COOLDOWN_MS / 60_000} min`);
};
/** Test hook: forget remembered out-of-credit keys. */
export const resetDirectQuotaCooldown = () => { directQuotaCooldownUntil.gemini = 0; directQuotaCooldownUntil.openai = 0; };
const directOnCooldown = (provider: 'gemini' | 'openai') => Date.now() < directQuotaCooldownUntil[provider];

/** The gateway's own 402 message names the remedy (top-up, temporary hold); never replace it with generic text. */
export function gatewayErrorMessage(errText: string): string {
  try {
    const parsed = JSON.parse(errText) as { message?: unknown; error?: { message?: unknown } | unknown };
    const nested = typeof parsed.error === 'object' && parsed.error ? (parsed.error as { message?: unknown }).message : parsed.error;
    const msg = typeof parsed.message === 'string' ? parsed.message : typeof nested === 'string' ? nested : '';
    if (msg.trim()) return `Lovable AI: ${msg.trim().slice(0, 300)}`;
  } catch { /* not JSON */ }
  return 'Lovable AI refused the request for credit reasons. Please check workspace credits and try again.';
}

export function reserveFallbackWindow(attemptMs: number, remainingMs: number, reserveMs: number): number {
  return Math.min(attemptMs, Math.max(1000, remainingMs - reserveMs - 2000));
}

export function buildPlannedChatCompletionRequest(opts: {
  model: ModelSpec;
  aiMessages: Array<{ role: string; content: unknown }>;
  reasoningEffort?: "none" | "low" | "medium" | "high";
  tools?: unknown[];
  toolChoice?: unknown;
}): ChatCompletionRequest {
  const { model, aiMessages, reasoningEffort, tools, toolChoice } = opts;
  const usesCompletionTokens = model.id.includes('gpt-5');
  const supportsReasoningEffort = usesCompletionTokens
    || model.id.startsWith('google/')
    || model.id.startsWith('gemini-');
  const request: ChatCompletionRequest = {
    model: model.id,
    ...(usesCompletionTokens
      ? { max_completion_tokens: model.maxTokens }
      : { max_tokens: model.maxTokens }),
    messages: aiMessages,
  };

  if (supportsReasoningEffort && reasoningEffort && reasoningEffort !== 'none') {
    request.reasoning_effort = reasoningEffort;
  }
  if (tools && tools.length > 0) {
    request.tools = tools;
    request.tool_choice = toolChoice ?? 'auto';
  }
  return request;
}

export async function runProviderLoop(opts: {
  aiMessages: Array<{ role: string; content: unknown }>;
  providerPlan: ProviderPlan;
  navPageGen: boolean;
  reasoningEffort?: "none" | "low" | "medium" | "high";
  /** Disable direct provider attempts for flows that do not need AI generation. */
  allowDirectFallbacks?: boolean;
  /** OpenAI-compatible chat-completions `tools` array (function tools). */
  tools?: unknown[];
  /** `tool_choice` forwarded to the provider. Defaults to `"auto"` when tools are present. */
  toolChoice?: "auto" | "none" | "required";
  /** Cancels provider work when the browser request disconnects or expires. */
  signal?: AbortSignal;
  /** Remaining request budget, shared with Composer's format-repair turn. */
  totalBudgetMs?: number;
  /** Enforces a persisted cost reservation for each guest provider call. */
  guestUsageMeter?: GuestDemoUsageMeter;
}): Promise<ProviderCallResult> {
  const { aiMessages, providerPlan: requestedProviderPlan, reasoningEffort, allowDirectFallbacks = true, tools, toolChoice, signal, guestUsageMeter } = opts;
  const guestOnly = Boolean(guestUsageMeter);
  const requestedOutputTokens = requestedProviderPlan.gatewayModels.length
    ? Math.max(...requestedProviderPlan.gatewayModels.map((model) => model.maxTokens))
    : requestedProviderPlan.fallbackMaxTokens;
  const guestOutputTokens = guestUsageMeter
    ? Math.max(1, Math.min(guestUsageMeter.maxOutputTokens, requestedProviderPlan.fallbackMaxTokens, requestedOutputTokens))
    : undefined;
  const providerPlan: ProviderPlan = guestUsageMeter
    ? {
      ...requestedProviderPlan,
      gatewayModels: [{
        id: DEFAULT_GEMINI_GATEWAY_MODEL,
        label: 'Gemini 3.8 Flash (guest demo)',
        maxTokens: guestOutputTokens!,
      }],
      fallbackMaxTokens: guestOutputTokens!,
      raceGateway: false,
    }
    : requestedProviderPlan;
  const hasTools = !guestOnly && Array.isArray(tools) && tools.length > 0;
  const effectiveToolChoice = hasTools ? (toolChoice ?? "auto") : undefined;
  let content = '';
  let lastError = '';
  let reasoning = '';
  let modelUsed: string | undefined;
  let providerUsed: string | undefined;
  let toolCalls: RawToolCall[] | undefined;
  // Tool-only completions are valid responses and must stop failover as well.
  const hasResponse = () => Boolean(content.trim() || toolCalls?.length);

  // Hard server deadline. Keep enough headroom for validation, one targeted
  // repair, persistence and the response trip before the browser deadline.
  // Provider failover is owned here; providerClient must not nest another
  // fallback chain inside these attempts.
  const startedAt = Date.now();
  const totalBudgetMs = Math.min(PROVIDER_LOOP_TOTAL_BUDGET_MS, Math.max(1, opts.totalBudgetMs ?? PROVIDER_LOOP_TOTAL_BUDGET_MS));
  const budgetRemaining = () => totalBudgetMs - (Date.now() - startedAt);
  const activeAttempts = new Set<() => void>();
  const geminiExclusive = isGeminiExclusiveProviderMode();
  const geminiOnlyTurn = geminiExclusive || Boolean(providerPlan.geminiOnly);
  const hasDirectOpenAI = !guestOnly && allowDirectFallbacks && !geminiOnlyTurn && !directOnCooldown('openai') && Boolean(Deno.env.get('OPENAI_API_KEY'));
  const hasDirectGemini = allowDirectFallbacks && !directOnCooldown('gemini') && Boolean(Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('UNISONGEMINI_API_KEY'));
  const hasDirectAnthropic = !guestOnly && !geminiOnlyTurn && allowDirectFallbacks && Boolean(Deno.env.get('ANTHROPIC_API_KEY'));
  // Guest actions use only models with a configured, enforceable price schedule.
  const hasLastResortGateway = !guestOnly && allowDirectFallbacks && Boolean(Deno.env.get('LOVABLE_API_KEY'));
  // The managed gateway is the final safety net; a 20 s slice is not enough for
  // a real generation, so reserve a usable window for it.
  const lastResortReserveMs = hasLastResortGateway ? 30_000 : 0;
  const providerErrors: string[] = [];
  let deferredEarlyError: ProviderEarlyError | undefined;
  // A 429 whose body says billing/quota is exhausted is not a transient rate
  // limit: every further call to that provider will fail the same way. Mark the
  // whole family dead so the remaining budget goes to providers that can answer.
  let geminiQuotaExhausted = directOnCooldown('gemini');
  // Same for OpenAI: a 402 / billing-exhausted response means every further
  // OpenAI model will fail identically, so skip them and give the remaining
  // budget to Gemini and the managed gateway.
  let openaiQuotaExhausted = directOnCooldown('openai');
  const isQuotaExhausted = (detail: string) =>
    /insufficient[_\s-]?quota|insufficient (?:credits?|funds?)|credits? (?:are )?(?:depleted|exhausted)|prepayment|billing.{0,40}(?:required|disabled|inactive|exhausted|insufficient)|payment required|exceeded your current quota/i.test(detail);
  const isGeminiModelId = (id: string) => id.startsWith('google/') || id.startsWith('gemini-');
  // Tracks whether any provider failed for a non-rate-limit reason (timeout,
  // 500, empty response, etc.). When true, a deferred 429 from one provider
  // must NOT mask the real failure — the client would show "rate limited" even
  // though the actual cause was a timeout on a different provider.
  let hadNonRateLimitError = false;
  // True once any direct provider reports a billing/quota-exhausted 429. Those
  // keys cannot recover within this request, so the managed gateway becomes the
  // only path that can answer and must get the whole remaining budget.
  let directQuotaExhausted = false;
  const recordProviderError = (label: string, detail: string) => {
    const message = `${label}: ${detail}`;
    providerErrors.push(message);
    lastError = message;
    // Failures were previously invisible in function logs; record each one so
    // a refused launch can be traced to the provider and reason.
    console.warn(`[AI-Hybrid] Provider failed — ${message.substring(0, 300)}`);
    if (!/429|rate limit|402|payment required/i.test(detail)) {
      hadNonRateLimitError = true;
    }
    if (
      !/gateway/i.test(label) &&
      (isQuotaExhausted(detail) || /402|payment required/i.test(detail))
    ) {
      directQuotaExhausted = true;
    }
  };


  try {
  const createAttemptSignal = (timeoutMs: number) => {
    const controller = new AbortController();
    const onOuterAbort = () => controller.abort(signal?.reason);
    if (signal) {
      if (signal.aborted) controller.abort(signal.reason);
      else signal.addEventListener('abort', onOuterAbort, { once: true });
    }
    const timeoutId = setTimeout(() => controller.abort(new DOMException('Provider attempt timed out', 'TimeoutError')), Math.max(1, Math.min(timeoutMs, budgetRemaining())));
    const cleanup = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onOuterAbort);
      activeAttempts.delete(cleanup);
    };
    activeAttempts.add(cleanup);
    return {
      signal: controller.signal,
      abort: () => {
        cleanup();
        if (!controller.signal.aborted) controller.abort(new DOMException('Race lost', 'AbortError'));
      },
      cleanup,
    };
  };
  const throwIfCancelled = () => {
    if (signal?.aborted) {
      throw signal.reason instanceof Error ? signal.reason : new DOMException('Request aborted', 'AbortError');
    }
  };

  const runDirectOpenAI = async (): Promise<void> => {
    if (!allowDirectFallbacks) return;
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY || content) return;

    // OpenAI is a direct provider in the local and deployed runtime.
    // Use the plan's per-model timeout so wizard/builder tasks get their full budget
    // (e.g. 110 s for wizard_seed_generation) instead of a hardcoded 25 s cap.
    const role = 'direct';
    console.log(`[AI-Hybrid] Direct OpenAI configured as ${role} provider`);
    
    const configuredOpenAIModel = Deno.env.get('OPENAI_MODEL')
      ? normalizeOpenAIModel(Deno.env.get('OPENAI_MODEL')!) : undefined;
    const fallbackTokens = providerPlan.fallbackMaxTokens;
    // Model-specific output token limits (max_completion_tokens caps).
    // gpt-4.1 supports 32 768 — enough for a full wizard seed (9+ pages).
    // Keep this native fallback list short: planned routing owns normal model
    // selection, while this branch only covers a provider family omitted from
    // the plan.
    const openaiModels = [
      ...(configuredOpenAIModel
        ? [{ id: configuredOpenAIModel, maxTokens: Math.min(fallbackTokens, 32768), label: `OpenAI ${configuredOpenAIModel}` }]
        : []),
      // gpt-4.1: faster throughput + 32 k output — primary direct-API choice.
      { id: 'gpt-4.1', maxTokens: Math.min(fallbackTokens, 32768), label: 'OpenAI gpt-4.1' },
    ].filter((model, index, models) => models.findIndex(m => m.id === model.id) === index);
    
    for (const model of openaiModels) {
      throwIfCancelled();
      const remaining = budgetRemaining();
      if (remaining < 8000) {
        console.warn(`[AI-Hybrid] Budget exhausted (${remaining}ms left), skipping remaining OpenAI models`);
        lastError = lastError || 'budget exhausted before all models tried';
        break;
      }
      // Use the plan's per-model timeout — not a hardcoded cap — so large tasks
      // (wizard seed = 110 s) are not artificially cut short.
      const perModelMs = Math.min(providerPlan.perModelTimeoutMs, Math.max(8000, remaining - 2000));
      try {
        console.log(`[AI-Hybrid] Trying ${role} ${model.label} (timeout: ${perModelMs / 1000}s, budget left: ${remaining / 1000}s)...`);
        const attempt = createAttemptSignal(perModelMs);
        
        const requestBody: Record<string, unknown> = {
          model: model.id,
          messages: aiMessages,
          max_completion_tokens: model.maxTokens,
        };
        if (hasTools) {
          requestBody.tools = tools;
          requestBody.tool_choice = effectiveToolChoice;
        }
        
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: attempt.signal,
        });

        if (resp.status === 429 || resp.status === 402) {
          const errText = await resp.text().catch(() => '');
          const earlyError: ProviderEarlyError = resp.status === 429
            ? { status: 429, error: 'Rate limit exceeded. Please try again later.' }
            : { status: 402, error: 'Payment required. Please add credits to your OpenAI account.' };
          recordProviderError(model.label, `${resp.status}${errText ? ` ${errText.substring(0, 200)}` : ''}`);
          deferredEarlyError ??= earlyError;
          console.warn(`[AI-Hybrid] ${model.label} returned ${resp.status}; continuing fallback chain...`);
          // A 429 is per-model/tier, not terminal for the whole chain: keep
          // walking the remaining models (including other provider families)
          // instead of aborting generation on the first rate limit.
          if (resp.status === 429 && !isQuotaExhausted(errText)) continue;
          openaiQuotaExhausted = true;
          markDirectQuotaExhausted('openai');
          break;
        }

        if (!resp.ok) {
          const errText = await resp.text();
          console.warn(`[AI-Hybrid] ${model.label} error ${resp.status}: ${errText.substring(0, 300)}`);
          if (resp.status === 400) {
            console.error(`[AI-Hybrid] 400 Bad Request for ${model.id}. Request body keys: ${Object.keys(requestBody).join(', ')}`);
          }
          recordProviderError(model.label, `${resp.status} ${errText.substring(0, 200)}`);
          continue;
        }

        const responseText = await resp.text();
        if (!responseText || responseText.trim() === '') {
          console.warn(`[AI-Hybrid] ${model.label} returned empty response, trying next...`);
          recordProviderError(model.label, 'empty response');
          continue;
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          console.warn(`[AI-Hybrid] ${model.label} returned invalid JSON, trying next...`);
          recordProviderError(model.label, 'invalid JSON');
          continue;
        }

        const message = data.choices?.[0]?.message ?? {};
        const parsedContent = message.content || '';
        const parsedToolCalls = Array.isArray(message.tool_calls) ? (message.tool_calls as RawToolCall[]) : undefined;
        if (!parsedContent && (!parsedToolCalls || parsedToolCalls.length === 0)) {
          console.warn(`[AI-Hybrid] ${model.label} returned no content, trying next...`);
          recordProviderError(model.label, 'no content');
          continue;
        }

        const extracted = extractThinkingTags(parsedContent);
        if (extracted.reasoning) {
          reasoning = extracted.reasoning;
          console.log(`[AI-Hybrid] Thinking tags extracted from ${model.label}: ${extracted.reasoning.length} chars`);
        }
        content = extracted.content;
        modelUsed = model.id;
        providerUsed = 'openai';
        if (parsedToolCalls && parsedToolCalls.length > 0) toolCalls = parsedToolCalls;
        console.log(`[AI-Hybrid] Success with fallback ${model.label}`);
        break;
      } catch (err) {
        throwIfCancelled();
        if (err instanceof Error && err.name === 'AbortError') {
          console.warn(`[AI-Hybrid] ${model.label} timed out, trying next...`);
          recordProviderError(model.label, 'timeout');
          continue;
        }
        console.warn(`[AI-Hybrid] ${model.label} failed:`, err);
        recordProviderError(model.label, err instanceof Error ? err.message : 'unknown');
        continue;
      }
    }
  };

  // ── Direct Gemini API helper ──────────────────────────────────────────
  // Gemini 3.8 Flash supports 65 536 output tokens for large wizard seeds.
  const runDirectGemini = async (): Promise<void> => {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('UNISONGEMINI_API_KEY');
    if (!GEMINI_API_KEY || content || geminiQuotaExhausted) return;

    const role = 'direct';
    console.log(`[AI-Hybrid] Direct Gemini API configured as ${role} provider`);

    const geminiModels = [
      // 65 536 output tokens — ideal for multi-page wizard generation
      // Strongest composition model first (overridable via GEMINI_COMPOSER_MODEL).
      { id: configuredComposerGeminiModel(), maxTokens: Math.min(providerPlan.fallbackMaxTokens, 65_536), label: 'Gemini 3.8 Flash' },
    ];

    for (const model of geminiModels) {
      throwIfCancelled();
      const remaining = budgetRemaining();
      if (remaining < 8000) {
        console.warn(`[AI-Hybrid] Budget exhausted (${remaining}ms left), skipping remaining Gemini models`);
        lastError = lastError || 'budget exhausted before all models tried';
        break;
      }
      const perModelMs = Math.min(providerPlan.perModelTimeoutMs, Math.max(8000, remaining - 2000));
      try {
        console.log(`[AI-Hybrid] Trying ${role} ${model.label} (timeout: ${perModelMs / 1000}s, budget left: ${remaining / 1000}s)...`);
        const attempt = createAttemptSignal(perModelMs);

        const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GEMINI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model.id,
            messages: aiMessages,
            max_tokens: model.maxTokens,
            ...(hasTools ? { tools, tool_choice: effectiveToolChoice } : {}),
          }),
          signal: attempt.signal,
        });

        if (resp.status === 429 || resp.status === 402) {
          const errText = await resp.text().catch(() => '');
          const exhausted = isQuotaExhausted(errText) || resp.status === 402;
          recordProviderError(model.label, `${resp.status}${errText ? ` ${errText.substring(0, 200)}` : ''}`);
          if (exhausted) {
            geminiQuotaExhausted = true;
            markDirectQuotaExhausted('gemini');
            deferredEarlyError ??= { status: 402, error: 'Payment required. Please add credits to your Google AI account.' };
            console.warn(`[AI-Hybrid] ${model.label} quota/billing exhausted; abandoning Gemini for this turn.`);
            break;
          }
          deferredEarlyError ??= { status: 429, error: 'Rate limit exceeded. Please try again later.' };
          console.warn(`[AI-Hybrid] ${model.label} returned ${resp.status}; trying next...`);
          continue;
        }


        if (!resp.ok) {
          const errText = await resp.text();
          console.warn(`[AI-Hybrid] ${model.label} error ${resp.status}: ${errText.substring(0, 300)}`);
          recordProviderError(model.label, `${resp.status} ${errText.substring(0, 200)}`);
          continue;
        }

        const responseText = await resp.text();
        if (!responseText || responseText.trim() === '') {
          recordProviderError(model.label, 'empty response');
          continue;
        }

        let data;
        try { data = JSON.parse(responseText); } catch {
          recordProviderError(model.label, 'invalid JSON');
          continue;
        }

        const message = data.choices?.[0]?.message ?? {};
        const parsedContent = message.content || '';
        const parsedToolCalls = Array.isArray(message.tool_calls) ? (message.tool_calls as RawToolCall[]) : undefined;
        if (!parsedContent && (!parsedToolCalls || parsedToolCalls.length === 0)) {
          recordProviderError(model.label, 'no content');
          continue;
        }

        const extracted = extractThinkingTags(parsedContent);
        if (extracted.reasoning) {
          reasoning = extracted.reasoning;
          console.log(`[AI-Hybrid] Thinking tags extracted from ${model.label}: ${extracted.reasoning.length} chars`);
        }
        content = extracted.content;
        modelUsed = model.id;
        providerUsed = 'gemini';
        if (parsedToolCalls && parsedToolCalls.length > 0) toolCalls = parsedToolCalls;
        console.log(`[AI-Hybrid] Success with ${role} ${model.label}`);
        break;
      } catch (err) {
        throwIfCancelled();
        if (err instanceof Error && err.name === 'AbortError') {
          console.warn(`[AI-Hybrid] ${model.label} timed out, trying next...`);
          recordProviderError(model.label, 'timeout');
          continue;
        }
        console.warn(`[AI-Hybrid] ${model.label} failed:`, err);
        recordProviderError(model.label, err instanceof Error ? err.message : 'unknown');
        continue;
      }
    }
  };

  // Managed gateway (Lovable AI) hybrid fallback.
  // Lovable only leads when no direct provider is configured; otherwise it is
  // reserved for the final fallback after direct provider attempts.
  let gatewayTriedFirst = false;
  // Preserve the gateway's safe status/message if it refuses a fallback.
  let gatewayFailure: ProviderEarlyError | undefined;
  const runManagedGatewayAttempt = async (label: string, windowMs: number) => {
    const gatewayModel: ModelSpec = {
      id: DEFAULT_GEMINI_GATEWAY_MODEL,
      maxTokens: Math.min(providerPlan.fallbackMaxTokens, 32_000),
      label,
    };
    const deadline = Date.now() + Math.max(8_000, windowMs);
    // Only 429 and 5xx are transient; retry them with bounded backoff
    // (honouring Retry-After) while the window still fits a real generation.
    const MAX_GATEWAY_ATTEMPTS = 3;
    for (let attemptNo = 1; attemptNo <= MAX_GATEWAY_ATTEMPTS; attemptNo++) {
      throwIfCancelled();
      const windowLeft = deadline - Date.now();
      if (windowLeft < 8_000) break;
      try {
        console.log(`[AI-Hybrid] ${label} attempt ${attemptNo} (window: ${Math.round(windowLeft / 1000)}s)...`);
        const attempt = createAttemptSignal(windowLeft);
        const resp = await createLastResortGatewayChatCompletion(
          buildPlannedChatCompletionRequest({
            model: gatewayModel,
            aiMessages,
            reasoningEffort,
            tools: hasTools ? tools : undefined,
            toolChoice: effectiveToolChoice,
          }),
          attempt.signal,
        );
        if (resp.ok) {
          const data = await resp.json();
          const message = data.choices?.[0]?.message ?? {};
          const parsedContent = message.content || '';
          const parsedToolCalls = Array.isArray(message.tool_calls) ? (message.tool_calls as RawToolCall[]) : undefined;
          if (parsedContent || (parsedToolCalls && parsedToolCalls.length > 0)) {
            const extracted = extractThinkingTags(parsedContent);
            content = extracted.content;
            reasoning = extracted.reasoning || reasoning;
            modelUsed = gatewayModel.id;
            providerUsed = 'lovable';
            gatewayFailure = undefined;
            if (parsedToolCalls?.length) toolCalls = parsedToolCalls;
            console.log(`[AI-Hybrid] Success with ${label}`);
          } else {
            recordProviderError(label, 'empty response');
          }
          return;
        }
        const errText = await resp.text().catch(() => '');
        recordProviderError(label, `${resp.status} ${errText.substring(0, 200)}`);
        const transient = resp.status === 429 || resp.status >= 500;
        if (resp.status === 402 || resp.status === 403 || resp.status === 429) {
          gatewayFailure = { status: resp.status, error: gatewayErrorMessage(errText) };
        }
        if (resp.status === 402) {
          deferredEarlyError = { status: 402, error: gatewayErrorMessage(errText) };
        }
        if (!transient || attemptNo === MAX_GATEWAY_ATTEMPTS) return;
        const retryAfterSec = Number(resp.headers.get('retry-after'));
        const backoffMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? retryAfterSec * 1000
          : 1_500 * 2 ** (attemptNo - 1) + Math.floor(Math.random() * 750);
        const waitMs = Math.min(backoffMs, 15_000);
        if (deadline - Date.now() - waitMs < 20_000) return; // no room left for a real generation
        console.warn(`[AI-Hybrid] ${label} returned ${resp.status}; retrying in ${Math.round(waitMs / 1000)}s`);
        await new Promise<void>((resolve, reject) => {
          const onAbort = () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            reject(signal?.reason ?? new DOMException('Request aborted', 'AbortError'));
          };
          const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
          }, waitMs);
          if (signal?.aborted) onAbort();
          else signal?.addEventListener('abort', onAbort, { once: true });
        });
      } catch (err) {
        throwIfCancelled();
        recordProviderError(label, err instanceof Error ? err.message : 'unknown');
        return;
      }
    }
  };

  // A direct Gemini that just timed out would burn the whole window again and
  // leave the gateway only the tail; keep it behind all available direct keys.
  if (hasLastResortGateway && !hasDirectGemini && !hasDirectOpenAI && !hasDirectAnthropic) {
    gatewayTriedFirst = true;
    await runManagedGatewayAttempt(
      'Lovable AI fallback (no direct provider configured)',
      Math.min(providerPlan.perModelTimeoutMs, budgetRemaining() - 5_000));
  }

  // ── Phase 0: Hybrid race (lead OpenAI model vs managed gateway) ────────
  // Composer tasks start both at once; the first usable answer wins and the
  // other request is aborted. A quick failure on one side leaves the other
  // running, so a dead key never costs a sequential fallback round.
  if (!hasResponse() && !hasDirectGemini && !hasDirectOpenAI && !hasDirectAnthropic && !gatewayTriedFirst && providerPlan.raceGateway && allowDirectFallbacks && hasLastResortGateway && providerPlan.gatewayModels.length > 0) {
    const lead = providerPlan.gatewayModels[0];
    const gatewayModel: ModelSpec = {
      id: DEFAULT_GEMINI_GATEWAY_MODEL,
      maxTokens: Math.min(providerPlan.fallbackMaxTokens, 32_000),
      label: 'Managed gateway (race)',
    };
    const raceMs = Math.min(providerPlan.perModelTimeoutMs, Math.max(8_000, budgetRemaining() - 5_000));
    const attempts = [
      { model: lead, provider: providerForRace(lead.id), call: createPlannedChatCompletion, sig: createAttemptSignal(raceMs) },
      { model: gatewayModel, provider: 'lovable', call: createLastResortGatewayChatCompletion, sig: createAttemptSignal(raceMs) },
    ];
    console.log(`[AI-Hybrid] Racing ${lead.label} against managed gateway (timeout: ${raceMs / 1000}s)...`);
    const runOne = async (a: typeof attempts[number]) => {
      try {
        const resp = await a.call(buildPlannedChatCompletionRequest({
          model: a.model, aiMessages, reasoningEffort,
          tools: hasTools ? tools : undefined, toolChoice: effectiveToolChoice,
        }), a.sig.signal);
        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          recordProviderError(a.model.label, `${resp.status} ${errText.substring(0, 200)}`);
          if (a.provider === 'lovable' && resp.status === 402) {
            deferredEarlyError ??= { status: 402, error: gatewayErrorMessage(errText) };
          }
          if (a.provider === 'openai' && (resp.status === 402 || isQuotaExhausted(errText))) {
            openaiQuotaExhausted = true;
            markDirectQuotaExhausted('openai');
          }
          throw new Error('failed');
        }
        const data = await resp.json();
        const message = data.choices?.[0]?.message ?? {};
        const text = message.content || '';
        const calls = Array.isArray(message.tool_calls) ? (message.tool_calls as RawToolCall[]) : undefined;
        if (!text && !calls?.length) {
          recordProviderError(a.model.label, 'empty response');
          throw new Error('empty');
        }
        return { a, text: text as string, calls };
      } finally {
        a.sig.cleanup();
      }
    };
    try {
      const winner = await Promise.any(attempts.map(runOne));
      for (const other of attempts) if (other !== winner.a) other.sig.cleanup();
      const extracted = extractThinkingTags(winner.text);
      content = extracted.content;
      reasoning = extracted.reasoning || reasoning;
      if (winner.calls?.length) toolCalls = winner.calls;
      modelUsed = winner.a.model.id;
      providerUsed = winner.a.provider;
      console.log(`[AI-Hybrid] Race won by ${winner.a.model.label}`);
    } catch {
      throwIfCancelled();
      console.warn('[AI-Hybrid] Both race legs failed; continuing with sequential fallbacks.');
    } finally {
      // Abort the losing leg so it stops generating (and billing).
      for (const a of attempts) a.sig.abort();
    }
  }

  // ── Phase 1: Planned direct-provider attempts ──────────────────────────
  if (!hasResponse() && allowDirectFallbacks) {
    // Log total prompt size for debugging
    const totalChars = aiMessages.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length), 0);
    console.log(`[AI-Hybrid] Total prompt size: ${totalChars} chars across ${aiMessages.length} messages`);
    
    for (const [modelIndex, model] of providerPlan.gatewayModels.entries()) {
      throwIfCancelled();
      if (geminiQuotaExhausted && isGeminiModelId(model.id)) {
        console.warn(`[AI-Hybrid] Skipping ${model.label} — Gemini quota exhausted this turn.`);
        continue;
      }
      if (openaiQuotaExhausted && !isGeminiModelId(model.id)) {
        console.warn(`[AI-Hybrid] Skipping ${model.label} — OpenAI billing exhausted this turn.`);
        continue;
      }
      const remaining = budgetRemaining();
      // The user's selected primary provider owns generation; unavailable
      // direct keys are skipped rather than charged a timeout window.
      if (isGeminiModelId(model.id) ? !hasDirectGemini : !hasDirectOpenAI) continue;

      if (remaining < 8000) {
        console.warn(`[AI-Hybrid] Budget exhausted (${remaining}ms left), skipping remaining gateway models`);
        lastError = lastError || 'budget exhausted before all models tried';
        break;
      }
      // Most turns reserve room for failover. Wizard generation is different:
      // a valid 20k+ token Gemini response routinely needs 80–90 seconds. Give
      // that funded lead path nearly the full turn; auth/rate-limit failures
      // return quickly and can still fall through to the remaining providers.
      const isLeadModel = model.id === providerPlan.gatewayModels[0]?.id;
      const cap = providerPlan.perModelTimeoutMs;
      const reserveMs = Math.min(lastResortReserveMs, Math.max(0, remaining * 0.25));
      const headroom = Math.max(8000, remaining - 2000 - reserveMs);
      const leadShare = Math.max(30000, Math.floor(headroom * 0.6));
      const remainingModels = providerPlan.gatewayModels.length - modelIndex;
      const balancedAttemptMs = Math.max(12000, Math.floor(cap / remainingModels));
      // With no backup left (no managed gateway, no later model), cutting the
      // only attempt short just converts a slow answer into a timeout.
      const isOnlyRemainingPath = !hasLastResortGateway && remainingModels === 1;
      let perModelMs = providerPlan.balancedProviderAttempts && !isOnlyRemainingPath
        ? Math.min(cap, headroom, balancedAttemptMs)
        : isLeadModel
          ? Math.min(cap, headroom, providerPlan.preferLongLeadAttempt || isOnlyRemainingPath ? headroom : leadShare)
          : Math.min(cap, Math.max(12000, headroom));

      // Earlier billing failures must not let a later reasoning model consume
      // the fallback's window. Apply this by remaining model, not list index.
      const hasFastFallback = providerPlan.gatewayModels.slice(modelIndex + 1)
        .some((candidate) => /(?:^|\/)gpt-4\.1(?:-|$)/.test(candidate.id));
      if (providerPlan.fallbackReserveMs && hasFastFallback && !openaiQuotaExhausted) {
        perModelMs = reserveFallbackWindow(perModelMs, remaining,
          Math.min(providerPlan.fallbackReserveMs, Math.max(0, remaining * 0.25)));
      }

      const attempt = createAttemptSignal(perModelMs);
      let guestUsageReservation: { callId: string; inputTokenLimit: number; outputTokenLimit: number } | undefined;
      try {
        console.log(`[AI-Hybrid] Trying planned direct model ${model.label} (timeout: ${perModelMs / 1000}s, budget left: ${remaining / 1000}s)...`);

        const reqBody = buildPlannedChatCompletionRequest({
          model,
          aiMessages,
          reasoningEffort,
          tools: hasTools ? tools : undefined,
          toolChoice: effectiveToolChoice,
        });

        if (guestUsageMeter) {
          const inputTokenLimit = await countGuestPromptTokens(aiMessages, model.id, attempt.signal);
          const outputTokenLimit = reqBody.max_completion_tokens ?? reqBody.max_tokens ?? model.maxTokens;
          const callId = await guestUsageMeter.reserveProviderCall({
            modelId: model.id,
            inputTokenLimit,
            outputTokenLimit,
          });
          guestUsageReservation = { callId, inputTokenLimit, outputTokenLimit };
        }

        const resp = await createPlannedChatCompletion(reqBody, attempt.signal, !guestOnly);

        if (resp.status === 429 || resp.status === 402) {
          const errText = await resp.text().catch(() => '');
          const detail = `${resp.status}${errText ? ` ${errText.substring(0, 200)}` : ''}`;
          const exhausted = isQuotaExhausted(errText) || resp.status === 402;
          const earlyError: ProviderEarlyError = resp.status === 429 && !exhausted
            ? { status: 429, error: 'Rate limit exceeded. Please try again later.' }
            : isGeminiModelId(model.id)
              ? { status: 402, error: 'Payment required. Please add credits to your Google AI account.' }
              : { status: 402, error: 'Payment required. Please add credits to your OpenAI account.' };
          recordProviderError(model.label, detail);
          if (exhausted && isGeminiModelId(model.id)) {
            geminiQuotaExhausted = true;
            markDirectQuotaExhausted('gemini');
            console.warn(`[AI-Hybrid] ${model.label} quota/billing exhausted; skipping all Gemini attempts this turn.`);
          } else {
            if (exhausted) {
              openaiQuotaExhausted = true;
              markDirectQuotaExhausted('openai');
            }
            deferredEarlyError ??= earlyError;
          }
          console.warn(`[AI-Hybrid] ${model.label} returned ${resp.status}; trying next provider...`);
          continue;
        }


        if (!resp.ok) {
          const errText = await resp.text();
          console.warn(`[AI-Hybrid] ${model.label} error ${resp.status}: ${errText.substring(0, 300)}`);
          if (resp.status === 401 || resp.status === 403) {
            deferredEarlyError ??= {
              status: 503,
              error: 'AI provider authentication failed. Check the configured direct provider secrets.',
            };
          }
          // For 400 errors, log full detail to help diagnose parameter issues
          if (resp.status === 400) {
            console.error(`[AI-Hybrid] 400 Bad Request for ${model.id}. Request body keys: ${Object.keys(reqBody).join(', ')}`);
          }
          recordProviderError(model.label, `${resp.status} ${errText.substring(0, 200)}`);
          continue;
        }

        const responseText = await resp.text();
        if (!responseText || responseText.trim() === '') {
          console.warn(`[AI-Hybrid] ${model.label} returned empty response, trying next...`);
          recordProviderError(model.label, 'empty response');
          continue;
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          console.warn(`[AI-Hybrid] ${model.label} returned invalid JSON, trying next...`);
          recordProviderError(model.label, 'invalid JSON');
          continue;
        }

        if (guestUsageMeter && guestUsageReservation) {
          const usage = data.usage ?? {};
          const inputTokens = usage.prompt_tokens ?? usage.input_tokens;
          const outputTokens = usage.completion_tokens ?? usage.output_tokens;
          await guestUsageMeter.settleProviderCall({
            callId: guestUsageReservation.callId,
            inputTokens: Number.isSafeInteger(inputTokens) && inputTokens >= 0
              ? inputTokens
              : guestUsageReservation.inputTokenLimit,
            outputTokens: Number.isSafeInteger(outputTokens) && outputTokens >= 0
              ? outputTokens
              : guestUsageReservation.outputTokenLimit,
          });
        }

        const message = data.choices?.[0]?.message ?? {};
        const parsedContent = message.content || '';
        const parsedToolCalls = Array.isArray(message.tool_calls) ? (message.tool_calls as RawToolCall[]) : undefined;
        if (!parsedContent && (!parsedToolCalls || parsedToolCalls.length === 0)) {
          console.warn(`[AI-Hybrid] ${model.label} returned no content, trying next...`);
          recordProviderError(model.label, 'no content');
          continue;
        }

        const extracted = extractThinkingTags(parsedContent);
        if (extracted.reasoning) {
          reasoning = extracted.reasoning;
          console.log(`[AI-Hybrid] Thinking tags extracted from ${model.label}: ${extracted.reasoning.length} chars`);
        }
        content = extracted.content;
        modelUsed = model.id;
        providerUsed = resp.headers.get('X-Unison-AI-Provider') ?? providerUsed;
        if (parsedToolCalls && parsedToolCalls.length > 0) toolCalls = parsedToolCalls;
        console.log(`[AI-Hybrid] Success with planned direct model ${model.label}`);
        break;
      } catch (err) {
        throwIfCancelled();
        if (guestUsageMeter && err instanceof Error && err.message.startsWith('Guest demo')) throw err;
        if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
          console.warn(`[AI-Hybrid] ${model.label} timed out, trying next...`);
          recordProviderError(model.label, 'timeout');
          continue;
        }
        console.warn(`[AI-Hybrid] ${model.label} failed:`, err);
        recordProviderError(model.label, err instanceof Error ? err.message : 'unknown');
        continue;
      } finally {
        attempt.cleanup();
      }
    }
  }

  // ── Phase 2–3: Provider-native fallback models ───────────────────────
  // Planned models already exercise both direct provider families. Repeating
  // both complete provider-native lists after that used the entire wall-clock
  // budget during 429/timeout storms and starved the true last-resort path.
  // Only use the native list for a configured family that had no planned model.
  const plannedProviders = new Set(providerPlan.gatewayModels.map((model) => (
    model.id.startsWith('openai/') || model.id.startsWith('gpt-') ? 'openai' :
    model.id.startsWith('google/') || model.id.startsWith('gemini-') ? 'gemini' :
    'other'
  )));
  if (!hasResponse() && allowDirectFallbacks && !geminiOnlyTurn) {
    if (hasDirectOpenAI && !plannedProviders.has('openai')) await runDirectOpenAI();
    if (!hasResponse() && hasDirectGemini && !plannedProviders.has('gemini')) await runDirectGemini();
  }

  // ── Phase 4: Direct Anthropic API ─────────────────────────────────────
  if (!guestOnly && !geminiOnlyTurn && !hasResponse() && allowDirectFallbacks) {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (ANTHROPIC_API_KEY) {
      const remaining = budgetRemaining();
      const anthropicBudget = remaining - (hasLastResortGateway ? 10_000 : 2_000);
      if (anthropicBudget >= 8000) {
        const perModelMs = Math.min(28000, anthropicBudget);
        try {
          const systemMsg = (aiMessages.find((m) => m.role === 'system')?.content as string) || '';
          const userMsgs = toAnthropicMessages(aiMessages as ChatMessage[]);
          console.log(`[AI-Hybrid] Trying direct Anthropic claude-sonnet-4-5 (timeout: ${perModelMs / 1000}s)...`);

          const attempt = createAttemptSignal(perModelMs);
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-5',
              max_tokens: providerPlan.fallbackMaxTokens,
              system: systemMsg,
              messages: userMsgs,
            }),
            signal: attempt.signal,
          });

          if (!resp.ok) {
            const errText = await resp.text();
            recordProviderError('Anthropic claude-sonnet-4-5', `${resp.status} ${errText.substring(0, 200)}`);
          } else {
            const data = await resp.json();
            const blocks = Array.isArray(data.content) ? data.content : [];
            const textBlock = blocks.find((b: { type?: string; text?: string }) => b.type === 'text');
            const parsedContent = textBlock?.text || '';
            if (parsedContent) {
              const extracted = extractThinkingTags(parsedContent);
              if (extracted.reasoning) reasoning = extracted.reasoning;
              content = extracted.content;
              modelUsed = 'claude-sonnet-4-5';
              providerUsed = 'anthropic';
              console.log('[AI-Hybrid] Success with direct Anthropic claude-sonnet-4-5');
            } else {
              recordProviderError('Anthropic claude-sonnet-4-5', 'no content');
            }
          }
        } catch (err) {
          throwIfCancelled();
          recordProviderError('Anthropic claude-sonnet-4-5', err instanceof Error ? err.message : 'unknown');
        }
      }
    }
  }

  // ── Phase 5: Managed gateway retry, only if it was not already tried first ──
  if (!guestOnly && !hasResponse() && hasLastResortGateway && !gatewayTriedFirst) {
    const remaining = budgetRemaining();
    if (remaining >= 8_000) await runManagedGatewayAttempt('Managed gateway fallback', remaining - 2_000);
  }

  if (!hasResponse()) {

    // Only surface a deferred 429/402 as the early error when every provider
    // failed for rate-limit / billing reasons. If any provider failed for a
    // different reason (timeout, 500, empty response), the 429 from one
    // provider is misleading — fall through to the detailed "all providers
    // failed" error so the client shows the real failure.
    // Keep concrete credit refusals only if all attempts failed for that
    // reason; otherwise retain the primary provider's timeout diagnostics.
    if (gatewayFailure && !hadNonRateLimitError) {
      return { content: '', reasoning: '', modelUsed: undefined, earlyError: gatewayFailure };
    }
    if (deferredEarlyError && !hadNonRateLimitError && !hasLastResortGateway) {
      return { content: '', reasoning: '', modelUsed: undefined, earlyError: deferredEarlyError };
    }
    const configuredProviders = [
      hasDirectGemini ? 'gemini' : '',
      hasDirectOpenAI ? 'openai' : '',
    ].filter(Boolean);
    // A key skipped for a remembered depleted balance must name that cause, or
    // later pages report "no providers configured" instead of the real remedy.
    const cooldownNotes = (['gemini', 'openai'] as const)
      .filter(provider => directOnCooldown(provider))
      .map(provider => `${provider}: 402 key is out of prepaid credit (skipped until credits are added)`);
    const errorTrail = [...providerErrors.slice(-10), ...cooldownNotes].join(' | ') || lastError || 'no provider attempts completed';
    const gatewayStatus = geminiExclusive
      ? 'Gemini-only provider mode is active; OpenAI and managed fallbacks are disabled.'
      : hasLastResortGateway
        ? 'The managed AI gateway fallback was configured but did not recover the request.'
        : 'No managed AI gateway fallback is configured.';
    throw new Error(`All AI providers failed. Configured providers: ${configuredProviders.join(', ') || 'none'}. Last errors: ${errorTrail}. ${gatewayStatus}`);
  }

  return { content, reasoning, modelUsed, providerUsed, toolCalls };
  } finally {
    for (const cleanup of activeAttempts) cleanup();
  }
}
