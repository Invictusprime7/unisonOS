# Architecture decisions
- Unset Babel breaking mode: browsers lack process.
- Load Unison tokens after base CSS; bridge app roles in `src/styles/unison-theme.css`, font links in `main.tsx`. Why: vendor values win without vendor edits or site regeneration.

- `LauncherWizard` captures intent and invokes orchestration, never authors or mutates VFS. Why: selection-only ownership.
- `UnisonAppBuilder` is the sole fresh-launch application author: derive `AppBuildContract`, generate/repair one candidate, promote after site-wide closure.
- The canonical platform owns topology/routes, capabilities/intents/bindings, Theme/Stage 4b tokens, Art Direction, UI foundation, protected infrastructure and validation; never generate competing pages after App Builder authorship.
- `commitMutation` remains the only legal canonical writer; initial generation accepts one passing candidate, never repairs or per-page checkpoints as revisions.
- Saved projects hydrate accepted revisions; parsers/Playground hydration are read-only. Candidates stay unsanitized/unsplit; uploads lead context and images survive Composer repairs. Why: preserve source; signed-in acceptance remains required.
- Composer contracts are byte-mirrored at `supabase/functions/_shared/aiComposerContract.ts` and `src/contracts/aiComposerContract.ts`; enforce targets, planned routes, dependency/new import reads and literal intents; hunks preferred, whole-file replaces accepted. Why: authoring vocabulary is not ownership or readiness.
- Composer modes stay in `ai-code-assistant/composerLane.ts`. Why: no parallel author/repair/edit pipelines.
- Page composition intelligence lives in `src/services/composition/` (one universal planner + data-only industry profiles, consumed under App Builder orchestration); why: industries differ by data, never by engine.
- Variant selection goes through `src/services/designImplementationEligibility.ts`; variants carry authored `capabilities`/`compatibility`/`lifecycle`/`ai` contracts, preferred over string inference. Why: registry growth narrows candidates deterministically, never widens AI context.
- WebBuilder launch-handoff dedupes on `routeHandoffImportedRef`, never `importedRouteStateRef`; why: revision adoption updates the shared ref, replaying original Wizard files over saved edits.
- `projects` ↔ `builder_drafts` name-sync triggers skip when `pg_trigger_depth() > 1` and write only changed values; why: re-entry raises SQLSTATE 27000 and blocks saves.
- Persist draft chat in owner-only `builder_chat_history` via debounced `aiHistoryStore.setMessages`; localStorage is a cache. Why: chats survive devices.
- App Builder pages pass `pageStructureGate.ts` (nav, footer, body, media) via `pageCheck`; briefs lead with own target/archetype. Why: routers add no chrome.
- Live-VFS commits absorb pending ops recorded before capture and advance the autosave baseline; pending ops conflict only off another base revision. Why: lagging baselines raised false conflicts.

- Chat and Wizard share one launch plan (`src/services/launch/chatLaunchPlan.ts`): the chat brief prefills the Wizard, and `buildSyncedVisionBrief` puts final selections first; page briefs put composition target + design contract before that vision. Why: separate chat/Wizard inputs drifted and crowded out composition vocabulary.
- Agent tools use enforced dispatch; proposals use `runBuilderAiMutation` → `commitMutation`. Capture live VFS/revision together; refuse stale preparation/selection. Resolve prompted parts to visible-page source owners; refuse only incomplete target reads. Why: guessed pages changed unrelated content.

- Service/recipe rules: `src/services/AGENTS.md`; provider rules: `supabase/functions/_shared/AGENTS.md`.
- UNISON is the only backend: `src/integrations/supabase/env.ts` ignores other injected refs, `main.tsx` fails closed on identity mismatch, and backend changes deploy only via `.github/workflows/supabase-auto-update.yml`, so every schema change needs a timestamped `supabase/migrations` file (drizzle alone fails CI); why: Lovable tooling targets its built-in database.
- Auth listeners stay synchronous; defer SDK/claims, bound onboarding. Reused route gates await sessions; events supersede initial reads. Handoffs skip Auth/Home/Demo; checkout/consent stay explicit. Why: prevent deadlocks and redirect loops.
- Before app load, bridge only auth keys to sessionStorage on quota errors; never evict project data or edit the generated client. Why: full storage must not block sign-in; fallback lasts until the tab closes.

- Builder preferences are optional local state enforced at request/execution boundaries; tools gate the menu, catalog/business settings gate their operations. Why: hiding controls cannot authorize disabled mutations.

- Agent record updates use EditorCommand with observed fields; adapters own scoped writes/invalidation. Why: clicks and AI share one owner.
- Edit gates block only compile/imports, stale/ownership, protected paths, data loss and binding execution; design/scope findings are advisory; theme requests use the theme lane. Why: avoid policy dead ends.
