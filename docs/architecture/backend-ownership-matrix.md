# Backend Ownership Matrix

**Repository evidence captured:** 2026-10-15. This matrix records source-level ownership; it does not certify the live Supabase project's schema, RLS, grants, Storage rules, or migration state.

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
| Catalog list/get/create/update/delete | `cms-records` | `project-backend` catalog contract | Implemented through the existing facade; contract parity still needs explicit tests for project filtering and result/error semantics. |
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
