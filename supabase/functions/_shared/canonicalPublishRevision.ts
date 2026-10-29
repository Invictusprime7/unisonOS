export interface CanonicalPublishRevisionIdentity {
  projectId: string;
  revisionId: string;
  vfsHash: string;
}

export interface CanonicalPublishRevisionRow {
  id: string;
  project_id: string;
  status: string;
  publish_ready: boolean;
  vfs_hash: string | null;
  vfs_files: Record<string, string>;
}

export type CanonicalPublishSourceVerification =
  | { ok: true }
  | { ok: false; code: string; message: string; details?: Record<string, unknown> };

export async function computeCanonicalVfsHash(files: Record<string, string>): Promise<string> {
  const payload = Object.keys(files).sort().map((path) => `${path}\0${files[path]}`).join('\n');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizedFiles(files: Record<string, string>): Record<string, string> | null {
  const normalized: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    if (typeof content !== 'string') return null;
    const key = path.replace(/^\/+/, '');
    if (!key || Object.prototype.hasOwnProperty.call(normalized, key)) return null;
    normalized[key] = content;
  }
  return normalized;
}

export async function verifyCanonicalPublishSource(input: {
  identity: CanonicalPublishRevisionIdentity;
  revision: CanonicalPublishRevisionRow;
  submittedFiles: Record<string, string>;
  expectedPublishedFiles: Record<string, string>;
}): Promise<CanonicalPublishSourceVerification> {
  const { identity, revision } = input;
  if (revision.id !== identity.revisionId || revision.project_id !== identity.projectId
    || revision.status !== 'committed' || revision.publish_ready !== true
    || !revision.vfs_hash || revision.vfs_hash !== identity.vfsHash) {
    return {
      ok: false,
      code: 'canonical-revision-mismatch',
      message: 'The requested publish revision is no longer the accepted publish-ready revision.',
      details: { revisionId: identity.revisionId, projectId: identity.projectId },
    };
  }

  const computedVfsHash = await computeCanonicalVfsHash(revision.vfs_files);
  if (computedVfsHash !== revision.vfs_hash) {
    return {
      ok: false,
      code: 'canonical-vfs-hash-mismatch',
      message: 'The stored revision source does not match its canonical VFS hash.',
      details: { revisionId: revision.id },
    };
  }

  const submitted = normalizedFiles(input.submittedFiles);
  const expected = normalizedFiles(input.expectedPublishedFiles);
  if (!submitted || !expected) {
    return { ok: false, code: 'canonical-file-map-invalid', message: 'Published file paths or contents are invalid.' };
  }

  if (!Object.prototype.hasOwnProperty.call(revision.vfs_files, 'unison.runtime.json')) {
    delete submitted['unison.runtime.json'];
  }
  const submittedPaths = Object.keys(submitted).sort();
  const expectedPaths = Object.keys(expected).sort();
  const changedPaths = [...new Set([...submittedPaths, ...expectedPaths])]
    .filter((path) => submitted[path] !== expected[path]);
  if (changedPaths.length > 0) {
    return {
      ok: false,
      code: 'canonical-publish-source-mismatch',
      message: 'The deployment bundle does not match the accepted revision source.',
      details: { revisionId: revision.id, paths: changedPaths.slice(0, 20) },
    };
  }
  return { ok: true };
}
