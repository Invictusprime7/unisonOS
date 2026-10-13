/**
 * Builder commit controller (P1.12 — WebBuilder controller extraction).
 *
 * Every builder surface that mutates the site (layout fast path, presentation
 * ops, authored files, theme tokens, the property inspector) used to rebuild
 * the same `commitMutation` envelope inline inside `WebBuilder.tsx`: identity,
 * canonical `current`, pipeline options and the post-commit adoption record.
 * Five hand-rolled copies meant five chances to drift from the canonical
 * mutation boundary.
 *
 * This module is the single, React-free source of that envelope. It holds no
 * state and performs no IO — the component supplies a context, this builds the
 * canonical input, and `commitMutation` remains the only mutation boundary.
 */
import type { CommitMutationInput, CommitMutationResult } from '@/services/vfsCommitService';
import type { PatchSource, PresentationOp } from '@/types/patchPlan';
import type { SiteBundleSnapshot } from '@/platform/core';

/** Identity + canonical state the builder holds for the open site. */
export interface BuilderCommitContext {
  userId: string;
  businessId: string;
  /** Durable project id; falls back to the draft id when a project row is not resolved yet. */
  projectId?: string | null;
  draftId: string;
  revisionId?: string | null;
  activePagePath?: string | null;
  playground: {
    pageRegistry: unknown;
    creatorData: unknown;
    bindings?: unknown;
    calendars?: unknown;
    popups?: unknown;
  };
}

export type BuilderCommitIdentity = CommitMutationInput['identity'];

export function shouldSkipNoopFilePatch(
  source: PatchSource,
  files: Record<string, string>,
  currentFiles: Record<string, string>,
): boolean {
  if (source === 'preview-toolbar') return false;
  const entries = Object.entries(files);
  return entries.length > 0 && entries.every(([path, content]) => currentFiles[path] === content);
}

/**
 * A commit is only possible when the workspace is bound to a signed-in user,
 * a business and a draft. Returns null instead of throwing so call sites can
 * show their own "this workspace is not connected to a site yet" message.
 */
export function buildCommitIdentity(context: Partial<BuilderCommitContext> | null): BuilderCommitIdentity | null {
  if (!context?.userId || !context.businessId || !context.draftId) return null;
  return {
    userId: context.userId,
    businessId: context.businessId,
    projectId: context.projectId || context.draftId,
    draftId: context.draftId,
    revisionId: context.revisionId || '',
    sessionId: `web-builder:${context.draftId}`,
  };
}

/**
 * Canonical `current` state. Committing with a partial state (missing
 * PlaygroundState in particular) causes recompile drift, so every builder
 * mutation sends the same complete projection.
 */
export function buildCommitCurrent(
  context: Pick<BuilderCommitContext, 'activePagePath' | 'playground'>,
  vfsFiles: Record<string, string>,
  snapshot: SiteBundleSnapshot | null,
): CommitMutationInput['current'] {
  return {
    vfsFiles,
    siteBundleSnapshot: snapshot ?? undefined,
    activePagePath: context.activePagePath ?? undefined,
    playground: {
      pageRegistry: context.playground.pageRegistry,
      creatorData: context.playground.creatorData,
      bindings: context.playground.bindings,
      calendars: context.playground.calendars,
      popups: context.playground.popups,
    } as CommitMutationInput['current']['playground'],
  };
}

/**
 * Pipeline options derived from the snapshot. Builder edits never re-run the
 * launch gates (preview/readiness belong to launch and publish), but they must
 * carry industry and theme identity so the recompile stays in the site's look.
 */
export function buildCommitOptions(snapshot: SiteBundleSnapshot | null): CommitMutationInput['options'] {
  return {
    requirePreviewPass: false,
    requireReadinessPass: false,
    industry: snapshot?.industry,
    themePresetId: snapshot?.meta?.themePresetId ?? undefined,
    themeTokens: snapshot?.themeTokens,
  };
}

/** Full canonical envelope for one builder mutation. */
export function buildCommitInput(args: {
  source: CommitMutationInput['source'];
  identity: BuilderCommitIdentity;
  context: Pick<BuilderCommitContext, 'activePagePath' | 'playground'>;
  vfsFiles: Record<string, string>;
  snapshot: SiteBundleSnapshot | null;
  patch: CommitMutationInput['patch'];
}): CommitMutationInput {
  return {
    source: args.source,
    identity: args.identity,
    current: buildCommitCurrent(args.context, args.vfsFiles, args.snapshot),
    patch: args.patch,
    options: buildCommitOptions(args.snapshot),
  };
}

/**
 * Selecting the variant a section already uses is a no-op, not a revision.
 * Dropping redundant ops here keeps the ledger free of empty commits.
 */
export function filterRedundantPresentationOps(
  snapshot: SiteBundleSnapshot | null,
  ops: PresentationOp[],
): PresentationOp[] {
  const activeVariants = snapshot?.meta?.designIntervention?.activeVariants ?? {};
  return ops.filter((op) => op.type !== 'setVariant' || activeVariants[op.sectionId] !== op.variantId);
}

/**
 * Adoption record for an accepted commit. Carrying vfsHash + revisionId is what
 * distinguishes an accepted canonical revision from an unexplained direct write
 * in the mutation ledger.
 */
export function commitAdoptionRecord(commit: CommitMutationResult): {
  source: string;
  vfsHash: string | null;
  revisionId: string | null;
} {
  return {
    source: commit.source,
    vfsHash: commit.vfsHash ?? null,
    revisionId: commit.persistedRevisionId ?? null,
  };
}
