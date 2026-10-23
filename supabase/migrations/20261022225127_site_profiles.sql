-- Project-scoped public profile overrides. Private notification routing stays
-- on the business profile and is never written into site-facing overrides.
CREATE TABLE IF NOT EXISTS public.site_profiles (
	project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
	business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
	overrides jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(overrides) = 'object'),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_profiles_business_id_idx
	ON public.site_profiles (business_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_profiles TO authenticated;
GRANT ALL ON public.site_profiles TO service_role;
ALTER TABLE public.site_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public' AND tablename = 'site_profiles'
			AND policyname = 'Site members read site profile'
	) THEN
		CREATE POLICY "Site members read site profile"
			ON public.site_profiles FOR SELECT TO authenticated
			USING (public.is_project_member(auth.uid(), project_id));
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public' AND tablename = 'site_profiles'
			AND policyname = 'Business admins insert site profile'
	) THEN
		CREATE POLICY "Business admins insert site profile"
			ON public.site_profiles FOR INSERT TO authenticated
			WITH CHECK (
				public.is_business_admin(auth.uid(), business_id)
				AND public.is_project_member(auth.uid(), project_id)
			);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public' AND tablename = 'site_profiles'
			AND policyname = 'Business admins update site profile'
	) THEN
		CREATE POLICY "Business admins update site profile"
			ON public.site_profiles FOR UPDATE TO authenticated
			USING (public.is_business_admin(auth.uid(), business_id))
			WITH CHECK (
				public.is_business_admin(auth.uid(), business_id)
				AND public.is_project_member(auth.uid(), project_id)
			);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public' AND tablename = 'site_profiles'
			AND policyname = 'Business admins delete site profile'
	) THEN
		CREATE POLICY "Business admins delete site profile"
			ON public.site_profiles FOR DELETE TO authenticated
			USING (public.is_business_admin(auth.uid(), business_id));
	END IF;
END
$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_trigger
		WHERE tgrelid = 'public.site_profiles'::regclass
			AND tgname = 'site_profiles_updated_at'
			AND NOT tgisinternal
	) THEN
		CREATE TRIGGER site_profiles_updated_at
			BEFORE UPDATE ON public.site_profiles
			FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
	END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
