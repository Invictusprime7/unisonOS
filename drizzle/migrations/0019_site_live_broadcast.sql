CREATE OR REPLACE FUNCTION public.broadcast_site_live_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_business uuid := COALESCE(NEW.business_id, OLD.business_id);
BEGIN
  IF v_business IS NOT NULL THEN
    BEGIN
      PERFORM realtime.send(
        jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP),
        'changed',
        'site-live:' || v_business::text,
        true
      );
    EXCEPTION WHEN OTHERS THEN
      -- A live-update ping must never block a save.
      NULL;
    END;
  END IF;
  RETURN NULL;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','services','menu_items','pricing_plans','featured_offers','testimonials','portfolio_projects','content_entries'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS site_live_broadcast ON public.%I', t);
    EXECUTE format('CREATE TRIGGER site_live_broadcast AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.broadcast_site_live_change()', t);
  END LOOP;
END $$;