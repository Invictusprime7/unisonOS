/**
 * Dependency Extractor - Automatically detects and extracts npm dependencies from VFS code
 * 
 * Features:
 * - Parses import/require statements from all code files
 * - Resolves package names from import paths
 * - Reads package.json in VFS for pinned versions
 * - Handles scoped packages (@org/package)
 * - Filters out relative imports and built-in modules
 * - Merges with bundled dependencies for Sandpack
 */

import {
  expandSandpackRuntimeDependencies,
  resolvePinnedRuntimeVersion,
  SANDPACK_DEPENDENCIES,
} from '@/utils/sandpackDependencies';
import {
  GENERATED_RUNTIME_PROFILE,
} from '@/platform/core/generatedRuntimeCapabilities';
import { hashSeed } from '@/platform/core/generationSeed';

// Built-in Node.js modules that shouldn't be treated as dependencies
const BUILTIN_MODULES = new Set([
  'fs', 'path', 'os', 'util', 'events', 'stream', 'http', 'https', 'url',
  'querystring', 'crypto', 'assert', 'buffer', 'child_process', 'cluster',
  'dgram', 'dns', 'domain', 'net', 'readline', 'repl', 'tls', 'tty', 'v8',
  'vm', 'zlib', 'worker_threads', 'perf_hooks', 'async_hooks', 'inspector',
  'module', 'process', 'console', 'timers', 'string_decoder'
]);

// Runtime packages resolve from the same catalog used to prepare Sandpack.
const KNOWN_VERSIONS: Record<string, string> = {
  ...SANDPACK_DEPENDENCIES,
  'axios': 'latest',
  'jotai': 'latest',
  'swr': 'latest',
};

// Regex patterns for extracting imports
const IMPORT_PATTERNS = [
  // ES6 imports: import X from 'package'
  /import\s+(?:[\w{}\s,*]+\s+from\s+)?['"]([^'"]+)['"]/g,
  // Dynamic imports: import('package')
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Require: require('package')
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Re-exports, including namespace barrels: export * as UI from './ui'.
  /export\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|{[^}]*})\s+from\s+['"]([^'"]+)['"]/g,
];

export interface ExtractedDependencies {
  /** Dependencies map: package name -> version */
  dependencies: Record<string, string>;
  /** List of packages that couldn't be resolved */
  unresolved: string[];
  /** Packages that were extracted from code */
  detected: string[];
  /** Packages from VFS package.json */
  fromPackageJson: string[];
  /** Total extraction time in ms */
  extractionTime: number;
}

export interface DependencyExtractionOptions {
  /** Restrict extraction to modules reachable from these VFS entry points. */
  entryPoints?: string[];
}

export interface ResolvedSiteDependencyRuntime {
  version: '1.0';
  runtimeProfile: string;
  entryPoints: string[];
  dependencies: Record<string, string>;
  packageNames: string[];
  graphFingerprint: string;
  extractionInfo: ExtractedDependencies;
}

/**
 * Extract npm package name from an import path
 * Handles scoped packages (@org/package) and subpaths (package/subpath)
 */
function extractPackageName(importPath: string): string | null {
  // Skip relative imports
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    return null;
  }

  // Skip aliases (commonly @/ or ~/)
  if (importPath.startsWith('@/') || importPath.startsWith('~/')) {
    return null;
  }

  // Skip built-in modules
  const firstPart = importPath.split('/')[0];
  if (BUILTIN_MODULES.has(firstPart)) {
    return null;
  }

  // Handle scoped packages: @org/package/subpath -> @org/package
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return null;
  }

  // Regular packages: package/subpath -> package
  return importPath.split('/')[0];
}

function normalizeVfsPath(path: string): string {
  const segments = path.replace(/\\/g, '/').split('/');
  const normalized: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      normalized.pop();
    } else {
      normalized.push(segment);
    }
  }
  return `/${normalized.join('/')}`;
}

function resolveLocalModule(
  fromPath: string,
  importPath: string,
  filePaths: Set<string>,
): string | null {
  // Canonical projects use /src; Sandpack preparation flattens that prefix.
  const roots = importPath.startsWith('@/')
    ? (fromPath.startsWith('/src/') ? [`/src/${importPath.slice(2)}`, `/${importPath.slice(2)}`] : [`/${importPath.slice(2)}`, `/src/${importPath.slice(2)}`])
    : [normalizeVfsPath(`${fromPath.slice(0, fromPath.lastIndexOf('/'))}/${importPath}`)];
  const candidates = roots.flatMap(root => [
    root,
    ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css'].map((extension) => `${root}${extension}`),
    ...['.ts', '.tsx', '.js', '.jsx'].map((extension) => `${root}/index${extension}`),
  ]);

  return candidates.find((candidate) => filePaths.has(candidate)) ?? null;
}

/** Canonical and flattened Sandpack roots; partial module sets have no inferred root. */
export function runtimeEntryPoints(files: Record<string, string>): string[] {
  const paths = new Set(Object.keys(files).map(normalizeVfsPath));
  const root = ['/src/main.tsx', '/src/main.jsx', '/src/index.tsx', '/index.tsx', '/src/App.tsx', '/App.tsx']
    .find(path => paths.has(path));
  return root ? [root] : [];
}

export function collectReachableFiles(
  files: Record<string, string>,
  entryPoints: string[],
): Record<string, string> {
  const normalizedFiles = new Map(
    Object.entries(files).map(([path, content]) => [normalizeVfsPath(path), content]),
  );
  const filePaths = new Set(normalizedFiles.keys());
  const pending = entryPoints
    .map(normalizeVfsPath)
    .filter((path) => filePaths.has(path));
  const visited = new Set<string>();

  while (pending.length > 0) {
    const path = pending.pop();
    if (!path || visited.has(path)) continue;
    visited.add(path);
    const content = normalizedFiles.get(path) || '';

    for (const pattern of IMPORT_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const importPath = match[1];
        if (!importPath.startsWith('.') && !importPath.startsWith('@/')) continue;
        const dependencyPath = resolveLocalModule(path, importPath, filePaths);
        if (dependencyPath && !visited.has(dependencyPath)) pending.push(dependencyPath);
      }
    }
  }

  const reachable = Object.fromEntries(
    Array.from(visited, (path) => [path, normalizedFiles.get(path) || '']),
  );
  const packageJson = files['/package.json'] || files['package.json'];
  if (packageJson) reachable['/package.json'] = packageJson;
  return reachable;
}

/**
 * Parse package.json from VFS and extract dependencies
 */
function parsePackageJson(content: string): Record<string, string> {
  try {
    const pkg = JSON.parse(content);
    // Sandpack's browser runtime needs installed application dependencies.
    // Vite/TypeScript devDependencies belong to export/build tooling and would
    // needlessly inflate the hosted preview install.
    return { ...(pkg.dependencies || {}) };
  } catch {
    return {};
  }
}

/**
 * Extract all dependencies from VFS files
 * 
 * @param files - VFS file map (path -> content)
 * @returns Extracted dependencies info
 */
export function extractDependencies(
  files: Record<string, string>,
  options: DependencyExtractionOptions = {},
): ExtractedDependencies {
  const startTime = performance.now();
  const detected = new Set<string>();
  const fromPackageJson = new Set<string>();
  const unresolved: string[] = [];

  const filesToScan = options.entryPoints?.length
    ? collectReachableFiles(files, options.entryPoints)
    : files;

  // A generated VFS package.json also describes export/build tooling and
  // local aliases. It supplies versions for browser imports, but must never
  // become Sandpack's unconditional install list.
  let packageJsonDeps: Record<string, string> = {};
  const packageJsonContent = filesToScan['/package.json'] || filesToScan['package.json'];
  if (packageJsonContent) {
    packageJsonDeps = parsePackageJson(packageJsonContent);
  }

  // Scan all code files for imports
  const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  
  for (const [filePath, content] of Object.entries(filesToScan)) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    // Exported projects keep build configuration in the VFS, but Sandpack
    // should install only packages imported by the browser application.
    if (
      /(?:^|\/)(?:vite|tailwind|postcss|eslint|prettier)\.config\.[cm]?[jt]s$/i.test(normalizedPath)
      || normalizedPath.endsWith('.d.ts')
    ) {
      continue;
    }
    // Only scan code files
    const ext = normalizedPath.substring(normalizedPath.lastIndexOf('.'));
    if (!codeExtensions.includes(ext)) continue;
    
    // Apply all import patterns
    for (const pattern of IMPORT_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0;
      
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const importPath = match[1];
        const packageName = extractPackageName(importPath);
        
        if (packageName) {
          detected.add(packageName);
        }
      }
    }
  }

  // Build final dependencies map
  // Explicit `install` commands persist into VFS package.json. Include those
  // package versions only when the active preview graph imports them. This
  // prevents generated Vite/build dependencies and local aliases from making
  // Sandpack fetch an invalid or oversized module graph.
  const dependencies: Record<string, string> = {};
  
  for (const pkg of detected) {
    // Runtime-critical packages (Radix facade graph, framer-motion, the
    // three.js experience capability) are pinned against the generated React
    // profile. Their pins outrank even a persisted package.json so stale
    // snapshots that recorded `latest` heal on the next preview instead of
    // installing an incompatible major.
    const pinned = resolvePinnedRuntimeVersion(pkg);
    if (pinned) {
      dependencies[pkg] = pinned;
      continue;
    }
    // Priority: package.json > known versions > 'latest'
    if (packageJsonDeps[pkg]) {
      dependencies[pkg] = packageJsonDeps[pkg];
      fromPackageJson.add(pkg);
    } else if (KNOWN_VERSIONS[pkg]) {
      dependencies[pkg] = KNOWN_VERSIONS[pkg];
    } else {
      dependencies[pkg] = 'latest';
      // Track truly unknown packages
      if (!KNOWN_VERSIONS[pkg]) {
        unresolved.push(pkg);
      }
    }
  }

  // Ensure React is always included
  if (!dependencies['react']) {
    dependencies['react'] = KNOWN_VERSIONS['react'];
  }
  if (!dependencies['react-dom']) {
    dependencies['react-dom'] = KNOWN_VERSIONS['react-dom'];
  }

  return {
    dependencies,
    unresolved,
    detected: Array.from(detected),
    fromPackageJson: Array.from(fromPackageJson),
    extractionTime: performance.now() - startTime,
  };
}

/**
 * Merge extracted dependencies with base Sandpack dependencies
 * Returns a combined dependency map safe for Sandpack customSetup
 */
export function mergeDependencies(
  extracted: Record<string, string>,
  base: Record<string, string> = {}
): Record<string, string> {
  // Base dependencies take precedence (they're known to work)
  return {
    ...extracted,
    ...base,
  };
}

/**
 * Get all dependencies needed for Sandpack from VFS files
 * This is the main entry point for SimplePreview integration
 */
export function getDependenciesForSandpack(
  files: Record<string, string>,
  baseDependencies: Record<string, string> = {},
  options: DependencyExtractionOptions = {},
): {
  dependencies: Record<string, string>;
  extractionInfo: ExtractedDependencies;
  graphFingerprint: string;
} {
  const resolution = resolveSiteDependencyRuntime(files, baseDependencies, options);
  const { extractionInfo, dependencies } = resolution;
  
  // Log for debugging
  if (extractionInfo.unresolved.length > 0) {
    console.warn('[DependencyExtractor] Unresolved packages (using latest):', extractionInfo.unresolved);
  }
  
  console.log('[DependencyExtractor] Resolved site runtime:', {
    total: Object.keys(dependencies).length,
    detected: extractionInfo.detected.length,
    fromPackageJson: extractionInfo.fromPackageJson.length,
    unresolved: extractionInfo.unresolved.length,
    graphFingerprint: resolution.graphFingerprint,
    time: `${extractionInfo.extractionTime.toFixed(2)}ms`,
  });
  
  return { dependencies, extractionInfo, graphFingerprint: resolution.graphFingerprint };
}

/**
 * Resolve one site's reachable import graph into the exact dependency map used
 * by preview, candidate validation, and runtime compatibility checks.
 */
export function resolveSiteDependencyRuntime(
  files: Record<string, string>,
  baseDependencies: Record<string, string> = {},
  options: DependencyExtractionOptions = {},
): ResolvedSiteDependencyRuntime {
  const entryPoints = [...new Set((options.entryPoints?.length ? options.entryPoints : runtimeEntryPoints(files))
    .map(normalizeVfsPath))].sort();
  const extractionInfo = extractDependencies(files, { ...options, entryPoints });
  // The curated baseline is part of the generated-site runtime contract, not
  // an optimization hint. It keeps Radix primitives and Tailwind plugin paths
  // available for rich components even before a particular variant imports
  // every package. Extracted dependencies are merged in for site-specific
  // imports; the curated baseline owns versions where the two overlap.
  const dependencies = expandSandpackRuntimeDependencies(
    mergeDependencies(extractionInfo.dependencies, baseDependencies),
  );

  const reachableFiles = entryPoints.length ? collectReachableFiles(files, entryPoints) : files;
  const sourceHashes = Object.entries(reachableFiles)
    .map(([path, source]) => [normalizeVfsPath(path), hashSeed(source)] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  const sortedDependencies = Object.entries(dependencies).sort(([left], [right]) => left.localeCompare(right));
  const graphFingerprint = `site-deps-v1-${hashSeed(JSON.stringify({
    runtimeProfile: GENERATED_RUNTIME_PROFILE.id,
    entryPoints,
    sourceHashes,
    dependencies: sortedDependencies,
  })).toString(16).padStart(8, '0')}`;

  return {
    version: '1.0',
    runtimeProfile: GENERATED_RUNTIME_PROFILE.id,
    entryPoints,
    dependencies,
    packageNames: sortedDependencies.map(([name]) => name),
    graphFingerprint,
    extractionInfo,
  };
}

export default {
  extractDependencies,
  mergeDependencies,
  resolveSiteDependencyRuntime,
  getDependenciesForSandpack,
  KNOWN_VERSIONS,
};
