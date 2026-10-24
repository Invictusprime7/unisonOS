-- Marketplace listing cover images.
-- Published cards need a static snapshot cover. The listing stores the URL the
-- creator's release should show as its cover; the release preview stays on the
-- placeholder-safe package and the card never mounts a preview runtime.
ALTER TABLE public.marketplace_listings
	ADD COLUMN cover_image_url TEXT
	CHECK (
		cover_image_url IS NULL
		OR (
			length(btrim(cover_image_url)) > 0
			AND cover_image_url !~* '^(javascript|data|vbscript):'
		)
	);

DROP VIEW public.marketplace_public_listings;

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
	cover_image_url,
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
	cover_image_url,
	current_release_id,
	created_at,
	updated_at
) ON TABLE public.marketplace_listings TO anon, authenticated;
GRANT ALL ON TABLE public.marketplace_listings TO service_role;

-- Backfill the cover for the already-published release so its card stops
-- showing "Cover image unavailable". The image is the creator-supplied
-- site snapshot uploaded to the platform CDN.
UPDATE public.marketplace_listings
SET cover_image_url = '/__l5e/assets-v1/3c1e391b-68b5-4d4f-8680-a4382cdca519/keepspinnin-cover.png',
	updated_at = now()
WHERE title ILIKE 'keepspinnin%records%'
	AND cover_image_url IS NULL;
