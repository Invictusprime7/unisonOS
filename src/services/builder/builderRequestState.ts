/** Read-only request boundary over the host's canonical revision and live VFS. */
export interface BuilderRequestState {
  files: Record<string, string>;
  revisionId: string | null;
  projectId: string | null;
  businessId: string | null;
}

export function captureBuilderRequestState(state: BuilderRequestState): BuilderRequestState {
  return { ...state, files: { ...state.files } };
}

/** Never relabel old source/selection/catalog context with a newer revision. */
export function assertBuilderRequestState(base: BuilderRequestState, latest: BuilderRequestState): void {
  if (base.projectId !== latest.projectId || base.businessId !== latest.businessId) {
    throw new Error('The active project changed. Send this request again in the intended project.');
  }
  const paths = new Set([...Object.keys(base.files), ...Object.keys(latest.files)]);
  if (base.revisionId !== latest.revisionId || [...paths].some(path => base.files[path] !== latest.files[path])) {
    throw new Error('The site changed while this request was being prepared. Send it again to use the latest version.');
  }
}