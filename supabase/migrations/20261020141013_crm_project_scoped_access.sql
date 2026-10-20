-- Project-owned CRM rows must be isolated by project_id, not only business_id.
-- Preserve historical access for rows that predate project assignment.

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_form_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Users can view own contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "crm_contacts_business_member" ON public.crm_contacts;
DROP POLICY IF EXISTS "crm_contacts_insert" ON public.crm_contacts;
DROP POLICY IF EXISTS "crm_contacts_select" ON public.crm_contacts;

CREATE POLICY crm_contacts_project_select
	ON public.crm_contacts FOR SELECT TO authenticated
	USING (
		(
			project_id IS NOT NULL
			AND public.is_project_member(auth.uid(), project_id)
			AND EXISTS (
				SELECT 1 FROM public.projects p
				WHERE p.id = crm_contacts.project_id
					AND p.business_id IS NOT DISTINCT FROM crm_contacts.business_id
			)
		)
		OR (
			project_id IS NULL
			AND (
				user_id = auth.uid()
				OR (business_id IS NOT NULL AND public.is_business_member(business_id))
			)
		)
	);

CREATE POLICY crm_contacts_project_insert
	ON public.crm_contacts FOR INSERT TO authenticated
	WITH CHECK (
		(
			project_id IS NOT NULL
			AND public.is_project_member(auth.uid(), project_id)
			AND EXISTS (
				SELECT 1 FROM public.projects p
				WHERE p.id = crm_contacts.project_id
					AND p.business_id IS NOT DISTINCT FROM crm_contacts.business_id
			)
		)
		OR (
			project_id IS NULL
			AND (
				user_id = auth.uid()
				OR (business_id IS NOT NULL AND public.is_business_member(business_id))
			)
		)
	);

CREATE POLICY crm_contacts_project_update
	ON public.crm_contacts FOR UPDATE TO authenticated
	USING (
		(
			project_id IS NOT NULL
			AND public.is_project_member(auth.uid(), project_id)
			AND EXISTS (
				SELECT 1 FROM public.projects p
				WHERE p.id = crm_contacts.project_id
					AND p.business_id IS NOT DISTINCT FROM crm_contacts.business_id
			)
		)
		OR (
			project_id IS NULL
			AND (
				user_id = auth.uid()
				OR (business_id IS NOT NULL AND public.is_business_member(business_id))
			)
		)
	)
	WITH CHECK (
		(
			project_id IS NOT NULL
			AND public.is_project_member(auth.uid(), project_id)
			AND EXISTS (
				SELECT 1 FROM public.projects p
				WHERE p.id = crm_contacts.project_id
					AND p.business_id IS NOT DISTINCT FROM crm_contacts.business_id
			)
		)
		OR (
			project_id IS NULL
			AND (
				user_id = auth.uid()
				OR (business_id IS NOT NULL AND public.is_business_member(business_id))
			)
		)
	);

CREATE POLICY crm_contacts_project_delete
	ON public.crm_contacts FOR DELETE TO authenticated
	USING (
		(
			project_id IS NOT NULL
			AND public.is_project_member(auth.uid(), project_id)
			AND EXISTS (
				SELECT 1 FROM public.projects p
				WHERE p.id = crm_contacts.project_id
					AND p.business_id IS NOT DISTINCT FROM crm_contacts.business_id
			)
		)
		OR (
			project_id IS NULL
			AND (
				user_id = auth.uid()
				OR (business_id IS NOT NULL AND public.is_business_member(business_id))
			)
		)
	);

DROP POLICY IF EXISTS "Users can delete leads in their workspaces" ON public.crm_leads;
DROP POLICY IF EXISTS "Users can insert leads in their workspaces" ON public.crm_leads;
DROP POLICY IF EXISTS "Users can update leads in their workspaces" ON public.crm_leads;
DROP POLICY IF EXISTS "Users can view leads in their workspaces" ON public.crm_leads;
DROP POLICY IF EXISTS "crm_leads_business_member" ON public.crm_leads;
DROP POLICY IF EXISTS "crm_leads_insert_own" ON public.crm_leads;
DROP POLICY IF EXISTS "crm_leads_select_member" ON public.crm_leads;
DROP POLICY IF EXISTS "crm_leads_select_own" ON public.crm_leads;

CREATE POLICY crm_leads_project_select
	ON public.crm_leads FOR SELECT TO authenticated
	USING (
		(
			project_id IS NOT NULL
			AND public.is_project_member(auth.uid(), project_id)
			AND EXISTS (
				SELECT 1 FROM public.projects p
				WHERE p.id = crm_leads.project_id
					AND p.business_id IS NOT DISTINCT FROM crm_leads.business_id
			)
		)
		OR (
			project_id IS NULL
			AND (
				user_id = auth.uid()
				OR (business_id IS NOT NULL AND public.is_business_member(business_id))
				OR EXISTS (
					SELECT 1 FROM public.workspace_members wm
					WHERE wm.workspace_id = crm_leads.workspace_id
						AND wm.user_id = auth.uid()
				)
			)
		)
	);

CREATE POLICY crm_leads_project_insert
	ON public.crm_leads FOR INSERT TO authenticated
	WITH CHECK (
		(
			project_id IS NOT NULL
			AND public.is_project_member(auth.uid(), project_id)
			AND EXISTS (
				SELECT 1 FROM public.projects p
				WHERE p.id = crm_leads.project_id
					AND p.business_id IS NOT DISTINCT FROM crm_leads.business_id
			)
		)
		OR (
			project_id IS NULL
			AND (
				user_id = auth.uid()
				OR (business_id IS NOT NULL AND public.is_business_member(business_id))
				OR EXISTS (
					SELECT 1 FROM public.workspace_members wm
					WHERE wm.workspace_id = crm_leads.workspace_id
						AND wm.user_id = auth.uid()
				)
			)
		)
	);

CREATE POLICY crm_leads_project_update
	ON public.crm_leads FOR UPDATE TO authenticated
	USING (
		(
			project_id IS NOT NULL
			AND public.is_project_member(auth.uid(), project_id)
			AND EXISTS (
				SELECT 1 FROM public.projects p
				WHERE p.id = crm_leads.project_id
					AND p.business_id IS NOT DISTINCT FROM crm_leads.business_id
			)
		)
		OR (
			project_id IS NULL
			AND (
				user_id = auth.uid()
				OR (business_id IS NOT NULL AND public.is_business_member(business_id))
				OR EXISTS (
					SELECT 1 FROM public.workspace_members wm
					WHERE wm.workspace_id = crm_leads.workspace_id
						AND wm.user_id = auth.uid()
				)
			)
		)
	)
	WITH CHECK (
		(
			project_id IS NOT NULL
			AND public.is_project_member(auth.uid(), project_id)
			AND EXISTS (
				SELECT 1 FROM public.projects p
				WHERE p.id = crm_leads.project_id
					AND p.business_id IS NOT DISTINCT FROM crm_leads.business_id
			)
		)
		OR (
			project_id IS NULL
			AND (
				user_id = auth.uid()
				OR (business_id IS NOT NULL AND public.is_business_member(business_id))
				OR EXISTS (
					SELECT 1 FROM public.workspace_members wm
					WHERE wm.workspace_id = crm_leads.workspace_id
						AND wm.user_id = auth.uid()
				)
			)
		)
	);

CREATE POLICY crm_leads_project_delete
	ON public.crm_leads FOR DELETE TO authenticated
	USING (
		(
			project_id IS NOT NULL
			AND public.is_project_member(auth.uid(), project_id)
			AND EXISTS (
				SELECT 1 FROM public.projects p
				WHERE p.id = crm_leads.project_id
					AND p.business_id IS NOT DISTINCT FROM crm_leads.business_id
			)
		)
		OR (
			project_id IS NULL
			AND (
				user_id = auth.uid()
				OR (business_id IS NOT NULL AND public.is_business_member(business_id))
				OR EXISTS (
					SELECT 1 FROM public.workspace_members wm
					WHERE wm.workspace_id = crm_leads.workspace_id
						AND wm.user_id = auth.uid()
				)
			)
		)
	);

DROP POLICY IF EXISTS crm_form_submissions_select_business_member
	ON public.crm_form_submissions;
CREATE POLICY crm_form_submissions_project_select
	ON public.crm_form_submissions FOR SELECT TO authenticated
	USING (
		(
			project_id IS NOT NULL
			AND public.is_project_member(auth.uid(), project_id)
			AND EXISTS (
				SELECT 1 FROM public.projects p
				WHERE p.id = crm_form_submissions.project_id
					AND p.business_id IS NOT DISTINCT FROM crm_form_submissions.business_id
			)
		)
		OR (
			project_id IS NULL
			AND business_id IS NOT NULL
			AND public.is_business_member(business_id)
		)
	);
