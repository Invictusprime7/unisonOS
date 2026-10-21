CREATE OR REPLACE FUNCTION public.cms_apply_content_entry_command_idempotent(
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
	p_expected_updated_at timestamptz,
	p_idempotency_key text
)
RETURNS public.content_entries
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
	entry_row public.content_entries%ROWTYPE;
	receipt public.resource_mutation_audit%ROWTYPE;
	audit_action text;
	request_hash text;
BEGIN
	IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) NOT BETWEEN 1 AND 200 THEN
		RAISE EXCEPTION 'Content command requires a valid idempotency key';
	END IF;
	IF p_action NOT IN ('create', 'update', 'transition') THEN
		RAISE EXCEPTION 'Unsupported idempotent content action';
	END IF;

	request_hash := md5(jsonb_build_object(
		'action', p_action,
		'businessId', p_business_id,
		'projectId', p_project_id,
		'actorId', p_actor_id,
		'entryId', p_entry_id,
		'contentTypeId', p_content_type_id,
		'siteId', p_site_id,
		'locale', p_locale,
		'slug', p_slug,
		'title', p_title,
		'data', p_data,
		'targetStatus', p_target_status,
		'changeSummary', p_change_summary,
		'expectedUpdatedAt', p_expected_updated_at
	)::text);

	SELECT * INTO receipt
	FROM public.resource_mutation_audit audit_row
	WHERE audit_row.business_id = p_business_id
		AND audit_row.metadata ->> 'idempotencyKey' = p_idempotency_key;

	IF FOUND THEN
		IF receipt.metadata ->> 'requestHash' IS DISTINCT FROM request_hash THEN
			RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED';
		END IF;
		SELECT * INTO entry_row
		FROM public.content_entries
		WHERE id = receipt.record_id
			AND business_id = p_business_id;
		IF NOT FOUND THEN RAISE EXCEPTION 'IDEMPOTENT_CONTENT_RESULT_NOT_FOUND'; END IF;
		RETURN entry_row;
	END IF;

	BEGIN
		IF p_action = 'create' THEN
			entry_row := public.cms_apply_content_entry_command(
				p_action, p_business_id, p_actor_id, p_entry_id, p_content_type_id,
				p_site_id, p_locale, p_slug, p_title, p_data, p_target_status, p_change_summary
			);
			audit_action := 'content-entry-create';
		ELSE
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
				'changeSummary', p_change_summary,
				'idempotencyKey', p_idempotency_key,
				'requestHash', request_hash
			)
		);
		RETURN entry_row;
	EXCEPTION WHEN unique_violation THEN
		-- A concurrent request with this key committed first; its audit row is the receipt.
		SELECT * INTO receipt
		FROM public.resource_mutation_audit audit_row
		WHERE audit_row.business_id = p_business_id
			AND audit_row.metadata ->> 'idempotencyKey' = p_idempotency_key;
		IF NOT FOUND THEN RAISE; END IF;
		IF receipt.metadata ->> 'requestHash' IS DISTINCT FROM request_hash THEN
			RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED';
		END IF;
		SELECT * INTO entry_row
		FROM public.content_entries
		WHERE id = receipt.record_id
			AND business_id = p_business_id;
		IF NOT FOUND THEN RAISE EXCEPTION 'IDEMPOTENT_CONTENT_RESULT_NOT_FOUND'; END IF;
		RETURN entry_row;
	END;
END;
$$;
