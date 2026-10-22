-- Every confirmed site booking must also enter the owning business's CRM
-- pipeline. This trigger runs inside the booking transaction, so a booking
-- cannot be reported committed without its corresponding lead row.
CREATE OR REPLACE FUNCTION private.create_booking_crm_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
	linked_project_id uuid;
	linked_contact_id uuid;
BEGIN
	IF NEW.business_id IS NULL OR NEW.site_id IS NULL THEN
		RETURN NEW;
	END IF;

	SELECT project.id
		INTO linked_project_id
		FROM public.projects AS project
	 WHERE project.site_id = NEW.site_id
		 AND project.business_id = NEW.business_id
	 ORDER BY project.created_at DESC
	 LIMIT 1;

	SELECT contact.id
		INTO linked_contact_id
		FROM public.crm_contacts AS contact
	 WHERE contact.business_id = NEW.business_id
		 AND lower(contact.email) = lower(NEW.customer_email)
	 ORDER BY contact.created_at ASC
	 LIMIT 1;

	IF linked_contact_id IS NULL THEN
		BEGIN
			INSERT INTO public.crm_contacts (
				business_id, project_id, email, first_name, last_name, phone, source, tags
			)
			VALUES (
				NEW.business_id,
				linked_project_id,
				lower(NEW.customer_email),
				split_part(trim(NEW.customer_name), ' ', 1),
				NULLIF(trim(substr(trim(NEW.customer_name), length(split_part(trim(NEW.customer_name), ' ', 1)) + 1)), ''),
				NEW.customer_phone,
				'booking',
				ARRAY['booking']::text[]
			)
			RETURNING id INTO linked_contact_id;
		EXCEPTION WHEN unique_violation THEN
			-- crm_contacts.email is globally unique in older installations. Keep
			-- the tenant-scoped lead even when that legacy constraint prevents a
			-- second contact row for the same address.
			linked_contact_id := NULL;
		END;
	END IF;

	INSERT INTO public.crm_leads (
		business_id, project_id, contact_id, title, status, source, notes,
		email, name, intent, metadata
	)
	VALUES (
		NEW.business_id,
		linked_project_id,
		linked_contact_id,
		'Booking: ' || NEW.service_name,
		'new',
		'booking',
		concat_ws(E'\n', NULLIF(NEW.notes, ''), 'Scheduled: ' || NEW.starts_at::text),
		lower(NEW.customer_email),
		NEW.customer_name,
		'booking.create',
		jsonb_build_object(
			'booking_id', NEW.id,
			'site_id', NEW.site_id,
			'service_id', NEW.service_id,
			'service_name', NEW.service_name,
			'starts_at', NEW.starts_at,
			'ends_at', NEW.ends_at,
			'customer_phone', NEW.customer_phone
		)
	);

	RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.create_booking_crm_lead() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.create_booking_crm_lead() TO service_role;

DROP TRIGGER IF EXISTS bookings_create_crm_lead ON public.bookings;
CREATE TRIGGER bookings_create_crm_lead
	AFTER INSERT ON public.bookings
	FOR EACH ROW
	EXECUTE FUNCTION private.create_booking_crm_lead();
