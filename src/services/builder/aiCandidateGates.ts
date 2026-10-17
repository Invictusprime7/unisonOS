/**
 * AI Composer milestone, Phase 3 — blocking candidate gates.
 *
 * Runs against the in-memory candidate (Phase 2) BEFORE the canonical commit.
 * Any failure blocks: the working VFS and preview are never touched.
 *
 *   parse         — every created/replaced TS/TSX file must parse cleanly
 *   import-graph  — local imports (relative and "@/") in touched files resolve
 *                   inside the candidate; no surviving file imports a deleted one
 *
 * Adds no writer. Callers hand the accepted candidate to runBuilderAiMutation
 * (commitMutation remains the single durable writer).
 */

import { buildAICandidateChangeSet, type CandidateBuildResult, type CandidateOperationInput } from './aiCandidateChangeSet';
import { repairAuthoredImages } from './authoredImageRepair';
import { auditSiteAffinity, type HomepageVisualLanguage } from '@/services/launch/homepageFirstContract';
import { assertBackendOps } from '@/types/backendOperations';
import { invalidArbitraryClasses } from './arbitraryClassValidation';

export interface CandidateGateFailure {
  gate: 'parse' | 'import-graph' | 'empty' | 'affinity' | 'design-source' | 'backend-proposal' | 'css-value';
  path: string;
  message: string;
}

export interface CandidateGateResult {
  passed: boolean;
  failures: CandidateGateFailure[];
  /** Quality guidance that never changes `passed`. */
  advisories: string[];
}

/** Optional per-file check run on touched page sources; returns diagnostics. */
export type PageCheck = (path: string, source: string, files?: Readonly<Record<string, string>>) => string[];

const CODE_RE = /\.(tsx?|jsx?)$/;
const EXTENSIONS = ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
const IMPORT_RE = /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i <= 0 ? '' : path.slice(0, i);
}

function normalize(path: string): string {
  const out: string[] = [];
  for (const seg of path.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return '/' + out.join('/');
}

/** Resolve a local specifier to a candidate path; null = not local, undefined = unresolved. */
export function resolveLocalImport(
  fromPath: string,
  spec: string,
  files: Readonly<Record<string, string>>,
): string | null | undefined {
  let target: string;
  if (spec.startsWith('@/')) target = '/src/' + spec.slice(2);
  else if (spec.startsWith('.')) target = `${dirname(fromPath)}/${spec}`;
  else return null;
  const base = normalize(target);
  for (const ext of EXTENSIONS) if (base + ext in files) return base + ext;
  return undefined;
}

function localImports(content: string): string[] {
  const specs: string[] = [];
  for (const m of content.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (spec) specs.push(spec);
  }
  return specs;
}

async function parseFailures(paths: string[], files: Record<string, string>): Promise<CandidateGateFailure[]> {
  const targets = paths.filter((p) => /\.(tsx?|jsx?)$/.test(p));
  if (!targets.length) return [];
  const ts = (await import('typescript')).default;
  const failures: CandidateGateFailure[] = [];
  for (const path of targets) {
    const out = ts.transpileModule(files[path], {
      fileName: path,
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
    });
    const first = out.diagnostics?.[0];
    if (first) {
      failures.push({ gate: 'parse', path, message: ts.flattenDiagnosticMessageText(first.messageText, '\n') });
    }
  }
  return failures;
}

/** Run every blocking gate against a built candidate. Pure except for lazy parser load. */
export async function runCandidateGates(build: CandidateBuildResult, affinity?: {
  language?: HomepageVisualLanguage;
  forbiddenImplementations?: Readonly<Record<string, readonly string[] | undefined>>;
}, pageCheck?: PageCheck): Promise<CandidateGateResult> {
  const files = build.candidateFiles;
  const touched = build.changeSet.fileOps.filter((o) => o.type !== 'delete').map((o) => o.path);
  const deleted = new Set(build.changeSet.fileOps.filter((o) => o.type === 'delete').map((o) => o.path));
  const failures: CandidateGateFailure[] = [];
  const advisories: string[] = [];
  try { assertBackendOps(build.changeSet.backendOps ?? [], 'candidate'); }
  catch (error) {
    failures.push({ gate: 'backend-proposal', path: 'backendOps', message: error instanceof Error ? error.message : String(error) });
  }

  for (const path of touched) {
    if (CODE_RE.test(path) && !files[path].trim()) {
      failures.push({ gate: 'empty', path, message: 'File would be empty.' });
    }
  }
  failures.push(...(await parseFailures(touched, files)));
  for (const path of touched.filter(p => CODE_RE.test(p))) {
    if (failures.some(failure => failure.path === path && failure.gate === 'parse')) continue;
    try {
      failures.push(...invalidArbitraryClasses(files[path]).map(message => ({ gate: 'css-value' as const, path, message })));
    } catch { /* Parse gate owns invalid source diagnostics. */ }
  }

  for (const path of touched.filter((p) => CODE_RE.test(p))) {
    for (const spec of localImports(files[path])) {
      if (resolveLocalImport(path, spec, files) === undefined) {
        failures.push({ gate: 'import-graph', path, message: `Import "${spec}" does not resolve.` });
      }
    }
  }
  if (deleted.size) {
    const baseLike = { ...files, ...Object.fromEntries([...deleted].map((p) => [p, ''])) };
    for (const [path, content] of Object.entries(files)) {
      if (!CODE_RE.test(path)) continue;
      for (const spec of localImports(content)) {
        const hit = resolveLocalImport(path, spec, baseLike);
        if (hit && deleted.has(hit)) {
          failures.push({ gate: 'import-graph', path, message: `Imports deleted file ${hit}.` });
        }
      }
    }
  }
  if (affinity) {
    for (const path of touched.filter((p) => /\/src\/pages\/.+\.(?:tsx|jsx)$/.test(p))) {
      const audit = auditSiteAffinity({ path, content: files[path], ...affinity });
      failures.push(...audit.violations.map(message => ({ gate: 'affinity' as const, path, message })));
      advisories.push(...audit.advisories);
    }
  }
  if (pageCheck) {
    for (const path of touched.filter((p) => /\/src\/pages\/.+\.(?:tsx|jsx)$/.test(p))) {
      failures.push(...pageCheck(path, files[path], files).map((message) => ({ gate: 'design-source' as const, path, message })));
    }
  }
  return { passed: failures.length === 0, failures, advisories };
}

export interface PreparedCandidate {
  ok: boolean;
  build: CandidateBuildResult;
  gates: CandidateGateResult;
  /** Full file map to hand to the canonical commit (only meaningful when ok). */
  nextFiles: Record<string, string>;
  errors: string[];
}

/**
 * The live AI apply entry: raw AI files → candidate → preflight on changed
 * files → blocking gates. Nothing is written here.
 */
export async function prepareAICandidate(input: CandidateOperationInput & {
  aiFiles: Record<string, string>;
  deletions?: string[];
  baseFiles: Record<string, string>;
  baseRevisionId?: string;
  targetPages?: string[];
  origin?: import('./aiCandidateChangeSet').AICandidateChangeSet['provenance']['origin'];
  intent?: string;
  routeOps?: readonly import('@/services/pageTopologyOrchestrator').TopologyChange[];
  evidence?: import('./canonicalAuthoringRequest').CanonicalAuthorshipEvidence;
  attempt?: number;
  resolveDependencies?: boolean;
  pageCheck?: PageCheck;
  preflight?: (changed: Record<string, string>) => Record<string, string>;
  affinity?: {
    language?: HomepageVisualLanguage;
    forbiddenImplementations?: Readonly<Record<string, readonly string[] | undefined>>;
  };
}): Promise<PreparedCandidate> {
  // Dead placeholder image hosts never reach a committed revision.
  input = { ...input, aiFiles: repairAuthoredImages(input.aiFiles, input.baseFiles) };
  let build = buildAICandidateChangeSet({
    aiFiles: input.aiFiles,
    deletions: input.deletions,
    baseFiles: input.baseFiles,
    baseRevisionId: input.baseRevisionId,
    targetPages: input.targetPages,
    origin: input.origin,
    intent: input.intent,
    routeOps: input.routeOps,
    playgroundOps: input.playgroundOps,
    bindingOps: input.bindingOps,
    dataOps: input.dataOps,
    backendOps: input.backendOps,
    presentationOps: input.presentationOps,
    businessSystem: input.businessSystem,
    evidence: input.evidence,
    attempt: input.attempt,
    resolveDependencies: input.resolveDependencies,
  });
  if (input.preflight && build.changeSet.fileOps.length) {
    const changed = Object.fromEntries(
      build.changeSet.fileOps.filter((o) => o.type !== 'delete').map((o) => [o.path, (o as { content: string }).content]),
    );
    const repaired = input.preflight(changed);
    const repairedFiles = repairAuthoredImages({ ...input.aiFiles, ...repaired }, input.baseFiles);
    // Rebuild so ops/id reflect the repaired bytes.
    build = buildAICandidateChangeSet({
      aiFiles: repairedFiles,
      deletions: input.deletions,
      baseFiles: input.baseFiles,
      baseRevisionId: input.baseRevisionId,
      targetPages: input.targetPages,
      origin: input.origin,
      intent: input.intent,
      routeOps: input.routeOps,
      playgroundOps: input.playgroundOps,
      bindingOps: input.bindingOps,
      dataOps: input.dataOps,
      backendOps: input.backendOps,
      presentationOps: input.presentationOps,
      businessSystem: input.businessSystem,
      evidence: input.evidence,
      attempt: input.attempt,
      resolveDependencies: input.resolveDependencies,
    });
  }
  const gates = await runCandidateGates(build, input.affinity, input.pageCheck);
  const candidate = build.changeSet;
  const hasChanges = candidate.fileOps.length > 0 || candidate.routeOps.length > 0
    || !!candidate.playgroundOps?.length || !!candidate.bindingOps?.length
    || !!candidate.dataOps?.length
    || !!candidate.backendOps?.length || !!candidate.presentationOps?.length
    || !!candidate.businessSystem;
  const errors = [
    ...gates.failures.map((f) => `${f.path}: ${f.message}`),
    ...(hasChanges ? [] : ['The AI response did not change any files.']),
  ];
  return { ok: gates.passed && hasChanges, build, gates, nextFiles: build.candidateFiles, errors };
}
