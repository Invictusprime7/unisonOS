# Marketplace migration deployment (R6-P1)

`supabase/migrations/20261024001900_marketplace_trusted_promotion.sql` adds the server-owned certification and install
records from the Repository 6 milestone: asset rights, staff release reviews,
immutable private artifacts, buyer entitlements, buyer installations, and a
publish trigger that refuses any release without an unrevoked all-pass admin
review over the same snapshot hash and a matching private artifact.

The SQL has been moved into the canonical migration directory; there is no second
copy here. Apply it to UNISON through the existing deployment workflow. Local
tests do not establish that this migration has been applied to the live database.
Rollback: drop the trigger `marketplace_releases_require_certification`,
then the five tables (installations, entitlements, artifacts, reviews, asset_rights).

## Local verification

`src/test/marketplaceTrustedPromotion.test.ts` executes the canonical foundation
and promotion migrations in a local PostgreSQL-compatible database. It covers
private-evidence permissions, buyer isolation, immutable evidence, invalid or
revoked approval rejection, and the all-pass publication path. Together with
the existing marketplace certification suites, 33 tests pass; staging helpers
also pass all 4 tests. This is not deployed pgTAP or live-account evidence.

The selected project still needs an authoritative admin session, accepted-source
inspection, private-data scrubbing, asset-rights evidence, an actual isolated
package build/reimport, and package-derived mobile/desktop preview proof. No
release has been certified or published by these local checks.
