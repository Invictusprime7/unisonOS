/**
 * Mode-B reverse: import a previously-exported source-project .zip and
 * reconstruct the canonical VFS shape the Builder expects.
 *
 * Symmetric with `src/services/export/exportSourceProject.ts` — anything that
 * service emits, this importer accepts. It also tolerates arbitrary Vite +
 * React + Tailwind projects (dropped-in third-party sources) as long as they
 * contain at least a `src/` folder with a React entry point.
 */

import JSZip from 'jszip';
import { createRuntimeManifest } from '@/platform/core/runtimeManifest';
import type { RuntimeManifest } from '@/types/runtimeManifest';

// Toolchain files we regenerate — never load their zip copy into the VFS,
// so a stale package.json can't override the Builder's canonical scaffolding.
const TOOLCHAIN_SKIP = new Set([
  'package.json',
  'package-lock.json',
  'bun.lockb',
  'yarn.lock',
  'pnpm-lock.yaml',
  'vite.config.ts',
  'vite.config.js',
  'tsconfig.json',
  'tsconfig.node.json',
  'tsconfig.app.json',
  'tailwind.config.ts',
  'tailwind.config.js',
  'postcss.config.js',
  'postcss.config.cjs',
  '.gitignore',
  '.env',
  '.env.local',
  '.env.example',
  'README.md',
  'AGENTS.md',
  'UNISON_PROJECT.md',
  'project-manifest.json',
  'design-context.json',
  'unison.runtime.json',
  'backend-capabilities.json',
  'asset-manifest.json',
  'export-preflight.json',
  'netlify.toml',
  'vercel.json',
  '_redirects',
  'public/_redirects',
]);

// Directories we never accept — junk that would blow up the VFS.
const SKIP_DIRS = [
  'node_modules/',
  'dist/',
  'build/',
  '.git/',
  '.next/',
  '.vercel/',
  '.turbo/',
  'coverage/',
  '.DS_Store',
];

// Text-ish extensions we load as source. Anything else is treated as an asset
// and dropped (the Builder VFS is a string-map, not a binary FS).
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.css', '.scss', '.html', '.svg', '.json', '.md', '.txt',
]);

export interface ImportedProject {
  vfsFiles: Record<string, string>;
  entryPoint: string;
  fileCount: number;
  projectName: string;
  runtimeManifest: RuntimeManifest;
  packageJson?: Record<string, unknown>;
  warnings: string[];
}

function fileExtension(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? '' : path.slice(dot).toLowerCase();
}

function findCommonRoot(paths: string[]): string {
  if (paths.length === 0) return '';
  // If every top-level entry shares a single folder prefix, strip it.
  const firstSegs = paths[0].split('/');
  let prefix = '';
  for (let i = 0; i < firstSegs.length - 1; i++) {
    const candidate = firstSegs.slice(0, i + 1).join('/') + '/';
    if (paths.every((p) => p.startsWith(candidate))) prefix = candidate;
    else break;
  }
  return prefix;
}

function isSkippedPath(relPath: string): boolean {
  if (!relPath) return true;
  if (SKIP_DIRS.some((d) => relPath === d || relPath.startsWith(d))) return true;
  if (relPath.endsWith('/')) return true; // directory entry
  return false;
}

function toVfsPath(relPath: string): string {
  return '/' + relPath.replace(/^\/+/, '');
}

function safeParseJson<T = unknown>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function importSourceProjectZip(
  file: File | Blob,
  options?: { fallbackName?: string },
): Promise<ImportedProject> {
  const zip = await JSZip.loadAsync(file);

  // Collect all entries first so we can figure out the common root folder
  // (exports wrap everything under `<slug>/`).
  const rawPaths: string[] = [];
  zip.forEach((path) => {
    if (!path.endsWith('/')) rawPaths.push(path);
  });

  if (rawPaths.length === 0) {
    throw new Error('Zip archive is empty');
  }

  const commonRoot = findCommonRoot(rawPaths);
  const warnings: string[] = [];
  const vfsFiles: Record<string, string> = {};
  let packageJsonObj: Record<string, unknown> | undefined;
  const unisonMetadata: Record<string, string> = {};

  for (const zipPath of rawPaths) {
    const relPath = commonRoot ? zipPath.slice(commonRoot.length) : zipPath;
    if (isSkippedPath(relPath)) continue;

    const ext = fileExtension(relPath);
    if (!TEXT_EXTENSIONS.has(ext) && ext !== '') {
      // Binary asset — skip with warning. (Future: base64 into /public/*.)
      warnings.push(`Skipped binary asset: ${relPath}`);
      continue;
    }

    const entry = zip.file(zipPath);
    if (!entry) continue;
    const content = await entry.async('string');

    // Toolchain files → don't inject into VFS; capture package.json for
    // manifest reconstruction.
    if (TOOLCHAIN_SKIP.has(relPath)) {
      if (relPath === 'package.json') {
        const parsed = safeParseJson<Record<string, unknown>>(content);
        if (parsed) packageJsonObj = parsed;
      }
      continue;
    }

    // Preserve Unison-native metadata (.unison/*.json) so re-import keeps
    // wizard seeds + runtime manifest intact.
    if (relPath.startsWith('.unison/')) {
      unisonMetadata['/' + relPath] = content;
      continue;
    }

    vfsFiles[toVfsPath(relPath)] = content;
  }

  // Merge preserved Unison metadata back into VFS.
  for (const [k, v] of Object.entries(unisonMetadata)) {
    vfsFiles[k] = v;
  }

  // Validate — the Builder canonical scaffold requires src/main.tsx,
  // src/App.tsx (or an entry the runtimeManifest points at) and src/index.css.
  const hasMain = !!(vfsFiles['/src/main.tsx'] || vfsFiles['/src/main.jsx']);
  const hasApp = !!(vfsFiles['/src/App.tsx'] || vfsFiles['/src/App.jsx']);
  if (!hasMain) warnings.push('Missing /src/main.tsx — Builder will regenerate it.');
  if (!hasApp) warnings.push('Missing /src/App.tsx — Builder will regenerate it.');

  // Ensure /src/index.css exists — Sandpack's synthesized /index.tsx entry
  // does `import './index.css'`, and previews hard-crash without it. If the
  // imported project used a different css filename, promote it. Otherwise
  // fall back to a Tailwind directive shim.
  if (!vfsFiles['/src/index.css']) {
    const cssCandidates = [
      '/src/styles.css', '/src/style.css', '/src/global.css', '/src/globals.css',
      '/src/app.css', '/src/App.css', '/src/main.css', '/src/tailwind.css',
    ];
    const found = cssCandidates.find((p) => typeof vfsFiles[p] === 'string');
    if (found) {
      vfsFiles['/src/index.css'] = vfsFiles[found];
      warnings.push(`Promoted ${found} → /src/index.css for preview entry compatibility.`);
    } else {
      vfsFiles['/src/index.css'] = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`;
      warnings.push('Synthesized minimal /src/index.css (Tailwind directives) for preview entry.');
    }
  }

  if (Object.keys(vfsFiles).length === 0) {
    throw new Error('No importable source files found in the zip');
  }

  // Try to reuse the exported runtime manifest verbatim; otherwise synthesize.
  let runtimeManifest: RuntimeManifest | null = null;
  const manifestFile = vfsFiles['/.unison/runtime-manifest.json'];
  if (manifestFile) {
    const parsed = safeParseJson<RuntimeManifest>(manifestFile);
    if (parsed && typeof parsed === 'object' && parsed.entryPoint) {
      runtimeManifest = parsed;
    }
  }

  const entryPoint =
    runtimeManifest?.entryPoint
    || (hasMain ? '/src/main.tsx' : hasApp ? '/src/App.tsx' : '/src/main.tsx');

  const projectName =
    (packageJsonObj?.name as string | undefined)
    || options?.fallbackName
    || commonRoot.replace(/\/+$/, '')
    || 'Imported Project';

  if (!runtimeManifest) {
    runtimeManifest = createRuntimeManifest(vfsFiles, {
      entryPoint,
      brandName: projectName,
    });
  }

  return {
    vfsFiles,
    entryPoint,
    fileCount: Object.keys(vfsFiles).length,
    projectName,
    runtimeManifest,
    packageJson: packageJsonObj,
    warnings,
  };
}
