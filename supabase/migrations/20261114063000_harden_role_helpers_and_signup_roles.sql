-- Security hardening: role helpers answer only for the signed-in caller,
-- new signups no longer receive platform admin, and projects without a
-- business can only be moved by their owner. Safe to rerun.

-- 1. Platform role lookup: a signed-in user may only ask about themselves.
--    Trusted server code (no end-user identity) keeps full lookups.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
  END
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2. Business role lookup: same self-only rule for signed-in callers.
CREATE OR REPLACE FUNCTION public.user_business_role(_user_id uuid, _business_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = _business_id AND b.owner_id = _user_id)
      THEN 'owner'
    ELSE (
      SELECT bm.role
        FROM public.business_members bm
       WHERE bm.business_id = _business_id
         AND bm.user_id = _user_id
       LIMIT 1
    )
  END;
$$;
REVOKE EXECUTE ON FUNCTION public.user_business_role(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_business_role(uuid, uuid) TO authenticated, service_role;

-- 3. New accounts no longer become platform administrators automatically.
--    Existing role rows are left untouched; administrators are reviewed separately.
DROP TRIGGER IF EXISTS on_auth_user_created_admin_role ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_admin_role();

-- 4. Moving a project between businesses.
CREATE OR REPLACE FUNCTION public.reassign_project_business(_project_id uuid, _target_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _current_business uuid;
  _owner uuid;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.business_id, p.owner_id
    INTO _current_business, _owner
    FROM public.projects p
   WHERE p.id = _project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  IF _current_business IS NULL THEN
    -- A project outside any business can only be moved by its owner.
    IF _owner IS DISTINCT FROM _caller THEN
      RAISE EXCEPTION 'Only the project owner can move this project into a business';
    END IF;
  ELSIF NOT public.is_business_admin(_caller, _current_business)
        AND _owner IS DISTINCT FROM _caller THEN
    RAISE EXCEPTION 'You must be an admin of the current business to move this project';
  END IF;

  IF NOT public.is_business_admin(_caller, _target_business_id) THEN
    RAISE EXCEPTION 'You must be an admin of the target business to move a project into it';
  END IF;

  UPDATE public.projects
     SET business_id = _target_business_id,
         updated_at  = now()
   WHERE id = _project_id;

  UPDATE public.builder_drafts
     SET business_id = _target_business_id,
         updated_at  = now()
   WHERE project_id = _project_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reassign_project_business(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reassign_project_business(uuid, uuid) TO authenticated, service_role;
