CREATE OR REPLACE FUNCTION public.stamp_site_revision_accepted_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
	IF NEW.status = 'committed' THEN
		NEW.site_bundle_snapshot := COALESCE(NEW.site_bundle_snapshot, '{}'::jsonb)
			|| jsonb_build_object(
				'meta',
				COALESCE(NEW.site_bundle_snapshot->'meta', '{}'::jsonb)
					|| jsonb_build_object('acceptedRevisionId', NEW.id::text)
			);
	END IF;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS site_revisions_stamp_accepted_id
	ON public.site_revisions;
CREATE TRIGGER site_revisions_stamp_accepted_id
	BEFORE INSERT ON public.site_revisions
	FOR EACH ROW
	EXECUTE FUNCTION public.stamp_site_revision_accepted_id();

REVOKE ALL ON FUNCTION public.stamp_site_revision_accepted_id()
	FROM PUBLIC, anon, authenticated;
