import { resolveLocalImport } from './aiCandidateGates';

/** Recipe bundles are implementation detail; showing them teaches the model to import them. */
const DESIGN_SOURCE_INTERNALS = /^\/src\/unison\/design-sources\/recipes\//;

/** Read-only project knowledge, bounded by its encoded transport size. */
export function selectSourceKnowledge(
  files: Record<string, string>,
  targets: string[],
  maxBytes = 140_000,
): Record<string, string> {
  return selectSourceKnowledgeWithReport(files, targets, maxBytes).files;
}

export interface SourceKnowledgeReport {
  files: Record<string, string>;
  omitted: Array<{ path: string; reason: 'missing' | 'per-file-limit' | 'transport-budget' }>;
  unresolvedImports: Array<{ path: string; specifier: string }>;
  encodedBytes: number;
  completeTargets: boolean;
}

/** Keeps whole sources and makes missing context observable to the caller. */
export interface SourceKnowledgeScope {
  /** Scoped edits read targets + their direct imports only (no transitive crawl). */
  scoped?: boolean;
  /** Include /src/index.css (theme tokens) even when scoped. */
  includeTheme?: boolean;
  /** Include /package.json even when scoped. */
  includeDependencies?: boolean;
  /** Include the certified motion + 3D facades so the AI composes real primitives. */
  includeExperience?: boolean;
}

/** Certified motion/3D facade sources the AI must compose instead of inventing effects. */
export const EXPERIENCE_KNOWLEDGE_FILES = [
  '/src/unison/ui/motion.tsx',
  '/src/unison/ui/animation.ts',
  '/src/unison/ui/experience/index.ts',
  '/src/unison/ui/experience/scene.tsx',
  '/src/unison/ui/experience/stage.tsx',
  '/src/unison/ui/experience/media.tsx',
];

/** Deterministic: which optional reads a scoped instruction actually needs. */
export function scopeForInstruction(instruction: string | undefined): SourceKnowledgeScope {
  const text = (instruction ?? '').toLowerCase();
  return {
    scoped: true,
    includeTheme: /\b(theme|token|colou?r|palette|font|typograph|css|brand|dark mode|light mode)\b/.test(text),
    includeDependencies: /\b(dependenc|package|install|npm|library|librar)/.test(text),
    includeExperience: /\b(motion|animat\w*|3d|three|webgl|parallax|scroll|immersive|hover effect|transition|fade|reveal|depth|scene)\b/.test(text),
  };
}

export function selectSourceKnowledgeWithReport(
  files: Record<string, string>,
  targets: string[],
  maxBytes = 140_000,
  scope: SourceKnowledgeScope = {},
): SourceKnowledgeReport {
  if (!Number.isFinite(maxBytes) || maxBytes < 4) throw new Error('Source context budget must fit an empty encoded object.');
  const omitted: SourceKnowledgeReport['omitted'] = [];
  const unresolvedImports: SourceKnowledgeReport['unresolvedImports'] = [];
  const selected: Record<string, string> = {};
  const visited = new Set<string>();
  const queue = scope.scoped
    ? [...targets,
      ...(scope.includeTheme ? ['/src/index.css'] : []),
      ...(scope.includeDependencies ? ['/package.json'] : []),
      ...(scope.includeExperience ? EXPERIENCE_KNOWLEDGE_FILES : [])]
    : [...targets, '/src/index.css', '/package.json',
      ...Object.keys(files).filter((path) => path.startsWith('/src/project-components/site/')).sort()];
  const targetSet = new Set(targets);
  const encoder = new TextEncoder();
  for (let index = 0; index < queue.length; index++) {
    const path = queue[index];
    if (visited.has(path)) continue;
    visited.add(path);
    if (DESIGN_SOURCE_INTERNALS.test(path)) continue;
    const source = files[path];
    if (typeof source !== 'string') {
      omitted.push({ path, reason: 'missing' });
      continue;
    }
    // Match the Composer's per-file schema. Never send partially cut source.
    if (source.length <= 60_000) {
      selected[path] = source;
      // Composer JSON is itself carried inside a JSON message string.
      if (encoder.encode(JSON.stringify(JSON.stringify(selected))).byteLength > maxBytes) {
        delete selected[path];
        omitted.push({ path, reason: 'transport-budget' });
      }
    } else omitted.push({ path, reason: 'per-file-limit' });
    // Scoped edits follow only the targets' direct imports (interface contracts).
    if (scope.scoped && !targetSet.has(path)) continue;
    for (const match of source.matchAll(/(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      const resolved = resolveLocalImport(path, specifier, files);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
      if (resolved === undefined && /^(\.|@\/|\/)/.test(specifier)) unresolvedImports.push({ path, specifier });
    }
  }
  return {
    files: selected, omitted, unresolvedImports,
    encodedBytes: encoder.encode(JSON.stringify(JSON.stringify(selected))).byteLength,
    completeTargets: targets.every(path => Object.prototype.hasOwnProperty.call(selected, path)),
  };
}
