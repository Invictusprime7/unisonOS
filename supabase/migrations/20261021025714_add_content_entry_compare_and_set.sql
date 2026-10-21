CREATE OR REPLACE FUNCTION public.cms_apply_content_entry_command_versioned(
	p_action text,
	p_business_id uuid,
	p_actor_id uuid,
	p_entry_id uuid,
	p_content_type_id uuid,
	p_site_id uuid,
	p_locale text,
	p_slug text,
	p_title text,
	p_data jsonb,
	p_target_status text,
	p_change_summary text,
	p_expected_updated_at timestamptz
)
RETURNS public.content_entries
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
	current_updated_at timestamptz;
BEGIN
	IF p_action NOT IN ('update', 'transition') THEN
		RAISE EXCEPTION 'Versioned content command only supports update and transition';
	END IF;
	IF p_expected_updated_at IS NULL THEN
		RAISE EXCEPTION 'Versioned content command requires the observed updated_at value';
	END IF;

	SELECT entry.updated_at
		INTO current_updated_at
	FROM public.content_entries entry
	WHERE entry.id = p_entry_id
		AND entry.business_id = p_business_id
	FOR UPDATE;

	IF NOT FOUND THEN
		RAISE EXCEPTION 'CONTENT_ENTRY_NOT_FOUND';
	END IF;
	IF current_updated_at IS DISTINCT FROM p_expected_updated_at THEN
		RAISE EXCEPTION 'CONTENT_ENTRY_CONFLICT';
	END IF;

	RETURN public.cms_apply_content_entry_command(
		p_action,
		p_business_id,
		p_actor_id,
		p_entry_id,
		p_content_type_id,
		p_site_id,
		p_locale,
		p_slug,
		p_title,
		p_data,
		p_target_status,
		p_change_summary
	);
END;
$$;

REVOKE ALL ON FUNCTION public.cms_apply_content_entry_command_versioned(
	text, uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cms_apply_content_entry_command_versioned(
	text, uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb, text, text, timestamptz
) TO service_role;
