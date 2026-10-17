import type { AICandidateChangeSet } from './aiCandidateChangeSet';

/** Read-only projection of prepared operations, never model prose. */
export function canonicalCandidateOutput(candidate: AICandidateChangeSet): {
  files: Record<string, string>;
  deletions: string[];
} {
  const files: Record<string, string> = {};
  const deletions: string[] = [];
  for (const operation of candidate.fileOps) {
    if (operation.type === 'delete') deletions.push(operation.path);
    else files[operation.path] = operation.content;
  }
  return { files, deletions };
}