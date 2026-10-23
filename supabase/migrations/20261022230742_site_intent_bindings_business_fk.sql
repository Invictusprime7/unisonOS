-- site_intent_bindings.business_id is a Unison business UUID, not an auth user UUID.
-- RLS already scopes this value with is_business_member(business_id).
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conrelid = 'public.site_intent_bindings'::regclass
			AND conname = 'site_intent_bindings_business_id_businesses_fkey'
	) THEN
		IF EXISTS (
			SELECT 1
			FROM pg_constraint
			WHERE conrelid = 'public.site_intent_bindings'::regclass
				AND conname = 'site_intent_bindings_business_id_fkey'
				AND confrelid = 'auth.users'::regclass
		) THEN
			ALTER TABLE public.site_intent_bindings
				DROP CONSTRAINT site_intent_bindings_business_id_fkey;
		END IF;

		ALTER TABLE public.site_intent_bindings
			ADD CONSTRAINT site_intent_bindings_business_id_businesses_fkey
			FOREIGN KEY (business_id)
			REFERENCES public.businesses(id)
			ON DELETE CASCADE
			NOT VALID;
	END IF;
END
$$;

ALTER TABLE public.site_intent_bindings
	VALIDATE CONSTRAINT site_intent_bindings_business_id_businesses_fkey;

NOTIFY pgrst, 'reload schema';
