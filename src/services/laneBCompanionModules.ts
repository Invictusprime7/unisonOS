/**
 * Lane B companion-module contract.
 *
 * Lane B is allowed to author a page *and* the supporting modules that page
 * imports (e.g. `/src/pages/Gallery.tsx` + `/src/pages/components/GalleryItem.tsx`).
 * Historically the launcher scoped every batch response down to the exact
 * requested page paths, silently dropping those companions — which produced a
 * VFS whose pages import modules that do not exist. The Sandpack prep stage
 * then throws `PreviewPipelineError` (it refuses to synthesize empty
 * components for wizard drafts), the launch degrades, and the preview shows
 * the Lane A scaffold instead of the AI content.
 *
 * This module keeps companions while still protecting Lane A authority files,
 * and provides the import-closure check used before a page is accepted and
 * before the artifact is sealed.
 */

const MODULE_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js'] as const;
const EXPLICIT_MODULE_EXTENSION = /\.(?:tsx?|jsx?|json)$/i;

/** Files Lane A / Stage 4b owns. Lane B may never overwrite these. */
const LANE_A_AUTHORITY_PATHS = new Set([
  '/src/app.tsx',
  '/src/main.tsx',
  '/src/index.css',
  '/src/router.tsx',
  '/src/routes.tsx',
]);

export function normalizeVfsPath(path: string): string {
  return `/${path.replace(/\\/g, '/').replace(/^\/+/, '')}`.replace(/\/+/g, '/');
}

export function isLaneAAuthorityPath(path: string): boolean {
  const normalized = normalizeVfsPath(path).toLowerCase();
  return (
    LANE_A_AUTHORITY_PATHS.has(normalized) ||
    normalized.startsWith('/src/unison/ui/') ||
    normalized.startsWith('/.unison/')
  );
}

/** A companion module is any additional source/asset file under `/src/`. */
function isAcceptableCompanionPath(path: string): boolean {
  const normalized = normalizeVfsPath(path);
  if (!normalized.startsWith('/src/')) return false;
  if (isLaneAAuthorityPath(normalized)) return false;
  // A top-level page is a canonical PageRegistry target, never a companion.
  // Models sometimes ignore a batch's exact-key instruction and repeat other
  // pages. Treating those repeats as companions allowed a later batch to
  // overwrite an earlier batch's accepted page with unrelated or truncated
  // source. Nested page modules (for example pages/components/Card.tsx) remain
  // valid companions.
  if (/^\/src\/pages\/[^/]+\.(?:tsx|jsx|ts|js)$/i.test(normalized)) return false;
  return /\.(tsx|jsx|ts|js|css|json)$/i.test(normalized);
}

/**
 * Scope a Lane B batch response: keep the requested page files plus any
 * companion modules the model authored alongside them.
 */
export function scopeLaneBBatchFiles(
  files: Record<string, unknown>,
  requestedPaths: Iterable<string>,
): { pages: Record<string, string>; companions: Record<string, string> } {
  const requested = new Set(Array.from(requestedPaths, normalizeVfsPath));
  const pages: Record<string, string> = {};
  const companions: Record<string, string> = {};

  for (const [rawPath, rawContent] of Object.entries(files || {})) {
    if (typeof rawContent !== 'string' || !rawContent.trim()) continue;
    const path = normalizeVfsPath(rawPath);
    if (requested.has(path)) {
      pages[path] = rawContent;
      continue;
    }
    if (isAcceptableCompanionPath(path)) {
      companions[path] = rawContent;
    }
  }

  return { pages, companions };
}

export function resolveRelativeModule(
  filePath: string,
  rawImportPath: string,
  existingPaths: Set<string>,
): string | null {
  const dir = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
  let resolved = rawImportPath.startsWith('/')
    ? rawImportPath
    : `${dir}/${rawImportPath}`.replace(/\/\.\//g, '/');

  const stack: string[] = [];
  for (const part of resolved.split('/')) {
    if (part === '..') stack.pop();
    else if (part !== '.' && part !== '') stack.push(part);
  }
  resolved = `/${stack.join('/')}`;

  const candidates = EXPLICIT_MODULE_EXTENSION.test(resolved)
    ? [resolved]
    : [
        resolved,
        ...MODULE_EXTENSIONS.map((ext) => `${resolved}${ext}`),
        ...MODULE_EXTENSIONS.map((ext) => `${resolved}/index${ext}`),
      ];

  return candidates.find((candidate) => existingPaths.has(candidate)) || null;
}

export interface UnresolvedLocalImport {
  filePath: string;
  importPath: string;
}

/**
 * Return every relative import in `entryPaths` (default: all module files)
 * that cannot be resolved against `files`.
 */
export function findUnresolvedLocalImports(
  files: Record<string, string>,
  entryPaths?: Iterable<string>,
): UnresolvedLocalImport[] {
  const normalizedFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(files || {})) {
    if (typeof content === 'string') normalizedFiles[normalizeVfsPath(path)] = content;
  }
  const existingPaths = new Set(Object.keys(normalizedFiles));

  const entries = entryPaths
    ? Array.from(entryPaths, normalizeVfsPath).filter((path) => path in normalizedFiles)
    : Object.keys(normalizedFiles);

  const unresolved: UnresolvedLocalImport[] = [];
  const importRegex = /(?:import|export)\s+(?:[\w*{},\s]+?\s+from\s+)?['"](\.\.?\/[^'"]+)['"]/g;

  for (const filePath of entries) {
    if (!/\.(tsx?|jsx?)$/.test(filePath)) continue;
    const content = normalizedFiles[filePath];
    let match: RegExpExecArray | null;
    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (/\.(css|scss|less|svg|png|jpe?g|webp|gif)$/i.test(importPath)) continue;
      if (resolveRelativeModule(filePath, importPath, existingPaths)) continue;
      unresolved.push({ filePath, importPath });
    }
  }

  return unresolved;
}

/**
 * The entry module plus every local module it reaches through relative or
 * `@/` imports, in discovery order. Shared chrome (nav, footer, newsletter)
 * lives in imported components, so page-owned surfaces must include them.
 */
export function collectLocalImportClosure(
  files: Readonly<Record<string, string>>,
  entryPath: string,
  include: (path: string) => boolean = () => true,
): string[] {
  const normalizedFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(files || {})) {
    if (typeof content === 'string') normalizedFiles[normalizeVfsPath(path)] = content;
  }
  const existingPaths = new Set(Object.keys(normalizedFiles));
  const entry = normalizeVfsPath(entryPath);
  if (!existingPaths.has(entry)) return [];
  const importRegex = /(?:import|export)\s+(?:[\w*{},\s]+?\s+from\s+)?['"]((?:\.\.?\/|@\/)[^'"]+)['"]/g;
  const visited: string[] = [];
  const seen = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length) {
    const filePath = queue.shift()!;
    visited.push(filePath);
    if (!/\.(tsx?|jsx?)$/.test(filePath)) continue;
    const content = normalizedFiles[filePath];
    importRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const raw = match[1];
      if (/\.(css|scss|less|svg|png|jpe?g|webp|gif)$/i.test(raw)) continue;
      const resolved = resolveRelativeModule(filePath, raw.startsWith('@/') ? `/src/${raw.slice(2)}` : raw, existingPaths);
      if (!resolved || seen.has(resolved) || !include(resolved)) continue;
      seen.add(resolved);
      queue.push(resolved);
    }
  }
  return visited;
}

export function describeUnresolvedImports(items: UnresolvedLocalImport[]): string {
  return items
    .slice(0, 5)
    .map((item) => `${item.filePath} → "${item.importPath}"`)
    .join(', ');
}

export interface LocalJsxImportContractViolation {
  filePath: string;
  importPath: string;
  symbol: string;
  kind: 'missing-named-export' | 'missing-default-export';
  available: string[];
}

/** Mutation-free local JSX import/export validation for canonical VFS sealing. */
export function findLocalJsxImportContractViolations(
  files: Record<string, string>,
): LocalJsxImportContractViolation[] {
  const normalizedFiles = Object.fromEntries(
    Object.entries(files).map(([path, source]) => [normalizeVfsPath(path), source]),
  );
  const existingPaths = new Set(Object.keys(normalizedFiles));
  const violations: LocalJsxImportContractViolation[] = [];

  for (const [filePath, source] of Object.entries(normalizedFiles)) {
    if (!/\.(tsx|jsx)$/.test(filePath)) continue;

    const namedImport = /import\s+(?:[A-Z]\w*\s*,\s*)?\{([^}]*)\}\s+from\s+['"](\.?\.\/[^'"]+)['"];?/g;
    let namedMatch: RegExpExecArray | null;
    while ((namedMatch = namedImport.exec(source)) !== null) {
      const targetPath = resolveRelativeModule(filePath, namedMatch[2], existingPaths);
      if (!targetPath) continue;
      const targetSource = normalizedFiles[targetPath] || '';
      if (/export\s*\*\s*(?:as\s+\w+\s*)?from\s+['"][^'"]+['"]/.test(targetSource)) continue;
      const available = extractModuleExports(targetSource);
      const availableSet = new Set(available);

      for (const part of namedMatch[1].split(',').map((item) => item.trim()).filter(Boolean)) {
        const [imported, localAlias] = part.split(/\s+as\s+/).map((item) => item.trim());
        const local = localAlias || imported;
        if (
          /^[A-Z]/.test(imported)
          && new RegExp(`<${local}(?:\\s|/|>)`).test(source)
          && !availableSet.has(imported)
        ) {
          violations.push({
            filePath,
            importPath: namedMatch[2],
            symbol: imported,
            kind: 'missing-named-export',
            available,
          });
        }
      }
    }

    const defaultImport = /import\s+([A-Z]\w*)(?:\s*,\s*\{[^}]*\})?\s+from\s+['"](\.?\.\/[^'"]+)['"];?/g;
    let defaultMatch: RegExpExecArray | null;
    while ((defaultMatch = defaultImport.exec(source)) !== null) {
      const local = defaultMatch[1];
      if (!new RegExp(`<${local}(?:\\s|/|>)`).test(source)) continue;
      const targetPath = resolveRelativeModule(filePath, defaultMatch[2], existingPaths);
      if (!targetPath) continue;
      const targetSource = normalizedFiles[targetPath] || '';
      const available = extractModuleExports(targetSource);
      if (
        !available.includes('default')
        && !/export\s*\*\s*(?:as\s+\w+\s*)?from\s+['"][^'"]+['"]/.test(targetSource)
      ) {
        violations.push({
          filePath,
          importPath: defaultMatch[2],
          symbol: local,
          kind: 'missing-default-export',
          available,
        });
      }
    }
  }

  return violations;
}

/**
 * Absolute VFS path Lane B must author to satisfy an unresolved relative
 * import. Extension-less imports resolve to a `.tsx` module by convention.
 */
export function resolveMissingModulePath(filePath: string, importPath: string): string {
  const dir = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
  const joined = importPath.startsWith('/') ? importPath : `${dir}/${importPath}`;
  const stack: string[] = [];
  for (const part of joined.split('/')) {
    if (part === '..') stack.pop();
    else if (part !== '.' && part !== '') stack.push(part);
  }
  const resolved = `/${stack.join('/')}`;
  return EXPLICIT_MODULE_EXTENSION.test(resolved) ? resolved : `${resolved}.tsx`;
}

/** Group unresolved imports by the file that declares them. */
export function groupUnresolvedByFile(
  items: UnresolvedLocalImport[],
): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const item of items) {
    (grouped[item.filePath] ||= []).push(item.importPath);
  }
  return grouped;
}

// ── Module context (prompt) ────────────────────────────────────────────────

const EXPORT_PATTERN =
  /export\s+(?:default\s+(?:function\s+)?(\w+)?|(?:async\s+)?function\s+(\w+)|const\s+(\w+)|class\s+(\w+)|\{([^}]+)\})/g;

/** Exported symbol names declared by a module source. */
export function extractModuleExports(source: string): string[] {
  const names = new Set<string>();
  EXPORT_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = EXPORT_PATTERN.exec(source))) {
    const [, defaultName, fnName, constName, className, braced] = match;
    if (braced) {
      for (const part of braced.split(',')) {
        const name = part.trim().split(/\s+as\s+/i).pop()?.trim();
        if (name) names.add(name);
      }
      continue;
    }
    const name = defaultName || fnName || constName || className;
    if (name) names.add(name);
    if (/export\s+default/.test(match[0])) names.add('default');
  }
  return Array.from(names);
}

export interface ModuleInventoryOptions {
  /** Every file currently present in the merged VFS (Stage 4b + accepted AI). */
  files: Record<string, string>;
  /** Absolute VFS paths this turn is expected to author. */
  targetPaths?: readonly string[];
  /** Approved alias import roots (e.g. `@/unison/ui` sub-paths). */
  aliasImports?: readonly string[];
  maxEntries?: number;
}

/**
 * Full module context for a Lane B turn.
 *
 * Lane B repeatedly imported modules that do not exist because it was never
 * shown what *does* exist. This inventory is injected into every Lane B turn
 * (first pass, batch, page completion, module closure) so the model can either
 * import a real module or author the companion in the same response.
 *
 * Deliberately industry-neutral: module and styling availability is universal.
 * Industry constrains intent semantics only — never which components, layout
 * families, or style primitives a page may use.
 */
export function buildModuleInventoryDirective(options: ModuleInventoryOptions): string {
  const { files, targetPaths = [], aliasImports = [], maxEntries = 60 } = options;
  const targets = new Set(targetPaths.map(normalizeVfsPath));

  const entries = Object.entries(files)
    .map(([path, source]) => [normalizeVfsPath(path), source] as const)
    .filter(([path, source]) =>
      typeof source === 'string' &&
      path.startsWith('/src/') &&
      /\.(tsx|jsx|ts|js)$/i.test(path) &&
      !targets.has(path))
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, maxEntries)
    .map(([path, source]) => {
      const exported = extractModuleExports(source).slice(0, 8);
      return `- ${path}${exported.length ? ` → exports: ${exported.join(', ')}` : ''}`;
    });

  return [
    '── MODULE CONTEXT (AUTHORITATIVE VFS INVENTORY) ──',
    'These modules already exist and may be imported exactly as listed:',
    entries.join('\n') || '- (no existing source modules yet)',
    aliasImports.length
      ? `Approved alias imports: ${aliasImports.join(', ')}`
      : '',
    'IMPORT CONTRACT (hard requirement):',
    '1. Import only from the paths listed above, approved "@/unison/ui" sub-paths, "react", "lucide-react", or the motion facade.',
    '2. Any other relative import MUST be authored by you in the SAME response, as an additional entry in the "files" object, using its full absolute VFS path.',
    '3. Never import a module you did not list above and did not author in this response.',
    '4. Every module you author must be syntactically complete with explicit exports.',
    'STYLING/COMPONENT SCOPE: every listed module, layout family, animation primitive, and style token is available for EVERY industry. Industry affects copy and intent semantics only — never which components or styles you may use.',
  ].filter(Boolean).join('\n');
}
