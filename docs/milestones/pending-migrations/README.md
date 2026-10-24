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
