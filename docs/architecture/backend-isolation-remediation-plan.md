# Backend Isolation and RLS Remediation Plan

**Status:** Design only. Based on repository review and read-only Supabase CLI audit of linked `UNISON/main` on 2026-10-15. No migrations, policy changes, deployments, or record updates have been applied. The linked project has no branch identified as staging; do not execute this plan against `main`.

## Objective

Make shared-managed project resources tenant-safe without breaking intentional business-shared content, public published reads, or generated-site behavior. Dedicated/connected backends remain a separate mode and must not receive writes through the shared database during outages.

## Verified Starting State

- The project-scope migration is present locally and applied remotely. It adds nullable `project_id` FKs with `ON DELETE SET NULL` and indexes to services, products, menu items, pricing plans, offers, testimonials, portfolio projects, availability slots, content types, and content entries.
- All ten tables currently have RLS enabled and `FORCE ROW LEVEL SECURITY` disabled. Existing public SELECT policies are business-wide/public-active rather than project-filtered; authenticated writes use business permission or membership checks.
- The linked database has 104 rows across those resource tables, and all have `project_id IS NULL`: 77 availability slots, 16 products, and 11 services. The other seven tables are empty. No connected backend bindings currently exist.
- `cms-records` resolves business/project/site relationships and includes `project_id IS NULL` rows in project-bound reads. A null project ID is therefore currently ambiguous between legacy and business-shared data.
- Deleting a project can set resource `project_id` values to NULL through the FK. That would erase the only current project marker and could make project data appear legacy/shared.
- `user-files` is marked private, but `storage.objects` has public-role SELECT, INSERT, UPDATE, and DELETE policies scoped only by bucket ID. This is a separate critical storage access-control workstream.
- Neither `resolve_project_backend` nor `resolve_published_site_backend` exists in the linked database. The live `connected_supabase_projects` table has no `site_id` column, while the local `project-backend` Edge Function selects it. The binding table has zero rows today.

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
