# Backend Isolation and RLS Remediation Plan

**Status:** Resource isolation/backfill design only. Based on repository review and Supabase CLI audit of linked `UNISON/main` on 2026-10-15. The narrow `user-files` Storage policy migration was applied to `UNISON/main` at the user's request; all remaining resource backfill, RLS, resolver, and dedicated-backend steps remain unapplied. The linked project has no branch identified as staging; do not execute the remaining plan against `main`.

## Objective

Make shared-managed project resources tenant-safe without breaking intentional business-shared content, public published reads, or generated-site behavior. Dedicated/connected backends remain a separate mode and must not receive writes through the shared database during outages.

## Verified Starting State

- The project-scope migration is present locally and applied remotely. It adds nullable `project_id` FKs with `ON DELETE SET NULL` and indexes to services, products, menu items, pricing plans, offers, testimonials, portfolio projects, availability slots, content types, and content entries.
- All ten tables currently have RLS enabled and `FORCE ROW LEVEL SECURITY` disabled. Existing public SELECT policies are business-wide/public-active rather than project-filtered; authenticated writes use business permission or membership checks.
- The linked database has 104 rows across those resource tables, and all have `project_id IS NULL`: 77 availability slots, 16 products, and 11 services. The other seven tables are empty. No connected backend bindings currently exist.
- `cms-records` resolves business/project/site relationships and includes `project_id IS NULL` rows in project-bound reads. A null project ID is therefore currently ambiguous between legacy and business-shared data.
- Deleting a project can set resource `project_id` values to NULL through the FK. That would erase the only current project marker and could make project data appear legacy/shared.
- `user-files` is marked private. The initial audit found public-role SELECT, INSERT, UPDATE, and DELETE policies scoped only by bucket ID; the corrective Storage migration has now replaced them with authenticated owner-folder CRUD and expiry-scoped recipient/public share reads. It did not change the separate anonymous insert policy on `public.files` metadata.
- Neither `resolve_project_backend` nor `resolve_published_site_backend` exists in the linked database. The live `connected_supabase_projects` table has no `site_id` column, while the local `project-backend` Edge Function selects it. The binding table has zero rows today.
- `supabase/migrations/20261015223554_restrict_user_files_storage_policies.sql` was applied to linked `UNISON/main` via `supabase db push --linked --skip-vault --yes`. The migration ledger records it; a post-deploy catalog query confirmed owner-folder CRUD, recipient/public share reads, no public mutation policies, and unchanged object counts.
- `ImageEditor` and `CatalogPanel` now require an authenticated user before upload instead of generating `anonymous/` or `anon/` object paths. The local migration test covers public CRUD removal, owner-folder conditions, update `WITH CHECK`, and expiry-aware share reads.
- Docker/Podman is unavailable, so local SQL lint could not run. The remote migration was applied only after CLI dry-run listed exactly this one migration; no other migration, Vault secret, function, or record was changed. A separate staging branch was not available.
- The separate `public.files` metadata policies still allow an anonymous insert with `user_id IS NULL` and token-scoped anonymous reads. The live audit found one null-owner `files` row and no `shared_files` or `file_versions` rows. No current source caller for `file_access_tokens` was found. Treat metadata-table tightening as a separate compatibility gate; this Storage-only candidate does not change it.

## Non-Negotiable Rules

1. Never infer project visibility from `project_id IS NULL` alone.
2. Never bulk-assign current records to a project based only on the business having one current project; the record may intentionally be business-shared.
3. Project-bound reads and writes must validate the project/business/site relationship server-side. Service-role functions must repeat authorization because they bypass RLS.
4. Updates require both row visibility (`USING`) and valid new ownership (`WITH CHECK`).
5. Public visitor reads must use the validated site runtime projection; do not broaden direct anonymous table access to compensate for missing project-aware UI reads.
6. Preserve current endpoints until shared/dedicated parity and contract tests pass. Dedicated backend failures must never route writes to shared storage.
7. Do not switch project FKs to `ON DELETE SET NULL` for project-owned rows. Choose and test explicit deletion behavior before tightening constraints.

## Migration Sequence

### 1. Establish an approved staging target

- Create or identify a Supabase staging project/branch distinct from `UNISON/main`.
- Capture a database backup and the baseline migration list, schema, policies, grants, storage rules, backend bindings, and aggregate ownership counts.
- Confirm that the candidate migration is reversible or has a tested recovery path before applying it.

### 2. Classify ownership before backfill

- Add an explicit ownership state to the resource model, such as `project-owned`, `business-shared`, and `legacy-unclassified`; choose the final representation only after reviewing existing conventions.
- Keep all 104 existing null-project rows unclassified by default. Record which rows can be linked by authoritative historical evidence and which require business-owner review.
- A row is project-owned only when a verified project association exists. A row is business-shared only when an explicit share decision or existing domain contract supports that state.
- Preserve stable row IDs and references. Do not deduplicate by title/name or copy records as a substitute for reconciliation.

### 3. Expand and backfill in staging

- Add scope metadata and any required supporting indexes without removing nullable compatibility fields.
- Backfill only deterministic mappings from trusted ownership records. Ambiguous rows remain unclassified and must not be visible cross-project by default.
- Replace project `ON DELETE SET NULL` semantics with an explicit policy, such as restrict/soft-delete plus deliberate archival, after testing cascades and restore behavior.
- Verify counts before and after each backfill by ownership state; never export row contents into logs or migration reports.

### 4. Enforce read/write authorization

- Add RLS policies that scope project-owned rows by project membership and scope business-shared rows only through an explicit share rule.
- Use `WITH CHECK` on every insert/update policy to prevent moving a row to another project or business through an update.
- Keep public direct SELECT limited to records whose domain contract intentionally allows public access. For generated sites, prefer `site-runtime-read`, which resolves site → project → business and applies capability/public projection rules.
- Remove or narrow anonymous table grants only after all generated UI, preview, public published reads, and account-level business tooling have migrated and parity tests pass.
- Preserve the CMS server's independent business/project/site validation. Add negative tests for project A reading/writing project B and for mismatched site/business IDs.

### 5. Repair backend selection and connected-mode contract

- Reconcile the live `connected_supabase_projects` schema with `projectBackendTypes.ts`, `projectBackendResolver.ts`, and `supabase/functions/project-backend/index.ts`. The server source must not select columns absent from the deployed table.
- Implement or replace the missing resolver RPC contract only after specifying its authenticated project-membership checks and browser-safe return shape. Never expose encrypted keys or service credentials.
- Keep the v2 typed `BACKEND_UNAVAILABLE` result for a missing resolver; do not add a shared-mode fallback.
- With zero connected bindings present, establish dedicated-mode fixtures first. Do not claim dedicated parity until catalog, content, profile, public reads, and supported intent behavior have explicit tests.

### 6. Treat Storage as a separate high-priority migration

- Inventory actual `user-files` clients and the intended shared-file workflow before changing the public policies.
- Replace bucket-wide public CRUD with owner/workspace-scoped object policies. Ensure shared-file reads use the explicit share record, expiry, and intended access role rather than bucket membership alone.
- Keep private uploads private; verify list, read, upload, overwrite, delete, signed URL, and shared-link expiry behavior as the relevant roles.
- Preserve files and paths during policy migration. Do not empty the bucket, rotate public URLs, or rename objects as cleanup.

## Phase 3 Domain Adapter Parity

Keep the existing `ProjectBackendResolver` → `ResourceRuntime` → typed adapter ownership chain. Do not add a parallel runtime, arbitrary SQL/table API, or client-selected backend.

### Supported parity matrix to prove

| Domain | Shared adapter | Dedicated adapter today | Phase 3 disposition |
|---|---|---|---|
| Catalog: services, products, menu, pricing, offers, testimonials, portfolio | `cms-records` through the catalog `ResourceRuntime` adapter | `project-backend` allowlists catalog surface contracts | First parity target: test list/get/create/update/delete only where the resource schema allows them, normalized fields, errors, ordering, and project isolation. |
| Dynamic content types and entries | `cms-records` lifecycle commands | Unsupported; current dedicated path rejects non-catalog adapters | Keep explicitly unsupported until the connected schema has content-type/entry/revision contracts and publish-state parity. Never fall through to shared content. |
| Business profile and site-local overrides | `businessProfileService` plus site profile projection | Unsupported; no dedicated profile adapter | Keep unsupported until account identity and site-local branding have separate schemas and update ownership. Do not mirror an account profile into every project implicitly. |
| Public runtime reads | `site-runtime-read` projects approved rows from shared tables | No verified published dedicated reader; helper has no source callers | Keep public dedicated reads blocked until the exact site/project/capability projection is implemented and visitor tests match shared behavior. |
| Business actions (booking, checkout, forms, intents) | Specialized existing handler per capability | No general dedicated parity; each handler has separate scope/idempotency contract | Prove per handler. Do not infer support from a resource CRUD adapter or a capability name. |

### Parity test contract

- Run identical fixture operations through shared and dedicated fake adapters for every domain declared supported. Compare record shape, editable-field validation, sort/filter behavior, null/not-found behavior, and structured errors.
- Assert dedicated failures, missing binding, unsupported resource, wrong runtime identity, and network failure never call the shared adapter.
- Assert a caller cannot substitute a table name, business ID, site ID, or actor role to widen access; the server resolves binding and tenant relationships from authenticated project membership.
- For content, compare builder draft visibility, public published-only reads, lifecycle transitions, and immutable revision behavior.
- For business profile, test account identity separately from project overrides; ordinary static presentation edits must stay on source/presentation ownership and make no business-data request.
- For every claimed supported industry workflow, run the generated UI action/read against its capability-installed runtime contract. Keep unsupported domains visible as typed blockers rather than toasts that imply success.

### Phase 3 exit gate

Do not claim shared/dedicated parity until the staging binding schema matches server code, a dedicated test binding passes the exact shared contract fixtures, public read parity is proven for any published domain, and cross-project/capability denial tests pass. Current live state has zero dedicated bindings, and the local server currently selects a live-missing `site_id` column; these are blocking prerequisites, not cleanup details.

## Phase 4 Stable Identity and Idempotent Provisioning

- Reserve one `projectId`, `siteId`, and `launchSessionId` before generation and preserve them through home-chat, Wizard, App Builder, previews, publish, export, and reconnect. Route/page edits must not mint a new project identity.
- Keep VFS/source revisions under `VFSCommitService` / `commitMutation`; resource provisioning receipts must not become a second source writer or accepted revision stream.
- Replace name-only seed deduplication with stable resource IDs and durable operation receipts for catalog, content, and assets. Correlation IDs alone are not idempotency.
- Make each provisioning stage retryable and observable. A repeated launch operation must not create duplicate project/site bindings, services, products, menu entries, bookings, or asset records.
- Treat connected backend provisioning as a saga: record step status, verify the dedicated runtime identity, and report partial failure. No cross-database ACID assumption and no shared-storage fallback.
- Before reworking seed behavior, add retry tests that run the same operation twice, assert one durable result, then simulate failure after each stage and resume using the original IDs.

### Phase 4 exit gate

Stable identity and idempotent retry tests pass for shared mode and any supported dedicated mode; runtime manifest IDs match the accepted project/site revision; and an interrupted launch resumes without duplicate resources or silently changing backend mode.

## Phase 5 Asset, Preview, and AI Contract Convergence

- Keep assets separate from source and business records. The asset registry owns upload/metadata; source or presentation commands own where an image is placed; catalog/resource data owns business-controlled image fields.
- Converge asset metadata and Storage paths on stable project asset IDs. Preserve existing URLs and the current `AssetRef` ownership checks while migration runs.
- Do not treat the current local data-URL upload fallback as a durable successful upload. A saved/published asset link must refer to an accepted asset or return a typed failure; draft-only local previews must be explicitly marked as such.
- Route inspector, AI, command menu, and terminal changes through their existing owner lanes: source/presentation/route through `commitMutation`, business fields through `ResourceRuntime`, asset references through asset ownership. Never create a second VFS writer or generic asset/resource mutation path.
- Ensure preview and published UI read the same accepted asset reference and resource projection. A visual preview probe is not proof of durable asset persistence; test upload → link → save → preview → published URL resolution.
- Restrict Storage policies by owner/project and share grants. Keep public delivery separate from object mutation; public reads must not imply public upload, replace, or delete.

### Phase 5 exit gate

Static logo/image presentation requires no catalog or booking capability; resource-backed prices remain authoritative; project A cannot link/read project B's private asset; upload and preview failures are visible and typed; and old asset URLs continue to resolve.

## Phase 6 Intent Execution Contracts

Keep specialized domain handlers under one logical contract. Do not replace them with a universal SQL executor or assume that all routes have the same auth, tenant, or retry semantics.

| Action family | Current owner | Required next contract |
|---|---|---|
| Booking | `site-runtime` plus atomic private booking operation | Preserve stable operation key, verify site capability and exact component/slot binding, bind service/slot to the same project/business, and prove duplicate delivery returns the original booking without duplicate CRM effects. |
| Public forms | `form-submit` | Verify project belongs to the exact site and business; retain approved form schema; make idempotency atomic through a deployed unique receipt constraint; scope follow-up CRM/workflow records to the same tenant. |
| Generic contact/lead/quote/newsletter | `intent-exec` and legacy router family | Reconcile caller-supplied business/site IDs server-side; identify and migrate any deployed callers of `intent-router`/`intent-router-lite`; store durable operation receipts before declaring retries safe. |
| Product cart/order checkout | `intent-router` and `create-order-checkout` | Resolve product, business, project, and site together; ignore untrusted client price/user identity; persist one order/checkout receipt per logical operation; verify webhook events and order ownership. |
| Donation checkout | `donation.start` currently declares `stripe-checkout`, but the generated controller resolves to `create-order-checkout`; capability metadata points at account-subscription `create-checkout` | Keep production readiness blocked until a donation-specific amount/currency/campaign contract, durable donation record, payment handler, and webhook linkage exist. Do not reuse order checkout or subscription billing as a placeholder. |
| Published backend outage | Existing typed specialized handlers | Return a typed unavailable result. Never route a dedicated outage, unsupported capability, or failed resolver into shared project data. |

The currently deployed generic intent endpoints have `verify_jwt = false`; handlers must independently validate public action context and tenant scope. Caller-supplied `userId`, `businessId`, `siteId`, session IDs, and actor labels are hints only unless matched against server-verified identity or a persisted visitor/session contract.

### Phase 6 exit gate

Every published UI action maps to one canonical intent definition, one capability contract, and one active handler; identity/scope checks pass; retries return one durable outcome; and E2E tests cover success, denial, conflict, unsupported capability, outage, and duplicate delivery.

## Phase 7 Publish, Export, and Cleanup

- Keep `unison.runtime.json` versioned and browser-safe. Validate project/site identity, backend mode, protocol version, declared capabilities, and public descriptors before publish; never include secret or service-role material.
- Preview, published runtime, and exported site must consume the same accepted SiteBundle/runtime manifest and resource IDs. Dedicated published reads are not considered implemented until a real caller and read-back test exist.
- Deploy resolver/RPC or function changes behind a controlled rollout only after staging parity. Preserve v1 routes while old persisted manifests or deployed sites still call them.
- Maintain an explicit rollback plan for manifest/function cutover and backend mode. A failed deployment or resolver health check must leave the previous accepted site/runtime active.
- Remove endpoints, columns, policies, or adapters only after repository search, deployed caller evidence, zero-traffic observation, parity tests, and rollback verification. Absence of a direct `src/` import alone is not a removal gate for externally deployed sites.

### Phase 7 exit gate

Shared-managed and any declared dedicated modes pass the same contract fixtures across preview/publish/export; all secrets remain server-side; route/function cutover is reversible; and legacy cleanup has zero active callers plus verified rollback.

## Required Contract Tests

- Cross-project read/write denial for every resource table and supported role.
- Explicit business-shared access works only where a share policy says it should.
- Public runtime reads resolve exact site/project/business ownership and only return public fields/rows with installed capabilities.
- Project/site/business mismatch is rejected by CMS and privileged Edge Functions.
- Null/unclassified records are never silently treated as globally shared.
- Project deletion cannot turn project-owned rows into shared/legacy rows.
- Resource create/update validates both current-row visibility and new-row ownership.
- Storage owner, non-owner, public visitor, shared-link, expired-link, and overwrite cases.
- Identical contract fixtures pass in shared and dedicated modes for each explicitly supported domain.
- Retry tests prove durable operation receipts before any write is called idempotent.

## Exit Gate

Do not apply an RLS/backfill/storage migration until staging shows: ownership classifications reconciled; policy/grant behavior proven with role-based tests; resolver and connected schema aligned; public read/preview parity preserved; migration rollback/recovery practiced; and no unapproved shared fallback. After staging acceptance, deploy one reviewed migration at a time, recheck advisors, compare schema/migration state, and repeat aggregate counts.
