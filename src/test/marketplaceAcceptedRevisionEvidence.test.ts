import { describe, expect, it } from 'vitest';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import type { LoadedRevision } from '@/services/vfsCommitService';
import {
  loadAcceptedRevisionEvidence,
  type AcceptedRevisionEvidenceReader,
} from '@/marketplace/certification/acceptedRevisionEvidence';

const projectId = '11111111-1111-4111-8111-111111111111';
const revisionId = '22222222-2222-4222-8222-222222222222';
const businessId = '33333333-3333-4333-8333-333333333333';
const userId = '44444444-4444-4444-8444-444444444444';

const snapshot = {
  snapshotId: 'snapshot-1',
  vfsFiles: { '/src/App.tsx': 'export default function App() { return null; }' },
  meta: { seal: { version: '1.0' } },
} as unknown as SiteBundleSnapshot;

const committedRevision = {
  id: revisionId,
  projectId,
  businessId,
  draftId: '55555555-5555-4555-8555-555555555555',
  source: 'wizard-launch',
  status: 'committed',
  vfsFiles: snapshot.vfsFiles,
  siteBundleSnapshot: snapshot,
  runtimeManifest: null,
  playground: null,
  readinessReport: {},
  diagnostics: [],
  publishReady: false,
  publishBlockers: [],
  vfsHash: null,
  candidateId: null,
  operationIds: [],
  fileProvenance: {},
  createdAt: '2026-10-22T00:00:00.000Z',
} satisfies LoadedRevision;

function createReader(overrides: Partial<AcceptedRevisionEvidenceReader> = {}): AcceptedRevisionEvidenceReader {
  return {
    getCurrentUserId: async () => userId,
    getProject: async () => ({ ownerId: userId, businessId }),
    getRevision: async () => committedRevision,
    ...overrides,
  };
}

describe('loadAcceptedRevisionEvidence', () => {
  it('derives a snapshot hash only from an owner-owned committed sealed revision', async () => {
    const evidence = await loadAcceptedRevisionEvidence({ projectId, revisionId }, createReader());

    expect(evidence).toMatchObject({ revisionId, projectId, businessId, snapshot });
    expect(evidence.snapshotSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects unauthenticated callers and non-owner project members', async () => {
    await expect(loadAcceptedRevisionEvidence(
      { projectId, revisionId },
      createReader({ getCurrentUserId: async () => null }),
    )).rejects.toThrow(/sign in/i);

    await expect(loadAcceptedRevisionEvidence(
      { projectId, revisionId },
      createReader({ getProject: async () => ({ ownerId: '66666666-6666-4666-8666-666666666666', businessId }) }),
    )).rejects.toThrow(/project owner/i);
  });

  it('rejects rejected, cross-project, and cross-business revisions', async () => {
    await expect(loadAcceptedRevisionEvidence(
      { projectId, revisionId },
      createReader({ getRevision: async () => ({ ...committedRevision, status: 'rejected' }) }),
    )).rejects.toThrow(/committed revision/i);

    await expect(loadAcceptedRevisionEvidence(
      { projectId, revisionId },
      createReader({ getRevision: async () => ({ ...committedRevision, projectId: '77777777-7777-4777-8777-777777777777' }) }),
    )).rejects.toThrow(/does not belong/i);

    await expect(loadAcceptedRevisionEvidence(
      { projectId, revisionId },
      createReader({ getRevision: async () => ({ ...committedRevision, businessId: '88888888-8888-4888-8888-888888888888' }) }),
    )).rejects.toThrow(/does not belong/i);
  });

  it('rejects unsealed or malformed canonical snapshots', async () => {
    await expect(loadAcceptedRevisionEvidence(
      { projectId, revisionId },
      createReader({ getRevision: async () => ({ ...committedRevision, siteBundleSnapshot: { snapshotId: 'legacy', vfsFiles: {} } }) }),
    )).rejects.toThrow(/sealed canonical site snapshot/i);

    await expect(loadAcceptedRevisionEvidence(
      { projectId, revisionId },
      createReader({ getRevision: async () => ({ ...committedRevision, siteBundleSnapshot: { ...snapshot, vfsFiles: { '/src/App.tsx': null } } }) }),
    )).rejects.toThrow(/sealed canonical site snapshot/i);
  });
});