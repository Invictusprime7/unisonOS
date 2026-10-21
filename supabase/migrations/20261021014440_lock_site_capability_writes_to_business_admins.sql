-- Capability assignment changes operational behavior, so ordinary project or
-- business members may read state but only business owners/admins may mutate it.
DROP POLICY IF EXISTS "site_capabilities_business_member" ON public.site_capabilities;
DROP POLICY IF EXISTS "site_capabilities_member_all" ON public.site_capabilities;
DROP POLICY IF EXISTS "site_capabilities_select_member" ON public.site_capabilities;
DROP POLICY IF EXISTS "site_capabilities_insert_admin" ON public.site_capabilities;
DROP POLICY IF EXISTS "site_capabilities_update_admin" ON public.site_capabilities;
DROP POLICY IF EXISTS "site_capabilities_delete_admin" ON public.site_capabilities;

CREATE POLICY "site_capabilities_select_member"
	ON public.site_capabilities FOR SELECT TO authenticated
	USING (
		EXISTS (
			SELECT 1
			FROM public.sites s
			WHERE s.id = site_capabilities.site_id
				AND (s.owner_user_id = auth.uid() OR public.is_business_member(s.business_id))
		)
	);

CREATE POLICY "site_capabilities_insert_admin"
	ON public.site_capabilities FOR INSERT TO authenticated
	WITH CHECK (
		EXISTS (
			SELECT 1
			FROM public.sites s
			WHERE s.id = site_capabilities.site_id
				AND public.is_business_admin(s.business_id)
		)
	);

CREATE POLICY "site_capabilities_update_admin"
	ON public.site_capabilities FOR UPDATE TO authenticated
	USING (
		EXISTS (
			SELECT 1
			FROM public.sites s
			WHERE s.id = site_capabilities.site_id
				AND public.is_business_admin(s.business_id)
		)
	)
	WITH CHECK (
		EXISTS (
			SELECT 1
			FROM public.sites s
			WHERE s.id = site_capabilities.site_id
				AND public.is_business_admin(s.business_id)
		)
	);

CREATE POLICY "site_capabilities_delete_admin"
	ON public.site_capabilities FOR DELETE TO authenticated
	USING (
		EXISTS (
			SELECT 1
			FROM public.sites s
			WHERE s.id = site_capabilities.site_id
				AND public.is_business_admin(s.business_id)
		)
	);
