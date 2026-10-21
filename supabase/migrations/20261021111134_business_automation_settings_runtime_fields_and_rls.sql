ALTER TABLE public.business_automation_settings
	ADD COLUMN IF NOT EXISTS business_hours_enabled BOOLEAN DEFAULT false,
	ADD COLUMN IF NOT EXISTS business_hours_start TIME DEFAULT '09:00',
	ADD COLUMN IF NOT EXISTS business_hours_end TIME DEFAULT '17:00',
	ADD COLUMN IF NOT EXISTS business_days INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5],
	ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
	ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN DEFAULT true,
	ADD COLUMN IF NOT EXISTS quiet_hours_start TIME DEFAULT '21:00',
	ADD COLUMN IF NOT EXISTS quiet_hours_end TIME DEFAULT '08:00',
	ADD COLUMN IF NOT EXISTS max_messages_per_contact_per_day INTEGER DEFAULT 5,
	ADD COLUMN IF NOT EXISTS dedupe_window_minutes INTEGER DEFAULT 60,
	ADD COLUMN IF NOT EXISTS default_sender_name TEXT,
	ADD COLUMN IF NOT EXISTS default_sender_email TEXT,
	ADD COLUMN IF NOT EXISTS default_sender_phone TEXT,
	ADD COLUMN IF NOT EXISTS require_consent_for_sms BOOLEAN DEFAULT true,
	ADD COLUMN IF NOT EXISTS require_consent_for_email BOOLEAN DEFAULT false,
	ADD COLUMN IF NOT EXISTS honor_stop_keywords BOOLEAN DEFAULT true,
	ADD COLUMN IF NOT EXISTS automations_enabled BOOLEAN DEFAULT true;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
			AND tablename = 'business_automation_settings'
			AND policyname = 'Business members can view settings'
	) THEN
		CREATE POLICY "Business members can view settings"
			ON public.business_automation_settings
			FOR SELECT TO authenticated
			USING (public.is_business_member(business_id));
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
			AND tablename = 'business_automation_settings'
			AND policyname = 'Business members can insert settings'
	) THEN
		CREATE POLICY "Business members can insert settings"
			ON public.business_automation_settings
			FOR INSERT TO authenticated
			WITH CHECK (public.is_business_member(business_id));
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
			AND tablename = 'business_automation_settings'
			AND policyname = 'Business members can update settings'
	) THEN
		CREATE POLICY "Business members can update settings"
			ON public.business_automation_settings
			FOR UPDATE TO authenticated
			USING (public.is_business_member(business_id))
			WITH CHECK (public.is_business_member(business_id));
	END IF;
END
$$;
