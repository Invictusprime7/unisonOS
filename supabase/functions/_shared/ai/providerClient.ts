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

type Provider = "lovable" | "gemini" | "anthropic";
type EnvReader = (name: string) => string | undefined;
import { DEFAULT_GEMINI_GATEWAY_MODEL, configuredGeminiModel } from '../geminiModel.ts';

const LOVABLE_GATEWAY_CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/** True when this project has its own direct Lovable gateway credential. */
export function hasLovableGatewayAccess(): boolean {
  return Boolean(Deno.env.get("LOVABLE_API_KEY"));
}
const GEMINI_CHAT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';
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
  return Boolean(readGeminiApiKey());
}

export async function createImageGeneration(
  request: { prompt: string; size?: string; quality?: "low" | "medium" | "high" | "auto"; model?: string },
  signal?: AbortSignal,
): Promise<Response> {
  const apiKey = readGeminiApiKey();
  if (!apiKey) throw new Error('Gemini image generation is not configured.');
  const dimensions = (request.size ?? '1024x1024').split('x').map(Number);
  const width = dimensions[0] || 1024;
  const height = dimensions[1] || 1024;
  const aspectRatio = width > height ? '3:2' : height > width ? '2:3' : '1:1';
  const requestedModel = request.model?.replace(/^google\//, '');
  const model = requestedModel?.startsWith('gemini-') ? requestedModel : GEMINI_IMAGE_MODEL;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { 'x-goog-api-key': apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: request.prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio, imageSize: request.quality === 'high' ? '2K' : '1K' },
      },
    }),
    signal,
  });
  if (!response.ok) return withProviderHeader(response, 'gemini');
  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
  };
  const image = payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? [])
    .find((part) => typeof part.inlineData?.data === 'string')?.inlineData;
  if (!image?.data) {
    return new Response(JSON.stringify({ error: 'Gemini returned no image data.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'X-Unison-AI-Provider': 'gemini' },
    });
  }
  return new Response(JSON.stringify({ data: [{ b64_json: image.data, mime_type: image.mimeType ?? 'image/png' }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Unison-AI-Provider': 'gemini' },
  });
}

function modelFor(provider: Provider, requestedModel?: string): string {
  const model = requestedModel ?? "";

  if (provider === "lovable") {
    // Gateway ids are always `vendor/model`; bare ids get their vendor restored.
    if (model.includes("/")) return model;
    if (model.startsWith("gemini-")) return `google/${model}`;
    if (model.startsWith("claude-")) return `anthropic/${model}`;
    return DEFAULT_GEMINI_GATEWAY_MODEL;
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

async function callChatCompletionTransport(
  provider: "lovable" | "gemini",
  request: ChatCompletionRequest,
  signal?: AbortSignal,
  retryRateLimits = true,
): Promise<Response> {
  const apiKey = provider === "lovable" ? Deno.env.get("LOVABLE_API_KEY") : readGeminiApiKey();
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
  const url = provider === "lovable"
    ? LOVABLE_GATEWAY_CHAT_URL
      : GEMINI_CHAT_URL;
  const headers: Record<string, string> = provider === "lovable"
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
    throw new Error("No supported AI provider is configured. Set GEMINI_API_KEY, GOOGLE_API_KEY, UNISONGEMINI_API_KEY, ANTHROPIC_API_KEY, or LOVABLE_API_KEY.");
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
        : await callChatCompletionTransport(provider, request, child.signal);
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
  return callChatCompletionTransport(provider, request, signal, retryRateLimits);
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
  if (!hasLovableGatewayAccess()) {
    throw new Error("Managed AI gateway is not configured");
  }
  // The provider loop owns gateway backoff; no hidden second retry chain.
  return callChatCompletionTransport("lovable", request, signal, false);
}
