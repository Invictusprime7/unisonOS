/**
 * Draft ↔ owning-business repair.
 *
 * Some drafts (legacy rows, interrupted launches, projects created before the
 * canonical revision schema landed) end up with `builder_drafts.business_id`
 * NULL. Every canonical write path — including `commit_canonical_site_revision`
 * — is keyed on the owning business, so such a draft can never receive a
 * committed revision projection and the Web Builder hangs on
 * "Loading committed project state".
 *
 * This module recreates that relationship deterministically:
 *   1. resolve an owning business (draft → project → owned → member → create)
 *   2. relink the draft and, when needed, its project
 *   3. validate and accept saved content through commitMutation
 *
 * It is intentionally idempotent: running it on a healthy draft is a no-op.
 */
import { supabase } from '@/integrations/supabase/client';

export interface DraftBusinessRepairResult {
  repaired: boolean;
  businessId: string | null;
  revisionId: string | null;
  createdBusiness: boolean;
  committedRevision: boolean;
  /** True when no saved content is available; this does not establish past generation. */
  emptyDraft: boolean;
  notes: string[];
}

type DraftRow = {
  code: string | null;
  editor_code: string | null;
  id: string;
  user_id: string;
  business_id: string | null;
  project_id: string | null;
  name: string | null;
  vfs_files: Record<string, string> | null;
  metadata: Record<string, unknown> | null;
  last_revision_id: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function resolveOwningBusiness(
  draft: DraftRow,
  projectBusinessId: string | null,
  userId: string,
  notes: string[],
): Promise<{ businessId: string | null; created: boolean }> {
  if (draft.business_id) return { businessId: draft.business_id, created: false };
  if (projectBusinessId) {
    notes.push('Recovered owning business from the project record.');
    return { businessId: projectBusinessId, created: false };
  }

  const { data: owned } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (owned?.id) {
    notes.push('Recovered owning business from your owned workspaces.');
    return { businessId: owned.id as string, created: false };
  }

  const { data: membership } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (membership?.business_id) {
    notes.push('Recovered owning business from your workspace membership.');
    return { businessId: membership.business_id as string, created: false };
  }

  const { data: created, error: createError } = await supabase
    .from('businesses')
    .insert({
      owner_id: userId,
      name: draft.name?.trim() || 'My Business',
    })
    .select('id')
    .single();
  if (createError || !created?.id) {
    notes.push(`Could not create an owning business: ${createError?.message ?? 'unknown error'}`);
    return { businessId: null, created: false };
  }
  notes.push('Created a new owning business workspace for this draft.');
  return { businessId: created.id as string, created: true };
}

async function ensureProjectMembership(projectId: string, userId: string): Promise<void> {
  try {
    const { data } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();
    if (data) return;
    await supabase.from('project_members').insert({
      project_id: projectId,
      user_id: userId,
      role: 'owner',
    } as never);
  } catch {
    /* membership is best-effort; RLS may already guarantee access */
  }
}

async function backfillCommittedRevision(
  draft: DraftRow,
  businessId: string,
  projectId: string,
  notes: string[],
): Promise<{ revisionId: string | null; empty: boolean }> {
  const { loadLegacyDraftContent } = await import('./legacyDraftHydration');
  const { prepareSavedVfsRuntime } = await import('./savedVfsRuntime');
  const { ensureViteRootFiles } = await import('./previewSession');
  const { templateToVFSFiles } = await import('@/utils/templateToVFS');
  const { commitMutation } = await import('./vfsCommitService');
  const { legacyFilesToPatchPlan } = await import('@/types/patchPlan');
  const { computeBuilderVfsSignature, writeBuilderRecoverySnapshot, markBuilderRecoveryPersisted } = await import('./builderStateRecovery');
  const { createEmptyCreatorData } = await import('@/types/creatorData');
  const { THEME_PRESETS } = await import('@/components/onboarding/themePresets');
  const { themePresetToThemeTokens } = await import('@/components/onboarding/themePresetToTokens');
  try {
    const content = await loadLegacyDraftContent(projectId, draft.id);
    if (!content) {
      notes.push('No saved source or saved site plan is available to convert.');
      return { revisionId: null, empty: true };
    }
    const metadata = asRecord(draft.metadata);
    const source = Object.keys(content.files).length ? content.files : templateToVFSFiles(content.code, draft.name || 'Saved project');
    const files = ensureViteRootFiles(prepareSavedVfsRuntime(source, {
      businessId, projectId, siteId: typeof metadata.siteId === 'string' ? metadata.siteId : undefined,
      industry: typeof metadata.industry === 'string' ? metadata.industry : undefined,
      templateId: content.sitePlan?.selectedTemplateId, themePresetId: content.sitePlan?.selectedThemePresetId,
    }));
    const parse = (path: string) => { try { return asRecord(JSON.parse(files[path] || '{}')); } catch { return {}; } };
    const snapshot = Object.keys(asRecord(metadata.siteBundleSnapshot)).length ? asRecord(metadata.siteBundleSnapshot) : parse('/.unison/site-bundle-snapshot.json');
    const savedPlayground = Object.keys(asRecord(metadata.canonicalPlayground)).length ? asRecord(metadata.canonicalPlayground) : parse('/.unison/canonical-playground.json');
    const pageRegistry = content.pageRegistry || savedPlayground.pageRegistry || snapshot.pageRegistry;
    if (!pageRegistry) throw new Error('Saved page registry is unavailable; source is retained for recovery.');
    const savedTheme = parse('/.unison/legacy-theme.json');
    const savedRecovery = parse('/.unison/legacy-recovery.json');
    const themePresetId = content.sitePlan?.selectedThemePresetId || metadata.themePresetId || asRecord(snapshot.meta).themePresetId || savedTheme.themePresetId;
    const preset = THEME_PRESETS.find(preset => preset.id === themePresetId);
    const themeTokens = snapshot.themeTokens || metadata.themeTokens || savedTheme.themeTokens || (preset ? themePresetToThemeTokens(preset) : undefined);
    if (!themeTokens || typeof themePresetId !== 'string') throw new Error('Saved theme selection is unavailable; source is retained for recovery.');
    const playground = { creatorData: createEmptyCreatorData(draft.name || 'Saved project'), bindings: {}, calendars: {}, popups: {}, ...savedPlayground, pageRegistry };
    const recovery = { version: 2 as const, templateId: draft.id, code: content.code, editorCode: content.code,
      savedAt: new Date().toISOString(), vfsSignature: computeBuilderVfsSignature(files), vfsFiles: files,
      reason: 'ai_recovery' as const, pendingRemote: true };
    writeBuilderRecoverySnapshot(recovery);
    const committed = await commitMutation({
      source: 'playground-edit',
      identity: { userId: draft.user_id, businessId, projectId, draftId: draft.id, revisionId: '', sessionId: 'legacy-conversion:' + draft.id },
      current: { vfsFiles: files, activePagePath: content.activePagePath, playground: playground as unknown as import('@/platform/core/playground').PlaygroundState },
      patch: legacyFilesToPatchPlan(files, 'Convert saved cloud project to canonical VFS'),
      options: { requirePreviewPass: true, requireReadinessPass: false,
        businessName: content.sitePlan?.businessName || (typeof savedRecovery.businessName === 'string' ? savedRecovery.businessName : draft.name || undefined),
        industry: content.sitePlan?.industry || (typeof metadata.industry === 'string' ? metadata.industry : typeof savedRecovery.industry === 'string' ? savedRecovery.industry : undefined),
        selectedTemplateId: content.sitePlan?.selectedTemplateId || (typeof metadata.templateId === 'string' ? metadata.templateId : typeof savedRecovery.templateId === 'string' ? savedRecovery.templateId : undefined),
        themePresetId, themeTokens: themeTokens as import('@/sections/types').ThemeTokens },
    });
    if (!committed.persistedRevisionId) throw new Error('Canonical conversion did not persist an accepted revision.');
    markBuilderRecoveryPersisted(recovery, draft.id, undefined, committed.persistedRevisionId);
    notes.push('Converted saved content into a validated canonical revision.');
    return { revisionId: committed.persistedRevisionId, empty: false };
  } catch (error) {
    notes.push('Saved project conversion failed: ' + (error instanceof Error ? error.message : String(error)));
    return { revisionId: null, empty: false };
  }
}

export async function repairDraftBusinessLink(args: {
  draftId: string;
  projectId?: string | null;
}): Promise<DraftBusinessRepairResult> {
  const notes: string[] = [];
  const result: DraftBusinessRepairResult = {
    repaired: false,
    businessId: null,
    revisionId: null,
    createdBusiness: false,
    committedRevision: false,
    emptyDraft: false,
    notes,
  };

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) {
    notes.push('You must be signed in to repair this project.');
    return result;
  }

  const { data: draftRow, error: draftError } = await (supabase
    .from('builder_drafts') as never as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: DraftRow | null; error: { message: string } | null }>;
        };
      };
    })
    .select('id, user_id, business_id, project_id, name, code, editor_code, vfs_files, metadata, last_revision_id')
    .eq('id', args.draftId)
    .maybeSingle();

  if (draftError || !draftRow) {
    notes.push(draftError?.message || 'This draft no longer exists in your workspace.');
    return result;
  }

  if (draftRow.user_id !== userId || (draftRow.project_id && args.projectId && draftRow.project_id !== args.projectId)) {
    notes.push('Draft ownership or project linkage does not match; conversion refused.');
    return result;
  }
  const projectId = draftRow.project_id || args.projectId || null;
  if (!draftRow.project_id && projectId) {
    const { error } = await supabase.from('builder_drafts').update({ project_id: projectId }).eq('id', draftRow.id).eq('user_id', userId);
    if (error) { notes.push(`Could not link the legacy draft: ${error.message}`); return result; }
    result.repaired = true;
  }
  let projectBusinessId: string | null = null;
  if (projectId) {
    const { data: project } = await supabase
      .from('projects')
      .select('id, business_id')
      .eq('id', projectId)
      .maybeSingle();
    projectBusinessId = (project?.business_id as string | null) ?? null;
  }

  const { businessId, created } = await resolveOwningBusiness(
    draftRow,
    projectBusinessId,
    userId,
    notes,
  );
  result.businessId = businessId;
  result.createdBusiness = created;
  if (!businessId) return result;

  if (draftRow.business_id !== businessId) {
    const { error } = await (supabase.from('builder_drafts') as never as {
      update: (values: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    })
      // Maintenance relink: not user activity, so leave updated_at alone.
      .update({ business_id: businessId })
      .eq('id', draftRow.id);
    if (error) {
      notes.push(`Could not relink the draft to its business: ${error.message}`);
      return result;
    }
    result.repaired = true;
    notes.push('Relinked the draft to its owning business.');
  }

  if (projectId && projectBusinessId !== businessId) {
    const { error } = await supabase
      .from('projects')
      .update({ business_id: businessId })
      .eq('id', projectId);
    if (error) notes.push(`Project relink skipped: ${error.message}`);
    else {
      result.repaired = true;
      notes.push('Relinked the project to its owning business.');
    }
  }

  if (projectId) {
    await ensureProjectMembership(projectId, userId);
    if (!draftRow.last_revision_id) {
      const backfill = await backfillCommittedRevision(
        { ...draftRow, business_id: businessId },
        businessId,
        projectId,
        notes,
      );
      result.emptyDraft = backfill.empty;
      if (backfill.revisionId) {
        result.revisionId = backfill.revisionId;
        result.committedRevision = true;
        result.repaired = true;
      }
    } else {
      result.revisionId = draftRow.last_revision_id;
    }
  }

  return result;
}
