-- R6-P1 trusted marketplace promotion. Additive. Service-role writes only.
CREATE TABLE public.marketplace_asset_rights (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	asset_sha256 TEXT NOT NULL UNIQUE CHECK (asset_sha256 ~ '^[a-f0-9]{64}$'),
	asset_source TEXT NOT NULL CHECK (length(btrim(asset_source)) > 0),
	license TEXT NOT NULL CHECK (length(btrim(license)) > 0),
	evidence_ref TEXT NOT NULL CHECK (length(btrim(evidence_ref)) > 0),
	commercial_use BOOLEAN NOT NULL,
	bundled_redistribution BOOLEAN NOT NULL,
	reviewer_user_id UUID NOT NULL,
	reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE public.marketplace_asset_rights FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.marketplace_asset_rights TO service_role;
ALTER TABLE public.marketplace_asset_rights ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.marketplace_release_reviews (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	release_id UUID NOT NULL REFERENCES public.marketplace_releases(id) ON DELETE RESTRICT,
	accepted_revision_id UUID NOT NULL,
	snapshot_sha256 TEXT NOT NULL CHECK (snapshot_sha256 ~ '^[a-fA-F0-9]{64}$'),
	reviewer_user_id UUID NOT NULL,
	evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_refs) = 'array'),
	design_verdict TEXT NOT NULL CHECK (design_verdict IN ('pass','fail')),
	asset_verdict TEXT NOT NULL CHECK (asset_verdict IN ('pass','fail')),
	security_verdict TEXT NOT NULL CHECK (security_verdict IN ('pass','fail')),
	build_verdict TEXT NOT NULL CHECK (build_verdict IN ('pass','fail')),
	a11y_verdict TEXT NOT NULL CHECK (a11y_verdict IN ('pass','fail')),
	mobile_verdict TEXT NOT NULL CHECK (mobile_verdict IN ('pass','fail')),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	revoked_at TIMESTAMPTZ,
	revoked_reason TEXT
);
CREATE INDEX marketplace_release_reviews_release_idx ON public.marketplace_release_reviews (release_id);
REVOKE ALL ON TABLE public.marketplace_release_reviews FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.marketplace_release_reviews TO service_role;
ALTER TABLE public.marketplace_release_reviews ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.marketplace_release_artifacts (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	release_id UUID NOT NULL UNIQUE REFERENCES public.marketplace_releases(id) ON DELETE RESTRICT,
	storage_key TEXT NOT NULL CHECK (storage_key ~ '^marketplace-releases/[0-9a-f-]{36}/[A-Za-z0-9._-]+\.zip$'),
	package_sha256 TEXT NOT NULL CHECK (package_sha256 ~ '^[a-f0-9]{64}$'),
	size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
	build_report JSONB NOT NULL CHECK (jsonb_typeof(build_report) = 'object'),
	preview_artifact_sha256 TEXT NOT NULL CHECK (preview_artifact_sha256 ~ '^[a-f0-9]{64}$'),
	review_id UUID NOT NULL REFERENCES public.marketplace_release_reviews(id) ON DELETE RESTRICT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE public.marketplace_release_artifacts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.marketplace_release_artifacts TO service_role;
ALTER TABLE public.marketplace_release_artifacts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.marketplace_entitlements (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	buyer_user_id UUID NOT NULL,
	listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE RESTRICT,
	release_id UUID NOT NULL REFERENCES public.marketplace_releases(id) ON DELETE RESTRICT,
	license_tier TEXT NOT NULL CHECK (license_tier IN ('personal','commercial','agency')),
	grant_source TEXT NOT NULL CHECK (grant_source IN ('free_claim','purchase','staff_grant')),
	grant_key TEXT NOT NULL UNIQUE CHECK (length(btrim(grant_key)) > 0),
	status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
	fulfillment_order_id UUID,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	revoked_at TIMESTAMPTZ
);
CREATE INDEX marketplace_entitlements_buyer_idx ON public.marketplace_entitlements (buyer_user_id);
REVOKE ALL ON TABLE public.marketplace_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.marketplace_entitlements TO authenticated;
GRANT ALL ON TABLE public.marketplace_entitlements TO service_role;
ALTER TABLE public.marketplace_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_entitlements_buyer_select ON public.marketplace_entitlements
	FOR SELECT TO authenticated USING (buyer_user_id = auth.uid());

CREATE TABLE public.marketplace_installations (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	buyer_user_id UUID NOT NULL,
	entitlement_id UUID NOT NULL REFERENCES public.marketplace_entitlements(id) ON DELETE RESTRICT,
	release_id UUID NOT NULL REFERENCES public.marketplace_releases(id) ON DELETE RESTRICT,
	project_id UUID,
	site_id UUID,
	business_id UUID,
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','committed','failed')),
	idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) > 0),
	error_code TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (buyer_user_id, idempotency_key),
	CHECK (status <> 'committed' OR (project_id IS NOT NULL AND site_id IS NOT NULL AND business_id IS NOT NULL))
);
CREATE INDEX marketplace_installations_buyer_idx ON public.marketplace_installations (buyer_user_id);
REVOKE ALL ON TABLE public.marketplace_installations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.marketplace_installations TO authenticated;
GRANT ALL ON TABLE public.marketplace_installations TO service_role;
ALTER TABLE public.marketplace_installations ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_installations_buyer_select ON public.marketplace_installations
	FOR SELECT TO authenticated USING (buyer_user_id = auth.uid());

CREATE FUNCTION public.marketplace_review_revoke_only()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Marketplace reviews cannot be deleted'; END IF;
	IF OLD.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Revoked marketplace reviews are final'; END IF;
	IF (to_jsonb(NEW) - 'revoked_at' - 'revoked_reason') <> (to_jsonb(OLD) - 'revoked_at' - 'revoked_reason') THEN
		RAISE EXCEPTION 'Marketplace review verdicts are immutable; revoke and issue a new review';
	END IF;
	RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.marketplace_review_revoke_only() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER marketplace_release_reviews_revoke_only BEFORE UPDATE OR DELETE ON public.marketplace_release_reviews
	FOR EACH ROW EXECUTE FUNCTION public.marketplace_review_revoke_only();

CREATE FUNCTION public.marketplace_artifact_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'Marketplace release artifacts are immutable'; END; $$;
REVOKE ALL ON FUNCTION public.marketplace_artifact_immutable() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER marketplace_release_artifacts_immutable BEFORE UPDATE OR DELETE ON public.marketplace_release_artifacts
	FOR EACH ROW EXECUTE FUNCTION public.marketplace_artifact_immutable();

CREATE FUNCTION public.assert_marketplace_release_certified()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
	IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
		IF NEW.package_path IS NULL THEN RAISE EXCEPTION 'Published releases require a private package artifact'; END IF;
		IF NOT EXISTS (
			SELECT 1 FROM public.marketplace_release_artifacts a
			JOIN public.marketplace_release_reviews r ON r.id = a.review_id
			WHERE a.release_id = NEW.id AND a.storage_key = NEW.package_path
				AND r.release_id = NEW.id AND r.revoked_at IS NULL
				AND lower(r.snapshot_sha256) = lower(NEW.snapshot_sha256)
				AND r.accepted_revision_id::text = NEW.manifest_json #>> '{source,acceptedRevisionId}'
				AND r.design_verdict = 'pass' AND r.asset_verdict = 'pass' AND r.security_verdict = 'pass'
				AND r.build_verdict = 'pass' AND r.a11y_verdict = 'pass' AND r.mobile_verdict = 'pass'
				AND public.has_role(r.reviewer_user_id, 'admin'::public.app_role)
		) THEN
			RAISE EXCEPTION 'Release is not certified by a trusted all-pass review with a matching artifact';
		END IF;
	END IF;
	RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.assert_marketplace_release_certified() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER marketplace_releases_require_certification BEFORE INSERT OR UPDATE OF status ON public.marketplace_releases
	FOR EACH ROW EXECUTE FUNCTION public.assert_marketplace_release_certified();

GRANT ALL ON FUNCTION public.marketplace_review_revoke_only() TO service_role;
GRANT ALL ON FUNCTION public.marketplace_artifact_immutable() TO service_role;
GRANT ALL ON FUNCTION public.assert_marketplace_release_certified() TO service_role;
