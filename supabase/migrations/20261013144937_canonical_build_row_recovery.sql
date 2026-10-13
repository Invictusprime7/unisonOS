-- A draft can retain siteBuildId after its build row has been removed. Restore
-- that parent row before the canonical writer inserts a bundle that references it.
CREATE OR REPLACE FUNCTION public.commit_canonical_site_revision_v2(
	p_project_id uuid,
	p_business_id uuid,
	p_draft_id uuid,
	p_parent_revision_id uuid,
	p_source text,
	p_status text,
	p_patch_json jsonb,
	p_vfs_files jsonb,
	p_site_bundle_snapshot jsonb,
	p_runtime_manifest jsonb,
	p_playground_state jsonb,
	p_readiness_report jsonb,
	p_diagnostics jsonb,
	p_publish_ready boolean,
	p_publish_blockers jsonb,
	p_backend_ops_applied jsonb,
	p_vfs_hash text,
	p_active_page_path text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '45s'
AS $$
DECLARE
	v_user_id uuid := auth.uid();
	v_site_id uuid;
	v_build_id uuid;
	v_metadata jsonb;
	v_existing_site_id uuid;
BEGIN
	IF v_user_id IS NULL THEN
		RAISE EXCEPTION 'Authentication is required to commit a canonical revision'
			USING ERRCODE = '42501';
	END IF;

	SELECT draft.site_id, draft.metadata
	INTO v_site_id, v_metadata
	FROM public.builder_drafts AS draft
	WHERE draft.id = p_draft_id
		AND draft.project_id = p_project_id
		AND draft.business_id = p_business_id
		AND draft.user_id = v_user_id
	FOR UPDATE;

	IF NOT FOUND THEN
		RAISE EXCEPTION 'Canonical draft identity is unavailable or unauthorized'
			USING ERRCODE = '42501';
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM public.projects AS project
		WHERE project.id = p_project_id
			AND project.business_id = p_business_id
			AND public.is_project_member(v_user_id, project.id)
	) THEN
		RAISE EXCEPTION 'Canonical project identity is unavailable or unauthorized'
			USING ERRCODE = '42501';
	END IF;

	IF p_status = 'committed'
		AND v_site_id IS NOT NULL
		AND COALESCE(v_metadata->>'siteBuildId', '') ~*
			'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
		AND COALESCE(v_metadata->>'siteBundleId', '') ~*
			'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
		v_build_id := (v_metadata->>'siteBuildId')::uuid;

		SELECT build.site_id
		INTO v_existing_site_id
		FROM public.site_builds AS build
		WHERE build.id = v_build_id;

		IF FOUND AND v_existing_site_id IS DISTINCT FROM v_site_id THEN
			RAISE EXCEPTION 'Canonical build identity belongs to a different site'
				USING ERRCODE = '23514';
		ELSIF NOT FOUND THEN
			INSERT INTO public.site_builds (
				id,
				site_id,
				mode,
				status,
				current_stage,
				context
			) VALUES (
				v_build_id,
				v_site_id,
				'incremental',
				'running',
				'canonical-commit',
				jsonb_build_object('source', 'canonical-revision-recovery')
			)
			ON CONFLICT (id) DO NOTHING;

			SELECT build.site_id
			INTO v_existing_site_id
			FROM public.site_builds AS build
			WHERE build.id = v_build_id;

			IF NOT FOUND OR v_existing_site_id IS DISTINCT FROM v_site_id THEN
				RAISE EXCEPTION 'Canonical build identity could not be restored for this site'
					USING ERRCODE = '23514';
			END IF;
		END IF;
	END IF;

	RETURN public.commit_canonical_site_revision_v2_full(
		p_project_id,
		p_business_id,
		p_draft_id,
		p_parent_revision_id,
		p_source,
		p_status,
		p_patch_json,
		p_vfs_files,
		p_site_bundle_snapshot,
		p_runtime_manifest,
		p_playground_state,
		p_readiness_report,
		p_diagnostics,
		p_publish_ready,
		p_publish_blockers,
		p_backend_ops_applied,
		p_vfs_hash,
		p_active_page_path
	);
END;
$$;

REVOKE ALL ON FUNCTION public.commit_canonical_site_revision_v2(
	uuid, uuid, uuid, uuid, text, text,
	jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb,
	boolean, jsonb, jsonb, text, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.commit_canonical_site_revision_v2(
	uuid, uuid, uuid, uuid, text, text,
	jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb,
	boolean, jsonb, jsonb, text, text
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
