# Unison Template Marketplace: M0-M1 Foundation

**Status:** M0 complete; M1 foundation in progress

**Scope:** Source audit, release contracts, read-only design preflight, isolated catalog schema, and a read-only listing service. Routes, payments, first-party release seeding, and release promotion are not implemented.

## Existing template namespaces

| Existing object | Actual meaning | Marketplace boundary |
|---|---|---|
| `public.templates` | Canvas records with layers, frames, dimensions, ownership, visibility, and backend feature fields. Defined in `supabase/migrations/20250117000000_complete_schema_system.sql` and extended by `supabase/migrations/20251229120000_extend_templates_backend.sql`. | Do not repurpose for commercial site releases. |
| `public.design_templates` and `public.template_versions` | Design-editor canvas data and its version history, including `canvas_data`. Defined in `supabase/migrations/20251006082323_6e55ba51-79ba-452f-809f-25fa682697d6.sql`. | Do not repurpose for commercial site releases. |
| `TemplateComposition` | Registered site/section composition data in `src/sections/types.ts`, consumed by the canonical section and site composition pipeline. | May be a first-party seed source; it is not a listing or release record. |
| `TemplateManifest` | Backend provisioning requirements for tables, workflows, intents, roles, and defaults in `src/data/templates/manifest.ts`. | Do not conflate with a visual release manifest. |
| `RecipePack` | Automation workflow pack in `src/services/recipeManagerService.ts`. | Keep separate from visual marketplace products. |

The active Web Builder route loads `src/components/creatives/WebBuilder.tsx` through `src/pages/WebBuilderPage.tsx`. The unused tracked `WebBuilder-3manBeatz.tsx` duplicate was removed because its copied VFS exemptions violated the canonical write audit; the active builder was not changed for this cleanup. Two byte-identical `-3manBeatz` test copies were also removed because their suffix kept the pipeline lint from recognizing them as test files; their active `.test.tsx` counterparts remain.

## Implemented foundation

- `src/marketplace/contracts.ts` defines product/status/license types and the versioned design release manifest.
- `src/marketplace/listingService.ts` reads only the sanitized public listing view, applies bounded catalog filters, and maps database rows into the public app contract.
- `src/marketplace/snapshotFingerprint.ts` derives a stable SHA-256 from the complete `SiteBundleSnapshot`, independent of JSON object key order. It does not establish that a revision is accepted; that identity must still be obtained from trusted committed-revision state.
- `src/marketplace/certification/acceptedRevisionEvidence.ts` reads the current authenticated user, verifies project ownership, and loads a committed revision belonging to the same project and business with a sealed canonical snapshot. `validateAcceptedDesignRelease.ts` binds the manifest's revision ID and hash to that trusted evidence before using the canonical design preflight.
- `src/marketplace/certification/validateRedistribution.ts` requires per-asset review evidence, matching hashes/license classes, verified commercial-use and bundle-redistribution rights, and blocks reference-only assets or bundled buyer-supplied assets. The current input evidence is not a trusted moderation record; `validateAcceptedDesignRelease` therefore reports `publicationEligible: false` even when its mechanical checks pass.
- `src/marketplace/certification/scanReleaseSource.ts` performs a read-only high-confidence credential-pattern scan and checks trusted project-specific private values across VFS files and snapshot metadata. It returns paths/codes only; it is not a comprehensive PII, malware, or supply-chain scanner.
- `src/marketplace/certification/validateDesignRelease.ts` performs read-only checks against supplied accepted-revision evidence and the canonical implementation registry/eligibility resolver. It rejects source mismatches, unregistered or ineligible implementations, duplicate implementation IDs, invalid snapshot hash shape, and reference-only assets.
- Capability requirements are not treated as proof of provisioning. A capability-gated implementation is only accepted as a declared dependency for a `requires-provisioning` release.
- These checks are not a complete certification or publication gate. Accepted-revision evidence must come from a trusted canonical read. Asset licensing provenance, source sanitization, package build/reimport, responsive and accessibility evidence, preview parity, and the remaining release checks are still required before any release can be promoted.
- `supabase/migrations/20261023011222_marketplace_catalog_foundation.sql` adds only `marketplace_listings`, `marketplace_releases`, and a sanitized `marketplace_public_listings` view. Client roles can read published listing fields only; release rows and all catalog writes are service-role-only. Published releases are immutable, and a listing's current release must be published, match its product type, and belong to that listing.
- `supabase/tests/marketplace_catalog_rls_test.sql` records pgTAP assertions for table RLS, invoker-safe view behavior, and least-privilege grants. `src/test/marketplaceSchema.test.ts` executes the migration in PGlite and exercises public visibility, private fields, write denial, release pointer checks, immutability, and the repository SQL linter.
- The local GHL migration files duplicated byte-for-byte migrations already recorded remotely under `-3manBeatz` names. The redundant unsuffixed copies were removed so the CLI does not replay already-applied DDL.

## Verification and limits

- `npm run lint:canonical-vfs-writes` passes after removal of the unused duplicate.
- `npm run lint:app-builder-authority`, `npm run lint:pipeline-bypass`, and `npm run lint:single-source-of-truth` pass.
- `src/test/canonicalVfsWriteClosure.test.ts` and `src/test/canonicalVfsExemptionAudit.test.ts` pass.
- Marketplace contract and design-preflight tests pass.
- Marketplace listing service tests pass.
- PGlite marketplace schema/RLS tests pass. The pgTAP file has not been run because Docker/Podman is unavailable.
- `npm run type-check` and `npm run build` pass. The build retains existing Tailwind utility and chunk-size warnings.
- Pre-deploy linked CLI queries confirmed no `marketplace_*` tables existed. After deployment, both marketplace tables and the public view were verified remotely. Live legacy `design_templates` and `template_versions` use `canvas_data`; live `templates` uses canvas `layers`/`frames` plus backend fields such as `redirects`, `scheduling`, `requires_auth`, and `payment`.
- Applied `booking_crm_lead` and `marketplace_catalog_foundation` to the linked project after confirming live prerequisites and reviewing the exact dry-run. Verified both migration records, the marketplace RLS policies, and booking trigger remotely; the post-deploy dry-run is up to date, and the security advisor reports no error-level findings.
- The deployed public listing view currently contains zero published rows; no template was seeded without an accepted source revision and licensing evidence.
- `supabase status` cannot start because Docker/Podman is unavailable, so Supabase pgTAP was not run locally. PGlite covered the marketplace migration behavior instead.

## Next gate

Add trusted server-side moderation evidence for asset rights, stronger content sanitization, isolated package build/reimport, responsive/accessibility checks, and real preview parity. Only after those gates pass should a first-party release be promoted from an accepted snapshot. Do not seed or publish a product, add checkout, or treat the current design/rights/source preflight as release approval.