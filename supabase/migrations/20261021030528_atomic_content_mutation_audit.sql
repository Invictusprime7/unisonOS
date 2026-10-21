CREATE OR REPLACE FUNCTION public.cms_apply_content_entry_command_audited(
	p_action text,
	p_business_id uuid,
	p_project_id uuid,
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
	entry_row public.content_entries%ROWTYPE;
	audit_action text;
BEGIN
	IF p_action = 'create' THEN
		entry_row := public.cms_apply_content_entry_command(
			p_action, p_business_id, p_actor_id, p_entry_id, p_content_type_id,
			p_site_id, p_locale, p_slug, p_title, p_data, p_target_status, p_change_summary
		);
		audit_action := 'content-entry-create';
	ELSIF p_action IN ('update', 'transition') THEN
		IF p_expected_updated_at IS NULL THEN
			entry_row := public.cms_apply_content_entry_command(
				p_action, p_business_id, p_actor_id, p_entry_id, p_content_type_id,
				p_site_id, p_locale, p_slug, p_title, p_data, p_target_status, p_change_summary
			);
		ELSE
			entry_row := public.cms_apply_content_entry_command_versioned(
				p_action, p_business_id, p_actor_id, p_entry_id, p_content_type_id,
				p_site_id, p_locale, p_slug, p_title, p_data, p_target_status,
				p_change_summary, p_expected_updated_at
			);
		END IF;
		audit_action := CASE WHEN p_action = 'update' THEN 'content-entry-update' ELSE 'content-entry-transition' END;
	ELSE
		RAISE EXCEPTION 'Unsupported audited content action';
	END IF;

	INSERT INTO public.resource_mutation_audit (
		business_id, project_id, site_id, actor_id, resource_key, action, record_id, metadata
	) VALUES (
		p_business_id,
		p_project_id,
		p_site_id,
		p_actor_id,
		'content-entry',
		audit_action,
		entry_row.id,
		jsonb_build_object(
			'contentTypeId', entry_row.content_type_id,
			'status', entry_row.status,
			'changeSummary', p_change_summary
		)
	);

	RETURN entry_row;
END;
$$;

REVOKE ALL ON FUNCTION public.cms_apply_content_entry_command_audited(
	text, uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cms_apply_content_entry_command_audited(
	text, uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb, text, text, timestamptz
) TO service_role;
