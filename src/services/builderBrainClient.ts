/**
 * builderBrainClient — Headless client for the shared "builder brain"
 * (the `ai-code-assistant` edge function / Lane B).
 *
 * Both the Wizard launch path (LauncherWizard) and the in-Builder
 * AIBuilderPanel call into this single client so they share:
 *   - the same edge entry point
 *   - the same memory / research / VFS context behavior (Lane B)
 *   - the same transactional patch lifecycle
 *
 *   Wizard UI ─┐
 *              ├─→ builderBrainClient ─→ ai-code-assistant ─→ runBuilderLane
 *   AIBuilderPanel UI ─┘
 */

import { supabase } from "@/integrations/supabase/client";
import {
  isSupabaseEnvConfigured,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/integrations/supabase/env";
import { shrinkBuilderTurnPayload, BUILDER_BODY_RETRY_BUDGETS } from "@/services/builderPayloadBudget";
import type { UnisonAIContext } from "@/unison/aiContext";
import { createUnisonBuilderContext, renderUnisonBuilderDirective } from '@/services/unisonBuilderConnector';
import type { UnisonBuilderConnectorInput } from '@/types/unisonBuilderConnector';
export type BuilderTurnResponse<T = unknown> = { data: T | null; error: unknown };

export interface BuilderTurnInput {
  messages: Array<{ role: string; content: unknown }>;
  connectorContext?: UnisonBuilderConnectorInput;
  mode?: string;
  currentCode?: string;
  editMode?: boolean;
  debugMode?: boolean;
  templateAction?: string;
  templateName?: string | null;
  systemType?: string | null;
  aesthetic?: string | null;
  source?: string | null;
  variationSeed?: string | null;
  surgicalEdit?: boolean;
  behavioralEdit?: boolean;
  navPageGen?: boolean;
  navPageName?: string | null;
  navLabel?: string | null;
  targetFile?: string;
  componentBehaviorContext?: string;
  previewDiagnostics?: string;
  previewSnapshot?: string;
  recentChangedFiles?: string[];
  vfsFiles?: Record<string, string>;
  systemsBuildContext?: unknown;
  siteElementsLibraryContext?: string;
  launchBrief?: unknown;
  userDesignProfile?: unknown;
  attachments?: unknown[];
  gatewayOptions?: unknown;
  unisonContext?: UnisonAIContext;
  wizardSeed?: unknown;
  [extra: string]: unknown;
}

export interface BuilderTurnOptions {
  functionName?: 'ai-code-assistant' | 'wizard-site-composer';
  /** Abort the in-flight invoke. */
  signal?: AbortSignal;
  /** Absolute budget across invocation, backoff, retries and raw fallback. */
  timeoutMs?: number;
}

export async function releaseGuestDemoReservation(operationId: string, reason: string): Promise<void> {
  const { error } = await supabase.functions.invoke('ai-code-assistant', {
    body: {
      guestDemoAction: 'release',
      operationId,
      reason: reason.slice(0, 120),
    },
  });
  if (error) throw new Error(error.message || 'Guest demo reservation release failed');
}

type BuilderSession = Awaited<ReturnType<typeof supabase.auth.refreshSession>>['data']['session'];

// Wizard page batches invoke Lane B concurrently. A rejected access token can
// therefore make several requests call refreshSession at once; refresh-token
// rotation lets the first call succeed and makes the rest look invalid. Share
// one refresh and briefly reuse its result so every batch retries with the same
// newly-issued access token.
let builderRefreshInFlight: Promise<BuilderSession | null> | null = null;
let recentBuilderRefresh: { session: BuilderSession; refreshedAt: number } | null = null;
const BUILDER_REFRESH_REUSE_MS = 10_000;

async function refreshBuilderSession(
  force = false,
  rejectedToken?: string,
): Promise<BuilderSession | null> {
  const recent = recentBuilderRefresh;
  const recentIsFresh = !!recent?.session
    && Date.now() - recent.refreshedAt < BUILDER_REFRESH_REUSE_MS;
  if (force) {
    // A 401 means *that* access token was rejected. If a sibling request has
    // already rotated the session since, reuse the newer token instead of
    // rotating again: concurrent rotations invalidate each other's refresh
    // tokens and cascade every batch into a hard sign-out.
    if (recentIsFresh && recent!.session!.access_token !== rejectedToken) {
      return recent!.session;
    }
    recentBuilderRefresh = null;
  } else if (recentIsFresh) {
    return recent!.session;
  }
  if (builderRefreshInFlight) return builderRefreshInFlight;



  builderRefreshInFlight = (async () => {
    const beforeRefresh = (await supabase.auth.getSession()).data.session;
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) {
      recentBuilderRefresh = { session: data.session, refreshedAt: Date.now() };
      return data.session;
    }

    // Another auth consumer may have completed a rotation while this request
    // was in flight. Keep that newer session instead of clearing it because an
    // older refresh token was rejected.
    const currentSession = (await supabase.auth.getSession()).data.session;
    if (currentSession && currentSession.access_token !== beforeRefresh?.access_token) {
      recentBuilderRefresh = { session: currentSession, refreshedAt: Date.now() };
      return currentSession;
    }

    if (isRejectedRefreshError(error)) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
    return null;
  })().finally(() => {
    builderRefreshInFlight = null;
  });

  return builderRefreshInFlight;
}

/**
 * A wizard launch is a minutes-long run of concurrent 135s Lane B calls. Any
 * access token with less than this much life left is refreshed up-front so the
 * run cannot 401 halfway through and collapse into empty per-page recoveries.
 */
export const BUILDER_TOKEN_MIN_LIFETIME_MS = 300_000;

/**
 * Absolute floor: a token with at least this much life left can still carry a
 * Lane B turn, so a failed proactive rotation must not abort the launch.
 */
export const BUILDER_MIN_USABLE_TOKEN_MS = 60_000;



/**
 * Server-verified token check, memoized per access token so a batched Lane B
 * run performs at most one round-trip. `getSession()` alone cannot detect a
 * token issued by another project ref or invalidated by a key rotation.
 */
const builderTokenChecks = new Map<string, Promise<boolean>>();

async function isTokenAcceptedByAuth(token: string): Promise<boolean> {
  const cached = builderTokenChecks.get(token);
  if (cached) return cached;
  const check = supabase.auth
    .getUser(token)
    .then(({ data, error }) => !error && !!data.user)
    .catch(() => true); // network hiccup: don't block the build on a probe
  builderTokenChecks.set(token, check);
  const ok = await check;
  if (!ok) builderTokenChecks.delete(token);
  return ok;
}

/**
 * Prime the builder session BEFORE a batched run (wizard launch, Lane B page
 * completion). Rotating once up-front means every concurrent batch shares a
 * long-lived, server-verified token instead of discovering expiry mid-flight.
 *
 * Returns false when no usable session can be established — the caller should
 * surface a sign-in prompt rather than start a run that will 401 on every call.
 */
export async function primeBuilderSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return false;
  const expiresAt = (session.expires_at ?? 0) * 1000;
  if (
    expiresAt - Date.now() > BUILDER_TOKEN_MIN_LIFETIME_MS &&
    await isTokenAcceptedByAuth(session.access_token)
  ) {
    return true;
  }
  builderTokenChecks.delete(session.access_token);
  const refreshed = await refreshBuilderSession(true, session.access_token);
  if (refreshed?.access_token) {
    return isTokenAcceptedByAuth(refreshed.access_token);
  }
  // Rotation failed (another tab rotated first, or the refresh round-trip
  // hiccuped). That is NOT proof the current session is dead: if the live
  // token is still accepted by auth and has real life left, the run may
  // proceed instead of dead-ending the whole launch on a sign-in prompt.
  const live = (await supabase.auth.getSession()).data.session;
  if (!live?.access_token) return false;
  const liveExpiresAt = (live.expires_at ?? 0) * 1000;
  if (liveExpiresAt - Date.now() <= BUILDER_MIN_USABLE_TOKEN_MS) return false;
  return isTokenAcceptedByAuth(live.access_token);
}



const DEFAULT_RATE_LIMIT_RETRY_MS = 750;

const MAX_RATE_LIMIT_RETRY_MS = 2_500;
const MIN_BUILDER_GATEWAY_TIMEOUT_MS = 5_000;
// Wizard seed generation gives Gemini's long structured response a 125 second
// lead attempt. The client must not abort it at 120 seconds before the provider
// loop can return a successful response.
export const MAX_BUILDER_GATEWAY_TIMEOUT_MS = 135_000;

export function clampBuilderGatewayTimeout(
  configuredTimeoutMs: number,
  remainingBeforeInvokeMs: number,
): number {
  const configured = Number.isFinite(configuredTimeoutMs)
    ? configuredTimeoutMs
    : MAX_BUILDER_GATEWAY_TIMEOUT_MS;
  const remainingProviderBudget = Math.max(
    MIN_BUILDER_GATEWAY_TIMEOUT_MS,
    remainingBeforeInvokeMs - 5_000,
  );

  return Math.max(
    MIN_BUILDER_GATEWAY_TIMEOUT_MS,
    Math.min(configured, remainingProviderBudget, MAX_BUILDER_GATEWAY_TIMEOUT_MS),
  );
}

export function getShortRateLimitRetryMs(retryAfter: string | null, now = Date.now()): number | null {
  if (!retryAfter) return DEFAULT_RATE_LIMIT_RETRY_MS;
  const seconds = Number(retryAfter);
  const delay = Number.isFinite(seconds)
    ? Math.max(0, Math.round(seconds * 1_000))
    : Math.max(0, Date.parse(retryAfter) - now);
  return Number.isFinite(delay) && delay <= MAX_RATE_LIMIT_RETRY_MS ? delay : null;
}

const TRANSPORT_ERROR_PATTERN =
  /failed to send|failed to fetch|network(?:\s|error)|networkerror|econnreset|econnrefused|socket hang up|load failed|502|503|504|gateway timeout|bad gateway|service unavailable/i;

/**
 * Classify an invoke error as transport-class (retry-worthy) vs. an
 * HTTP/schema/AI error the caller must see immediately.
 *
 * Transport-class = the fetch itself failed before any HTTP response body
 * reached us (network hiccup, CORS preflight failure, cold-start crash,
 * 5xx from the edge runtime). We only retry these.
 */
export function isTransportError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as { name?: string; message?: string; context?: { status?: number } };

  // supabase-js FunctionsFetchError has name === "FunctionsFetchError"
  if (anyErr?.name === "FunctionsFetchError") return true;
  // Native fetch failure surfaces as TypeError
  if (anyErr?.name === "TypeError" && TRANSPORT_ERROR_PATTERN.test(anyErr?.message || "")) return true;

  const status = anyErr?.context?.status;
  if (typeof status === "number" && status >= 502 && status <= 504) return true;

  const msg = typeof anyErr?.message === "string" ? anyErr.message : "";
  if (msg && TRANSPORT_ERROR_PATTERN.test(msg)) return true;

  return false;
}




/**
 * Detect a provider-chain 429 so callers can surface the real failure. The
 * edge function already exhausts its bounded provider failover before it
 * returns 429; replaying the whole request here only consumes the Wizard's
 * remaining deadline and masks the rate limit as a timeout.
 *
 * IMPORTANT: only match on the actual HTTP status, not the message text. A
 * 500 "all providers failed" response includes provider error trails that
 * contain "429" from one provider's rate limit, but the overall failure is a
 * mixed timeout/429 — showing the rate-limit toast would be misleading.
 */
export function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as { message?: string; status?: number; context?: { status?: number } };
  if (anyErr?.status === 429 || anyErr?.context?.status === 429) return true;
  return false;
}

/** A funded provider or Builder client timeout can be recovered by splitting a Wizard into page batches. */
export function isProviderTimeoutError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as { message?: string; context?: { body?: string; status?: number } };
  const detail = [anyErr.message, anyErr.context?.body]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
  return /provider attempt timed out|provider (?:attempt )?timed out|provider slice timeout|builder turn deadline exceeded|ai generation exceeded the wizard generation deadline/i.test(detail);
}

function isRejectedRefreshError(err: unknown): boolean {
  const candidate = err as { status?: number; code?: string; message?: string } | null;
  return candidate?.status === 400
    || candidate?.status === 401
    || candidate?.status === 403
    || candidate?.code === 'refresh_token_not_found'
    || /invalid refresh token|refresh token.*(?:invalid|expired|not found)/i.test(candidate?.message || '');
}

export function isBuilderSessionError(error: unknown): boolean {
  const candidate = error as { context?: { status?: number }; message?: string } | null;
  return candidate?.context?.status === 401
    || /invalid or expired token|session expired|sign in again/i.test(candidate?.message || '');
}

/**
 * Preserve the edge function's bounded provider trail for the Builder. The
 * edge returns a short customer-safe `error` plus a diagnostic `details`
 * field; previously we discarded the latter and turned an actionable model
 * error into the indistinguishable "providers failed" message.
 */
export function builderEdgeErrorMessage(
  payload: unknown,
  status: number,
): string {
  const body = payload && typeof payload === 'object'
    ? payload as { error?: unknown; details?: unknown; errorType?: unknown }
    : null;
  const summary = typeof body?.error === 'string' && body.error.trim()
    ? body.error.trim()
    : `AI generation failed (${status})`;
  const details = typeof body?.details === 'string' ? body.details.trim() : '';
  if (!details || details === summary) return summary;
  // Edge diagnostics are already server-truncated; retain a compact final
  // portion so the UI names the failed provider without dumping its response.
  return `${summary} ${details.slice(0, 360)}`;
}

export function isBuilderProviderUnavailable(message: string): boolean {
  return /all AI providers failed|all AI models failed|AI providers failed to produce a response|AI service unavailable/i.test(message);
}

export function shouldOfferBuilderProviderRetry(message: string, attachmentCount: number): boolean {
  return attachmentCount === 0 && isBuilderProviderUnavailable(message);
}


function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Invoke the shared builder brain. Returns the raw Supabase functions
 * response so callers can keep their existing error-handling / parsing
 * logic unchanged during incremental migration.
 *
 * Adds transport-only retry: up to 2 retries (3 attempts total) with
 * 750ms → 1500ms backoff + jitter. Non-transport errors (structured 4xx,
 * schema failures, `{ error }` payloads) are returned immediately so the
 * launcher's Lane B contract enforcement runs unchanged.
 */
export async function runBuilderTurn<TResponse = any>(
  input: BuilderTurnInput,
  options: BuilderTurnOptions = {},
): Promise<{ data: TResponse; error: any }> {
  if (input.connectorContext) {
    try {
      const context = createUnisonBuilderContext({
        ...input.connectorContext,
        files: input.vfsFiles ?? input.connectorContext.files,
      });
      const { connectorContext: _connectorContext, ...payload } = input;
      input = {
        ...payload,
        messages: [{ role: 'system', content: renderUnisonBuilderDirective(context) }, ...input.messages],
      };
    } catch (error) {
      return { data: null as TResponse, error };
    }
  }
  const maxAttempts = 2;
  const baseDelays = [600, 1400, 2800];
  // Provider cooldowns are seconds-scale; back off harder than transport retries.

  let lastError: unknown = null;
  let sentPayload: Record<string, unknown> = input as unknown as Record<string, unknown>;
  const deadlineAt = Date.now() + (options.timeoutMs ?? 175_000);

  const remainingMs = () => deadlineAt - Date.now();

  /**
   * Resolve a *user* access token. The edge function verifies the bearer token
   * with `auth.getUser()`, so an expired token (or the anon key) yields a hard
   * 401 "Invalid or expired token". A wizard launch runs for minutes with
   * 135s provider calls, so a token that merely has "more than a minute" left
   * expires mid-run: require a full launch-scale lifetime before trusting it.
   */
  const getAccessToken = async (rejectedToken?: string): Promise<string | null> => {
    const forceRefresh = !!rejectedToken;
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    const expiresAt = (session?.expires_at ?? 0) * 1000;
    if (forceRefresh && session) {
      // The server rejected this exact token — invalidate the memoized verdict.
      builderTokenChecks.delete(rejectedToken!);
    }
    if (session && !forceRefresh && expiresAt - Date.now() > BUILDER_TOKEN_MIN_LIFETIME_MS) {

      // `getSession()` is a local read: a token minted by a different project
      // ref, or invalidated by a signing-key rotation, still looks "valid" here
      // and produces a hard 401 on every edge call. Validate once against Auth
      // and only then trust it.
      if (await isTokenAcceptedByAuth(session.access_token)) {
        return session.access_token;
      }
    }
    if (forceRefresh && session && session.access_token !== rejectedToken) {
      // A sibling batch already rotated the session after our token was
      // rejected: use it rather than forcing another rotation.
      if (await isTokenAcceptedByAuth(session.access_token)) {
        return session.access_token;
      }
    }
    // A signed-out caller must never reuse a recently cached session.
    if (!session) return null;
    const refreshedSession = await refreshBuilderSession(forceRefresh, rejectedToken);
    if (refreshedSession && await isTokenAcceptedByAuth(refreshedSession.access_token)) {
      return refreshedSession.access_token;
    }
    // A transient proactive refresh failure may leave a usable live session.
    // Never replay the rejected token or resurrect the pre-refresh session.
    const live = (await supabase.auth.getSession()).data.session;
    if (live?.access_token && live.access_token !== rejectedToken
      && (live.expires_at ?? 0) * 1000 - Date.now() > BUILDER_MIN_USABLE_TOKEN_MS
      && await isTokenAcceptedByAuth(live.access_token)) {
      return live.access_token;
    }
    recentBuilderRefresh = null;
    return null;
  };



  const invokeWithSignal = async (
    payload: Record<string, unknown>,
    signal: AbortSignal,
    rejectedToken?: string,
  ) => {

    if (!isSupabaseEnvConfigured) {
      throw new Error("Builder backend configuration is unavailable");
    }
    const url = SUPABASE_URL.replace(/\/$/, "");
    const anon = SUPABASE_PUBLISHABLE_KEY;
    const token = await getAccessToken(rejectedToken);
    if (!token) {
      return {
        data: null,
        error: Object.assign(
          new Error("Your session expired. Please sign in again to continue building."),
          { context: { status: 401, body: "no-session" } },
        ),
      };
    }
    const response = await fetch(`${url}/functions/v1/${options.functionName ?? 'ai-code-assistant'}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal,
    });
    const text = await response.text();
    let data: TResponse | null = null;
    try { data = text ? JSON.parse(text) as TResponse : null; } catch { data = null; }
    if (response.ok) return { data, error: null, usedToken: token };
    const message = builderEdgeErrorMessage(data, response.status);
    return {
      data,
      usedToken: token,
      error: Object.assign(
        new Error(message),
        { context: { status: response.status, body: text } },
      ),
    };

  };


  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (options.signal?.aborted || remainingMs() <= 0) {
      return { data: null as TResponse, error: new DOMException("Aborted", "AbortError") };
    }

    // Hard transport budget: the edge gateway silently drops oversized bodies
    // (no HTTP response at all → "Failed to send a request to the Edge
    // Function"). Shrink optional context to fit, tightening on each retry.
    const budget = BUILDER_BODY_RETRY_BUDGETS[Math.min(attempt - 1, BUILDER_BODY_RETRY_BUDGETS.length - 1)];
    const shrunk = shrinkBuilderTurnPayload(input as unknown as Record<string, unknown>, budget);
    sentPayload = shrunk.payload;
    const remainingBeforeInvoke = remainingMs();
    const gatewayOptions = sentPayload.gatewayOptions;
    if (gatewayOptions && typeof gatewayOptions === "object" && !Array.isArray(gatewayOptions)) {
      const configuredTimeout = typeof (gatewayOptions as { timeoutMs?: unknown }).timeoutMs === "number"
        ? (gatewayOptions as { timeoutMs: number }).timeoutMs
        : remainingBeforeInvoke;
      sentPayload = {
        ...sentPayload,
        gatewayOptions: {
          ...gatewayOptions,
          // Keep the provider loop inside both this client's deadline and the
          // Edge request schema's 5s..135s gateway timeout contract.
          timeoutMs: clampBuilderGatewayTimeout(configuredTimeout, remainingBeforeInvoke),
        },
      };
    }
    if (shrunk.trimmed.length > 0) {
      console.warn(
        `[builderBrainClient] payload ${shrunk.originalBytes}B > budget ${budget}B — trimmed to ${shrunk.finalBytes}B`,
        shrunk.trimmed,
      );
    }

    try {
      const attemptController = new AbortController();
      const onOuterAbort = () => attemptController.abort(options.signal?.reason);
      if (options.signal) {
        if (options.signal.aborted) attemptController.abort(options.signal.reason);
        else options.signal.addEventListener("abort", onOuterAbort, { once: true });
      }
      const attemptTimer = setTimeout(
        () => attemptController.abort(new DOMException("Builder turn deadline exceeded", "TimeoutError")),
        Math.max(1, remainingMs()),
      );
      let { data, error, usedToken } = await invokeWithSignal(sentPayload, attemptController.signal);
      // Expired JWT: rotate and replay immediately (does not consume a
      // transport retry — the edge function never ran the model). Pass the
      // rejected token so concurrent batches converge on one rotation instead
      // of invalidating each other's refresh tokens. Under concurrency the
      // first replay can race another rotation and be rejected too, so replay
      // up to twice before treating the 401 as terminal.
      for (let authReplay = 1; authReplay <= 2; authReplay += 1) {
        const status = (error as { context?: { status?: number } } | null)?.context?.status;
        if (!error || status !== 401 || !usedToken || attemptController.signal.aborted) break;
        console.warn(
          `[builderBrainClient] 401 from edge function — rotating session and replaying (${authReplay}/2)`,
        );
        const rejected = usedToken;
        if (authReplay > 1) await sleep(400, options.signal).catch(() => undefined);
        ({ data, error, usedToken } = await invokeWithSignal(
          sentPayload,
          attemptController.signal,
          rejected,
        ));
      }


      clearTimeout(attemptTimer);
      options.signal?.removeEventListener("abort", onOuterAbort);


      if (error && isTransportError(error) && attempt < maxAttempts) {
        lastError = error;
        const jitter = Math.floor(Math.random() * 250);
        const delay = baseDelays[attempt - 1] + jitter;
        console.warn(
          `[builderBrainClient] transport error on attempt ${attempt}/${maxAttempts}; retrying in ${delay}ms`,
          (error as { message?: string })?.message,
        );
        if (remainingMs() <= delay + 5_000) return { data: null as TResponse, error };
        await sleep(delay, options.signal);
        continue;
      }


      return { data: data as TResponse, error };
    } catch (thrown) {
      if (isTransportError(thrown) && attempt < maxAttempts) {
        lastError = thrown;
        const jitter = Math.floor(Math.random() * 250);
        const delay = baseDelays[attempt - 1] + jitter;
        console.warn(
          `[builderBrainClient] transport throw on attempt ${attempt}/${maxAttempts}; retrying in ${delay}ms`,
          (thrown as { message?: string })?.message,
        );
        if (remainingMs() <= delay + 5_000) return { data: null as TResponse, error: thrown };
        await sleep(delay, options.signal);
        continue;
      }
      return { data: null as TResponse, error: thrown };
    }
  }


  return { data: null as TResponse, error: lastError ?? new Error("Unknown transport failure") };
}

export default runBuilderTurn;
