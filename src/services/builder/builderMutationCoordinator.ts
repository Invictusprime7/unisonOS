/**
 * BuilderMutationCoordinator — serialises every Builder save surface (AI chat,
 * toolbar AI, terminal, command menu, autosave, catalog) so only one canonical
 * commit runs at a time, and rebases AI candidates whose base revision moved
 * only because of non-overlapping saves. It never writes: callers still commit
 * through runBuilderAiMutation → commitMutation, and aiApplyGate keeps its
 * strict stale-revision check.
 */
import { fnv1a, type AICandidateChangeSet } from '@/services/builder/aiCandidateChangeSet';
import { newEditorCorrelationId, recordMutationEvent } from '@/services/editor/editorTelemetry';

export type MutationSurface = 'ai-builder' | 'toolbar-ai' | 'toolbar' | 'terminal' | 'command-menu' | 'autosave' | 'catalog';

let tail: Promise<unknown> = Promise.resolve();
let activeAiEdits = 0;
let lastCommit: { surface: MutationSurface; revisionId: string | null; at: number } | null = null;

/** Run `task` after every previously queued Builder mutation has settled. */
export function runExclusive<T>(surface: MutationSurface, task: () => Promise<T>): Promise<T> {
  const isAi = surface === 'ai-builder' || surface === 'toolbar-ai';
  if (isAi) activeAiEdits += 1;
  const run = tail.then(task, task);
  tail = run.catch(() => undefined).finally(() => { if (isAi) activeAiEdits -= 1; });
  return run;
}

/** Mark an AI generation as in progress (from request start, not just commit). */
export function setAiGenerationActive(active: boolean): void {
  activeAiEdits = Math.max(0, activeAiEdits + (active ? 1 : -1));
}

/** Autosave must skip while an AI edit is generating or committing. */
export function shouldPauseAutosave(): boolean {
  return activeAiEdits > 0;
}

export function recordCommit(surface: MutationSurface, revisionId: string | null): void {
  lastCommit = { surface, revisionId, at: Date.now() };
}

export function getLastCommit() {
  return lastCommit;
}

export type RebaseResult =
  | { ok: true; candidate: AICandidateChangeSet; rebased: boolean }
  | { ok: false; conflicts: string[] };

/**
 * Move a candidate onto `currentRevisionId` when none of the files it touches
 * changed since the candidate's base (compared by content fingerprint).
 * Candidates without fingerprints can never be rebased.
 */
export function rebaseCandidate(
  candidate: AICandidateChangeSet,
  currentFiles: Readonly<Record<string, string>>,
  currentRevisionId: string | null,
): RebaseResult {
  if ((candidate.baseRevisionId ?? null) === currentRevisionId) {
    return { ok: true, candidate, rebased: false };
  }
  const prints = candidate.baseFingerprints;
  if (!prints) return { ok: false, conflicts: candidate.fileOps.map((op) => op.path) };
  const conflicts = candidate.fileOps
    .map((op) => op.path)
    .filter((path) => {
      if (!(path in prints)) return true;
      const now = currentFiles[path];
      return (now === undefined ? null : fnv1a(now)) !== prints[path];
    });
  if (conflicts.length > 0) return { ok: false, conflicts };
  return {
    ok: true,
    rebased: true,
    candidate: { ...candidate, baseRevisionId: currentRevisionId ?? undefined },
  };
}

/** Plain-language explanation for a stale candidate. */
export function describeStaleCandidate(conflicts: string[] = []): string {
  const who = lastCommit
    ? `${lastCommit.surface === 'autosave' ? 'an autosave' : `a ${lastCommit.surface} save`} at ${new Date(lastCommit.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : 'another save';
  const files = conflicts.length ? ` It changed ${conflicts.slice(0, 3).join(', ')} too.` : '';
  return `Your site changed while the AI was working (${who}).${files} Please send the request again so it runs on the latest version.`;
}
