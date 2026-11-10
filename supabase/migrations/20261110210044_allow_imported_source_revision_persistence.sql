-- Imported source revisions intentionally have no canonical Unison snapshot.
ALTER TABLE public.site_revisions
	ALTER COLUMN site_bundle_snapshot DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.stamp_revision_authorship_authority()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
	v_parent_launch_revision_id uuid;
	v_authority jsonb;
	v_meta jsonb;
BEGIN
	IF NEW.status <> 'committed' THEN
		NEW.authorship_phase := 'wizard-launch';
		NEW.creative_authority := 'wizard';
		NEW.launch_revision_id := NULL;
		RETURN NEW;
	END IF;

	IF NEW.readiness_report->>'acceptanceProfile' = 'imported-source' THEN
		NEW.authorship_phase := 'builder-authoring';
		NEW.creative_authority := 'builder';
		NEW.launch_revision_id := NULL;
		RETURN NEW;
	END IF;

	IF NEW.source = 'wizard-launch' THEN
		NEW.authorship_phase := 'builder-authoring';
		NEW.creative_authority := 'builder';
		NEW.launch_revision_id := NEW.id;
	ELSE
		IF NEW.parent_revision_id IS NOT NULL THEN
			SELECT COALESCE(parent.launch_revision_id,
				CASE WHEN parent.source = 'wizard-launch' THEN parent.id ELSE NULL END)
			INTO v_parent_launch_revision_id
			FROM public.site_revisions AS parent
			WHERE parent.id = NEW.parent_revision_id;
		END IF;
		NEW.authorship_phase := 'builder-authoring';
		NEW.creative_authority := 'builder';
		NEW.launch_revision_id := v_parent_launch_revision_id;
	END IF;

	v_authority := jsonb_build_object(
		'phase', NEW.authorship_phase,
		'creativeAuthority', NEW.creative_authority,
		'commitAuthority', 'vfs-commit-service'
	);
	IF NEW.launch_revision_id IS NOT NULL THEN
		v_authority := v_authority || jsonb_build_object('launchRevisionId', NEW.launch_revision_id::text);
	END IF;
	v_meta := COALESCE(NEW.site_bundle_snapshot->'meta', '{}'::jsonb)
		|| jsonb_build_object('authorshipAuthority', v_authority);
	NEW.site_bundle_snapshot := COALESCE(NEW.site_bundle_snapshot, '{}'::jsonb)
		|| jsonb_build_object('meta', v_meta);
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.stamp_site_revision_accepted_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
	IF NEW.status = 'committed'
		AND NEW.readiness_report->>'acceptanceProfile' = 'imported-source' THEN
		RETURN NEW;
	END IF;

	IF NEW.status = 'committed' THEN
		NEW.site_bundle_snapshot := COALESCE(NEW.site_bundle_snapshot, '{}'::jsonb)
			|| jsonb_build_object(
				'meta',
				COALESCE(NEW.site_bundle_snapshot->'meta', '{}'::jsonb)
					|| jsonb_build_object('acceptedRevisionId', NEW.id::text)
			);
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.commit_imported_source_revision_v1(
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
	v_base_vfs jsonb := '{}'::jsonb;
	v_parent_readiness jsonb;
	v_parent_snapshot jsonb;
	v_deleted_paths text[];
	v_candidate_vfs jsonb;
	v_provenance jsonb;
	v_provenance_text text;
	v_revision_id uuid;
BEGIN
	IF v_user_id IS NULL THEN
		RAISE EXCEPTION 'Authentication is required to commit an imported source revision'
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
		RAISE EXCEPTION 'Imported source draft identity is unavailable or unauthorized'
			USING ERRCODE = '42501';
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM public.projects AS project
		WHERE project.id = p_project_id
			AND project.business_id = p_business_id
			AND public.is_project_member(v_user_id, project.id)
	) THEN
		RAISE EXCEPTION 'Imported source project identity is unavailable or unauthorized'
			USING ERRCODE = '42501';
	END IF;

	IF v_draft_metadata->>'source' IS DISTINCT FROM 'external-import'
		OR v_draft_metadata->>'acceptanceProfile' IS DISTINCT FROM 'imported-source'
		OR p_readiness_report->>'acceptanceProfile' IS DISTINCT FROM 'imported-source'
		OR COALESCE(p_publish_ready, false) THEN
		RAISE EXCEPTION 'Imported source acceptance profile is invalid'
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
		RAISE EXCEPTION 'Imported source VFS delta is malformed'
			USING ERRCODE = '23514';
	END IF;

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

	IF v_current_revision_id IS DISTINCT FROM p_parent_revision_id THEN
		RAISE EXCEPTION 'Imported source revision conflict: draft pointer changed before commit'
			USING ERRCODE = '40001';
	END IF;

	IF p_parent_revision_id IS NOT NULL THEN
		SELECT revision.vfs_files, revision.readiness_report, revision.site_bundle_snapshot
		INTO v_base_vfs, v_parent_readiness, v_parent_snapshot
		FROM public.site_revisions AS revision
		WHERE revision.id = p_parent_revision_id
			AND revision.project_id = p_project_id
			AND revision.business_id = p_business_id
			AND revision.draft_id = p_draft_id
			AND revision.status = 'committed';

		IF NOT FOUND
			OR v_parent_readiness->>'acceptanceProfile' IS DISTINCT FROM 'imported-source'
			OR v_parent_snapshot IS NOT NULL THEN
			RAISE EXCEPTION 'Imported source parent revision is unavailable or incompatible'
				USING ERRCODE = '40001';
		END IF;

		IF EXISTS (
			SELECT 1 FROM jsonb_object_keys(v_delta->'files') AS item(path)
			WHERE item.path LIKE '/.unison-import/%'
		) OR EXISTS (
			SELECT 1 FROM jsonb_array_elements_text(v_delta->'deletedPaths') AS item(path)
			WHERE item.path LIKE '/.unison-import/%'
		) THEN
			RAISE EXCEPTION 'Imported source records are read-only'
				USING ERRCODE = '23514';
		END IF;
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
		RAISE EXCEPTION 'Imported source VFS must contain only text file contents'
			USING ERRCODE = '23514';
	END IF;

	v_provenance_text := v_candidate_vfs->>'/.unison-import/provenance.json';
	IF v_provenance_text IS NULL
		OR v_candidate_vfs->>'/.unison-import/manifest.json' IS NULL
		OR v_candidate_vfs->>'/.unison-import/compatibility.json' IS NULL
		OR v_candidate_vfs->>'/.unison-import/assets.json' IS NULL THEN
		RAISE EXCEPTION 'Imported source provenance records are missing'
			USING ERRCODE = '23514';
	END IF;

	BEGIN
		v_provenance := v_provenance_text::jsonb;
	EXCEPTION WHEN others THEN
		RAISE EXCEPTION 'Imported source provenance record is malformed'
			USING ERRCODE = '23514';
	END;

	IF v_provenance->>'origin' IS DISTINCT FROM 'external-import'
		OR v_provenance->>'acceptanceProfile' IS DISTINCT FROM 'imported-source' THEN
		RAISE EXCEPTION 'Imported source provenance identity is invalid'
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
			metadata = COALESCE(metadata, '{}'::jsonb)
				|| jsonb_build_object('importReadiness', COALESCE(p_readiness_report, '{}'::jsonb)),
			updated_at = now()
	WHERE id = p_draft_id;

	RETURN v_revision_id;
END;
$$;

REVOKE ALL ON FUNCTION public.commit_imported_source_revision_v1(
	uuid, uuid, uuid, uuid, text, jsonb, jsonb, jsonb, jsonb,
	jsonb, jsonb, boolean, jsonb, jsonb, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.commit_imported_source_revision_v1(
	uuid, uuid, uuid, uuid, text, jsonb, jsonb, jsonb, jsonb,
	jsonb, jsonb, boolean, jsonb, jsonb, text
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.stamp_revision_authorship_authority() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stamp_site_revision_accepted_id() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
