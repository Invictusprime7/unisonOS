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
/** How long one save may hold the queue before later saves are released. */
const STALL_BUDGET_MS: Record<MutationSurface, number> = {
  'ai-builder': 300_000, 'toolbar-ai': 300_000, toolbar: 90_000, terminal: 90_000,
  'command-menu': 90_000, autosave: 90_000, catalog: 60_000,
};
let activeAiEdits = 0;
let lastCommit: { surface: MutationSurface; revisionId: string | null; at: number } | null = null;

/** Run `task` after every previously queued Builder mutation has settled. */
export function runExclusive<T>(surface: MutationSurface, task: () => Promise<T>): Promise<T> {
  const isAi = surface === 'ai-builder' || surface === 'toolbar-ai';
  if (isAi) activeAiEdits += 1;
  // M0 telemetry: one event per serialized surface run (duration + outcome).
  const correlationId = newEditorCorrelationId();
  const startedAt = Date.now();
  const run = tail.then(task, task).then(
    (value) => {
      recordMutationEvent({ correlationId, at: Date.now(), kind: 'surface-run', surface, baseRevisionId: null, resultRevisionId: null, ok: true, durationMs: Date.now() - startedAt });
      return value;
    },
    (err) => {
      recordMutationEvent({ correlationId, at: Date.now(), kind: 'surface-run', surface, baseRevisionId: null, resultRevisionId: null, ok: false, error: err instanceof Error ? err.message : String(err), durationMs: Date.now() - startedAt });
      throw err;
    },
  );
  const settled = run.catch(() => undefined).finally(() => { if (isAi) activeAiEdits -= 1; });
  // A save that never settles must not block every later save (and with it
  // every checkpoint). After the stall budget the queue moves on; the slow
  // task keeps running and its own stale-revision checks still apply.
  const budget = STALL_BUDGET_MS[surface];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stalled = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[BuilderMutationCoordinator] ${surface} save still running after ${Math.round(budget / 1000)}s; letting later saves proceed`);
      recordMutationEvent({ correlationId, at: Date.now(), kind: 'surface-run', surface, baseRevisionId: null, resultRevisionId: null, ok: false, error: 'stalled', durationMs: Date.now() - startedAt });
      resolve();
    }, budget);
  });
  tail = Promise.race([settled, stalled]).finally(() => { if (timer) clearTimeout(timer); });
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
