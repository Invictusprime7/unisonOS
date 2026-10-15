-- Correct the resolver migration if a disconnected binding was deployed with
-- the earlier active-binding filter. Existing dedicated state must never
-- silently resolve to shared storage.

CREATE OR REPLACE FUNCTION public.resolve_project_backend(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	v_user_id uuid := auth.uid();
	v_project record;
	v_site record;
	v_binding record;
	v_status text;
BEGIN
	IF p_project_id IS NULL THEN
		RAISE EXCEPTION 'A project is required' USING ERRCODE = '22023';
	END IF;
	IF v_user_id IS NULL OR NOT public.is_project_member(v_user_id, p_project_id) THEN
		RAISE EXCEPTION 'Project access denied' USING ERRCODE = '42501';
	END IF;

	SELECT p.id, p.business_id, p.site_id
	INTO v_project
	FROM public.projects AS p
	WHERE p.id = p_project_id;
	IF NOT FOUND THEN
		RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
	END IF;

	IF v_project.site_id IS NOT NULL THEN
		SELECT s.id, s.business_id
		INTO v_site
		FROM public.sites AS s
		WHERE s.id = v_project.site_id;
		IF NOT FOUND OR v_site.business_id IS DISTINCT FROM v_project.business_id THEN
			RAISE EXCEPTION 'Project site identity is invalid' USING ERRCODE = '23514';
		END IF;
	END IF;

	SELECT b.id, b.business_id, b.unison_project_id, b.project_url, b.schema_version, b.provisioning_status
	INTO v_binding
	FROM public.connected_supabase_projects AS b
	WHERE b.unison_project_id = p_project_id
	ORDER BY b.updated_at DESC
	LIMIT 1;

	IF FOUND THEN
		IF v_binding.business_id IS DISTINCT FROM v_project.business_id
			OR v_binding.unison_project_id IS DISTINCT FROM v_project.id THEN
			RAISE EXCEPTION 'Backend binding does not match project identity' USING ERRCODE = '23514';
		END IF;

		v_status := CASE
			WHEN v_binding.provisioning_status = 'ready' AND v_project.site_id IS NOT NULL THEN 'ready'
			WHEN v_binding.provisioning_status IN ('failed', 'disconnected') THEN 'failed'
			ELSE 'provisioning'
		END;

		RETURN jsonb_build_object(
			'bindingId', v_binding.id::text,
			'projectId', v_project.id::text,
			'siteId', v_project.site_id::text,
			'mode', 'dedicated',
			'provider', 'supabase',
			'status', v_status,
			'projectUrl', CASE WHEN v_status = 'ready' THEN v_binding.project_url ELSE NULL END,
			'publishableKey', NULL
		);
	END IF;

	RETURN jsonb_build_object(
		'bindingId', 'shared:' || v_project.id::text,
		'projectId', v_project.id::text,
		'siteId', v_project.site_id::text,
		'mode', 'shared-legacy',
		'provider', 'supabase',
		'status', 'ready'
	);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_project_backend(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_project_backend(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_published_site_backend(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	v_project record;
	v_binding record;
BEGIN
	IF p_project_id IS NULL THEN
		RAISE EXCEPTION 'A project is required' USING ERRCODE = '22023';
	END IF;

	SELECT p.id, p.business_id, p.site_id
	INTO v_project
	FROM public.projects AS p
	JOIN public.sites AS s
		ON s.id = p.site_id
	 AND s.business_id = p.business_id
	WHERE p.id = p_project_id
		AND p.publish_status = 'published'
		AND s.status IN ('preview', 'published');
	IF NOT FOUND THEN
		RAISE EXCEPTION 'Published site is unavailable' USING ERRCODE = 'P0002';
	END IF;

	SELECT b.id, b.provisioning_status
	INTO v_binding
	FROM public.connected_supabase_projects AS b
	WHERE b.unison_project_id = p_project_id
	ORDER BY b.updated_at DESC
	LIMIT 1;
	IF FOUND THEN
		IF v_binding.provisioning_status = 'disconnected' THEN
			RAISE EXCEPTION 'Dedicated site backend is disconnected' USING ERRCODE = '0A000';
		END IF;
		RAISE EXCEPTION 'Dedicated public reads are not available yet' USING ERRCODE = '0A000';
	END IF;

	RETURN jsonb_build_object(
		'projectId', v_project.id::text,
		'siteId', v_project.site_id::text,
		'mode', 'shared-legacy',
		'status', 'ready',
		'projectUrl', NULL,
		'publishableKey', NULL
	);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_published_site_backend(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_published_site_backend(uuid) TO anon, authenticated;
