import type { LaunchState } from '@/types/launchState';
import { getDependenciesForSandpack } from '@/utils/dependencyExtractor';
import { launchStateToSandpackFiles, launchStateToSandpackFilesAsync } from '@/utils/launchToSandpack';
import { applySandpackRuntimeShims, prepareSandpackFiles } from '@/utils/sandpackFilePrep';
import { runPrepareSandpackFilesOffThread } from '@/services/strictImportContractRuntime';
import { SANDPACK_PREVIEW_CORE_DEPENDENCIES } from '@/utils/sandpackDependencies';
import { applyUnisonCanonicals } from '@/services/unisonCanonicalRegistry';
import { runPreflightRepair } from '@/services/aiSitePreflightRepair';
import { supabase } from '@/integrations/supabase/client';
import { readProjectMedia, refreshProjectMediaUrls } from '@/services/assets/projectMedia';
import {
  assertNoMinimalFallbackPreview,
  assertSnapshotPreviewFileCoverage,
  assertSnapshotPreviewRouteReachability,
  projectSnapshotVfsFiles,
  resolveSnapshot,
  type PendingSourceConflictPolicy,
} from '@/services/snapshotProjector';

export interface PreviewArtifactsOptions {
  sourceFiles: Record<string, string>;
  launchState?: LaunchState | null;
  baseDependencies?: Record<string, string>;
  pendingSourceConflictPolicy?: PendingSourceConflictPolicy;
}

export interface PreviewArtifactsResult {
  sandpackFiles: Record<string, string>;
  dependencies: Record<string, string>;
}

const PREVIEW_MEDIA_URL_TTL_MS = 55 * 60 * 1000;
const previewMediaUrlCache = new Map<string, { url: string; expiresAt: number }>();

async function refreshPreviewProjectMedia(files: Record<string, string>, signal?: AbortSignal): Promise<Record<string, string>> {
  const media = readProjectMedia(files).assets.filter((asset) => asset.usedBy.length > 0);
  if (media.length === 0) return files;
  if (signal?.aborted) throw signal.reason ?? new Error('Preview compile was aborted.');

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Sign in again to preview your uploaded project media.');

  return refreshProjectMediaUrls(files, {
    userId: user.id,
    createSignedUrl: async (bucket, storagePath) => {
      const cacheKey = `${user.id}:${bucket}:${storagePath}`;
      const cached = previewMediaUrlCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.url;
      const { data, error: signingError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 60 * 60);
      if (signingError || !data?.signedUrl) {
        throw new Error(`Could not refresh the preview URL for ${storagePath}.`);
      }
      previewMediaUrlCache.set(cacheKey, { url: data.signedUrl, expiresAt: Date.now() + PREVIEW_MEDIA_URL_TTL_MS });
      return data.signedUrl;
    },
  });
}

function readThemePresetIdFromSourceFiles(sourceFiles: Record<string, string>): string | null {
  const candidates = [
    sourceFiles['/.unison/app-context.json'],
    sourceFiles['/.unison/runtime-manifest.json'],
    sourceFiles['/.unison/site-bundle-snapshot.json'],
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  for (const raw of candidates) {
    try {
      const parsed = JSON.parse(raw) as {
        themePresetId?: string;
        appContext?: { themePresetId?: string };
        meta?: { themePresetId?: string };
      };
      const resolved = parsed.themePresetId || parsed.appContext?.themePresetId || parsed.meta?.themePresetId;
      if (resolved) return resolved;
    } catch {
      // Ignore malformed metadata and keep searching other canonical files.
    }
  }

  return null;
}

/**
 * Canonical preview compiler for all in-app Sandpack consumers.
 * Keeps launch-aware and plain VFS preview preparation on the same path.
 */
export function buildPreviewArtifacts(
  options: PreviewArtifactsOptions
): PreviewArtifactsResult {
  const {
    sourceFiles: rawSourceFiles,
    launchState = null,
    baseDependencies = SANDPACK_PREVIEW_CORE_DEPENDENCIES,
    pendingSourceConflictPolicy = 'block',
  } = options;

  const pre = prepareForCompile(rawSourceFiles, launchState, pendingSourceConflictPolicy);
  const rawSandpackFiles = pre.launchStateWithRecoveredTheme
    ? launchStateToSandpackFiles({
        launchState: pre.launchStateWithRecoveredTheme,
        vfsFiles: pre.sourceFiles,
      })
    : prepareSandpackFiles(pre.sourceFiles, { themePresetId: pre.themePresetId });

  return finishPreviewArtifacts(rawSandpackFiles, pre, baseDependencies);
}

/**
 * Same output as buildPreviewArtifacts(), but runs the heavy
 * launchStateToSandpackFiles()/prepareSandpackFiles() compile off the main
 * thread. This is the path Preview mounting after a Wizard launch must use:
 * that compile has no internal yield points and can freeze the tab for as
 * long as it takes on a large/drifted generated site.
 */
export async function buildPreviewArtifactsAsync(
  options: PreviewArtifactsOptions,
  runtimeOptions: { signal?: AbortSignal } = {},
): Promise<PreviewArtifactsResult> {
  const {
    sourceFiles: rawSourceFiles,
    launchState = null,
    baseDependencies = SANDPACK_PREVIEW_CORE_DEPENDENCIES,
    pendingSourceConflictPolicy = 'block',
  } = options;

  const prepared = prepareForCompile(rawSourceFiles, launchState, pendingSourceConflictPolicy);
  const previewSourceFiles = await refreshPreviewProjectMedia(prepared.sourceFiles, runtimeOptions.signal);
  const pre = { ...prepared, sourceFiles: previewSourceFiles };
  const rawSandpackFiles = pre.launchStateWithRecoveredTheme
    ? await launchStateToSandpackFilesAsync({
        launchState: pre.launchStateWithRecoveredTheme,
        vfsFiles: pre.sourceFiles,
      }, runtimeOptions)
    : await runPrepareSandpackFilesOffThread({
        files: pre.sourceFiles,
        themePresetId: pre.themePresetId,
        signal: runtimeOptions.signal,
        fallbackCompute: (files, entryPoint, themePresetId) => prepareSandpackFiles(files, { entryPoint, themePresetId }),
      });

  return finishPreviewArtifacts(rawSandpackFiles, pre, baseDependencies);
}

function prepareForCompile(
  rawSourceFiles: Record<string, string>,
  launchState: LaunchState | null,
  pendingSourceConflictPolicy: PendingSourceConflictPolicy,
) {
  const initialResolution = resolveSnapshot(rawSourceFiles, launchState);
  const sourceFiles = projectSnapshotVfsFiles(rawSourceFiles, initialResolution, { pendingSourceConflictPolicy });

  const metadataThemePresetId = readThemePresetIdFromSourceFiles(sourceFiles);
  const themePresetId = metadataThemePresetId ||
    launchState?.siteBundleSnapshot?.meta?.themePresetId ||
    launchState?.runtimeManifest?.appContext?.themePresetId ||
    launchState?.themePresetId ||
    null;
  const launchStateWithRecoveredTheme = launchState && themePresetId && !launchState.themePresetId
    ? { ...launchState, themePresetId }
    : launchState;

  return { initialResolution, sourceFiles, themePresetId, launchStateWithRecoveredTheme };
}

function finishPreviewArtifacts(
  rawSandpackFiles: Record<string, string>,
  pre: ReturnType<typeof prepareForCompile>,
  baseDependencies: Record<string, string>,
): PreviewArtifactsResult {
  const { initialResolution, sourceFiles, launchStateWithRecoveredTheme } = pre;

  // Re-stamp AUTO-GENERATED canonical Unison files (data + product widgets)
  // on every compile so AI / editor mutations cannot break the preview.
  // See src/services/unisonCanonicalRegistry.ts.
  const stampedFiles = applySandpackRuntimeShims(applyUnisonCanonicals(rawSandpackFiles));

  // ── Final preview-side parse gate ─────────────────────────────────────
  // NO SWALLOW: any PreviewPipelineError (and any other unexpected throw)
  // propagates to VFSPreview, which renders PreviewRuntimeError. Silent
  // recovery here is what masked the "default fallback preset" symptom.
  //
  // For wizard drafts we run the FULL preflight (early repair → nav-wiring →
  // industry forbidden-intent strip → final repair) so industry intent rules
  // (e.g. nonprofit must not expose checkout/cart) survive even if some
  // upstream commit bypassed vfsCommitService. For non-wizard drafts we keep
  // the cheaper syntax-only gate.
  const industry = launchStateWithRecoveredTheme?.siteBundleSnapshot?.industry;
  const brand = launchStateWithRecoveredTheme?.businessName;
  const wizardResolution = resolveSnapshot(stampedFiles, launchStateWithRecoveredTheme);
  // Snapshot projection intentionally returns the runtime VFS, which may omit
  // /.unison metadata files. Preserve the authoritative pre-projection
  // classification so wizard previews still receive their runtime contract.
  const isWizardPreview = initialResolution.isWizardDraft || wizardResolution.isWizardDraft;
  const finalPreviewResolution = wizardResolution.snapshot
    ? wizardResolution
    : initialResolution.snapshot
      ? initialResolution
      : wizardResolution;
  assertNoMinimalFallbackPreview(stampedFiles, wizardResolution, 'Preview artifact gate');


  let sandpackFiles: Record<string, string>;
  if (isWizardPreview) {
    // Wizard artifacts already passed launch/commit preflight. Re-running the
    // multi-stage compiler synchronously during React render freezes the main
    // thread on generated multi-page sites. Preview only verifies integrity;
    // repair and mutation stay at commit boundaries.
    sandpackFiles = stampedFiles;
    assertNoMinimalFallbackPreview(sandpackFiles, wizardResolution, 'Preview artifact integrity gate');
  } else {
    const gate = runPreflightRepair(stampedFiles, { context: { industry, brand } });
    sandpackFiles = gate.files;
    if (gate.repairedCount > 0 || gate.quarantinedCount > 0) {
      console.warn('[buildPreviewArtifacts] Preview parse gate:', {
        clean: gate.cleanCount,
        repaired: gate.repairedCount,
        quarantined: gate.quarantinedCount,
        details: gate.reports
          .filter((r) => r.status !== 'clean')
          .map((r) => ({ path: r.path, status: r.status, error: r.finalError?.slice(0, 200) })),
      });
      for (const r of gate.reports) {
        if (r.status === 'clean') continue;
        const src = stampedFiles[r.path];
        if (typeof src === 'string') {
          console.warn(`[buildPreviewArtifacts] ${r.status} ${r.path} head:\n${src.slice(0, 600)}`);
        }
      }
    }
  }

  assertNoMinimalFallbackPreview(sandpackFiles, finalPreviewResolution, 'Preview artifact integrity gate');
  // Generation owns page acceptance; preview owns faithful projection. These
  // checks do not repair or re-author the sealed bundle. They prove Sandpack's
  // flattened overlay retained every runtime file and that /App.tsx still
  // imports every registered page, so a stale/minimal router cannot win after
  // the canonical commit.
  assertSnapshotPreviewFileCoverage(
    sourceFiles,
    sandpackFiles,
    finalPreviewResolution,
    'Preview artifact coverage gate',
  );
  assertSnapshotPreviewRouteReachability(
    sandpackFiles,
    finalPreviewResolution,
    'Preview route reachability gate',
  );

  // Resolve dependencies from Sandpack's actual entry graph. Snapshot-owned
  // VFS facades may expose many optional libraries, but an unreferenced
  // facade must never force Sandpack to fetch its package.
  const { dependencies } = getDependenciesForSandpack(
    sandpackFiles,
    baseDependencies,
    { entryPoints: ['/index.tsx', '/index.jsx', '/index.ts', '/index.js'] },
  );

  // The runner reads package.json as well as customSetup. Keep its install
  // graph identical to the reachable browser dependencies; saved export
  // tooling and unused facade packages must not trigger a cold install.
  sandpackFiles['/package.json'] = projectPreviewPackageJson(sandpackFiles['/package.json'], dependencies);

  return {
    sandpackFiles,
    dependencies,
  };
}

export function projectPreviewPackageJson(source: string | undefined, dependencies: Record<string, string>): string {
  let manifest: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(source ?? '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) manifest = parsed as Record<string, unknown>;
  } catch { /* runtime manifest replaces malformed export metadata */ }
  const { devDependencies: _devDependencies, dependencies: _dependencies, ...metadata } = manifest;
  return JSON.stringify({ ...metadata, dependencies }, null, 2);
}

