-- Avoid PL/pgSQL ambiguity between the RETURNS TABLE project_id variable and
-- the project_integrations.project_id column in the conflict target.
CREATE OR REPLACE FUNCTION public.save_project_gohighlevel_integration(
	p_project_id uuid,
	p_display_name text,
	p_location_id text,
	p_api_key text,
	p_webhook_secret_hash text
)
RETURNS TABLE (
	integration_id uuid,
	project_id uuid,
	business_id uuid,
	external_location_id text,
	status text,
	updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	v_user_id uuid := auth.uid();
	v_business_id uuid;
	v_owner_id uuid;
	v_integration_id uuid;
	v_api_key_secret_id uuid;
	v_secret_name text;
	v_display_name text := pg_catalog.btrim(p_display_name);
	v_location_id text := pg_catalog.btrim(p_location_id);
BEGIN
	IF v_user_id IS NULL THEN
		RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
	END IF;
	IF v_location_id IS NULL OR pg_catalog.length(v_location_id) NOT BETWEEN 1 AND 160 THEN
		RAISE EXCEPTION 'A valid GoHighLevel location ID is required' USING ERRCODE = '22023';
	END IF;
	IF v_display_name IS NULL OR pg_catalog.length(v_display_name) NOT BETWEEN 1 AND 120 THEN
		RAISE EXCEPTION 'A readable integration name is required' USING ERRCODE = '22023';
	END IF;
	IF p_api_key IS NULL OR pg_catalog.length(pg_catalog.btrim(p_api_key)) < 16 THEN
		RAISE EXCEPTION 'A valid GoHighLevel private integration token is required' USING ERRCODE = '22023';
	END IF;
	IF p_webhook_secret_hash IS NULL OR p_webhook_secret_hash !~ '^[0-9a-f]{64}$' THEN
		RAISE EXCEPTION 'A valid webhook secret digest is required' USING ERRCODE = '22023';
	END IF;

	SELECT p.business_id, p.owner_id
		INTO v_business_id, v_owner_id
	FROM public.projects p
	WHERE p.id = p_project_id;
	IF NOT FOUND OR v_business_id IS NULL THEN
		RAISE EXCEPTION 'Project is missing or has no business profile' USING ERRCODE = 'P0002';
	END IF;
	IF v_owner_id <> v_user_id AND NOT EXISTS (
		SELECT 1 FROM public.project_members pm
		WHERE pm.project_id = p_project_id
			AND pm.user_id = v_user_id
			AND pm.role = 'owner'
	) THEN
		RAISE EXCEPTION 'Only project owners can manage integrations' USING ERRCODE = '42501';
	END IF;

	PERFORM pg_catalog.pg_advisory_xact_lock(
		pg_catalog.hashtextextended(p_project_id::text || ':gohighlevel:' || v_location_id, 0)
	);

	SELECT pi.id, pi.api_key_secret_id
		INTO v_integration_id, v_api_key_secret_id
	FROM public.project_integrations pi
	WHERE pi.project_id = p_project_id
		AND pi.provider = 'gohighlevel'
		AND pi.external_location_id = v_location_id
	FOR UPDATE;

	v_secret_name := 'ghl-' || p_project_id::text || '-' || pg_catalog.md5(v_location_id);
	IF v_api_key_secret_id IS NULL THEN
		v_api_key_secret_id := vault.create_secret(
			p_api_key,
			v_secret_name,
			'GoHighLevel API token for a project integration'
		);
	ELSE
		PERFORM vault.update_secret(
			v_api_key_secret_id,
			p_api_key,
			v_secret_name,
			'GoHighLevel API token for a project integration'
		);
	END IF;

	INSERT INTO public.project_integrations (
		project_id, business_id, provider, display_name, external_location_id,
		api_key_secret_id, webhook_secret_hash, status, created_by, updated_at
	) VALUES (
		p_project_id, v_business_id, 'gohighlevel', v_display_name, v_location_id,
		v_api_key_secret_id, p_webhook_secret_hash, 'active', v_user_id, now()
	)
	ON CONFLICT ON CONSTRAINT project_integrations_project_id_provider_external_location__key
	DO UPDATE SET
		display_name = EXCLUDED.display_name,
		api_key_secret_id = EXCLUDED.api_key_secret_id,
		webhook_secret_hash = EXCLUDED.webhook_secret_hash,
		status = 'active',
		updated_at = now()
	RETURNING id INTO v_integration_id;

	RETURN QUERY
	SELECT pi.id, pi.project_id, pi.business_id, pi.external_location_id, pi.status, pi.updated_at
	FROM public.project_integrations pi
	WHERE pi.id = v_integration_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_project_gohighlevel_integration(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_project_gohighlevel_integration(uuid, text, text, text, text) TO authenticated;
