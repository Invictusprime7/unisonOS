CREATE TABLE public.marketplace_listings (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	slug TEXT NOT NULL UNIQUE
		CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	creator_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
	product_type TEXT NOT NULL
		CHECK (product_type IN ('site_template', 'brand_ui_kit', 'industry_launch_kit', 'section_pack')),
	title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
	industry_key TEXT NOT NULL CHECK (length(btrim(industry_key)) > 0),
	summary TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL DEFAULT 'draft'
		CHECK (status IN ('draft', 'in_review', 'published', 'suspended', 'retired')),
	price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
	currency TEXT NOT NULL DEFAULT 'usd'
		CHECK (currency = lower(currency) AND currency ~ '^[a-z]{3}$'),
	current_release_id UUID,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.marketplace_releases (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	listing_id UUID NOT NULL
		REFERENCES public.marketplace_listings(id) ON DELETE RESTRICT,
	version TEXT NOT NULL CHECK (length(btrim(version)) > 0),
	manifest_json JSONB NOT NULL
		CONSTRAINT marketplace_releases_manifest_json_check
		CHECK (
			jsonb_typeof(manifest_json) = 'object'
			AND COALESCE(manifest_json ->> 'schemaVersion' = 'marketplace-design-release/1', false)
			AND COALESCE(
				manifest_json ->> 'productType' IN ('site_template', 'brand_ui_kit', 'industry_launch_kit', 'section_pack'),
				false
			)
		),
	snapshot_path TEXT NOT NULL
		CHECK (length(btrim(snapshot_path)) > 0 AND snapshot_path !~* '^https?://'),
	package_path TEXT
		CHECK (package_path IS NULL OR (length(btrim(package_path)) > 0 AND package_path !~* '^https?://')),
	snapshot_sha256 TEXT NOT NULL
		CHECK (snapshot_sha256 ~ '^[a-fA-F0-9]{64}$'),
	certification_json JSONB,
	status TEXT NOT NULL DEFAULT 'draft'
		CHECK (status IN ('draft', 'in_review', 'published', 'retired', 'suspended')),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (listing_id, version),
	UNIQUE (listing_id, id),
	CONSTRAINT marketplace_releases_snapshot_hash_matches_manifest_check
	CHECK (
		manifest_json #>> '{source,snapshotSha256}' IS NOT NULL
		AND manifest_json #>> '{source,snapshotSha256}' = snapshot_sha256
	)
);

ALTER TABLE public.marketplace_listings
	ADD CONSTRAINT marketplace_listings_current_release_fk
	FOREIGN KEY (id, current_release_id)
	REFERENCES public.marketplace_releases (listing_id, id);

CREATE INDEX marketplace_listings_published_browse_idx
	ON public.marketplace_listings (industry_key, product_type, price_cents)
	WHERE status = 'published';

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketplace_listings_public_published_select
	ON public.marketplace_listings
	FOR SELECT
	TO anon, authenticated
	USING (status = 'published');

CREATE POLICY marketplace_releases_deny_client_select
	ON public.marketplace_releases
	FOR SELECT
	TO anon, authenticated
	USING (false);

CREATE POLICY marketplace_releases_deny_client_insert
	ON public.marketplace_releases
	FOR INSERT
	TO anon, authenticated
	WITH CHECK (false);

CREATE POLICY marketplace_releases_deny_client_update
	ON public.marketplace_releases
	FOR UPDATE
	TO anon, authenticated
	USING (false)
	WITH CHECK (false);

CREATE POLICY marketplace_releases_deny_client_delete
	ON public.marketplace_releases
	FOR DELETE
	TO anon, authenticated
	USING (false);

CREATE VIEW public.marketplace_public_listings
WITH (security_invoker = true)
AS
SELECT
	id,
	slug,
	product_type,
	title,
	industry_key,
	summary,
	price_cents,
	currency,
	current_release_id,
	created_at,
	updated_at
FROM public.marketplace_listings
WHERE status = 'published';

REVOKE ALL ON TABLE public.marketplace_public_listings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.marketplace_public_listings TO anon, authenticated;

REVOKE ALL ON TABLE public.marketplace_listings FROM PUBLIC, anon, authenticated;
GRANT SELECT (
	id,
	slug,
	product_type,
	title,
	industry_key,
	summary,
	status,
	price_cents,
	currency,
	current_release_id,
	created_at,
	updated_at
) ON TABLE public.marketplace_listings TO anon, authenticated;
GRANT SELECT ON TABLE public.marketplace_public_listings TO anon, authenticated;
GRANT ALL ON TABLE public.marketplace_listings TO service_role;

REVOKE ALL ON TABLE public.marketplace_releases FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.marketplace_releases TO service_role;

CREATE FUNCTION public.prevent_published_marketplace_release_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
	IF OLD.status = 'published' THEN
		RAISE EXCEPTION 'Published marketplace releases are immutable';
	END IF;

	IF TG_OP = 'DELETE' THEN
		RETURN OLD;
	END IF;

	RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_published_marketplace_release_mutation()
	FROM PUBLIC, anon, authenticated;

CREATE TRIGGER marketplace_releases_immutable_after_publish
	BEFORE UPDATE OR DELETE ON public.marketplace_releases
	FOR EACH ROW
	EXECUTE FUNCTION public.prevent_published_marketplace_release_mutation();

CREATE FUNCTION public.assert_marketplace_current_release_published()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
	IF NEW.status = 'published' AND NEW.current_release_id IS NULL THEN
		RAISE EXCEPTION 'Published marketplace listings must reference a release';
	END IF;

	IF NEW.current_release_id IS NOT NULL AND NOT EXISTS (
		SELECT 1
		FROM public.marketplace_releases AS release
		WHERE release.id = NEW.current_release_id
			AND release.listing_id = NEW.id
			AND release.status = 'published'
			AND release.manifest_json ->> 'productType' = NEW.product_type
	) THEN
		RAISE EXCEPTION 'Current marketplace release must be published for this listing';
	END IF;

	RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_marketplace_current_release_published()
	FROM PUBLIC, anon, authenticated;

CREATE TRIGGER marketplace_listings_current_release_published
	BEFORE INSERT OR UPDATE OF current_release_id, product_type, status ON public.marketplace_listings
	FOR EACH ROW
	EXECUTE FUNCTION public.assert_marketplace_current_release_published();

GRANT ALL ON FUNCTION public.prevent_published_marketplace_release_mutation() TO service_role;
GRANT ALL ON FUNCTION public.assert_marketplace_current_release_published() TO service_role;
