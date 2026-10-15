DROP POLICY IF EXISTS orders_insert_public_valid ON public.orders;
DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;
CREATE POLICY orders_update_business_member ON public.orders
  FOR UPDATE TO authenticated
  USING (business_id IS NOT NULL AND public.is_business_member(business_id))
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));