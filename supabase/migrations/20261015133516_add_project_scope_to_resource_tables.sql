ALTER TABLE public.services
	ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.products
	ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.menu_items
	ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.pricing_plans
	ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.featured_offers
	ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.testimonials
	ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.portfolio_projects
	ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.availability_slots
	ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.content_types
	ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.content_entries
	ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_services_business_project ON public.services (business_id, project_id);
CREATE INDEX IF NOT EXISTS idx_products_business_project ON public.products (business_id, project_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_business_project ON public.menu_items (business_id, project_id);
CREATE INDEX IF NOT EXISTS idx_pricing_plans_business_project ON public.pricing_plans (business_id, project_id);
CREATE INDEX IF NOT EXISTS idx_featured_offers_business_project ON public.featured_offers (business_id, project_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_business_project ON public.testimonials (business_id, project_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_business_project ON public.portfolio_projects (business_id, project_id);
CREATE INDEX IF NOT EXISTS idx_availability_slots_business_project ON public.availability_slots (business_id, project_id);
CREATE INDEX IF NOT EXISTS idx_content_types_business_project ON public.content_types (business_id, project_id);
CREATE INDEX IF NOT EXISTS idx_content_entries_business_project ON public.content_entries (business_id, project_id);
