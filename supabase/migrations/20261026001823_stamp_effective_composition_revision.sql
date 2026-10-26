-- Bind the source-derived composition projection to the exact revision row.
-- This mutates snapshot metadata only; accepted VFS bytes and their hash stay exact.
CREATE OR REPLACE FUNCTION public.stamp_effective_composition_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
	v_projection jsonb;
BEGIN
	IF NEW.status <> 'committed' THEN
		RETURN NEW;
	END IF;

	v_projection := NEW.site_bundle_snapshot #> '{meta,effectiveComposition}';
	IF v_projection IS NULL THEN
		RETURN NEW;
	END IF;

	IF jsonb_typeof(v_projection) IS DISTINCT FROM 'object'
		OR v_projection->>'schemaVersion' IS DISTINCT FROM '1.0'
		OR jsonb_typeof(v_projection->'pages') IS DISTINCT FROM 'object'
		OR v_projection->>'vfsHash' IS DISTINCT FROM NEW.vfs_hash
		OR v_projection->>'baseRevisionId' IS DISTINCT FROM NEW.parent_revision_id::text THEN
		RAISE EXCEPTION 'Effective composition projection does not match its canonical revision'
			USING ERRCODE = '23514';
	END IF;

	v_projection := jsonb_set(v_projection, '{revisionId}', to_jsonb(NEW.id::text), true);
	NEW.site_bundle_snapshot := jsonb_set(
		COALESCE(NEW.site_bundle_snapshot, '{}'::jsonb),
		'{meta,effectiveComposition}',
		v_projection,
		true
	);
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_effective_composition_revision
	ON public.site_revisions;
CREATE TRIGGER stamp_effective_composition_revision
	BEFORE INSERT ON public.site_revisions
	FOR EACH ROW
	EXECUTE FUNCTION public.stamp_effective_composition_revision();

REVOKE ALL ON FUNCTION public.stamp_effective_composition_revision() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.stamp_effective_composition_revision() IS
	'Validates and revision-binds the effective composition snapshot without changing accepted VFS bytes.';

NOTIFY pgrst, 'reload schema';
