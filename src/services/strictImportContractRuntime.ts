/**
 * The launcher's strict pre-persist JSX-import-contract check and the Web
 * Builder's Preview-mount compile both ultimately call
 * prepareSandpackFiles(), which has no internal yield points. For
 * pathological/AI-drifted or simply large multi-page sites this can run
 * long enough to hard-freeze the tab — a stage timeout can't preempt a
 * single unbroken synchronous call, and the browser can't repaint or
 * process input until it returns. Running it in a Worker keeps the same
 * coverage/output without risking the main thread, mirroring
 * wizardStage4bRuntime's worker-with-fallback pattern. A small main-thread
 * cache (keyed like prepareSandpackFiles' own internal one) lets the second
 * caller in the same launch — Preview mounting moments after the launcher's
 * own check — reuse the first caller's result instead of recomputing.
 */
import { prepareSandpackFiles } from '@/utils/sandpackFilePrep';
import { PreviewPipelineError, type PreviewPipelineStage } from '@/services/previewPipelineError';

export interface StrictImportContractWorkerRequest {
  requestId: string;
  files: Record<string, string>;
  entryPoint?: string;
  themePresetId?: string | null;
  sourceRevisionId?: string | null;
}

export type StrictImportContractWorkerResponse =
  | { requestId: string; progress: { phase: string; path?: string } }
  | { requestId: string; ok: true; files: Record<string, string> }
  | {
      requestId: string;
      ok: false;
      error: { name: string; message: string; stack?: string; stage?: PreviewPipelineStage; summary?: string; blockedFiles?: string[] };
    };

interface StrictImportContractWorkerLike {
  onmessage: ((event: MessageEvent<StrictImportContractWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: StrictImportContractWorkerRequest): void;
  terminate(): void;
}

export interface RunStrictImportContractCheckOptions {
  files: Record<string, string>;
  entryPoint?: string;
  themePresetId?: string | null;
  signal?: AbortSignal;
  workerFactory?: () => StrictImportContractWorkerLike;
  fallbackCheck?: (
    files: Record<string, string>,
    entryPoint?: string,
    themePresetId?: string | null,
  ) => void;
}

export interface RunPrepareSandpackFilesOffThreadOptions {
  files: Record<string, string>;
  entryPoint?: string;
  themePresetId?: string | null;
  sourceRevisionId?: string | null;
  signal?: AbortSignal;
  workerFactory?: () => StrictImportContractWorkerLike;
  fallbackCompute?: (
    files: Record<string, string>,
    entryPoint?: string,
    themePresetId?: string | null,
    sourceRevisionId?: string | null,
  ) => Record<string, string>;
  /** A side-effect-only validation fallback has no compiled artifact to cache. */
  cacheFallbackResult?: boolean;
}

class StrictImportContractWorkerBootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StrictImportContractWorkerBootstrapError';
  }
}

function defaultWorkerFactory(): StrictImportContractWorkerLike {
  if (typeof Worker === 'undefined') {
    throw new StrictImportContractWorkerBootstrapError('Module workers are unavailable in this runtime.');
  }
  try {
    return new Worker(new URL('../workers/strictImportContract.worker.ts', import.meta.url), {
      type: 'module',
      name: 'unison-strict-import-contract',
    });
  } catch (error) {
    throw new StrictImportContractWorkerBootstrapError(
      error instanceof Error ? error.message : 'The strict import-contract worker could not start.',
    );
  }
}

function toAbortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;
  return new Error('Strict import-contract check was cancelled.');
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `strict_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─────────────────────────────────────────────────── cross-call result cache
//
// prepareSandpackFiles() has its own content-hash cache, but that only helps
// callers on the SAME thread — offloading one caller to a Worker (a separate
// JS realm) means the launcher's check and the Web Builder's Preview-mount
// compile can no longer warm each other's cache. Re-implement the same
// hashing scheme here, at the call boundary shared by every caller of this
// module, so that benefit survives regardless of which side (worker or
// main-thread fallback) actually computed a given result.
const PREPARED_FILES_CACHE_LIMIT = 20;
// A healthy module worker emits `loading compiler` before importing the large
// preview compiler. If it cannot do that, it is blocked by the host/CSP or a
// stale deploy asset; waiting for the full source-compilation budget cannot
// recover it.
const STRICT_IMPORT_WORKER_STARTUP_TIMEOUT_MS = 10_000;
const STRICT_IMPORT_WORKER_MIN_TIMEOUT_MS = 60_000;
const STRICT_IMPORT_WORKER_MAX_TIMEOUT_MS = 180_000;
const preparedFilesCache = new Map<string, Record<string, string>>();
interface PreparedFilesJob {
  promise: Promise<Record<string, string>>;
  controller: AbortController;
  subscribers: number;
  checkpoint: string;
}
const preparedFilesInFlight = new Map<string, PreparedFilesJob>();

/**
 * The import-contract pass scales with both module count and source size.
 * A fixed 30s watchdog killed large generated projects on cold workers. Give larger artifacts
 * a proportional budget while retaining a bounded watchdog for dead workers.
 */
function workerTimeoutFor(files: Record<string, string>): number {
  const paths = Object.keys(files);
  const sourceCharacters = paths.reduce((total, path) => total + (files[path]?.length ?? 0), 0);
  const estimatedMs = 45_000 + paths.length * 500 + sourceCharacters * 0.05;
  return Math.min(
    STRICT_IMPORT_WORKER_MAX_TIMEOUT_MS,
    Math.max(STRICT_IMPORT_WORKER_MIN_TIMEOUT_MS, Math.ceil(estimatedMs)),
  );
}

function hashFilesRecord(files: Record<string, string>): string {
  let h = 0x811c9dc5;
  for (const path of Object.keys(files).sort()) {
    const entry = `${path}\u0000${files[path]}\u0000`;
    for (let i = 0; i < entry.length; i++) {
      h ^= entry.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return (h >>> 0).toString(36);
}

function cacheKeyFor(files: Record<string, string>, entryPoint: string | undefined, themePresetId: string | null | undefined, sourceRevisionId: string | null | undefined): string {
  return `${hashFilesRecord(files)}::${entryPoint || ''}::${themePresetId || ''}::${sourceRevisionId || ''}`;
}

function storeInCache(key: string, files: Record<string, string>): void {
  if (preparedFilesCache.size >= PREPARED_FILES_CACHE_LIMIT) preparedFilesCache.clear();
  preparedFilesCache.set(key, files);
}

function awaitWithSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(toAbortError(signal));
  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => reject(toAbortError(signal));
    signal.addEventListener('abort', handleAbort, { once: true });
    void promise.then(
      (value) => {
        signal.removeEventListener('abort', handleAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', handleAbort);
        reject(error);
      },
    );
  });
}

function runInWorker(
  worker: StrictImportContractWorkerLike,
  request: StrictImportContractWorkerRequest,
  signal?: AbortSignal,
  onProgress?: (checkpoint: string) => void,
): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let lastProgress = { phase: 'starting worker', path: undefined as string | undefined };
    const startedAt = Date.now();
    const location = () => `${lastProgress.phase}${lastProgress.path ? ` (${lastProgress.path})` : ''}`;
    const responseTimeoutMs = workerTimeoutFor(request.files);
    const responseTimeout = setTimeout(() => {
      settle(() => reject(new Error(
        `Preview compiler timed out after ${Math.round(responseTimeoutMs / 1000)} seconds while ${location()}.`,
      )));
    }, responseTimeoutMs);
    const startupTimeout = setTimeout(() => {
      if (lastProgress.phase !== 'starting worker') return;
      settle(() => reject(new StrictImportContractWorkerBootstrapError(
        `Preview compiler worker did not start within ${Math.round(STRICT_IMPORT_WORKER_STARTUP_TIMEOUT_MS / 1000)} seconds.`,
      )));
    }, STRICT_IMPORT_WORKER_STARTUP_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(responseTimeout);
      clearTimeout(startupTimeout);
      worker.onmessage = null;
      worker.onerror = null;
      signal?.removeEventListener('abort', handleAbort);
      worker.terminate();
    };
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const handleAbort = () => {
      if (!signal) return;
      const error = toAbortError(signal);
      settle(() => reject(/timed out/i.test(error.message)
        ? new Error(`${error.message} Last compiler checkpoint: ${location()}.`)
        : error));
    };

    worker.onmessage = (event) => {
      const response = event.data;
      if (!response || response.requestId !== request.requestId) return;
      if ('progress' in response) {
        lastProgress = { phase: response.progress.phase, path: response.progress.path };
        onProgress?.(location());
        return;
      }
      if (response.ok) {
        console.info('[previewCompiler] completed', { elapsedMs: Date.now() - startedAt, inputFiles: Object.keys(request.files).length });
        settle(() => resolve(response.files));
        return;
      }
      if (!('error' in response)) {
        settle(() => reject(new Error('Strict import-contract worker returned an invalid response.')));
        return;
      }
      const error = response.error.stage && response.error.summary
        ? new PreviewPipelineError(response.error.stage, response.error.summary, { blockedFiles: response.error.blockedFiles })
        : new Error(response.error.message);
      error.name = response.error.name;
      if (response.error.stack) error.stack = response.error.stack;
      settle(() => reject(error));
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      settle(() => reject(new StrictImportContractWorkerBootstrapError(
        event.message || 'The strict import-contract worker could not start.',
      )));
    };

    if (signal?.aborted) {
      handleAbort();
      return;
    }
    signal?.addEventListener('abort', handleAbort, { once: true });

    try {
      worker.postMessage(request);
    } catch (error) {
      settle(() => reject(new StrictImportContractWorkerBootstrapError(
        error instanceof Error ? error.message : 'The strict import-contract request could not be sent.',
      )));
    }
  });
}

/**
 * Runs prepareSandpackFiles(strict:true) off the main thread purely for its
 * throw-on-violation side effect, discarding the computed files. Falls back
 * to running on the main thread only if the worker itself fails to
 * bootstrap (e.g. a restrictive CSP) — never silently skips the check.
 */
export async function runStrictImportContractCheck({
  files,
  entryPoint,
  themePresetId,
  signal,
  workerFactory,
  fallbackCheck,
}: RunStrictImportContractCheckOptions): Promise<void> {
  await runPrepareSandpackFilesOffThread({
    files,
    entryPoint,
    themePresetId,
    signal,
    workerFactory,
    cacheFallbackResult: !fallbackCheck,
    fallbackCompute: (fallbackFiles, fallbackEntryPoint, fallbackThemePresetId) => {
      if (fallbackCheck) {
        fallbackCheck(fallbackFiles, fallbackEntryPoint, fallbackThemePresetId);
        return fallbackFiles;
      }
      return prepareSandpackFiles(fallbackFiles, {
        entryPoint: fallbackEntryPoint, themePresetId: fallbackThemePresetId, strict: true,
      });
    },
  });
}

/**
 * Runs the full prepareSandpackFiles() compile off the main thread and
 * returns the resulting Sandpack-ready files — for callers (Preview mount)
 * that need the actual output, not just the validation side effect. Shares
 * a cache with runStrictImportContractCheck so a Preview compile moments
 * after the launcher's own check is typically instant.
 */
export async function runPrepareSandpackFilesOffThread({
  files,
  entryPoint,
  themePresetId,
  sourceRevisionId,
  signal,
  workerFactory = defaultWorkerFactory,
  cacheFallbackResult = true,
  fallbackCompute = (fallbackFiles, fallbackEntryPoint, fallbackThemePresetId) => prepareSandpackFiles(fallbackFiles, {
    entryPoint: fallbackEntryPoint,
    themePresetId: fallbackThemePresetId,
  }),
}: RunPrepareSandpackFilesOffThreadOptions): Promise<Record<string, string>> {
  if (signal?.aborted) throw toAbortError(signal);
  const cacheKey = cacheKeyFor(files, entryPoint, themePresetId, sourceRevisionId);
  const cached = preparedFilesCache.get(cacheKey);
  if (cached) return { ...cached };
  let job = preparedFilesInFlight.get(cacheKey);
  if (!job) {
    const controller = new AbortController();
    job = { controller, subscribers: 0, checkpoint: 'starting worker', promise: undefined! };
    const currentJob = job;
    currentJob.promise = (async () => {
      try {
        const worker = workerFactory();
        // The job owns its signal. Individual callers may detach without
        // cancelling another preview that still needs the same artifact.
        const result = await runInWorker(worker, {
          requestId: createRequestId(),
          files,
          entryPoint,
          themePresetId,
          sourceRevisionId,
        }, controller.signal, (checkpoint) => { currentJob.checkpoint = checkpoint; });
        storeInCache(cacheKey, result);
        return result;
      } catch (error) {
        if (controller.signal.aborted) throw error;
        if (!(error instanceof StrictImportContractWorkerBootstrapError)) throw error;
        console.warn('[strictImportContractRuntime] worker unavailable; using compatibility fallback', {
          error: error.message,
        });
      }

      const result = fallbackCompute(files, entryPoint, themePresetId, sourceRevisionId);
      if (cacheFallbackResult) storeInCache(cacheKey, result);
      return result;
    })().finally(() => {
      if (preparedFilesInFlight.get(cacheKey) === currentJob) preparedFilesInFlight.delete(cacheKey);
    });
    preparedFilesInFlight.set(cacheKey, currentJob);
  }
  job.subscribers += 1;
  try {
    return { ...await awaitWithSignal(job.promise, signal) };
  } catch (error) {
    if (signal?.aborted && error instanceof Error && /timed out/i.test(error.message)) {
      throw new Error(`${error.message} Last compiler checkpoint: ${job.checkpoint}.`);
    }
    throw error;
  } finally {
    job.subscribers -= 1;
    if (job.subscribers === 0 && preparedFilesInFlight.get(cacheKey) === job) {
      // Evict before aborting so an immediate Retry starts a fresh worker.
      preparedFilesInFlight.delete(cacheKey);
      job.controller.abort(signal?.reason ?? new Error('Preview compile has no remaining subscribers.'));
    }
  }
}

