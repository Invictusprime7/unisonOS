export type ChatMessage = {
  role: string;
  content: unknown;
  [key: string]: unknown;
};

export type ChatCompletionRequest = {
  model?: string;
  messages: ChatMessage[];
  max_tokens?: number;
  max_completion_tokens?: number;
  stream?: boolean;
  [key: string]: unknown;
};

type Provider = "lovable" | "openai" | "gemini" | "anthropic";
type EnvReader = (name: string) => string | undefined;
import { DEFAULT_GEMINI_GATEWAY_MODEL, configuredGeminiModel } from '../geminiModel.ts';

const LOVABLE_GATEWAY_CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
// Backends without their own LOVABLE_API_KEY (UNISON) reach the managed
// gateway through the Lovable Cloud `managed-ai-relay`, authenticated by a
// shared MANAGED_AI_RELAY_SECRET.
const DEFAULT_MANAGED_AI_RELAY_URL = "https://oruwtgdjurstvhgqcvbv.supabase.co/functions/v1/managed-ai-relay";

/** True when the managed gateway is reachable directly or via the relay. */
export function hasManagedGatewayAccess(): boolean {
  return Boolean(Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("MANAGED_AI_RELAY_SECRET"));
}
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";
const GEMINI_CHAT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_RATE_LIMIT_RETRY_MS = 750;
const DEFAULT_TRANSIENT_RETRY_MS = 1_000;
const MAX_RATE_LIMIT_RETRY_MS = 2_500;
/** Per-provider slice so a single hanging provider cannot eat the whole window. */
const PROVIDER_ATTEMPT_TIMEOUT_MS = 75_000;
/** Even the final provider is bounded so a hung socket cannot hang the turn. */
const FINAL_PROVIDER_ATTEMPT_TIMEOUT_MS = 120_000;

export function getShortRateLimitRetryMs(headers: Headers, now = Date.now()): number | null {
  const retryAfter = headers.get("retry-after");
  if (!retryAfter) return DEFAULT_RATE_LIMIT_RETRY_MS;

  const seconds = Number(retryAfter);
  const delay = Number.isFinite(seconds)
    ? Math.max(0, Math.round(seconds * 1000))
    : Math.max(0, Date.parse(retryAfter) - now);
  return Number.isFinite(delay) && delay <= MAX_RATE_LIMIT_RETRY_MS ? delay : null;
}

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, delayMs);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

export async function fetchWithShortRateLimitRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const response = await fetcher(input, init);
  const retryableStatus = response.status === 429 || response.status === 503;
  if (!retryableStatus) return response;

  const retryMs = response.status === 503 && !response.headers.has("retry-after")
    ? DEFAULT_TRANSIENT_RETRY_MS
    : getShortRateLimitRetryMs(response.headers);
  if (retryMs === null || signal?.aborted) return response;

  console.warn(`[providerClient] Provider returned ${response.status}; retrying once after ${retryMs}ms`);
  await waitForRetry(retryMs, signal);
  return fetcher(input, init);
}

function readGeminiApiKey(readEnv: EnvReader = (name) => Deno.env.get(name)): string | undefined {
  return ["GEMINI_API_KEY", "GOOGLE_API_KEY", "UNISONGEMINI_API_KEY"]
    .map((name) => readEnv(name)?.trim()).find((key) => Boolean(key));
}

function requestedProvider(model?: string): Provider | undefined {
  if (!model) return undefined;
  if (model.startsWith("google/") || model.startsWith("gemini-")) return "gemini";
  if (model.startsWith("openai/") || model.startsWith("gpt-")) return "openai";
  if (model.startsWith("anthropic/") || model.startsWith("claude-")) return "anthropic";
  return undefined;
}

export function resolveConfiguredProviders(
  model?: string,
  readEnv: EnvReader = (name) => Deno.env.get(name),
): Provider[] {
  // Gemini is always primary when configured; explicit models only affect
  // fallback order when Gemini is unavailable.
  const providers: Provider[] = [];
  if (readGeminiApiKey(readEnv)) providers.push("gemini");
  if (readEnv("OPENAI_API_KEY")) providers.push("openai");
  if (readEnv("ANTHROPIC_API_KEY")) providers.push("anthropic");

  const preferred = providers.includes("gemini") ? "gemini" : requestedProvider(model);
  const ordered = preferred && providers.includes(preferred)
    ? [preferred, ...providers.filter((provider) => provider !== preferred)]
    : providers;

  // The managed Lovable AI Gateway is NEVER primary. It is only appended as a
  // last-resort fallback after every directly configured provider key.
  if (readEnv("LOVABLE_API_KEY")) ordered.push("lovable");
  return ordered;
}

export function isTextGenerationConfigured(): boolean {
  return resolveConfiguredProviders().length > 0;
}

export function isImageGenerationConfigured(): boolean {
  return Boolean(Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("OPENAI_API_KEY"));
}

const LOVABLE_IMAGE_URL = "https://ai.gateway.lovable.dev/v1/images/generations";

const IMAGE_GATEWAY_MODEL = "openai/gpt-image-2.5-sunburst";
/**
 * A rate-limited gateway is retried on that same healthy endpoint with a bounded
 * wait. Piling a second provider onto an already exhausted budget turns one
 * honest "busy" into two refusals, so the direct provider is kept only for a
 * genuinely unavailable gateway.
 */
const IMAGE_RATE_LIMIT_ATTEMPTS = 2;
const IMAGE_RATE_LIMIT_MAX_WAIT_MS = 20_000;
const IMAGE_RATE_LIMIT_FALLBACK_WAIT_MS = 2_000;

/** How long the gateway asked us to wait, or null when the wait is too long to honor. */
function gatewayRetryWaitMs(headers: Headers): number | null {
  const retryAfter = headers.get("retry-after");
  if (!retryAfter) return IMAGE_RATE_LIMIT_FALLBACK_WAIT_MS;
  const seconds = Number(retryAfter);
  const delay = Number.isFinite(seconds)
    ? Math.max(0, Math.round(seconds * 1000))
    : Math.max(0, Date.parse(retryAfter) - Date.now());
  return Number.isFinite(delay) && delay <= IMAGE_RATE_LIMIT_MAX_WAIT_MS ? delay : null;
}

export async function createImageGeneration(
  request: { prompt: string; size?: string; quality?: "low" | "medium" | "high" | "auto"; model?: string },
  signal?: AbortSignal,
): Promise<Response> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    const body = JSON.stringify({
      model: IMAGE_GATEWAY_MODEL,
      prompt: request.prompt,
      n: 1,
      size: request.size ?? "1024x1024",
      quality: request.quality ?? "medium",
    });
    const send = () => fetch(LOVABLE_IMAGE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body,
      signal,
    });
    let gw = await send();
    for (let attempt = 0; attempt < IMAGE_RATE_LIMIT_ATTEMPTS && gw.status === 429; attempt++) {
      const waitMs = gatewayRetryWaitMs(gw.headers);
      if (waitMs === null) break;
      console.warn(`[image] gateway rate limited; waiting ${waitMs}ms then retrying`);
      await waitForRetry(waitMs, signal);
      gw = await send();
    }
    // Credit, policy and access denials are terminal and a rate limit is answered
    // honestly with the real wait; only an unavailable gateway (5xx) justifies
    // falling through to the directly configured provider.
    if (gw.ok || !Deno.env.get("OPENAI_API_KEY") || (gw.status >= 400 && gw.status < 500)) {
      return withProviderHeader(gw, "lovable");
    }
    console.warn("[image] gateway transient failure", gw.status);
  }
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("No image provider is configured.");
  }

  const response = await fetch(OPENAI_IMAGE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: request.model ?? Deno.env.get("OPENAI_IMAGE_MODEL") ?? "gpt-image-1",
      prompt: request.prompt,
      n: 1,
      size: request.size ?? "1024x1024",
      quality: request.quality ?? "medium",
      output_format: "png",
    }),
    signal,
  });
  return withProviderHeader(response, "openai");
}

export function normalizeOpenAIModel(model: string): string {
  const bare = model.replace(/^openai\//, '');
  return /^gpt-5/.test(bare) ? 'gpt-4.1' : bare;
}

function modelFor(provider: Provider, requestedModel?: string): string {
  const model = requestedModel ?? "";

  if (provider === "lovable") {
    // Gateway ids are always `vendor/model`; bare ids get their vendor restored.
    if (model.includes("/")) return model;
    if (model.startsWith("gpt-")) return `openai/${model}`;
    if (model.startsWith("gemini-")) return `google/${model}`;
    if (model.startsWith("claude-")) return `anthropic/${model}`;
    return DEFAULT_GEMINI_GATEWAY_MODEL;
  }

  if (provider === "openai") {
    const bare = normalizeOpenAIModel(Deno.env.get("OPENAI_MODEL") || model);
    if (bare.startsWith("gpt-")) return bare;
    return "gpt-4o-mini";
  }

  if (provider === "gemini") {
    const bare = model.startsWith("google/") ? model.slice("google/".length) : model;
    if (bare.startsWith("gemini-")) return bare;
    return configuredGeminiModel();
  }

  if (Deno.env.get("ANTHROPIC_MODEL")) return Deno.env.get("ANTHROPIC_MODEL")!;
  if (model.startsWith("anthropic/")) return model.slice("anthropic/".length);
  if (model.startsWith("claude-")) return model;
  return "claude-sonnet-4-5";
}

function withProviderHeader(response: Response, provider: Provider): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Unison-AI-Provider", provider);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function callOpenAICompatible(
  provider: "lovable" | "openai" | "gemini",
  request: ChatCompletionRequest,
  signal?: AbortSignal,
  retryRateLimits = true,
): Promise<Response> {
  const apiKey = provider === "openai"
    ? Deno.env.get("OPENAI_API_KEY")
    : provider === "lovable"
      ? (Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("MANAGED_AI_RELAY_SECRET"))
      : readGeminiApiKey();
  const viaRelay = provider === "lovable" && !Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error(`${provider} is not configured`);

  const model = modelFor(provider, request.model);
  const body: Record<string, unknown> = { ...request, model };
  // Gemini 3 cannot disable thinking. Keep fast tasks bounded rather than
  // accidentally selecting the provider default (high thinking).
  if (provider === "gemini" && /^gemini-3/.test(model)
      && (body.reasoning_effort === undefined || body.reasoning_effort === "none")) {
    body.reasoning_effort = "low";
  }
  // Apply limits to the actual wire model, including deployment overrides.
  if (/^(?:openai\/)?gpt-4o(?:-|$)/.test(model)) {
    const tokens = body.max_completion_tokens ?? body.max_tokens;
    if (typeof tokens === "number") body.max_tokens = Math.min(tokens, 16_384);
    delete body.max_completion_tokens;
    delete body.reasoning_effort;
  }
  if (/^(?:openai\/)?gpt-4\.1(?:-|$)/.test(model)) {
    const tokens = body.max_completion_tokens ?? body.max_tokens;
    if (typeof tokens === "number") body.max_tokens = Math.min(tokens, 16_384);
    delete body.max_completion_tokens;
    delete body.reasoning_effort;
  }
  if (/(^|\/)gpt-5/.test(String(model)) && body.max_tokens !== undefined) {
    body.max_completion_tokens = body.max_completion_tokens ?? body.max_tokens;
    delete body.max_tokens;
  }
  if (/(^|\/)gpt-5/.test(model) && typeof body.max_completion_tokens === "number") {
    body.max_completion_tokens = Math.min(body.max_completion_tokens, 128_000);
  }

  const url = viaRelay
    ? (Deno.env.get("MANAGED_AI_RELAY_URL") || DEFAULT_MANAGED_AI_RELAY_URL)
    : provider === "lovable"
    ? LOVABLE_GATEWAY_CHAT_URL
    : provider === "openai"
      ? OPENAI_CHAT_URL
      : GEMINI_CHAT_URL;
  const headers: Record<string, string> = viaRelay
    ? { "x-managed-ai-relay-secret": apiKey, "Content-Type": "application/json" }
    : provider === "lovable"
    ? { "Lovable-API-Key": apiKey, "Content-Type": "application/json" }
    : { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  const requestInit: RequestInit = {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  };
  const response = retryRateLimits
    ? await fetchWithShortRateLimitRetry(url, requestInit, signal)
    : await fetch(url, requestInit);
  return withProviderHeader(response, provider);
}

/**
 * Convert OpenAI-style message content to Anthropic blocks. `image_url` parts
 * carrying a base64 data URL become Anthropic `image` blocks; anything else
 * (remote URLs, unknown parts) is dropped so the request stays valid.
 */
export function toAnthropicContent(content: unknown): unknown {
  if (!Array.isArray(content)) return content;
  const blocks: unknown[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const p = part as Record<string, unknown>;
    if (p.type === "text" && typeof p.text === "string") {
      blocks.push({ type: "text", text: p.text });
      continue;
    }
    if (p.type === "image_url") {
      const url = typeof p.image_url === "object" && p.image_url !== null
        ? String((p.image_url as Record<string, unknown>).url ?? "")
        : String(p.image_url ?? "");
      const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(url);
      if (match) {
        blocks.push({ type: "image", source: { type: "base64", media_type: match[1], data: match[2].replace(/\s/g, "") } });
      }
    }
  }
  return blocks.length > 0 ? blocks : "";
}

export function toAnthropicMessages(messages: ChatMessage[]): Array<{ role: string; content: unknown }> {
  return messages
    .filter((message) => message.role !== "system")
    .map(({ role, content }) => ({ role, content: toAnthropicContent(content) }));
}

async function callAnthropic(request: ChatCompletionRequest, signal?: AbortSignal): Promise<Response> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("anthropic is not configured");

  const system = request.messages
    .filter((message) => message.role === "system")
    .map((message) => String(message.content))
    .join("\n\n");
  const messages = toAnthropicMessages(request.messages);
  const response = await fetchWithShortRateLimitRetry(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelFor("anthropic", request.model),
      max_tokens: request.max_completion_tokens ?? request.max_tokens ?? 8192,
      ...(system ? { system } : {}),
      messages,
    }),
    signal,
  }, signal);

  if (!response.ok || request.stream) return withProviderHeader(response, "anthropic");

  const payload = await response.json();
  const content = Array.isArray(payload.content)
    ? payload.content.find((block: { type?: string }) => block.type === "text")?.text ?? ""
    : "";
  return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: payload.usage }), {
    headers: { "Content-Type": "application/json", "X-Unison-AI-Provider": "anthropic" },
  });
}

export async function createChatCompletion(request: ChatCompletionRequest, signal?: AbortSignal): Promise<Response> {
  const providers = resolveConfiguredProviders(request.model).filter((provider) => (
    provider !== "anthropic" || (!request.stream && !Array.isArray(request.tools))
  ));
  if (providers.length === 0) {
    throw new Error("No AI provider is configured. Set LOVABLE_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY.");
  }

  let lastResponse: Response | undefined;
  let lastError: unknown;
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const isLast = i === providers.length - 1;
    // Bound each non-final provider attempt so one slow/hanging provider cannot
    // consume the caller's entire abort window and starve the fallback chain.
    const child = new AbortController();
    const onOuterAbort = () => child.abort(signal?.reason);
    if (signal) {
      if (signal.aborted) child.abort(signal.reason);
      else signal.addEventListener("abort", onOuterAbort, { once: true });
    }
    const sliceTimer = setTimeout(
      () => child.abort(new DOMException("provider slice timeout", "AbortError")),
      isLast ? FINAL_PROVIDER_ATTEMPT_TIMEOUT_MS : PROVIDER_ATTEMPT_TIMEOUT_MS,
    );

    try {
      const response = provider === "anthropic"
        ? await callAnthropic(request, child.signal)
        : await callOpenAICompatible(provider, request, child.signal);
      if (response.ok) return response;
      console.warn(`[providerClient] ${provider} failed with ${response.status}; trying next provider`);
      lastResponse = response;
    } catch (error) {
      if (signal?.aborted) throw error;
      console.warn(`[providerClient] ${provider} attempt aborted/failed; trying next provider`);
      lastError = error;
    } finally {
      if (sliceTimer !== undefined) clearTimeout(sliceTimer);
      signal?.removeEventListener("abort", onOuterAbort);
    }
  }


  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new Error("All configured AI providers failed");
}

/**
 * Execute exactly the provider named by the model id.
 *
 * The higher-level AI orchestrator already owns model/provider failover. Letting
 * this client run its own fallback chain inside each orchestrator attempt
 * multiplies deadlines (model attempts × provider attempts) and was the source
 * of Wizard requests surviving until the 240 second browser timeout.
 */
export async function createPlannedChatCompletion(
  request: ChatCompletionRequest,
  signal?: AbortSignal,
  retryRateLimits = true,
): Promise<Response> {
  const provider = requestedProvider(request.model);
  if (!provider || provider === "anthropic") {
    throw new Error(`Unsupported planned chat model: ${request.model ?? "unknown"}`);
  }
  return callOpenAICompatible(provider, request, signal, retryRateLimits);
}

/**
 * Execute one bounded request through the managed gateway.
 *
 * The orchestrator calls this only after every configured direct provider has
 * failed. Keeping it separate from createPlannedChatCompletion guarantees the
 * gateway can never become the primary provider or create a nested fallback
 * chain inside a planned direct-provider attempt.
 */
export async function createLastResortGatewayChatCompletion(
  request: ChatCompletionRequest,
  signal?: AbortSignal,
): Promise<Response> {
  if (!hasManagedGatewayAccess()) {
    throw new Error("Managed AI gateway is not configured");
  }
  return callOpenAICompatible("lovable", request, signal);
}
