// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';

const reviewer = '11111111-1111-4111-8111-111111111111';
const listing = '22222222-2222-4222-8222-222222222222';
const release = '33333333-3333-4333-8333-333333333333';
const revision = '44444444-4444-4444-8444-444444444444';
const review = '55555555-5555-4555-8555-555555555555';
const other = '66666666-6666-4666-8666-666666666666';
const hash = 'a'.repeat(64);
const packagePath = `marketplace-releases/${release}/source.zip`;

describe('trusted marketplace promotion (local database, not live RLS proof)', () => {
  let pg: PGlite;
  beforeEach(async () => {
    pg = new PGlite();
    await pg.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
        $$ SELECT nullif(current_setting('test.user_id', true), '')::uuid $$;
      CREATE TYPE public.app_role AS ENUM ('admin', 'user');
      CREATE TABLE public.user_roles (user_id uuid, role public.app_role);
      CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
        RETURNS boolean LANGUAGE sql AS $$
          SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
        $$;
    `);
    for (const file of ['20261023011222_marketplace_catalog_foundation.sql', '20261024001900_marketplace_trusted_promotion.sql']) {
      await pg.exec(readFileSync(resolve('supabase/migrations', file), 'utf8'));
    }
    await pg.query('INSERT INTO auth.users VALUES ($1)', [reviewer]);
    await pg.query("INSERT INTO public.user_roles VALUES ($1, 'admin')", [reviewer]);
    await pg.query(`INSERT INTO public.marketplace_listings
      (id, slug, creator_user_id, product_type, title, industry_key)
      VALUES ($1, 'first-release', $2, 'site_template', 'Portfolio', 'agency')`, [listing, reviewer]);
    await pg.query(`INSERT INTO public.marketplace_releases
      (id, listing_id, version, manifest_json, snapshot_path, snapshot_sha256, status)
      VALUES ($1, $2, '1', $3::jsonb, 'accepted/revision', $4, 'in_review')`, [release, listing, JSON.stringify({
      schemaVersion: 'marketplace-design-release/1', productType: 'site_template',
      source: { acceptedRevisionId: revision, snapshotSha256: hash },
    }), hash]);
  });
  afterEach(async () => { await pg?.close(); });

  async function evidence(options: { reviewerId?: string; revisionId?: string; sourceHash?: string; verdict?: string } = {}) {
    await pg.query(`INSERT INTO public.marketplace_release_reviews
      (id, release_id, accepted_revision_id, snapshot_sha256, reviewer_user_id,
       design_verdict, asset_verdict, security_verdict, build_verdict, a11y_verdict, mobile_verdict)
      VALUES ($1,$2,$3,$4,$5,'pass','pass','pass',$6,'pass','pass')`,
    [review, release, options.revisionId ?? revision, options.sourceHash ?? hash, options.reviewerId ?? reviewer, options.verdict ?? 'pass']);
    await pg.query(`INSERT INTO public.marketplace_release_artifacts
      (release_id, storage_key, package_sha256, size_bytes, build_report, preview_artifact_sha256, review_id)
      VALUES ($1,$2,$3,100,'{}'::jsonb,$3,$4)`, [release, packagePath, hash, review]);
  }
  async function publish() {
    return pg.query("UPDATE public.marketplace_releases SET package_path = $1, status = 'published' WHERE id = $2", [packagePath, release]);
  }

  it.each(['anon', 'authenticated'])('%s cannot read or write private evidence or create buyer grants', async (role) => {
    await pg.exec(`SET ROLE ${role}`);
    for (const table of ['marketplace_asset_rights', 'marketplace_release_reviews', 'marketplace_release_artifacts']) {
      await expect(pg.query(`SELECT * FROM public.${table}`)).rejects.toThrow(/permission denied/i);
      await expect(pg.query(`DELETE FROM public.${table}`)).rejects.toThrow(/permission denied/i);
    }
    for (const table of ['marketplace_entitlements', 'marketplace_installations']) {
      await expect(pg.query(`DELETE FROM public.${table}`)).rejects.toThrow(/permission denied/i);
      const privileges = await pg.query<{ allowed: boolean }>('SELECT has_table_privilege($1, $2, $3) AS allowed', [role, `public.${table}`, 'INSERT']);
      expect(privileges.rows[0]?.allowed).toBe(false);
    }
  });
  it('refuses publication without a private artifact', async () => {
    await expect(publish()).rejects.toThrow(/not certified/i);
  });
  it.each([
    { reviewerId: other }, { revisionId: other }, { sourceHash: 'b'.repeat(64) }, { verdict: 'fail' },
  ])('refuses untrusted, mismatched, or failed evidence %j', async (options) => {
    await evidence(options);
    await expect(publish()).rejects.toThrow(/not certified/i);
  });
  it('refuses revoked approvals', async () => {
    await evidence();
    await pg.query("UPDATE public.marketplace_release_reviews SET revoked_at = now(), revoked_reason = 'Evidence withdrawn' WHERE id = $1", [review]);
    await expect(publish()).rejects.toThrow(/not certified/i);
  });
  it('keeps verdicts and artifacts immutable', async () => {
    await evidence();
    await expect(pg.query("UPDATE public.marketplace_release_reviews SET build_verdict = 'fail'"))
      .rejects.toThrow(/immutable/i);
    await expect(pg.query('DELETE FROM public.marketplace_release_reviews')).rejects.toThrow(/cannot be deleted/i);
    await expect(pg.query('UPDATE public.marketplace_release_artifacts SET size_bytes = 200')).rejects.toThrow(/immutable/i);
    await expect(pg.query('DELETE FROM public.marketplace_release_artifacts')).rejects.toThrow(/immutable/i);
  });
  it('allows matching all-pass approval and exposes only the listing', async () => {
    await evidence(); await publish();
    await pg.query("UPDATE public.marketplace_listings SET current_release_id = $1, status = 'published' WHERE id = $2", [release, listing]);
    await pg.exec('SET ROLE anon');
    expect((await pg.query('SELECT slug FROM public.marketplace_public_listings')).rows).toEqual([{ slug: 'first-release' }]);
    await expect(pg.query('SELECT * FROM public.marketplace_release_artifacts')).rejects.toThrow(/permission denied/i);
  });
  it('buyers can read only their own entitlement and installation', async () => {
    for (const buyer of [reviewer, other]) {
      const grant = await pg.query<{ id: string }>(`INSERT INTO public.marketplace_entitlements
        (buyer_user_id, listing_id, release_id, license_tier, grant_source, grant_key)
        VALUES ($1,$2,$3,'personal','staff_grant',$4) RETURNING id`, [buyer, listing, release, buyer]);
      const entitlement = grant.rows[0]?.id;
      if (!entitlement) throw new Error('Entitlement was not created');
      await pg.query(`INSERT INTO public.marketplace_installations
        (buyer_user_id, entitlement_id, release_id, idempotency_key) VALUES ($1,$2,$3,'one')`, [buyer, entitlement, release]);
    }
    await pg.query("SELECT set_config('test.user_id', $1, false)", [reviewer]);
    await pg.exec('SET ROLE authenticated');
    for (const table of ['marketplace_entitlements', 'marketplace_installations']) {
      expect((await pg.query(`SELECT buyer_user_id FROM public.${table}`)).rows).toEqual([{ buyer_user_id: reviewer }]);
    }
  });
});