CREATE OR REPLACE FUNCTION public.assert_canonical_draft_projection()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
	v_revision public.site_revisions%ROWTYPE;
	v_active_page_path text;
BEGIN
	IF NEW.last_revision_id IS NULL THEN
		IF COALESCE(NEW.vfs_files, '{}'::jsonb) <> '{}'::jsonb
			OR COALESCE(NEW.metadata, '{}'::jsonb) ? 'siteBundleSnapshot'
			OR COALESCE(NEW.metadata, '{}'::jsonb) ? 'runtimeManifest'
			OR COALESCE(NULLIF(BTRIM(NEW.metadata->>'activePagePath'), ''), '') <> '' THEN
			RAISE EXCEPTION 'builder_drafts content requires a canonical committed revision'
				USING ERRCODE = '23514';
		END IF;
		RETURN NEW;
	END IF;

	SELECT revision.*
	INTO v_revision
	FROM public.site_revisions AS revision
	WHERE revision.id = NEW.last_revision_id
		AND revision.project_id = NEW.project_id
		AND revision.business_id = NEW.business_id
		AND revision.draft_id = NEW.id
		AND revision.status = 'committed';

	IF NOT FOUND THEN
		RAISE EXCEPTION 'builder_drafts.last_revision_id must reference its committed canonical revision'
			USING ERRCODE = '23514';
	END IF;

	IF COALESCE(NEW.vfs_files, '{}'::jsonb) IS DISTINCT FROM v_revision.vfs_files THEN
		RAISE EXCEPTION 'builder_drafts.vfs_files cannot diverge from its canonical revision'
			USING ERRCODE = '23514';
	END IF;

	IF NEW.metadata ? 'siteBundleSnapshot'
		AND NEW.metadata->'siteBundleSnapshot' IS DISTINCT FROM v_revision.site_bundle_snapshot THEN
		RAISE EXCEPTION 'builder_drafts snapshot cannot diverge from its canonical revision'
			USING ERRCODE = '23514';
	END IF;

	IF NEW.metadata ? 'runtimeManifest'
		AND NEW.metadata->'runtimeManifest' IS DISTINCT FROM v_revision.runtime_manifest THEN
		RAISE EXCEPTION 'builder_drafts runtime manifest cannot diverge from its canonical revision'
			USING ERRCODE = '23514';
	END IF;

	IF NEW.metadata->>'source' = 'external-import'
		AND NEW.metadata->>'acceptanceProfile' = 'imported-source'
		AND v_revision.readiness_report->>'acceptanceProfile' = 'imported-source'
		AND v_revision.site_bundle_snapshot IS NULL THEN
		RETURN NEW;
	END IF;

	v_active_page_path := NULLIF(BTRIM(NEW.metadata->>'activePagePath'), '');
	IF v_active_page_path IS NULL OR NOT (v_revision.vfs_files ? v_active_page_path) THEN
		RAISE EXCEPTION 'builder_drafts active page must exist in its canonical revision'
			USING ERRCODE = '23514';
	END IF;

	RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
