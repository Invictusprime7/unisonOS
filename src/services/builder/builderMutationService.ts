import { checkEditAgainstIntent } from '@/services/editor/editIntentContract';
/**
 * builderMutationService — P0.3 of the canonical closure plan.
 *
 * Every AI Builder edit used to run as two separate pipeline executions:
 * a dry-run commit, then — after a gap — a second real commit, and only then
 * a mirror into the working VFS. Three consequences:
 *
 *   • the patch was validated against one pipeline run and persisted by
 *     another, so the accepted bytes and the persisted bytes were not
 *     provably the same run;
 *   • patch-style mirroring could not remove files, so a committed deletion
 *     remained visible in the working VFS;
 *   • "applied" was reported from the mirror alone, not from a transaction.
 *
 * This service makes an AI edit ONE transaction with one terminal state.
 * It adds no writer: `commitMutation` (via `persistAiCommit`) remains the
 * single durable writer, and the canonical preview gate still rejects a
 * preview-breaking patch *before* anything is persisted or mirrored.
 */

import { persistAiCommit, type AiCommitContext } from '@/services/aiApplyGate';
import {
  CommitRejectedError,
  type CommitMutationResult,
  type PublishBlockerSummary,
} from '@/services/vfsCommitService';
import { emitAgentEvent, lineDelta } from '@/services/agent-runtime/agentEvents';
import { findIntentRetargets, isRequestedRetarget } from '@/services/agent-runtime/intentInvariant';

/** Terminal states of a builder mutation transaction. */
export type BuilderMutationState =
  /** Canonical gates refused the patch. Nothing persisted, nothing mirrored. */
  | 'rejected'
  /** Committed durably AND mirrored into the working VFS. */
  | 'applied'
  /** Commit or committed-state mirror failed. Durable details remain available. */
  | 'failed';

export interface BuilderMutationOutcome {
  state: BuilderMutationState;
  /** True only for `applied` — never inferred from a partial step. */
  success: boolean;
  errors: string[];
  blockers: PublishBlockerSummary[];
  /** Human-readable reason for a non-applied outcome. */
  reason?: string;
  commit?: CommitMutationResult;
  revisionId?: string | null;
  /** Canonical post-commit file map (authoritative over the proposed patch). */
  committedFiles?: Record<string, string>;
  changedPaths: string[];
}

export interface BuilderMutationHooks {
  /**
   * Replace the working VFS with the complete committed file map in one state
   * transition. Full replacement is required so accepted deletions converge.
   */
  mirror: (committedFiles: Record<string, string>) => { success: boolean; errors?: string[]; filesWritten?: string[] };
}

function changedPathsBetween(
  before: Record<string, string>,
  after: Record<string, string>,
): string[] {
  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter(path => before[path] !== after[path])
    .sort();
}

/**
 * Run an AI Builder edit as a single transaction:
 * validate + persist in one canonical commit, then mirror, then settle.
 */
export async function runBuilderAiMutation(
  ctx: AiCommitContext,
  hooks: BuilderMutationHooks,
): Promise<BuilderMutationOutcome> {
  const proposed = changedPathsBetween(ctx.beforeFiles, ctx.nextFiles);
  for (const path of proposed) {
    emitAgentEvent({ kind: 'file_change', message: path, path, ...lineDelta(ctx.beforeFiles[path], ctx.nextFiles[path]) });
  }

  // Intent invariant: buttons keep their destinations regardless of UI edits.
  emitAgentEvent({ kind: 'verification', message: 'Buttons still go to the same places', status: 'running' });
  const retargets = findIntentRetargets(ctx.beforeFiles, ctx.nextFiles)
    .filter((violation) => !isRequestedRetarget(ctx.label, violation));
  if (retargets.length > 0) {
    const reason = `This edit would change where ${retargets.map((v) => `"${v.intent}"`).join(', ')} leads (was ${retargets[0].before.join(', ')}). Button destinations stay fixed during design edits.`;
    emitAgentEvent({ kind: 'error', message: reason, status: 'failed' });
    return { state: 'rejected', success: false, errors: [reason], blockers: [], reason, changedPaths: [] };
  }
  if (ctx.editIntent) {
    const changed = Object.fromEntries(proposed.map((p) => [p, ctx.nextFiles[p] ?? null]));
    const violations = checkEditAgainstIntent(ctx.editIntent, {
      baseRevisionId: ctx.revisionId ?? null, files: changed, previousFiles: ctx.beforeFiles,
      installedPackages: (() => { try { return Object.keys(JSON.parse(ctx.nextFiles['/package.json'] ?? '{}').dependencies ?? {}); } catch { return []; } })(),
    });
    if (violations.length > 0) {
      const v = violations[0];
      const reason = v.code === 'stale-revision' ? 'The project changed since this edit started. Try the request again.'
        : v.code === 'cross-page-consent' ? `This edit would also change ${v.paths.join(', ')}. Confirm you want other pages changed.`
          : v.code === 'backend-consent' ? 'This edit would change business data or backend setup. Confirm before it is saved.'
            : v.code === 'binding-removed' ? `This edit would remove a working button (${v.bindings.join(', ')}).`
              : `This edit uses packages that were not added: ${v.packages.join(', ')}.`;
      emitAgentEvent({ kind: 'error', message: reason, status: 'failed' });
      return { state: 'rejected', success: false, errors: [reason], blockers: [], reason, changedPaths: [] };
    }
  }
  emitAgentEvent({ kind: 'verification', message: 'Checking code and preview, then saving', status: 'running' });

  let commit: CommitMutationResult;
  try {
    // One pipeline run validates AND persists — the accepted bytes are, by
    // construction, the persisted bytes.
    commit = await persistAiCommit(ctx);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const rejection = error && typeof error === 'object'
      ? error as { code?: unknown; stage?: unknown }
      : null;
    const code = typeof rejection?.code === 'string' ? rejection.code : null;
    const stage = typeof rejection?.stage === 'string' ? rejection.stage : null;
    const diagnostic = code
      ? `[${code}${stage ? ` at ${stage}` : ''}] ${message}`
      : message;
    emitAgentEvent({
      kind: 'error',
      status: 'failed',
      message: diagnostic,
    });
    if (error instanceof CommitRejectedError) {
      const blockers = error.result.publishBlockers ?? [];
      const primary = blockers.find((b) => b.source === 'preview' || b.source === 'publishGate');
      return {
        state: 'rejected',
        success: false,
        errors: blockers.length ? blockers.map((b) => b.message) : [error.message],
        blockers,
        reason: primary?.message ?? error.message,
        commit: error.result,
        changedPaths: [],
      };
    }
    return {
      state: code ? 'rejected' : 'failed',
      success: false,
      errors: [diagnostic],
      blockers: [],
      reason: diagnostic,
      changedPaths: [],
    };
  }

  const committedFiles = commit.vfsFiles ?? {};
  const changedPaths = changedPathsBetween(ctx.beforeFiles, committedFiles);
  const mirror = hooks.mirror(committedFiles);

  if (!mirror.success) {
    // Supabase is already durable truth. Never pretend the previous local map
    // rolled back the commit; the returned revision/files let reload reconcile.
    const errors = mirror.errors?.length ? mirror.errors : ['The edit could not be applied to the working files.'];
    return {
      state: 'failed',
      success: false,
      errors,
      blockers: [],
      reason: errors[0],
      commit,
      revisionId: commit.persistedRevisionId ?? null,
      committedFiles,
      changedPaths,
    };
  }

  emitAgentEvent({
    kind: 'commit',
    status: 'ok',
    message: `${changedPaths.length} file${changedPaths.length === 1 ? '' : 's'} saved as a new checkpoint`,
    revisionId: commit.persistedRevisionId ?? null,
  });
  return {
    state: 'applied',
    success: true,
    errors: [],
    blockers: [],
    commit,
    revisionId: commit.persistedRevisionId ?? null,
    committedFiles,
    changedPaths,
  };
}
