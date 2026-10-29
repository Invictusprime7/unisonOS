import type {
  StrictImportContractWorkerRequest,
  StrictImportContractWorkerResponse,
} from '@/services/strictImportContractRuntime';
import { isPreviewPipelineError } from '@/services/previewPipelineError';

interface StrictImportContractWorkerScope {
  onmessage: ((event: MessageEvent<StrictImportContractWorkerRequest>) => void) | null;
  postMessage(message: StrictImportContractWorkerResponse): void;
}

const workerScope = self as unknown as StrictImportContractWorkerScope;

// See wizardStage4b.worker.ts: React Refresh is browser-only in development,
// while this compiler runs in a Worker. Delay the compiler import until the
// refresh runtime has evaluated against a temporary `window` alias.
const workerGlobal = globalThis as unknown as { window?: unknown };
const hadWindow = Object.prototype.hasOwnProperty.call(workerGlobal, 'window');
const previousWindow = workerGlobal.window;
if (!hadWindow) workerGlobal.window = workerGlobal;
const sandpackModule = import('@/utils/sandpackFilePrep').finally(() => {
  if (hadWindow) workerGlobal.window = previousWindow;
  else delete workerGlobal.window;
});

workerScope.onmessage = async (event) => {
  const request = event.data;
  const progress = (phase: string, path?: string) => workerScope.postMessage({
    requestId: request.requestId, progress: { phase, path },
  });
  try {
    progress('loading compiler');
    const { prepareSandpackFiles } = await sandpackModule;
    // Always computed in strict mode: strict only changes behavior when the
    // VFS has no App.tsx, which canonical wizard sites always have — so the
    // result here is valid for both strict and non-strict callers, letting
    // the launcher's check and Preview's compile share one worker + cache.
    const files = prepareSandpackFiles(request.files, {
      entryPoint: request.entryPoint,
      themePresetId: request.themePresetId,
      sourceRevisionId: request.sourceRevisionId,
      strict: true,
      onProgress: progress,
    });
    workerScope.postMessage({ requestId: request.requestId, ok: true, files });
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    workerScope.postMessage({
      requestId: request.requestId,
      ok: false,
      error: {
        name: normalized.name,
        message: normalized.message,
        stack: normalized.stack,
        ...(isPreviewPipelineError(error) ? {
          stage: error.stage, summary: error.summary, blockedFiles: error.details.blockedFiles,
        } : {}),
      },
    });
  }
};
