DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM public.builder_drafts AS draft
		WHERE draft.last_revision_id IS NOT NULL
			AND NOT EXISTS (
				SELECT 1
				FROM public.site_revisions AS revision
				WHERE revision.id = draft.last_revision_id
					AND revision.draft_id = draft.id
					AND revision.project_id = draft.project_id
					AND revision.business_id = draft.business_id
					AND revision.status = 'committed'
			)
	) THEN
		RAISE EXCEPTION 'Cannot enforce canonical draft revision pointers while invalid pointers exist';
	END IF;
END;
$$;

ALTER TABLE public.builder_drafts
	DROP CONSTRAINT IF EXISTS builder_drafts_last_revision_id_fkey;

ALTER TABLE public.builder_drafts
	ADD CONSTRAINT builder_drafts_last_revision_id_fkey
	FOREIGN KEY (last_revision_id)
	REFERENCES public.site_revisions(id)
	ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.guard_committed_revision_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF OLD.status = 'committed' AND (
		NEW.id IS DISTINCT FROM OLD.id
		OR NEW.project_id IS DISTINCT FROM OLD.project_id
		OR NEW.business_id IS DISTINCT FROM OLD.business_id
		OR NEW.draft_id IS DISTINCT FROM OLD.draft_id
		OR NEW.status IS DISTINCT FROM OLD.status
	) THEN
		RAISE EXCEPTION 'Committed canonical revision identity and status are immutable'
			USING ERRCODE = '23514';
	END IF;
	RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_committed_revision_identity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS site_revisions_guard_committed_identity ON public.site_revisions;
CREATE TRIGGER site_revisions_guard_committed_identity
	BEFORE UPDATE OF id, project_id, business_id, draft_id, status
	ON public.site_revisions
	FOR EACH ROW
	EXECUTE FUNCTION public.guard_committed_revision_identity();
