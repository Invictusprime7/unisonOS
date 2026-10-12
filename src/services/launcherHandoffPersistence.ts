import type { LaunchState } from '@/types/launchState';
import { findUnresolvedLocalImports, describeUnresolvedImports } from '@/services/laneBCompanionModules';
import {
  buildPublishedRuntimeModule,
  CANONICAL_METADATA_FILE_PATHS,
  PUBLISHED_RUNTIME_MODULE_PATH,
  type PublishedRuntimeConfig,
} from '@/services/canonicalLaunchVfs';
import {
  HANDOFF_TTL_MS,
  LAUNCHER_HANDOFF_KEY,
  launcherHandoffStorageAvailable,
  type LauncherHandoffSnapshot,
} from '@/services/launcherHandoffStore';

export {
  clearLauncherHandoff,
  readLauncherHandoff,
  type LauncherHandoffSnapshot,
} from '@/services/launcherHandoffStore';

const COMPACT_UNISON_METADATA_PATHS = new Set([
  '/.unison/app-context.json',
  '/.unison/runtime-manifest.json',
  '/.unison/canonical-playground.json',
  '/.unison/wizard-seed.json',
  '/.unison/launch-readiness.json',
  '/.unison/native-publish-setup.json',
  '/.unison/setup-snapshot.json',
  '/.unison/intent-bindings.json',
  '/.unison/intent-surfaces.json',
  '/.unison/gate-verdicts.json',
  '/.unison/draft-classification.json',
  '/.unison/integrity-report.json',
  '/.unison/wizard-registry-context.json',
  CANONICAL_METADATA_FILE_PATHS.publishedRuntime,
]);

const ROOT_ONLY_FILES = new Set([
  '/index.html',
  '/package.json',
  '/tsconfig.json',
  '/tsconfig.app.json',
  '/tsconfig.node.json',
  '/vite.config.ts',
  '/vite.config.js',
  '/tailwind.config.ts',
  '/tailwind.config.js',
  '/postcss.config.js',
  '/postcss.config.cjs',
]);

const SOURCE_FILE_EXTENSION = /\.(?:tsx?|jsx?|mjs|cjs|css|scss|less|json|svg|png|jpe?g|gif|webp|avif|woff2?|ttf|otf)$/i;

export type LauncherHandoffRecoveryMode = 'compact-vfs' | 'durable-revision';

const DURABLE_HANDOFF_IDENTITY_FIELDS = [
  'businessId',
  'siteId',
  'projectId',
  'draftId',
  'revisionId',
] as const;

function toSerializableRecord(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasDurableRevisionIdentity(routeState: Record<string, unknown>): boolean {
  return nonEmptyString(routeState.projectId)
    && nonEmptyString(routeState.draftId)
    && nonEmptyString(routeState.revisionId);
}

function handoffErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown launcher handoff error';
  }
}

function stripEmbeddedVfs(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const copy = { ...(value as Record<string, unknown>) };
  delete copy.vfsFiles;
  return copy;
}

function compactCanonicalMetadata(content: string): string {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const compact = stripEmbeddedVfs(parsed);
    return compact ? JSON.stringify(compact) : content;
  } catch {
    return content;
  }
}

function normalizeCanonicalVfsPath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  const normalized = `/${segments.join('/')}`;
  if (
    normalized === '/' ||
    normalized.startsWith('/src/') ||
    normalized.startsWith('/public/') ||
    normalized.startsWith('/.unison/') ||
    ROOT_ONLY_FILES.has(normalized)
  ) {
    return normalized;
  }
  return SOURCE_FILE_EXTENSION.test(normalized) ? `/src${normalized}` : normalized;
}

function normalizeCanonicalVfsFiles(files: Record<string, string>): Record<string, string> {
  const normalizedFiles: Record<string, string> = {};
  const originalPaths = new Map<string, string>();
  for (const [rawPath, content] of Object.entries(files)) {
    const path = normalizeCanonicalVfsPath(rawPath);
    const existing = normalizedFiles[path];
    if (existing !== undefined && existing !== content) {
      throw new Error(
        `[LauncherHandoff] conflicting files ${originalPaths.get(path) ?? path} and ${rawPath} normalize to ${path}`,
      );
    }
    normalizedFiles[path] = content;
    originalPaths.set(path, rawPath);
  }
  return normalizedFiles;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isPublishedRuntimeConfig(value: unknown): value is PublishedRuntimeConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const config = value as Record<string, unknown>;
  return config.version === '1.0'
    && config.runtimeVersion === '1.0'
    && isNullableString(config.siteId)
    && isNullableString(config.businessId)
    && isNullableString(config.projectId)
    && isNullableString(config.snapshotId)
    && isNullableString(config.endpoint)
    && isNullableString(config.runtimeEndpoint)
    && isNullableString(config.formEndpoint)
    && Boolean(config.controllerEndpoints)
    && typeof config.controllerEndpoints === 'object'
    && !Array.isArray(config.controllerEndpoints);
}

function restorePublishedRuntimeModule(files: Record<string, string>): Record<string, string> {
  if (files[PUBLISHED_RUNTIME_MODULE_PATH]) return files;
  const raw = files[CANONICAL_METADATA_FILE_PATHS.publishedRuntime];
  if (!raw) return files;
  try {
    const config = JSON.parse(raw) as unknown;
    if (!isPublishedRuntimeConfig(config)) return files;
    return {
      ...files,
      [PUBLISHED_RUNTIME_MODULE_PATH]: buildPublishedRuntimeModule(config),
    };
  } catch {
    return files;
  }
}

function compactVfsFiles(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const stringFiles = Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
  const canonicalFiles = normalizeCanonicalVfsFiles(stringFiles);
  const out: Record<string, string> = {};
  for (const [path, content] of Object.entries(canonicalFiles)) {
    if (path.startsWith('/.unison/')) {
      if (COMPACT_UNISON_METADATA_PATHS.has(path)) {
        out[path] = path === '/.unison/site-bundle-snapshot.json'
          ? compactCanonicalMetadata(content)
          : content;
      }
      continue;
    }
    if (
      /^\/(src|public)\//.test(path) ||
      /^\/[^/]+\.(tsx?|jsx?|css|json|svg|png|jpe?g|gif|webp|avif|woff2?|ttf|otf)$/.test(path) ||
      /^\/(index\.html|package\.json|tsconfig\.json|vite\.config\.ts|tailwind\.config\.ts|postcss\.config\.js)$/.test(path)
    ) {
      out[path] = content;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function readSnapshotVfs(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const files = (value as { vfsFiles?: unknown }).vfsFiles;
  if (!files || typeof files !== 'object' || Array.isArray(files)) return undefined;
  const record = files as Record<string, unknown>;
  return Object.values(record).every((content) => typeof content === 'string')
    ? record as Record<string, string>
    : undefined;
}

function normalizeExpectedPagePath(path: string): string {
  return normalizeCanonicalVfsPath(path);
}

function snapshotVfsCoversRegisteredPages(snapshot: unknown, files: Record<string, string>): boolean {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return true;
  const pageRegistry = (snapshot as { pageRegistry?: unknown }).pageRegistry;
  if (!pageRegistry || typeof pageRegistry !== 'object' || Array.isArray(pageRegistry)) return true;
  const pages = (pageRegistry as { pages?: unknown }).pages;
  if (!pages || typeof pages !== 'object' || Array.isArray(pages)) return true;

  const normalizedFiles = new Map(
    Object.entries(files).map(([path, content]) => [normalizeCanonicalVfsPath(path), content]),
  );

  return Object.values(pages as Record<string, unknown>).every((page) => {
    if (!page || typeof page !== 'object' || Array.isArray(page)) return true;
    const filePath = (page as { filePath?: unknown }).filePath;
    if (typeof filePath !== 'string' || !filePath.trim()) return true;
    const source = normalizedFiles.get(normalizeExpectedPagePath(filePath));
    return typeof source === 'string' && source.trim().length > 0;
  });
}

function upsertJsonFile(files: Record<string, string>, path: string, value: unknown) {
  if (files[path] || value === undefined || value === null) return;
  try {
    files[path] = JSON.stringify(value, null, 2);
  } catch {
    // Ignore non-serializable metadata in the emergency compact handoff.
  }
}

function buildFallbackRouteState(routeState: Record<string, unknown>) {
  // CRITICAL: preserve the generated VFS + canonical bundle here. The Builder
  // relies on these to skip the deterministic template fallback and hydrate
  // the page registry from AI output. Dropping them used to cause the Dashboard
  // → WebBuilder handoff to "lose" the wizard's selections and render a stale
  // default seed.
  //
  // ALSO preserve the orchestration tokens (manifestId, pipelineManifest,
  // materializedPlayground, compiledPlayground, setupSnapshot) so the in-Builder
  // recompile + readiness surfaces don't see "dead" tokens/seeds when the
  // primary sessionStorage write hit quota and we fell through to this trimmed
  // fallback payload.
  // The snapshot VFS is the canonical post-Lane-B artifact. Persist exactly
  // one compact VFS copy, sourced from it whenever it is available. Using the
  // outer route VFS here allowed a template preset to outlive the snapshot
  // after session-storage recovery.
  const snapshotVfs = readSnapshotVfs(routeState.siteBundleSnapshot);
  const hasCompleteSnapshotVfs = Boolean(
    snapshotVfs
    && Object.keys(snapshotVfs).length > 0
    && snapshotVfsCoversRegisteredPages(routeState.siteBundleSnapshot, snapshotVfs),
  );
  const sourceFiles = hasCompleteSnapshotVfs ? snapshotVfs : routeState.vfsFiles;
  const compactedSourceFiles = compactVfsFiles(sourceFiles) || {};
  const compactFiles = routeState.siteBundleSnapshot
    ? compactedSourceFiles
    : restorePublishedRuntimeModule(compactedSourceFiles);
  const unresolved = findUnresolvedLocalImports(compactFiles);
  if (unresolved.length > 0) {
    throw new Error(
      `[LauncherHandoff] canonical handoff has unresolved local imports: ${describeUnresolvedImports(unresolved)}`,
    );
  }
  upsertJsonFile(compactFiles, '/.unison/runtime-manifest.json', routeState.runtimeManifest);
  upsertJsonFile(compactFiles, '/.unison/canonical-playground.json', routeState.canonicalPlayground || routeState.materializedPlayground);
  upsertJsonFile(compactFiles, '/.unison/wizard-seed.json', routeState.wizardSeed);
  upsertJsonFile(compactFiles, '/.unison/launch-readiness.json', routeState.nativeReadinessManifest || routeState.launchReadiness);
  upsertJsonFile(compactFiles, '/.unison/native-publish-setup.json', routeState.setupSnapshot);
  upsertJsonFile(compactFiles, '/.unison/setup-snapshot.json', routeState.setupSnapshot);

  const snapshot = stripEmbeddedVfs(routeState.siteBundleSnapshot);
  upsertJsonFile(compactFiles, '/.unison/site-bundle-snapshot.json', snapshot);
  const hasDurableWizardFiles = Object.keys(compactFiles).length > 0;
  const compiledPlayground = stripEmbeddedVfs(routeState.compiledPlayground);

  return {
    fromLauncher: true,
    startInPreview: true,
    templateName: routeState.templateName,
    templateCategory: routeState.templateCategory,
    templateId: routeState.templateId,
    themePresetId: routeState.themePresetId,
    aesthetic: routeState.aesthetic,
    systemType: routeState.systemType,
    systemName: routeState.systemName,
    businessId: routeState.businessId,
    siteId: routeState.siteId,
    projectId: routeState.projectId,
    // Canonical identity of the committed launch. Without these the Builder
    // cannot run its revision-first hydration and silently falls back to
    // "find a draft for this project", which can adopt a stale revision.
    draftId: routeState.draftId,
    revisionId: routeState.revisionId,
    manifestId: routeState.manifestId,
    entryPoint: routeState.entryPoint,
    preloadedIntents: routeState.preloadedIntents,
    launchContract: routeState.launchContract,

    runtimeManifest: routeState.runtimeManifest,
    vfsFiles: compactFiles,
    siteBundleSnapshot: snapshot,
    snapshotVfsCompacted: Object.keys(compactFiles).length > 0,
    canonicalPlayground: routeState.canonicalPlayground,
    materializedPlayground: hasDurableWizardFiles ? routeState.materializedPlayground : undefined,
    compiledPlayground,
    pipelineManifest: routeState.pipelineManifest,
    wizardSelections: routeState.wizardSelections,
    wizardSeed: hasDurableWizardFiles ? routeState.wizardSeed : undefined,
    appContext: routeState.appContext,
    launchReliabilityMode: hasDurableWizardFiles ? routeState.launchReliabilityMode : 'lane-b-blocked',
    launchReadiness: hasDurableWizardFiles ? routeState.launchReadiness : undefined,
    setupSnapshot: hasDurableWizardFiles ? routeState.setupSnapshot : undefined,
    nativeReadinessManifest: routeState.nativeReadinessManifest,
    sitePlan: routeState.sitePlan,
  } satisfies Record<string, unknown>;
}

function persistCompactLauncherHandoff(compactRouteState: Record<string, unknown>) {
  if (!launcherHandoffStorageAvailable()) return;
  const createdAt = new Date().toISOString();

  try {
    const baseSnapshot: LauncherHandoffSnapshot = {
      targetPath: '/web-builder',
      createdAt,
      expiresAt: Date.now() + HANDOFF_TTL_MS,
      routeState: toSerializableRecord(compactRouteState),
    };
    window.sessionStorage.setItem(LAUNCHER_HANDOFF_KEY, JSON.stringify(baseSnapshot));
  } catch {
    // Non-fatal: normal in-memory route state or the durable revision identity
    // still carries the handoff. Storage quota and serialization failures must
    // never strand a successfully committed site in the Wizard.
  }
}

/**
 * Build the smallest handoff that can recover a committed site from
 * `site_revisions`. Every value is deliberately scalar so this path cannot be
 * blocked by a cyclic/oversized generated artifact or a canonical-path
 * compaction error after the commit has already succeeded.
 */
export function buildRevisionBackedLauncherNavigationState(
  routeState: Record<string, unknown>,
  error?: unknown,
): Record<string, unknown> {
  if (!hasDurableRevisionIdentity(routeState)) {
    throw new Error('[LauncherHandoff] durable recovery requires projectId, draftId, and revisionId.');
  }

  const recoveryState: Record<string, unknown> = {
    fromLauncher: true,
    startInPreview: true,
    handoffRecoveryMode: 'durable-revision' satisfies LauncherHandoffRecoveryMode,
  };
  for (const field of DURABLE_HANDOFF_IDENTITY_FIELDS) {
    if (nonEmptyString(routeState[field])) recoveryState[field] = routeState[field];
  }
  for (const field of [
    'templateName',
    'templateCategory',
    'templateId',
    'themePresetId',
    'aesthetic',
    'systemType',
    'systemName',
    'entryPoint',
  ] as const) {
    if (nonEmptyString(routeState[field])) recoveryState[field] = routeState[field];
  }
  if (error !== undefined) {
    recoveryState.handoffWarning = handoffErrorMessage(error).slice(0, 500);
  }
  return recoveryState;
}

export function persistRevisionBackedLauncherHandoff(
  routeState: Record<string, unknown>,
  error?: unknown,
): Record<string, unknown> {
  const recoveryState = buildRevisionBackedLauncherNavigationState(routeState, error);
  persistCompactLauncherHandoff(recoveryState);
  return recoveryState;
}

export function persistLauncherHandoff(args: {
  routeState: Record<string, unknown>;
  launchState?: LaunchState;
}) {
  // A handoff used to stringify routeState plus launchState, while each one
  // held VFS, snapshot VFS, and compiled VFS copies. Large Lane B sites then
  // blocked the main thread immediately after navigate('/web-builder'). Keep
  // exactly one compact VFS copy for refresh recovery; LaunchContext owns the
  // live in-memory copy during the same SPA navigation.
  persistCompactLauncherHandoff(buildFallbackRouteState(args.routeState));
}

/**
 * Build the history and recovery payload once. The Wizard previously walked
 * and serialized the same full VFS twice immediately before Builder mount,
 * which could block the main thread during the route transition.
 */
export function persistAndBuildLauncherHandoff(args: {
  routeState: Record<string, unknown>;
  launchState?: LaunchState;
}): Record<string, unknown> {
  try {
    const compactRouteState = {
      ...buildFallbackRouteState(args.routeState),
      handoffRecoveryMode: 'compact-vfs' satisfies LauncherHandoffRecoveryMode,
    };
    persistCompactLauncherHandoff(compactRouteState);
    return compactRouteState;
  } catch (error) {
    if (!hasDurableRevisionIdentity(args.routeState)) throw error;
    console.warn(
      '[LauncherHandoff] compact payload failed; opening the committed revision directly',
      error,
    );
    return persistRevisionBackedLauncherHandoff(args.routeState, error);
  }
}

/**
 * Browser history is a recovery layer alongside session storage. Keep the
 * same bounded VFS payload in both places so a back/forward transition can
 * restore a launch without depending on React context, but never put nested
 * snapshot/compiled VFS copies into either payload.
 */
export function buildLauncherNavigationState(
  routeState: Record<string, unknown>,
): Record<string, unknown> {
  return buildFallbackRouteState(routeState);
}
