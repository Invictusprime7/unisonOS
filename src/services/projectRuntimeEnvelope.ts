import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import type { BusinessCapability } from '@/platform/core/capabilityRegistry';
import { supabase } from '@/integrations/supabase/client';
import type { LoadedRevision } from '@/services/vfsCommitService';
import {
  assertProjectRuntimeEnvelope,
  type ProjectRuntimeEnvelope,
  type ProjectRuntimeMode,
  type ProjectSynchronizationStatus,
} from '@/types/projectRuntimeEnvelope';

export interface BuildProjectRuntimeEnvelopeInput {
  workspaceId: string;
  revision: LoadedRevision;
  activePublishedRevisionId?: string | null;
  activePagePath?: string | null;
  runtimeMode?: ProjectRuntimeMode;
  synchronizationStatus?: ProjectSynchronizationStatus;
}

export interface ProjectRuntimeProjection {
  activePublishedRevisionId: string | null;
  activePagePath: string | null;
}

/** The only draft/project identity valid for a hydrated persisted revision. */
export function resolvePersistedEditorIdentity(
  revision: Pick<LoadedRevision, 'businessId' | 'projectId' | 'draftId'>,
) {
  return {
    businessId: revision.businessId,
    projectId: revision.projectId,
    draftId: revision.draftId,
  };
}

/** Use a hydrated revision's tenant identity only when it matches the open project/draft. */
export function resolveHydratedBusinessId(
  revision: Pick<LoadedRevision, 'businessId' | 'projectId' | 'draftId'> | null | undefined,
  expected: { projectId?: string | null; draftId?: string | null },
): string | null {
  const businessId = revision?.businessId?.trim();
  if (!businessId) return null;
  if (expected.projectId && revision?.projectId !== expected.projectId) return null;
  if (expected.draftId && revision?.draftId !== expected.draftId) return null;
  return businessId;
}

export function projectRuntimeProjectionFromRows(
  project: { active_published_revision_id?: string | null } | null,
  draft: { metadata?: unknown } | null,
): ProjectRuntimeProjection {
  const metadata = draft?.metadata && typeof draft.metadata === 'object'
    ? draft.metadata as Record<string, unknown>
    : {};
  const activePagePath = metadata.activePagePath;
  return {
    activePublishedRevisionId: project?.active_published_revision_id ?? null,
    activePagePath: typeof activePagePath === 'string' && activePagePath.trim()
      ? activePagePath
      : null,
  };
}

export async function loadProjectRuntimeProjection(
  projectId: string,
  draftId: string,
): Promise<ProjectRuntimeProjection> {
  const [projectResult, draftResult] = await Promise.all([
    supabase
      .from('projects')
      .select('active_published_revision_id')
      .eq('id', projectId)
      .maybeSingle(),
    supabase
      .from('builder_drafts')
      .select('metadata')
      .eq('id', draftId)
      .eq('project_id', projectId)
      .maybeSingle(),
  ]);
  if (projectResult.error) throw projectResult.error;
  if (draftResult.error) throw draftResult.error;
  return projectRuntimeProjectionFromRows(projectResult.data, draftResult.data);
}

function provisionedCapabilities(snapshot: SiteBundleSnapshot): BusinessCapability[] {
  return Array.from(new Set(
    snapshot.businessSystem?.capabilities
      .filter((capability) => capability.status === 'provisioned')
      .flatMap((capability) => capability.provides) ?? [],
  ));
}

export function resolveProjectActivePagePath(
  snapshot: SiteBundleSnapshot,
  requestedPath?: string | null,
): string {
  if (!requestedPath?.trim()) {
    throw new Error('[ProjectRuntimeEnvelope] missing persisted active page path');
  }
  if (!(requestedPath in snapshot.vfsFiles)) {
    throw new Error('[ProjectRuntimeEnvelope] persisted active page path is not present in snapshot.vfsFiles');
  }
  return requestedPath;
}

/** Build the runtime spine only from a persisted revision and tenant identity. */
export function buildProjectRuntimeEnvelope(
  input: BuildProjectRuntimeEnvelopeInput,
): ProjectRuntimeEnvelope {
  const snapshot = input.revision.siteBundleSnapshot as SiteBundleSnapshot;
  const identity = resolvePersistedEditorIdentity(input.revision);
  const envelope: ProjectRuntimeEnvelope = {
    version: '1.0',
    identity: {
      workspaceId: input.workspaceId,
      businessId: identity.businessId,
      projectId: identity.projectId,
      draftId: identity.draftId,
    },
    snapshot,
    snapshotVersion: snapshot?.snapshotId ?? '',
    revisionId: input.revision.id,
    activePublishedRevisionId: input.activePublishedRevisionId ?? null,
    navigation: {
      activePagePath: resolveProjectActivePagePath(snapshot, input.activePagePath),
    },
    runtimeMode: input.runtimeMode ?? 'draft',
    provisionedCapabilities: provisionedCapabilities(snapshot),
    persistence: {
      status: 'persisted',
      persistedAt: input.revision.createdAt,
      error: null,
    },
    synchronization: {
      status: input.synchronizationStatus ?? 'synchronized',
      synchronizedAt: input.revision.createdAt,
      error: null,
    },
  };
  assertProjectRuntimeEnvelope(envelope);
  return envelope;
}