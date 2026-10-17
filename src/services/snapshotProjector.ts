/**
 * SnapshotProjector — single source of truth for projecting preview artifacts
 * from a SiteBundleSnapshot. Replaces the four independent fallback paths
 * (hardcoded aesthetic palettes, prose fallbacks, CSS-in-TSX wraps, missing-App
 * proxies, and SEMANTIC_CSS_VARS) with deterministic projections.
 *
 * Behavior:
 *   • Wizard draft (SiteBundleSnapshot or /.unison/wizard-seed.json present) + snapshot present
 *       → project theme CSS and router from snapshot.
 *   • Wizard draft + snapshot ABSENT
 *       → throw PreviewPipelineError. The runtime cannot fabricate the wizard's choices.
 *   • Blank draft (no launchState, no wizard/sitebundle evidence)
 *       → allow only Tailwind boilerplate CSS. No App/template is fabricated.
 */
import { rebaseTextEdit } from '@/services/builder/textEditRebase';
import type { LaunchState } from '@/types/launchState';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import {
  buildThemedIndexCss,
} from '@/components/onboarding/themePresetToIndexCss';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { PreviewPipelineError } from './previewPipelineError';
import { CanonicalRuntimeError } from '@/platform/core/canonicalRuntimeError';
import { assertSnapshotThemeSeed, assertThemeSeed } from '@/platform/core/themeSeedAssert';
import { isSealedSnapshot } from '@/platform/core/snapshotSeal';

const SNAPSHOT_VFS_PATH = '/.unison/site-bundle-snapshot.json';
const WIZARD_SEED_VFS_PATH = '/.unison/wizard-seed.json';

/** Heuristic to detect already-themed CSS so we don't clobber AI/builder edits. */
const TOKEN_PROBE_RE = /--primary\s*:/;

export interface SnapshotResolution {
  snapshot: SiteBundleSnapshot | null;
  isWizardDraft: boolean;
  themePresetId: string | null;
  /** Draft/project identity prevents one editor's pending writes affecting another. */
  projectionScope?: string | null;
  /** Accepted revision whose files are carried by `snapshot`. */
  acceptedRevisionId?: string | null;
  /**
   * True when `snapshot` was parsed from the live VFS's own
   * `/.unison/site-bundle-snapshot.json`. Its embedded `vfsFiles` is then a
   * copy of the same working tree, which only refreshes at some commits.
   */
  snapshotFromLiveVfs?: boolean;
}

const MINIMAL_PREVIEW_FALLBACK_RE = /return\s+<div>\s*Placeholder|return\s+<main>\s*Placeholder|Canonical\s+\w+\s+Stub|Canonical\s+\w+\s+Fallback|Generated\s+Home|Preview recovered|safe fallback was injected|AI-generated code will appear here|Welcome to AI Web Builder|New site preview|Coming soon|fallback keeps the experience polished/i;

export function isMinimalPreviewFallbackSource(content: string | undefined): boolean {
  if (!content) return false;
  const compact = content.replace(/\s+/g, ' ').trim();
  return MINIMAL_PREVIEW_FALLBACK_RE.test(compact);
}

function tryParseSnapshot(raw: string | undefined): SiteBundleSnapshot | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as SiteBundleSnapshot;
  } catch {
    return null;
  }
}

function hasSnapshotVfs(snapshot: SiteBundleSnapshot | null): snapshot is SiteBundleSnapshot {
  return !!snapshot && Object.keys(snapshot.vfsFiles || {}).length > 0;
}

/**
 * Resolve the authoritative SiteBundleSnapshot from either the live LaunchState
 * or the persisted /.unison/site-bundle-snapshot.json. Wizard classification is
 * strict: only snapshot/seed/explicit wizard-selection metadata counts. Bare
 * LaunchState or generated `/src/pages/*` files are not enough, because that
 * cold-hydration shortcut was the path that allowed minimal templates to render.
 */
export function resolveSnapshot(
  sourceFiles: Record<string, string>,
  launchState?: LaunchState | null,
): SnapshotResolution {
  const snapshotFromVfs = tryParseSnapshot(sourceFiles[SNAPSHOT_VFS_PATH]);
  const snapshotFromState = launchState?.siteBundleSnapshot ?? null;
  // Prefer a full snapshot VFS from the live VFS, then from navigation state.
  // Compact launcher handoffs intentionally store the snapshot VFS once at the
  // route VFS level; hydrate only when that explicit marker is present. An old
  // metadata-only snapshot must fail closed, not let a template preset render.
  const compactSnapshot = snapshotFromVfs || snapshotFromState;
  const snapshot = hasSnapshotVfs(snapshotFromVfs)
    ? snapshotFromVfs
    : hasSnapshotVfs(snapshotFromState)
      ? snapshotFromState
      : (compactSnapshot && (launchState as { snapshotVfsCompacted?: unknown } | null)?.snapshotVfsCompacted === true
        ? { ...compactSnapshot, vfsFiles: { ...sourceFiles } }
        : null);

  const appContext = tryParseRecord(sourceFiles['/.unison/app-context.json']);
  const runtimeManifest = tryParseRecord(sourceFiles['/.unison/runtime-manifest.json']);
  const canonicalPlayground = tryParseRecord(sourceFiles['/.unison/canonical-playground.json']);
  const runtimeAppContext = readRecord(runtimeManifest?.appContext);

  const hasWizardSeed = Boolean(sourceFiles[WIZARD_SEED_VFS_PATH]);
  const hasExplicitWizardMetadata = Boolean(
    appContext?.wizardSelections ||
    runtimeAppContext?.wizardSelections ||
    appContext?.wizardSeedId ||
    runtimeAppContext?.wizardSeedId ||
    readRecord(canonicalPlayground?.wizardSelections),
  );

  // Phase 0A provenance: a snapshot minted for a manual/legacy-import draft
  // shares the SiteBundleSnapshot shape but must never inherit Wizard
  // guarantees purely from that shape.
  const snapshotOrigin =
    (snapshot?.meta as { snapshotOrigin?: string } | undefined)?.snapshotOrigin ?? null;
  const isNonWizardOrigin = snapshotOrigin === 'manual' || snapshotOrigin === 'legacy-import';

  const isWizardDraft = Boolean(
    !isNonWizardOrigin &&
    (snapshot ||
    compactSnapshot ||
    hasWizardSeed ||
    hasExplicitWizardMetadata),
  );
  if (snapshot && isWizardDraft && !isSealedSnapshot(snapshot)) {
    throw new PreviewPipelineError(
      'vfs',
      'Wizard preview hydration requires a committed sealed SiteBundleSnapshot.',
      { recoverableByRelaunch: true },
    );
  }


  const snapshotThemePresetId = snapshot
    ? assertSnapshotThemeSeed(
        snapshot,
        assertThemeSeed(snapshot.meta?.themePresetId, 'SiteBundleSnapshot -> snapshotProjector'),
        'SiteBundleSnapshot -> snapshotProjector',
      )
    : null;
  const candidateSeeds: Array<[string, unknown]> = [
    ['LaunchState', launchState?.themePresetId],
    ['RuntimeManifest', launchState?.runtimeManifest?.appContext?.themePresetId],
    ['app-context', appContext?.themePresetId],
    ['persisted runtime manifest', runtimeAppContext?.themePresetId],
  ];
  if (snapshotThemePresetId) {
    // The sealed SiteBundleSnapshot is authoritative after commit. Ambient
    // handoff carriers (navigation state, persisted app-context, runtime
    // manifest) can legitimately lag behind the newest committed snapshot
    // (e.g. a re-launch with a different Style card reuses an older route
    // state). That drift is stale provenance, not a mutated seed: reconcile
    // to the snapshot and warn instead of halting the preview pipeline.
    for (const [boundary, candidate] of candidateSeeds) {
      if (candidate === undefined || candidate === null) continue;
      const normalized = typeof candidate === 'string' ? candidate.trim() : '';
      if (!normalized) {
        console.warn(
          `[snapshotProjector] ${boundary} carries a non-string themePresetId; using sealed snapshot seed "${snapshotThemePresetId}".`,
        );
        continue;
      }
      if (normalized !== snapshotThemePresetId) {
        console.warn(
          `[snapshotProjector] Stale themePresetId "${normalized}" from ${boundary}; sealed snapshot seed "${snapshotThemePresetId}" wins.`,
        );
      }
    }
  }
  const themePresetId = snapshotThemePresetId;

  const state = launchState as (LaunchState & { draftId?: unknown; projectId?: unknown }) | null | undefined;
  const projectionScope = typeof state?.draftId === 'string' && state.draftId
    ? state.draftId
    : typeof state?.projectId === 'string' && state.projectId
      ? state.projectId
      : null;
  const acceptedRevisionId = typeof state?.revisionId === 'string' && state.revisionId.trim()
    ? state.revisionId.trim()
    : null;
  return {
    snapshot,
    isWizardDraft,
    themePresetId: themePresetId ?? null,
    projectionScope,
    acceptedRevisionId,
    snapshotFromLiveVfs: Boolean(snapshot && snapshot === snapshotFromVfs),
  };
}


/**
 * Project the canonical themed /src/index.css for the snapshot's themePresetId.
 * Returns null when no preset is resolvable (caller decides whether that is a
 * hard error for wizard drafts or acceptable for blank drafts).
 */
export function projectThemeCss(resolution: SnapshotResolution): string | null {
  const presetId = resolution.themePresetId;
  if (!presetId) return null;
  const preset = THEME_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  return buildThemedIndexCss(preset);
}

/**
 * If existing CSS already declares semantic tokens, return it unchanged.
 * Wizard drafts must bring injected VFS CSS from the SiteBundleSnapshot compile
 * stage; preview rendering is not allowed to synthesize themed CSS from a
 * preset because that masks a broken snapshot/seed chain of custody.
 * For blank drafts with no wizard evidence, return the minimal Tailwind shell.
 */
export function ensureSnapshotTokens(
  existingCss: string | undefined,
  resolution: SnapshotResolution,
): string {
  assertWizardSnapshotPresent(resolution, 'Preview CSS projection');

  const existing = existingCss ?? '';
  if (existing && TOKEN_PROBE_RE.test(existing)) {
    return existing;
  }

  if (existing && isLiveEditedVfsPath('/src/index.css', resolution.projectionScope)) {
    return existing;
  }

  if (resolution.isWizardDraft) {
    throw new PreviewPipelineError(
      'vfs',
      'Wizard draft is missing injected semantic /src/index.css from SiteBundleSnapshot; refusing to synthesize fallback preview CSS.',
      { recoverableByRelaunch: true },
    );
  }

  const projected = projectThemeCss(resolution);
  if (projected) return projected;
  return blankDraftTailwindCss();
}

/** Tailwind-only CSS for blank (non-wizard) drafts. No palette or template preset. */
export function blankDraftTailwindCss(): string {
  return `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`;
}

/**
 * Guard for wizard drafts that have no snapshot at all. Used by sandpackFilePrep
 * to refuse silently fabricating an App.tsx or theme CSS.
 */
export function assertWizardSnapshotPresent(
  resolution: SnapshotResolution,
  context: string,
): void {
  if (resolution.isWizardDraft && !resolution.snapshot) {
    throw new CanonicalRuntimeError({
      surface: 'preview',
      code: 'MISSING_SNAPSHOT',
      userMessage:
        'This project has not been launched yet. Unison needs a SiteBundleSnapshot before it can render a live business preview.',
      developerMessage: `${context} — Wizard draft is missing SiteBundleSnapshot. Re-run the System Launcher.`,
      recoveryActions: ['run-system-launcher', 'migrate-legacy-draft'],
    });
  }
}

/**
 * Registered wizard routes must be backed by real SiteBundleSnapshot page files.
 * This is the final runtime guard against old hardcoded/minimal preview shells
 * leaking into hash routes after VFS import, flattening, or handoff recovery.
 */
export function assertNoMinimalFallbackPreview(
  files: Record<string, string>,
  resolution: SnapshotResolution,
  context = 'Preview runtime',
): void {
  if (!resolution.isWizardDraft) return;
  assertWizardSnapshotPresent(resolution, context);

  const pages = Object.values(resolution.snapshot?.pageRegistry?.pages || {});
  for (const page of pages) {
    const filePath = (page as { filePath?: string }).filePath;
    if (!filePath) continue;
    const normalized = filePath.startsWith('/') ? filePath : `/${filePath}`;
    const flattened = normalized.replace(/^\/src\//, '/');
    const variants = [
      normalized,
      normalized.slice(1),
      flattened,
      flattened.slice(1),
    ];
    const source = variants
      .map((candidate) => files[candidate])
      .find((value): value is string => typeof value === 'string');

    if (!source || !source.trim()) {
      throw new PreviewPipelineError(
        'vfs',
        `${context} is missing registered SiteBundleSnapshot page ${normalized}; refusing to render a minimal fallback route.`,
        { blockedFiles: [normalized], recoverableByRelaunch: true },
      );
    }

    if (isMinimalPreviewFallbackSource(source)) {
      throw new PreviewPipelineError(
        'vfs',
        `${context} detected minimal/fallback scaffold copy in registered page ${normalized}; refusing to surface it in preview.`,
        { blockedFiles: [normalized], recoverableByRelaunch: true },
      );
    }
  }
}

/**
 * Verifies the Sandpack overlay still executes every PageRegistry route after
 * /src flattening and controlled-entry preparation. File presence alone is not
 * enough: an orphaned page module never reaches the preview iframe.
 */
export function assertSnapshotPreviewRouteReachability(
  files: Record<string, string>,
  resolution: SnapshotResolution,
  context = 'Preview route reachability',
): void {
  if (!resolution.isWizardDraft) return;
  assertWizardSnapshotPresent(resolution, context);

  const app = files['/App.tsx'] || files['/App.jsx'] || '';
  if (!app) {
    throw new PreviewPipelineError(
      'sandpack',
      `${context} is missing flattened /App.tsx router.`,
      { blockedFiles: ['/App.tsx'], recoverableByRelaunch: true },
    );
  }

  for (const page of Object.values(resolution.snapshot?.pageRegistry?.pages || {})) {
    const filePath = (page as { filePath?: string }).filePath;
    if (!filePath) continue;
    const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
    const flattenedPath = normalizedPath.replace(/^\/src\//, '/');
    const source = files[flattenedPath] || files[flattenedPath.slice(1)];
    if (!source || !source.trim()) {
      throw new PreviewPipelineError(
        'sandpack',
        `${context} dropped registered page ${normalizedPath} during VFS flattening.`,
        { blockedFiles: [normalizedPath], recoverableByRelaunch: true },
      );
    }

    const importPath = normalizedPath.replace(/^\/src\//, './').replace(/\.(tsx|jsx)$/i, '');
    const escapedImportPath = importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`from\\s*["']${escapedImportPath}(?:\\.(?:tsx|jsx))?["']`).test(app)) {
      throw new PreviewPipelineError(
        'sandpack',
        `${context} leaves registered page ${normalizedPath} disconnected from /App.tsx.`,
        { blockedFiles: ['/App.tsx', normalizedPath], recoverableByRelaunch: true },
      );
    }
  }
}

function getSandpackDestinationPath(path: string): string | null {
  let normalizedPath = normalizeVfsPath(path);

  // Sandpack does not execute project metadata, dependency manifests, or build
  // configuration. These are still retained in the canonical VFS and are not
  // considered preview artifacts.
  if (
    normalizedPath.includes('node_modules') ||
    normalizedPath.includes('/.') ||
    normalizedPath.endsWith('.json') ||
    normalizedPath.endsWith('.config.ts') ||
    normalizedPath.endsWith('.config.js')
  ) {
    return null;
  }

  if (normalizedPath.startsWith('/src/')) {
    normalizedPath = normalizedPath.replace('/src/', '/');
  } else if (normalizedPath.startsWith('/styles/')) {
    normalizedPath = normalizedPath.replace('/styles/', '/');
  }

  if (normalizedPath === '/main.tsx') return '/index.tsx';
  if (normalizedPath === '/main.jsx') return '/index.jsx';
  if (normalizedPath === '/main.ts') return '/index.ts';
  return normalizedPath;
}

/**
 * Verifies that snapshot-owned runtime files survive VFS projection and
 * Sandpack path flattening. This protects components, styles, and local assets
 * beyond the PageRegistry routes validated above.
 */
export function assertSnapshotPreviewFileCoverage(
  sourceFiles: Record<string, string>,
  previewFiles: Record<string, string>,
  resolution: SnapshotResolution,
  context = 'Preview artifact coverage',
): void {
  if (!resolution.isWizardDraft) return;
  assertWizardSnapshotPresent(resolution, context);

  const sourcePathsByDestination = new Map<string, string>();
  for (const [sourcePath, content] of Object.entries(sourceFiles)) {
    if (typeof content !== 'string') continue;
    const destinationPath = getSandpackDestinationPath(sourcePath);
    if (!destinationPath) continue;

    const previousSourcePath = sourcePathsByDestination.get(destinationPath);
    if (previousSourcePath && previousSourcePath !== sourcePath) {
      throw new PreviewPipelineError(
        'sandpack',
        `${context} maps both ${previousSourcePath} and ${sourcePath} to ${destinationPath}; refusing to drop either generated file.`,
        { blockedFiles: [previousSourcePath, sourcePath], recoverableByRelaunch: true },
      );
    }
    sourcePathsByDestination.set(destinationPath, sourcePath);

    if (!(destinationPath in previewFiles)) {
      throw new PreviewPipelineError(
        'sandpack',
        `${context} dropped generated file ${sourcePath} while preparing ${destinationPath}.`,
        { blockedFiles: [sourcePath], recoverableByRelaunch: true },
      );
    }
  }
}

/**
 * Live-edit registry — paths written by the AI Builder (or any in-builder edit)
 * after the current snapshot was produced. They remain revision-scoped and the snapshot stays authoritative for
 * every other path, but it must never resurrect the pre-edit version of a file
 * the user just changed while the durable commit is still in flight (or was
 * skipped because business/draft context wasn't set).
 */
export type PendingVfsChange =
  | { type: 'create' | 'replace'; path: string; contents: string; baseContents?: string | null }
  | { type: 'delete'; path: string; baseContents?: string | null };

export interface PendingVfsConflict {
  path: string;
  baseContents: string | null | undefined;
  acceptedContents: string | null;
  intendedContents: string | null;
  reason: 'overlapping-change' | 'unknown-base';
}

export interface PendingVfsOperation {
  operationId: string;
  /** Monotonic local order; never used as last-write-wins authority. */
  sequence: number;
  scope: string | null;
  baseRevisionId: string | null;
  candidateRevisionId: string | null;
  /** Direct operation ancestors included by this candidate. */
  supersedesOperationIds: string[];
  acknowledgementState: 'pending' | 'conflicted';
  conflicts: PendingVfsConflict[];
  touchedPaths: string[];
  deletedPaths: string[];
  createdAt: number;
  changes: PendingVfsChange[];
}

const LEGACY_PROJECTION_SCOPE = '__legacy_unscoped__';
const pendingVfsOperations = new Map<string, PendingVfsOperation>();
let pendingVfsSequence = 0;

function normalizeVfsPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function normalizedScope(scope?: string | null): string | null {
  return scope?.trim() || null;
}

function operationScopeKey(scope?: string | null): string {
  return normalizedScope(scope) ?? LEGACY_PROJECTION_SCOPE;
}

function normalizedChanges(changes: readonly PendingVfsChange[]): PendingVfsChange[] {
  const paths = new Set<string>();
  return changes.map((change) => {
    if (!change || typeof change !== 'object' || typeof change.path !== 'string') {
      throw new Error('Malformed pending VFS change.');
    }
    if (change.type !== 'create' && change.type !== 'replace' && change.type !== 'delete') {
      throw new Error(`Unsupported pending VFS change type at ${change.path}.`);
    }
    if (change.type !== 'delete' && typeof change.contents !== 'string') {
      throw new Error(`Pending VFS write is missing contents at ${change.path}.`);
    }
    if (change.baseContents !== undefined && change.baseContents !== null && typeof change.baseContents !== 'string') {
      throw new Error(`Pending VFS change has an invalid base at ${change.path}.`);
    }
    const path = normalizeVfsPath(change.path);
    if (paths.has(path)) throw new Error(`Duplicate pending VFS operation path: ${path}`);
    paths.add(path);
    return change.type === 'delete' ? { type: 'delete', path } : { ...change, path };
  });
}

function operationIntendedContents(change: PendingVfsChange): string | null {
  return change.type === 'delete' ? null : change.contents;
}

function fileContents(files: ReadonlyMap<string, string>, path: string): string | null {
  return files.has(path) ? files.get(path)! : null;
}

function sameContents(left: string | null | undefined, right: string | null | undefined): boolean {
  return left === right;
}

function operationIsComplete(operation: PendingVfsOperation, files: ReadonlyMap<string, string>): boolean {
  return operation.changes.every((change) => sameContents(
    fileContents(files, change.path),
    operationIntendedContents(change),
  ));
}

function collectSupersededOperationIds(operationIds: readonly string[], scope?: string | null): Set<string> {
  const collected = new Set<string>();
  const visit = (operationId: string) => {
    if (collected.has(operationId)) return;
    const operation = pendingVfsOperations.get(operationId);
    if (!operation || operationScopeKey(operation.scope) !== operationScopeKey(scope)) return;
    collected.add(operationId);
    for (const ancestorId of operation.supersedesOperationIds) visit(ancestorId);
  };
  for (const operationId of operationIds) visit(operationId);
  return collected;
}

function removeOperationLineage(operationIds: readonly string[], scope?: string | null): string[] {
  const removed: string[] = [];
  for (const operationId of collectSupersededOperationIds(operationIds, scope)) {
    if (pendingVfsOperations.delete(operationId)) removed.push(operationId);
  }
  return removed;
}

/** Records exact changes until a later snapshot acknowledges every one. */
export function recordPendingVfsOperation(input: {
  scope?: string | null;
  baseRevisionId?: string | null;
  candidateRevisionId?: string | null;
  changes: readonly PendingVfsChange[];
  operationId?: string;
  supersedesOperationIds?: readonly string[];
  createdAt?: number;
  sequence?: number;
}): PendingVfsOperation | null {
  const changes = normalizedChanges(input.changes);
  if (!changes.length) return null;
  const sequence = typeof input.sequence === 'number' && Number.isSafeInteger(input.sequence) && input.sequence > 0
    ? input.sequence
    : ++pendingVfsSequence;
  pendingVfsSequence = Math.max(pendingVfsSequence, sequence);
  const operationId = input.operationId?.trim() || `pending-vfs-${Date.now()}-${sequence}`;
  if (pendingVfsOperations.has(operationId)) throw new Error(`Duplicate pending VFS operation ID: ${operationId}`);
  const scopeKey = operationScopeKey(input.scope);
  const baseRevisionId = input.baseRevisionId?.trim() || null;
  const inferredAncestors = baseRevisionId
    ? [...pendingVfsOperations.values()]
        .filter((pending) => operationScopeKey(pending.scope) === scopeKey && pending.candidateRevisionId === baseRevisionId)
        .map((pending) => pending.operationId)
    : [];
  const supersedesOperationIds = [...new Set([
    ...(Array.isArray(input.supersedesOperationIds) ? input.supersedesOperationIds : [])
      .filter((id) => typeof id === 'string' && id.trim())
      .map((id) => id.trim())
      .filter((id) => operationScopeKey(pendingVfsOperations.get(id)?.scope) === scopeKey),
    ...inferredAncestors,
  ])].filter((id) => id !== operationId);
  const operation: PendingVfsOperation = {
    operationId,
    sequence,
    scope: normalizedScope(input.scope),
    baseRevisionId,
    candidateRevisionId: input.candidateRevisionId?.trim() || null,
    supersedesOperationIds,
    acknowledgementState: 'pending',
    conflicts: [],
    touchedPaths: changes.map((change) => change.path),
    deletedPaths: changes.filter((change) => change.type === 'delete').map((change) => change.path),
    createdAt: typeof input.createdAt === 'number' && Number.isFinite(input.createdAt)
      ? input.createdAt
      : Date.now(),
    changes,
  };
  pendingVfsOperations.set(operationId, operation);
  return operation;
}

/** Builds explicit creates, replacements and deletes from a complete file map. */
export function recordPendingVfsMutation(input: {
  scope?: string | null;
  baseRevisionId?: string | null;
  candidateRevisionId?: string | null;
  beforeFiles: Record<string, string>;
  afterFiles: Record<string, string>;
  operationId?: string;
}): PendingVfsOperation | null {
  const before = new Map(Object.entries(input.beforeFiles).map(([path, contents]) => [normalizeVfsPath(path), contents]));
  const after = new Map(Object.entries(input.afterFiles).map(([path, contents]) => [normalizeVfsPath(path), contents]));
  const changes: PendingVfsChange[] = [];
  for (const path of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const previous = before.get(path);
    const next = after.get(path);
    if (previous === next) continue;
    if (next === undefined) changes.push({ type: 'delete', path, baseContents: previous ?? null });
    else changes.push({ type: previous === undefined ? 'create' : 'replace', path, contents: next, baseContents: previous ?? null });
  }
  return recordPendingVfsOperation({ ...input, changes });
}

/** Acknowledges only whole operations included by this snapshot. */
export function acknowledgePendingVfsOperations(
  snapshotFiles: Record<string, string>,
  scope?: string | null,
  options?: { operationIds?: readonly string[]; acceptedRevisionId?: string | null },
): string[] {
  const files = new Map(Object.entries(snapshotFiles).map(([path, contents]) => [normalizeVfsPath(path), contents]));
  const operationIds = options?.operationIds ? new Set(options.operationIds) : null;
  const acknowledged: string[] = [];
  const acceptedRevisionId = options?.acceptedRevisionId?.trim() || null;
  const acceptedRoots: string[] = [];
  for (const [operationId, operation] of pendingVfsOperations) {
    if (operationScopeKey(operation.scope) !== operationScopeKey(scope)) continue;
    if (operationIds && !operationIds.has(operationId)) continue;
    const revisionAccepted = Boolean(
      acceptedRevisionId && (
        operation.candidateRevisionId === acceptedRevisionId ||
        (operationIds?.has(operationId) && operationIsComplete(operation, files))
      ),
    );
    const legacyContentAcknowledged = !acceptedRevisionId
      && !operation.baseRevisionId
      && !operation.candidateRevisionId
      && operationIsComplete(operation, files);
    if (revisionAccepted || legacyContentAcknowledged) acceptedRoots.push(operationId);
  }
  acknowledged.push(...removeOperationLineage(acceptedRoots, scope));
  return acknowledged;
}

/** Finalizes a specific pending mutation once its accepted revision has been persisted. */
export function finalizePendingVfsOperation(input: {
  scope?: string | null;
  operationId?: string | null;
  candidateRevisionId?: string | null;
  acceptedRevisionId?: string | null;
}): string | null {
  const operationId = input.operationId?.trim();
  if (!operationId) return null;
  const operation = pendingVfsOperations.get(operationId);
  if (!operation || operationScopeKey(operation.scope) !== operationScopeKey(input.scope)) return null;
  const acceptedRevisionId = input.acceptedRevisionId?.trim() || null;
  const candidateRevisionId = input.candidateRevisionId?.trim() || null;
  if (acceptedRevisionId && candidateRevisionId && candidateRevisionId !== acceptedRevisionId) {
    return null;
  }
  if (acceptedRevisionId && operation.candidateRevisionId && operation.candidateRevisionId !== acceptedRevisionId) {
    return null;
  }
  const [removedId] = removeOperationLineage([operationId], input.scope);
  return removedId ?? null;
}

/** Local order of the newest recorded operation; capture it with the files a commit is built from. */
export function getPendingVfsSequenceWatermark(): number {
  return pendingVfsSequence;
}

/**
 * A canonical commit built from the live working set already contains every
 * operation recorded before that working set was captured. Absorbing them on
 * acceptance keeps the journal from replaying superseded bytes over the new
 * revision (the source of false "pending source conflicts" after edits).
 */
export function absorbPendingVfsOperations(
  scope?: string | null,
  options: { throughSequence?: number } = {},
): string[] {
  const limit = typeof options.throughSequence === 'number' ? options.throughSequence : pendingVfsSequence;
  const absorbed: string[] = [];
  for (const [operationId, operation] of pendingVfsOperations) {
    if (operationScopeKey(operation.scope) !== operationScopeKey(scope)) continue;
    if (operation.sequence > limit) continue;
    pendingVfsOperations.delete(operationId);
    absorbed.push(operationId);
  }
  return absorbed;
}

export function clearPendingVfsOperations(scope?: string | null): void {
  if (scope === undefined) {
    pendingVfsOperations.clear();
    return;
  }
  for (const [operationId, operation] of pendingVfsOperations) {
    if (operationScopeKey(operation.scope) === operationScopeKey(scope)) pendingVfsOperations.delete(operationId);
  }
}

/**
 * Recovery for a genuine pending-source conflict. `discard` drops the
 * conflicted edits; `keep` replays each one onto the accepted revision (the
 * changed span when it still matches exactly once, otherwise the edit's own
 * file version) so the next projection applies it without reloading.
 */
export function resolvePendingVfsConflicts(
  scope: string | null | undefined,
  acceptedRevisionId: string | null | undefined,
  choice: 'keep' | 'discard',
): { resolvedOperationIds: string[] } {
  const resolvedOperationIds: string[] = [];
  for (const [operationId, operation] of pendingVfsOperations) {
    if (operationScopeKey(operation.scope) !== operationScopeKey(scope)) continue;
    if (operation.acknowledgementState !== 'conflicted') continue;
    resolvedOperationIds.push(operationId);
    if (choice === 'discard') {
      pendingVfsOperations.delete(operationId);
      continue;
    }
    const conflictByPath = new Map(operation.conflicts.map((conflict) => [conflict.path, conflict]));
    const changes = operation.changes.map((change): PendingVfsChange => {
      const conflict = conflictByPath.get(change.path);
      if (!conflict) return change;
      if (change.type === 'delete') return { type: 'delete', path: change.path, baseContents: conflict.acceptedContents };
      let contents = change.contents;
      if (typeof conflict.baseContents === 'string' && typeof conflict.acceptedContents === 'string') {
        const rebased = rebaseTextEdit(conflict.baseContents, change.contents, conflict.acceptedContents);
        if (rebased.status !== 'conflict') contents = rebased.code;
      }
      return { type: change.type, path: change.path, contents, baseContents: conflict.acceptedContents };
    });
    pendingVfsOperations.set(operationId, {
      ...operation,
      baseRevisionId: acceptedRevisionId ?? operation.baseRevisionId,
      acknowledgementState: 'pending',
      conflicts: [],
      changes,
    });
  }
  return { resolvedOperationIds };
}

export function getPendingVfsOperations(scope?: string | null): PendingVfsOperation[] {
  return [...pendingVfsOperations.values()]
    .filter((operation) => operationScopeKey(operation.scope) === operationScopeKey(scope))
    .map((operation) => ({ ...operation, changes: [...operation.changes] }));
}

/** A JSON-safe recovery payload for one draft's unacknowledged VFS writes. */
export function serializePendingVfsOperations(scope?: string | null): PendingVfsOperation[] {
  return getPendingVfsOperations(scope);
}

/**
 * Restores only operations belonging to the requested draft scope. Invalid or
 * duplicate entries are ignored so a stale browser journal cannot break load.
 */
export function restorePendingVfsOperations(serialized: unknown, scope?: string | null): string[] {
  if (!Array.isArray(serialized)) return [];
  const restored: string[] = [];
  for (const item of serialized) {
    if (!item || typeof item !== 'object') continue;
    const operation = item as Partial<PendingVfsOperation>;
    if (
      typeof operation.operationId !== 'string' ||
      !Array.isArray(operation.changes) ||
      operationScopeKey(operation.scope) !== operationScopeKey(scope)
    ) continue;
    try {
      const recorded = recordPendingVfsOperation({
        operationId: operation.operationId,
        scope,
        baseRevisionId: operation.baseRevisionId,
        candidateRevisionId: operation.candidateRevisionId,
        supersedesOperationIds: operation.supersedesOperationIds,
        createdAt: operation.createdAt,
        sequence: operation.sequence,
        changes: operation.changes,
      });
      if (recorded) restored.push(recorded.operationId);
    } catch {
      // A duplicate or malformed operation is already safely represented or unusable.
    }
  }
  return restored;
}

/** Mark paths as edited in the live VFS ahead of the next snapshot commit. */
export function markLiveEditedVfsPaths(paths: string[]): void {
  recordPendingVfsOperation({
    changes: paths.filter(Boolean).map((path) => ({ type: 'replace' as const, path, contents: '' })),
  });
}

/**
 * Clear live-edit protection once a refreshed snapshot has been persisted
 * (or when the builder switches project identity).
 */
export function clearLiveEditedVfsPaths(paths?: string[]): void {
  if (!paths) {
    clearPendingVfsOperations();
    return;
  }
  const wanted = new Set(paths.map(normalizeVfsPath));
  for (const [operationId, operation] of pendingVfsOperations) {
    const retained = operation.changes.filter((change) => !wanted.has(change.path));
    if (!retained.length) pendingVfsOperations.delete(operationId);
    else if (retained.length !== operation.changes.length) pendingVfsOperations.set(operationId, { ...operation, changes: retained });
  }
}

export function getLiveEditedVfsPaths(scope?: string | null): string[] {
  return [...new Set(getPendingVfsOperations(scope).flatMap((operation) => operation.changes.map((change) => change.path)))];
}

export function isLiveEditedVfsPath(path: string, scope?: string | null): boolean {
  const normalized = normalizeVfsPath(path);
  const paths = new Set(getLiveEditedVfsPaths(scope));
  if (paths.has(normalized)) return true;
  if (normalized === '/index.css') return paths.has('/src/index.css');
  if (normalized === '/src/index.css') return paths.has('/index.css');
  return false;
}

function reconcilePendingVfsOperations(
  snapshotFiles: Record<string, string>,
  scope?: string | null,
  acceptedRevisionId?: string | null,
): { operations: PendingVfsOperation[]; conflicts: PendingVfsConflict[] } {
  const acceptedId = acceptedRevisionId?.trim() || null;
  const files = new Map(Object.entries(snapshotFiles).map(([path, contents]) => [normalizeVfsPath(path), contents]));

  // An accepted descendant proves that its operation and every explicitly
  // linked ancestor are already represented by the accepted revision. Their
  // bytes must never be replayed merely because an older operation differs.
  if (acceptedId) {
    const accepted = getPendingVfsOperations(scope)
      .filter((operation) => operation.candidateRevisionId === acceptedId)
      .map((operation) => operation.operationId);
    removeOperationLineage(accepted, scope);
  }

  const operations = getPendingVfsOperations(scope).sort((left, right) => left.sequence - right.sequence);
  const projectedRevisionIds = new Set<string>(acceptedId ? [acceptedId] : []);
  const conflicts: PendingVfsConflict[] = [];

  for (const operation of operations) {
    // Revision lineage is the conflict authority. When an operation was
    // authored on the accepted revision (or on a candidate already projected
    // onto it), no other writer intervened, so a byte mismatch against its
    // recorded base only means the recorder's baseline lagged (an earlier
    // commit adopted without refreshing it, or a stale embedded snapshot).
    // Only a different base revision can carry a genuine overlapping write.
    const revisionLineage = Boolean(
      operation.baseRevisionId && acceptedId && projectedRevisionIds.has(operation.baseRevisionId),
    );
    const lineageEstablished = Boolean(!operation.baseRevisionId || revisionLineage);
    const operationConflicts: PendingVfsConflict[] = [];

    for (const change of operation.changes) {
      const acceptedContents = fileContents(files, change.path);
      const intendedContents = operationIntendedContents(change);
      if (sameContents(acceptedContents, intendedContents)) continue;
      if (revisionLineage) continue;

      if (!lineageEstablished && change.baseContents === undefined) {
        operationConflicts.push({
          path: change.path,
          baseContents: undefined,
          acceptedContents,
          intendedContents,
          reason: 'unknown-base',
        });
        continue;
      }
      if (change.baseContents !== undefined && !sameContents(acceptedContents, change.baseContents)) {
        operationConflicts.push({
          path: change.path,
          baseContents: change.baseContents,
          acceptedContents,
          intendedContents,
          reason: 'overlapping-change',
        });
      }
    }

    const stored = pendingVfsOperations.get(operation.operationId);
    if (operationConflicts.length > 0) {
      conflicts.push(...operationConflicts);
      if (stored) pendingVfsOperations.set(operation.operationId, {
        ...stored,
        acknowledgementState: 'conflicted',
        conflicts: operationConflicts,
      });
      continue;
    }

    if (stored && (stored.acknowledgementState !== 'pending' || stored.conflicts.length > 0)) {
      pendingVfsOperations.set(operation.operationId, {
        ...stored,
        acknowledgementState: 'pending',
        conflicts: [],
      });
    }
    for (const change of operation.changes) {
      const intendedContents = operationIntendedContents(change);
      if (intendedContents === null) files.delete(change.path);
      else files.set(change.path, intendedContents);
    }
    if (operation.candidateRevisionId) projectedRevisionIds.add(operation.candidateRevisionId);
  }

  return { operations: getPendingVfsOperations(scope).sort((left, right) => left.sequence - right.sequence), conflicts };
}

/**
 * Snapshot-as-primary projection bridge. A wizard SiteBundleSnapshot owns the
 * entire executable VFS, not only files that resemble a minimal placeholder.
 * A legacy template preset is valid React and therefore cannot be detected by
 * a fallback-content heuristic; preserving it lets a template silently render
 * over the deterministic snapshot manifest. Snapshot files must win every
 * overlapping path — EXCEPT paths with a newer live edit that the snapshot has
 * not absorbed yet.
 */
export type PendingSourceConflictPolicy = 'block' | 'accepted-only';

export function projectSnapshotVfsFiles(
  files: Record<string, string>,
  resolution: SnapshotResolution,
  options: { pendingSourceConflictPolicy?: PendingSourceConflictPolicy } = {},
): Record<string, string> {
  if (!resolution.isWizardDraft || !resolution.snapshot) return files;

  if (!isSealedSnapshot(resolution.snapshot)) {
    throw new CanonicalRuntimeError({
      surface: 'preview',
      code: 'UNSEALED_SNAPSHOT',
      userMessage: 'This site has not finished its launch checks yet. Re-run the System Launcher before opening Preview.',
      developerMessage: 'Preview attempted to project a pre-seal WizardCompileArtifact as a SiteBundleSnapshot.',
      recoveryActions: ['run-system-launcher'],
    });
  }

  const snapshotFiles = (resolution.snapshot as { vfsFiles?: Record<string, string> }).vfsFiles || {};
  if (Object.keys(snapshotFiles).length === 0) return files;
  // Acknowledgment is operation-level: a partial snapshot refresh cannot clear
  // a sibling create/delete from the same accepted candidate.
  acknowledgePendingVfsOperations(snapshotFiles, resolution.projectionScope, {
    acceptedRevisionId: resolution.acceptedRevisionId,
  });
  const reconciliation = reconcilePendingVfsOperations(
    snapshotFiles,
    resolution.projectionScope,
    resolution.acceptedRevisionId,
  );
  const acceptedOnly = options.pendingSourceConflictPolicy === 'accepted-only';
  if (reconciliation.conflicts.length > 0) {
    const paths = [...new Set(reconciliation.conflicts.map((conflict) => conflict.path))].sort();
    if (!acceptedOnly) {
      throw new PreviewPipelineError(
        'vfs',
        `Pending source conflicts with accepted revision ${resolution.acceptedRevisionId ?? '(unknown)'} at ${paths.join(', ')}. Reload or re-author the pending change from the accepted revision.`,
        {
          blockedFiles: paths,
          recoverableByRelaunch: true,
          pendingConflict: {
            scope: resolution.projectionScope ?? null,
            acceptedRevisionId: resolution.acceptedRevisionId ?? null,
          },
        },
      );
    }
  }
  const pendingChanges = new Map<string, PendingVfsChange>();
  if (!acceptedOnly) {
    for (const operation of reconciliation.operations) {
      for (const change of operation.changes) pendingChanges.set(change.path, change);
    }
  }

  // A sealed Wizard snapshot is a complete runtime projection, not an overlay.
  // Retain only non-executable Unison metadata from the incoming VFS, then add
  // the exact snapshot runtime below. Starting from `files` kept stale root
  // routers/pages/styles alive beside `/src/*`; Sandpack's flattening could then
  // make those legacy files compete with the canonical commit.
  const next: Record<string, string> = Object.fromEntries(
    Object.entries(files)
      .map(([rawPath, content]) => [normalizeVfsPath(rawPath), content] as const)
      .filter(([path]) => path.startsWith('/.unison/')),
  );
  const preserved: string[] = [];

  for (const [rawPath, content] of Object.entries(snapshotFiles)) {
    const path = normalizeVfsPath(rawPath);
    const pending = pendingChanges.get(path);

    // A pending deletion wins over a stale snapshot. Versioned operations use
    // the exact recorded candidate byte; only the legacy empty-content marker
    // falls back to the live VFS byte.
    if (pending?.type === 'delete') {
      preserved.push(path);
      continue;
    }
    if (pending && pending.contents === '') {
      const live = files[path] ?? files[rawPath];
      next[path] = typeof live === 'string' ? live : content;
      preserved.push(path);
      continue;
    }
    if (pending) {
      next[path] = pending.contents;
      preserved.push(path);
      continue;
    }

    // The snapshot embedded in the live VFS travels in the same file map as
    // the sources. A committed Builder edit updates the source byte, but the
    // embedded copy is not rewritten on every save, and the accepted revision
    // id (from LaunchState) can already acknowledge the pending operation. The
    // live working byte for a snapshot-owned path is therefore the newest one;
    // paths outside the snapshot still never leak in (stale legacy routers).
    if (resolution.snapshotFromLiveVfs) {
      const live = files[path] ?? files[rawPath] ?? files[path.slice(1)];
      if (typeof live === 'string' && live !== content) {
        next[path] = live;
        preserved.push(path);
        continue;
      }
    }

    next[path] = content;
  }

  // Files a committed edit created under `/src/` exist only in the live VFS
  // until the embedded snapshot copy refreshes. Root-level legacy paths are
  // still excluded; pending deletions below keep winning.
  if (resolution.snapshotFromLiveVfs) {
    for (const [rawPath, content] of Object.entries(files)) {
      const path = normalizeVfsPath(rawPath);
      if (!path.startsWith('/src/') || typeof content !== 'string') continue;
      if (Object.prototype.hasOwnProperty.call(next, path)) continue;
      if (pendingChanges.get(path)?.type === 'delete') continue;
      next[path] = content;
      preserved.push(path);
    }
  }

  // Pending creates and deletes may have no corresponding stale snapshot path.
  // Replacements already handled above must not be overwritten here by the
  // stale input VFS used during a reload recovery.
  for (const [path, pending] of pendingChanges) {
    if (path.startsWith('/.unison/')) continue;
    if (pending.type === 'delete') {
      delete next[path];
    } else if (Object.prototype.hasOwnProperty.call(snapshotFiles, path)) {
      continue;
    } else {
      const live = files[path] ?? files[path.slice(1)];
      next[path] = pending.contents === '' && typeof live === 'string' ? live : pending.contents;
    }
    if (!preserved.includes(path)) preserved.push(path);
  }

  if (preserved.length > 0) {
    console.info('[snapshotProjector] Preserved live builder edits over snapshot:', preserved);
  }

  next[SNAPSHOT_VFS_PATH] = JSON.stringify(resolution.snapshot, null, 2);

  return next;
}


function tryParseRecord(raw: string | undefined): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return readRecord(parsed);
  } catch {
    return null;
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
