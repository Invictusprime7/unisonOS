-- CRM command scope is business/project. Keep workspace_id nullable for legacy
-- reads, but do not require it for new business-owned operations.
DO $$
BEGIN
	IF to_regclass('public.crm_contacts') IS NULL
		OR to_regclass('public.crm_leads') IS NULL
		OR to_regclass('public.crm_activities') IS NULL
		OR to_regclass('public.crm_workflows') IS NULL THEN
		RAISE EXCEPTION 'CRM compatibility migration requires contacts, leads, activities, and workflows tables';
	END IF;
END;
$$;

-- Sales pipeline is currently exposed in Cloud, so install its optional deal
-- entity explicitly; it remains separate from the universal contact/lead core.
CREATE TABLE IF NOT EXISTS public.crm_deals (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
	project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
	user_id uuid,
	contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
	lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
	title text NOT NULL,
	stage text NOT NULL DEFAULT 'prospecting',
	value numeric,
	expected_close_date date,
	metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_deals
	ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
	ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
	ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.crm_contacts
	ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
	ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
	ADD COLUMN IF NOT EXISTS email_key text GENERATED ALWAYS AS (lower(email)) STORED;

ALTER TABLE public.crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_email_key;

ALTER TABLE public.crm_leads
	ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
	ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
	ADD COLUMN IF NOT EXISTS stage text;

DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'status'
	) THEN
		EXECUTE 'UPDATE public.crm_leads SET stage = COALESCE(NULLIF(stage, ''''), NULLIF(status, ''''), ''new'') WHERE stage IS NULL OR stage = ''''';
	ELSE
		UPDATE public.crm_leads SET stage = 'new' WHERE stage IS NULL OR stage = '';
	END IF;
END;
$$;

ALTER TABLE public.crm_leads
	ALTER COLUMN stage SET DEFAULT 'new',
	ALTER COLUMN stage SET NOT NULL;

ALTER TABLE public.crm_leads
	ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';

UPDATE public.crm_leads
SET status = stage
WHERE status IS NULL OR status = '' OR (status = 'new' AND stage <> 'new');

CREATE OR REPLACE FUNCTION public.sync_crm_lead_compat_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		IF NEW.stage IS DISTINCT FROM 'new' THEN
			NEW.status := NEW.stage;
		ELSE
			NEW.stage := COALESCE(NULLIF(NEW.status, ''), 'new');
		END IF;
		RETURN NEW;
	END IF;

	IF NEW.stage IS DISTINCT FROM OLD.stage THEN
		NEW.status := NEW.stage;
	ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
		NEW.stage := NEW.status;
	END IF;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_leads_sync_compat_status ON public.crm_leads;
CREATE TRIGGER crm_leads_sync_compat_status
	BEFORE INSERT OR UPDATE OF stage, status ON public.crm_leads
	FOR EACH ROW EXECUTE FUNCTION public.sync_crm_lead_compat_status();

ALTER TABLE public.crm_activities
	ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
	ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
	ADD COLUMN IF NOT EXISTS type text,
	ADD COLUMN IF NOT EXISTS activity_type text;

DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'crm_activities' AND column_name = 'activity_type'
	) THEN
		EXECUTE 'UPDATE public.crm_activities SET type = activity_type WHERE type IS NULL';
	END IF;
END;
$$;

UPDATE public.crm_activities SET type = 'note' WHERE type IS NULL OR type = '';
UPDATE public.crm_activities
SET activity_type = type
WHERE activity_type IS NULL OR activity_type = '' OR (activity_type = 'note' AND type <> 'note');
ALTER TABLE public.crm_activities
	ALTER COLUMN type SET DEFAULT 'note',
	ALTER COLUMN type SET NOT NULL;
ALTER TABLE public.crm_activities
	ALTER COLUMN activity_type SET DEFAULT 'note',
	ALTER COLUMN activity_type SET NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_crm_activity_compat_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		IF NEW.type IS DISTINCT FROM 'note' THEN
			NEW.activity_type := NEW.type;
		ELSE
			NEW.type := COALESCE(NULLIF(NEW.activity_type, ''), 'note');
		END IF;
		RETURN NEW;
	END IF;

	IF NEW.type IS DISTINCT FROM OLD.type THEN
		NEW.activity_type := NEW.type;
	ELSIF NEW.activity_type IS DISTINCT FROM OLD.activity_type THEN
		NEW.type := NEW.activity_type;
	END IF;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_activities_sync_compat_type ON public.crm_activities;
CREATE TRIGGER crm_activities_sync_compat_type
	BEFORE INSERT OR UPDATE OF type, activity_type ON public.crm_activities
	FOR EACH ROW EXECUTE FUNCTION public.sync_crm_activity_compat_type();

ALTER TABLE public.crm_workflows
	ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
	ADD COLUMN IF NOT EXISTS actions jsonb NOT NULL DEFAULT '[]'::jsonb,
	ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
	ADD COLUMN IF NOT EXISTS steps jsonb NOT NULL DEFAULT '[]'::jsonb,
	ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.crm_workflows
	ALTER COLUMN actions SET DEFAULT '[]'::jsonb;

DO $$
DECLARE
	v_table_name text;
BEGIN
	FOREACH v_table_name IN ARRAY ARRAY['crm_contacts', 'crm_leads', 'crm_activities', 'crm_workflows', 'crm_workflow_runs', 'crm_workflow_jobs', 'crm_deals'] LOOP
		IF to_regclass(format('public.%I', v_table_name)) IS NOT NULL
			AND EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'workspace_id'
			) THEN
			EXECUTE format('ALTER TABLE public.%I ALTER COLUMN workspace_id DROP NOT NULL', v_table_name);
		END IF;
	END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_crm_workflow_compat_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		IF NEW.steps IS DISTINCT FROM '[]'::jsonb THEN
			NEW.actions := NEW.steps;
		ELSE
			NEW.steps := COALESCE(NEW.actions, '[]'::jsonb);
		END IF;

		IF NEW.is_active IS DISTINCT FROM true THEN
			NEW.active := NEW.is_active;
		ELSE
			NEW.is_active := COALESCE(NEW.active, true);
		END IF;
		RETURN NEW;
	END IF;

	IF NEW.steps IS DISTINCT FROM OLD.steps THEN
		NEW.actions := NEW.steps;
	ELSIF NEW.actions IS DISTINCT FROM OLD.actions THEN
		NEW.steps := NEW.actions;
	END IF;

	IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
		NEW.active := NEW.is_active;
	ELSIF NEW.active IS DISTINCT FROM OLD.active THEN
		NEW.is_active := NEW.active;
	END IF;

	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_workflows_sync_compat_columns ON public.crm_workflows;
CREATE TRIGGER crm_workflows_sync_compat_columns
	BEFORE INSERT OR UPDATE OF steps, actions, is_active, active
	ON public.crm_workflows
	FOR EACH ROW EXECUTE FUNCTION public.sync_crm_workflow_compat_columns();

ALTER TABLE IF EXISTS public.crm_workflow_runs
	ADD COLUMN IF NOT EXISTS result jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS public.crm_workflow_jobs
	ADD COLUMN IF NOT EXISTS step_index integer NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS result jsonb NOT NULL DEFAULT '{}'::jsonb,
	ADD COLUMN IF NOT EXISTS error_message text,
	ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS scheduled_at timestamptz DEFAULT now(),
	ADD COLUMN IF NOT EXISTS processed_at timestamptz,
	ADD COLUMN IF NOT EXISTS scheduled_for timestamptz DEFAULT now(),
	ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3,
	ADD COLUMN IF NOT EXISTS last_error text,
	ADD COLUMN IF NOT EXISTS executed_at timestamptz;

ALTER TABLE IF EXISTS public.crm_workflow_jobs
	ALTER COLUMN action_config SET DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.sync_crm_workflow_job_compat_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		NEW.scheduled_for := COALESCE(NEW.scheduled_at, NEW.scheduled_for, now());
		NEW.scheduled_at := NEW.scheduled_for;
		NEW.attempts := COALESCE(NEW.retry_count, NEW.attempts, 0);
		NEW.retry_count := NEW.attempts;
		NEW.last_error := COALESCE(NEW.error_message, NEW.last_error);
		NEW.error_message := NEW.last_error;
		NEW.executed_at := COALESCE(NEW.processed_at, NEW.executed_at);
		NEW.processed_at := NEW.executed_at;
		RETURN NEW;
	END IF;

	IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
		NEW.scheduled_for := NEW.scheduled_at;
	ELSIF NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for THEN
		NEW.scheduled_at := NEW.scheduled_for;
	END IF;
	IF NEW.retry_count IS DISTINCT FROM OLD.retry_count THEN
		NEW.attempts := NEW.retry_count;
	ELSIF NEW.attempts IS DISTINCT FROM OLD.attempts THEN
		NEW.retry_count := NEW.attempts;
	END IF;
	IF NEW.error_message IS DISTINCT FROM OLD.error_message THEN
		NEW.last_error := NEW.error_message;
	ELSIF NEW.last_error IS DISTINCT FROM OLD.last_error THEN
		NEW.error_message := NEW.last_error;
	END IF;
	IF NEW.processed_at IS DISTINCT FROM OLD.processed_at THEN
		NEW.executed_at := NEW.processed_at;
	ELSIF NEW.executed_at IS DISTINCT FROM OLD.executed_at THEN
		NEW.processed_at := NEW.executed_at;
	END IF;
	RETURN NEW;
END;
$$;

DO $$
BEGIN
	IF to_regclass('public.crm_workflow_jobs') IS NOT NULL THEN
		DROP TRIGGER IF EXISTS crm_workflow_jobs_sync_compat_columns ON public.crm_workflow_jobs;
		CREATE TRIGGER crm_workflow_jobs_sync_compat_columns
			BEFORE INSERT OR UPDATE OF scheduled_at, scheduled_for, retry_count, attempts,
				error_message, last_error, processed_at, executed_at
			ON public.crm_workflow_jobs
			FOR EACH ROW EXECUTE FUNCTION public.sync_crm_workflow_job_compat_columns();
	END IF;
END;
$$;

-- Existing zero-row CRM tables permit a safe, deterministic email identity key.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM public.crm_contacts
		WHERE business_id IS NOT NULL AND email IS NOT NULL
		GROUP BY business_id, lower(email)
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'Duplicate business-scoped contact emails must be resolved before CRM uniqueness is enforced';
	END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_business_email_uidx
	ON public.crm_contacts (business_id, email_key);

CREATE INDEX IF NOT EXISTS crm_contacts_project_scope_idx
	ON public.crm_contacts (project_id, business_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_leads_project_scope_idx
	ON public.crm_leads (project_id, business_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_activities_project_scope_idx
	ON public.crm_activities (project_id, business_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_workflows_project_scope_idx
	ON public.crm_workflows (project_id, business_id) WHERE project_id IS NOT NULL;

DO $$
DECLARE
	policy_row record;
	v_table_name text;
BEGIN
	FOREACH v_table_name IN ARRAY ARRAY['crm_contacts', 'crm_leads', 'crm_activities', 'crm_workflows', 'crm_deals'] LOOP
		FOR policy_row IN
			SELECT policyname FROM pg_policies
			WHERE schemaname = 'public' AND tablename = v_table_name
		LOOP
			EXECUTE format('DROP POLICY %I ON public.%I', policy_row.policyname, v_table_name);
		END LOOP;
	END LOOP;
END;
$$;

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.crm_project_business_matches(p_project_id uuid, p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT EXISTS (
		SELECT 1 FROM public.projects p
		WHERE p.id = p_project_id
			AND p.business_id IS NOT DISTINCT FROM p_business_id
	);
$$;
REVOKE ALL ON FUNCTION private.crm_project_business_matches(uuid, uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.crm_project_business_matches(uuid, uuid) TO authenticated;

CREATE POLICY crm_contacts_scope_select ON public.crm_contacts
	FOR SELECT TO authenticated
	USING (
		(
			project_id IS NOT NULL
			AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_contacts.project_id, crm_contacts.business_id))
		)
		OR (
			project_id IS NULL
			AND (
				(business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
				OR user_id = (SELECT auth.uid())
			)
		)
	);

CREATE POLICY crm_contacts_scope_insert ON public.crm_contacts
	FOR INSERT TO authenticated
	WITH CHECK (
		(
			project_id IS NOT NULL
			AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_contacts.project_id, crm_contacts.business_id))
		)
		OR (
			project_id IS NULL
			AND business_id IS NOT NULL
			AND (SELECT public.is_business_member(business_id))
		)
	);

CREATE POLICY crm_contacts_scope_update ON public.crm_contacts
	FOR UPDATE TO authenticated
	USING (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_contacts.project_id, crm_contacts.business_id)))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
	)
	WITH CHECK (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_contacts.project_id, crm_contacts.business_id)))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
	);

CREATE POLICY crm_contacts_scope_delete ON public.crm_contacts
	FOR DELETE TO authenticated
	USING (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = crm_contacts.project_id
				AND p.business_id IS NOT DISTINCT FROM crm_contacts.business_id))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
	);

CREATE POLICY crm_leads_scope_select ON public.crm_leads
	FOR SELECT TO authenticated
	USING (
		(
			project_id IS NOT NULL
			AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_leads.project_id, crm_leads.business_id))
		)
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
		OR (project_id IS NULL AND business_id IS NULL AND user_id = (SELECT auth.uid()))
	);

CREATE POLICY crm_leads_scope_insert ON public.crm_leads
	FOR INSERT TO authenticated
	WITH CHECK (
		(
			project_id IS NOT NULL
			AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_leads.project_id, crm_leads.business_id))
		)
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
	);

CREATE POLICY crm_leads_scope_update ON public.crm_leads
	FOR UPDATE TO authenticated
	USING (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_leads.project_id, crm_leads.business_id)))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
		OR (project_id IS NULL AND business_id IS NULL AND user_id = (SELECT auth.uid()))
	)
	WITH CHECK (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_leads.project_id, crm_leads.business_id)))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
		OR (project_id IS NULL AND business_id IS NULL AND user_id = (SELECT auth.uid()))
	);

CREATE POLICY crm_leads_scope_delete ON public.crm_leads
	FOR DELETE TO authenticated
	USING (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_leads.project_id, crm_leads.business_id)))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
		OR (project_id IS NULL AND business_id IS NULL AND user_id = (SELECT auth.uid()))
	);

CREATE POLICY crm_activities_scope_select ON public.crm_activities
	FOR SELECT TO authenticated
	USING (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_activities.project_id, crm_activities.business_id)))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
		OR (project_id IS NULL AND business_id IS NULL AND user_id = (SELECT auth.uid()))
	);

CREATE POLICY crm_activities_scope_insert ON public.crm_activities
	FOR INSERT TO authenticated
	WITH CHECK (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_activities.project_id, crm_activities.business_id)))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
	);

CREATE POLICY crm_activities_scope_update ON public.crm_activities
	FOR UPDATE TO authenticated
	USING (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_activities.project_id, crm_activities.business_id)))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
	)
	WITH CHECK (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = crm_activities.project_id
				AND p.business_id IS NOT DISTINCT FROM crm_activities.business_id))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
	);

CREATE POLICY crm_activities_scope_delete ON public.crm_activities
	FOR DELETE TO authenticated
	USING (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = crm_activities.project_id
				AND p.business_id IS NOT DISTINCT FROM crm_activities.business_id))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
	);

CREATE POLICY crm_workflows_scope_select ON public.crm_workflows
	FOR SELECT TO authenticated
	USING (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_workflows.project_id, crm_workflows.business_id)))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
		OR (project_id IS NULL AND business_id IS NULL AND user_id = (SELECT auth.uid()))
	);

CREATE POLICY crm_workflows_scope_insert ON public.crm_workflows
	FOR INSERT TO authenticated
	WITH CHECK (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_workflows.project_id, crm_workflows.business_id)))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
	);

CREATE POLICY crm_workflows_scope_update ON public.crm_workflows
	FOR UPDATE TO authenticated
	USING (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_workflows.project_id, crm_workflows.business_id)))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
	)
	WITH CHECK (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = crm_workflows.project_id
				AND p.business_id IS NOT DISTINCT FROM crm_workflows.business_id))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
	);

CREATE POLICY crm_workflows_scope_delete ON public.crm_workflows
	FOR DELETE TO authenticated
	USING (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = crm_workflows.project_id
				AND p.business_id IS NOT DISTINCT FROM crm_workflows.business_id))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
	);

CREATE INDEX IF NOT EXISTS crm_deals_project_scope_idx
	ON public.crm_deals (project_id, business_id) WHERE project_id IS NOT NULL;

CREATE POLICY crm_deals_scope_select ON public.crm_deals
	FOR SELECT TO authenticated
	USING (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_deals.project_id, crm_deals.business_id)))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
		OR (project_id IS NULL AND business_id IS NULL AND user_id = (SELECT auth.uid()))
	);

CREATE POLICY crm_deals_scope_insert ON public.crm_deals
	FOR INSERT TO authenticated
	WITH CHECK (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_deals.project_id, crm_deals.business_id)))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
	);

CREATE POLICY crm_deals_scope_update ON public.crm_deals
	FOR UPDATE TO authenticated
	USING (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_deals.project_id, crm_deals.business_id)))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
	)
	WITH CHECK (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_deals.project_id, crm_deals.business_id)))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
	);

CREATE POLICY crm_deals_scope_delete ON public.crm_deals
	FOR DELETE TO authenticated
	USING (
		(project_id IS NOT NULL AND (SELECT public.is_project_member((SELECT auth.uid()), project_id))
			AND (SELECT private.crm_project_business_matches(crm_deals.project_id, crm_deals.business_id)))
		OR (project_id IS NULL AND business_id IS NOT NULL AND (SELECT public.is_business_member(business_id)))
	);
