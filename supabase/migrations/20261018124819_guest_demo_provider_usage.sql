ALTER TABLE private.guest_demo_policy
	ADD COLUMN max_provider_prompt_overhead_tokens integer NOT NULL DEFAULT 24000
		CHECK (max_provider_prompt_overhead_tokens BETWEEN 0 AND 100000);
ALTER TABLE private.guest_demo_policy
	ADD COLUMN max_session_cost_microusd bigint NOT NULL DEFAULT 450000
		CHECK (max_session_cost_microusd > 0);

CREATE TABLE private.guest_demo_model_pricing (
	model_id text PRIMARY KEY,
	input_microusd_per_million bigint NOT NULL CHECK (input_microusd_per_million >= 0),
	output_microusd_per_million bigint NOT NULL CHECK (output_microusd_per_million >= 0),
	updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO private.guest_demo_model_pricing (
	model_id,
	input_microusd_per_million,
	output_microusd_per_million
) VALUES ('gemini-3.8-flash', 1500000, 7500000)
ON CONFLICT (model_id) DO NOTHING;

CREATE TABLE private.guest_demo_provider_usage (
	call_id uuid PRIMARY KEY,
	operation_id uuid NOT NULL REFERENCES private.guest_demo_ai_operations(operation_id) ON DELETE CASCADE,
	model_id text NOT NULL REFERENCES private.guest_demo_model_pricing(model_id),
	input_token_limit integer NOT NULL CHECK (input_token_limit > 0),
	output_token_limit integer NOT NULL CHECK (output_token_limit > 0),
	reserved_cost_microusd bigint NOT NULL CHECK (reserved_cost_microusd > 0),
	actual_cost_microusd bigint NOT NULL DEFAULT 0 CHECK (actual_cost_microusd >= 0),
	input_tokens integer,
	output_tokens integer,
	status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'settled')),
	created_at timestamptz NOT NULL DEFAULT now(),
	settled_at timestamptz,
	CHECK ((status = 'settled') = (settled_at IS NOT NULL AND input_tokens IS NOT NULL AND output_tokens IS NOT NULL))
);

CREATE INDEX guest_demo_provider_usage_operation_status_idx
	ON private.guest_demo_provider_usage (operation_id, status);

ALTER TABLE private.guest_demo_model_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.guest_demo_provider_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.guest_demo_model_pricing, private.guest_demo_provider_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.guest_demo_model_pricing, private.guest_demo_provider_usage TO service_role;

CREATE OR REPLACE FUNCTION private.reserve_guest_demo_provider_call(
	p_guest_user_id uuid,
	p_operation_id uuid,
	p_call_id uuid,
	p_model_id text,
	p_input_token_limit integer,
	p_output_token_limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $$
DECLARE
	operation private.guest_demo_ai_operations%ROWTYPE;
	pricing private.guest_demo_model_pricing%ROWTYPE;
	policy private.guest_demo_policy%ROWTYPE;
	prior_call private.guest_demo_provider_usage%ROWTYPE;
	reserved_cost bigint;
	operation_cost bigint;
	session_cost bigint;
BEGIN
	SELECT * INTO operation
	FROM private.guest_demo_ai_operations
	WHERE operation_id = p_operation_id AND guest_user_id = p_guest_user_id
	FOR UPDATE;
	IF NOT FOUND OR operation.status <> 'reserved' OR operation.expires_at <= now() THEN
		RAISE EXCEPTION 'Guest demo action is no longer active';
	END IF;
	PERFORM pg_advisory_xact_lock(hashtextextended(p_guest_user_id::text, 0));

	SELECT * INTO prior_call
	FROM private.guest_demo_provider_usage
	WHERE call_id = p_call_id
	FOR UPDATE;
	IF FOUND THEN
		IF prior_call.operation_id <> p_operation_id OR prior_call.model_id <> p_model_id THEN
			RAISE EXCEPTION 'Guest provider call identity does not match';
		END IF;
		RETURN jsonb_build_object(
			'call_id', prior_call.call_id,
			'reserved_cost_microusd', prior_call.reserved_cost_microusd,
			'input_token_limit', prior_call.input_token_limit,
			'output_token_limit', prior_call.output_token_limit
		);
	END IF;

	SELECT * INTO pricing
	FROM private.guest_demo_model_pricing
	WHERE model_id = p_model_id;
	IF NOT FOUND THEN
		RAISE EXCEPTION 'Guest demo model pricing is unavailable';
	END IF;

	SELECT * INTO policy
	FROM private.guest_demo_policy
	WHERE policy_key = 'beta';
	IF p_input_token_limit <= 0
		OR p_input_token_limit > operation.max_input_tokens_per_request + policy.max_provider_prompt_overhead_tokens
		OR p_output_token_limit <= 0
		OR p_output_token_limit > operation.max_output_tokens_per_request THEN
		RAISE EXCEPTION 'Guest provider token reservation exceeds policy';
	END IF;

	reserved_cost := ceil((
		p_input_token_limit::numeric * pricing.input_microusd_per_million
		+ p_output_token_limit::numeric * pricing.output_microusd_per_million
	) / 1000000)::bigint;
	SELECT COALESCE(sum(
		CASE WHEN usage_row.status = 'reserved'
			THEN usage_row.reserved_cost_microusd
			ELSE usage_row.actual_cost_microusd
		END
	), 0)::bigint
	INTO operation_cost
	FROM private.guest_demo_provider_usage AS usage_row
	WHERE usage_row.operation_id = p_operation_id;
	IF operation_cost + reserved_cost > operation.max_cost_microusd THEN
		RAISE EXCEPTION 'Guest demo action cost limit reached';
	END IF;

	SELECT COALESCE(sum(
		CASE WHEN usage_row.status = 'reserved'
			THEN usage_row.reserved_cost_microusd
			ELSE usage_row.actual_cost_microusd
		END
	), 0)::bigint
	INTO session_cost
	FROM private.guest_demo_provider_usage AS usage_row
	JOIN private.guest_demo_ai_operations AS ai_operation
		ON ai_operation.operation_id = usage_row.operation_id
	WHERE ai_operation.guest_user_id = p_guest_user_id;
	IF session_cost + reserved_cost > policy.max_session_cost_microusd THEN
		RAISE EXCEPTION 'Guest demo session cost limit reached';
	END IF;

	INSERT INTO private.guest_demo_provider_usage (
		call_id, operation_id, model_id, input_token_limit, output_token_limit, reserved_cost_microusd
	) VALUES (
		p_call_id, p_operation_id, p_model_id, p_input_token_limit, p_output_token_limit, reserved_cost
	);

	RETURN jsonb_build_object(
		'call_id', p_call_id,
		'reserved_cost_microusd', reserved_cost,
		'input_token_limit', p_input_token_limit,
		'output_token_limit', p_output_token_limit
	);
END;
$$;

CREATE OR REPLACE FUNCTION private.settle_guest_demo_provider_call(
	p_guest_user_id uuid,
	p_operation_id uuid,
	p_call_id uuid,
	p_input_tokens integer,
	p_output_tokens integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $$
DECLARE
	operation private.guest_demo_ai_operations%ROWTYPE;
	usage_row private.guest_demo_provider_usage%ROWTYPE;
	pricing private.guest_demo_model_pricing%ROWTYPE;
	actual_cost bigint;
	operation_cost bigint;
BEGIN
	SELECT * INTO operation
	FROM private.guest_demo_ai_operations
	WHERE operation_id = p_operation_id AND guest_user_id = p_guest_user_id
	FOR UPDATE;
	IF NOT FOUND OR operation.status <> 'reserved' OR operation.expires_at <= now() THEN
		RAISE EXCEPTION 'Guest demo action is no longer active';
	END IF;

	SELECT * INTO usage_row
	FROM private.guest_demo_provider_usage
	WHERE call_id = p_call_id AND operation_id = p_operation_id
	FOR UPDATE;
	IF NOT FOUND THEN
		RAISE EXCEPTION 'Guest provider call reservation is missing';
	END IF;
	IF usage_row.status = 'settled' THEN
		IF usage_row.input_tokens <> p_input_tokens OR usage_row.output_tokens <> p_output_tokens THEN
			RAISE EXCEPTION 'Guest provider call usage does not match';
		END IF;
		RETURN jsonb_build_object(
			'actual_cost_microusd', usage_row.actual_cost_microusd,
			'operation_cost_microusd', (SELECT COALESCE(sum(CASE WHEN u.status = 'reserved' THEN u.reserved_cost_microusd ELSE u.actual_cost_microusd END), 0)::bigint FROM private.guest_demo_provider_usage AS u WHERE u.operation_id = p_operation_id),
			'max_action_cost_microusd', operation.max_cost_microusd
		);
	END IF;
	IF p_input_tokens < 0 OR p_input_tokens > usage_row.input_token_limit
		OR p_output_tokens < 0 OR p_output_tokens > usage_row.output_token_limit THEN
		RAISE EXCEPTION 'Guest provider usage exceeds its token reservation';
	END IF;

	SELECT * INTO pricing
	FROM private.guest_demo_model_pricing
	WHERE model_id = usage_row.model_id;
	actual_cost := ceil((
		p_input_tokens::numeric * pricing.input_microusd_per_million
		+ p_output_tokens::numeric * pricing.output_microusd_per_million
	) / 1000000)::bigint;
	UPDATE private.guest_demo_provider_usage
	SET status = 'settled', actual_cost_microusd = actual_cost,
		input_tokens = p_input_tokens, output_tokens = p_output_tokens, settled_at = now()
	WHERE call_id = p_call_id;

	SELECT COALESCE(sum(CASE WHEN u.status = 'reserved' THEN u.reserved_cost_microusd ELSE u.actual_cost_microusd END), 0)::bigint
	INTO operation_cost
	FROM private.guest_demo_provider_usage AS u
	WHERE u.operation_id = p_operation_id;
	RETURN jsonb_build_object(
		'actual_cost_microusd', actual_cost,
		'operation_cost_microusd', operation_cost,
		'max_action_cost_microusd', operation.max_cost_microusd
	);
END;
$$;

CREATE OR REPLACE FUNCTION private.guard_guest_demo_ai_usage_before_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $$
DECLARE
	operation_key text;
	v_operation_id uuid;
	operation private.guest_demo_ai_operations%ROWTYPE;
	operation_cost bigint;
BEGIN
	IF NEW.status <> 'committed' THEN
		RETURN NEW;
	END IF;

	FOREACH operation_key IN ARRAY NEW.operation_ids LOOP
		IF operation_key LIKE 'guest-demo:%' THEN
			BEGIN
				v_operation_id := substring(operation_key FROM 12)::uuid;
			EXCEPTION WHEN invalid_text_representation THEN
				RAISE EXCEPTION 'Guest AI operation identity is invalid' USING ERRCODE = '23514';
			END;

			SELECT * INTO operation
			FROM private.guest_demo_ai_operations AS ai_operation
			WHERE ai_operation.operation_id = v_operation_id AND ai_operation.guest_user_id = NEW.created_by;
			IF NOT FOUND THEN
				RAISE EXCEPTION 'Guest AI operation cannot be settled by this revision' USING ERRCODE = '23514';
			END IF;

			IF EXISTS (
				SELECT 1 FROM private.guest_demo_provider_usage AS usage_row
				WHERE usage_row.operation_id = v_operation_id AND usage_row.status = 'reserved'
			) THEN
				RAISE EXCEPTION 'Guest AI provider usage is not settled' USING ERRCODE = '23514';
			END IF;

			SELECT COALESCE(sum(usage_row.actual_cost_microusd), 0)::bigint
			INTO operation_cost
			FROM private.guest_demo_provider_usage AS usage_row
			WHERE usage_row.operation_id = v_operation_id;
			IF operation_cost > operation.max_cost_microusd THEN
				RAISE EXCEPTION 'Guest AI action cost limit exceeded' USING ERRCODE = '23514';
			END IF;
		END IF;
	END LOOP;
	RETURN NEW;
END;
$$;

CREATE TRIGGER guard_guest_demo_ai_usage_before_revision
	BEFORE INSERT ON public.site_revisions
	FOR EACH ROW
	EXECUTE FUNCTION private.guard_guest_demo_ai_usage_before_revision();

CREATE OR REPLACE FUNCTION public.guest_demo_reserve_provider_call(
	p_guest_user_id uuid,
	p_operation_id uuid,
	p_call_id uuid,
	p_model_id text,
	p_input_token_limit integer,
	p_output_token_limit integer
)
RETURNS jsonb
LANGUAGE sql
SET search_path = pg_catalog, private
AS $$
	SELECT private.reserve_guest_demo_provider_call(
		p_guest_user_id, p_operation_id, p_call_id, p_model_id, p_input_token_limit, p_output_token_limit
	)
$$;

CREATE OR REPLACE FUNCTION public.guest_demo_settle_provider_call(
	p_guest_user_id uuid,
	p_operation_id uuid,
	p_call_id uuid,
	p_input_tokens integer,
	p_output_tokens integer
)
RETURNS jsonb
LANGUAGE sql
SET search_path = pg_catalog, private
AS $$
	SELECT private.settle_guest_demo_provider_call(
		p_guest_user_id, p_operation_id, p_call_id, p_input_tokens, p_output_tokens
	)
$$;

REVOKE EXECUTE ON FUNCTION private.reserve_guest_demo_provider_call(uuid, uuid, uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.settle_guest_demo_provider_call(uuid, uuid, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.guard_guest_demo_ai_usage_before_revision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guest_demo_reserve_provider_call(uuid, uuid, uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guest_demo_settle_provider_call(uuid, uuid, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.reserve_guest_demo_provider_call(uuid, uuid, uuid, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION private.settle_guest_demo_provider_call(uuid, uuid, uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.guest_demo_reserve_provider_call(uuid, uuid, uuid, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.guest_demo_settle_provider_call(uuid, uuid, uuid, integer, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
