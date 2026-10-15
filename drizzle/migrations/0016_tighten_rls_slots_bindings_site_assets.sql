DROP POLICY IF EXISTS slots_select_public ON public.availability_slots;
CREATE POLICY slots_select_member ON public.availability_slots
  FOR SELECT TO authenticated
  USING (is_business_member(business_id));

DROP POLICY IF EXISTS site_data_bindings_select_public ON public.site_data_bindings;
CREATE POLICY site_data_bindings_select_member ON public.site_data_bindings
  FOR SELECT TO authenticated
  USING (is_business_member(business_id));

DROP POLICY IF EXISTS "site-assets public read" ON storage.objects;
CREATE POLICY "site-assets owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'site-assets' AND (storage.foldername(name))[1] = (auth.uid())::text);