-- Restore owner-scoped access after the legacy bucket-wide public policies.
-- Shared public links retain read-only access until their configured expiry.

DROP POLICY IF EXISTS "Anyone can upload to user-files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view user-files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update user-files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete user-files" ON storage.objects;

DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view files shared with them" ON storage.objects;
DROP POLICY IF EXISTS "Public can view shared files" ON storage.objects;

CREATE POLICY "Users can upload their own files"
	ON storage.objects FOR INSERT TO authenticated
	WITH CHECK (
		bucket_id = 'user-files'
		AND auth.uid() IS NOT NULL
		AND auth.uid()::text = (storage.foldername(name))[1]
	);

CREATE POLICY "Users can view their own files"
	ON storage.objects FOR SELECT TO authenticated
	USING (
		bucket_id = 'user-files'
		AND auth.uid() IS NOT NULL
		AND auth.uid()::text = (storage.foldername(name))[1]
	);

CREATE POLICY "Users can update their own files"
	ON storage.objects FOR UPDATE TO authenticated
	USING (
		bucket_id = 'user-files'
		AND auth.uid() IS NOT NULL
		AND auth.uid()::text = (storage.foldername(name))[1]
	)
	WITH CHECK (
		bucket_id = 'user-files'
		AND auth.uid() IS NOT NULL
		AND auth.uid()::text = (storage.foldername(name))[1]
	);

CREATE POLICY "Users can delete their own files"
	ON storage.objects FOR DELETE TO authenticated
	USING (
		bucket_id = 'user-files'
		AND auth.uid() IS NOT NULL
		AND auth.uid()::text = (storage.foldername(name))[1]
	);

CREATE POLICY "Users can view files shared with them"
	ON storage.objects FOR SELECT TO authenticated
	USING (
		bucket_id = 'user-files'
		AND auth.uid() IS NOT NULL
		AND EXISTS (
			SELECT 1
			FROM public.shared_files sf
			JOIN public.files f ON f.id = sf.file_id
			WHERE f.storage_path = storage.objects.name
				AND sf.shared_with = auth.uid()
				AND (sf.expires_at IS NULL OR sf.expires_at > now())
		)
	);

CREATE POLICY "Public can view shared files"
	ON storage.objects FOR SELECT TO anon, authenticated
	USING (
		bucket_id = 'user-files'
		AND EXISTS (
			SELECT 1
			FROM public.shared_files sf
			JOIN public.files f ON f.id = sf.file_id
			WHERE f.storage_path = storage.objects.name
				AND sf.is_public = true
				AND (sf.expires_at IS NULL OR sf.expires_at > now())
		)
	);
