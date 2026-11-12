-- Scope GHL activity reads and updates to the selected project.
CREATE INDEX IF NOT EXISTS idx_ghl_webhook_events_project_created
	ON public.ghl_webhook_events(project_id, created_at DESC);

DROP POLICY IF EXISTS "Business members can read GHL webhook events"
	ON public.ghl_webhook_events;
CREATE POLICY "Project members can read GHL webhook events"
	ON public.ghl_webhook_events
	FOR SELECT TO authenticated
	USING (
		(
			project_id IS NOT NULL
			AND public.is_project_member(auth.uid(), project_id)
			AND EXISTS (
				SELECT 1
				FROM public.projects p
				WHERE p.id = ghl_webhook_events.project_id
					AND p.business_id IS NOT DISTINCT FROM ghl_webhook_events.business_id
			)
		)
		OR (
			project_id IS NULL
			AND business_id IS NOT NULL
			AND public.is_business_member(business_id)
		)
	);

DROP POLICY IF EXISTS "Business members can update GHL webhook events"
	ON public.ghl_webhook_events;
CREATE POLICY "Project members can update GHL webhook events"
	ON public.ghl_webhook_events
	FOR UPDATE TO authenticated
	USING (
		(
			project_id IS NOT NULL
			AND public.is_project_member(auth.uid(), project_id)
			AND EXISTS (
				SELECT 1
				FROM public.projects p
				WHERE p.id = ghl_webhook_events.project_id
					AND p.business_id IS NOT DISTINCT FROM ghl_webhook_events.business_id
			)
		)
		OR (
			project_id IS NULL
			AND business_id IS NOT NULL
			AND public.is_business_member(business_id)
		)
	)
	WITH CHECK (
		(
			project_id IS NOT NULL
			AND public.is_project_member(auth.uid(), project_id)
			AND EXISTS (
				SELECT 1
				FROM public.projects p
				WHERE p.id = ghl_webhook_events.project_id
					AND p.business_id IS NOT DISTINCT FROM ghl_webhook_events.business_id
			)
		)
		OR (
			project_id IS NULL
			AND business_id IS NOT NULL
			AND public.is_business_member(business_id)
		)
	);
