# Guest Demo to Account Continuity

## Status

This is an implementation-in-progress. The Home/Dashboard route conflict and account-route authentication boundary are addressed. A private guest action ledger, provider-cost reservation/settlement path, session spend ceiling, and canonical revision settlement hook now exist in local source and pass PGlite and Edge tests. The two migrations and Edge changes are not deployed. `/try`, anonymous sign-in, guest project provisioning, account claim, Cloud arrival notice, and billing top-up are not implemented; do not enable `GUEST_DEMO_ENABLED` or advertise guest projects as recoverable.

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
| Guest credits / project claim | Local-only guest AI action and provider-usage ledger; project claim absent | Per-call cost reservations and settlement enforce $0.15 per action and $0.45 per guest session. The migrations are not deployed. No guest claim-ticket or account-transfer transaction exists. |

## Route Contract

- `/` remains the public marketing landing.
- `/auth` remains the separate sign-in/sign-up surface.
- `/home` now renders a dedicated authenticated Home and links to Cloud Projects; `/dashboard` remains separate.
- `/web-builder` is protected at the route-render boundary and anonymous sessions do not count as account sessions.
- `/try` is intentionally not registered yet. Exposing it before server-side capability and credit enforcement would allow an anonymous Auth session to reach normal account operations.
- `ai-code-assistant` keeps anonymous access disabled unless `GUEST_DEMO_ENABLED=true`. Leave this unset: full RLS isolation for anonymous users and the guest launch path are not yet validated.

## Live Schema Audit

On 2026-10-18, the linked `UNISON` project was inspected read-only with Supabase CLI. A migration dry-run lists only the two guest-demo migrations as pending. The inspected `projects`, `builder_drafts`, `site_revisions`, `builder_chat_history`, `businesses`, `project_members`, and `business_members` tables have RLS enabled. The deployed policies scope drafts/chat by `auth.uid()`, projects by owner or membership, and revisions by project membership; they do not distinguish anonymous Auth users from permanent users.

The active linked project is not a disposable test database. The local Supabase stack could not start because Docker/Podman is unavailable. An empty preview branch entered `MIGRATIONS_FAILED` during provisioning and was deleted. No migration was applied to the active database. The guest ledger migration has only been applied to PGlite stand-ins; configure and validate anonymous Auth and new guest tables in a working disposable staging project before deployment.

## Local Guest-Ledger Boundary

- The policy allows three settled actions, caps each action at 150,000 micro-USD ($0.15), and caps lifetime provider reservations/usage at 450,000 micro-USD ($0.45) per guest. It also sets input/output token limits, request-rate limits, and session/reservation expiry. Private tables and RPCs are service-role-only.
- Before every generation, the Edge provider loop calls Gemini's `countTokens`, reserves the maximum input/output cost, and sends only to the priced Gemini 3.8 Flash model. Returned usage is reconciled; missing usage settles at the full reservation. Provider fallback/retry, catalog tools, attachments/multimodal turns, and external research are disabled for guests. A per-session transaction lock serializes spend reservations.
- The accepted-revision trigger refuses to settle an action if provider usage is pending or over its cap. Failed requests retain reserved provider cost conservatively while their action allowance is released; this prevents repeated failures from escaping the session ceiling.
- The two migrations are absent from remote history; `supabase db push --linked --dry-run` listed exactly those two files and applied nothing. The local Supabase stack cannot start because Docker/Podman is unavailable. Existing exposed tables/RPCs/storage have not been comprehensively hardened to distinguish anonymous Auth users from permanent authenticated users.

## Next Implementation Gates

1. Provision a working disposable Supabase staging project/branch and confirm anonymous sign-ins there; the current preview branch failed provisioning.
2. Harden all exposed Data API, RPC, and Storage policies for anonymous Auth identities before enabling sign-in. Add abuse/CAPTCHA and account recovery policy.
3. Apply both migrations and deploy `ai-code-assistant` to the disposable staging project; verify countTokens, provider usage reconciliation, and the disabled-by-default flag there before enabling it for a controlled beta.
4. Exercise guest project provisioning and the launch orchestrator; initial site provisioning does not yet use the new reservation path. Reuse the existing launch pipeline, WebBuilder, and `commitMutation` only.
5. Implement a one-time, short-lived claim ticket and atomic transfer of project, business, draft, accepted revisions, assets, and chat. Verify claimant identity server-side before transfer, then navigate to `/home`.
6. Verify the claimed project through the existing Cloud projection and reopen it through the normal `/web-builder?id=<draft-id>` route. Add the composer notice from authoritative balance state.
7. Add staging E2E tests for parallel reservations, provider budget, claim replay/cross-account access, reload/reopen, exhausted credits, and restricted business effects.

Do not use `user_metadata`, a browser counter, project IDs, or query parameters as authorization. Do not use business `usage_events` as the Builder AI credit ledger, and do not show a successful claim until the server confirms the transaction.