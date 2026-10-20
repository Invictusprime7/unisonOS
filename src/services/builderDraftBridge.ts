import { supabase } from '@/integrations/supabase/client';

interface FindBuilderDraftForProjectInput {
  projectId?: string | null;
  projectName?: string | null;
  businessId?: string | null;
  userId?: string | null;
}

export interface BuilderDraftProjection {
  draftId: string;
  revisionId: string;
  updatedAt: string | null;
}

/**
 * Resolve the newest accepted draft projection for a Cloud project.
 *
 * A builder_drafts row can be newer than its committed site revision while an
 * autosave is in flight. Profile entry points must therefore prefer a row with
 * a durable revision pointer instead of trusting a cached draft id.
 */
export async function findLatestBuilderDraftProjectionForProject({
  projectId,
  businessId,
  userId,
}: Pick<FindBuilderDraftForProjectInput, 'projectId' | 'businessId' | 'userId'>): Promise<BuilderDraftProjection | null> {
  if (!projectId) return null;

  const resolvedUserId = userId || (await supabase.auth.getUser()).data.user?.id;
  if (!resolvedUserId) return null;

  let query = supabase
    .from('builder_drafts')
    .select('id, last_revision_id, updated_at')
    .eq('user_id', resolvedUserId)
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (businessId) query = query.eq('business_id', businessId);

  const { data, error } = await query;
  if (error) {
    console.warn('[builderDraftBridge] Failed to resolve canonical draft projection:', error);
    return null;
  }

  const row = (data || []).find((candidate) =>
    typeof candidate.last_revision_id === 'string' && candidate.last_revision_id.length > 0,
  );
  if (!row?.id || !row.last_revision_id) return null;

  return {
    draftId: row.id,
    revisionId: row.last_revision_id,
    updatedAt: row.updated_at || null,
  };
}

export async function findBuilderDraftIdForProject({
  projectId,
  projectName,
  businessId,
  userId,
}: FindBuilderDraftForProjectInput) {
  const resolvedUserId = userId || (await supabase.auth.getUser()).data.user?.id;
  if (!resolvedUserId) {
    return null;
  }

  // The relational FK is authoritative. Prefer a committed projection so an
  // old in-memory card cannot open a predecessor revision after another device
  // has saved a newer canonical state.
  const projection = await findLatestBuilderDraftProjectionForProject({
    projectId,
    businessId,
    userId: resolvedUserId,
  });
  if (projection) return projection.draftId;

  const { data, error } = await supabase
    .from('builder_drafts')
    .select('id, project_id, business_id, metadata, updated_at')
    .eq('user_id', resolvedUserId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    console.warn('[builderDraftBridge] Failed to resolve draft for project:', error);
    return null;
  }

  const rows = data || [];

  if (projectId) {
    const exactMatch = rows.find((row) => {
      const metadata = (row.metadata || {}) as Record<string, unknown>;
      const linkedProjectIds = [
        metadata.projectId,
        metadata.project_id,
        metadata.linkedProjectId,
      ]
        .map((value) => (typeof value === 'string' ? value : null))
        .filter((value): value is string => Boolean(value));

      return row.project_id === projectId || linkedProjectIds.includes(projectId);
    });

    if (exactMatch) {
      return exactMatch.id;
    }
  }

  const normalizedProjectName = (projectName || '').trim().toLowerCase();
  if (!normalizedProjectName || !businessId) {
    return null;
  }

  const nameMatch = rows.find((row) => {
    const metadata = (row.metadata || {}) as Record<string, unknown>;
    const draftName = String(
      metadata.name ||
      metadata.projectName ||
      metadata.business_name ||
      '',
    ).trim().toLowerCase();

    if (!draftName || draftName !== normalizedProjectName) {
      return false;
    }

    if (!businessId || !row.business_id) {
      return true;
    }

    return row.business_id === businessId;
  });

  return nameMatch?.id || null;
}
