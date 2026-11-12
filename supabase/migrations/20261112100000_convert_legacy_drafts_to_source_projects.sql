-- Convert on open: a site built by the older Unison pipeline becomes a source
-- project. Its exact preview files are saved as a new revision whose parent is
-- the site's last Unison revision (history kept), and the draft is re-labelled
-- as an Affinity-written source project. Every later save uses
-- commit_imported_source_revision_v1. Protections match that function: owner
-- check, draft pointer consistency, text-only files, provenance records,
-- publish_ready = false at save time.

CREATE OR REPLACE FUNCTION public.convert_draft_to_source_project_v1(
	p_project_id uuid,
	p_business_id uuid,
	p_draft_id uuid,
	p_parent_revision_id uuid,
	p_source text,
	p_patch_json jsonb,
	p_vfs_files jsonb,
	p_runtime_manifest jsonb,
	p_playground_state jsonb,
	p_readiness_report jsonb,
	p_diagnostics jsonb,
	p_publish_ready boolean,
	p_publish_blockers jsonb,
	p_backend_ops_applied jsonb,
	p_vfs_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '45s'
AS $$
DECLARE
	v_user_id uuid := auth.uid();
	v_current_revision_id uuid;
	v_draft_metadata jsonb;
	v_delta jsonb := p_patch_json->'_commitMetadata'->'vfsDelta';
	v_base_vfs jsonb;
	v_parent_readiness jsonb;
	v_deleted_paths text[];
	v_candidate_vfs jsonb;
	v_provenance jsonb;
	v_provenance_text text;
	v_revision_id uuid;
BEGIN
	IF v_user_id IS NULL THEN
		RAISE EXCEPTION 'Authentication is required to convert a project'
			USING ERRCODE = '42501';
	END IF;

	SELECT draft.last_revision_id, draft.metadata
	INTO v_current_revision_id, v_draft_metadata
	FROM public.builder_drafts AS draft
	WHERE draft.id = p_draft_id
		AND draft.project_id = p_project_id
		AND draft.business_id = p_business_id
		AND draft.user_id = v_user_id
	FOR UPDATE;

	IF NOT FOUND THEN
		RAISE EXCEPTION 'Project draft identity is unavailable or unauthorized'
			USING ERRCODE = '42501';
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM public.projects AS project
		WHERE project.id = p_project_id
			AND project.business_id = p_business_id
			AND public.is_project_member(v_user_id, project.id)
	) THEN
		RAISE EXCEPTION 'Project identity is unavailable or unauthorized'
			USING ERRCODE = '42501';
	END IF;

	IF p_source IS DISTINCT FROM 'system-restore'
		OR p_readiness_report->>'acceptanceProfile' IS DISTINCT FROM 'imported-source'
		OR COALESCE(p_publish_ready, false) THEN
		RAISE EXCEPTION 'Project conversion acceptance profile is invalid'
			USING ERRCODE = '23514';
	END IF;

	IF jsonb_typeof(p_vfs_files) <> 'object'
		OR jsonb_typeof(v_delta) <> 'object'
		OR jsonb_typeof(v_delta->'files') <> 'object'
		OR jsonb_typeof(v_delta->'deletedPaths') <> 'array'
		OR v_delta->'files' IS DISTINCT FROM p_vfs_files
		OR EXISTS (
			SELECT 1
			FROM jsonb_array_elements(v_delta->'deletedPaths') AS item(value)
			WHERE jsonb_typeof(item.value) <> 'string'
		) THEN
		RAISE EXCEPTION 'Project conversion VFS delta is malformed'
			USING ERRCODE = '23514';
	END IF;

	-- Idempotent retry: the same conversion already committed.
	IF p_vfs_hash IS NOT NULL THEN
		SELECT revision.id
		INTO v_revision_id
		FROM public.site_revisions AS revision
		WHERE revision.project_id = p_project_id
			AND revision.business_id = p_business_id
			AND revision.draft_id = p_draft_id
			AND revision.status = 'committed'
			AND revision.vfs_hash = p_vfs_hash
			AND revision.parent_revision_id IS NOT DISTINCT FROM p_parent_revision_id
			AND revision.readiness_report->>'acceptanceProfile' = 'imported-source'
		ORDER BY revision.created_at DESC
		LIMIT 1;

		IF FOUND THEN
			RETURN v_revision_id;
		END IF;
	END IF;

	-- Only sites still on the older pipeline convert; source projects never re-convert.
	IF COALESCE(v_draft_metadata->>'source', '') IN ('external-import', 'affinity-authored')
		OR v_draft_metadata->>'acceptanceProfile' = 'imported-source' THEN
		RAISE EXCEPTION 'This project is already a source project'
			USING ERRCODE = '23514';
	END IF;

	IF p_parent_revision_id IS NULL OR v_current_revision_id IS DISTINCT FROM p_parent_revision_id THEN
		RAISE EXCEPTION 'Project conversion conflict: draft pointer changed before commit'
			USING ERRCODE = '40001';
	END IF;

	SELECT revision.vfs_files, revision.readiness_report
	INTO v_base_vfs, v_parent_readiness
	FROM public.site_revisions AS revision
	WHERE revision.id = p_parent_revision_id
		AND revision.project_id = p_project_id
		AND revision.business_id = p_business_id
		AND revision.draft_id = p_draft_id
		AND revision.status = 'committed';

	IF NOT FOUND OR v_parent_readiness->>'acceptanceProfile' = 'imported-source' THEN
		RAISE EXCEPTION 'Project conversion parent revision is unavailable or already converted'
			USING ERRCODE = '40001';
	END IF;

	SELECT COALESCE(array_agg(item.value #>> '{}'), ARRAY[]::text[])
	INTO v_deleted_paths
	FROM jsonb_array_elements(v_delta->'deletedPaths') AS item(value);
	v_candidate_vfs := (COALESCE(v_base_vfs, '{}'::jsonb) - v_deleted_paths) || (v_delta->'files');

	IF jsonb_typeof(v_candidate_vfs) <> 'object'
		OR EXISTS (
			SELECT 1 FROM jsonb_each(v_candidate_vfs) AS item(path, content)
			WHERE jsonb_typeof(item.content) <> 'string'
		) THEN
		RAISE EXCEPTION 'Source project VFS must contain only text file contents'
			USING ERRCODE = '23514';
	END IF;

	v_provenance_text := v_candidate_vfs->>'/.unison-import/provenance.json';
	IF v_provenance_text IS NULL
		OR v_candidate_vfs->>'/.unison-import/manifest.json' IS NULL
		OR v_candidate_vfs->>'/.unison-import/compatibility.json' IS NULL
		OR v_candidate_vfs->>'/.unison-import/assets.json' IS NULL THEN
		RAISE EXCEPTION 'Source project provenance records are missing'
			USING ERRCODE = '23514';
	END IF;

	BEGIN
		v_provenance := v_provenance_text::jsonb;
	EXCEPTION WHEN others THEN
		RAISE EXCEPTION 'Source project provenance record is malformed'
			USING ERRCODE = '23514';
	END;

	IF v_provenance->>'origin' IS DISTINCT FROM 'affinity-authored'
		OR v_provenance->>'acceptanceProfile' IS DISTINCT FROM 'imported-source'
		OR v_provenance->>'convertedFromRevisionId' IS DISTINCT FROM p_parent_revision_id::text THEN
		RAISE EXCEPTION 'Source project conversion provenance is invalid'
			USING ERRCODE = '23514';
	END IF;

	INSERT INTO public.site_revisions (
		project_id, business_id, draft_id, parent_revision_id, source, status,
		patch_json, vfs_files, site_bundle_snapshot, runtime_manifest,
		playground_state, readiness_report, diagnostics, publish_ready,
		publish_blockers, backend_ops_applied, vfs_hash, created_by
	) VALUES (
		p_project_id, p_business_id, p_draft_id, p_parent_revision_id, p_source, 'committed',
		COALESCE(p_patch_json, '{}'::jsonb), v_candidate_vfs, NULL,
		COALESCE(p_runtime_manifest, '{}'::jsonb), COALESCE(p_playground_state, '{}'::jsonb),
		COALESCE(p_readiness_report, '{}'::jsonb), COALESCE(p_diagnostics, '[]'::jsonb),
		false, COALESCE(p_publish_blockers, '[]'::jsonb),
		COALESCE(p_backend_ops_applied, '[]'::jsonb), p_vfs_hash, v_user_id
	)
	RETURNING id INTO v_revision_id;

	UPDATE public.builder_drafts
	SET last_revision_id = v_revision_id,
			vfs_files = v_candidate_vfs,
			metadata = (COALESCE(metadata, '{}'::jsonb) - 'siteBundleSnapshot' - 'runtimeManifest' - 'activePagePath')
				|| jsonb_build_object(
					'source', 'affinity-authored',
					'acceptanceProfile', 'imported-source',
					'convertedFromSource', COALESCE(v_draft_metadata->>'source', 'unison'),
					'convertedFromRevisionId', p_parent_revision_id,
					'importReadiness', COALESCE(p_readiness_report, '{}'::jsonb)
				),
			updated_at = now()
	WHERE id = p_draft_id;

	RETURN v_revision_id;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_draft_to_source_project_v1(
	uuid, uuid, uuid, uuid, text, jsonb, jsonb, jsonb, jsonb,
	jsonb, jsonb, boolean, jsonb, jsonb, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.convert_draft_to_source_project_v1(
	uuid, uuid, uuid, uuid, text, jsonb, jsonb, jsonb, jsonb,
	jsonb, jsonb, boolean, jsonb, jsonb, text
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
