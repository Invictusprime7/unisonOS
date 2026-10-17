/**
 * AI Composer repair loop (milestone §13, Phase 4).
 *
 * author -> candidate + gates -> on failure send diagnostics back to the same
 * composer -> up to `maxAttempts` total. Shared by launch authoring and Builder
 * edits (§24). Writes nothing: the caller commits an accepted candidate through
 * the single legal writer.
 */

import { runBuilderTurn } from '@/services/builderBrainClient';
import {
  AI_COMPOSER_MODES,
  aiComposerResponseSchema,
  composerScopeViolations,
  type AIComposerRequest,
  type AIComposerResponse,
} from '@/contracts/aiComposerContract';
import { prepareAICandidate, type PageCheck, type PreparedCandidate } from './aiCandidateGates';
import type { HomepageVisualLanguage } from '@/services/launch/homepageFirstContract';
import type { TopologyChange } from '@/services/pageTopologyOrchestrator';
import { assembleCanonicalAuthoringRequest } from './canonicalAuthoringRequest';
import { emitAgentEvent } from '@/services/agent-runtime/agentEvents';

/** Reason→act→check narration for the Builder's activity feed; describes work, never state. */
const narrate = (kind: 'understanding' | 'file_change' | 'verification' | 'error', message: string, status?: 'running' | 'ok' | 'failed') =>
  emitAgentEvent({ kind, message, status });

export type ComposerInvoke = typeof runBuilderTurn;

export type ComposerStopReason =
  | 'accepted'
  | 'gates_exhausted'
  | 'invalid_response'
  | 'credits'        // 402 / workspace policy — terminal, pause authoring
  | 'denied'         // 401 / 403 — terminal
  | 'rate_limited'   // 429 after client retries — park
  | 'provider'       // 5xx / transport
  | 'aborted';

export interface ComposerLoopResult {
  ok: boolean;
  reason: ComposerStopReason;
  attempts: number;
  response?: AIComposerResponse;
  prepared?: PreparedCandidate;
  errors: string[];
}

export interface ComposerLoopInput {
  request: AIComposerRequest;
  baseFiles: Record<string, string>;
  baseRevisionId?: string;
  preflight?: (changed: Record<string, string>) => Record<string, string>;
  maxAttempts?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  gatewayOptions?: Record<string, unknown>;
  invoke?: ComposerInvoke;
  affinity?: {
    language?: HomepageVisualLanguage;
    forbiddenImplementations?: Readonly<Record<string, readonly string[] | undefined>>;
  };
  candidateOrigin?: 'builder' | 'wizard' | 'repair';
  candidateIntent?: string;
  initialRouteOps?: readonly TopologyChange[];
  /** false keeps /package.json out of the candidate (App Builder owns dependencies via its contract). */
  resolveDependencies?: boolean;
  /** Per-page check run inside every attempt so a bad page is repaired in its own loop. */
  pageCheck?: PageCheck;
}

function classifyError(error: unknown): ComposerStopReason {
  const status = (error as { context?: { status?: number } } | null)?.context?.status
    ?? (error as { status?: number } | null)?.status;
  if (status === 402) return 'credits';
  if (status === 401 || status === 403) return 'denied';
  if (status === 429) return 'rate_limited';
  if (status === 400) return 'invalid_response';
  return 'provider';
}

export function decodeComposerResponse(data: unknown): AIComposerResponse | null {
  const content = (data as { content?: unknown } | null)?.content;
  if (typeof content !== 'string') return null;
  try {
    const parsed = aiComposerResponseSchema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Minimum time for one repair turn; below this the attempt is skipped. */
export const MIN_REPAIR_WINDOW_MS = 60_000;

export async function runComposerRepairLoop(input: ComposerLoopInput): Promise<ComposerLoopResult> {
  const invoke = input.invoke ?? runBuilderTurn;
  const maxAttempts = Math.max(1, input.maxAttempts ?? 3);
  const deadline = Date.now() + (input.timeoutMs ?? 145_000);
  let request = input.request;
  let lastErrors: string[] = [];
  let lastResponse: AIComposerResponse | undefined;
  let lastPrepared: PreparedCandidate | undefined;
  const accumulatedFiles: Record<string, string> = {};
  const accumulatedDeletes = new Set<string>();
  const accumulatedRouteOps = new Map<string, TopologyChange>();
  for (const op of input.initialRouteOps ?? []) accumulatedRouteOps.set(`${op.type}:${op.pageId ?? ''}`, { ...op });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (input.signal?.aborted) return { ok: false, reason: 'aborted', attempts: attempt - 1, errors: ['Cancelled.'] };
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 5_000) return { ok: false, reason: 'aborted', attempts: attempt - 1, errors: ['AI page authoring exhausted its shared time budget.'], response: lastResponse, prepared: lastPrepared };
    // A repair turn resends the whole page plus its errors (~150k chars) and
    // needs about a minute; a shorter window can only time out on the server.
    if (attempt > 1 && remainingMs < MIN_REPAIR_WINDOW_MS) {
      return { ok: false, reason: 'gates_exhausted', attempts: attempt - 1, errors: lastErrors.length ? lastErrors : ['Not enough time left to repair this page.'], response: lastResponse, prepared: lastPrepared };
    }
    narrate('understanding', attempt === 1 ? 'Thinking through the change' : `Adjusting (round ${attempt} of ${maxAttempts})`, 'running');
    const { data, error } = await invoke({
      mode: AI_COMPOSER_MODES[request.task],
      messages: [{ role: 'user', content: JSON.stringify(request) }],
      gatewayOptions: {
        ...input.gatewayOptions,
        timeoutMs: Math.min(
          typeof input.gatewayOptions?.timeoutMs === 'number' ? input.gatewayOptions.timeoutMs : 145_000,
          remainingMs - 5_000,
        ),
      },
    }, { timeoutMs: remainingMs, signal: input.signal });

    if (error || !data) {
      const errName = (error as { name?: string } | null)?.name;
      if (input.signal?.aborted || errName === 'AbortError' || errName === 'TimeoutError') {
        const why = (input.signal?.reason as { message?: string } | undefined)?.message
          || (errName === 'TimeoutError' || !input.signal?.aborted
            ? 'The AI took too long to answer and the edit was stopped. Try a smaller, more specific change.'
            : 'The edit was cancelled.');
        return { ok: false, reason: 'aborted', attempts: attempt, errors: [why], response: lastResponse, prepared: lastPrepared };
      }
      const reason = classifyError(error);
      // Only transient failures would be retryable; the client already retried
      // them. Everything here is terminal for this request (gateway semantics).
      // Keep the server's own safe message (e.g. the gateway's credit-hold or
      // top-up text) so the launch error names the real remedy.
      const detail = String((error as { message?: string } | null)?.message ?? '').trim().slice(0, 300);
      const message = detail && !/^AI generation failed \(\d+\)$/.test(detail)
        ? `AI request failed (${reason}): ${detail}`
        : `AI request failed (${reason}).`;
      console.warn('[aiRepairLoop] provider request failed', { reason, status: (error as { context?: { status?: number } } | null)?.context?.status, detail });
      return { ok: false, reason, attempts: attempt, errors: [message], response: lastResponse, prepared: lastPrepared };
    }
    const response = decodeComposerResponse(data);
    if (!response) {
      return { ok: false, reason: 'invalid_response', attempts: attempt, errors: ['AI returned an invalid composer response.'] };
    }
    lastResponse = response;
    narrate('file_change', `Drafted changes to ${response.fileOps.length} file${response.fileOps.length === 1 ? '' : 's'}`, 'ok');
    const scope = composerScopeViolations(request.task, request.page.filePath, response.fileOps);
    if (scope.length) {
      narrate('verification', 'The draft reached outside the requested area; narrowing it', 'running');
      lastErrors = scope;
      request = {
        ...request,
        task: request.task === 'builder_source_edit' ? 'builder_source_edit' : 'site_page_repair',
        diagnostics: scope.slice(0, 30),
        previousResponse: JSON.stringify(response).slice(0, 60000),
      };
      continue;
    }

    for (const op of response.routeOps ?? []) {
      accumulatedRouteOps.set(`${op.type}:${op.pageId ?? ''}`, { ...op });
    }

    const aiFiles: Record<string, string> = {};
    const deletions: string[] = [];
    for (const op of response.fileOps) {
      if (op.type === 'delete') {
        delete accumulatedFiles[op.path];
        accumulatedDeletes.add(op.path);
      } else {
        accumulatedFiles[op.path] = op.content;
        accumulatedDeletes.delete(op.path);
      }
    }
    Object.assign(aiFiles, accumulatedFiles);
    deletions.push(...accumulatedDeletes);
    const prepared = await prepareAICandidate({
      aiFiles,
      deletions,
      baseFiles: input.baseFiles,
      baseRevisionId: input.baseRevisionId,
      targetPages: [request.page.role],
      origin: input.candidateOrigin ?? 'builder',
      intent: input.candidateIntent ?? request.task,
      routeOps: [...accumulatedRouteOps.values()],
      evidence: request.evidence ? {
        ...request.evidence,
        baseRevisionId: request.evidence.baseRevisionId ?? input.baseRevisionId ?? null,
        registryContextHash: request.evidence.registryContextHash ?? null,
      } : undefined,
      preflight: input.preflight,
      affinity: input.affinity,
      resolveDependencies: input.resolveDependencies,
      pageCheck: input.pageCheck,
    });
    lastPrepared = prepared;
    narrate('verification', prepared.ok ? 'Checks passed' : `Found ${prepared.errors.length} problem${prepared.errors.length === 1 ? '' : 's'}; fixing`, prepared.ok ? 'ok' : 'running');
    if (prepared.ok) {
      return { ok: true, reason: 'accepted', attempts: attempt, response, prepared, errors: [] };
    }
    lastErrors = prepared.errors;
    const failingPaths = new Set(prepared.gates.failures.map((f) => f.path));
    const repairFiles = { ...request.files, ...accumulatedFiles };
    for (const path of accumulatedDeletes) delete repairFiles[path];
    request = {
      ...request,
      task: request.task === 'builder_source_edit' ? 'builder_source_edit' : 'site_page_repair',
      diagnostics: prepared.errors.slice(0, 30).map((item) => item.slice(0, 1000)),
      // Repair receives the complete accumulated candidate. A later response
      // may return only the failing file without discarding valid files from
      // earlier attempts.
      files: repairFiles,
      previousResponse: JSON.stringify({
        ...response,
        fileOps: response.fileOps.filter((op) => failingPaths.has(op.path) || failingPaths.size === 0),
        routeOps: [...accumulatedRouteOps.values()],
      }).slice(0, 60000),
    };
  }
  return { ok: false, reason: 'gates_exhausted', attempts: maxAttempts, response: lastResponse, prepared: lastPrepared, errors: lastErrors };
}

/**
 * Builder edits (§24): when an AI Builder patch fails the candidate gates,
 * hand the diagnostics back to the composer in `builder_source_edit` mode
 * instead of refusing immediately. Same loop, same gates, smaller scope.
 */
export async function repairBuilderCandidate(input: {
  rawFiles: Record<string, string>;
  failed: PreparedCandidate;
  baseFiles: Record<string, string>;
  baseRevisionId?: string;
  prompt?: string;
  activeFilePath?: string;
  preflight?: (changed: Record<string, string>) => Record<string, string>;
  invoke?: ComposerInvoke;
  routeOps?: readonly TopologyChange[];
}): Promise<ComposerLoopResult> {
  const target = input.activeFilePath && input.baseFiles[input.activeFilePath]
    ? input.activeFilePath
    : Object.keys(input.rawFiles).find((p) => /^\/src\/.+\.tsx$/.test(p)) ?? '/src/pages/Home.tsx';
  const candidateFiles = { ...input.baseFiles, ...input.rawFiles };
  const assembled = await assembleCanonicalAuthoringRequest({
    task: 'builder_source_edit',
    page: { role: 'page', title: target.split('/').pop() ?? target, route: '/', filePath: target },
    brief: 'Builder edit. Keep the existing design direction, art direction and all intents.',
    knowledgeQuery: `${input.prompt ?? ''} ${target}`,
    instruction: input.prompt?.slice(0, 4000),
    baseFiles: candidateFiles,
    baseRevisionId: input.baseRevisionId,
    sourceTargets: [target, ...Object.keys(input.rawFiles)],
    routes: [],
    diagnostics: input.failed.errors.slice(0, 30),
  });
  return runComposerRepairLoop({
    request: assembled.request,
    baseFiles: input.baseFiles,
    baseRevisionId: input.baseRevisionId,
    candidateOrigin: 'repair',
    candidateIntent: input.prompt?.slice(0, 240) ?? 'builder-repair',
    initialRouteOps: input.routeOps,
    preflight: input.preflight,
    maxAttempts: 3,
    invoke: input.invoke,
  });
}
