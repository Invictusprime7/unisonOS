/**
 * aiApplyGate — Pass 3 of Canonical Preview + Durable Commit Enforcement.
 *
 * Routes AI Builder patch application through VFSCommitService so that
 * `commitMutation` is the single durable writer:
 *
 *   1. `dryRunAiCommit` runs commitMutation with dryRun=true + preview gate
 *      enforcement. If preflight / gates reject, the caller MUST NOT touch
 *      the working VFS. Returns structured blockers for UI surfacing.
 *
 *   2. `persistAiCommit` runs the real commit (writes site_revisions row)
 *      after the caller has mirrored the accepted files into the local VFS.
 *      Non-blocking readiness — commits still land when readiness is noisy —
 *      but preview gate must pass. Returns the revision id.
 *
 * Both helpers share BuilderIdentity resolution + snapshot forwarding so
 * WebBuilder callers stay lean and identical between desktop / mobile
 * mounts.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  commitMutation,
  CommitRejectedError,
  type CommitMutationResult,
  type PublishBlockerSummary,
} from '@/services/vfsCommitService';
import { assertPatchPlan, legacyFilesToPatchPlan } from '@/types/patchPlan';
import { describeStaleCandidate, rebaseCandidate, recordCommit, runExclusive } from '@/services/builder/builderMutationCoordinator';
import type { BuilderIdentity } from '@/types/builderIdentity';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import type { PlaygroundState } from '@/platform/core/playground';
import type { AICandidateChangeSet } from '@/services/builder/aiCandidateChangeSet';
import type { PatchPlan } from '@/types/patchPlan';

export interface AiCommitContext {
  businessId: string;
  projectId: string;
  draftId: string;
  revisionId?: string | null;
  sessionId?: string;
  beforeFiles: Record<string, string>;
  nextFiles: Record<string, string>;
  snapshotForPreflight?: SiteBundleSnapshot | null;
  /**
   * Canonical playground state. Required — `commitToPipeline` rejects every
   * non-wizard commit that arrives without it.
   */
  playground?: PlaygroundState | null;
  activePagePath: string;
  /** Exact isolated candidate accepted by the Composer gates. */
  candidate?: AICandidateChangeSet;
  /** Checkpoint label shown in the version list (usually the user's prompt). */
  label?: string;
}

export function buildAiCandidatePatch(ctx: AiCommitContext): PatchPlan {
  let candidate = ctx.candidate;
  if (candidate && (candidate.baseRevisionId ?? null) !== (ctx.revisionId ?? null)) {
    const rebase = rebaseCandidate(candidate, ctx.beforeFiles, ctx.revisionId ?? null);
    if (rebase.ok === false) {
      throw new Error(`[aiApplyGate] candidate base revision is stale; regenerate from the current revision. ${describeStaleCandidate(rebase.conflicts)}`);
    }
    candidate = rebase.candidate;
  }
  if (!candidate) return legacyFilesToPatchPlan(ctx.nextFiles, 'ai-builder legacy candidate');
  if (!candidate.id.trim()) {
    throw new Error('[aiApplyGate] candidate identity is required.');
  }
  if ((candidate.baseRevisionId ?? null) !== (ctx.revisionId ?? null)) {
    throw new Error('[aiApplyGate] candidate base revision is stale; regenerate from the current revision.');
  }
  const patch: PatchPlan = {
    summary: ctx.label ? `AI · ${ctx.label}` : `AI candidate ${candidate.id}`,
    operationIds: [`ai-candidate:${candidate.id}`],
    fileOps: candidate.fileOps.map((operation) => operation.type === 'delete'
      ? { type: 'delete' as const, path: operation.path }
      : { type: operation.type, path: operation.path, contents: operation.content }),
    routeOps: candidate.routeOps.map((operation) => operation.type === 'add_page'
      ? { ...operation, createdBy: 'ai' as const }
      : { ...operation }),
    playgroundOps: structuredClone([...(candidate.playgroundOps ?? [])]),
    bindingOps: structuredClone([...(candidate.bindingOps ?? [])]),
    dataOps: structuredClone([...(candidate.dataOps ?? [])]),
    backendOps: structuredClone([...(candidate.backendOps ?? [])]),
    presentationOps: structuredClone([...(candidate.presentationOps ?? [])]),
    businessSystem: candidate.businessSystem ? structuredClone(candidate.businessSystem) : undefined,
    candidate: {
      id: candidate.id,
      baseRevisionId: candidate.baseRevisionId,
      origin: candidate.provenance.origin,
      intent: candidate.provenance.intent,
      knowledgeVersion: candidate.provenance.knowledgeVersion,
      evidence: candidate.provenance.evidence,
      targetPages: candidate.targetPages,
      requestedDependencies: candidate.requestedDependencies,
      attempt: candidate.attempt,
    },
  };
  assertPatchPlan(patch, 'aiApplyGate');
  return patch;
}

function canonicalSnapshot(ctx: AiCommitContext): SiteBundleSnapshot | null {
  const raw = ctx.beforeFiles['/.unison/site-bundle-snapshot.json'];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SiteBundleSnapshot;
      if (parsed?.snapshotId && parsed?.vfsFiles) return parsed;
    } catch {
      // Fall through to route/hydration state. The commit gate will report a
      // malformed canonical snapshot if neither source is usable.
    }
  }
  return ctx.snapshotForPreflight ?? null;
}

export interface AiCommitDryRunOutcome {
  /** True when dry-run commit accepted the patch. */
  accepted: boolean;
  /** Preview / capability blockers when rejected. */
  blockers: PublishBlockerSummary[];
  /** Human-readable summary suitable for toast description. */
  rejectMessage?: string;
  /** Raw commit result (dry-run row NOT persisted). */
  commit?: CommitMutationResult;
}

async function resolveIdentity(ctx: AiCommitContext): Promise<BuilderIdentity | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    userId: user.id,
    businessId: ctx.businessId,
    projectId: ctx.projectId,
    draftId: ctx.draftId,
    revisionId: ctx.revisionId ?? null,
    sessionId: ctx.sessionId ?? `web-builder:${ctx.draftId}`,
  };
}

/**
 * Dry-run the AI patch through commitMutation. Preview gate is enforced;
 * readiness is advisory (matches AI Builder's edit granularity — a single
 * copy tweak should not be blocked because some other capability is stub).
 */
export async function dryRunAiCommit(ctx: AiCommitContext): Promise<AiCommitDryRunOutcome> {
  if (!ctx.businessId || !ctx.projectId || !ctx.draftId) {
    return {
      accepted: false,
      blockers: [{
        source: 'preview',
        code: 'missing-canonical-identity',
        message: 'AI editing requires canonical business, project, and draft identity.',
      }],
      rejectMessage: 'Canonical project identity is unavailable.',
    };
  }
  try {
    const identity = await resolveIdentity(ctx);
    if (!identity) {
      return {
        accepted: false,
        blockers: [{
          source: 'preview',
          code: 'missing-authenticated-identity',
          message: 'AI editing requires an authenticated canonical project session.',
        }],
        rejectMessage: 'Your project session is unavailable.',
      };
    }
    const snapshot = canonicalSnapshot(ctx);
    const patch = buildAiCandidatePatch(ctx);
    const commit = await commitMutation({
      source: 'ai-builder',
      identity,
      current: {
        vfsFiles: ctx.beforeFiles,
        siteBundleSnapshot: snapshot ?? undefined,
        playground: ctx.playground ?? undefined,
        activePagePath: ctx.activePagePath,
      },
      patch,
      options: {
        dryRun: true,
        requirePreviewPass: true,
        requireReadinessPass: false,
        industry: snapshot?.industry,
      },
    });
    return { accepted: true, blockers: [], commit };
  } catch (err) {
    if (err instanceof CommitRejectedError) {
      const blockers = err.result.publishBlockers;
      const previewBlockers = blockers.filter((b) => b.source === 'preview' || b.source === 'publishGate');
      return {
        accepted: false,
        blockers,
        rejectMessage: previewBlockers[0]?.message ?? err.message,
        commit: err.result,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      accepted: false,
      blockers: [{ source: 'preview', code: 'canonical-commit-gate-failed', message }],
      rejectMessage: message,
    };
  }
}

/**
 * Persist the AI patch as a real site_revisions row after the caller has
 * applied it to the working VFS. Returns the new revision id on success.
 */
export async function persistAiCommit(ctx: AiCommitContext): Promise<CommitMutationResult> {
  const identity = await resolveIdentity(ctx);
  if (!identity) {
    throw new Error('[aiApplyGate] authenticated canonical identity is unavailable');
  }
  const snapshot = canonicalSnapshot(ctx);
  const patch = buildAiCandidatePatch(ctx);
  return runExclusive('ai-builder', async () => {
    const result = await commitMutation({
    source: 'ai-builder',
    identity,
    current: {
      vfsFiles: ctx.beforeFiles,
      siteBundleSnapshot: snapshot ?? undefined,
      playground: ctx.playground ?? undefined,
      activePagePath: ctx.activePagePath,
    },
    patch,
    options: {
      requirePreviewPass: true,
      requireReadinessPass: false,
      industry: snapshot?.industry,
    },
  });
    recordCommit('ai-builder', result.persistedRevisionId);
    return result;
  });
}
