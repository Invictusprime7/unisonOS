-- Per-project GoHighLevel credentials. The API token lives in Vault; only its
-- Vault UUID and a one-way inbound webhook-secret digest live in this table.
CREATE TABLE IF NOT EXISTS public.project_integrations (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
	business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
	provider text NOT NULL DEFAULT 'gohighlevel' CHECK (provider = 'gohighlevel'),
	display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 120),
	external_location_id text NOT NULL CHECK (length(trim(external_location_id)) BETWEEN 1 AND 160),
	api_key_secret_id uuid NOT NULL REFERENCES vault.secrets(id) ON DELETE RESTRICT,
	webhook_secret_hash text NOT NULL UNIQUE CHECK (webhook_secret_hash ~ '^[0-9a-f]{64}$'),
	status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
	created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (project_id, provider, external_location_id),
	CONSTRAINT project_integrations_project_business_match
		CHECK (business_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_project_integrations_webhook_lookup
	ON public.project_integrations(provider, external_location_id, status);

ALTER TABLE public.project_integrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_integrations FROM anon, authenticated;
GRANT SELECT (
	id, project_id, business_id, provider, display_name, external_location_id, status, created_at, updated_at
) ON public.project_integrations TO authenticated;
GRANT ALL ON public.project_integrations TO service_role;

CREATE POLICY project_integrations_select_member
	ON public.project_integrations FOR SELECT TO authenticated
	USING (
		public.is_project_member(auth.uid(), project_id)
		AND EXISTS (
			SELECT 1 FROM public.projects p
			WHERE p.id = project_integrations.project_id
				AND p.business_id = project_integrations.business_id
		)
	);

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
	ON CONFLICT (project_id, provider, external_location_id)
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

CREATE OR REPLACE FUNCTION public.get_project_gohighlevel_api_key_internal(
	p_integration_id uuid,
	p_project_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT ds.decrypted_secret
	FROM public.project_integrations pi
	JOIN vault.decrypted_secrets ds ON ds.id = pi.api_key_secret_id
	JOIN public.projects p ON p.id = pi.project_id AND p.business_id = pi.business_id
	WHERE pi.id = p_integration_id
		AND pi.project_id = p_project_id
		AND pi.provider = 'gohighlevel'
		AND pi.status = 'active'
	LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_project_gohighlevel_api_key_internal(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_gohighlevel_api_key_internal(uuid, uuid) TO service_role;

ALTER TABLE public.ghl_webhook_events
	ADD COLUMN IF NOT EXISTS integration_id uuid
		REFERENCES public.project_integrations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ghl_webhook_events_integration_created
	ON public.ghl_webhook_events(integration_id, created_at DESC);
