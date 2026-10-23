/**
 * Mode B — Source-project .zip export.
 *
 * Reads the current canonical VFS (SiteBundleSnapshot-projected), normalizes
 * it via prepareSandpackFiles(), and packages a fully runnable Vite + React
 * + Tailwind project you can `npm i && npm run dev` on any machine.
 */

import JSZip from 'jszip';
import { prepareSandpackFiles } from '@/utils/sandpackFilePrep';
import {
  projectSnapshotVfsFiles,
  resolveSnapshot,
} from '@/services/snapshotProjector';
import type { RuntimeManifest } from '@/types/runtimeManifest';
import { synthesizeProjectFiles } from './packageJsonSynth';
import {
  netlifyRedirects,
  netlifyToml,
  vercelJson,
} from './hostAdapters';
import {
  UNISON_ATTRIBUTION_ASSET,
  UNISON_ATTRIBUTION_SCRIPT,
  injectPoweredByUnisonScript,
} from './unisonAttribution';
import { buildProjectExportMetadata } from './exportMetadata';
import { runExportPreflight } from './exportPreflight';
import { describeUnresolvedImports, findUnresolvedLocalImports } from '@/services/laneBCompanionModules';

export interface ExportSourceProjectOptions {
  projectName: string;
  entryPoint?: string;
  manifest?: RuntimeManifest;
}

export interface SourceProjectExportResult {
  blob: Blob;
  fileName: string;
  fileCount: number;
}

// Toolchain files we regenerate at export time — the scaffold synth owns them.
const SKIP_PATH_PREFIXES = [
  '/node_modules/',
];

const SKIP_FILE_NAMES = new Set([
  '/package.json',
  '/vite.config.ts',
  '/tsconfig.json',
  '/tsconfig.node.json',
  '/tailwind.config.ts',
  '/tailwind.config.js',
  '/postcss.config.js',
  '/postcss.config.cjs',
  '/index.html',
  '/.gitignore',
  '/README.md',
]);

function shouldIncludeVfsFile(path: string): boolean {
  if (SKIP_FILE_NAMES.has(path)) return false;
  return !SKIP_PATH_PREFIXES.some((pref) => path.startsWith(pref));
}


function zipPath(vfsPath: string): string {
  // Strip leading slash for zip entries.
  return vfsPath.replace(/^\/+/, '');
}

export async function exportSourceProject(
  vfsFiles: Record<string, string>,
  options: ExportSourceProjectOptions,
): Promise<SourceProjectExportResult> {
  if (!vfsFiles || Object.keys(vfsFiles).length === 0) {
    throw new Error('No VFS files available to export');
  }

  // 1. Snapshot-first canonical projection so themed CSS + registry router
  //    are preserved (same guarantees the preview relies on).
  const resolution = resolveSnapshot(vfsFiles);
  const projected = projectSnapshotVfsFiles(vfsFiles, resolution);

  const unresolvedSourceImports = findUnresolvedLocalImports(projected);
  if (unresolvedSourceImports.length > 0) {
    throw new Error(`Source export preflight failed: unresolved local imports: ${describeUnresolvedImports(unresolvedSourceImports)}`);
  }

  // 2. Normalize through the sandpack prep pipeline so @/ aliases, dep
  //    injection, and lint-repairs match what the preview actually ran.
  const prepared = prepareSandpackFiles(projected, {
    entryPoint: options.entryPoint,
    themePresetId: resolution.themePresetId ?? undefined,
  });

  // 3. Synthesize toolchain scaffolding.
  const scaffold = synthesizeProjectFiles(prepared, {
    projectName: options.projectName,
    manifest: options.manifest,
  });

  // 3b. Guarantee Unison metadata is baked into the zip so re-import can
  //     re-thread wizard theme + template state without re-running the wizard.
  //     - /.unison/site-bundle-snapshot.json  (composition + meta.themePresetId)
  //     - /.unison/runtime-manifest.json      (entryPoint + brand + presetId)
  const themePresetId = resolution.themePresetId ?? null;
  const manifestForZip = {
    ...(options.manifest ?? {}),
    entryPoint: options.entryPoint ?? options.manifest?.entryPoint ?? '/src/main.tsx',
    brandName: options.manifest?.brandName ?? options.projectName,
    themePresetId,
  };
  prepared['/.unison/runtime-manifest.json'] = JSON.stringify(manifestForZip, null, 2);

  // Sandpack preparation drops internal sidecars. Restore every source sidecar
  // byte-for-byte for import round trips, except the runtime manifest above,
  // which is deliberately normalized for this exported project.
  for (const [path, contents] of Object.entries(vfsFiles)) {
    if (!path.startsWith('/.unison/') || typeof contents !== 'string') continue;
    if (path === '/.unison/runtime-manifest.json' && prepared[path]) continue;
    if (!prepared[path]) prepared[path] = contents;
  }

  const zip = new JSZip();
  const projectSlug =
    options.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unison-site';
  const root = zip.folder(projectSlug);
  if (!root) throw new Error('Failed to create zip root folder');

  // 4. Emit VFS files (includes /.unison/* metadata for round-trip imports).
  //    Sandpack-prep flattens /src/* → /* for the preview runtime, but a Vite
  //    source project needs the /src/ layout. Restore it here so the zip is
  //    both `npm run dev`-able AND re-importable by the Builder.
  const toSourceProjectPath = (flat: string): string => {
    if (flat.startsWith('/.unison/') || flat.startsWith('/public/')) return flat;
    if (flat.startsWith('/src/')) return flat;
    if (flat === '/index.tsx' || flat === '/index.jsx' || flat === '/index.ts') {
      // Sandpack entry — Vite expects src/main.tsx.
      return flat.replace(/^\/index\./, '/src/main.');
    }
    if (/\.(tsx?|jsx?|css|scss)$/.test(flat)) return `/src${flat}`;
    return flat;
  };

  const sourceProjectFiles: Record<string, string> = {};
  const emitted = new Set<string>();
  for (const [path, contents] of Object.entries(prepared)) {
    if (typeof contents !== 'string') continue;
    if (!shouldIncludeVfsFile(path)) continue;
    const outPath = toSourceProjectPath(path);
    if (emitted.has(outPath)) continue;
    emitted.add(outPath);
    sourceProjectFiles[outPath] = contents;
    root.file(zipPath(outPath), contents);
  }

  // 5. Emit toolchain scaffolding.
  root.file('package.json', scaffold.packageJson);
  root.file('vite.config.ts', scaffold.viteConfig);
  root.file('tsconfig.json', scaffold.tsConfig);
  root.file('tsconfig.node.json', scaffold.tsConfigNode);
  root.file('tailwind.config.ts', scaffold.tailwindConfig);
  root.file('postcss.config.js', scaffold.postcssConfig);
  root.file('index.html', injectPoweredByUnisonScript(scaffold.indexHtml));
  root.file('.gitignore', scaffold.gitignore);
  root.file('README.md', scaffold.readme);
  root.file('AGENTS.md', scaffold.agentsMd);
  root.file('UNISON_PROJECT.md', scaffold.unisonProjectMd);
  if (scaffold.envExample.trim()) {
    root.file('.env.example', scaffold.envExample);
  }

  const exportMetadata = await buildProjectExportMetadata({
    projectName: options.projectName,
    entryPoint: manifestForZip.entryPoint,
    files: sourceProjectFiles,
    snapshot: resolution.snapshot,
    runtimeManifest: options.manifest,
  });

  const preflightFiles = {
    ...sourceProjectFiles,
    '/index.html': scaffold.indexHtml,
    '/vite.config.ts': scaffold.viteConfig,
    '/tailwind.config.ts': scaffold.tailwindConfig,
  };
  const exportPreflight = runExportPreflight({
    files: preflightFiles,
    entryPoint: manifestForZip.entryPoint,
    packageJson: scaffold.packageJson,
    hasLockfile: false,
  });
  if (!exportPreflight.passed) {
    const summary = exportPreflight.issues
      .slice(0, 6)
      .map((issue) => `${issue.code}: ${issue.path}${issue.reference ? ` -> ${issue.reference}` : ''}`)
      .join('; ');
    throw new Error(`Source export preflight failed: ${summary}`);
  }

  root.file('project-manifest.json', JSON.stringify(exportMetadata.projectManifest, null, 2));
  if (exportMetadata.designContext) {
    root.file('design-context.json', JSON.stringify(exportMetadata.designContext, null, 2));
  }
  root.file('unison.runtime.json', JSON.stringify(exportMetadata.runtimeManifest, null, 2));
  root.file('backend-capabilities.json', JSON.stringify(exportMetadata.backendCapabilities, null, 2));
  root.file('asset-manifest.json', JSON.stringify(exportMetadata.assetManifest, null, 2));
  root.file('export-preflight.json', JSON.stringify(exportPreflight, null, 2));

  // 6. Static-host SPA fallbacks (live at project root so `dist/` deploys
  //    pick them up when copied alongside).
  const publicFolder = root.folder('public') || root;
  publicFolder.file(UNISON_ATTRIBUTION_ASSET, UNISON_ATTRIBUTION_SCRIPT);
  publicFolder.file('_redirects', netlifyRedirects());
  root.file('vercel.json', vercelJson());
  root.file('netlify.toml', netlifyToml());

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    blob,
    fileName: `${projectSlug}-source.zip`,
    fileCount: Object.values(zip.files).filter((entry) => !entry.dir).length,
  };
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
