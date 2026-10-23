# Unison Template Marketplace: M2 Public Discovery

**Status:** Browse and listing details implemented; certified preview/install remain gated.

## Included

- `/marketplace` is public and reads only `marketplace_public_listings` through the bounded listing service.
- URL-backed search, product type, and industry filters; loading, read error, no-result, and empty-catalog states are covered.
- `/marketplace/:slug` shows public listing details and a sign-in handoff.
- No public route reads private release rows, snapshots, package paths, or creator identity.
- Preview and install controls remain unavailable until real certified preview artifacts and install authorization exist; no mock listing or preview is seeded.

## Verification

- Marketplace page and route contract tests pass.
- Full marketplace, type, lint, and production build checks pass for this phase.
- The deployed public listing view currently has zero rows, so UI behavior is verified against empty and mocked catalog results, not live published products.

## Next

Create an authenticated buyer library and real release preview only after a trusted certification/promotion path exists. Do not enable checkout or install from an uncertified release.