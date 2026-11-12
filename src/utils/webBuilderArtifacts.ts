import { prepareSandpackFiles } from '@/utils/sandpackFilePrep';
import { bundleCode } from '@/utils/codeBundler';
import {
  assertNoMinimalFallbackPreview,
  projectSnapshotVfsFiles,
  resolveSnapshot,
} from '@/services/snapshotProjector';
import { isPreviewPipelineError } from '@/services/previewPipelineError';

export interface CanonicalBuildArtifacts {
  exportHtml: string;
  exportCss: string;
  exportJs: string;
  deployFiles: Record<string, string>;
}

export function buildCanonicalArtifacts(
  sourceFiles: Record<string, string>,
  options?: {
    entryPoint?: string;
    title?: string;
  },
): CanonicalBuildArtifacts | null {
  if (!sourceFiles || Object.keys(sourceFiles).length === 0) {
    return null;
  }

  // Snapshot-as-primary: restore any legacy/minimal placeholders from the
  // SiteBundleSnapshot before compiling deploy/export artifacts. This is the
  // final bridge that keeps wizard seed/sitebundle registries authoritative
  // for deploy bundles (preview already routes through buildPreviewArtifacts).
  let compiled: Record<string, string>;
  try {
    const resolution = resolveSnapshot(sourceFiles);
    const projectedSource = projectSnapshotVfsFiles(sourceFiles, resolution);
    assertNoMinimalFallbackPreview(projectedSource, resolution, 'Canonical artifact gate');

    compiled = prepareSandpackFiles(projectedSource, {
      entryPoint: options?.entryPoint,
      themePresetId: resolution.themePresetId ?? undefined,
    });
    assertNoMinimalFallbackPreview(compiled, resolution, 'Canonical artifact compiler');
  } catch (err) {
    // Export/deploy artifact generation runs inside WebBuilder render as a
    // convenience for the export dialog. It must never take down the builder
    // shell; PreviewPipelineError still surfaces through the dedicated preview
    // runtime path where users can relaunch or repair the draft.
    if (isPreviewPipelineError(err)) {
      console.warn('[webBuilderArtifacts] Canonical artifact build deferred:', err.message);
      return null;
    }
    throw err;
  }

  const entryCode = compiled['/App.tsx']
    || compiled['/App.jsx']
    || compiled['/index.tsx']
    || compiled['/index.jsx']
    || '';

  let bundle: { html: string; css: string; javascript: string } = { html: '', css: '', javascript: '' };
  if (entryCode) {
    try {
      bundle = bundleCode(entryCode);
    } catch (err) {
      // Re-wrap any read-only SyntaxError so it doesn't crash the WebBuilder.
      // Sandpack will surface the real syntax error in-preview.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[webBuilderArtifacts] bundleCode failed, returning empty deploy bundle:', msg);
    }
  }
  const cssParts = [compiled['/index.css'], compiled['/template.css'], bundle.css]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
  const mergedCss = cssParts.join('\n\n');

  const compiledIndexHtml = compiled['/index.html'] || '';
  const bodyFromCompiledIndex = compiledIndexHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim() || '';
  const htmlBody = (bundle.html || bodyFromCompiledIndex || '<div id="root"></div>').trim();
  const jsContent = (bundle.javascript || '').trim();
  const title = options?.title?.trim() || '';

  const deployHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
${mergedCss}
  </style>
</head>
<body>
${htmlBody}
${jsContent ? '  <script src="script.js"></script>' : ''}
</body>
</html>`;

  const deployFiles: Record<string, string> = {
    'index.html': deployHtml,
    'styles.css': mergedCss,
    ...(jsContent ? { 'script.js': jsContent } : {}),
  };

  return {
    exportHtml: htmlBody,
    exportCss: mergedCss,
    exportJs: jsContent,
    deployFiles,
  };
}
