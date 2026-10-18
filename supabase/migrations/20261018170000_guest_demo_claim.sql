-- Guest demo continuity: when a guest signs up, their demo project and draft
-- transfer to the new account server-side. Claiming marks the session claimed,
-- which also stops further guest AI actions against it (credits respected).

CREATE OR REPLACE FUNCTION public.claim_guest_demo(p_guest_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
DECLARE
	caller uuid := auth.uid();
	session_row private.guest_demo_sessions%ROWTYPE;
BEGIN
	IF caller IS NULL THEN
		RAISE EXCEPTION 'An authenticated user is required';
	END IF;
	IF p_guest_user_id IS NULL OR p_guest_user_id = caller THEN
		RETURN jsonb_build_object('claimed', false, 'reason', 'no_guest_session');
	END IF;

	SELECT * INTO session_row
	FROM private.guest_demo_sessions
	WHERE guest_user_id = p_guest_user_id
	FOR UPDATE;

	IF NOT FOUND THEN
		RETURN jsonb_build_object('claimed', false, 'reason', 'no_guest_session');
	END IF;
	IF session_row.status = 'claimed' THEN
		RETURN jsonb_build_object('claimed', false, 'reason', 'already_claimed');
	END IF;
	IF session_row.status <> 'active' OR session_row.expires_at <= now() THEN
		RETURN jsonb_build_object('claimed', false, 'reason', 'session_expired');
	END IF;

	-- Only a verified anonymous Auth identity can be claimed.
	IF NOT EXISTS (
		SELECT 1 FROM auth.users AS guest_user
		WHERE guest_user.id = p_guest_user_id
			AND guest_user.is_anonymous IS TRUE
	) THEN
		RAISE EXCEPTION 'A verified anonymous Auth user is required';
	END IF;

	IF session_row.project_id IS NOT NULL THEN
		UPDATE public.projects
		SET owner_id = caller, updated_at = now()
		WHERE id = session_row.project_id
			AND owner_id = p_guest_user_id;

		INSERT INTO public.project_members (project_id, user_id, role)
		VALUES (session_row.project_id, caller, 'owner')
		ON CONFLICT (project_id, user_id) DO NOTHING;
	END IF;

	IF session_row.draft_id IS NOT NULL THEN
		UPDATE public.builder_drafts
		SET user_id = caller, updated_at = now()
		WHERE id = session_row.draft_id
			AND user_id = p_guest_user_id;
	END IF;

	UPDATE private.guest_demo_sessions
	SET status = 'claimed', claimed_by = caller, claimed_at = now()
	WHERE guest_user_id = p_guest_user_id;

	UPDATE private.guest_demo_ai_operations
	SET status = 'expired'
	WHERE guest_user_id = p_guest_user_id
		AND status = 'reserved';

	RETURN jsonb_build_object(
		'claimed', true,
		'project_id', session_row.project_id,
		'draft_id', session_row.draft_id
	);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_guest_demo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_guest_demo(uuid) TO authenticated;
