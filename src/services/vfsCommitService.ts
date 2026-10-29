import { emitAgentEvent } from '@/services/agent-runtime/agentEvents';
import { updateResolvedCompositionVariants } from '@/sections/compositionToFileSet';
import { newEditorCorrelationId, recordMutationEvent } from '@/services/editor/editorTelemetry';
import { isCustomizerPageEdit } from '@/services/builder/customizerDraft';
import {
  normalizeAuthoredPath,
  restoreAuthoredSource,
  verifyAuthoredSourcePreservation,
  type AuthoredSourceOperation,
} from '@/services/builder/authoredSourcePreservation';
/**
 * VFSCommitService — the SINGLE legal writer of Web Builder state.
 *
 * Every mutation source (System Launcher, AI Builder, Playground edit,
 * layout/binding fast paths, GHL binding, theme change, republish, restore)
 * MUST funnel through `commitMutation`. The service:
 *
 *   1. Asserts BuilderIdentity (no templateId-as-projectId aliasing).
 *   2. Validates / normalises the PatchPlan.
 *   3. Applies fileOps to the working VFS.
 *   4. Recompiles through the canonical pipeline (commitToPipeline) so the
 *      SiteBundleSnapshot, runtime manifest, intent bindings, and router
 *      are all regenerated together.
 *   5. Runs full preflight + readiness.
 *   6. On failure: runs auto-repair ONCE, then either re-commits or hard
 *      rejects (per the user-approved failure policy "Auto-repair, then
 *      hard reject").
 *   7. Persists a row in `site_revisions` (status = committed | rejected)
 *      so the durable revision chain — not sessionStorage — becomes the
 *      contract that ties launcher → builder → AI panel → publish.
 *
 * See: mem://architecture/site-os/vfs-commit-service
 */

import { prepareThemeEdit, prepareThemeCorrection } from '@/services/theme/themeEdit';
import { supabase } from '@/integrations/supabase/client';
import {
  commitToPipeline,
  type CommitInput as CanonicalCommitInput,
  type CommitResult as CanonicalCommitResult,
  type CommitSource as CanonicalCommitSource,
} from '@/platform/core/commitToPipeline';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import { restampSealedSourceAuthority } from '@/platform/core/snapshotSeal';
import { collectResolvedCompositions, compilerOwnershipHash, resolvedCompositionPathFor, serializeResolvedComposition, RESOLVED_COMPOSITION_ROOT } from '@/platform/core/resolvedComposition';
import type { RuntimeManifest } from '@/platform/core/runtimeManifest';
import type { PlaygroundState } from '@/platform/core/playground';
import type { CompiledContract } from '@/platform/core/contractCompiler';
import type { ThemeTokens } from '@/sections/types';
import { PreviewGate, PublishGate, type GateVerdict } from '@/platform/core/gates';
import { runFullPreflight } from '@/services/runFullPreflight';
import {
  findUnresolvedLocalImports,
  findLocalJsxImportContractViolations,
  describeUnresolvedImports,
} from '@/services/laneBCompanionModules';
import {
  buildSiteShellTopology,
  assertSiteShellClosure,
} from '@/services/siteShellTopology';
import { resolveApprovedExperienceCapabilities } from './experienceCapabilityResolver';
import { runExperiencePreflight } from './experiencePreflightGate';
import { resolvePlaygroundControlPlane } from '@/services/playgroundControlPlaneResolver';
import { evaluateElementReadiness, type ElementReadinessReport } from '@/services/elementReadinessEvaluator';
import { executeBackendOps, type BackendOpExecutionReport } from '@/services/backendOpExecutor';
import { executeDataOps, type DataOpExecutionReport, type DataOpExecutionResult } from '@/services/dataOpExecutor';
import type { GeneratedSiteRuntimeManifest } from '@/services/generatedSiteRuntimeManifest';
import {
  buildCanonicalLaunchArtifacts,
  type CanonicalLaunchArtifacts,
} from '@/services/canonicalLaunchVfs';
import type { PlaygroundControlPlaneModel } from '@/types/playground';
import {
  CAPABILITY_REGISTRY,
  type BusinessSystemState,
  type CapabilityId,
} from '@/platform/core/capabilityRegistry';
import {
  assertBuilderIdentity,
  type BuilderIdentity,
} from '@/types/builderIdentity';
import {
  assertPatchPlan,
  emptyPatchPlan,
  type PatchPlan,
  type PatchSource,
  type PresentationOp,
} from '@/types/patchPlan';
import { applySemanticPresentationOps } from '@/services/builder/semanticPresentationOps';
import { applyWizardBindingsToVfs } from '@/services/wizardBindingBridge';
import {
  applyBindingOperations,
  stripUnboundBindingAttributes,
} from '@/services/bindingOperationExecutor';
import { verifyBindingProjection } from '@/services/semanticVerification';
import { enforceSiteDesignContract } from '@/services/launch/homepageFirstContract';
import { recordCommitOutcome } from '@/services/mutationLedger';
import {
  buildFileProvenance,
  stampAcceptedRevision,
  type FileProvenanceMap,
} from '@/services/fileProvenance';
import { generateUUID } from '@/utils/uuid';
import { projectEffectiveComposition } from '@/services/effectiveCompositionProjector';
import { assessEffectiveCompositionAuthority, type EffectiveCompositionAuthority } from '@/services/effectiveCompositionAuthority';
import { applyTopologyChange, syncTopologyAndRouter } from '@/services/pageTopologyOrchestrator';
import { deriveFilePath } from '@/services/routeNavigationService';
import {
  assertCreativeAuthority,
  authorityAfterAcceptedCommit,
  deriveAuthorshipAuthority,
  stampSnapshotAuthority,
} from '@/services/authorshipAuthority';
import { canDirectlyAuthorVfsPath, classifyVfsProtection } from '@/services/vfsProtectionMatrix';
import { PROJECT_MEDIA_MANIFEST, syncProjectMedia } from '@/services/assets/projectMedia';




// ----------------------------------------------------------------------------
// Public surface
// ----------------------------------------------------------------------------

export interface CommitMutationInput {
  source: PatchSource;
  identity: BuilderIdentity;
  current: {
    vfsFiles: Record<string, string>;
    playground?: PlaygroundState;
    siteBundleSnapshot?: unknown;
    activePagePath?: string;
  };
  patch: PatchPlan;
  options?: {
    requirePreviewPass?: boolean;
    requireReadinessPass?: boolean;
    /** When true, do NOT persist a revision row (dry-run validation). */
    dryRun?: boolean;
    /** Restricted serialized section edits from the customizer. */
    customizerPagePath?: string;
    /** Compiler-owned, presentation-only scratch upgrade. Never executes backend ops. */
    compositionUpgrade?: boolean;
    /** Restore validates the historical artifact without rebuilding template content. */
    restoreRevisionId?: string;
    /** Persist an exact, validated scratch composition against its original revision. */
    reviewedComposition?: {
      baseVfsHash: string;
      candidate: CommitMutationResult;
    };
    /** Optional pre-compiled contract for gate evaluation. */
    compiledContract?: CompiledContract;
    /** Hints carried through the canonical pipeline. */
    businessName?: string;
    industry?: string;
    selectedTemplateId?: string;
    selectedThemeId?: string;
    themePresetId?: string;
    /** Exact Stage 4b token payload from the original wizard selection. */
    themeTokens?: ThemeTokens;
    /** For wizard-launch source. */
    selections?: CanonicalCommitInput['selections'];
    /** Explicit user-requested regeneration/reset after launch handoff. */
    explicitAuthorityReset?: boolean;
    /** Exact Wizard artifact already approved by the user. */
    reviewedArtifact?: {
      siteBundleSnapshot: SiteBundleSnapshot;
      runtimeManifest: RuntimeManifest;
      playground?: PlaygroundState;
    };
  };
}

export type CommitRejectionCode =
  | 'PROTECTED_INFRASTRUCTURE'
  | 'CREATIVE_AUTHORITY_NOT_HANDED_OFF'
  | 'STALE_REVISION'
  | 'STALE_NODE_TARGET'
  | 'SCOPE_ESCAPE'
  | 'LOCKED_INTENT_OR_DATA_FIELD'
  | 'COMPOSITION_PROVENANCE_MISMATCH'
  | 'SOURCE_PROJECTION_REWRITE'
  | 'INVALID_JSX_OR_IMPORT'
  | 'RUNTIME_PREVIEW_ERROR'
  | 'MISSING_CAPABILITY_OR_PERMISSION'
  | 'ASSET_IDENTITY_INVALID'
  | 'IDENTITY_MISMATCH';

class CommitGuardError extends Error {
  constructor(
    public readonly code: CommitRejectionCode,
    public readonly stage: string,
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'CommitGuardError';
  }
}

export interface CommitDiagnostic {
  stage: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  detail?: unknown;
  code?: CommitRejectionCode;
  correlation?: {
    mutationId: string;
    candidateId: string | null;
    operationIds: string[];
    pageIds: string[];
    targetIds: string[];
    baseRevisionId: string | null;
    expectedVfsHash: string;
    affectedPaths: string[];
  };
}

export interface CommitMutationResult {
  status: 'committed' | 'rejected';
  source: PatchSource;
  identity: BuilderIdentity;
  vfsFiles: Record<string, string>;
  siteBundleSnapshot: SiteBundleSnapshot | null;
  runtimeManifest: RuntimeManifest | null;
  playground: PlaygroundState | null;
  readinessReport: Record<string, unknown>;
  diagnostics: CommitDiagnostic[];
  persistedRevisionId: string | null;
  parentRevisionId: string | null;
  committedAt: string;
  /** Move D — true iff PublishGate + element + intent + backend ops all pass. */
  publishReady: boolean;
  /** Aggregated, user-facing reasons publish is blocked. */
  publishBlockers: PublishBlockerSummary[];
  /** SHA-256 hex of the canonical file map at commit time (drift detection). */
  vfsHash: string;
  candidateId: string | null;
  operationIds: string[];
  /** Registry-scoped data mutations acknowledged by this revision. */
  dataOpsApplied: DataOpExecutionResult[];
  fileProvenance: FileProvenanceMap;
}

export interface PublishBlockerSummary {
  source: 'publishGate' | 'intentReadiness' | 'elementReadiness' | 'backendOps' | 'preview';
  code: string;
  message: string;
  meta?: Record<string, unknown>;
}

export class CommitRejectedError extends Error {
  constructor(
    message: string,
    public readonly result: CommitMutationResult,
  ) {
    super(`[VFSCommitService] ${message}`);
    this.name = 'CommitRejectedError';
  }
}

const DRAFT_COMMIT_TAILS = new Map<string, Promise<void>>();
const LATEST_QUEUED_COMMITS = new Map<string, CommitMutationResult>();

/** Compare domain values without depending on object insertion order. */
function queueDomainValue(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
  }) ?? 'undefined';
}

export function rebaseQueuedCommit(
  input: CommitMutationInput,
  latest: CommitMutationResult,
): { input: CommitMutationInput } | { coalesced: CommitMutationResult } {
  const patch = input.patch;
  // Candidate metadata is provenance, not a structured side effect. File-only
  // AI patches use the same exact-byte overlap check as direct editor saves.
  if (patch.candidate && (patch.candidate.baseRevisionId ?? '') !== (input.identity.revisionId || '')) {
    throw new CommitGuardError(
      'STALE_REVISION',
      'queue-rebase',
      '[VFSCommitService] AI candidate does not match its captured base revision. Reapply it to the latest version.',
      { candidateBaseRevisionId: patch.candidate.baseRevisionId ?? null },
    );
  }
  if (latest.identity.projectId !== input.identity.projectId
    || latest.identity.businessId !== input.identity.businessId
    || latest.identity.draftId !== input.identity.draftId
    || latest.identity.userId !== input.identity.userId) {
    throw new CommitGuardError(
      'IDENTITY_MISMATCH',
      'queue-rebase',
      '[VFSCommitService] The queued save belongs to a different project or account. Nothing was overwritten.',
      { queuedProjectId: latest.identity.projectId, inputProjectId: input.identity.projectId },
    );
  }
  const baseFiles = input.current.vfsFiles;
  const latestFiles = latest.vfsFiles;
  const baseSnapshot = input.current.siteBundleSnapshot as SiteBundleSnapshot | undefined;
  const snapshot = latest.siteBundleSnapshot;
  const domainConflicts: string[] = [];
  const checkDomain = (label: string, before: unknown, after: unknown) => {
    if (queueDomainValue(before) !== queueDomainValue(after)) domainConflicts.push(label);
  };
  // Re-run typed edits against the latest state only when their dependencies
  // are unchanged. A newer content save is not a topology/theme/binding edit.
  if (patch.routeOps?.length) {
    if (!input.current.playground?.pageRegistry || !latest.playground?.pageRegistry
      || !baseSnapshot?.pageRegistry || !snapshot?.pageRegistry) {
      domainConflicts.push('page topology (missing captured registry)');
    } else {
      const { version: _baseVersion, ...baseRegistry } = input.current.playground.pageRegistry;
      const { version: _latestVersion, ...latestRegistry } = latest.playground.pageRegistry;
      checkDomain('page topology', baseRegistry, latestRegistry);
      for (const op of patch.routeOps) {
        const page = op.pageId ? baseRegistry.pages[op.pageId] : undefined;
        if (page && (op.type === 'remove_page' || op.type === 'rename_page')) {
          const path = page.filePath || deriveFilePath(page);
          checkDomain(path, baseFiles[path], latestFiles[path]);
        }
      }
    }
  }
  if (patch.themeEdit) {
    if (!baseSnapshot || !snapshot) domainConflicts.push('theme (missing captured snapshot)');
    checkDomain('theme CSS', baseFiles['/src/index.css'], latestFiles['/src/index.css']);
    checkDomain('theme tokens', baseSnapshot?.themeTokens, snapshot?.themeTokens);
    checkDomain('theme selection', baseSnapshot?.meta?.themePresetId, snapshot?.meta?.themePresetId);
    checkDomain('theme overrides', baseFiles['/.unison/theme-overrides.json'], latestFiles['/.unison/theme-overrides.json']);
  }
  if (patch.presentationOps.length || input.options?.customizerPagePath) {
    if (!baseSnapshot?.meta?.designIntervention || !snapshot?.meta?.designIntervention) {
      domainConflicts.push('composition (missing captured design)');
    }
    checkDomain('composition', baseSnapshot?.meta?.designIntervention, snapshot?.meta?.designIntervention);
    checkDomain('page topology', baseSnapshot?.pageRegistry, snapshot?.pageRegistry);
    // A presentation projection can touch the rendered page, unlike token edits.
    if (input.options?.customizerPagePath || patch.presentationOps.some(op => op.type !== 'setMotionBudget')) {
      checkDomain('composition source', baseFiles, latestFiles);
    }
  }
  if (patch.bindingOps.length) {
    if (!input.current.playground || !latest.playground) domainConflicts.push('bindings (missing captured state)');
    checkDomain('bindings', input.current.playground?.bindings, latest.playground?.bindings);
    // Binding projection can rewrite rendered markers; retain its source baseline.
    checkDomain('binding source', baseFiles, latestFiles);
  }
  if (patch.playgroundOps.length || patch.dataOps.length || patch.backendOps.length || patch.businessSystem) {
    checkDomain('operation source', baseFiles, latestFiles);
    checkDomain('operation state', input.current.playground, latest.playground);
    checkDomain('business capabilities', baseSnapshot?.businessSystem, snapshot?.businessSystem);
  }
  if (input.source === 'wizard-launch' || input.source === 'system-restore'
    || input.options?.compositionUpgrade || input.options?.restoreRevisionId
    || input.options?.reviewedComposition || input.options?.reviewedArtifact) {
    domainConflicts.push('reviewed launch or restore');
  }
  if (domainConflicts.length) {
    throw new CommitGuardError(
      'STALE_REVISION',
      'queue-rebase',
      `[VFSCommitService] This edit overlaps a newer saved revision in ${[...new Set(domainConflicts)].join(', ')}. Nothing was overwritten. Reapply on the latest version.`,
      { conflicts: [...new Set(domainConflicts)] },
    );
  }
  const hasStructuredOperations = Boolean(patch.themeEdit || patch.routeOps?.length
    || patch.playgroundOps.length || patch.bindingOps.length || patch.dataOps.length
    || patch.backendOps.length || patch.presentationOps.length || patch.businessSystem
    || input.options?.customizerPagePath);
  const fileOps: PatchPlan['fileOps'] = [];
  const conflicts: string[] = [];
  for (const op of patch.fileOps) {
    const hadBase = Object.prototype.hasOwnProperty.call(baseFiles, op.path);
    const hasLatest = Object.prototype.hasOwnProperty.call(latestFiles, op.path);
    if (op.type === 'delete') {
      if (!hadBase || !hasLatest) continue;
      if (latestFiles[op.path] !== baseFiles[op.path]) conflicts.push(op.path);
      else fileOps.push(op);
      continue;
    }

    if (hadBase && baseFiles[op.path] === op.contents) continue;
    if (hasLatest && latestFiles[op.path] === op.contents) continue;
    const latestStillMatchesBase = hadBase
      ? hasLatest && latestFiles[op.path] === baseFiles[op.path]
      : !hasLatest;
    if (!latestStillMatchesBase) conflicts.push(op.path);
    else fileOps.push(op);
  }

  if (conflicts.length > 0) {
    throw new CommitGuardError(
      'STALE_REVISION',
      'queue-rebase',
      `[VFSCommitService] This edit overlaps a newer saved revision at ${[...new Set(conflicts)].join(', ')}. Reload and reapply the change.`,
      { conflicts: [...new Set(conflicts)] },
    );
  }
  if (!hasStructuredOperations && fileOps.length === 0 && (!patch.candidate || (
    latest.candidateId === patch.candidate.id
    && (patch.operationIds ?? []).every((id) => latest.operationIds.includes(id))
  ))) {
    return {
      coalesced: {
        ...latest,
        source: input.source,
        diagnostics: [...latest.diagnostics, {
          stage: 'queue', level: 'info', message: 'identical file changes already exist in the latest accepted revision',
        }],
      },
    };
  }

  return {
    input: {
      ...input,
      identity: { ...input.identity, revisionId: latest.persistedRevisionId ?? '' },
      current: {
        ...input.current,
        vfsFiles: latestFiles,
        siteBundleSnapshot: snapshot ?? input.current.siteBundleSnapshot,
        playground: latest.playground ?? input.current.playground,
      },
      patch: {
        ...patch,
        fileOps,
        candidate: patch.candidate ? {
          ...patch.candidate,
          baseRevisionId: latest.persistedRevisionId ?? undefined,
        } : undefined,
      },
      options: {
        ...input.options,
        industry: snapshot?.industry ?? input.options?.industry,
        selectedTemplateId: snapshot?.meta?.templateId ?? input.options?.selectedTemplateId,
        selectedThemeId: snapshot?.meta?.themePresetId ?? input.options?.selectedThemeId,
        themePresetId: snapshot?.meta?.themePresetId ?? input.options?.themePresetId,
        themeTokens: snapshot?.themeTokens ?? input.options?.themeTokens,
      },
    },
  };
}

// ----------------------------------------------------------------------------
// Guard 1 — Preview artifact leakage
// ----------------------------------------------------------------------------
//
// `sandpackFilePrep.ts` (the ephemeral VFS → Sandpack preview compiler)
// rewrites `import { MapPin } from 'lucide-react'` into namespace lookups
// like `const MapPin = __LucideIcons['MapPin'] || __LucideFallback;` for
// preview-runtime safety. That transformed source must never become
// canonical VFS content — if it does, a later preview preparation pass can
// reintroduce the original named import (e.g. via a catalog binding
// regenerating a section from a template) and produce a duplicate top-level
// declaration.
//
// Rollout policy (per architecture review): Phase 1 detects + logs + heals
// known Lucide preview artifacts back to plain imports rather than hard
// rejecting the commit, so in-flight projects aren't interrupted. A future
// Phase 2 can upgrade this to a hard rejection once callers are audited.
const PREVIEW_ONLY_ARTIFACT_PATTERNS: RegExp[] = [
  /\b__LucideIcons\b/,
  /\b__LucideFallback\b/,
  /\b__FramerMotion\b/,
  /\b__motionFallback\b/,
  /\b__AnimatePresenceFallback\b/,
];

function compilerOwnedGeneratedPaths(files: Record<string, string>): Set<string> {
  const owned = new Set<string>();
  for (const composition of Object.values(collectResolvedCompositions(files))) {
    for (const [rawPath, fingerprint] of Object.entries(composition.compilerOwnership ?? {})) {
      const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
      const source = files[path] ?? files[rawPath];
      if (typeof source === 'string' && compilerOwnershipHash(source) === fingerprint) owned.add(path);
    }
  }
  return owned;
}

function sealedCompilerOwnedPaths(snapshot: SiteBundleSnapshot | null | undefined): Set<string> {
  if (!snapshot?.meta?.seal?.registeredPageBodyAuthority) return new Set();
  return new Set([
    ...(snapshot.meta.seal.protectedFilePatterns ?? []),
    ...(snapshot.meta.seal.laneAProtectedFiles ?? []),
    ...(snapshot.meta.seal.registeredPageFiles ?? []),
    ...Object.values(snapshot.pageRegistry?.pages ?? {})
      .map((page) => page.filePath)
      .filter((path): path is string => Boolean(path)),
    snapshot.routerFile?.path ?? '/src/App.tsx',
  ].map((path) => path.startsWith('/') ? path : `/${path}`));
}

function isProtectedPath(path: string, protectedPaths: Set<string>): boolean {
  for (const protectedPath of protectedPaths) {
    if (protectedPath.endsWith('/**')) {
      if (path.startsWith(protectedPath.slice(0, -2))) return true;
      continue;
    }
    if (path === protectedPath) return true;
  }
  return false;
}

function sourceOperationsBetween(
  accepted: Record<string, string>,
  candidate: Record<string, string>,
): AuthoredSourceOperation[] {
  const operations: AuthoredSourceOperation[] = [];
  for (const path of [...new Set([...Object.keys(accepted), ...Object.keys(candidate)])].sort()) {
    if (!(path in candidate)) operations.push({ type: 'delete', path });
    else if (!(path in accepted)) operations.push({ type: 'create', path, contents: candidate[path] });
    else if (accepted[path] !== candidate[path]) operations.push({ type: 'replace', path, contents: candidate[path] });
  }
  return operations;
}

function assertCandidateSourcePreserved(
  accepted: Record<string, string>,
  operations: readonly AuthoredSourceOperation[],
  actual: Record<string, string>,
  stage: string,
): void {
  const compilerOwned = [
    '/.unison/**', '/src/unison/**', '/src/integrations/**',
    ...compilerOwnedGeneratedPaths(actual),
  ];
  const violations = verifyAuthoredSourcePreservation({
    acceptedFiles: accepted, operations, finalizedFiles: actual,
    compilerOwnedPaths: compilerOwned, stage,
  });
  if (violations.length) {
    throw new CommitGuardError(
      'SOURCE_PROJECTION_REWRITE',
      stage,
      `[VFSCommitService] ${stage} changed source outside the explicit candidate: ${violations.map((item) => `${item.path} (${item.kind})`).join(', ')}. Generate an explicit follow-up candidate.`,
      violations,
    );
  }
}

function refreshEditedCompositionOwnership(
  beforeFiles: Record<string, string>,
  afterFiles: Record<string, string>,
): void {
  for (const composition of Object.values(collectResolvedCompositions(afterFiles))) {
    const pagePath = composition.pageFilePath.startsWith('/')
      ? composition.pageFilePath
      : `/${composition.pageFilePath}`;
    const nextSource = afterFiles[pagePath];
    if (!nextSource || nextSource === beforeFiles[pagePath]) continue;
    const descriptorPath = resolvedCompositionPathFor(pagePath);
    afterFiles[descriptorPath] = serializeResolvedComposition({
      ...composition,
      compilerOwnership: {
        ...(composition.compilerOwnership ?? {}),
        [pagePath]: compilerOwnershipHash(nextSource),
      },
    });
  }
}

function detectPreviewArtifacts(contents: string): string[] {
  const hits: string[] = [];
  for (const pattern of PREVIEW_ONLY_ARTIFACT_PATTERNS) {
    if (pattern.test(contents)) hits.push(pattern.source);
  }
  return hits;
}

/**
 * Heal known preview-only Lucide fallback declarations back into a plain
 * `import { ... } from 'lucide-react'` statement. Non-Lucide preview
 * artifacts (framer-motion fallbacks, etc.) are left untouched — they are
 * only detected/logged in Phase 1, since a safe general rewrite isn't
 * available for every fallback shape yet.
 */
function sanitizePreviewArtifacts(contents: string): string {
  const recoveredIcons: string[] = [];
  let sanitized = contents.replace(
    /^const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:__LucideIcons\[[^\]]+\]\s*\|\|\s*)+__LucideFallback;\s*$/gm,
    (_match, alias: string) => {
      recoveredIcons.push(alias);
      return '';
    },
  );

  if (recoveredIcons.length === 0) return contents;

  sanitized = sanitized.replace(/^import \* as __LucideIcons from ['"]lucide-react['"];?\s*$/gm, '');
  sanitized = sanitized.replace(/^const __LucideFallback\s*=.*$/gm, '');
  sanitized = `import { ${recoveredIcons.join(', ')} } from 'lucide-react';\n${sanitized.replace(/^\n+/, '')}`;
  return sanitized.replace(/\n{3,}/g, '\n\n');
}

// ----------------------------------------------------------------------------
// commitMutation — the only legal writer
// ----------------------------------------------------------------------------

/**
 * Automated repair/sync saves may not overwrite a committed AI Builder change
 * they never saw: if the newest committed revision for this draft is an
 * AI Builder save and the caller's base revision is older, the save is refused.
 * User-driven sources (AI, toolbar, theme, playground, restore) are unaffected.
 */
const AUTOMATED_SYNC_SOURCES = new Set<PatchSource>(['binding-fast-path', 'ghl-binding', 'republish']);
async function assertNoStaleOverwriteOfAiRevision(input: CommitMutationInput): Promise<void> {
  if (!AUTOMATED_SYNC_SOURCES.has(input.source) || !input.identity.draftId) return;
  let latest: { id: string; source: string } | null = null;
  try {
    const { data } = await supabase
      .from('site_revisions')
      .select('id, source')
      .eq('draft_id', input.identity.draftId)
      .eq('status', 'committed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    latest = (data as { id: string; source: string } | null) ?? null;
  } catch {
    return; // lookup failure never blocks a save
  }
  if (latest && latest.source === 'ai-builder' && latest.id !== (input.identity.revisionId || null)) {
    throw new CommitGuardError(
      'STALE_REVISION',
      'revision-base',
      '[VFSCommitService] An automatic update was based on an older version and would overwrite a saved AI change. It was skipped; reload to use the latest version.',
      { latestRevisionId: latest.id, latestSource: latest.source },
    );
  }
}

export async function commitMutation(
  input: CommitMutationInput,
): Promise<CommitMutationResult> {
  // M0 telemetry: one mutation event per commit with base → result revision.
  const correlationId = newEditorCorrelationId();
  const startedAt = Date.now();
  try {
    // Coalescing must never bypass the same identity/shape checks as a write.
    try {
      assertBuilderIdentity(input.identity, 'commitMutation');
    } catch (error) {
      throw new CommitGuardError(
        'IDENTITY_MISMATCH',
        'identity',
        error instanceof Error ? error.message : String(error),
        error,
      );
    }
    assertPatchPlan(input.patch, 'commitMutation');
    let result: CommitMutationResult;
    if (input.options?.dryRun) {
      result = await commitMutationInner(input, correlationId);
    } else {
      const queueKey = input.identity.draftId || input.identity.projectId || 'anonymous';
      const previousTail = DRAFT_COMMIT_TAILS.get(queueKey) ?? Promise.resolve();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const tail = previousTail.catch(() => undefined).then(() => gate);
      DRAFT_COMMIT_TAILS.set(queueKey, tail);
      await previousTail.catch(() => undefined);
      try {
        const latest = LATEST_QUEUED_COMMITS.get(queueKey);
        const preparation = latest?.persistedRevisionId
          && latest.persistedRevisionId !== (input.identity.revisionId || '')
          ? rebaseQueuedCommit(input, latest)
          : { input };
        result = 'coalesced' in preparation
          ? preparation.coalesced
          : await commitMutationInner(preparation.input, correlationId);
        if (result.status === 'committed' && result.persistedRevisionId) {
          LATEST_QUEUED_COMMITS.set(queueKey, result);
        }
      } finally {
        release();
        if (DRAFT_COMMIT_TAILS.get(queueKey) === tail) DRAFT_COMMIT_TAILS.delete(queueKey);
      }
    }
    recordMutationEvent({
      correlationId,
      at: Date.now(),
      kind: 'commit',
      surface: input.source,
      baseRevisionId: input.identity.revisionId || null,
      resultRevisionId: result.persistedRevisionId,
      ok: result.status === 'committed',
      error: result.status === 'committed' ? undefined : 'rejected',
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (err) {
    const rejection = err instanceof CommitGuardError ? err : null;
    let rejectionTelemetry: NonNullable<Parameters<typeof recordMutationEvent>[0]['rejection']> | undefined;
    if (rejection) {
      let expectedVfsHash: string | null = null;
      try {
        expectedVfsHash = await hashVfsFiles(input.current.vfsFiles);
      } catch {
        // The refusal remains observable even if hashing the captured base fails.
      }
      rejectionTelemetry = {
        code: rejection.code,
        stage: rejection.stage,
        candidateId: input.patch.candidate?.id ?? null,
        operationIds: input.patch.operationIds ?? [],
        pageIds: [...new Set([
          ...(input.patch.candidate?.targetPages ?? []),
          ...input.patch.playgroundOps.flatMap((operation) => operation.pageId ? [operation.pageId] : []),
          ...(input.patch.routeOps ?? []).flatMap((operation) => 'pageId' in operation ? [operation.pageId] : []),
        ])],
        targetIds: [...new Set([
          ...input.patch.bindingOps.map((operation) => operation.elementId),
          ...input.patch.playgroundOps.flatMap((operation) => operation.sectionId ? [operation.sectionId] : []),
          ...input.patch.presentationOps.flatMap((operation) => 'sectionId' in operation ? [operation.sectionId] : []),
        ])],
        expectedVfsHash,
        affectedPaths: [...new Set(input.patch.fileOps.map((operation) => normalizeAuthoredPath(operation.path)))],
        attemptedOperations: input.patch.fileOps.map((operation) => ({ path: normalizeAuthoredPath(operation.path), type: operation.type })),
        expectedOwners: [...new Set(input.patch.fileOps.map((operation) => normalizeAuthoredPath(operation.path)))]
          .map((path) => ({ path, owner: classifyVfsProtection({ path }).classification })),
        reason: rejection.message,
        detail: rejection.detail,
      };
    }
    recordMutationEvent({
      correlationId,
      at: Date.now(),
      kind: 'commit',
      surface: input.source,
      baseRevisionId: input.identity.revisionId || null,
      resultRevisionId: null,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startedAt,
      ...(rejectionTelemetry ? { rejection: rejectionTelemetry } : {}),
    });
    throw err;
  }
}

async function commitMutationInner(
  input: CommitMutationInput,
  mutationId: string,
): Promise<CommitMutationResult> {
  const diagnostics: CommitDiagnostic[] = [];
  const expectedVfsHash = await hashVfsFiles(input.current.vfsFiles);
  const candidateId = input.patch.candidate?.id ?? null;
  const correlation = {
    mutationId,
    candidateId,
    operationIds: input.patch.operationIds ?? [],
    pageIds: [...new Set([
      ...(input.patch.candidate?.targetPages ?? []),
      ...input.patch.playgroundOps.flatMap((operation) => operation.pageId ? [operation.pageId] : []),
      ...(input.patch.routeOps ?? []).flatMap((operation) => 'pageId' in operation ? [operation.pageId] : []),
    ])],
    targetIds: [...new Set([
      ...input.patch.bindingOps.map((operation) => operation.elementId),
      ...input.patch.playgroundOps.flatMap((operation) => operation.sectionId ? [operation.sectionId] : []),
      ...input.patch.presentationOps.flatMap((operation) => 'sectionId' in operation ? [operation.sectionId] : []),
    ])],
    baseRevisionId: input.identity.revisionId || null,
    expectedVfsHash,
    affectedPaths: [...new Set(input.patch.fileOps.map((operation) => normalizeAuthoredPath(operation.path)))],
  };
  const log = (
    stage: string,
    level: CommitDiagnostic['level'],
    message: string,
    detail?: unknown,
    code?: CommitRejectionCode,
  ) => diagnostics.push({ stage, level, message, detail, correlation, ...(code ? { code } : {}) });

  // 1. Identity assertion ----------------------------------------------------
  assertBuilderIdentity(input.identity, 'commitMutation');
  const restoredRevision = input.options?.restoreRevisionId ? await loadRevision(input.options.restoreRevisionId) : null;
  if (input.options?.restoreRevisionId && (input.source !== 'system-restore' || !restoredRevision
    || restoredRevision.status !== 'committed' || restoredRevision.projectId !== input.identity.projectId
    || restoredRevision.businessId !== input.identity.businessId)) {
    throw new Error('[VFSCommitService] Restore requires a committed revision belonging to this project.');
  }
  await assertNoStaleOverwriteOfAiRevision(input);
  const reviewedComposition = input.options?.reviewedComposition;
  if ([input.options?.reviewedArtifact, reviewedComposition, input.options?.compositionUpgrade, input.options?.restoreRevisionId].filter(Boolean).length > 1) {
    throw new CommitGuardError('SCOPE_ESCAPE', 'reviewed-operation-scope', '[VFSCommitService] Reviewed artifacts, upgrades and restores must be isolated operations.');
  }
  if (reviewedComposition) {
    const candidate = reviewedComposition.candidate;
    if (candidate.identity.projectId !== input.identity.projectId
      || candidate.identity.businessId !== input.identity.businessId
      || candidate.identity.userId !== input.identity.userId
      || candidate.identity.draftId !== input.identity.draftId) {
      throw new CommitGuardError('IDENTITY_MISMATCH', 'composition-review', '[VFSCommitService] Composition review does not belong to this project or account.', {
        candidateIdentity: candidate.identity,
      });
    }
    if (input.source !== 'playground-edit' || input.patch.backendOps.length > 0 || input.patch.fileOps.length > 0
      || input.patch.presentationOps.length > 0 || input.patch.playgroundOps.length > 0
      || input.patch.bindingOps.length > 0 || input.patch.routeOps?.length || input.patch.businessSystem) {
      throw new CommitGuardError('SCOPE_ESCAPE', 'composition-review', '[VFSCommitService] Composition review must be committed without additional operations. Generate a fresh preview.', {
        source: input.source,
      });
    }
    if (candidate.status !== 'committed' || candidate.persistedRevisionId
      || !candidate.siteBundleSnapshot || !candidate.runtimeManifest
      || candidate.parentRevisionId !== (input.identity.revisionId || null)
      || reviewedComposition.baseVfsHash !== await hashVfsFiles(input.current.vfsFiles)
      || candidate.vfsHash !== await hashVfsFiles(candidate.vfsFiles)) {
      throw new CommitGuardError('COMPOSITION_PROVENANCE_MISMATCH', 'composition-review', '[VFSCommitService] Composition review is stale. Generate a fresh preview.', {
        candidateRevisionId: candidate.parentRevisionId,
        baseRevisionId: input.identity.revisionId || null,
        baseVfsHash: reviewedComposition.baseVfsHash,
        candidateVfsHash: candidate.vfsHash,
      });
    }
  }

  const customizerPagePath = input.options?.customizerPagePath;
  if (customizerPagePath && (input.source !== 'playground-edit'
    || input.patch.routeOps?.length
    || !Object.values((input.current.siteBundleSnapshot as SiteBundleSnapshot | undefined)?.pageRegistry.pages ?? {}).some(page => page.filePath === customizerPagePath)
    || !input.patch.fileOps.some(op => op.type !== 'delete' && op.path === customizerPagePath && isCustomizerPageEdit(input.current.vfsFiles[op.path] ?? '', op.contents, op.path))
    || input.patch.fileOps.some(op => op.type === 'delete' || ![customizerPagePath, customizerPagePath.replace(/\.[^.]+$/, '.customizer.css')].includes(op.path)))) {
    throw new CommitGuardError('SCOPE_ESCAPE', 'customizer-scope', 'Invalid customizer page edit.', {
      customizerPagePath,
      filePaths: input.patch.fileOps.map((operation) => operation.path),
    });
  }

  // 2. Patch normalisation ---------------------------------------------------
  const patch = input.patch ?? emptyPatchPlan();
  assertPatchPlan(patch, 'commitMutation');
  const currentAuthority = deriveAuthorshipAuthority({
    snapshot: input.current.siteBundleSnapshot as SiteBundleSnapshot | null | undefined,
    acceptedRevisionId: input.identity.revisionId,
  });
  try {
    assertCreativeAuthority({
      source: input.source,
      authority: currentAuthority,
      explicitReset: input.options?.explicitAuthorityReset,
    });
  } catch (error) {
    throw new CommitGuardError(
      'CREATIVE_AUTHORITY_NOT_HANDED_OFF',
      'authority',
      error instanceof Error ? error.message : String(error),
      error,
    );
  }
  if (input.source !== 'wizard-launch' && input.source !== 'system-restore') {
    const sealedPaths = input.source === 'theme-change'
      ? new Set<string>()
      : sealedCompilerOwnedPaths(input.current.siteBundleSnapshot as SiteBundleSnapshot | null | undefined);
    const compilerOwnedPaths = compilerOwnedGeneratedPaths(input.current.vfsFiles);
    const registeredPagePaths = Object.values(
      (input.current.siteBundleSnapshot as SiteBundleSnapshot | undefined)?.pageRegistry?.pages ?? {},
    ).map((page) => page.filePath).filter((path): path is string => Boolean(path));
    for (const op of patch.fileOps) {
      const path = op.path.startsWith('/') ? op.path : `/${op.path}`;
      const protection = classifyVfsProtection({
        path,
        registeredPagePaths,
        compilerGeneratedPaths: [...compilerOwnedPaths],
        canonicalRouterActive: registeredPagePaths.length > 0,
      });
      const builderAuthorable = canDirectlyAuthorVfsPath(
        protection,
        input.source,
        currentAuthority.phase === 'builder-authoring',
      );
      if (path === '/src/App.tsx'
        && Object.keys((input.current.siteBundleSnapshot as SiteBundleSnapshot | undefined)?.pageRegistry?.pages ?? {}).length > 0
        && (op.type === 'delete' || op.contents !== input.current.vfsFiles[op.path])) {
        throw new CommitGuardError('PROTECTED_INFRASTRUCTURE', 'file-protection', '[VFSCommitService] Canonical App.tsx is compiler-owned. Use a typed route operation.', { path });
      }
      if (op.path.startsWith(`${RESOLVED_COMPOSITION_ROOT}/`)
        && (op.type === 'delete' || op.contents !== input.current.vfsFiles[op.path])) {
        throw new CommitGuardError('PROTECTED_INFRASTRUCTURE', 'file-protection', '[VFSCommitService] Resolved composition metadata is compiler-owned. Use a presentation operation or reviewed upgrade.', { path });
      }
      if (protection.directMutation === 'denied'
        && (op.type === 'delete' || op.contents !== input.current.vfsFiles[op.path])) {
        throw new CommitGuardError(
          'PROTECTED_INFRASTRUCTURE',
          'file-protection',
          `[VFSCommitService] ${protection.classification} path cannot be edited directly. ${protection.rationale}`,
          { path, classification: protection.classification, rationale: protection.rationale },
        );
      }
      if (path !== customizerPagePath
        && compilerOwnedPaths.has(path)
        && !builderAuthorable
        && (op.type === 'delete' || op.contents !== input.current.vfsFiles[op.path])) {
        throw new CommitGuardError('PROTECTED_INFRASTRUCTURE', 'file-protection', '[VFSCommitService] Generated section and recipe modules are compiler-owned. Use a presentation operation or a canonical composition upgrade.', { path });
      }
      if (path !== customizerPagePath && isProtectedPath(path, sealedPaths)
        && !builderAuthorable
        && (op.type === 'delete' || op.contents !== input.current.vfsFiles[op.path])) {
        throw new CommitGuardError('PROTECTED_INFRASTRUCTURE', 'file-protection', '[VFSCommitService] Canonical router and metadata files are compiler-owned. Edit page or section source instead.', { path });
      }
    }
  }

  // 3. Apply fileOps to working VFS -----------------------------------------
  const workingFiles: Record<string, string> = { ...(input.current.vfsFiles ?? {}) };
  for (const op of patch.fileOps) {
    if (op.type === 'delete') {
      delete workingFiles[op.path];
      continue;
    }

    const artifactHits = detectPreviewArtifacts(op.contents);
    if (artifactHits.length > 0) {
      const sanitized = sanitizePreviewArtifacts(op.contents);
      const healed = sanitized !== op.contents;
      log(
        'fileOps',
        'warn',
        `preview-only artifact(s) detected in ${op.path} (${artifactHits.join(', ')})${healed ? ' — sanitized before canonical commit' : ' — left as-is, no known-safe rewrite'}`,
        { path: op.path, artifactHits, healed },
      );
      workingFiles[op.path] = sanitized;
    } else {
      workingFiles[op.path] = op.contents;
    }
  }

  let workingPlayground = input.current.playground;
  let workingSnapshot = input.current.siteBundleSnapshot as SiteBundleSnapshot | null | undefined;
  let bindingOperationResult: ReturnType<typeof applyBindingOperations> | null = null;
  if (patch.bindingOps.length) {
    bindingOperationResult = applyBindingOperations(workingPlayground, patch.bindingOps);
    workingPlayground = bindingOperationResult.playground;
    // An unbind must not leave a formerly stamped DOM action active while the
    // canonical compiler projects the updated binding map.
    Object.assign(workingFiles, stripUnboundBindingAttributes(workingFiles, bindingOperationResult.unboundBindings));
    log('bindingOps', 'info', `applied ${patch.bindingOps.length} canonical binding operation(s)`, {
      boundBindingIds: bindingOperationResult.boundBindingIds,
      unboundBindingIds: bindingOperationResult.unboundBindings.map((binding) => binding.bindingId),
    });
  }
  // Page labels can be edited in the Playground without changing the sealed
  // route topology. Keep that metadata in the snapshot fed to the compiler so
  // regenerated descriptors, tabs, and preview titles do not retain an older
  // label. Structural route changes still require typed route operations.
  if (workingPlayground?.pageRegistry && workingSnapshot?.pageRegistry) {
    const snapshotPages = workingSnapshot.pageRegistry.pages;
    const playgroundPages = workingPlayground.pageRegistry.pages;
    const sameTopology = Object.keys(snapshotPages).length === Object.keys(playgroundPages).length
      && Object.entries(snapshotPages).every(([pageId, page]) => {
        const candidate = playgroundPages[pageId];
        return candidate?.path === page.path && candidate?.filePath === page.filePath;
      });
    if (sameTopology) workingSnapshot = { ...workingSnapshot, pageRegistry: workingPlayground.pageRegistry };
  }
  if (patch.routeOps?.length) {
    if (!workingPlayground?.pageRegistry || !workingSnapshot?.pageRegistry) {
      throw new Error('[VFSCommitService] Typed route operations require canonical Playground and snapshot topology.');
    }
    let registry = workingPlayground.pageRegistry;
    for (const routeOp of patch.routeOps) {
      const result = applyTopologyChange(
        routeOp,
        registry,
        workingFiles,
        input.options?.businessName ?? workingSnapshot.businessName,
      );
      for (const path of result.filesToDelete) delete workingFiles[path];
      Object.assign(workingFiles, result.filesToImport);
      registry = result.updatedRegistry;
    }
    const missingPages = Object.values(registry.pages)
      .map((page) => ({ page, filePath: page.filePath || deriveFilePath(page) }))
      .filter(({ filePath }) => !workingFiles[filePath]);
    if (missingPages.length > 0) {
      throw new Error(
        `[VFSCommitService] Typed route operation is missing page source: ${missingPages.map(({ filePath }) => filePath).join(', ')}.`,
      );
    }
    const finalTopology = syncTopologyAndRouter(
      registry,
      workingFiles,
      input.options?.businessName ?? workingSnapshot.businessName,
    );
    Object.assign(workingFiles, finalTopology.filesToImport);
    if (finalTopology.validation.errors.length > 0
      || finalTopology.validation.issues.some((issue) => issue.code === 'MISSING_ROUTER_ENTRY')) {
      throw new Error(
        `[VFSCommitService] Typed route operation failed topology closure: ${finalTopology.validation.issues.map((issue) => issue.message).join(' | ')}`,
      );
    }
    workingPlayground = { ...workingPlayground, pageRegistry: registry };
    workingSnapshot = { ...workingSnapshot, pageRegistry: registry };
    log('routeOps', 'info', `applied ${patch.routeOps.length} typed route operation(s)`, {
      routes: Object.values(registry.pages).map((page) => ({ pageId: page.pageId, path: page.path, filePath: page.filePath })),
    });
  }

  if (input.options?.compositionUpgrade) {
    if (input.source !== 'playground-edit' || !input.options.dryRun || patch.fileOps.length || patch.backendOps.length
      || patch.presentationOps.length || patch.playgroundOps.length || patch.bindingOps.length || patch.routeOps?.length) {
      throw new Error('[VFSCommitService] Composition upgrades must be isolated compiler-owned dry runs.');
    }
    const { planCompositionUpgrade } = await import('./compositionUpgrade');
    const planned = planCompositionUpgrade(workingFiles, input.current.siteBundleSnapshot as SiteBundleSnapshot);
    Object.assign(workingFiles, planned.files);
  }
  if (customizerPagePath) refreshEditedCompositionOwnership(input.current.vfsFiles, workingFiles);
  log('fileOps', 'info', `applied ${patch.fileOps.length} file op(s)`);

  // 4. Apply snapshot-owned presentation operations -------------------------
  if (patch.themeEdit && (input.source !== 'theme-change' || patch.fileOps.length || patch.playgroundOps.length || patch.presentationOps.length || patch.bindingOps.length || patch.routeOps?.length || patch.backendOps.length || patch.businessSystem || input.options?.restoreRevisionId || input.options?.reviewedArtifact || reviewedComposition)) {
    throw new CommitGuardError('SCOPE_ESCAPE', 'theme-scope', 'Theme edits must be isolated from content, composition and backend changes.', {
      filePaths: patch.fileOps.map((operation) => operation.path),
      routeOperationCount: patch.routeOps?.length ?? 0,
      backendOperationCount: patch.backendOps.length,
    });
  }
  let themeSnapshot = workingSnapshot;
  if (themeSnapshot && !patch.themeEdit?.presetId && !restoredRevision && !reviewedComposition && !input.options?.reviewedArtifact && input.source !== 'wizard-launch') {
    const corrected = prepareThemeCorrection(workingFiles, themeSnapshot, input.identity.revisionId || null);
    Object.assign(workingFiles, corrected.files);
    themeSnapshot = corrected.snapshot;
  }
  if (patch.themeEdit) {
    if (!themeSnapshot) throw new Error('A saved site is required for theme edits.');
    const prepared = prepareThemeEdit(workingFiles, themeSnapshot, patch.themeEdit, input.identity.revisionId || null);
    Object.assign(workingFiles, prepared.files);
    themeSnapshot = prepared.snapshot;
  }
  const preservePageSources = input.source !== 'wizard-launch';
  const presentationSnapshot = applyPresentationOps(
    themeSnapshot,
    workingFiles,
    patch.presentationOps,
    log,
  );

  if (customizerPagePath && patch.presentationOps.length) {
    const previous = collectResolvedCompositions(workingFiles)[customizerPagePath];
    if (!previous) throw new Error('This page has no editable section composition.');
    const updated = updateResolvedCompositionVariants(
      workingFiles[customizerPagePath],
      previous,
      presentationSnapshot!.meta.designIntervention!.activeVariants ?? {},
      workingFiles,
    );
    Object.assign(workingFiles, updated.updatedSources);
    workingFiles[customizerPagePath] = updated.source;
    workingFiles[resolvedCompositionPathFor(customizerPagePath)] = serializeResolvedComposition(updated.composition);
    refreshEditedCompositionOwnership(input.current.vfsFiles, workingFiles);
  }
  const projectMediaManifest = syncProjectMedia(workingFiles);
  if (projectMediaManifest !== null) workingFiles[PROJECT_MEDIA_MANIFEST] = projectMediaManifest;
  const preserveProjectMediaManifest = (candidateFiles: Record<string, string>) => projectMediaManifest === null
    ? candidateFiles
    : { ...candidateFiles, [PROJECT_MEDIA_MANIFEST]: projectMediaManifest };
  const projectMediaManifestContent = workingFiles[PROJECT_MEDIA_MANIFEST];

  // Everything that intentionally changed before acceptance is the candidate.
  // Downstream projection, validation and readiness stages may inspect these
  // bytes, but may not silently author additional user-source changes.
  const sourcePreservationBaseline = input.source !== 'wizard-launch'
    && !restoredRevision && !reviewedComposition && !input.options?.compositionUpgrade
    ? { ...input.current.vfsFiles }
    : null;
  let sourcePreservationOperations = sourcePreservationBaseline
    ? sourceOperationsBetween(sourcePreservationBaseline, workingFiles)
    : [];
  // Deterministic canonical normalization (intent closure, forbidden-intent
  // stripping, nav stamping) is platform-owned, not an unreviewed rewrite.
  // Once it has run, its bytes become part of the explicit candidate so the
  // preservation guard checks against what the gates actually validated.
  const adoptCanonicalNormalization = () => {
    if (sourcePreservationBaseline) {
      if (typeof projectMediaManifestContent === 'string') {
        files[PROJECT_MEDIA_MANIFEST] = projectMediaManifestContent;
      }
      sourcePreservationOperations = sourceOperationsBetween(sourcePreservationBaseline, files);
    }
  };

  // 5. Resolve the canonical projection -------------------------------------
  // Confirmation is a persistence boundary, not another generation stage.
  // Re-running Stage 4b here can replace the exact files the user reviewed.
  const reviewedArtifact = input.options?.reviewedArtifact ?? (restoredRevision ? {
    siteBundleSnapshot: restoredRevision.siteBundleSnapshot as SiteBundleSnapshot,
    runtimeManifest: restoredRevision.runtimeManifest as RuntimeManifest,
    playground: restoredRevision.playground ?? undefined,
  } : reviewedComposition ? {
    siteBundleSnapshot: reviewedComposition.candidate.siteBundleSnapshot!,
    runtimeManifest: reviewedComposition.candidate.runtimeManifest!,
    playground: reviewedComposition.candidate.playground ?? undefined,
  } : undefined);
  if (input.options?.reviewedArtifact && input.source !== 'wizard-launch') {
    throw new CommitGuardError('SCOPE_ESCAPE', 'reviewed-artifact', '[VFSCommitService] reviewedArtifact is only valid for wizard-launch commits.');
  }
  let canonicalResult: CanonicalCommitResult | null = null;
  let finalizedArtifact: CanonicalLaunchArtifacts | null = null;
  if (reviewedArtifact) {
    log('canonical', 'info', 'accepted exact user-reviewed wizard artifact; regeneration skipped');
  } else {
    try {
      canonicalResult = input.options?.compositionUpgrade ? null : commitToPipeline(
        buildCanonicalInput(input, workingFiles, presentationSnapshot, preservePageSources, workingPlayground),
        toCanonicalSource(input.source),
      );
      if (input.source !== 'wizard-launch') {
        const candidate = stampBusinessSystemState(
          input.options?.compositionUpgrade
            ? { ...presentationSnapshot!, vfsFiles: workingFiles }
            : canonicalResult!.siteBundleSnapshot,
          presentationSnapshot,
          input.patch.businessSystem,
        )!;
        const context = presentationSnapshot?.appContext;
        finalizedArtifact = buildCanonicalLaunchArtifacts({
          generatedFiles: candidate.vfsFiles,
          preservePageSources,
          siteBundleSnapshot: candidate,
          compileArtifact: canonicalResult ? { ...canonicalResult.compileArtifact, baseline: candidate } : undefined,
          canonicalPlayground: canonicalResult?.playground ?? input.current.playground,
          preferredEntryPoint: candidate.routerFile.path,
          businessId: input.identity.businessId,
          projectId: input.identity.projectId,
          siteId: context?.runtimeContext?.websiteId ?? context?.runtimeContext?.siteId,
          organizationId: context?.runtimeContext?.workspaceId ?? context?.runtimeContext?.organizationId,
          environment: context?.runtimeContext?.environment,
          businessRuntime: context?.businessRuntime,
          systemType: context?.systemType,
          systemName: context?.systemName,
          templateId: candidate.meta.templateId,
          templateName: context?.templateName,
          industry: candidate.industry,
          businessName: candidate.businessName,
          themePresetId: candidate.meta.themePresetId,
          interactionManifest: candidate.meta.interactionManifest,
          enabledCapabilities: readWizardEnabledCapabilities(workingFiles),
          // AI edits that compose certified 3D primitives approve them (still gated on device eligibility + budgets).
          approvedExperienceCapabilities: (input.options?.compositionUpgrade || input.source === 'ai-builder') ? resolveApprovedExperienceCapabilities({
            webgl: candidate.meta.designIntervention?.envelope?.webgl,
            foundationCapabilities: candidate.meta.uiFoundation?.experienceCapabilities,
            requiredCapabilities: candidate.meta.uiFoundation?.approvedExperienceCapabilities
              ?? presentationSnapshot?.meta.uiFoundation?.approvedExperienceCapabilities,
            reachesExperienceLayer: runExperiencePreflight(workingFiles).manifest.totalInstances > 0,
          }) : candidate.meta.uiFoundation?.approvedExperienceCapabilities
            ?? presentationSnapshot?.meta.uiFoundation?.approvedExperienceCapabilities,
        });
      }
    } catch (err) {
      const canonicalError = err instanceof Error ? err.message : String(err);
      log('canonical', 'error', 'canonical pipeline threw', err instanceof Error ? {
        message: err.message,
        stack: err.stack,
      } : String(err));
      return finalize({
        input,
        status: 'rejected',
        vfsFiles: workingFiles,
        siteBundleSnapshot: null,
        runtimeManifest: null,
        playground: input.current.playground ?? null,
        readinessReport: {},
        publishReady: false,
        publishBlockers: [{
          source: 'preview',
          code: 'canonical-pipeline-threw',
          message: 'Canonical pipeline failed; nothing safe to publish',
        }],
        vfsHash: await hashVfsFiles(workingFiles),
        backendOpsApplied: [],
        dataOpsApplied: [],
        diagnostics,
        parentRevisionId: input.identity.revisionId || null,
        rejectMessage: `canonical pipeline threw: ${canonicalError}`,
      });
    }
  }

  // 6. Full preflight --------------------------------------------------------
  const snapshot = finalizedArtifact?.siteBundleSnapshot ?? reviewedArtifact?.siteBundleSnapshot ?? canonicalResult?.siteBundleSnapshot ?? null;
  let files: Record<string, string> =
    restoredRevision ? { ...restoredRevision.vfsFiles } : reviewedComposition ? { ...reviewedComposition.candidate.vfsFiles } : input.options?.reviewedArtifact
      ? preserveWizardMetadataFiles(input.options.reviewedArtifact.siteBundleSnapshot.vfsFiles, workingFiles)
      : finalizedArtifact ? preserveWizardMetadataFiles(finalizedArtifact.files, workingFiles) : input.source === 'wizard-launch'
      ? mergeWizardLaunchFiles(workingFiles, (snapshot as SiteBundleSnapshot | null) ?? null)
      : ((snapshot as { vfsFiles?: Record<string, string> } | null)?.vfsFiles ?? workingFiles);
  if (bindingOperationResult?.boundBindingIds.length && snapshot) {
    // Preserve authored page structure while stamping only the canonical
    // binding attributes that changed. This is a compiler-owned projection,
    // never an AI-authored JSX mutation.
    const application = applyWizardBindingsToVfs(
      files,
      snapshot as SiteBundleSnapshot,
      bindingOperationResult.boundBindingIds,
      readWizardEnabledCapabilities(workingFiles),
    );
    if (application.missingBindings.length) {
      throw new Error(
        `[VFSCommitService] Canonical binding projection could not locate ${application.missingBindings
          .map((missing) => missing.elementKey || missing.bindingId).join(', ')}.`,
      );
    }
    files = application.files;
    adoptCanonicalNormalization();
    log('bindingOps', 'info', `projected ${application.appliedBindings} canonical binding(s) into the accepted VFS`);
  }
  // Page labels are topology metadata, but they also label the compiler-owned
  // composition sidecars consumed by preview and the editor. Project the
  // accepted registry onto those sidecars after every canonical build.
  const acceptedSnapshot = snapshot as SiteBundleSnapshot | null;
  for (const page of Object.values(acceptedSnapshot?.pageRegistry?.pages ?? {})) {
    if (page.isHome || !page.filePath) continue;
    const descriptorPath = resolvedCompositionPathFor(page.filePath);
    const composition = collectResolvedCompositions({ [descriptorPath]: files[descriptorPath] })[page.filePath];
    if (!composition) continue;
    files[descriptorPath] = serializeResolvedComposition({
      ...composition,
      templateName: `${acceptedSnapshot?.businessName || 'Site'} · ${page.title}`,
    });
  }
  // A reviewed artifact is already a complete candidate, not a page template.
  // Capture before preflight can mutate even the input map in place. Protect
  // hooks, styles, assets and original components as well as registered pages.
  const reviewedSourceBaseline = reviewedArtifact ? { ...files } : null;
  let projectionRestored = false;
  if (sourcePreservationBaseline) {
    // The projection may refresh compiler-owned files but must not author user
    // source. Restore the exact candidate bytes instead of rejecting the edit;
    // every downstream gate still validates the restored map.
    const reconciled = restoreAuthoredSource({
      acceptedFiles: sourcePreservationBaseline,
      operations: sourcePreservationOperations,
      finalizedFiles: files,
      compilerOwnedPaths: [
        '/.unison/**', '/src/unison/**', '/src/integrations/**',
        ...compilerOwnedGeneratedPaths(files),
      ],
      stage: 'canonical projection',
    });
    if (reconciled.restored.length) {
      files = reconciled.files;
      projectionRestored = true;
      log('canonical', 'warn', `projection rewrote ${reconciled.restored.length} authored file(s); restored the exact candidate source`, {
        paths: reconciled.restored.map((item) => `${item.path} (${item.kind})`),
      });
    }
    assertCandidateSourcePreserved(sourcePreservationBaseline, sourcePreservationOperations, files, 'canonical projection');
  }
  // The durable revision requires snapshot.vfsFiles to equal the runtime VFS,
  // so always project the final file map into the snapshot.
  void projectionRestored;
  let snapshotForPersistence = mergeWizardLaunchSnapshot((snapshot as SiteBundleSnapshot | null) ?? null, files);
  snapshotForPersistence = stampBusinessSystemState(
    snapshotForPersistence as SiteBundleSnapshot | null,
    presentationSnapshot,
    input.patch.businessSystem ?? (
      input.source === 'wizard-launch'
        ? buildWizardBusinessSystemState(files)
        : undefined
    ),
  );
  if (bindingOperationResult) {
    const verification = verifyBindingProjection({
      snapshot: snapshotForPersistence as SiteBundleSnapshot | null,
      files,
      boundBindingIds: bindingOperationResult.boundBindingIds,
      unboundBindings: bindingOperationResult.unboundBindings,
    });
    if (!verification.ok) {
      throw new Error(`[VFSCommitService] Binding semantic verification failed: ${verification.failures.join(' | ')}`);
    }
    log('semanticVerification', 'info', 'verified canonical binding runtime projection', verification);
  }

  // 6b. Site-wide authoring validation --------------------------------------
  // Acceptance may inspect authored presentation but must never normalize it.
  // Only sealed shared-chrome contradictions are hard failures; unfamiliar
  // palette, typography and page-body choices are advisory authoring feedback.
  if ((input.source === 'ai-builder' || input.source === 'playground-edit')
    && !restoredRevision && !reviewedArtifact && !reviewedComposition) {
    const registryPages = ((snapshotForPersistence as SiteBundleSnapshot | null)?.pageRegistry as
      { pages?: Record<string, { isHome?: boolean; filePath?: string }> } | undefined)?.pages ?? {};
    const homePath = Object.values(registryPages).find(page => page?.isHome)?.filePath ?? null;
    const designContract = enforceSiteDesignContract({ files, homePath });
    if (!designContract.skipped) {
      if (designContract.advisories.length) {
        log('siteDesignContract', 'info', 'recorded non-blocking design advisories', designContract.advisories);
      }
      if (designContract.violations.length) {
        log('siteDesignContract', 'warn', 'site design contract violations', designContract.violations);
        // Only pages this edit actually changed may block it; pre-existing
        // drift on untouched pages must never reject an unrelated edit.
        const previousFiles = (input.current?.vfsFiles ?? {}) as Record<string, string>;
        const touched = designContract.violations.filter((violation) => {
          const path = violation.split(' ')[0];
          return previousFiles[path] !== files[path] || !(path in previousFiles);
        });
        // Advisory only (edit policy): design-language drift is surfaced as a
        // suggestion and never rejects a requested edit.
        if (input.source === 'ai-builder' && touched.length) {
          emitAgentEvent({
            kind: 'verification',
            status: 'ok',
            message: `Suggestion: this change departs from the site's shared style (${touched[0]}). Ask me to match it back if you prefer.`,
          });
        }
      }
    }
  }

  const requirePreview = input.options?.requirePreviewPass !== false;
  const requireReadinessRequested = input.options?.requireReadinessPass === true;
  const requireReadiness = requireReadinessRequested;

  // User-driven Builder edits are validated, never grown: required industry
  // surfaces are closed at launch, not injected into a later style/copy edit.
  const closeRequiredIntents = input.source !== 'ai-builder' && input.source !== 'playground-edit';
  let preflight = runFullPreflight(files, {
    closeRequiredIntents,
    siteBundleSnapshot: (snapshotForPersistence as { meta?: unknown } | null) as
      | import('@/platform/core/canonicalPipeline').SiteBundleSnapshot
      | null,
    industry: input.options?.industry,
    brand: input.options?.businessName,
    // The launcher hands this service an already converged and sealed artifact.
    // Commit may verify it, but must never become a second source-writing stage.
    mode: 'acceptance',
  });
  files = preserveProjectMediaManifest(reviewedArtifact && !reviewedComposition && !restoredRevision
    ? preserveWizardMetadataFiles(preflight.files, workingFiles)
    : preflight.files);
  if (input.source === 'wizard-launch') {
    snapshotForPersistence = mergeWizardLaunchSnapshot(
      (snapshotForPersistence as SiteBundleSnapshot | null) ?? null,
      files,
    );
  }

  const preflightPassed = (result: typeof preflight) =>
    result.stages.earlyRepair !== 'failed' &&
    result.stages.finalRepair !== 'failed' &&
    result.stages.runtimeCompatibility?.ok !== false &&
    (result.violations?.length ?? 0) === 0;

  let previewOk =
    preflight.stages.earlyRepair !== 'failed' &&
    preflight.stages.finalRepair !== 'failed' &&
    preflight.stages.runtimeCompatibility?.ok !== false &&
    (preflight.violations?.length ?? 0) === 0;
  log('preflight', previewOk ? 'info' : 'warn', 'preflight stages', preflight.stages);

  // AI edits may legitimately need deterministic canonical normalization
  // (intent closure, nav stamping, experience manifests). Apply that repair
  // once, then validate the repaired candidate in acceptance mode. Structural,
  // syntax and runtime blockers still fail the second pass.
  if (!previewOk && (input.source === 'ai-builder' || input.source === 'playground-edit')) {
    const repair = runFullPreflight(files, {
    closeRequiredIntents,
      siteBundleSnapshot: (snapshotForPersistence as { meta?: unknown } | null) as SiteBundleSnapshot | null,
      industry: input.options?.industry,
      brand: input.options?.businessName,
      mode: 'repair',
      // Never commit a "could not be compiled" stub in place of an AI page:
      // an unparseable page must fail acceptance so the edit is rejected.
      allowQuarantine: false,
    });
    if (repair.stages.earlyRepair !== 'failed' && repair.stages.finalRepair !== 'failed') {
      files = preserveProjectMediaManifest(repair.files);
      adoptCanonicalNormalization();
      if (snapshotForPersistence) snapshotForPersistence = mergeWizardLaunchSnapshot(snapshotForPersistence as SiteBundleSnapshot, files);
      preflight = runFullPreflight(files, {
    closeRequiredIntents,
        siteBundleSnapshot: (snapshotForPersistence as { meta?: unknown } | null) as SiteBundleSnapshot | null,
        industry: input.options?.industry,
        brand: input.options?.businessName,
        mode: 'acceptance',
      });
      previewOk = preflightPassed(preflight);
      log('preflight', previewOk ? 'info' : 'warn', 'validated deterministically normalized AI candidate', {
        repairedFiles: repair.mutatedFiles,
        violations: preflight.violations,
      });
    }
  }

  const gate = canonicalResult?.gate ?? null;

  // Move 4: capability readiness adapter. When a CompiledContract is
  // supplied (or surfaced by the canonical pipeline), run PreviewGate +
  // PublishGate so business-critical capability stubs (commerce / booking /
  // donation / auth) block the commit instead of silently degrading.
  const compiled =
    input.options?.compiledContract ??
    ((canonicalResult as (CanonicalCommitResult & { compiledContract?: CompiledContract }) | null)?.compiledContract ?? null);
  let previewVerdict: GateVerdict | null = null;
  let publishVerdict: GateVerdict | null = null;
  if (compiled) {
    try {
      previewVerdict = PreviewGate.evaluate(compiled);
      publishVerdict = PublishGate.evaluate(compiled);
      log(
        'capabilityGate',
        previewVerdict.ok && publishVerdict.ok ? 'info' : 'warn',
        `preview=${previewVerdict.ok} publish=${publishVerdict.ok}`,
        { preview: previewVerdict.reasons, publish: publishVerdict.reasons },
      );
    } catch (err) {
      log('capabilityGate', 'warn', 'gate evaluation threw', String(err));
    }
  }

  // Move 5: IntentReadinessController consolidation. Evaluate the canonical
  // PlaygroundState through the intent readiness resolver so binding-level
  // preview blockers (missing pages/forms/calendars/popups, broken targets)
  // gate the commit alongside the capability gate.
  let intentControlPlane: PlaygroundControlPlaneModel | null = null;
  let intentPreviewBlocked = 0;
  let intentPublishBlocked = 0;
  const playgroundForIntents = reviewedArtifact?.playground ?? canonicalResult?.playground ?? input.current.playground ?? null;
  if (playgroundForIntents) {
    try {
      intentControlPlane = resolvePlaygroundControlPlane({
        state: playgroundForIntents,
        vfsFiles: files,
      });
      intentPreviewBlocked = intentControlPlane.readinessReport.summary.previewBlocked;
      intentPublishBlocked = intentControlPlane.readinessReport.summary.publishBlocked;
      log(
        'intentReadiness',
        intentPreviewBlocked === 0 ? 'info' : 'warn',
        `intent preview blocked=${intentPreviewBlocked} publish blocked=${intentPublishBlocked}`,
        intentControlPlane.readinessReport.summary,
      );
    } catch (err) {
      log('intentReadiness', 'warn', 'intent readiness evaluation threw', String(err));
    }
  }

  // Move B: per-element capability contract evaluation. Walks every
  // data-ut-intent occurrence in the VFS, checks required capabilities and
  // backing-table row assertions, and surfaces concrete fix paths in the
  // readiness report.
  let elementReadiness: ElementReadinessReport | null = null;
  let elementPreviewBlocked = 0;
  let elementPublishBlocked = 0;
  try {
    const provisionedCapabilities: CapabilityId[] = compiled
      ? compiled.provisioningReport.capabilities.map((c) => c.capabilityId as CapabilityId)
      : [];
    elementReadiness = await evaluateElementReadiness({
      vfsFiles: files,
      provisionedCapabilities,
      businessId: input.identity.businessId,
    });
    elementPreviewBlocked = elementReadiness.summary.previewBlocked;
    elementPublishBlocked = elementReadiness.summary.publishBlocked;
    log(
      'elementReadiness',
      elementPreviewBlocked === 0 ? 'info' : 'warn',
      `element preview blocked=${elementPreviewBlocked} publish blocked=${elementPublishBlocked}`,
      elementReadiness.summary,
    );
  } catch (err) {
    log('elementReadiness', 'warn', 'element readiness evaluation threw', String(err));
  }

  const readinessOk =
    (!gate || gate.previewReady) &&
    (!previewVerdict || previewVerdict.ok) &&
    intentPreviewBlocked === 0 &&
    elementPreviewBlocked === 0;
  // Business-connection / capability readiness is advisory for draft saves;
  // explicit strict-readiness callers still enforce it below.
  if (!readinessOk) {
    log('readiness', 'warn', 'Saved with business connection warnings: ' + [
      gate && !gate.previewReady ? 'a required business capability is not connected' : null,
      previewVerdict && !previewVerdict.ok ? 'business connection check failed' : null,
      intentPreviewBlocked > 0 ? `${intentPreviewBlocked} button action(s) are not connected yet` : null,
      elementPreviewBlocked > 0 ? `${elementPreviewBlocked} element(s) need a business service that is not set up` : null,
    ].filter(Boolean).join('; '), {
      requestedReadinessPass: requireReadinessRequested,
      gateReasons: (gate as { reasons?: unknown } | null)?.reasons ?? [],
      previewVerdictReasons: (previewVerdict as { reasons?: unknown } | null)?.reasons ?? [],
      intentPreviewBlocked,
      elementPreviewBlocked,
      elementFixes: elementReadiness?.summary ?? null,
    });
  }


  let backendOpsReport: BackendOpExecutionReport | null = null;
  let runtimeReconciliationError: string | null = null;


  // 6. Auto-repair-then-hard-reject -----------------------------------------
  let status: 'committed' | 'rejected' = 'committed';
  // Callers that opt out of readiness (capability installs, restores) still run
  // their backend ops: the install is what clears those readiness blockers.
  let preExecutionReady = previewOk && (readinessOk || !requireReadiness);
  if ((requirePreview && !previewOk) || (requireReadiness && !readinessOk)) {
    log('repair', 'warn', 'running single auto-repair pass');
    try {
      preflight = runFullPreflight(files, {
    closeRequiredIntents,
          siteBundleSnapshot: (snapshotForPersistence as { meta?: unknown } | null) as
          | import('@/platform/core/canonicalPipeline').SiteBundleSnapshot
          | null,
        industry: input.options?.industry,
        brand: input.options?.businessName,
        mode: 'repair',
        allowQuarantine: false,
      });
      if (preflight.stages.earlyRepair !== 'failed' && preflight.stages.finalRepair !== 'failed') {
        preflight = runFullPreflight(preflight.files, {
    closeRequiredIntents,
          siteBundleSnapshot: (snapshotForPersistence as { meta?: unknown } | null) as
            | import('@/platform/core/canonicalPipeline').SiteBundleSnapshot
            | null,
          industry: input.options?.industry,
          brand: input.options?.businessName,
          mode: 'acceptance',
        });
      }
      files = preserveProjectMediaManifest(reviewedArtifact && !reviewedComposition && !restoredRevision
        ? preserveWizardMetadataFiles(preflight.files, workingFiles)
        : preflight.files);
      adoptCanonicalNormalization();
    } catch (err) {
      log('repair', 'error', 'auto-repair threw', String(err));
    }
    const previewOk2 = preflightPassed(preflight);
    const readinessOk2 =
      (!gate || gate.previewReady) &&
      (!previewVerdict || previewVerdict.ok) &&
      intentPreviewBlocked === 0 &&
      elementPreviewBlocked === 0;
    if ((requirePreview && !previewOk2) || (requireReadiness && !readinessOk2)) {
      status = 'rejected';
      const rejectionCode: CommitRejectionCode = !previewOk2
        ? 'RUNTIME_PREVIEW_ERROR'
        : gate && !gate.previewReady || previewVerdict && !previewVerdict.ok || elementPreviewBlocked > 0
          ? 'MISSING_CAPABILITY_OR_PERMISSION'
          : intentPreviewBlocked > 0
            ? 'LOCKED_INTENT_OR_DATA_FIELD'
            : 'RUNTIME_PREVIEW_ERROR';
      log(
        'gate',
        'error',
        'hard reject after auto-repair',
        {
          previewOk: previewOk2,
          readinessOk: readinessOk2,
          previewViolations: preflight.violations,
          publishBlockers: publishVerdict?.reasons ?? [],
          intentPreviewBlocked,
          intentPublishBlocked,
          elementPreviewBlocked,
          elementPublishBlocked,
          backendOpsFailed: backendOpsReport?.failedCount ?? 0,
        },
        rejectionCode,
      );
    } else {
      preExecutionReady = previewOk2 && (readinessOk2 || !requireReadiness);
      log('repair', 'info', 'auto-repair recovered the commit');
    }
  }

  // P0.4 — module-closure hard gate. Every edit path (wizard launch, AI
  // builder, presentation ops, theme edits, inspector patches, restores)
  // funnels through this single writer, so the closure check lives here once:
  // a candidate whose relative imports do not resolve, or whose local JSX
  // imports name a symbol the target module never exports, can never be
  // persisted — that is exactly the "element type is invalid" preview crash.
  const moduleClosureBlockers: PublishBlockerSummary[] = [];
  if (status === 'committed') {
    const unresolvedModules = findUnresolvedLocalImports(files);
    if (unresolvedModules.length > 0) {
      moduleClosureBlockers.push({
        source: 'preview',
        code: 'module-closure-unresolved-import',
        message: `${unresolvedModules.length} unresolved local import(s): ${describeUnresolvedImports(unresolvedModules)}`,
        meta: { unresolved: unresolvedModules.slice(0, 20) },
      });
    }
    const exportViolations = findLocalJsxImportContractViolations(files);
    if (exportViolations.length > 0) {
      moduleClosureBlockers.push({
        source: 'preview',
        code: 'module-closure-missing-export',
        message: `${exportViolations.length} local component import(s) reference a symbol the module does not export: ${exportViolations
          .slice(0, 5)
          .map((v) => `${v.filePath} → "${v.importPath}" (${v.symbol})`)
          .join(', ')}`,
        meta: { violations: exportViolations.slice(0, 20) },
      });
    }
    if (moduleClosureBlockers.length > 0 && requirePreview) {
      status = 'rejected';
      preExecutionReady = false;
      log(
        'gate',
        'error',
        `module closure gate rejected the candidate: ${[
          unresolvedModules.length > 0 ? describeUnresolvedImports(unresolvedModules) : '',
          ...exportViolations.slice(0, 5).map((violation) => `${violation.filePath} -> ${violation.importPath} (${violation.symbol})`),
        ].filter(Boolean).join('; ')}`,
        { unresolved: unresolvedModules, missingExports: exportViolations },
        'INVALID_JSX_OR_IMPORT',
      );
    } else if (moduleClosureBlockers.length > 0) {
      log('gate', 'warn', 'module closure defects retained as publish blockers', {
        unresolved: unresolvedModules.length,
        missingExports: exportViolations.length,
      });
    }
  }

  // Registry comparison is advisory: authored route graphs and navigation are valid
  // when they pass executable preview and module checks.
  const shellClosureBlockers: PublishBlockerSummary[] = [];
  if (status === 'committed') {
    const registry = (snapshotForPersistence as SiteBundleSnapshot | null)?.pageRegistry;
    if (registry && Object.keys(registry.pages ?? {}).length > 0) {
      const topology = buildSiteShellTopology(registry);
      const pageSources: Record<string, string> = {};
      for (const [path, source] of Object.entries(files)) {
        if (path.startsWith('/src/pages/') && /\.(tsx|jsx)$/.test(path)) pageSources[path] = source;
      }
      const routerSource = files['/src/App.tsx'] ?? '';
      const parsedRouterRoutes = routerSource
        ? Array.from(routerSource.matchAll(/path=["']([^"']+)["']/g)).map((m) => m[1])
        : [];
      // A router with no literal `path=` attributes is not evidence of a broken
      // route graph (index routes, generated tables); only compare when the
      // router actually declares paths.
      const routerRoutes = parsedRouterRoutes.length > 0 ? parsedRouterRoutes : undefined;
      const violations = assertSiteShellClosure(topology, { pageSources, routerRoutes });
      for (const violation of violations) {
        shellClosureBlockers.push({
          source: 'preview',
          code: `site-shell-${violation.code}`,
          message: violation.message,
          meta: { pageId: violation.pageId, path: violation.path },
        });
      }
      if (violations.length > 0) {
        log('siteShell', 'warn', 'registry comparison recorded as authoring guidance', {
          total: violations.length,
        });
      }
    }
  }


  if (reviewedSourceBaseline) {
    assertReviewedSourcesUnchanged(reviewedSourceBaseline, files, 'before backend effects');
  }
  if (sourcePreservationBaseline) {
    assertCandidateSourcePreserved(sourcePreservationBaseline, sourcePreservationOperations, files, 'before backend effects');
  }

  // Move C: execute transactional backend ops only after the candidate VFS
  // has survived preview and readiness checks. This is intentionally after
  // the auto-repair decision: a rejected revision must never provision or
  // seed backend data.
  const dataOps = input.patch.dataOps ?? [];
  let dataOpsReport: DataOpExecutionReport | undefined;
  if (status === 'committed' && preExecutionReady && dataOps.length > 0) {
    dataOpsReport = await executeDataOps(dataOps, input.identity);
    log(
      'dataOps',
      dataOpsReport.failedCount === 0 ? 'info' : 'warn',
      `executed ${dataOpsReport.results.length} data operation(s) (failed=${dataOpsReport.failedCount})`,
      dataOpsReport.results,
    );
    if (dataOpsReport.failedCount > 0) status = 'rejected';
  } else if (dataOps.length > 0) {
    log('dataOps', 'warn', 'skipped data operations because pre-execution gates failed');
  }

  const backendOps = input.patch.backendOps ?? [];
  if (status === 'committed' && preExecutionReady && backendOps.length > 0) {
    try {
      backendOpsReport = await executeBackendOps(backendOps, input.identity,
        input.patch.candidate ? { runId: input.patch.candidate.id } : undefined);
      log(
        'backendOps',
        backendOpsReport.failedCount === 0 ? 'info' : 'warn',
        `executed ${backendOpsReport.results.length} ops (failed=${backendOpsReport.failedCount})`,
        backendOpsReport.results.map((r) => ({ type: r.op.type, cap: 'capability' in r.op ? r.op.capability : undefined, status: r.status, operationId: r.operationId, runId: r.runId, code: r.code })),
      );
      if (backendOpsReport.failedCount > 0) {
        status = 'rejected';
        log('backendOps', 'error', 'backend operation failure rejected the commit');
      }
      snapshotForPersistence = finalizeBusinessSystemState(
        snapshotForPersistence as SiteBundleSnapshot | null,
        backendOpsReport.failedCount === 0 ? 'provisioned' : 'failed',
      );
    } catch (err) {
      status = 'rejected';
      log('backendOps', 'error', 'backend op execution threw', String(err));
    }
  } else if (backendOps.length > 0) {
    log('backendOps', 'warn', 'skipped backend operations because pre-execution gates failed');
  }

  if (
    status === 'committed' &&
    input.source !== 'wizard-launch' &&
    input.options?.dryRun !== true &&
    snapshotForPersistence
  ) {
    try {
      const generatedRuntime = await reconcileGeneratedRuntime({
        identity: input.identity,
        manifest: finalizedArtifact?.generatedSiteRuntimeManifest,
      });
      log(
        'generatedRuntime',
        'info',
        `reconciled ${generatedRuntime.agents.length} generated agent binding(s)`,
      );
    } catch (error) {
      runtimeReconciliationError = error instanceof Error ? error.message : String(error);
      // Reconciliation only exists for launched sites. Projects that have not been
      // provisioned yet must still be able to save edits — the failure is recorded
      // as a publish blocker instead of rejecting the author's work.
      log(
        'generatedRuntime',
        'warn',
        'generated runtime reconciliation deferred (publish blocked, save preserved)',
        runtimeReconciliationError,
      );
    }
  }

  // Move D — compute publish readiness + blockers aggregate.
  const publishBlockers: PublishBlockerSummary[] = [...moduleClosureBlockers];
  if (runtimeReconciliationError) {
    publishBlockers.push({
      source: 'backendOps',
      code: 'generated-runtime-reconciliation-failed',
      message: runtimeReconciliationError,
    });
  }
  if (publishVerdict && !publishVerdict.ok) {
    for (const r of publishVerdict.reasons) {
      publishBlockers.push({
        source: 'publishGate',
        code: r.code,
        message: r.message,
        meta: r.meta as Record<string, unknown> | undefined,
      });
    }
  }
  if (intentControlPlane && intentControlPlane.readinessReport.summary.publishBlocked > 0) {
    publishBlockers.push({
      source: 'intentReadiness',
      code: 'intent-publish-blocked',
      message: `${intentControlPlane.readinessReport.summary.publishBlocked} intent binding(s) block publish`,
      meta: { summary: intentControlPlane.readinessReport.summary },
    });
  }
  if (elementReadiness && elementReadiness.summary.publishBlocked > 0) {
    publishBlockers.push({
      source: 'elementReadiness',
      code: 'element-publish-blocked',
      message: `${elementReadiness.summary.publishBlocked} element(s) missing required capability/data`,
      meta: { summary: elementReadiness.summary },
    });
  }
  if (backendOpsReport && backendOpsReport.failedCount > 0) {
    publishBlockers.push({
      source: 'backendOps',
      code: 'backend-op-failed',
      message: `${backendOpsReport.failedCount} backend op(s) failed`,
      meta: { failed: backendOpsReport.results.filter((r) => r.status === 'failed') },
    });
  }
  if (dataOpsReport && dataOpsReport.failedCount > 0) {
    publishBlockers.push({
      source: 'backendOps',
      code: 'data-op-failed',
      message: `${dataOpsReport.failedCount} data operation(s) failed`,
      meta: { failed: dataOpsReport.results.filter((result) => result.status === 'failed') },
    });
  }
  const publishReady =
    status === 'committed' &&
    publishBlockers.length === 0 &&
    (!publishVerdict || publishVerdict.ok);

  if (reviewedSourceBaseline) {
    assertReviewedSourcesUnchanged(reviewedSourceBaseline, files, 'durable revision');
  }
  if (sourcePreservationBaseline) {
    assertCandidateSourcePreserved(sourcePreservationBaseline, sourcePreservationOperations, files, 'durable revision');
  }
  // The persisted snapshot must prove the exact final bytes, after every
  // preflight and explicit transform. This is a metadata stamp only; it never
  // regenerates or substitutes authored source.
  if (snapshotForPersistence && status === 'committed') {
    snapshotForPersistence = stampSnapshotAuthority(
      snapshotForPersistence as SiteBundleSnapshot,
      authorityAfterAcceptedCommit(currentAuthority, input.source),
    );
    log('authorshipAuthority', 'info', 'creative authority handed to Builder; commit authority remains VFSCommitService', {
      source: input.source,
      authority: (snapshotForPersistence as SiteBundleSnapshot).meta.authorshipAuthority,
    });
    snapshotForPersistence = restampSealedSourceAuthority(
      snapshotForPersistence as SiteBundleSnapshot,
      files,
      input.source === 'wizard-launch' ? 'wizard-launch' : 'builder-commit',
    );
  }
  const vfsHash = await hashVfsFiles(files);
  if (reviewedComposition && vfsHash !== reviewedComposition.candidate.vfsHash) {
    throw new CommitGuardError('COMPOSITION_PROVENANCE_MISMATCH', 'composition-validation', '[VFSCommitService] Validation changed the reviewed composition. Generate a fresh preview.', {
      expectedVfsHash: reviewedComposition.candidate.vfsHash,
      actualVfsHash: vfsHash,
    });
  }
  if (restoredRevision && vfsHash !== await hashVfsFiles(restoredRevision.vfsFiles)) {
    throw new Error('[VFSCommitService] Validation changed the historical revision; restore was not applied.');
  }

  // 7. Persist revision + return -------------------------------------------
  return finalize({
    input,
    status,
    vfsFiles: files,
    siteBundleSnapshot: snapshotForPersistence,
    runtimeManifest: finalizedArtifact?.runtimeManifest ?? reviewedArtifact?.runtimeManifest ?? canonicalResult?.runtimeManifest ?? null,
    playground: reviewedArtifact?.playground ?? canonicalResult?.playground ?? input.current.playground ?? null,
    readinessReport: {
      runtimeCompatibility: preflight.stages.runtimeCompatibility,
      ...(gate ? { gate } : {}),
      ...(previewVerdict ? { previewVerdict } : {}),
      ...(publishVerdict ? { publishVerdict } : {}),
      ...(intentControlPlane
        ? {
            intentReadiness: {
              summary: intentControlPlane.readinessReport.summary,
              validationSummary: intentControlPlane.validationSummary,
              overview: intentControlPlane.overview,
            },
          }
        : {}),
      ...(elementReadiness ? { elementReadiness } : {}),
      ...(backendOpsReport ? { backendOps: backendOpsReport } : {}),
      ...(dataOpsReport ? { dataOps: dataOpsReport } : {}),
    } as Record<string, unknown>,
    publishReady,
    publishBlockers,
    vfsHash,
    backendOpsApplied: backendOpsReport?.results ?? [],
    dataOpsApplied: dataOpsReport?.results ?? [],
    diagnostics,
    parentRevisionId: input.identity.revisionId || null,
    rejectMessage:
      status === 'rejected'
        ? 'commit rejected by preview/readiness gate or backend operation failure'
        : null,
  });
}

// ----------------------------------------------------------------------------
// Internals
// ----------------------------------------------------------------------------

function buildCanonicalInput(
  input: CommitMutationInput,
  workingFiles: Record<string, string>,
  snapshotOverride?: SiteBundleSnapshot | null,
  preservePageSources = input.source === 'theme-change',
  playgroundOverride = input.current.playground,
): CanonicalCommitInput {
  const snapshot = snapshotOverride ?? input.current.siteBundleSnapshot as SiteBundleSnapshot | null | undefined;
  return {
    preservePageSources,
    selections: input.options?.selections,
    playground: playgroundOverride,
    existingVfsFiles: workingFiles,
    businessName: input.options?.businessName ?? snapshot?.businessName,
    industry: input.options?.industry ?? snapshot?.industry,
    selectedTemplateId: input.options?.selectedTemplateId ?? snapshot?.meta?.templateId ?? undefined,
    selectedThemeId: input.options?.selectedThemeId ?? snapshot?.meta?.themePresetId ?? undefined,
    themePresetId: input.patch.themeEdit ? snapshot?.meta.themePresetId ?? undefined : input.options?.themePresetId ?? snapshot?.meta?.themePresetId ?? undefined,
    themeTokens: snapshot?.themeTokens ?? input.options?.themeTokens,
    compiledContract: input.options?.compiledContract,
  };
}

function applyPresentationOps(
  snapshot: SiteBundleSnapshot | null | undefined,
  files: Record<string, string>,
  ops: PresentationOp[] | undefined,
  log: (stage: string, level: CommitDiagnostic['level'], message: string, detail?: unknown) => void,
): SiteBundleSnapshot | null | undefined {
  if (!ops?.length) return snapshot;
  if (!snapshot?.meta.designIntervention) {
    throw new CommitGuardError('COMPOSITION_PROVENANCE_MISMATCH', 'presentation-projection', '[VFSCommitService] presentation mutation requires a snapshot-owned design intervention.');
  }

  const intervention = applySemanticPresentationOps(
    snapshot.meta.designIntervention as import('@/services/wizardDesignIntervention').WizardDesignIntervention,
    ops,
  );

  const nextSnapshot: SiteBundleSnapshot = {
    ...snapshot,
    meta: { ...snapshot.meta, designIntervention: intervention },
  };
  files['/.unison/design-intervention.json'] = JSON.stringify(intervention, null, 2);
  files['/.unison/site-bundle-snapshot.json'] = JSON.stringify(nextSnapshot, null, 2);
  log('presentation', 'info', `applied ${ops.length} snapshot-owned presentation operation(s)`, ops);
  return nextSnapshot;
}

function toCanonicalSource(s: PatchSource): CanonicalCommitSource {
  // commitToPipeline currently understands a narrower CommitSource union.
  // Collapse the expanded PatchSource → the canonical union; the broader
  // source is preserved on the persisted revision row.
  switch (s) {
    case 'wizard-launch':
      return 'wizard-launch';
    case 'ai-builder':
      return 'ai-builder';
    case 'republish':
      return 'republish';
    case 'system-restore':
      return 'system-restore';
    default:
      return 'playground-edit';
  }
}

/**
 * Wizard launches arrive with the reviewed canonical handoff VFS in the patch
 * file map. Preserve the sealed compiler output while retaining metadata
 * sidecars that are intentionally absent from the runtime snapshot.
 */
function mergeWizardLaunchFiles(
  launcherFiles: Record<string, string>,
  snapshot: SiteBundleSnapshot | null,
): Record<string, string> {
  const canonicalFiles = snapshot?.vfsFiles ?? {};
  const merged: Record<string, string> = {
    ...canonicalFiles,
    ...launcherFiles,
  };

  // The launcher patch also carries metadata that is intentionally absent
  // from the runtime snapshot. It must never replace a protected canonical
  // source path or selected page body.
  const reviewedPaths = new Set<string>([
    ...(snapshot?.meta?.seal?.protectedFilePatterns ?? []),
    ...(snapshot?.meta?.seal?.laneAProtectedFiles ?? []),
    ...Object.values(snapshot?.pageRegistry?.pages ?? {})
      .map((page) => page.filePath)
      .filter((path): path is string => Boolean(path)),
    snapshot?.routerFile?.path || '/src/App.tsx',
  ]);
  for (const path of reviewedPaths) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const reviewedSource = canonicalFiles[normalizedPath] ?? canonicalFiles[path];
    if (typeof reviewedSource !== 'string') continue;
    merged[normalizedPath] = reviewedSource;
    if (path !== normalizedPath) delete merged[path];
  }

  const routerPath = snapshot?.routerFile?.path || '/src/App.tsx';
  const routerContent = canonicalFiles[routerPath] || snapshot?.routerFile?.content;
  if (routerContent) {
    merged[routerPath] = routerContent;
    merged['/src/App.tsx'] = routerContent;
  }

  return merged;
}

function preserveWizardMetadataFiles(
  files: Record<string, string>,
  launcherFiles: Record<string, string>,
): Record<string, string> {
  return {
    ...Object.fromEntries(
      Object.entries(launcherFiles).filter(([path]) => path.startsWith('/.unison/')),
    ),
    ...files,
  };
}

function mergeWizardLaunchSnapshot(
  snapshot: SiteBundleSnapshot | null,
  files: Record<string, string>,
): SiteBundleSnapshot | null {
  if (!snapshot) return null;
  const routerPath = snapshot.routerFile?.path || '/src/App.tsx';
  const runtimeFiles = Object.fromEntries(
    Object.entries(files).filter(([path]) => !path.startsWith('/.unison/')),
  );
  return {
    ...snapshot,
    vfsFiles: runtimeFiles,
    routerFile: {
      path: routerPath,
      content: runtimeFiles[routerPath] || runtimeFiles['/src/App.tsx'] || snapshot.routerFile?.content || '',
    },
  };
}

function assertReviewedSourcesUnchanged(
  expected: Record<string, string>,
  files: Record<string, string>,
  boundary: string,
): void {
  const violations = verifyAuthoredSourcePreservation({
    acceptedFiles: expected, operations: [], finalizedFiles: files,
    // All reviewed bytes are sealed here, including compiler artifacts.
    // This is acceptance, not an authorization to reconcile or regenerate.
    compilerOwnedPaths: [], stage: boundary,
  });
  if (violations.length > 0) {
    throw new Error(
      `[VFSCommitService] ${boundary} changed reviewed source: ${violations.map(item => `${item.path} (${item.kind})`).join(', ')}. Reviewed source was not persisted.`,
    );
  }
}

function stampBusinessSystemState(
  snapshot: SiteBundleSnapshot | null,
  previousSnapshot: SiteBundleSnapshot | null | undefined,
  requestedState: BusinessSystemState | undefined,
): SiteBundleSnapshot | null {
  if (!snapshot) return null;
  const businessSystem = requestedState ?? previousSnapshot?.businessSystem;
  return businessSystem ? { ...snapshot, businessSystem } : snapshot;
}

function finalizeBusinessSystemState(
  snapshot: SiteBundleSnapshot | null,
  status: 'provisioned' | 'failed',
): SiteBundleSnapshot | null {
  if (!snapshot?.businessSystem) return snapshot;
  return {
    ...snapshot,
    businessSystem: {
      ...snapshot.businessSystem,
      capabilities: snapshot.businessSystem.capabilities.map((capability) => ({ ...capability, status })),
    },
  };
}

function readWizardEnabledCapabilities(files: Record<string, string>): CapabilityId[] | undefined {
  try {
    const seed = JSON.parse(files['/.unison/wizard-seed.json'] || '{}') as {
      canonical?: { capabilities?: unknown };
    };
    if (!Array.isArray(seed.canonical?.capabilities)) return undefined;
    return Array.from(new Set(seed.canonical.capabilities.filter(
      (capability): capability is CapabilityId =>
        typeof capability === 'string' && capability in CAPABILITY_REGISTRY,
    ))).sort();
  } catch {
    return undefined;
  }
}

function buildWizardBusinessSystemState(files: Record<string, string>): BusinessSystemState | undefined {
  const capabilities = readWizardEnabledCapabilities(files);
  if (!capabilities?.length) return undefined;
  const approvedAt = new Date().toISOString();
  return {
    version: '1.0',
    requestedCapabilities: Array.from(new Set(
      capabilities.flatMap((capability) => CAPABILITY_REGISTRY[capability].provides),
    )),
    capabilities: capabilities.map((capability) => ({
      id: capability,
      provides: [...CAPABILITY_REGISTRY[capability].provides],
      status: 'approved',
      approval: {
        approvedBy: 'wizard-launch',
        approvedAt,
      },
    })),
  };
}

async function reconcileGeneratedRuntime(input: {
  identity: BuilderIdentity;
  manifest?: GeneratedSiteRuntimeManifest;
}): Promise<GeneratedSiteRuntimeManifest> {
  if (!input.manifest) {
    throw new Error('Canonical finalization did not provide a generated runtime manifest.');
  }
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('site_id')
    .eq('id', input.identity.projectId)
    .eq('business_id', input.identity.businessId)
    .single();
  if (projectError || !project?.site_id) {
    throw new Error('Canonical project site identity is unavailable.');
  }

  const manifest = input.manifest;
  if (manifest.siteId !== project.site_id) {
    throw new Error('Sealed runtime site identity does not match the canonical project.');
  }

  const { data, error } = await supabase.functions.invoke('reconcile-generated-runtime', {
    body: {
      businessId: input.identity.businessId,
      projectId: input.identity.projectId,
      manifest,
    },
  });
  if (error || !data?.success) {
    throw new Error(error?.message || 'Generated runtime reconciliation failed.');
  }
  return manifest;
}

export async function hashVfsFiles(files: Record<string, string>): Promise<string> {
  try {
    const sortedKeys = Object.keys(files).sort();
    const payload = sortedKeys.map((k) => `${k}\0${files[k]}`).join('\n');
    const enc = new TextEncoder().encode(payload);
    const subtle =
      typeof globalThis !== 'undefined' && (globalThis.crypto as Crypto | undefined)?.subtle;
    if (subtle) {
      const buf = await subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    /* fall through */
  }
  // Fallback: cheap non-crypto hash (only used in environments lacking SubtleCrypto).
  let h = 5381;
  const sortedKeys = Object.keys(files).sort();
  for (const k of sortedKeys) {
    const s = `${k}\0${files[k]}`;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return `fallback-${(h >>> 0).toString(16)}`;
}

const PERSIST_RECOVERY_DELAYS_MS = [0, 500, 1_000, 2_000, 3_000, 5_000] as const;

function isRecoverablePersistTimeout(error: { message?: string } | null): boolean {
  return /upstream request timeout|gateway timeout|request timed out|\btimeout\b|\b504\b/i.test(
    error?.message ?? '',
  );
}

function isLegacyCanonicalVfsContractError(error: { message?: string } | null): boolean {
  return /Canonical runtime VFS must exactly match SiteBundleSnapshot\.vfsFiles/i.test(
    error?.message ?? '',
  );
}

function projectRuntimeVfs(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(files).filter(([path]) => (
    !path.startsWith('/.unison/') && !path.startsWith('.unison/')
  )));
}

async function recoverTimedOutRevision(args: {
  projectId: string;
  draftId: string;
  vfsHash: string;
  parentRevisionId: string | null;
}): Promise<string | null> {
  for (const delayMs of PERSIST_RECOVERY_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, delayMs));
    }
    let query = supabase
      .from('site_revisions')
      .select('id')
      .eq('project_id', args.projectId)
      .eq('draft_id', args.draftId)
      .eq('status', 'committed')
      .eq('vfs_hash', args.vfsHash);
    query = args.parentRevisionId
      ? query.eq('parent_revision_id', args.parentRevisionId)
      : query.is('parent_revision_id', null);
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) continue;
    const revisionId = (data as { id?: unknown } | null)?.id;
    if (typeof revisionId === 'string' && revisionId) return revisionId;
  }
  return null;
}

function compactPatchForPersistence(
  patch: PatchPlan,
  operationIds: string[],
  fileProvenance: FileProvenanceMap,
  candidateId: string | null,
  vfsDelta: { files: Record<string, string>; deletedPaths: string[] },
): Record<string, unknown> {
  return {
    ...patch,
    fileOps: patch.fileOps.map((operation) => {
      if (operation.type === 'create' || operation.type === 'replace') {
        return {
          type: operation.type,
          path: operation.path,
          contentLength: operation.contents.length,
        };
      }
      return operation;
    }),
    operationIds,
    _commitMetadata: {
      candidateId,
      operationIds,
      fileProvenance,
      vfsDelta,
    },
  };
}

function buildVfsDelta(
  previousFiles: Record<string, string>,
  nextFiles: Record<string, string>,
): { files: Record<string, string>; deletedPaths: string[] } {
  const files: Record<string, string> = {};
  const deletedPaths: string[] = [];
  for (const path of new Set([...Object.keys(previousFiles), ...Object.keys(nextFiles)])) {
    if (!(path in nextFiles)) {
      deletedPaths.push(path);
    } else if (previousFiles[path] !== nextFiles[path]) {
      files[path] = nextFiles[path];
    }
  }
  return { files, deletedPaths: deletedPaths.sort() };
}

async function finalize(args: {
  input: CommitMutationInput;
  status: 'committed' | 'rejected';
  vfsFiles: Record<string, string>;
  siteBundleSnapshot: SiteBundleSnapshot | null;
  runtimeManifest: RuntimeManifest | null;
  playground: PlaygroundState | null;
  readinessReport: Record<string, unknown>;
  publishReady: boolean;
  publishBlockers: PublishBlockerSummary[];
  vfsHash: string;
  backendOpsApplied: unknown[];
  dataOpsApplied: DataOpExecutionResult[];
  diagnostics: CommitDiagnostic[];
  parentRevisionId: string | null;
  rejectMessage: string | null;
}): Promise<CommitMutationResult> {
  const {
    input,
    status,
    vfsFiles,
    siteBundleSnapshot,
    runtimeManifest,
    playground,
    readinessReport,
    publishReady,
    publishBlockers,
    vfsHash,
    backendOpsApplied,
    dataOpsApplied,
    diagnostics,
    parentRevisionId,
    rejectMessage,
  } = args;
  let snapshotForRevision = siteBundleSnapshot;

  let persistedRevisionId: string | null = null;
  const dryRun = input.options?.dryRun === true;
  const candidateId = input.patch.candidate?.id ?? null;
  const requestedOperationIds = input.patch.operationIds
    ?.map((id) => id.trim())
    .filter(Boolean) ?? [];
  const operationIds = [...new Set(requestedOperationIds.length > 0
    ? requestedOperationIds
    : [candidateId ? `ai-candidate:${candidateId}` : `mutation:${generateUUID()}`])];
  const parentRevision = parentRevisionId ? await loadRevision(parentRevisionId) : null;
  const explicitlyAuthoredPaths = new Set(input.patch.fileOps.map((operation) => normalizeAuthoredPath(operation.path)));
  let fileProvenance = await buildFileProvenance({
    // The durable parent, not a potentially overlaid local VFS, defines the
    // prior bytes and hashes for this accepted revision.
    previousFiles: parentRevision?.vfsFiles ?? input.current.vfsFiles,
    files: vfsFiles,
    previousProvenance: parentRevision?.fileProvenance,
    parentRevisionId,
    source: input.source,
    operationIds,
    candidateId,
    compilerOwnedPaths: [
      '/.unison/**',
      '/src/unison/**',
      '/src/integrations/**',
      '/src/App.tsx',
      ...[...compilerOwnedGeneratedPaths({ ...input.current.vfsFiles, ...vfsFiles })]
        .filter((path) => !explicitlyAuthoredPaths.has(normalizeAuthoredPath(path))),
    ],
  });

  if (status === 'committed' && snapshotForRevision && !dryRun) {
    const effectiveComposition = await projectEffectiveComposition({
      pages: snapshotForRevision.pageRegistry?.pages ?? {},
      files: vfsFiles,
      fileProvenance,
      bindings: snapshotForRevision.bindings,
      baseRevisionId: parentRevisionId,
      vfsHash,
      hashSource: (path, source) => hashVfsFiles({ [path]: source }),
    });
    snapshotForRevision = {
      ...snapshotForRevision,
      meta: { ...snapshotForRevision.meta, effectiveComposition },
    };
  }

  if (!dryRun) {
    // Durability floor: never persist a revision that blanks a project whose
    // parent had real source (the Oct 6 blank-draft failure mode).
    const parentFiles = parentRevision?.vfsFiles ?? input.current.vfsFiles ?? {};
    const hadEntry = Boolean(parentFiles['/src/App.tsx']?.trim());
    if (hadEntry && !input.options?.explicitAuthorityReset && !vfsFiles['/src/App.tsx']?.trim()) {
      recordCommitOutcome({ source: input.source, outcome: 'threw', vfsHash, revisionId: null, draftId: input.identity.draftId || null, dryRun });
      throw new Error('[VFSCommitService] refusing to save a revision that would erase the project entry file.');
    }
    const vfsDelta = buildVfsDelta(parentRevision?.vfsFiles ?? {}, vfsFiles);
    const patchForPersistence = compactPatchForPersistence(
      input.patch,
      operationIds,
      fileProvenance,
      candidateId,
      vfsDelta,
    );
    const breakerKey = input.identity.draftId || input.identity.projectId || 'anonymous';
    const breakerSignature = `${parentRevisionId ?? ''}:${vfsHash}`;
    const blockedReason = persistCircuitBlockReason(breakerKey, breakerSignature);
    if (blockedReason) {
      diagnostics.push({ stage: 'persist', level: 'error', message: 'canonical revision transaction throttled', detail: blockedReason });
      recordCommitOutcome({ source: input.source, outcome: 'threw', vfsHash, revisionId: null, draftId: input.identity.draftId || null, dryRun });
      throw new Error(`[VFSCommitService] canonical revision transaction failed: ${blockedReason}`);
    }
    PERSIST_IN_FLIGHT.add(breakerKey);
    let rpcResult: { data: unknown; error: { message?: string } | null };
    try {
      const siteBundleSnapshotPayload = snapshotForRevision
        ? Object.fromEntries(Object.entries(snapshotForRevision).filter(([key]) => key !== 'vfsFiles'))
        : {};
      const compactRpcPayload = {
        p_project_id: input.identity.projectId,
        p_business_id: input.identity.businessId,
        p_draft_id: input.identity.draftId,
        p_parent_revision_id: parentRevisionId,
        p_source: input.source,
        p_status: status,
        p_patch_json: patchForPersistence,
        p_vfs_files: vfsDelta.files,
        p_site_bundle_snapshot: siteBundleSnapshotPayload,
        p_runtime_manifest: runtimeManifest ?? {},
        p_playground_state: playground ?? {},
        p_readiness_report: readinessReport,
        p_diagnostics: diagnostics,
        p_publish_ready: publishReady,
        p_publish_blockers: publishBlockers,
        p_backend_ops_applied: backendOpsApplied,
        p_vfs_hash: vfsHash,
        p_active_page_path: input.current.activePagePath ?? null,
      };
      // The commit RPC is idempotent for a given (vfs_hash, parent) pair, so a
      // gateway/statement timeout that did NOT commit can be retried safely.
      // Large sites serialize multi-MB JSONB payloads; a single slow attempt
      // must not fail the whole mutation.
      const PERSIST_RPC_ATTEMPTS = 3;
      rpcResult = { data: null, error: { message: 'canonical revision transaction not attempted' } };
      for (let attempt = 0; attempt < PERSIST_RPC_ATTEMPTS; attempt += 1) {
        if (attempt > 0) {
          await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 1_000 * attempt));
          diagnostics.push({
            stage: 'persist',
            level: 'warn',
            message: 'canonical revision transaction timed out; retrying',
            detail: { attempt: attempt + 1, maxAttempts: PERSIST_RPC_ATTEMPTS },
          });
        }
        try {
          rpcResult = await (supabase.rpc as any)('commit_canonical_site_revision_v2', compactRpcPayload);
          if (rpcResult.error && isLegacyCanonicalVfsContractError(rpcResult.error)) {
            rpcResult = await (supabase.rpc as any)('commit_canonical_site_revision_v2', {
              ...compactRpcPayload,
              p_vfs_files: vfsFiles,
              p_site_bundle_snapshot: {
                ...siteBundleSnapshotPayload,
                vfsFiles: projectRuntimeVfs(vfsFiles),
              },
            });
          }
        } catch (rpcError) {
          rpcResult = { data: null, error: { message: rpcError instanceof Error ? rpcError.message : String(rpcError) } };
        }
        if (!rpcResult.error || !isRecoverablePersistTimeout(rpcResult.error)) break;
        // A timeout is ambiguous: the transaction may have committed after the
        // gateway gave up. Reconcile before retrying so we never double-commit.
        const recoveredRevisionId = await recoverTimedOutRevision({
          projectId: input.identity.projectId,
          draftId: input.identity.draftId,
          vfsHash,
          parentRevisionId,
        });
        if (recoveredRevisionId) {
          rpcResult = { data: recoveredRevisionId, error: null };
          break;
        }
      }
    } catch (rpcError) {
      rpcResult = { data: null, error: { message: rpcError instanceof Error ? rpcError.message : String(rpcError) } };
    }
    // Keep the draft locked while an ambiguous timeout is reconciled.
    try {
      let { data, error } = rpcResult;
      if (error && isRecoverablePersistTimeout(error)) {
        const recoveredRevisionId = await recoverTimedOutRevision({
          projectId: input.identity.projectId,
          draftId: input.identity.draftId,
          vfsHash,
          parentRevisionId,
        });
        if (recoveredRevisionId) {
          diagnostics.push({
            stage: 'persist',
            level: 'warn',
            message: 'canonical revision response timed out after commit; recovered committed revision',
            detail: { revisionId: recoveredRevisionId },
          });
          data = recoveredRevisionId;
          error = null;
        }
      }
      if (error || typeof data !== 'string' || !data) {
        recordPersistFailure(breakerKey, breakerSignature);
        const detail = error?.message || 'atomic commit returned no revision id';
        diagnostics.push({
          stage: 'persist',
          level: 'error',
          message: 'canonical revision transaction failed',
          detail,
        });
        recordCommitOutcome({
          source: input.source,
          outcome: 'threw',
          vfsHash,
          revisionId: null,
          draftId: input.identity.draftId || null,
          dryRun,
        });
        throw new Error(`[VFSCommitService] canonical revision transaction failed: ${detail}`);
      }

      PERSIST_FAILURES.delete(breakerKey);
      persistedRevisionId = data;
    } finally {
      PERSIST_IN_FLIGHT.delete(breakerKey);
    }
    fileProvenance = stampAcceptedRevision(fileProvenance, persistedRevisionId);

    // Move F #1 — fire-and-forget commit telemetry. Never block on failure.
    try {
      void supabase.from('ai_events').insert({
        kind: 'vfs_commit',
        business_id: input.identity.businessId,
        user_id: input.identity.userId,
        payload: {
          revisionId: persistedRevisionId,
          parentRevisionId,
          draftId: input.identity.draftId,
          projectId: input.identity.projectId,
          source: input.source,
          status,
          publishReady,
          publishBlockerCount: publishBlockers.length,
          vfsHash,
          candidateId,
          operationIds,
          diagnostics: diagnostics.slice(-20),
        } as unknown as Record<string, unknown>,
      });
    } catch {
      /* telemetry is best-effort */
    }

    // Notify in-process listeners (e.g. WebBuilder's ledger element-readiness
    // hook, RevisionLedgerStatus) that a new committed revision exists so they
    // can refetch without waiting for their polling interval.
    if (persistedRevisionId && typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent('unison:ledger-updated', {
            detail: {
              projectId: input.identity.projectId,
              revisionId: persistedRevisionId,
              source: input.source,
              publishReady,
            },
          }),
        );
      } catch {
        /* event dispatch is best-effort */
      }
    }
  }

  // Phase 0B — instrumentation: every canonical outcome is provably attributed
  // to a mutation source, so a bypass shows up as an adoption with no commit.
  recordCommitOutcome({
    source: input.source,
    outcome: status === 'committed' ? 'committed' : 'rejected',
    vfsHash,
    revisionId: persistedRevisionId,
    draftId: input.identity.draftId || null,
    dryRun,
  });

  const acceptedAuthority = snapshotForRevision && status === 'committed'
    ? authorityAfterAcceptedCommit(
        deriveAuthorshipAuthority({ snapshot: snapshotForRevision, acceptedRevisionId: parentRevisionId }),
        input.source,
        input.source === 'wizard-launch' ? persistedRevisionId : undefined,
      )
    : null;
  const returnedSnapshot = snapshotForRevision && acceptedAuthority
    ? stampSnapshotAuthority(snapshotForRevision, acceptedAuthority)
    : snapshotForRevision;
  const result: CommitMutationResult = {

    status,
    source: input.source,
    identity: {
      ...input.identity,
      revisionId: persistedRevisionId ?? input.identity.revisionId,
    },
    vfsFiles,
    siteBundleSnapshot: returnedSnapshot,
    runtimeManifest,
    playground,
    readinessReport,
    diagnostics,
    persistedRevisionId,
    parentRevisionId,
    committedAt: new Date().toISOString(),
    publishReady,
    publishBlockers,
    vfsHash,
    candidateId,
    operationIds,
    dataOpsApplied,
    fileProvenance,
  };

  if (status === 'rejected') {
    throw new CommitRejectedError(rejectMessage ?? 'commit rejected', result);
  }
  return result;
}

// ----------------------------------------------------------------------------
// Revision loading — WebBuilder hydration prefers this over sessionStorage.
// ----------------------------------------------------------------------------

export interface LoadedRevision {
  id: string;
  projectId: string;
  businessId: string;
  draftId: string;
  source: PatchSource;
  status: 'committed' | 'rejected' | 'quarantined';
  vfsFiles: Record<string, string>;
  siteBundleSnapshot: unknown;
  runtimeManifest: unknown;
  playground: PlaygroundState | null;
  readinessReport: Record<string, unknown>;
  diagnostics: CommitDiagnostic[];
  publishReady: boolean;
  publishBlockers: PublishBlockerSummary[];
  vfsHash: string | null;
  candidateId: string | null;
  operationIds: string[];
  fileProvenance: FileProvenanceMap;
  createdAt: string;
  /** Revision this one was committed on top of (null for the first). */
  parentRevisionId?: string | null;
  /** Human-readable checkpoint label (patch summary), when recorded. */
  label?: string | null;
  /** Whether the stored effective composition is database-stamped for this exact row. */
  compositionAuthority?: EffectiveCompositionAuthority;
}

/**
 * Session cache of full revision rows. Heavy payload columns are reused only
 * after a cheap summary read confirms the revision still has the same
 * vfs_hash; every summary column is always taken from the fresh read, so
 * status/readiness changes are never served stale.
 */
// Persist circuit breaker. Every durable write funnels through one RPC, so a
// caller that re-fires a permanently failing save (feedback loop, stale tab)
// must be stopped here: identical failed payloads cool down with backoff and a
// draft never has overlapping writes queued against its row lock.
const PERSIST_IN_FLIGHT = new Set<string>();
const PERSIST_FAILURES = new Map<string, { signature: string; count: number; until: number }>();
const PERSIST_BACKOFF_BASE_MS = 2_000;
const PERSIST_BACKOFF_MAX_MS = 60_000;

function persistCircuitBlockReason(key: string, signature: string): string | null {
  if (PERSIST_IN_FLIGHT.has(key)) {
    return 'another save for this project is still in progress';
  }
  const failure = PERSIST_FAILURES.get(key);
  if (failure && failure.signature === signature && Date.now() < failure.until) {
    return `the same save just failed; retry in ${Math.ceil((failure.until - Date.now()) / 1000)}s`;
  }
  return null;
}

function recordPersistFailure(key: string, signature: string): void {
  const previous = PERSIST_FAILURES.get(key);
  const count = previous && previous.signature === signature ? previous.count + 1 : 1;
  const wait = Math.min(PERSIST_BACKOFF_MAX_MS, PERSIST_BACKOFF_BASE_MS * 2 ** (count - 1));
  PERSIST_FAILURES.set(key, { signature, count, until: Date.now() + wait });
}

/** Test seam: clears persist breaker state between cases. */
export function __resetPersistCircuitForTests(): void {
  PERSIST_IN_FLIGHT.clear();
  PERSIST_FAILURES.clear();
  DRAFT_COMMIT_TAILS.clear();
  LATEST_QUEUED_COMMITS.clear();
}

const REVISION_ROW_CACHE = new Map<string, Record<string, unknown>>();
const REVISION_ROW_CACHE_MAX = 16;

export async function loadRevision(revisionId: string): Promise<LoadedRevision | null> {
  const cached = REVISION_ROW_CACHE.get(revisionId);
  if (cached && typeof cached.vfs_hash === 'string' && cached.vfs_hash) {
    const { data: summary, error: summaryError } = await supabase
      .from('site_revisions')
      .select(REVISION_SUMMARY_COLUMNS)
      .eq('id', revisionId)
      .maybeSingle();
    if (summaryError || !summary) {
      REVISION_ROW_CACHE.delete(revisionId);
      if (!summaryError) return null;
    } else if ((summary as Record<string, unknown>).vfs_hash === cached.vfs_hash) {
      const merged = { ...cached, ...(summary as Record<string, unknown>) };
      REVISION_ROW_CACHE.delete(revisionId);
      REVISION_ROW_CACHE.set(revisionId, merged);
      return withRebuiltComposition(mapRevisionRow(merged));
    } else {
      REVISION_ROW_CACHE.delete(revisionId);
    }
  }
  const { data, error } = await supabase
    .from('site_revisions')
    .select('*')
    .eq('id', revisionId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  REVISION_ROW_CACHE.set(revisionId, row);
  if (REVISION_ROW_CACHE.size > REVISION_ROW_CACHE_MAX) {
    const oldest = REVISION_ROW_CACHE.keys().next().value;
    if (oldest) REVISION_ROW_CACHE.delete(oldest);
  }
  return withRebuiltComposition(mapRevisionRow(row));
}

export async function loadLatestRevisionForProject(
  projectId: string,
): Promise<LoadedRevision | null> {
  const { data, error } = await supabase
    .from('site_revisions')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'committed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return withRebuiltComposition(mapRevisionRow(data as Record<string, unknown>));
}

async function loadNewestCommittedRevisionForDraft(
  projectId: string,
  draftId: string,
): Promise<LoadedRevision | null> {
  const { data, error } = await supabase
    .from('site_revisions')
    .select('*')
    .eq('project_id', projectId)
    .eq('draft_id', draftId)
    .eq('status', 'committed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const loaded = mapRevisionRow(data as Record<string, unknown>);
  if (!Object.keys(loaded.vfsFiles || {}).length) return null;
  console.warn(`[VFSCommitService] draft ${draftId} pointer missing/invalid; recovered newest own committed revision ${loaded.id}`);
  return loaded;
}

/** Load only the committed revision selected by the durable draft projection. */
export async function loadProjectedRevisionForDraft(
  projectId: string,
  draftId: string,
): Promise<LoadedRevision> {
  const { data: draft, error: draftError } = await (supabase
    .from('builder_drafts') as any)
    .select('last_revision_id')
    .eq('id', draftId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (draftError) throw draftError;
  if (!draft) {
    throw new Error(`[VFSCommitService] canonical draft ${draftId} was not found for project ${projectId}`);
  }
  if (typeof draft.last_revision_id !== 'string' || !draft.last_revision_id) {
    // Self-heal (read-only): a lost pointer must not blank a draft that still
    // owns committed revisions. Only this draft's own revisions qualify.
    const recovered = await loadNewestCommittedRevisionForDraft(projectId, draftId);
    if (recovered) return recovered;
    throw new Error(`[VFSCommitService] canonical draft ${draftId} has no committed revision projection`);
  }

  const { data: revision, error: revisionError } = await supabase
    .from('site_revisions')
    .select('*')
    .eq('id', draft.last_revision_id)
    .eq('project_id', projectId)
    .eq('draft_id', draftId)
    .eq('status', 'committed')
    .maybeSingle();
  if (revisionError) throw revisionError;
  if (!revision) {
    const recovered = await loadNewestCommittedRevisionForDraft(projectId, draftId);
    if (recovered) return recovered;
    throw new Error(`[VFSCommitService] draft ${draftId} points to an invalid committed revision`);
  }
  const loaded = mapRevisionRow(revision as Record<string, unknown>);
  return loaded;
}

// Columns for list views: everything except the heavy file/snapshot payloads.
const REVISION_SUMMARY_COLUMNS =
  'id, project_id, business_id, draft_id, parent_revision_id, source, status, readiness_report, diagnostics, publish_ready, publish_blockers, vfs_hash, candidate_id, operation_ids, created_at, patch_summary:patch_json->>summary';

/**
 * Move D — publish flow loads the latest revision whose publish gate +
 * element + intent readiness all passed. Returns null when none exist; the
 * publish UI must refuse to deploy in that case.
 */
export async function loadLatestPublishReadyRevisionForProject(
  projectId: string,
): Promise<LoadedRevision | null> {
  const { data, error } = await supabase
    .from('site_revisions')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'committed')
    .eq('publish_ready', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return withRebuiltComposition(mapRevisionRow(data as Record<string, unknown>));
}

/**
 * Lightweight history feed for the Ledger panel — newest first. Returns the
 * same `LoadedRevision` shape but caps the result count for UI use.
 */
export async function listRecentRevisionsForProject(
  projectId: string,
  limit = 10,
): Promise<LoadedRevision[]> {
  // History feed is summary-only; restore loads the full row by id.
  const { data, error } = await supabase
    .from('site_revisions')
    .select(REVISION_SUMMARY_COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRevisionRow);
}

/**
 * P1 — on open, a committed revision whose design index is not proven gets an
 * in-memory index rebuilt from its saved files. It stays `provisional` (no
 * revisionId stamp) until a new save is stamped by the database.
 */
export async function withRebuiltComposition(revision: LoadedRevision): Promise<LoadedRevision> {
  if (revision.status !== 'committed') return revision;
  const actualVfsHash = await hashVfsFiles(revision.vfsFiles);
  const sourceHashMatches = Boolean(revision.vfsHash && actualVfsHash === revision.vfsHash);
  const authority = sourceHashMatches
    ? revision.compositionAuthority ?? {
        status: 'provisional' as const, reason: 'absent' as const, revisionId: null,
        uncertainPages: [], complete: false,
      }
    : {
        status: 'provisional' as const, reason: 'vfs-hash-mismatch' as const, revisionId: null,
        uncertainPages: [], complete: false,
      };
  if (sourceHashMatches && authority.status === 'durable') return revision;
  const snapshot = revision.siteBundleSnapshot as { meta?: Record<string, unknown>; pageRegistry?: { pages?: Record<string, { filePath?: string | null }> }; bindings?: Record<string, never> } | null;
  if (!snapshot || !snapshot.pageRegistry?.pages) return revision;
  try {
    const projection = await projectEffectiveComposition({
      pages: snapshot.pageRegistry.pages,
      files: revision.vfsFiles,
      fileProvenance: revision.fileProvenance as never,
      bindings: snapshot.bindings,
      baseRevisionId: revision.parentRevisionId,
      vfsHash: actualVfsHash,
      hashSource: (path, source) => hashVfsFiles({ [path]: source }),
    });
    const { revisionId: _unstamped, ...provisional } = projection;
    const uncertainPages = Object.entries(provisional.pages)
      .filter(([, page]) => Array.isArray(page?.uncertain) && page.uncertain.length > 0)
      .map(([id]) => id).sort();
    return {
      ...revision,
      siteBundleSnapshot: { ...snapshot, meta: { ...(snapshot.meta ?? {}), effectiveComposition: provisional } },
      compositionAuthority: { ...authority, status: 'provisional', revisionId: null, uncertainPages, complete: false, rebuilt: true },
    };
  } catch {
    return revision;
  }
}

function mapRevisionRow(row: Record<string, unknown>): LoadedRevision {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    businessId: String(row.business_id),
    draftId: String(row.draft_id),
    source: row.source as PatchSource,
    status: row.status as LoadedRevision['status'],
    vfsFiles: (row.vfs_files ?? {}) as Record<string, string>,
    siteBundleSnapshot: row.site_bundle_snapshot ?? null,
    runtimeManifest: row.runtime_manifest ?? null,
    playground: (row.playground_state ?? null) as PlaygroundState | null,
    readinessReport: (row.readiness_report ?? {}) as Record<string, unknown>,
    diagnostics: (row.diagnostics ?? []) as CommitDiagnostic[],
    publishReady: row.publish_ready === true,
    publishBlockers: (row.publish_blockers ?? []) as PublishBlockerSummary[],
    vfsHash: (row.vfs_hash as string | null) ?? null,
    candidateId: (row.candidate_id as string | null) ?? null,
    operationIds: Array.isArray(row.operation_ids)
      ? row.operation_ids.filter((id): id is string => typeof id === 'string')
      : [],
    fileProvenance: (row.file_provenance ?? {}) as FileProvenanceMap,
    createdAt: String(row.created_at),
    parentRevisionId: (row.parent_revision_id as string | null) ?? null,
    label: typeof row.patch_summary === 'string'
      ? row.patch_summary
      : typeof (row.patch_json as { summary?: unknown } | null)?.summary === 'string'
        ? String((row.patch_json as { summary: string }).summary)
        : null,
    // Summary rows carry no snapshot; only full rows can prove durable authority.
    ...('site_bundle_snapshot' in row ? {
      compositionAuthority: assessEffectiveCompositionAuthority({
        id: String(row.id),
        status: row.status as string,
        vfsHash: (row.vfs_hash as string | null) ?? null,
        parentRevisionId: (row.parent_revision_id as string | null) ?? null,
        siteBundleSnapshot: row.site_bundle_snapshot ?? null,
      }),
    } : {}),
  };
}

// ----------------------------------------------------------------------------
// Ledger loop closers — restore a prior revision + stamp a republish event.
// Both flow through (or write to) the same durable surfaces as commitMutation
// so history, drift detection, and telemetry stay coherent.
// ----------------------------------------------------------------------------

/**
 * Roll a prior revision forward as a NEW committed revision with
 * source='system-restore'. The full file map of the target revision becomes a
 * single replace-all PatchPlan; the canonical pipeline, gates, readiness, and
 * persistence all run again so the restored state is judged on its own merits
 * (no blind trust in the historical row).
 */
export async function restoreRevision(args: {
  targetRevisionId: string;
  identity: BuilderIdentity;
  /** Optional checkpoint label recorded on the new revision. */
  label?: string;
}): Promise<CommitMutationResult> {
  const target = await loadRevision(args.targetRevisionId);
  if (!target) {
    throw new Error(`[VFSCommitService] restoreRevision: revision ${args.targetRevisionId} not found`);
  }
  if (target.projectId !== args.identity.projectId) {
    throw new Error(
      `[VFSCommitService] restoreRevision: revision ${args.targetRevisionId} belongs to a different project`,
    );
  }

  const fileOps = Object.entries(target.vfsFiles).map(([path, contents]) => ({
    type: 'replace' as const,
    path,
    contents,
  }));


  return commitMutation({
    source: 'system-restore',
    identity: args.identity,
    current: {
      vfsFiles: {},
      playground: target.playground ?? undefined,
      siteBundleSnapshot: target.siteBundleSnapshot,
    },
    patch: {
      ...emptyPatchPlan(),
      fileOps,
      summary: args.label ?? `Restored checkpoint ${args.targetRevisionId.slice(0, 8)}`,
      reason: `restore:${args.targetRevisionId}`,
    } as PatchPlan,
    // Same rule as every Builder save: the preview must pass; publish
    // readiness (unfinished bindings) blocks publishing, never a restore of a
    // revision that was itself accepted.
    options: { restoreRevisionId: args.targetRevisionId, requireReadinessPass: false },
  });
}

/**
 * Stamp a successful publish back into the ledger surfaces. Writes a
 * fire-and-forget `ai_events` row tying the deploy URL + provider to the
 * publish-ready revision the deployment actually shipped — so the drift
 * watcher, RevisionLedgerStatus, and any future ops panel can answer
 * "which revision is live right now?" deterministically.
 */
export async function recordRepublishEvent(args: {
  revisionId: string;
  projectId: string;
  businessId: string;
  userId: string | null;
  provider: string;
  url?: string | null;
  vfsHash?: string | null;
}): Promise<void> {
  try {
    await supabase.from('ai_events').insert({
      kind: 'vfs_republish',
      business_id: args.businessId,
      user_id: args.userId,
      payload: {
        revisionId: args.revisionId,
        projectId: args.projectId,
        provider: args.provider,
        url: args.url ?? null,
        vfsHash: args.vfsHash ?? null,
        at: new Date().toISOString(),
      } as unknown as Record<string, unknown>,
    });
  } catch {
    /* telemetry is best-effort */
  }
}
