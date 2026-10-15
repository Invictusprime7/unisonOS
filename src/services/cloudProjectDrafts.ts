import type { ProjectRecord } from '@/services/projectSchemaCompat';

export interface WorkspaceDraftRecord {
  id: string;
  project_id?: string | null;
  business_id?: string | null;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
  last_revision_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface WorkspaceProjectRecord extends Omit<ProjectRecord, 'created_at'> {
  created_at: string;
  draft_id?: string | null;
  revision_id?: string | null;
  draft_only?: boolean;
}

const PLACEHOLDER_PROJECT_NAME = /^(?:untitled(?: project| site)?|new project|my project)$/i;

function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name || null;
}

export function isPlaceholderProjectName(value: unknown): boolean {
  const name = cleanName(value);
  return Boolean(name && PLACEHOLDER_PROJECT_NAME.test(name));
}

/**
 * Resolve the user-authored draft title while treating historical placeholder
 * values as missing. builder_drafts.name is normally authoritative, but old
 * trigger runs could pin "Untitled project" there while metadata kept the
 * real launch name.
 */
export function resolveWorkspaceDraftName(
  draft: WorkspaceDraftRecord,
  fallback?: string | null,
): string {
  const candidates = [
    draft.name,
    draft.metadata?.projectName,
    draft.metadata?.name,
  ]
    .map(cleanName)
    .filter((name): name is string => Boolean(name));
  const meaningfulDraftName = candidates.find((name) => !isPlaceholderProjectName(name));
  const cleanFallback = cleanName(fallback);
  return meaningfulDraftName
    || (cleanFallback && !isPlaceholderProjectName(cleanFallback) ? cleanFallback : null)
    || candidates[0]
    || cleanFallback
    || 'Untitled project';
}

/** Join Cloud metadata with its latest durable Web Builder draft. */
export function mergeWorkspaceProjects(
  projects: ProjectRecord[],
  drafts: WorkspaceDraftRecord[],
  revisionTimes: ReadonlyMap<string, string> = new Map(),
): WorkspaceProjectRecord[] {
  const draftActivity = (draft: WorkspaceDraftRecord): string => {
    if (draft.last_revision_id) {
      return revisionTimes.get(draft.last_revision_id)
        || String(draft.updated_at || draft.created_at || '');
    }
    return String(draft.created_at || draft.updated_at || '');
  };

  const latestDraftByProject = new Map<string, WorkspaceDraftRecord>();
  for (const draft of drafts) {
    if (!draft.project_id) continue;
    const previous = latestDraftByProject.get(draft.project_id);
    const draftIsCanonical = Boolean(draft.last_revision_id);
    const previousIsCanonical = Boolean(previous?.last_revision_id);
    if (!previous
      || (draftIsCanonical && !previousIsCanonical)
      || (draftIsCanonical === previousIsCanonical && draftActivity(draft) > draftActivity(previous))) {
      latestDraftByProject.set(draft.project_id, draft);
    }
  }

  const represented = new Set(projects.map((project) => project.id));
  const result: WorkspaceProjectRecord[] = projects.map((project) => {
    const latestDraft = latestDraftByProject.get(project.id);
    const projectUpdatedAt = String(project.updated_at || project.created_at || '');
    // A draft with no accepted revision can be a browser recovery shell. It
    // must not make an old linked project appear newly saved.
    const draftUpdatedAt = latestDraft?.last_revision_id ? draftActivity(latestDraft) : '';
    return {
      ...project,
      name: latestDraft
        ? resolveWorkspaceDraftName(latestDraft, project.name)
        : project.name,
      created_at: project.created_at || project.updated_at || new Date(0).toISOString(),
      // Draft commits can advance without changing projects.updated_at. Carry
      // that durable activity into the profile ordering and card freshness.
      updated_at: draftUpdatedAt > projectUpdatedAt ? draftUpdatedAt : project.updated_at || null,
      draft_id: latestDraft?.id ?? null,
      revision_id: latestDraft?.last_revision_id ?? null,
    };
  });

  // Defensive visibility for rows awaiting trigger/backfill synchronization.
  for (const draft of drafts) {
    if (draft.project_id && represented.has(draft.project_id)) continue;
    result.push({
      id: draft.project_id || draft.id,
      name: resolveWorkspaceDraftName(draft),
      description: String(draft.metadata?.description || '') || null,
      owner_id: null,
      business_id: draft.business_id ?? null,
      status: 'draft',
      publish_status: 'draft',
      created_at: draft.created_at || draft.updated_at || new Date(0).toISOString(),
      updated_at: draft.updated_at || draft.created_at || null,
      draft_id: draft.id,
      revision_id: draft.last_revision_id ?? null,
      draft_only: !draft.project_id,
    });
  }

  return result.sort((a, b) =>
    String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)),
  );
}
