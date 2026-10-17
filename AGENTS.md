# Architecture decisions

- Load Unison tokens after base CSS, bridge app roles in `src/styles/unison-theme.css`, and load font links in `main.tsx`; why: vendor values win without vendor edits or saved-site regeneration.

- `LauncherWizard` is selection-only: it captures intent and invokes launch orchestration, but never authors or mutates VFS source.
- `UnisonAppBuilder` alone authors fresh launches: derive `AppBuildContract`, generate/repair one isolated candidate, promote after site-wide closure.
- The canonical platform owns topology, routes, capabilities, intents, bindings, Theme/Stage 4b tokens, Art Direction, UI foundation, protected infrastructure and validation. It must not generate a competing fresh-launch page implementation after App Builder authorship.
- `commitMutation` is the sole canonical writer; initial generation accepts one complete passing candidate, never repair attempts or per-page checkpoints as revisions.
- Saved projects hydrate accepted revisions; parsers are compatibility-only. Candidates stay unsanitized/unsplit; upload text/links lead context and images survive Composer repairs. Image routing uses typed Composer transport; signed-in acceptance remains required; why: preserve vision and source.
- Composer contracts are byte-mirrored at `supabase/functions/_shared/aiComposerContract.ts` and `src/contracts/aiComposerContract.ts`; enforce targets, planned routes, dependency requests/new AST module reads, and declared/new literal intents; edge edits require hunks. Why: canonical authoring vocabulary is not ownership or live readiness.
- Composer author/repair/edit modes stay in `ai-code-assistant/composerLane.ts`; why: no parallel pipelines.
- Page composition intelligence lives in `src/services/composition/` (one universal planner + data-only industry profiles, consumed under App Builder orchestration); why: industries differ by data, never by engine.
- Variant selection goes through `src/services/designImplementationEligibility.ts`; variants carry authored `capabilities`/`compatibility`/`lifecycle`/`ai` contracts, preferred over string inference. Why: registry growth narrows candidates deterministically, never widens AI context.
- WebBuilder launch-handoff dedupes on `routeHandoffImportedRef`, never `importedRouteStateRef`; why: revision adoption updates the shared ref, replaying original Wizard files over saved edits.
- The `projects` ↔ `builder_drafts` name-sync triggers skip when `pg_trigger_depth() > 1` and only write rows whose values differ; why: re-entrant writes to the in-flight draft row raised SQLSTATE 27000 and failed every builder save.
- Persist draft chat in owner-only `builder_chat_history` via debounced `aiHistoryStore.setMessages`; localStorage is a cache. Why: conversations must survive devices/sessions.
- App Builder pages must pass the structural floor in `src/services/app-builder/design/pageStructureGate.ts` (shared nav + footer, minimum body sections, imagery on media-led roles) via the orchestrator's `pageCheck`, and each page brief leads with its own composition target and only its own archetype block; why: the router adds no chrome and truncated, site-wide briefs let the AI ship lone centered heroes.

- Chat and Wizard share one launch plan (`src/services/launch/chatLaunchPlan.ts`): the chat brief prefills the Wizard, and `buildSyncedVisionBrief` puts final selections first; page briefs put composition target + design contract before that vision. Why: separate chat/Wizard inputs drifted and crowded out composition vocabulary.
- Agent tools use enforced dispatch; proposals use `runBuilderAiMutation` → `commitMutation`. Capture live VFS/revision together; refuse stale preparation/selection. Connector context is read-only; source edits/React repairs require App Builder candidates. Launch/catalog retain chat transport; unsupported legacy source edits refuse. Why: one writer, current context, no fallback author.

- Save queue, terminal, resource, project-list, preflight, scoped-edit, preview, site-backend and editor-command rules: `src/services/AGENTS.md`; AI provider order: `supabase/functions/_shared/AGENTS.md`.
- UNISON is the only backend: `src/integrations/supabase/env.ts` ignores other injected refs, `main.tsx` fails closed on identity mismatch, and backend changes deploy only via `.github/workflows/supabase-auto-update.yml`, so every schema change needs a timestamped `supabase/migrations` file (drizzle alone fails CI); why: Lovable tooling targets its built-in database.
- Auth state listeners stay synchronous and defer auth-backed queries/audits to a later task; why: awaiting SDK calls inside its session lock deadlocks successful sign-in.
- Before app load, bridge only auth keys to sessionStorage on quota errors; never evict project data or edit the generated client. Why: full storage must not block sign-in; fallback lasts until the tab closes.

- Builder preferences are optional local state enforced at request/execution boundaries; tools gate the menu, catalog/business settings gate their operations. Why: hiding controls cannot authorize disabled mutations.
