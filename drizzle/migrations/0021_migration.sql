CREATE OR REPLACE FUNCTION public.cleanup_empty_projects()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;

  WITH empty AS (
    SELECT p.id
    FROM public.projects p
    WHERE p.owner_id = v_uid
      -- Grace period protects launches that are still being generated.
      AND p.created_at < now() - interval '1 hour'
      AND NOT EXISTS (SELECT 1 FROM public.site_revisions r WHERE r.project_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.vfs_snapshots s WHERE s.project_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.project_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.catalog_collections c WHERE c.project_id = p.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.builder_drafts d
        WHERE d.project_id = p.id
          AND (
            d.last_revision_id IS NOT NULL
            OR d.user_id IS DISTINCT FROM v_uid
            OR COALESCE(d.metadata ? 'vfsFiles', false)
            OR COALESCE(d.metadata ? 'files', false)
            OR COALESCE(d.metadata ? 'siteBundleSnapshot', false)
            OR COALESCE(length(d.metadata->>'previewCode'), 0) > 0
          )
      )
  ), removed AS (
    DELETE FROM public.projects p USING empty e WHERE p.id = e.id RETURNING p.id
  )
  SELECT count(*) INTO v_count FROM removed;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_empty_projects() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_empty_projects() TO authenticated;