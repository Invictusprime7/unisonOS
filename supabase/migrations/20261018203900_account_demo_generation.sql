-- Account-owned allowance; no browser flag or user-supplied account ID is trusted.
CREATE TABLE public.account_demo_generations (
  user_id uuid PRIMARY KEY,
  generation_count smallint NOT NULL DEFAULT 0 CHECK (generation_count BETWEEN 0 AND 1),
  operation_id uuid,
  reserved_until timestamptz,
  project_id uuid,
  draft_id uuid,
  revision_id uuid,
  completed_at timestamptz
);
GRANT SELECT ON public.account_demo_generations TO authenticated;
GRANT ALL ON public.account_demo_generations TO service_role;
ALTER TABLE public.account_demo_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own demo generation" ON public.account_demo_generations
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE FUNCTION public.account_demo_status() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user uuid := auth.uid(); v_row public.account_demo_generations%ROWTYPE;
BEGIN
  IF v_user IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user AND is_anonymous IS NOT TRUE) THEN
    RAISE EXCEPTION 'Sign in to use the Live Demo.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.account_demo_generations WHERE user_id = v_user;
  RETURN jsonb_build_object('generation_count', COALESCE(v_row.generation_count, 0),
    'remaining', 1 - COALESCE(v_row.generation_count, 0),
    'in_progress', COALESCE(v_row.generation_count = 0 AND v_row.reserved_until > now(), false),
    'project_id', v_row.project_id);
END;
$$;
REVOKE ALL ON FUNCTION public.account_demo_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_demo_status() TO authenticated;

CREATE FUNCTION public.reserve_account_demo_generation(p_operation_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user uuid := auth.uid(); v_row public.account_demo_generations%ROWTYPE;
BEGIN
  IF v_user IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user AND is_anonymous IS NOT TRUE) THEN
    RAISE EXCEPTION 'Sign in to use the Live Demo.' USING ERRCODE = '42501';
  END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'A demo generation identity is required.'; END IF;
  INSERT INTO public.account_demo_generations(user_id) VALUES (v_user) ON CONFLICT DO NOTHING;
  SELECT * INTO v_row FROM public.account_demo_generations WHERE user_id = v_user FOR UPDATE;
  IF v_row.generation_count >= 1 THEN
    RAISE EXCEPTION 'You''ve used your free demo generation.' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.reserved_until > now() THEN
    IF v_row.operation_id = p_operation_id THEN RETURN public.account_demo_status(); END IF;
    RAISE EXCEPTION 'A demo generation is already in progress for your account.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.account_demo_generations SET operation_id = p_operation_id,
    reserved_until = now() + interval '2 hours' WHERE user_id = v_user;
  RETURN public.account_demo_status();
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_account_demo_generation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_account_demo_generation(uuid) TO authenticated;

CREATE FUNCTION public.release_account_demo_generation(p_operation_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to use the Live Demo.' USING ERRCODE = '42501'; END IF;
  UPDATE public.account_demo_generations SET operation_id = NULL, reserved_until = NULL
    WHERE user_id = auth.uid() AND operation_id = p_operation_id AND generation_count = 0;
END;
$$;
REVOKE ALL ON FUNCTION public.release_account_demo_generation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_account_demo_generation(uuid) TO authenticated;

-- Inside the sole canonical commit transaction: count and saved draft cannot diverge.
CREATE FUNCTION public.settle_account_demo_generation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_marks text[]; v_operation uuid; v_row public.account_demo_generations%ROWTYPE;
BEGIN
  SELECT array_agg(mark) INTO v_marks FROM unnest(NEW.operation_ids) AS mark
    WHERE mark LIKE 'account-demo:%';
  IF COALESCE(cardinality(v_marks), 0) = 0 THEN RETURN NEW; END IF;
  IF cardinality(v_marks) <> 1 OR v_marks[1] !~ '^account-demo:[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION 'Invalid demo generation identity.' USING ERRCODE = '23514';
  END IF;
  IF NEW.status <> 'committed' THEN RETURN NEW; END IF;
  v_operation := substring(v_marks[1] FROM 14)::uuid;
  IF NEW.created_by IS DISTINCT FROM auth.uid() OR NEW.source <> 'wizard-launch' OR NEW.parent_revision_id IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM public.projects WHERE id = NEW.project_id AND owner_id = auth.uid())
    OR NOT EXISTS (SELECT 1 FROM public.builder_drafts WHERE id = NEW.draft_id AND project_id = NEW.project_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Demo generation must save its own new project draft.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.account_demo_generations WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR v_row.generation_count <> 0 OR v_row.operation_id IS DISTINCT FROM v_operation
    OR v_row.reserved_until IS NULL OR v_row.reserved_until <= now() THEN
    RAISE EXCEPTION 'The demo generation reservation is unavailable. Please try again.' USING ERRCODE = '23514';
  END IF;
  UPDATE public.account_demo_generations SET generation_count = 1, project_id = NEW.project_id,
    draft_id = NEW.draft_id, revision_id = NEW.id, completed_at = now(), reserved_until = NULL
    WHERE user_id = auth.uid();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.settle_account_demo_generation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER settle_account_demo_generation AFTER INSERT ON public.site_revisions
  FOR EACH ROW EXECUTE FUNCTION public.settle_account_demo_generation();
