import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import { isSealedSnapshot } from '@/platform/core/snapshotSeal';
import { supabase } from '@/integrations/supabase/client';
import { loadRevision, type LoadedRevision } from '@/services/vfsCommitService';
import { isUuid } from '@/types/builderIdentity';
import { computeSiteBundleSnapshotSha256 } from '@/marketplace/snapshotFingerprint';

export interface AcceptedRevisionEvidence {
  revisionId: string;
  projectId: string;
  businessId: string;
  snapshotSha256: string;
  snapshot: SiteBundleSnapshot;
}

export interface AcceptedRevisionEvidenceReader {
  getCurrentUserId(): Promise<string | null>;
  getProject(projectId: string): Promise<{ ownerId: string; businessId: string | null } | null>;
  getRevision(revisionId: string): Promise<LoadedRevision | null>;
}

const databaseReader: AcceptedRevisionEvidenceReader = {
  async getCurrentUserId() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user?.id ?? null;
  },
  async getProject(projectId) {
    const { data, error } = await supabase
      .from('projects')
      .select('owner_id, business_id')
      .eq('id', projectId)
      .maybeSingle();
    if (error) throw error;
    if (!data || typeof data.owner_id !== 'string') return null;
    return {
      ownerId: data.owner_id,
      businessId: typeof data.business_id === 'string' ? data.business_id : null,
    };
  },
  getRevision: loadRevision,
};

function isSnapshot(value: unknown): value is SiteBundleSnapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const snapshot = value as Partial<SiteBundleSnapshot>;
  if (typeof snapshot.snapshotId !== 'string' || !snapshot.snapshotId.trim()) return false;
  if (typeof snapshot.vfsFiles !== 'object' || snapshot.vfsFiles === null || Array.isArray(snapshot.vfsFiles)) return false;
  return Object.values(snapshot.vfsFiles).every((contents) => typeof contents === 'string');
}

export async function loadAcceptedRevisionEvidence(
  input: { projectId: string; revisionId: string },
  reader: AcceptedRevisionEvidenceReader = databaseReader,
): Promise<AcceptedRevisionEvidence> {
  if (!isUuid(input.projectId) || !isUuid(input.revisionId)) {
    throw new TypeError('Marketplace source project and revision IDs must be UUIDs.');
  }

  const userId = await reader.getCurrentUserId();
  if (!userId) throw new Error('Sign in to use a project as a marketplace source.');

  const project = await reader.getProject(input.projectId);
  if (!project || project.ownerId !== userId) {
    throw new Error('Only the project owner can submit an accepted revision to the marketplace.');
  }
  if (!project.businessId) throw new Error('Marketplace source project has no canonical business identity.');

  const revision = await reader.getRevision(input.revisionId);
  if (!revision || revision.status !== 'committed') {
    throw new Error('Marketplace source must be an accepted committed revision.');
  }
  if (revision.projectId !== input.projectId || revision.businessId !== project.businessId) {
    throw new Error('Marketplace revision does not belong to the selected canonical project.');
  }
  if (!isSnapshot(revision.siteBundleSnapshot) || !isSealedSnapshot(revision.siteBundleSnapshot)) {
    throw new Error('Marketplace source revision is missing a sealed canonical site snapshot.');
  }

  const snapshotSha256 = await computeSiteBundleSnapshotSha256(revision.siteBundleSnapshot);
  return {
    revisionId: revision.id,
    projectId: revision.projectId,
    businessId: revision.businessId,
    snapshotSha256,
    snapshot: revision.siteBundleSnapshot,
  };
}