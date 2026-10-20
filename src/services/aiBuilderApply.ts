import type { TopologyChange } from '@/services/pageTopologyOrchestrator';
import type { AICandidateChangeSet } from '@/services/builder/aiCandidateChangeSet';

export interface AIBuilderApplyMeta {
  prompt?: string;
  model?: string;
  summary?: string;
  actionType?: string;
  origin?: string;
  /** Explicit file removals, executed by the same candidate + VFS transaction. */
  deletions?: string[];
  /** Typed registry/route intent; the canonical compiler owns App.tsx. */
  routeOps?: TopologyChange[];
  /** Exact Composer candidate, retained through the UI apply boundary. */
  candidate?: AICandidateChangeSet;
  requiresApproval?: boolean;
  warnings?: Array<{ severity?: string; message?: string }>;
}

export interface AIBuilderApplyOutcome {
  success: boolean;
  errors?: string[];
  /** P0.5: terminal transaction state. `success` is derived from `verified`. */
  status?: 'verified' | 'failed' | 'held-for-review';
  persistedRevisionId?: string | null;
  changedPaths?: string[];
  blockers?: string[];
  warnings?: string[];
}


export type AIBuilderApplyCallback = (
  files: Record<string, string>,
  meta?: AIBuilderApplyMeta,
) => AIBuilderApplyOutcome | Promise<AIBuilderApplyOutcome>;

/**
 * Await the Builder -> VFS boundary and normalize every exit into an explicit
 * outcome. The chat UI must not announce success before an async commit gate
 * and the actual VFS write have completed.
 */
export async function applyAIBuilderFiles(
  apply: AIBuilderApplyCallback,
  files: Record<string, string>,
  meta?: AIBuilderApplyMeta,
): Promise<AIBuilderApplyOutcome> {
  if (Object.keys(files).length === 0 && !meta?.deletions?.length && !meta?.candidate?.dataOps?.length) {
    return { success: false, errors: ['The AI response did not contain any valid files to apply.'] };
  }

  try {
    return await apply(files, meta);
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
