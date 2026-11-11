-- UIMP-01 Phase E/G: verification records for imported-source revisions.
-- A passing, owner-confirmed check of an imported revision's exact saved
-- bytes marks that same revision publish-ready. The recorded artifact hash is
-- what publish-site requires the deployed files to match.

CREATE TABLE IF NOT EXISTS public.imported_source_verifications (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
	revision_id uuid NOT NULL REFERENCES public.site_revisions(id) ON DELETE CASCADE,
	vfs_hash text NOT NULL,
	adapter text NOT NULL,
	adapter_version text NOT NULL,
	artifact_hash text NOT NULL,
	status text NOT NULL CHECK (status IN ('passed', 'failed')),
	routes jsonb NOT NULL DEFAULT '[]'::jsonb,
	checks jsonb NOT NULL DEFAULT '{}'::jsonb,
	owner_confirmed boolean NOT NULL DEFAULT false,
	created_by uuid NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.imported_source_verifications TO authenticated;
GRANT ALL ON public.imported_source_verifications TO service_role;

ALTER TABLE public.imported_source_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members read imported source verifications"
	ON public.imported_source_verifications
	FOR SELECT TO authenticated
	USING (public.is_project_member(auth.uid(), project_id));

CREATE INDEX IF NOT EXISTS imported_source_verifications_revision_idx
	ON public.imported_source_verifications (revision_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.record_imported_source_verification(
	p_project_id uuid,
	p_revision_id uuid,
	p_vfs_hash text,
	p_adapter text,
	p_adapter_version text,
	p_artifact_hash text,
	p_status text,
	p_routes jsonb,
	p_checks jsonb,
	p_owner_confirmed boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	v_user_id uuid := auth.uid();
	v_revision public.site_revisions%ROWTYPE;
	v_id uuid;
	v_ready boolean := false;
BEGIN
	IF v_user_id IS NULL OR NOT public.is_project_member(v_user_id, p_project_id) THEN
		RAISE EXCEPTION 'Not allowed to verify this project' USING ERRCODE = '42501';
	END IF;

	SELECT * INTO v_revision
	FROM public.site_revisions
	WHERE id = p_revision_id AND project_id = p_project_id
	FOR UPDATE;

	IF NOT FOUND OR v_revision.status <> 'committed'
		OR v_revision.readiness_report->>'acceptanceProfile' IS DISTINCT FROM 'imported-source' THEN
		RAISE EXCEPTION 'Only saved imported-source versions can be verified' USING ERRCODE = '23514';
	END IF;
	IF v_revision.vfs_hash IS NULL OR v_revision.vfs_hash IS DISTINCT FROM p_vfs_hash THEN
		RAISE EXCEPTION 'The checked files do not match this saved version' USING ERRCODE = '23514';
	END IF;
	IF p_status NOT IN ('passed', 'failed')
		OR p_adapter NOT IN ('static-html-v1', 'browser-source-build-v1')
		OR p_artifact_hash !~ '^[0-9a-f]{64}$'
		OR jsonb_typeof(COALESCE(p_routes, '[]'::jsonb)) <> 'array'
		OR jsonb_array_length(COALESCE(p_routes, '[]'::jsonb)) = 0
		OR jsonb_typeof(COALESCE(p_checks, '{}'::jsonb)) <> 'object' THEN
		RAISE EXCEPTION 'Verification record is malformed' USING ERRCODE = '22023';
	END IF;

	INSERT INTO public.imported_source_verifications (
		project_id, revision_id, vfs_hash, adapter, adapter_version, artifact_hash,
		status, routes, checks, owner_confirmed, created_by
	) VALUES (
		p_project_id, p_revision_id, p_vfs_hash, p_adapter, left(COALESCE(p_adapter_version, ''), 80), p_artifact_hash,
		p_status, p_routes, COALESCE(p_checks, '{}'::jsonb), COALESCE(p_owner_confirmed, false), v_user_id
	)
	RETURNING id INTO v_id;

	-- The same saved revision becomes publishable; its bytes are never touched.
	v_ready := p_status = 'passed' AND COALESCE(p_owner_confirmed, false);
	UPDATE public.site_revisions SET publish_ready = v_ready WHERE id = p_revision_id;

	RETURN jsonb_build_object('verification_id', v_id, 'publish_ready', v_ready);
END;
$$;

REVOKE ALL ON FUNCTION public.record_imported_source_verification(uuid, uuid, text, text, text, text, text, jsonb, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_imported_source_verification(uuid, uuid, text, text, text, text, text, jsonb, jsonb, boolean) TO authenticated;
