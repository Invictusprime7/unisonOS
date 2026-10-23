# Pending marketplace migration (R6-P1)

`marketplace_trusted_promotion.sql` adds the server-owned certification and install
records from the Repository 6 milestone: asset rights, staff release reviews,
immutable private artifacts, buyer entitlements, buyer installations, and a
publish trigger that refuses any release without an unrevoked all-pass admin
review over the same snapshot hash and a matching private artifact.

It must be applied to UNISON by placing it under `supabase/migrations/` with a
timestamped name in the GitHub repository and running the Supabase Deploy (UNISON)
workflow. Rollback: drop the trigger `marketplace_releases_require_certification`,
then the five tables (installations, entitlements, artifacts, reviews, asset_rights).
