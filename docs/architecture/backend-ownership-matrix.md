# Backend Ownership Matrix

**Evidence captured:** 2026-10-15. This matrix records source-level ownership and a separate read-only CLI snapshot of linked `UNISON/main` (`nfrdomdvyrbwuokathtw`). The linked target was not labeled staging; do not treat this snapshot as staging certification.

| Concern | Canonical owner | Persistence / transport | Business capability needed? | Scope and transition rule |
|---|---|---|---|---|
| Static hero/header copy, text, layout, styling | Source/presentation editor through `EditorCommand` and canonical `commitMutation` | SiteBundle/VFS accepted revision | No | Property ownership determines source vs presentation. Never call catalog, CRM, booking, or generic resource APIs for static edits. |
| Navigation label and destination | Route/source editor and canonical topology | Canonical route/topology in accepted SiteBundle revision | No | Route edits remain source/route-owned and use the canonical commit path. |
| Ordinary logo/image presentation | Asset registry plus source/presentation reference | Project asset metadata and approved asset URL/reference; VFS stores presentation link | No | Upload/link is an asset operation; placing an existing image is presentation/source. Dedicated storage support is currently unproven. |
| Products, services, menu items, plans, offers, testimonials, portfolio records | `ResourceRuntime` using registered catalog adapter | Shared: `cms-records`; dedicated: `project-backend` catalog allowlist | Data/resource support; capability depends on operational use | Resource key must resolve through `resourceRegistry`/catalog surfaces. Project-scoped operations go through the resolver. |
| Dynamic articles, case studies, FAQs and other content entries | `ResourceRuntime` using content adapter | Shared `cms-records` content-entry actions | Data/content support; publishing capability for lifecycle actions | Content type definitions are dynamic registry entries. Dedicated content operations explicitly fail as unsupported today; no shared fallback. |
| Business profile and site-local brand overrides | Business profile adapter plus site-profile service | Shared business row and project-scoped site profile overrides | No operational capability for presentation | Distinguish account identity from site-local overrides; dedicated profile adapter is not implemented. |
| Booking, cart, checkout, forms and other actions | Registered typed intent/capability handler (`site-runtime`, checkout, form, or intent-specific function) | Domain records and execution receipts/events | Yes, for the specific installed behavior | Server checks installed capability and binding. Specialized handlers remain until retry/idempotency and backend parity pass. |
| Project/backend bindings and runtime mode | Control-plane provisioning and `ProjectBackendResolver` | Backend binding/control-plane records and resolver RPC | N/A | Browser context is not authorization. Resolver selects the physical backend; callers do not choose a database/table. |
| Auth/session and project/business membership | Supabase Auth plus membership/authorization services and server checks | Auth sessions, memberships, policies/RPCs | N/A | Never trust client `actorKind`, browser-supplied business/project IDs, or editable user metadata as proof of permission. |
| Source revision, publish identity and deployment state | `VFSCommitService` / `commitMutation`; deployment service | Canonical revision/snapshot and control-plane deployment records | No | `commitMutation` remains the sole accepted source writer. Resource writes do not create source checkpoints. |
| Audit, telemetry and operation receipts | Existing typed domain handler/service | Audit/event tables and provider/domain records | Depends on operation | An `operationId` is only correlation until the receiving backend stores and enforces idempotency. Do not claim retries are safe without durable receipt checks. |

## Backend-mode parity status

| Resource or operation | Shared managed | Dedicated/connected | Current finding |
|---|---|---|---|
| Catalog list/get/create/update/delete | `cms-records` | `project-backend` catalog contract | Fake shared and dedicated list/get/create/update/delete facade tests now cover each catalog surface derived by all ten industries, without crossing adapters. Live binding and deployed Edge Function parity remain unverified. |
| Content type and content entry operations | `cms-records` | Unsupported by `project-backend` | Gap is explicit and fails closed; do not report parity or silently use shared storage. |
| Business profile read/update | `businessProfileService` and shared runtime reads | Unsupported by `ResourceRuntime` dedicated adapter | Gap; account profile and site-local profile overrides are distinct concerns. |
| Public catalog/profile reads | `site-runtime-read` shared database | Published helper exists but has no consumers in source | Dedicated published parity is unproven. |
| Booking and other operational intents | Specialized shared handlers | Per-capability behavior not established | Require handler-specific authorization, durable idempotency, and same-contract tests. |
| Assets and Storage | `project_assets` plus Supabase Storage | Resolver not used | Dedicated parity is unproven; upload failure can fall back to local data URL. |
| Static source/presentation/route edits | Canonical VFS commit | Same canonical VFS commit | Backend mode does not change source ownership; these edits require no business capability. |

## Compatibility and safety notes

- `src/services/project-backend/runtimeProtocol.ts` adds a v2 envelope over the existing resolver and `ResourceRuntime`; v1 method signatures stay intact. Resource keys remain registry-resolved, while asset linking and intent execution explicitly fail as unsupported until wired to their current domain owners.
- V2 `operationId` is correlation metadata only. Durable idempotency requires backend operation receipts and is not implemented by this compatibility layer.
- V2 `actorKind` is an untrusted caller hint. Shared and dedicated server handlers remain responsible for authentication, membership, project binding, and tenant scope.
- Persisted binding modes are `unison-managed` / `connected-supabase`; runtime descriptor modes are `shared-legacy` / `dedicated`. Keep a tested mapping while compatibility exists.
- `withProjectBackend` accepts a null project and calls the legacy adapter without resolving a binding. New project-scoped operations must require a project ID; the legacy path needs an explicit retirement gate, not an accidental widening.
- Dedicated backend outages and unsupported domains must return typed failures. They must never fall through to shared storage.
- `project_id IS NULL` currently participates in shared-legacy read behavior; it is not proof that every project may read a record. Historical ownership and policy behavior require staging inspection before backfill or policy changes.
- Service-role Edge Functions must independently verify tenant ownership because RLS may be bypassed. Client-supplied actor and repeated identity fields remain untrusted hints.

## Live Deployment Snapshot

Read-only Supabase CLI inspection of linked `UNISON/main`; no SQL writes, migrations, policy changes, or deployments were performed.

| Area | Observed state | Contract implication |
|---|---|---|
| Migration ledger | Local and remote migration timestamps match through `20261015234046_restrict_anonymous_file_metadata_inserts.sql`; the project-scope migration is applied. | Schema scope columns exist, but ownership is unclassified and RLS remains business-level. |
| Resource ownership | Ten resource tables have nullable `project_id` FKs with `ON DELETE SET NULL`; 104 total rows are present and all have null `project_id` (77 availability slots, 16 products, 11 services; remaining seven tables empty). Resource/business groups contain 60 rows in multi-project businesses, 26 rows in businesses with no current project, and 18 rows in single-project businesses. | No row-to-project mapping is proven. A single current project is not historical evidence; do not mass-assign any of the 104 rows. |
| RLS | All ten resource tables have RLS enabled and `FORCE ROW LEVEL SECURITY` disabled. Public SELECT policies are business-wide/public-active; authenticated writes use business membership/permissions. | Project scope is not enforced by these table policies. Service-role Edge Functions remain responsible for explicit tenant checks. |
| Resource grants | `anon` has broad table DML grants on several catalog tables, while current RLS policies expose public SELECT only. Content tables have no `anon`/`authenticated` table grants. | Keep grants and policies distinct during review; effective public writes were not attempted. |
| CMS null-project handling | `projectReadFilter` includes null-project rows for any project-bound read; project-scoped catalog updates stamp the requested project ID, and content-entry writes adopt null-project rows. | Current behavior treats unclassified rows as business-shared and can claim them from a project editor. Requires explicit ownership classification and staging parity before changing. |
| Connected backends | `connected_supabase_projects` has RLS, no browser-role grants, and zero rows. Live columns include `connection_id`, `unison_project_id`, `project_ref`, encrypted keys, schema/status/manifest fields; no `site_id`, `mode`, `provider`, or `provider_project_ref`. Deployed `project-backend` v22 derives site identity via `projects`/`sites`. | Dedicated parity is unused and cannot be claimed from fake adapter tests alone. |
| Resolver RPCs | Both `resolve_project_backend` and `resolve_published_site_backend` are deployed from migrations `20261015232037` and `20261015233034`, use pinned empty search paths, and preserve disconnected bindings as dedicated/failed rather than shared. | Project resolution is live; dedicated CRUD and published dedicated reads remain unverified because no connected binding exists. |
| Storage and file metadata | `user-files` is private with authenticated owner-folder CRUD and expiry-scoped share reads; no public object mutation policy remains. `public.files` no longer permits anonymous metadata inserts. One existing null-owner metadata row and token-scoped read policy remain. | Storage-object mutation is owner-scoped; legacy file-token read compatibility remains a separate cleanup gate. |
| Functions | Project/backend, CMS, site runtime, intent/form, and checkout functions are active; selected deployed `verify_jwt` flags match repository config. | This is deployment metadata, not source-hash parity; active routes do not prove supported domain parity. |

The linked project has only a `main` preview branch, not a separately identified staging branch. Repeat this audit against a designated staging target before any later schema or policy remediation.
