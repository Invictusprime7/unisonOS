CREATE OR REPLACE FUNCTION public.resolve_published_site_backend(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
	v_project record;
	v_binding record;
	v_status text;
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
		v_status := CASE
			WHEN v_binding.provisioning_status = 'failed' THEN 'failed'
			WHEN v_binding.provisioning_status = 'ready' AND v_project.site_id IS NOT NULL THEN 'ready'
			ELSE 'provisioning'
		END;
		RETURN jsonb_build_object(
			'projectId', v_project.id::text,
			'siteId', v_project.site_id::text,
			'mode', 'dedicated',
			'status', v_status,
			'projectUrl', NULL,
			'publishableKey', NULL
		);
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
$function$;

REVOKE ALL ON FUNCTION public.resolve_published_site_backend(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_published_site_backend(uuid) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.resolve_published_site_backend(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
	v_project record;
	v_binding record;
	v_status text;
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
		v_status := CASE
			WHEN v_binding.provisioning_status = 'failed' THEN 'failed'
			WHEN v_binding.provisioning_status = 'ready' AND v_project.site_id IS NOT NULL THEN 'ready'
			ELSE 'provisioning'
		END;
		RETURN jsonb_build_object(
			'projectId', v_project.id::text,
			'siteId', v_project.site_id::text,
			'mode', 'dedicated',
			'status', v_status,
			'projectUrl', NULL,
			'publishableKey', NULL
		);
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
$function$;

REVOKE ALL ON FUNCTION public.resolve_published_site_backend(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_published_site_backend(uuid) TO anon, authenticated, service_role;
