CREATE TABLE IF NOT EXISTS public.resource_mutation_audit (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
	project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
	site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
	actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
	resource_key text NOT NULL CHECK (length(trim(resource_key)) BETWEEN 1 AND 120),
	action text NOT NULL CHECK (action IN (
		'create', 'update', 'delete',
		'content-type-create', 'content-type-update',
		'content-entry-create', 'content-entry-update', 'content-entry-transition'
	)),
	record_id uuid,
	metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resource_mutation_audit_business_created_idx
	ON public.resource_mutation_audit (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS resource_mutation_audit_project_created_idx
	ON public.resource_mutation_audit (project_id, created_at DESC)
	WHERE project_id IS NOT NULL;

ALTER TABLE public.resource_mutation_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.resource_mutation_audit FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.resource_mutation_audit TO service_role;
