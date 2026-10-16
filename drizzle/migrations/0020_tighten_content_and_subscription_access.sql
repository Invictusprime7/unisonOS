-- Site content tables: business members manage them; published sites read through the server gateway.
DROP POLICY IF EXISTS "public read featured_offers" ON public.featured_offers;
DROP POLICY IF EXISTS "public read testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "public read portfolio_projects" ON public.portfolio_projects;

-- Internal AI pattern library: server-only.
DROP POLICY IF EXISTS "Anyone can view code patterns" ON public.ai_code_patterns;
DROP POLICY IF EXISTS "ai_code_patterns_insert_authenticated" ON public.ai_code_patterns;
CREATE POLICY "ai_code_patterns_service_only" ON public.ai_code_patterns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Reference registries: server-only (no app screen reads them directly).
DROP POLICY IF EXISTS "lucide_icons_select_public" ON public.lucide_icon_registry;
DROP POLICY IF EXISTS "system_packs_select_authenticated" ON public.system_packs;
CREATE POLICY "system_packs_service_only" ON public.system_packs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Plan and billing fields can only be set by the server (payment webhooks).
CREATE OR REPLACE FUNCTION public.protect_subscription_billing_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR current_user IN ('postgres','supabase_admin','service_role') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.plan := 'free';
    NEW.status := 'active';
    NEW.stripe_customer_id := NULL;
    NEW.stripe_subscription_id := NULL;
    NEW.current_period_start := NULL;
    NEW.current_period_end := NULL;
    RETURN NEW;
  END IF;
  IF NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.current_period_start IS DISTINCT FROM OLD.current_period_start
     OR NEW.current_period_end IS DISTINCT FROM OLD.current_period_end
     OR NEW.cancel_at_period_end IS DISTINCT FROM OLD.cancel_at_period_end THEN
    RAISE EXCEPTION 'Plan and billing details can only be changed through checkout.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_subscription_billing_fields ON public.user_subscriptions;
CREATE TRIGGER protect_subscription_billing_fields
  BEFORE INSERT OR UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.protect_subscription_billing_fields();