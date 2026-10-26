/**
 * AICandidateChangeSet — AI Composer milestone, Phase 2 (doc §9–§10).
 *
 * An ephemeral, in-memory transaction layer — NOT a second VFS.
 *
 *   lastKnownGoodFiles + candidate fileOps = candidateFiles
 *
 * Nothing here writes to the working VFS, emits preview events, or persists.
 * The candidate is disposable until validation passes; only then may the
 * caller hand `candidateFiles` to the single legal writer (vfsCommitService
 * via aiApplyGate / builderMutationService).
 */

import {
  canonicalizeAIFilePaths,
  generatePackageJson,
  repairAiJsxTypos,
  validateAIFileEdits,
} from '@/services/aiVFSOrchestrator';
import { resolveSiteDependencyRuntime } from '@/utils/dependencyExtractor';
import { isSandpackAllowedImport } from '@/utils/sandpackDependencies';
import type { TopologyChange } from '@/services/pageTopologyOrchestrator';
import type { CanonicalAuthorshipEvidence } from './canonicalAuthoringRequest';
import type { PatchPlan } from '@/types/patchPlan';

/** Canonical non-file proposals travel with the candidate, never execute here. */
export interface CandidateOperationInput {
  playgroundOps?: readonly PatchPlan['playgroundOps'][number][];
  bindingOps?: readonly PatchPlan['bindingOps'][number][];
  dataOps?: readonly PatchPlan['dataOps'][number][];
  backendOps?: readonly PatchPlan['backendOps'][number][];
  presentationOps?: readonly PatchPlan['presentationOps'][number][];
  businessSystem?: PatchPlan['businessSystem'];
}

export type CandidateFileOp =
  | { type: 'create'; path: string; content: string }
  | { type: 'replace'; path: string; content: string }
  | { type: 'delete'; path: string };

export interface AICandidateChangeSet extends CandidateOperationInput {
  id: string;
  baseRevisionId?: string;
  provenance: {
    origin: 'builder' | 'wizard' | 'repair';
    intent?: string;
    knowledgeVersion: string;
    evidence?: CanonicalAuthorshipEvidence;
  };
  fileOps: CandidateFileOp[];
  routeOps: TopologyChange[];
  requestedDependencies?: string[];
  dependencyGraphFingerprint?: string;
  targetPages: string[];
  attempt: number;
  /** Content fingerprint (fnv1a, null = absent) of each touched path in the base; lets the coordinator rebase safely. */
  baseFingerprints?: Record<string, string | null>;
}

export interface BuildCandidateInput extends CandidateOperationInput {
  /** Raw AI file map (path → full contents). */
  aiFiles: Record<string, string>;
  /** Paths the AI asked to delete. */
  deletions?: string[];
  /** Last committed (known-good) VFS. Never mutated. */
  baseFiles: Readonly<Record<string, string>>;
  baseRevisionId?: string;
  targetPages?: string[];
  attempt?: number;
  origin?: AICandidateChangeSet['provenance']['origin'];
  intent?: string;
  routeOps?: readonly TopologyChange[];
  evidence?: CanonicalAuthorshipEvidence;
  /** Resolve deps and regenerate package.json in the candidate (default true). */
  resolveDependencies?: boolean;
}

export interface CandidateBuildResult {
  changeSet: AICandidateChangeSet;
  /** base + fileOps, in memory. Not user-visible. */
  candidateFiles: Record<string, string>;
  /** Edits refused before validation (protected paths, slot violations). */
  refused: Array<{ path: string; reason: string }>;
}

export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

const SPECIFIER_PATTERN = /(\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"./][^'"]*)\2/g;

/**
 * Deterministically repair package names the model mis-spells with
 * underscores (e.g. "react_router_dom" → "react-router-dom") when only the
 * hyphenated form is an allowed preview package. Unknown names are left
 * untouched so the runtime preflight still reports them.
 */
export function repairPackageSpecifierTypos(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    out[path] = /\.(t|j)sx?$/.test(path)
      ? content.replace(SPECIFIER_PATTERN, (whole, lead: string, quote: string, spec: string) => {
          if (!spec.includes('_') || isSandpackAllowedImport(spec)) return whole;
          const fixed = spec.replace(/_/g, '-');
          return isSandpackAllowedImport(fixed) ? `${lead}${quote}${fixed}${quote}` : whole;
        })
      : content;
  }
  return out;
}

/** Normalize AI output into a transactional change set (no side effects). */
export function buildAICandidateChangeSet(input: BuildCandidateInput): CandidateBuildResult {
  const base = input.baseFiles;
  const canonical = canonicalizeAIFilePaths(input.aiFiles, base as Record<string, string>);
  const { appliable, skipped } = validateAIFileEdits(canonical, base as Record<string, string>);
  const repaired = repairPackageSpecifierTypos(repairAiJsxTypos(appliable));

  const fileOps: CandidateFileOp[] = [];
  for (const path of Object.keys(repaired).sort()) {
    const content = repaired[path];
    if (base[path] === content) continue;
    fileOps.push({ type: path in base ? 'replace' : 'create', path, content });
  }
  const refused = [...skipped];
  for (const raw of [...(input.deletions ?? [])].sort()) {
    const [path] = Object.keys(canonicalizeAIFilePaths({ [raw]: '' }, base as Record<string, string>));
    if (!(path in base)) continue;
    const guard = validateAIFileEdits({ [path]: '' }, {});
    if (guard.skipped.length) { refused.push(...guard.skipped); continue; }
    fileOps.push({ type: 'delete', path });
  }

  const candidateFiles = applyCandidateFileOps(base, fileOps);
  let requestedDependencies: string[] | undefined;
  let dependencyGraphFingerprint: string | undefined;
  if (input.resolveDependencies !== false && fileOps.length) {
    const resolvedRuntime = resolveSiteDependencyRuntime(candidateFiles);
    const { dependencies } = resolvedRuntime;
    const pkg = generatePackageJson(dependencies, candidateFiles);
    const prev = JSON.parse(base['/package.json'] || '{"dependencies":{}}').dependencies ?? {};
    requestedDependencies = Object.keys(JSON.parse(pkg).dependencies).filter((d) => !(d in prev)).sort();
    if (pkg !== base['/package.json']) {
      fileOps.push({ type: base['/package.json'] ? 'replace' : 'create', path: '/package.json', content: pkg });
      candidateFiles['/package.json'] = pkg;
    }
    dependencyGraphFingerprint = resolveSiteDependencyRuntime(candidateFiles).graphFingerprint;
  }

  const attempt = input.attempt ?? 1;
  const routeOps = (input.routeOps ?? []).map((op) => ({ ...op }));
  // Detach nested payloads from mutable caller state before validation/review.
  const operations = structuredClone({
    playgroundOps: [...(input.playgroundOps ?? [])],
    bindingOps: [...(input.bindingOps ?? [])],
    dataOps: [...(input.dataOps ?? [])],
    backendOps: [...(input.backendOps ?? [])],
    presentationOps: [...(input.presentationOps ?? [])],
    businessSystem: input.businessSystem,
  });
  const id = `cand_${fnv1a(`${input.baseRevisionId ?? ''}|${attempt}|${JSON.stringify({ fileOps, routeOps, ...operations, evidence: input.evidence })}`)}`;
  return {
    changeSet: {
      id,
      baseRevisionId: input.baseRevisionId,
      provenance: {
        origin: input.origin ?? 'builder',
        intent: input.intent?.slice(0, 240),
        // Kept in the durable patch record without storing prompt text.
        knowledgeVersion: '2026-09-29.2',
        evidence: input.evidence ? { ...input.evidence } : undefined,
      },
      fileOps,
      routeOps,
      ...operations,
      requestedDependencies,
      dependencyGraphFingerprint,
      targetPages: [...(input.targetPages ?? [])].sort(),
      attempt,
      baseFingerprints: Object.fromEntries(fileOps.map((op) => [
        op.path,
        input.baseFiles[op.path] === undefined ? null : fnv1a(input.baseFiles[op.path]),
      ])),
    },
    candidateFiles,
    refused,
  };
}

/** Pure: apply file ops to a copy of the base. The base is never mutated. */
export function applyCandidateFileOps(
  base: Readonly<Record<string, string>>,
  ops: readonly CandidateFileOp[],
): Record<string, string> {
  const next: Record<string, string> = { ...base };
  for (const op of ops) {
    if (op.type === 'delete') delete next[op.path];
    else next[op.path] = op.content;
  }
  return next;
}
