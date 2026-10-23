// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { lintMigrationSql } from '@/services/migrationSqlLint';

const creatorId = '11111111-1111-4111-8111-111111111111';
const listingId = '22222222-2222-4222-8222-222222222222';
const publishedReleaseId = '33333333-3333-4333-8333-333333333333';
const draftListingId = '44444444-4444-4444-8444-444444444444';
const draftReleaseId = '55555555-5555-4555-8555-555555555555';
const snapshotHash = 'a'.repeat(64);
const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20261023011222_marketplace_catalog_foundation.sql',
);

async function createDatabase() {
  const pg = new PGlite();
  const migration = readFileSync(migrationPath, 'utf8');
  const lint = lintMigrationSql(migration);
  if (!lint.ok) throw new Error(JSON.stringify(lint.blockers));

  await pg.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
  `);
  await pg.exec(migration);
  await pg.query('INSERT INTO auth.users (id) VALUES ($1)', [creatorId]);
  await pg.query(
    `INSERT INTO public.marketplace_listings
      (id, slug, creator_user_id, product_type, title, industry_key)
     VALUES ($1, 'published-salon', $2, 'site_template', 'Editorial Salon', 'salon')`,
    [listingId, creatorId],
  );
  await pg.query(
    `INSERT INTO public.marketplace_releases
      (id, listing_id, version, manifest_json, snapshot_path, snapshot_sha256, status)
     VALUES ($1, $2, '1.0.0', $3::jsonb, 'releases/salon/snapshot.json', $4, 'published')`,
    [
      publishedReleaseId,
      listingId,
      JSON.stringify({
        schemaVersion: 'marketplace-design-release/1',
        productType: 'site_template',
        source: { snapshotSha256: snapshotHash },
      }),
      snapshotHash,
    ],
  );
  await pg.query(
    `UPDATE public.marketplace_listings
     SET status = 'published', current_release_id = $1
     WHERE id = $2`,
    [publishedReleaseId, listingId],
  );
  await pg.query(
    `INSERT INTO public.marketplace_listings
      (id, slug, creator_user_id, product_type, title, industry_key)
     VALUES ($1, 'draft-salon', $2, 'site_template', 'Draft Salon', 'salon')`,
    [draftListingId, creatorId],
  );
  await pg.query(
    `INSERT INTO public.marketplace_releases
      (id, listing_id, version, manifest_json, snapshot_path, snapshot_sha256)
     VALUES ($1, $2, '1.0.0', $3::jsonb, 'releases/draft/snapshot.json', $4)`,
    [
      draftReleaseId,
      draftListingId,
      JSON.stringify({
        schemaVersion: 'marketplace-design-release/1',
        productType: 'site_template',
        source: { snapshotSha256: snapshotHash },
      }),
      snapshotHash,
    ],
  );
  return pg;
}

describe('marketplace catalog schema and RLS', () => {
  let pg: PGlite;

  beforeEach(async () => {
    pg = await createDatabase();
  });

  afterEach(async () => {
    if (pg) await pg.close();
  });

  it.each(['anon', 'authenticated'])('%s reads only the sanitized published listing projection', async (role) => {
    await pg.exec(`SET ROLE ${role}`);
    const publicRows = await pg.query<{ slug: string }>(
      'SELECT slug FROM public.marketplace_public_listings ORDER BY slug',
    );
    expect(publicRows.rows).toEqual([{ slug: 'published-salon' }]);

    await expect(pg.query('SELECT creator_user_id FROM public.marketplace_listings'))
      .rejects.toThrow(/permission denied/i);
    await expect(pg.query('SELECT * FROM public.marketplace_releases'))
      .rejects.toThrow(/permission denied/i);
    await expect(pg.query("UPDATE public.marketplace_listings SET title = 'Changed'"))
      .rejects.toThrow(/permission denied/i);
    await expect(pg.query(
      `INSERT INTO public.marketplace_public_listings
       (slug, product_type, title, industry_key, summary, price_cents, currency)
       VALUES ('injected', 'site_template', 'Injected', 'salon', '', 0, 'usd')`,
    )).rejects.toThrow(/permission denied/i);
  });

  it('rejects a listing published without a release or linked to a draft release', async () => {
    await expect(pg.query(
      `UPDATE public.marketplace_listings SET status = 'published' WHERE id = $1`,
      [draftListingId],
    )).rejects.toThrow(/must reference a release/i);

    await expect(pg.query(
      `UPDATE public.marketplace_listings
       SET status = 'published', current_release_id = $1
       WHERE id = $2`,
      [draftReleaseId, draftListingId],
    )).rejects.toThrow(/must be published/i);
  });

  it('keeps published release rows immutable', async () => {
    await expect(pg.query(
      `UPDATE public.marketplace_releases SET status = 'retired' WHERE id = $1`,
      [publishedReleaseId],
    )).rejects.toThrow(/immutable/i);
  });

  it('rejects manifests with missing schema version, product type, or source hash', async () => {
    await expect(pg.query(
      `INSERT INTO public.marketplace_releases
       (listing_id, version, manifest_json, snapshot_path, snapshot_sha256)
       VALUES ($1, 'invalid-schema', $2::jsonb, 'releases/bad/schema.json', $3)`,
      [
        draftListingId,
        JSON.stringify({ productType: 'site_template' }),
        snapshotHash,
      ],
    )).rejects.toThrow(/marketplace_releases_manifest_json_check/i);

    await expect(pg.query(
      `INSERT INTO public.marketplace_releases
       (listing_id, version, manifest_json, snapshot_path, snapshot_sha256)
       VALUES ($1, 'invalid-product', $2::jsonb, 'releases/bad/product.json', $3)`,
      [
        draftListingId,
        JSON.stringify({ schemaVersion: 'marketplace-design-release/1' }),
        snapshotHash,
      ],
    )).rejects.toThrow(/marketplace_releases_manifest_json_check/i);

    await expect(pg.query(
      `INSERT INTO public.marketplace_releases
       (listing_id, version, manifest_json, snapshot_path, snapshot_sha256)
       VALUES ($1, 'invalid-hash', $2::jsonb, 'releases/bad/hash.json', $3)`,
      [
        draftListingId,
        JSON.stringify({ schemaVersion: 'marketplace-design-release/1', productType: 'site_template' }),
        snapshotHash,
      ],
    )).rejects.toThrow(/marketplace_releases_snapshot_hash_matches_manifest_check/i);
  });
});