CREATE OR REPLACE FUNCTION private.business_apply_profile_command(p_business_id uuid, p_patch jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
	k text;
	allowed text[] := ARRAY['name','slug','industry','tagline','description','logo_url','brand_color','website','phone','email','notification_email','notification_phone','timezone','address','hours','social_links','settings'];
BEGIN
	IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to edit business details.' USING ERRCODE = '42501'; END IF;
	IF NOT public.business_has_permission(p_business_id, 'business.profile.write') THEN
		RAISE EXCEPTION 'Only the business owner or an admin can change business details.' USING ERRCODE = '42501';
	END IF;
	IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN RAISE EXCEPTION 'Invalid business details change.'; END IF;
	FOR k IN SELECT jsonb_object_keys(p_patch) LOOP
		IF NOT k = ANY(allowed) THEN RAISE EXCEPTION 'The field % cannot be edited.', k; END IF;
	END LOOP;
	UPDATE public.businesses b SET
		name = CASE WHEN p_patch ? 'name' THEN p_patch->>'name' ELSE b.name END,
		slug = CASE WHEN p_patch ? 'slug' THEN p_patch->>'slug' ELSE b.slug END,
		industry = CASE WHEN p_patch ? 'industry' THEN p_patch->>'industry' ELSE b.industry END,
		tagline = CASE WHEN p_patch ? 'tagline' THEN p_patch->>'tagline' ELSE b.tagline END,
		description = CASE WHEN p_patch ? 'description' THEN p_patch->>'description' ELSE b.description END,
		logo_url = CASE WHEN p_patch ? 'logo_url' THEN p_patch->>'logo_url' ELSE b.logo_url END,
		brand_color = CASE WHEN p_patch ? 'brand_color' THEN p_patch->>'brand_color' ELSE b.brand_color END,
		website = CASE WHEN p_patch ? 'website' THEN p_patch->>'website' ELSE b.website END,
		phone = CASE WHEN p_patch ? 'phone' THEN p_patch->>'phone' ELSE b.phone END,
		email = CASE WHEN p_patch ? 'email' THEN p_patch->>'email' ELSE b.email END,
		notification_email = CASE WHEN p_patch ? 'notification_email' THEN p_patch->>'notification_email' ELSE b.notification_email END,
		notification_phone = CASE WHEN p_patch ? 'notification_phone' THEN p_patch->>'notification_phone' ELSE b.notification_phone END,
		timezone = CASE WHEN p_patch ? 'timezone' THEN p_patch->>'timezone' ELSE b.timezone END,
		address = CASE WHEN p_patch ? 'address' THEN COALESCE(p_patch->'address','{}'::jsonb) ELSE b.address END,
		hours = CASE WHEN p_patch ? 'hours' THEN COALESCE(p_patch->'hours','[]'::jsonb) ELSE b.hours END,
		social_links = CASE WHEN p_patch ? 'social_links' THEN COALESCE(p_patch->'social_links','{}'::jsonb) ELSE b.social_links END,
		settings = CASE WHEN p_patch ? 'settings' THEN COALESCE(p_patch->'settings','{}'::jsonb) ELSE b.settings END,
		updated_at = now()
	WHERE b.id = p_business_id;
	IF NOT FOUND THEN RAISE EXCEPTION 'Business not found.'; END IF;
	RETURN p_business_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.business_apply_profile_command(p_business_id uuid, p_patch jsonb)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
	SELECT private.business_apply_profile_command(p_business_id, p_patch);
$$;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.business_apply_profile_command(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.business_apply_profile_command(uuid, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.business_apply_profile_command(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_apply_profile_command(uuid, jsonb) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
