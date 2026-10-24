# Architecture decisions
- Unset Babel breaking mode: browser.
- Load Unison tokens last; hero effects opt in via theme bridge. Why: protect vendor skins.
- Demo counts settle with canonical revisions. Why: count only saved generations.

- `LauncherWizard` captures intent and invokes orchestration, never authors or mutates VFS. Why: selection-only ownership.
- `UnisonAppBuilder` is the sole fresh-launch application author; `generate-page` reuses Composer and saved Home design. Why: no parallel writer.
- The canonical platform owns topology/routes, capabilities/intents/bindings, Theme/Stage 4b tokens, Art Direction, UI foundation, protected infrastructure and validation; never generate competing pages after App Builder authorship.
- `commitMutation` remains the only legal canonical writer; initial generation accepts one passing candidate, never repairs or per-page checkpoints as revisions.
- Saved projects hydrate accepted revisions; parsers/Playground hydration are read-only. Candidates stay unsanitized/unsplit; uploads lead context and images survive Composer repairs. Why: preserve source; signed-in acceptance remains required.
- Composer contracts mirror `supabase/functions/_shared/aiComposerContract.ts` and `src/contracts/aiComposerContract.ts`; enforce targets/routes/import reads/intents; prefer hunks, accept replaces. Why: vocabulary is not readiness.
- Composer modes stay in `ai-code-assistant/composerLane.ts`. Why: no parallel author/repair/edit pipelines.
- Page composition intelligence lives in `src/services/composition/` (one universal planner + data-only industry profiles, consumed under App Builder orchestration); why: industries differ by data, never by engine.
- Variant selection goes through `src/services/designImplementationEligibility.ts`; variants carry authored `capabilities`/`compatibility`/`lifecycle`/`ai` contracts, preferred over string inference. Why: registry growth narrows candidates deterministically, never widens AI context.
- WebBuilder launch-handoff dedupes on `routeHandoffImportedRef`, never `importedRouteStateRef`; why: revision adoption updates the shared ref, replaying original Wizard files over saved edits.
- `projects` ↔ `builder_drafts` name-sync triggers skip when `pg_trigger_depth() > 1` and write only changed values; why: re-entry raises SQLSTATE 27000 and blocks saves.
- Persist draft chat in owner-only `builder_chat_history` via debounced `aiHistoryStore.setMessages`; localStorage is a cache. Why: chats survive devices.
- App Builder pages pass `pageStructureGate.ts` (nav, footer, body, media) via `pageCheck`; briefs lead with own target/archetype. Why: routers add no chrome.
- Live-VFS commits absorb pending ops recorded before capture and advance the autosave baseline; pending ops conflict only off another base revision. Why: lagging baselines raised false conflicts.

- Chat/Wizard share `src/services/launch/chatLaunchPlan.ts`; chat prefills Wizard; `buildSyncedVisionBrief` prioritizes final selections; page briefs lead with composition target/design contract. Why: prevent input drift and crowded-out design context.
- Agent tools use enforced dispatch; proposals use `runBuilderAiMutation` → `commitMutation`. Capture live VFS/revision together; refuse stale preparation/selection. Resolve prompted parts to visible-page source owners; refuse only incomplete target reads. Why: guessed pages changed unrelated content.

- Service/recipe rules: `src/services/AGENTS.md`; provider rules: `supabase/functions/_shared/AGENTS.md`.
- UNISON is the only backend: `src/integrations/supabase/env.ts` ignores other injected refs, `main.tsx` fails closed on identity mismatch, and backend changes deploy only via `.github/workflows/supabase-auto-update.yml`, so every schema change needs a timestamped `supabase/migrations` file (drizzle alone fails CI); why: Lovable tooling targets its built-in database.
- Auth listeners stay synchronous; events win initial reads; SDK alone invalidates refresh; tab bridges yield to persisted auth; chunk retries are explicit. Auth/callbacks go Home or Demo; handoffs skip both and Auth. Why: avoid deadlocks, stale sign-out and reloads.
- Before app load, bridge only auth keys to sessionStorage on quota errors; never evict project data or edit the generated client. Why: full storage must not block sign-in; fallback lasts until the tab closes.

- Builder preferences are optional local state enforced at request/execution boundaries; tools gate the menu, catalog/business settings gate their operations. Why: hiding controls cannot authorize disabled mutations.

- Records use EditorCommand/adapter writes; generation schemas are job-scoped. Why: prevent cross-site leakage.
- Edit gates retain compile/imports, ownership, protected paths, data-loss and binding safety; design/scope is advisory. Queue rebase checks domain dependencies, not age; reviews remain revision-bound. Why: independent saves must not block edits.

- Affinity shows public paragraphs, never native thinking. Why: explanations without private deliberation.
- Marketplace certification evidence is server-owned and source-bound; client preflight stays non-publishing and deployment SQL lives only in canonical migrations. Why: local checks and concept previews are not release authorization.
- Marketplace cards share MarketplaceThumbnailSurface; published covers read image references from the safe package without executing source, while VFSPreview stays on details. Why: static cards must not mount the full site runtime or expose restricted source media.
- Marketplace releases preserve capability requirements and slot-intent identities, never creator approvals or resource payloads; provisioning remains buyer-owned. Why: copying requirements must not authorize live writes to the creator's services.
- Published cart intents use the canonical client commerce adapter with site-scoped browser persistence and quantity badges; checkout stays server-priced and provider-gated. Why: a bag can persist without granting payment authority or trusting browser prices for charges.
- Marketplace concept actions use explicit product payloads and the shared browser cart scoped by concept identity; business submissions and payments remain clearly labelled samples, never creator-service writes. Why: interactive previews must not imply live booking or payment authorization.
- Marketplace image-bearing section props hydrate through the pure shared marketplaceImagePlaceholders adapter using imported project sample assets, preserving authored pictures and release rights. Why: Home and secondary pages must retain identical image assignments after remounts without modifying vendor renderers or licensing gates.
- Marketplace draft installation packages actual authored concept declarations and unchanged Unison render dependencies, then uses confirmed identity provisioning and commitMutation; published packages require server-issued buyer entitlements. Why: previews are not draft persistence or license grants.
