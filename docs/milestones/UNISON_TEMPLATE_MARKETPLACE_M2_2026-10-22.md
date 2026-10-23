# Unison Template Marketplace: M2 Public Discovery

**Status:** Browse, listing details, and registry-driven composition previews implemented; certified release preview/install remain gated.

## Included

- `/marketplace` is public and reads only `marketplace_public_listings` through the bounded listing service.
- URL-backed search, product type, and industry filters; loading, read error, no-result, and empty-catalog states are covered.
- `/marketplace/:slug` shows public listing details and a sign-in handoff.
- The homepage Affinity hero has an accessible AI Chat / Marketplace tab toggle. Both panels stay mounted to preserve the chat and Wizard state; Marketplace queries start only when that tab is selected.
- The Marketplace preview library compiles first-party `TemplateComposition` entries through `compositionToReactFileSet`, the design implementation and Art Direction registries, and Stage 4b theme CSS. Style-card, Art Direction, category, and device controls are square-cornered. These previews are explicitly separate from certified marketplace releases.
- No public route reads private release rows, snapshots, package paths, or creator identity.
- Certified listing-detail preview and install remain unavailable until release preview artifacts and install authorization exist; no mock listing is seeded.

## Verification

- Marketplace page and route contract tests pass.
- Homepage tab integration, keyboard navigation, lazy listing load, and chat/Wizard state retention tests pass.
- Full marketplace, type, lint, and production build checks pass for this phase.
- The deployed public listing view currently has zero rows, so UI behavior is verified against empty and mocked catalog results, not live published products. First-party registry previews render locally through the isolated Sandpack preview.

## Next

Create an authenticated buyer library and real release preview only after a trusted certification/promotion path exists. Do not enable checkout or install from an uncertified release.