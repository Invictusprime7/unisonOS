/**
 * Launch-to-Sandpack Converter
 *
 * Converts LaunchState + VFS files into Sandpack-compatible format.
 * Thin launch-aware adapter over the canonical preview compiler.
 *
 * Strategy (snapshot-as-primary):
 *   - Resolve the authoritative SiteBundleSnapshot via snapshotProjector.
 *   - Project /src/index.css from snapshot.meta.themePresetId, NEVER from a
 *     hardcoded aesthetic palette.
 *   - Delegate final compilation to prepareSandpackFiles().
 */

import type { LaunchState } from '@/types/launchState';
import { normalizeLauncherFiles, prepareSandpackFiles } from '@/utils/sandpackFilePrep';
import { resolveLauncherEntryPoint } from '@/utils/launcherPayload';
import { assertNoMinimalFallbackPreview, ensureSnapshotTokens, projectSnapshotVfsFiles, resolveSnapshot } from '@/services/snapshotProjector';
import { runPrepareSandpackFilesOffThread } from '@/services/strictImportContractRuntime';

export type SandpackFiles = Record<string, string>;

export interface LaunchToSandpackConfig {
  launchState: LaunchState;
  vfsFiles: Record<string, string>;
  debug?: boolean;
}

function prepareLaunchFiles(config: LaunchToSandpackConfig) {
  const { launchState, vfsFiles } = config;

  // LaunchState.vfsFiles is the durable fallback only when the live VFS hasn't
  // imported yet (first paint window). The snapshot projector still gates any
  // missing artifact, so this can't silently render a default preset.
  let sourceVfsFiles = Object.keys(vfsFiles).length > 0
    ? vfsFiles
    : launchState.vfsFiles || {};

  let resolution = resolveSnapshot(sourceVfsFiles, launchState);
  sourceVfsFiles = projectSnapshotVfsFiles(sourceVfsFiles, resolution);
  resolution = resolveSnapshot(sourceVfsFiles, launchState);
  assertNoMinimalFallbackPreview(sourceVfsFiles, resolution, 'Launch preview gate');

  const entryPoint = resolveLauncherEntryPoint(
    sourceVfsFiles,
    launchState.runtimeManifest?.entryPoint || launchState.entryPoint,
  );

  // A sealed Wizard snapshot has already passed normalization, generation
  // acceptance, Stage 4b, preflight, and commit. Running the legacy/template
  // normalizer again here creates a second authoring runtime (generic UI
  // foundation + fallback CSS) immediately before Sandpack. Only non-Wizard
  // drafts may use that migration path.
  const normalizedFiles = resolution.isWizardDraft
    ? sourceVfsFiles
    : normalizeLauncherFiles(sourceVfsFiles, {
        entryPoint,
        themePresetId: resolution.themePresetId,
        injectCssIfMissing: true,
      });
  const files: SandpackFiles = { ...normalizedFiles };

  for (const [path, content] of Object.entries(sourceVfsFiles)) {
    files[path] = content;
  }

  // ── Theme CSS authority ──────────────────────────────────────────────
  // Snapshot wins only when existing CSS lacks the expected token shape
  // (per user spec). No hardcoded palette table; no silent prepend.
  const cssKey =
    '/src/index.css' in normalizedFiles
      ? '/src/index.css'
      : 'src/index.css' in normalizedFiles
        ? 'src/index.css'
        : '/index.css' in normalizedFiles
          ? '/index.css'
          : '/src/index.css';
  files[cssKey] = ensureSnapshotTokens(files[cssKey], resolution);
  assertNoMinimalFallbackPreview(files, resolution, 'Launch preview files');

  // Intent comment marker (unchanged behavior; not a fallback).
  if (!resolution.isWizardDraft && launchState.intentRuntime && launchState.preloadedIntents.length > 0) {
    const entryKey =
      '/src/main.tsx' in files
        ? '/src/main.tsx'
        : entryPoint in files
          ? entryPoint
          : '/src/index.tsx' in files
            ? '/src/index.tsx'
            : null;

    if (entryKey && typeof files[entryKey] === 'string') {
      const content = files[entryKey];
      if (!content.includes('intents') && !content.includes('preloadedIntents')) {
        const intentComment = `// Available intents: ${launchState.preloadedIntents.join(', ') || 'none'}\n`;
        files[entryKey] = intentComment + content;
      }
    }
  }

  return { files, entryPoint, resolution };
}

function stampDebugMetadata(
  previewFiles: SandpackFiles,
  launchState: LaunchState,
  resolution: ReturnType<typeof resolveSnapshot>,
): void {
  previewFiles['/launch-metadata.json'] = JSON.stringify(
    {
      systemType: launchState.systemType,
      businessName: launchState.businessName,
      aesthetic: launchState.aesthetic,
      preloadedIntents: launchState.preloadedIntents,
      createdAt: launchState.createdAt,
      themePresetId: resolution.themePresetId,
      hasSnapshot: Boolean(resolution.snapshot),
    },
    null,
    2
  );
}

export function launchStateToSandpackFiles(
  config: LaunchToSandpackConfig
): SandpackFiles {
  const { launchState, debug = false } = config;
  const { files, entryPoint, resolution } = prepareLaunchFiles(config);

  const previewFiles = prepareSandpackFiles(files, {
    entryPoint,
    aesthetic: launchState.aesthetic,
    themePresetId: resolution.themePresetId,
    sourceRevisionId: launchState.revisionId,
  });
  assertNoMinimalFallbackPreview(previewFiles, resolution, 'Launch preview compiler');

  if (debug) stampDebugMetadata(previewFiles, launchState, resolution);

  return previewFiles;
}

/**
 * Same output as launchStateToSandpackFiles(), but runs the expensive
 * prepareSandpackFiles() compile off the main thread. Preview mounts moments
 * after the launcher's own strict check, which now shares this Worker's
 * result cache — so this is typically an instant cache hit, and even a cold
 * compile can no longer freeze the tab.
 */
export async function launchStateToSandpackFilesAsync(
  config: LaunchToSandpackConfig,
  options: { signal?: AbortSignal } = {},
): Promise<SandpackFiles> {
  const { launchState, debug = false } = config;
  const { files, entryPoint, resolution } = prepareLaunchFiles(config);

  const previewFiles = await runPrepareSandpackFilesOffThread({
    files,
    entryPoint,
    themePresetId: resolution.themePresetId,
    sourceRevisionId: launchState.revisionId,
    signal: options.signal,
    fallbackCompute: (fallbackFiles, fallbackEntryPoint, fallbackThemePresetId, sourceRevisionId) => prepareSandpackFiles(fallbackFiles, {
      entryPoint: fallbackEntryPoint,
      aesthetic: launchState.aesthetic,
      themePresetId: fallbackThemePresetId,
      sourceRevisionId,
    }),
  });
  assertNoMinimalFallbackPreview(previewFiles, resolution, 'Launch preview compiler');

  if (debug) stampDebugMetadata(previewFiles, launchState, resolution);

  return previewFiles;
}

export function debugLaunchToSandpack(
  launchState: LaunchState,
  filesOutput: SandpackFiles
) {
  if (typeof console !== 'undefined') {
    console.log('[LaunchToSandpack] Conversion:', {
      business: launchState.businessName,
      system: launchState.systemType,
      aesthetic: launchState.aesthetic,
      intents: launchState.preloadedIntents,
      fileCount: Object.keys(filesOutput).length,
      keys: Object.keys(filesOutput),
    });
  }
}
