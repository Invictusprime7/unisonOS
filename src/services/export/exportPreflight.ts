import { findUnresolvedLocalImports, normalizeVfsPath, resolveRelativeModule } from '@/services/laneBCompanionModules';

export type ExportPreflightIssueCode =
  | 'entry-point-missing'
  | 'unresolved-local-import'
  | 'unresolved-asset'
  | 'undeclared-package-import'
  | 'invalid-package-json';

export interface ExportPreflightIssue {
  code: ExportPreflightIssueCode;
  path: string;
  reference?: string;
}

export interface ExportPreflightWarning {
  code: 'floating-dependency-version' | 'lockfile-missing';
  packageName?: string;
}

export interface ExportPreflightResult {
  schemaVersion: 'unison-export-preflight/1';
  passed: boolean;
  entryPoint: string;
  issues: ExportPreflightIssue[];
  warnings: ExportPreflightWarning[];
}

const SOURCE_EXTENSION = /\.(?:tsx?|jsx?|mjs|cjs|html|css|scss)$/i;
const ASSET_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp|woff2?|ttf|otf|mp4|webm|mp3|wav|pdf)$/i;
const LOCAL_SCHEME = /^(?:https?:|data:|blob:|mailto:|tel:|#|\/\/)/i;
const PACKAGE_BUILTINS = new Set([
  'assert', 'buffer', 'child_process', 'crypto', 'events', 'fs', 'http', 'https', 'module',
  'os', 'path', 'process', 'stream', 'url', 'util', 'zlib',
]);

function stripQueryAndHash(reference: string): string {
  return reference.split(/[?#]/, 1)[0];
}

function resolveLocalReference(sourcePath: string, reference: string, existingPaths: Set<string>): string | null {
  const cleanReference = stripQueryAndHash(reference.trim());
  if (!cleanReference || LOCAL_SCHEME.test(cleanReference)) return null;

  let mapped = cleanReference;
  if (mapped.startsWith('@/')) mapped = `/src/${mapped.slice(2)}`;
  if (mapped.startsWith('~/')) mapped = `/src/${mapped.slice(2)}`;

  if (mapped.startsWith('/')) {
    const rooted = normalizeVfsPath(mapped);
    const direct = resolveRelativeModule('/', rooted, existingPaths);
    if (direct) return direct;
    return resolveRelativeModule('/', `/public${rooted}`, existingPaths);
  }

  const local = resolveRelativeModule(sourcePath, mapped, existingPaths);
  if (local) return local;
  return null;
}

function packageName(specifier: string): string | null {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('@/') || specifier.startsWith('~/')) {
    return null;
  }
  const first = specifier.split('/')[0];
  if (PACKAGE_BUILTINS.has(first) || first.startsWith('node:')) return null;
  return first.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : first;
}

function importSpecifiers(contents: string): string[] {
  const specs = new Set<string>();
  const patterns = [
    /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of contents.matchAll(pattern)) specs.add(match[1]);
  }
  return [...specs];
}

function referencedAssets(path: string, contents: string): string[] {
  const references = new Set<string>();
  const patterns = [
    /\b(?:src|href|poster)\s*=\s*['"]([^'"]+)['"]/gi,
    /\burl\(\s*['"]?([^)'"\s]+)['"]?\s*\)/gi,
  ];
  if (!/\.(?:tsx?|jsx|html|css|scss)$/i.test(path)) return [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of contents.matchAll(pattern)) {
      const rawReference = match[1].trim();
      if (LOCAL_SCHEME.test(rawReference)) continue;
      const reference = stripQueryAndHash(rawReference);
      if (ASSET_EXTENSION.test(reference)) {
        references.add(rawReference);
      }
    }
  }
  return [...references];
}

export function runExportPreflight(input: {
  files: Record<string, string>;
  entryPoint: string;
  packageJson: string;
  hasLockfile?: boolean;
}): ExportPreflightResult {
  const files = Object.fromEntries(Object.entries(input.files).map(([path, content]) => [normalizeVfsPath(path), content]));
  const existingPaths = new Set(Object.keys(files));
  const entryPoint = normalizeVfsPath(input.entryPoint);
  const issues: ExportPreflightIssue[] = [];
  const warnings: ExportPreflightWarning[] = [];

  if (!existingPaths.has(entryPoint)) {
    issues.push({ code: 'entry-point-missing', path: entryPoint });
  }

  for (const unresolved of findUnresolvedLocalImports(files)) {
    issues.push({
      code: 'unresolved-local-import',
      path: unresolved.filePath,
      reference: unresolved.importPath,
    });
  }

  let packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    packageJson = JSON.parse(input.packageJson);
  } catch {
    return {
      schemaVersion: 'unison-export-preflight/1',
      passed: false,
      entryPoint,
      issues: [...issues, { code: 'invalid-package-json', path: '/package.json' }],
      warnings,
    };
  }

  const declared = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
  ]);
  for (const [path, contents] of Object.entries(files)) {
    if (!SOURCE_EXTENSION.test(path)) continue;
    for (const specifier of importSpecifiers(contents)) {
      if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('@/') || specifier.startsWith('~/')) {
        if (!resolveLocalReference(path, specifier, existingPaths)) {
          issues.push({ code: ASSET_EXTENSION.test(specifier) ? 'unresolved-asset' : 'unresolved-local-import', path, reference: specifier });
        }
        continue;
      }
      const name = packageName(specifier);
      if (name && !declared.has(name)) {
        issues.push({ code: 'undeclared-package-import', path, reference: name });
      }
    }
    for (const reference of referencedAssets(path, contents)) {
      if (!resolveLocalReference(path, reference, existingPaths)) {
        issues.push({ code: 'unresolved-asset', path, reference });
      }
    }
  }

  for (const [name, version] of Object.entries({
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  })) {
    if (/^(?:latest|\*|x|\^|~|>=|>|<=|<)/i.test(version) || /[|*x]/i.test(version)) {
      warnings.push({ code: 'floating-dependency-version', packageName: name });
    }
  }
  if (!input.hasLockfile) warnings.push({ code: 'lockfile-missing' });

  return { schemaVersion: 'unison-export-preflight/1', passed: issues.length === 0, entryPoint, issues, warnings };
}