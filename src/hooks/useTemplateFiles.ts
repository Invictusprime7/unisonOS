/**
 * useTemplateFiles — saved Web Builder projects
 *
 * Persists into `builder_drafts` so the FULL project state (multi-page VFS,
 * entry point, active page, business/system context) round-trips on save+load.
 *
 * Backward compat: API surface preserved. Legacy `design_templates` rows still
 * load via fallback path (read-only). New saves always go to `builder_drafts`.
 */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";
import { syncCanonicalComponentGraph } from "@/services/componentGraphPersistence";
import { findBuilderDraftIdForProject } from "@/services/builderDraftBridge";
import { resolveWorkspaceDraftName } from '@/services/cloudProjectDrafts';
import { resolveLegacyDraftContent } from "@/services/legacyDraftHydration";
import { commitMutation } from "@/services/vfsCommitService";
import { legacyFilesToPatchPlan } from "@/types/patchPlan";
import type { PlaygroundState } from "@/platform/core/playground";
import { computeBuilderVfsSignature, readBuilderRecoverySnapshot, writeBuilderRecoverySnapshot } from '@/services/builderStateRecovery';

interface TemplateData {
  html: string;
  css?: string;
  previewCode?: string;
  // v2 fields
  vfsFiles?: Record<string, string>;
  entryPoint?: string;
  activePagePath?: string;
  canonicalPlayground?: Record<string, unknown>;
  siteBundleSnapshot?: Record<string, unknown>;
  runtimeManifest?: Record<string, unknown>;
  businessRuntime?: Record<string, unknown>;
  businessId?: string;
  projectId?: string;
  draftId?: string;
  siteId?: string;
  version?: number;
}

export interface SavedTemplate {
  id: string;
  name: string;
  description: string | null;
  canvas_data: TemplateData;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  thumbnail_url: string | null;
}

export interface SaveProjectPayload {
  vfsFiles?: Record<string, string>;
  entryPoint?: string;
  activePagePath?: string;
  businessId?: string | null;
  projectId?: string | null;
  canonicalPlayground?: Record<string, unknown>;
  siteBundleSnapshot?: unknown;
  metadata?: Record<string, unknown>;
  /**
   * When true, `saveTemplate` skips the existing-draft lookup and always
   * INSERTs a fresh row. Used by the "Save as New" action so cloning a
   * project doesn't silently overwrite the currently-open draft.
   */
  forceNew?: boolean;
  /**
   * Background/auto-saves set this so a failure never spams the user with
   * toasts. Errors are still logged and surfaced through the return value.
   */
  silent?: boolean;
}

const LOCAL_STORAGE_KEY = "webbuilder_templates";

// Source projections belong to commitMutation, never identity/name writes.
function identityMetadata(metadata?: Record<string, unknown>): Record<string, unknown> {
  const protectedKeys = new Set(['vfsFiles', 'siteBundleSnapshot', 'runtimeManifest', 'canonicalPlayground', 'activePagePath', 'businessRuntime']);
  return Object.fromEntries(Object.entries(metadata || {}).filter(([key, value]) => !protectedKeys.has(key) && value !== undefined));
}

const getLocalTemplates = (): SavedTemplate[] => {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveLocalTemplates = (templates: SavedTemplate[]) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(templates));
};

function emitCloudDraftSaved(detail: {
  draftId: string;
  projectId?: string | null;
  businessId?: string | null;
}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('unison:project-draft-saved', { detail }));
}

/** True for network-level/transient failures worth a single automatic retry. */
function isTransientSaveError(error: unknown): boolean {
  const candidate = error as { message?: string; code?: string; status?: number } | null;
  const message = (candidate?.message || '').toLowerCase();
  if (candidate?.status && candidate.status >= 500) return true;
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('load failed') ||
    candidate?.code === 'PGRST301' // Postgrest: JWT expired mid-request race, worth one retry after refresh
  );
}

/** True when a Postgres foreign-key violation is on the business_id column. */
function isBusinessIdForeignKeyViolation(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string; details?: string } | null;
  if (candidate?.code !== '23503') return false;
  const haystack = `${candidate?.message || ''} ${candidate?.details || ''}`.toLowerCase();
  return haystack.includes('business_id');
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Persist real VFS/snapshot content as a canonical revision. builder_drafts
 * content columns (vfs_files, metadata.siteBundleSnapshot/runtimeManifest/
 * activePagePath) are only ever written by commitMutation — never by this
 * hook's identity/name writes — so the schema's canonical-projection trigger
 * never sees a divergent draft row.
 */
async function commitProjectContent(input: {
  userId: string;
  draftId: string;
  businessId: string | null | undefined;
  projectId: string | null | undefined;
  lastRevisionId: string | null | undefined;
  payload: SaveProjectPayload;
  summary: string;
}): Promise<void> {
  const vfsFiles = input.payload.vfsFiles;
  if (!vfsFiles) return;
  // Keep the authored candidate recoverable even when validation or the cloud
  // commit fails after creating a draft identity. This is a journal, not a
  // canonical revision; only commitMutation can accept the candidate.
  const signature = computeBuilderVfsSignature(vfsFiles);
  const recovery = readBuilderRecoverySnapshot(input.draftId);
  if (signature && recovery?.vfsSignature !== signature) {
    writeBuilderRecoverySnapshot({
      version: 2, templateId: input.draftId, vfsFiles, vfsSignature: signature,
      code: vfsFiles[input.payload.entryPoint || '/src/App.tsx'] || '',
      editorCode: vfsFiles[input.payload.entryPoint || '/src/App.tsx'] || '',
      savedAt: new Date().toISOString(), pendingRemote: true, reason: 'navigation_flush',
    });
  }
  if (!input.businessId || !input.projectId) {
    throw new Error('Canonical content requires a linked business and project.');
  }
  const commit = await commitMutation({
    source: 'playground-edit',
    identity: {
      userId: input.userId,
      businessId: input.businessId,
      projectId: input.projectId,
      draftId: input.draftId,
      revisionId: input.lastRevisionId || '',
      sessionId: `template-save:${input.draftId}`,
    },
    current: {
      vfsFiles,
      playground: input.payload.canonicalPlayground as unknown as PlaygroundState | undefined,
      siteBundleSnapshot: input.payload.siteBundleSnapshot ?? undefined,
      activePagePath: input.payload.activePagePath,
    },
    patch: legacyFilesToPatchPlan(vfsFiles, input.summary),
    options: {
      requirePreviewPass: true,
      requireReadinessPass: false,
    },
  });
  if (!commit.persistedRevisionId) {
    throw new Error('Canonical save did not persist a revision.');
  }
}

/**
 * Runs a builder_drafts write (insert/update) with hardening:
 *  - retries transient/network failures with backoff (up to 3 attempts total)
 *  - if a stale/invalid business_id causes a foreign-key violation, drops it
 *    and retries once rather than failing the whole save
 * `payload` is mutated in place when the business_id fallback kicks in, so
 * callers building metadata from it afterwards see the corrected value.
 */
async function executeDraftWrite<T>(
  payload: Record<string, unknown>,
  run: (payload: Record<string, unknown>) => PromiseLike<{ data: T | null; error: unknown }>,
): Promise<{ data: T | null; error: unknown }> {
  let attempt = 0;
  let lastError: unknown = null;
  while (attempt < 3) {
    attempt += 1;
    const { data, error } = await run(payload);
    if (!error) return { data, error: null };
    lastError = error;
    if (isBusinessIdForeignKeyViolation(error) && payload.business_id !== null && payload.business_id !== undefined) {
      console.warn('[useTemplateFiles] business_id FK violation on write — retrying without it:', error);
      payload.business_id = null;
      continue;
    }
    if (isTransientSaveError(error) && attempt < 3) {
      await delay(300 * attempt);
      continue;
    }
    break;
  }
  return { data: null, error: lastError };
}

/** Build the v2 canvas_data envelope. Always includes the legacy fields for fallback rendering. */
const buildCanvasData = (code: string, payload?: SaveProjectPayload): TemplateData => ({
  version: 2,
  html: code,
  previewCode: code,
  ...(payload?.vfsFiles ? { vfsFiles: payload.vfsFiles } : {}),
  ...(payload?.entryPoint ? { entryPoint: payload.entryPoint } : {}),
  ...(payload?.activePagePath ? { activePagePath: payload.activePagePath } : {}),
  ...(payload?.canonicalPlayground ? { canonicalPlayground: payload.canonicalPlayground } : {}),
  ...(payload?.siteBundleSnapshot ? { siteBundleSnapshot: payload.siteBundleSnapshot as Record<string, unknown> } : {}),
});

/** Convert a builder_drafts row to a SavedTemplate envelope. */
export const draftRowToTemplate = (row: any): SavedTemplate => {
  const meta = (row.metadata || {}) as Record<string, any>;
  const savedContent = resolveLegacyDraftContent(row);
  const vfsFiles = Object.keys(savedContent.files).length ? savedContent.files : undefined;
  return {
    id: row.id,
    name: resolveWorkspaceDraftName(row),
    description: meta.description ?? null,
    is_public: false,
    created_at: row.created_at,
    updated_at: row.updated_at,
    thumbnail_url: meta.thumbnail_url ?? null,
    canvas_data: {
      version: 2,
      html: row.code || row.editor_code || "",
      previewCode: row.editor_code || row.code || "",
      vfsFiles,
      entryPoint: meta.entryPoint,
      activePagePath: meta.activePagePath,
      canonicalPlayground: (meta.canonicalPlayground || undefined) as Record<string, unknown> | undefined,
      siteBundleSnapshot: (meta.siteBundleSnapshot || undefined) as Record<string, unknown> | undefined,
      runtimeManifest: (meta.runtimeManifest || undefined) as Record<string, unknown> | undefined,
      businessRuntime: (meta.businessRuntime || undefined) as Record<string, unknown> | undefined,
      businessId: row.business_id || undefined,
      projectId: row.project_id || undefined,
      draftId: row.id,
      siteId: row.site_id || meta.siteId || undefined,
    },
  };
};

export function useTemplateFiles() {
  const [loading, setLoading] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  // Pass 2 (identity hardening): real `projects.id` for the active draft.
  // Tracked separately from `currentDraftId` (which is the draft id) to
  // purge the long-standing `projectId === templateId === draftId` aliasing
  // that fed BuilderIdentity at commit/deploy/AI-apply boundaries.
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const saveTemplate = useCallback(async (
    name: string,
    description: string,
    isPublic: boolean,
    code: string,
    payload?: SaveProjectPayload,
  ): Promise<string | null> => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Anonymous → local storage
      if (!user) {
        const localTemplates = getLocalTemplates();
        const newTemplate: SavedTemplate = {
          id: `local-${Date.now()}`,
          name,
          description: description || null,
          canvas_data: buildCanvasData(code, payload),
          is_public: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          thumbnail_url: null,
        };
        localTemplates.unshift(newTemplate);
        saveLocalTemplates(localTemplates);
        setCurrentDraftId(newTemplate.id);
        toast.success("Project saved locally!", {
          description: `"${name}" saved to browser storage`,
        });
        return newTemplate.id;
      }

      // Project name is the canonical identity. The user-supplied `name`
      // argument always wins over any stale metadata fallback (e.g. a wizard
      // "My Business" placeholder). Never fall back to a business name here.
      const trimmedName = (name || '').trim() || 'Untitled project';
      const forceNew = payload?.forceNew === true;
      // "Save as new" MUST NOT inherit the source project's id — otherwise the
      // DB trigger updates the same projects row instead of creating a copy.
      const effectiveProjectId = forceNew ? null : (payload?.projectId ?? null);
      const incomingMeta = identityMetadata(payload?.metadata);
      if (forceNew) {
        delete incomingMeta.projectId;
        delete (incomingMeta as Record<string, unknown>).project_id;
        delete (incomingMeta as Record<string, unknown>).linkedProjectId;
      }
      // Identity-only metadata. Canonical content (vfs_files, siteBundleSnapshot,
      // runtimeManifest, activePagePath) is never written here — commitMutation
      // is the only legal writer for that content, invoked below once identity
      // exists, so the schema's canonical-projection trigger never rejects
      // this write for diverging from a committed revision.
      const metadata: Record<string, unknown> = {
        ...incomingMeta,
        name: trimmedName,
        projectName: trimmedName,
        description: description || null,
        entryPoint: payload?.entryPoint,
        projectId: effectiveProjectId,
      };
      if (forceNew) {
        metadata.clonedFromDraftId = payload?.metadata && typeof payload.metadata === 'object'
          ? ((payload.metadata as Record<string, unknown>).sourceDraftId ?? null)
          : null;
        metadata.clonedAt = new Date().toISOString();
      }

      // If a draft already exists for this (user, business, project), update it instead of inserting.
      // This prevents `uq_builder_drafts_user_business*` collisions when users save multiple times
      // or rename a project — saving must always succeed and never lose state.
      // EXCEPTION: `forceNew` (Save as New) always inserts a fresh row.
      let existingDraftId: string | null = null;
      let existingRevisionId: string | null = null;
      let existingMetadata: Record<string, unknown> = {};
      if (!forceNew) {
        let lookup = supabase
          .from("builder_drafts")
          .select("id, last_revision_id, metadata")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1);

        if (payload?.projectId) {
          lookup = lookup.eq("project_id", payload.projectId);
        } else if (payload?.businessId) {
          lookup = lookup.eq("business_id", payload.businessId).is("project_id", null);
        } else {
          lookup = lookup.is("business_id", null).is("project_id", null);
        }

        const { data: existingRow, error: lookupError } = await lookup.maybeSingle();
        if (lookupError) throw lookupError;
        existingDraftId = existingRow?.id ?? null;
        existingRevisionId = (existingRow as { last_revision_id?: string | null } | null)?.last_revision_id ?? null;
        existingMetadata = (existingRow?.metadata || {}) as Record<string, unknown>;
      }

      let data: { id: string; project_id?: string | null; business_id?: string | null } | null = null;

      if (existingDraftId) {
        const updatePayload: Record<string, unknown> = {
          name: trimmedName,
          ...(code.trim() && !payload?.vfsFiles ? { code, editor_code: code } : {}),
          metadata: { ...existingMetadata, ...Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined)) } as unknown as Json,
          updated_at: new Date().toISOString(),
        };
        if (payload?.businessId !== undefined) updatePayload.business_id = payload.businessId;
        if (payload?.projectId !== undefined) updatePayload.project_id = payload.projectId;
        const { data: updated, error: updateError } = await executeDraftWrite<{ id: string; project_id?: string | null; business_id?: string | null }>(
          updatePayload,
          (p) => supabase
            .from("builder_drafts")
            .update(p)
            .eq("id", existingDraftId)
            .eq("user_id", user.id)
            .select("id, project_id, business_id")
            .single(),
        );
        if (updateError) throw updateError;
        data = updated as { id: string; project_id?: string | null; business_id?: string | null };
      } else {
        const insertPayload: Record<string, unknown> = {
          name: trimmedName,
          user_id: user.id,
          business_id: payload?.businessId ?? null,
          project_id: effectiveProjectId,
          code,
          editor_code: code,
          metadata: metadata as unknown as Json,
        };
        const { data: inserted, error: insertError } = await executeDraftWrite<{ id: string; project_id?: string | null; business_id?: string | null }>(
          insertPayload,
          (p) => supabase
            .from("builder_drafts")
            .insert(p)
            .select("id, project_id, business_id")
            .single(),
        );
        if (insertError) throw insertError;
        data = inserted as { id: string; project_id?: string | null; business_id?: string | null };
      }

      if (!data) throw new Error("Failed to persist draft");

      const resolvedBusinessId = data.business_id ?? payload?.businessId ?? null;
      const resolvedProjectId = data.project_id ?? payload?.projectId ?? null;

      if (payload?.vfsFiles) {
        await commitProjectContent({
          userId: user.id,
          draftId: data.id,
          businessId: resolvedBusinessId,
          projectId: resolvedProjectId,
          lastRevisionId: existingDraftId ? existingRevisionId : null,
          payload,
          summary: forceNew ? `Save "${trimmedName}" as new project` : `Save "${trimmedName}"`,
        });
      }

      await syncCanonicalComponentGraph({
        businessId: resolvedBusinessId,
        projectId: resolvedProjectId,
        draftId: data.id,
        canonicalPlayground: payload?.canonicalPlayground,
      });

      setCurrentDraftId(data.id);
      setCurrentProjectId(resolvedProjectId);
      emitCloudDraftSaved({
        draftId: data.id,
        projectId: resolvedProjectId,
        businessId: resolvedBusinessId,
      });
      toast.success("Project saved!", {
        description: `"${name}" has been saved successfully`,
      });
      return data.id;
    } catch (error) {
      console.error("Error saving project:", error);
      if (isTransientSaveError(error)) {
        toast.error("Network issue while saving", {
          description: "Check your connection and try Save again.",
        });
      } else if (error instanceof Error && error.message.includes('Canonical')) {
        toast.error("Project identity saved, but content could not be committed", {
          description: error.message,
        });
      } else {
        toast.error("Failed to save project");
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTemplate = useCallback(async (
    id: string,
    code: string,
    payload?: SaveProjectPayload,
  ): Promise<boolean> => {
    setLoading(true);
    try {
      if (id.startsWith("local-")) {
        const localTemplates = getLocalTemplates();
        const index = localTemplates.findIndex(t => t.id === id);
        if (index !== -1) {
          localTemplates[index] = {
            ...localTemplates[index],
            canvas_data: buildCanvasData(code, payload),
            updated_at: new Date().toISOString(),
          };
          saveLocalTemplates(localTemplates);
          toast.success("Project updated!");
          return true;
        }
        throw new Error("Project not found");
      }

      // Hardening: verify there is an active, authenticated session before
      // attempting a cloud write. Previously this call relied entirely on
      // RLS to reject unauthenticated/expired-session updates, which surfaced
      // as a confusing "Draft ... access or linkage is invalid" error with
      // no indication that the fix is simply signing in again.
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("SESSION_EXPIRED");
      }

      // Read existing identity so we can merge name/description and resolve
      // the parent revision commitProjectContent must chain from.
      const { data: existing, error: existingError } = await supabase
        .from("builder_drafts")
        .select("metadata, last_revision_id, project_id, business_id")
        .eq("id", id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing) throw new Error(`Draft ${id} access or linkage is invalid.`);

      const prevMeta = (existing?.metadata || {}) as Record<string, any>;
      const incomingMeta = identityMetadata(payload?.metadata);
      // Resolve canonical project name. Prefer incoming metadata.name (the
      // user-visible title), else preserve previous, else fallback.
      const resolvedName = (
        (typeof incomingMeta.name === 'string' && incomingMeta.name.trim()) ||
        (typeof incomingMeta.projectName === 'string' && incomingMeta.projectName.trim()) ||
        (typeof prevMeta.name === 'string' && prevMeta.name.trim()) ||
        (typeof prevMeta.projectName === 'string' && prevMeta.projectName.trim()) ||
        ''
      ).trim();

      // Identity-only metadata merge. Canonical content keys (siteBundleSnapshot,
      // runtimeManifest, activePagePath) are deliberately left untouched here —
      // commitProjectContent below is the only writer for those, so this row
      // never diverges from its last committed revision.
      const nextMeta = {
        ...prevMeta,
        ...(payload?.entryPoint ? { entryPoint: payload.entryPoint } : {}),
        ...(payload?.projectId !== undefined ? { projectId: payload.projectId } : {}),
        ...incomingMeta,
        ...(resolvedName ? { name: resolvedName, projectName: resolvedName } : {}),
      } as unknown as Json;

      const updatePatch: Record<string, unknown> = {
        ...(code.trim() && !payload?.vfsFiles ? { code, editor_code: code } : {}),
        metadata: nextMeta,
        updated_at: new Date().toISOString(),
      };
      if (resolvedName) {
        updatePatch.name = resolvedName;
      }
      if (payload?.businessId !== undefined) updatePatch.business_id = payload.businessId;
      if (payload?.projectId !== undefined) updatePatch.project_id = payload.projectId;

      // Hardening: retry on transient network errors, and drop business_id
      // if it turns out to reference a business row that no longer exists
      // (e.g. a stale/local preview id was persisted by an older bug) — a
      // save should never be blocked by a broken secondary linkage when the
      // code itself is safe to persist.
      const { data: updatedDraft, error: lastError } = await executeDraftWrite<{ id: string; project_id: string | null; business_id: string | null }>(
        updatePatch,
        (p) => supabase
          .from("builder_drafts")
          .update(p)
          .eq("id", id)
          .eq("user_id", user.id)
          .select("id, project_id, business_id")
          .maybeSingle(),
      );

      if (lastError) {
        throw lastError;
      }
      if (!updatedDraft) {
        throw new Error(`Draft ${id} was not updated; access or linkage is invalid.`);
      }
      const resolvedBusinessId = updatedDraft.business_id ?? payload?.businessId ?? null;
      const resolvedProjectId = updatedDraft.project_id ?? payload?.projectId ?? null;

      if (payload?.vfsFiles) {
        await commitProjectContent({
          userId: user.id,
          draftId: id,
          businessId: resolvedBusinessId,
          projectId: resolvedProjectId,
          lastRevisionId: (existing as { last_revision_id?: string | null } | null)?.last_revision_id ?? null,
          payload,
          summary: resolvedName ? `Update "${resolvedName}"` : 'Update project',
        });
      }

      setCurrentProjectId(resolvedProjectId);
      await syncCanonicalComponentGraph({
        businessId: resolvedBusinessId,
        projectId: resolvedProjectId,
        draftId: id,
        canonicalPlayground: payload?.canonicalPlayground,
      });
      emitCloudDraftSaved({
        draftId: id,
        projectId: resolvedProjectId,
        businessId: resolvedBusinessId,
      });
      if (!payload?.silent) toast.success("Project updated!");
      return true;
    } catch (error) {
      console.error("Error updating project:", error);
      if (payload?.silent) {
        return false;
      }
      if (error instanceof Error && error.message === "SESSION_EXPIRED") {
        toast.error("Your session has expired", {
          description: "Please sign in again, then click Update to save your changes.",
        });
      } else if (error instanceof Error && error.message.includes('access or linkage is invalid')) {
        toast.error("Couldn't reconnect to this project", {
          description: "Reload the page to relink your workspace, then try Update again.",
        });
      } else if (error instanceof Error && error.message.includes('Canonical')) {
        toast.error("Project identity updated, but content could not be committed", {
          description: error.message,
        });
      } else if (isTransientSaveError(error)) {
        toast.error("Network issue while saving", {
          description: "Check your connection and click Update to retry.",
        });
      } else {
        toast.error("Failed to update project");
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const ensureDraft = useCallback(async (
    name: string,
    description: string,
    code: string,
    payload?: SaveProjectPayload,
  ): Promise<string | null> => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return null;
    }

    const existingId = currentDraftId || await findBuilderDraftIdForProject({
      projectId: payload?.projectId ?? null,
      projectName: trimmedName,
      businessId: payload?.businessId ?? null,
    });

    if (existingId) {
      const didUpdate = await updateTemplate(existingId, code, payload);
      if (!didUpdate) {
        return null;
      }
      setCurrentDraftId(existingId);
      return existingId;
    }

    return saveTemplate(trimmedName, description, false, code, payload);
  }, [currentDraftId, saveTemplate, updateTemplate]);

  const loadTemplate = useCallback(async (id: string): Promise<SavedTemplate | null> => {
    setLoading(true);
    try {
      if (id.startsWith("local-")) {
        const localTemplates = getLocalTemplates();
        const template = localTemplates.find(t => t.id === id);
        if (template) {
          setCurrentDraftId(template.id);
          return template;
        }
        throw new Error("Project not found");
      }

      // Try builder_drafts first (canonical store)
      const { data: draftById, error: draftErr } = await supabase
        .from("builder_drafts")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (draftErr && draftErr.code !== "PGRST116") {
        // PGRST116 = no rows; anything else is a real error, but legacy/project lookup can still recover.
        console.warn("[useTemplateFiles] builder_drafts lookup error:", draftErr);
      }

      let draft = draftById;
      if (!draft) {
        const { data: draftByProject, error: projectLookupError } = await supabase
          .from("builder_drafts")
          .select("*")
          .eq("project_id", id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (projectLookupError && projectLookupError.code !== 'PGRST116') {
          console.warn('[useTemplateFiles] project-to-draft lookup error:', projectLookupError);
        }
        draft = draftByProject;
      }

      if (draft) {
        // Opening a saved project is read-only. Framework upgrades must use
        // commitMutation rather than rewriting draft source during hydration.
        const hydratedDraft = draft;
        setCurrentDraftId(draft.id);
        const draftProjectId =
          (hydratedDraft as { project_id?: string | null }).project_id ??
          ((hydratedDraft.metadata as Record<string, unknown> | null)?.projectId as
            | string
            | undefined) ??
          null;
        setCurrentProjectId(draftProjectId ?? null);
        return draftRowToTemplate(hydratedDraft);
      }

      // Legacy fallback: design_templates (read-only)
      const { data: legacy, error: legacyErr } = await supabase
        .from("design_templates")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (legacyErr && legacyErr.code !== "PGRST116") throw legacyErr;
      if (!legacy) {
        console.warn("[useTemplateFiles] project not found in canonical or legacy stores:", id);
        return null;
      }

      const template: SavedTemplate = {
        ...legacy,
        canvas_data: legacy.canvas_data as unknown as TemplateData,
      };
      setCurrentDraftId(template.id);
      return template;
    } catch (error) {
      console.error("Error loading project:", error);
      toast.error("Failed to load project");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    try {
      if (id.startsWith("local-")) {
        const localTemplates = getLocalTemplates();
        const filtered = localTemplates.filter(t => t.id !== id);
        saveLocalTemplates(filtered);
        toast.success("Project deleted");
        return true;
      }

      // Delete from whichever table holds it
      const { error: draftErr } = await supabase.from("builder_drafts").delete().eq("id", id);
      if (draftErr) {
        const { error: legacyErr } = await supabase.from("design_templates").delete().eq("id", id);
        if (legacyErr) throw legacyErr;
      }
      toast.success("Project deleted");
      return true;
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project");
      return false;
    }
  }, []);

  const clearCurrentTemplate = useCallback(() => {
    setCurrentDraftId(null);
    setCurrentProjectId(null);
  }, []);

  /** List all saved projects for the current user (builder_drafts + local). */
  const getAllTemplates = useCallback(async (): Promise<SavedTemplate[]> => {
    const localTemplates = getLocalTemplates();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return localTemplates;

      const { data, error } = await supabase
        .from("builder_drafts")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;

      const cloudTemplates = (data || []).map(draftRowToTemplate);
      return [...localTemplates, ...cloudTemplates];
    } catch (error) {
      console.error("Error fetching projects:", error);
      return localTemplates;
    }
  }, []);

  return {
    loading,
    currentDraftId,
    currentProjectId,
    saveTemplate,
    updateTemplate,
    ensureDraft,
    loadTemplate,
    deleteTemplate,
    clearCurrentTemplate,
    setCurrentDraftId,
    setCurrentProjectId,
    getAllTemplates,
    getLocalTemplates,
  };
}
