/**
 * PreviewPipelineError — single error type the preview pipeline raises when a
 * silent fallback would have masked a real failure. Caught at the React layer
 * (VFSPreview) and rendered via PreviewRuntimeError.
 *
 * Stages:
 *   - 'vfs'      → SiteBundleSnapshot / canonical VFS merge stage
 *   - 'prep'     → sandpackFilePrep transformations (prose-only, raw CSS, etc.)
 *   - 'sandpack' → launchToSandpack / previewArtifacts compile stage
 */
export type PreviewPipelineStage = 'vfs' | 'prep' | 'sandpack';

export interface PreviewPipelineErrorDetails {
  /** Files implicated in the failure (paths only). */
  blockedFiles?: string[];
  /** Parser diagnostics for generated files rejected by syntax preflight. */
  diagnostics?: Array<{
    path: string;
    error: string;
    repairPasses: string[];
  }>;
  /** Optional structured cause for debugging. */
  cause?: unknown;
  /** Whether the failure is recoverable by re-running the System Launcher. */
  recoverableByRelaunch?: boolean;
  /** Set when unsaved edits conflict with the accepted revision. */
  pendingConflict?: { scope: string | null; acceptedRevisionId: string | null };
}

export class PreviewPipelineError extends Error {
  readonly isPreviewPipelineError = true;
  readonly stage: PreviewPipelineStage;
  readonly summary: string;
  readonly details: PreviewPipelineErrorDetails;

  constructor(
    stage: PreviewPipelineStage,
    summary: string,
    details: PreviewPipelineErrorDetails = {},
  ) {
    super(`[${stage}] ${summary}`);
    this.name = 'PreviewPipelineError';
    this.stage = stage;
    this.summary = summary;
    this.details = details;
  }
}

export function isPreviewPipelineError(value: unknown): value is PreviewPipelineError {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { isPreviewPipelineError?: boolean }).isPreviewPipelineError === true
  );
}
