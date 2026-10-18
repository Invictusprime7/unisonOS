CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE private.guest_demo_policy (
	policy_key text PRIMARY KEY CHECK (policy_key = 'beta'),
	action_allowance integer NOT NULL CHECK (action_allowance > 0),
	max_ai_requests_per_minute integer NOT NULL CHECK (max_ai_requests_per_minute > 0),
	max_ai_requests_per_action integer NOT NULL CHECK (max_ai_requests_per_action > 0),
	max_input_tokens_per_request integer NOT NULL CHECK (max_input_tokens_per_request > 0),
	max_output_tokens_per_request integer NOT NULL CHECK (max_output_tokens_per_request > 0),
	max_action_cost_microusd bigint NOT NULL CHECK (max_action_cost_microusd > 0),
	reservation_ttl_seconds integer NOT NULL CHECK (reservation_ttl_seconds BETWEEN 60 AND 3600),
	session_ttl_hours integer NOT NULL CHECK (session_ttl_hours BETWEEN 1 AND 720),
	updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO private.guest_demo_policy (
	policy_key,
	action_allowance,
	max_ai_requests_per_minute,
	max_ai_requests_per_action,
	max_input_tokens_per_request,
	max_output_tokens_per_request,
	max_action_cost_microusd,
	reservation_ttl_seconds,
	session_ttl_hours
) VALUES ('beta', 3, 8, 12, 12000, 8192, 150000, 900, 168)
ON CONFLICT (policy_key) DO NOTHING;

CREATE TABLE private.guest_demo_sessions (
	guest_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
	project_id uuid UNIQUE REFERENCES public.projects(id) ON DELETE SET NULL,
	draft_id uuid UNIQUE REFERENCES public.builder_drafts(id) ON DELETE SET NULL,
	status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'claimed', 'expired')),
	created_at timestamptz NOT NULL DEFAULT now(),
	expires_at timestamptz NOT NULL,
	claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
	claimed_at timestamptz,
	CHECK ((status = 'claimed') = (claimed_at IS NOT NULL AND claimed_by IS NOT NULL))
);

CREATE TABLE private.guest_demo_ai_operations (
	operation_id uuid PRIMARY KEY,
	guest_user_id uuid NOT NULL REFERENCES private.guest_demo_sessions(guest_user_id) ON DELETE CASCADE,
	project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
	draft_id uuid REFERENCES public.builder_drafts(id) ON DELETE CASCADE,
	status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'settled', 'released', 'expired')),
	ai_request_count integer NOT NULL DEFAULT 1 CHECK (ai_request_count > 0),
	max_ai_requests integer NOT NULL CHECK (max_ai_requests > 0),
	max_input_tokens_per_request integer NOT NULL CHECK (max_input_tokens_per_request > 0),
	max_output_tokens_per_request integer NOT NULL CHECK (max_output_tokens_per_request > 0),
	max_cost_microusd bigint NOT NULL CHECK (max_cost_microusd > 0),
	settled_revision_id uuid REFERENCES public.site_revisions(id) ON DELETE SET NULL,
	release_reason text,
	created_at timestamptz NOT NULL DEFAULT now(),
	expires_at timestamptz NOT NULL,
	settled_at timestamptz,
	CHECK ((status = 'settled') = (settled_at IS NOT NULL AND settled_revision_id IS NOT NULL))
);

CREATE INDEX guest_demo_ai_operations_subject_status_idx
	ON private.guest_demo_ai_operations (guest_user_id, status, created_at DESC);

ALTER TABLE private.guest_demo_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.guest_demo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.guest_demo_ai_operations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA private TO service_role;
CREATE OR REPLACE FUNCTION private.ensure_guest_demo_session(p_guest_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private, auth
AS $$
DECLARE
	policy private.guest_demo_policy%ROWTYPE;
	session_row private.guest_demo_sessions%ROWTYPE;
	successful_actions integer;
	reserved_actions integer;
BEGIN
	SELECT * INTO policy
	FROM private.guest_demo_policy
	WHERE policy_key = 'beta';

	IF NOT FOUND THEN
		RAISE EXCEPTION 'Guest demo policy is unavailable';
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM auth.users AS auth_user
		WHERE auth_user.id = p_guest_user_id
			AND auth_user.is_anonymous IS TRUE
	) THEN
		RAISE EXCEPTION 'A verified anonymous Auth user is required';
	END IF;

	INSERT INTO private.guest_demo_sessions (guest_user_id, expires_at)
	VALUES (p_guest_user_id, now() + make_interval(hours => policy.session_ttl_hours))
	ON CONFLICT (guest_user_id) DO NOTHING;

	SELECT * INTO session_row
	FROM private.guest_demo_sessions
	WHERE guest_user_id = p_guest_user_id
	FOR UPDATE;

	IF session_row.status <> 'active' OR session_row.expires_at <= now() THEN
		RAISE EXCEPTION 'Guest demo session is no longer active';
	END IF;

	UPDATE private.guest_demo_ai_operations
	SET status = 'expired'
	WHERE guest_user_id = p_guest_user_id
		AND status = 'reserved'
		AND expires_at <= now();

	SELECT
		count(*) FILTER (WHERE operation.status = 'settled'),
		count(*) FILTER (WHERE operation.status = 'reserved' AND operation.expires_at > now())
	INTO successful_actions, reserved_actions
	FROM private.guest_demo_ai_operations AS operation
	WHERE operation.guest_user_id = p_guest_user_id;

	RETURN jsonb_build_object(
		'status', session_row.status,
		'project_id', session_row.project_id,
		'draft_id', session_row.draft_id,
		'expires_at', session_row.expires_at,
		'action_allowance', policy.action_allowance,
		'actions_used', successful_actions,
		'actions_reserved', reserved_actions,
		'actions_remaining', greatest(0, policy.action_allowance - successful_actions - reserved_actions)
	);
END;
$$;

CREATE OR REPLACE FUNCTION private.bind_guest_demo_project(
	p_guest_user_id uuid,
	p_project_id uuid,
	p_draft_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private, public
AS $$
DECLARE
	current_project_id uuid;
	current_draft_id uuid;
BEGIN
	PERFORM 1
	FROM private.guest_demo_sessions AS guest_session
	WHERE guest_session.guest_user_id = p_guest_user_id
		AND guest_session.status = 'active'
		AND guest_session.expires_at > now()
	FOR UPDATE;

	IF NOT FOUND THEN
		RAISE EXCEPTION 'Active guest demo session is required';
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM public.projects AS project
		WHERE project.id = p_project_id AND project.owner_id = p_guest_user_id
	) OR NOT EXISTS (
		SELECT 1 FROM public.builder_drafts AS draft
		WHERE draft.id = p_draft_id
			AND draft.project_id = p_project_id
			AND draft.user_id = p_guest_user_id
	) THEN
		RAISE EXCEPTION 'Guest project and draft ownership do not match';
	END IF;

	SELECT guest_session.project_id, guest_session.draft_id
	INTO current_project_id, current_draft_id
	FROM private.guest_demo_sessions AS guest_session
	WHERE guest_session.guest_user_id = p_guest_user_id;

	IF (current_project_id IS NOT NULL AND current_project_id <> p_project_id)
		OR (current_draft_id IS NOT NULL AND current_draft_id <> p_draft_id) THEN
		RAISE EXCEPTION 'Guest demo is limited to one project and draft';
	END IF;

	UPDATE private.guest_demo_sessions
	SET project_id = p_project_id, draft_id = p_draft_id
	WHERE guest_user_id = p_guest_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.reserve_guest_demo_ai_action(
	p_guest_user_id uuid,
	p_project_id uuid,
	p_draft_id uuid,
	p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private, public
AS $$
DECLARE
	policy private.guest_demo_policy%ROWTYPE;
	session_row private.guest_demo_sessions%ROWTYPE;
	operation private.guest_demo_ai_operations%ROWTYPE;
	successful_actions integer;
	reserved_actions integer;
	recent_requests integer;
	operation_expires_at timestamptz;
BEGIN
	SELECT * INTO policy
	FROM private.guest_demo_policy
	WHERE policy_key = 'beta';

	SELECT * INTO session_row
	FROM private.guest_demo_sessions AS guest_session
	WHERE guest_session.guest_user_id = p_guest_user_id
	FOR UPDATE;

	IF NOT FOUND OR session_row.status <> 'active' OR session_row.expires_at <= now() THEN
		RAISE EXCEPTION 'Active guest demo project authorization is required';
	END IF;

	IF (session_row.project_id IS NULL AND (p_project_id IS NOT NULL OR p_draft_id IS NOT NULL))
		OR (session_row.project_id IS NOT NULL AND (
			session_row.project_id IS DISTINCT FROM p_project_id
			OR session_row.draft_id IS DISTINCT FROM p_draft_id
		)) THEN
		RAISE EXCEPTION 'Guest AI operation is outside the session project scope';
	END IF;

	UPDATE private.guest_demo_ai_operations
	SET status = 'expired'
	WHERE guest_user_id = p_guest_user_id
		AND status = 'reserved'
		AND expires_at <= now();

	SELECT * INTO operation
	FROM private.guest_demo_ai_operations AS ai_operation
	WHERE ai_operation.operation_id = p_operation_id
	FOR UPDATE;

	IF FOUND THEN
		IF operation.guest_user_id <> p_guest_user_id
			OR operation.project_id IS DISTINCT FROM p_project_id
			OR operation.draft_id IS DISTINCT FROM p_draft_id
			OR operation.status <> 'reserved'
			OR operation.expires_at <= now() THEN
			RAISE EXCEPTION 'Guest AI operation is invalid or no longer active';
		END IF;

		IF operation.ai_request_count >= operation.max_ai_requests THEN
			RAISE EXCEPTION 'Guest AI action request limit reached';
		END IF;

		SELECT COALESCE(sum(ai_operation.ai_request_count), 0)::integer
		INTO recent_requests
		FROM private.guest_demo_ai_operations AS ai_operation
		WHERE ai_operation.guest_user_id = p_guest_user_id
			AND ai_operation.created_at > now() - interval '1 minute'
			AND ai_operation.status IN ('reserved', 'settled');

		IF recent_requests >= policy.max_ai_requests_per_minute THEN
			RAISE EXCEPTION 'Guest AI request rate limit reached';
		END IF;

		UPDATE private.guest_demo_ai_operations
		SET ai_request_count = ai_request_count + 1
		WHERE operation_id = p_operation_id
		RETURNING expires_at INTO operation_expires_at;
	ELSE
		SELECT
			count(*) FILTER (WHERE ai_operation.status = 'settled'),
			count(*) FILTER (WHERE ai_operation.status = 'reserved' AND ai_operation.expires_at > now())
		INTO successful_actions, reserved_actions
		FROM private.guest_demo_ai_operations AS ai_operation
		WHERE ai_operation.guest_user_id = p_guest_user_id;

		IF successful_actions + reserved_actions >= policy.action_allowance THEN
			RAISE EXCEPTION 'Insufficient guest demo AI actions';
		END IF;

		SELECT COALESCE(sum(ai_operation.ai_request_count), 0)::integer
		INTO recent_requests
		FROM private.guest_demo_ai_operations AS ai_operation
		WHERE ai_operation.guest_user_id = p_guest_user_id
			AND ai_operation.created_at > now() - interval '1 minute'
			AND ai_operation.status IN ('reserved', 'settled');

		IF recent_requests >= policy.max_ai_requests_per_minute THEN
			RAISE EXCEPTION 'Guest AI request rate limit reached';
		END IF;

		operation_expires_at := now() + make_interval(secs => policy.reservation_ttl_seconds);
		INSERT INTO private.guest_demo_ai_operations (
			operation_id,
			guest_user_id,
			project_id,
			draft_id,
			max_ai_requests,
			max_input_tokens_per_request,
			max_output_tokens_per_request,
			max_cost_microusd,
			expires_at
		) VALUES (
			p_operation_id,
			p_guest_user_id,
			p_project_id,
			p_draft_id,
			policy.max_ai_requests_per_action,
			policy.max_input_tokens_per_request,
			policy.max_output_tokens_per_request,
			policy.max_action_cost_microusd,
			operation_expires_at
		);
	END IF;

	RETURN jsonb_build_object(
		'operation_id', p_operation_id,
		'operation_key', 'guest-demo:' || p_operation_id::text,
		'max_ai_requests_per_action', policy.max_ai_requests_per_action,
		'max_input_tokens_per_request', policy.max_input_tokens_per_request,
		'max_output_tokens_per_request', policy.max_output_tokens_per_request,
		'max_action_cost_microusd', policy.max_action_cost_microusd,
		'expires_at', operation_expires_at,
		'action_allowance', policy.action_allowance
	);
END;
$$;

CREATE OR REPLACE FUNCTION private.release_guest_demo_ai_action(
	p_guest_user_id uuid,
	p_operation_id uuid,
	p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $$
DECLARE
	released_count integer;
BEGIN
	UPDATE private.guest_demo_ai_operations
	SET status = 'released', release_reason = NULLIF(left(p_reason, 120), '')
	WHERE operation_id = p_operation_id
		AND guest_user_id = p_guest_user_id
		AND status = 'reserved';
	GET DIAGNOSTICS released_count = ROW_COUNT;
	RETURN released_count = 1;
END;
$$;

CREATE OR REPLACE FUNCTION private.settle_guest_demo_ai_action_from_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $$
DECLARE
	guest_session private.guest_demo_sessions%ROWTYPE;
	operation private.guest_demo_ai_operations%ROWTYPE;
	operation_key text;
	v_operation_id uuid;
BEGIN
	IF NEW.status <> 'committed' THEN
		RETURN NEW;
	END IF;

	FOREACH operation_key IN ARRAY NEW.operation_ids LOOP
		IF operation_key LIKE 'guest-demo:%' THEN
			BEGIN
				v_operation_id := substring(operation_key FROM 12)::uuid;
			EXCEPTION WHEN invalid_text_representation THEN
				RAISE EXCEPTION 'Guest AI operation identity is invalid'
					USING ERRCODE = '23514';
			END;

			SELECT * INTO operation
			FROM private.guest_demo_ai_operations AS ai_operation
			WHERE ai_operation.operation_id = v_operation_id
				AND ai_operation.guest_user_id = NEW.created_by
			FOR UPDATE;

			IF NOT FOUND OR operation.status <> 'reserved' OR operation.expires_at <= now()
				OR (operation.project_id IS NOT NULL AND operation.project_id <> NEW.project_id)
				OR (operation.draft_id IS NOT NULL AND operation.draft_id <> NEW.draft_id) THEN
				RAISE EXCEPTION 'Guest AI operation cannot be settled by this revision'
					USING ERRCODE = '23514';
			END IF;

			SELECT * INTO guest_session
			FROM private.guest_demo_sessions AS session_row
			WHERE session_row.guest_user_id = NEW.created_by
			FOR UPDATE;

			IF NOT FOUND OR guest_session.status <> 'active' OR guest_session.expires_at <= now()
				OR (guest_session.project_id IS NOT NULL AND guest_session.project_id <> NEW.project_id)
				OR (guest_session.draft_id IS NOT NULL AND guest_session.draft_id <> NEW.draft_id)
				OR NOT EXISTS (
					SELECT 1 FROM public.projects AS project
					WHERE project.id = NEW.project_id AND project.owner_id = NEW.created_by
				)
				OR NOT EXISTS (
					SELECT 1 FROM public.builder_drafts AS draft
					WHERE draft.id = NEW.draft_id
						AND draft.project_id = NEW.project_id
						AND draft.user_id = NEW.created_by
				) THEN
				RAISE EXCEPTION 'Guest revision project identity is not authorized'
					USING ERRCODE = '23514';
			END IF;

			UPDATE private.guest_demo_sessions
			SET project_id = NEW.project_id, draft_id = NEW.draft_id
			WHERE guest_user_id = NEW.created_by;

			UPDATE private.guest_demo_ai_operations
			SET project_id = NEW.project_id,
					draft_id = NEW.draft_id,
					status = 'settled',
					settled_revision_id = NEW.id,
					settled_at = now()
			WHERE operation_id = v_operation_id;
		END IF;
	END LOOP;

	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_demo_ensure_session(p_guest_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SET search_path = pg_catalog, private
AS $$
	SELECT private.ensure_guest_demo_session(p_guest_user_id)
$$;

CREATE OR REPLACE FUNCTION public.guest_demo_bind_project(
	p_guest_user_id uuid,
	p_project_id uuid,
	p_draft_id uuid
)
RETURNS void
LANGUAGE sql
SET search_path = pg_catalog, private
AS $$
	SELECT private.bind_guest_demo_project(p_guest_user_id, p_project_id, p_draft_id)
$$;

CREATE OR REPLACE FUNCTION public.guest_demo_reserve_action(
	p_guest_user_id uuid,
	p_project_id uuid,
	p_draft_id uuid,
	p_operation_id uuid
)
RETURNS jsonb
LANGUAGE sql
SET search_path = pg_catalog, private
AS $$
	SELECT private.reserve_guest_demo_ai_action(
		p_guest_user_id,
		p_project_id,
		p_draft_id,
		p_operation_id
	)
$$;

CREATE OR REPLACE FUNCTION public.guest_demo_release_action(
	p_guest_user_id uuid,
	p_operation_id uuid,
	p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SET search_path = pg_catalog, private
AS $$
	SELECT private.release_guest_demo_ai_action(p_guest_user_id, p_operation_id, p_reason)
$$;

CREATE TRIGGER settle_guest_demo_ai_action_from_revision
	AFTER INSERT ON public.site_revisions
	FOR EACH ROW
	EXECUTE FUNCTION private.settle_guest_demo_ai_action_from_revision();

REVOKE EXECUTE ON FUNCTION private.ensure_guest_demo_session(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.bind_guest_demo_project(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.reserve_guest_demo_ai_action(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.release_guest_demo_ai_action(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.settle_guest_demo_ai_action_from_revision() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.guest_demo_ensure_session(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guest_demo_bind_project(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guest_demo_reserve_action(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guest_demo_release_action(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.ensure_guest_demo_session(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.bind_guest_demo_project(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.reserve_guest_demo_ai_action(uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.release_guest_demo_ai_action(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.guest_demo_ensure_session(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.guest_demo_bind_project(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.guest_demo_reserve_action(uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.guest_demo_release_action(uuid, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
