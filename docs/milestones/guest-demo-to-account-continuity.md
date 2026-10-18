# Guest Demo to Account Continuity

## Status

This is an implementation-in-progress. The Home/Dashboard route conflict and the account-route authentication boundary are addressed. The `/try` workflow, demo credit ledger, claim transaction, Cloud arrival notice, and billing top-up are not implemented; do not advertise guest projects as recoverable until those gates are complete.

## Verified Ownership Map

| Concern | Current authority | Evidence / integration boundary |
| --- | --- | --- |
| User identity | Supabase Auth | `verifyAuth` validates request JWTs. Anonymous sessions carry the verified `is_anonymous` claim and are now denied by default in shared Edge auth. |
| AI generation | `ai-code-assistant` Edge Function | `AIBuilderPanel` calls `builderBrainClient`; the edge entry validates the request and runs the existing orchestrator. |
| Initial site authoring | App Builder launch orchestrator | `LauncherWizard` calls `runLaunchPipeline`; launch IDs are provisioned before the initial accepted snapshot is persisted. |
| Project identity | `projects` plus linked `builder_drafts` | The draft-sync trigger keeps the project and draft linked. A draft's `project_id` is the builder resume identity; Cloud opens `/web-builder?id=<draft-id>`. |
| Accepted site state | `site_revisions` | `commitMutation` is the only canonical revision writer. The draft's `last_revision_id` points at its accepted revision. |
| Editor conversation | `builder_chat_history` | Durable, user-scoped messages keyed by `draft_id`; the VFS and snapshot remain in the accepted revision. |
| Cloud project inventory | Cloud Workspace `CloudProjects` | Cloud merges the owner's `projects` rows and `builder_drafts` projections; `/cloud` accepts `{ tab: "projects" }`. |
| Existing usage data | `user_subscriptions` and business `usage_events` | `ai_generations_used` can be updated by the account itself and is not authoritative for guest spend. Business event quotas meter a different entitlement. |
| Guest credits / project claim | Not present | No guest claim-ticket or AI-credit ledger tables exist in the inspected deployed schema. |

## Route Contract

- `/` remains the public marketing landing.
- `/auth` remains the separate sign-in/sign-up surface.
- `/home` now renders a dedicated authenticated Home and links to Cloud Projects; `/dashboard` remains separate.
- `/web-builder` is protected at the route-render boundary and anonymous sessions do not count as account sessions.
- `/try` is intentionally not registered yet. Exposing it before server-side capability and credit enforcement would allow an anonymous Auth session to reach normal account operations.

## Live Schema Audit

On 2026-10-17, the linked `UNISON` project was inspected read-only with Supabase CLI. The migration history matched local migrations through `20261016002046`. The inspected `projects`, `builder_drafts`, `site_revisions`, `builder_chat_history`, `businesses`, `project_members`, and `business_members` tables have RLS enabled. The deployed policies scope drafts/chat by `auth.uid()`, projects by owner or membership, and revisions by project membership; they do not distinguish anonymous Auth users from permanent users.

The active linked project is not a disposable test database. The local Supabase stack could not start because Docker/Podman is unavailable. No migration was applied to the active database. Configure and validate anonymous Auth and new guest tables in a disposable staging project before deployment.

## Next Implementation Gates

1. Provision a disposable staging Supabase project or branch and confirm anonymous sign-ins are enabled there.
2. Add a server-owned guest-session record, one-project enforcement, expiry, reservation/settlement ledger, and one-time claim capability with RLS/grants closed to browser mutation.
3. Allow anonymous requests only in the specific launch and Builder AI handlers that enforce guest ownership, bounded inputs, demo capabilities, and atomic reservation. Keep every other Edge handler default-deny.
4. Reuse the existing launch pipeline, WebBuilder, and `commitMutation`; ensure metering settles only after a durable accepted revision and failed actions release reservations safely.
5. Claim project, business, draft, accepted revisions, assets, and chat atomically; verify the claimant from Auth, consume the short-lived ticket once, then navigate to `/home`.
6. Verify the claimed project through the existing Cloud projection and reopen it through the normal `/web-builder?id=<draft-id>` route. Add the composer notice from authoritative balance state.
7. Add end-to-end tests against staging, including parallel requests, claim replay, cross-account access, reload/reopen, exhausted credits, and restricted business effects.

Do not use `user_metadata`, a browser counter, project IDs, or query parameters as authorization. Do not use business `usage_events` as the Builder AI credit ledger, and do not show a successful claim until the server confirms the transaction.