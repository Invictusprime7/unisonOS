# Roadmap

## Sign-in recovery
- [x] Recover auth-key quota errors with tab-persistent fallback, without deleting project data
- [x] Release auth listener locks before onboarding lookups and audit logging; reset loading on thrown sign-in errors; 11 regression tests pass
- [ ] Confirm real-account sign-in reaches the workspace (available managed session targets a different backend; requires user sign-in)

## Active: Enforced AI Builder Connector
- [x] Phase 1: typed context connector integrated with existing App Builder edits and shared transport; ownership, revision and registry validation; 41 related tests pass
- [x] Phase 2: enforced dispatch over agentOperations (identity, record ownership, source scope, canonical intents/tokens, router protection); 7 tests
- [x] AI Builder saved-record edits run through the enforced dispatcher
- [x] Command menu and Catalog panel catalog saves run through the enforced dispatcher
- [x] Stale-session edits: records ignore page version; page edits replay on newest version when safe, else ask (dispatcher + 4 tests; Builder UI prompt for the ask still to wire)
- [x] AI Builder redesign pass 1: task planner removed; quiet thinking trace; status in header; model + catalog controls moved below input
- [x] "Apply on latest version / Cancel" choice in Builder chat after a save lands mid-edit
- [x] Redesign pass 2: AI rounds (think → draft → check → adjust) narrated live in the Builder activity feed
- [x] Composer proposal scope enforcement: explicit targets, hunk-only existing-file edits and shared client checks; 60 regression tests pass; canonical workflow deployment and authenticated acceptance remain unverified
- [x] Builder route/dependency request enforcement: exact planned route operations and existing accepted dependencies; 75 regression tests pass; canonical workflow deployment and signed-in acceptance remain unverified
- Later: capability and imported-dependency enforcement; audited legacy removal; authenticated cross-industry browser acceptance
- Live verification blocked: available managed session targets the built-in backend, not authoritative UNISON
- Audit persistence: evaluate existing telemetry before adding canonical migrations; no new tables or record changes in Phase 1

## Active: Preview-First Resource & Editing Consolidation (guidebook: docs/milestones/PREVIEW_FIRST_RESOURCE_CONSOLIDATION_2026-10-11.md)

- [x] M0 (PR1): editor command instrumentation (correlation IDs, lane, save target) + golden ownership fixture matrix test
- [x] M0 remainder: mutation telemetry — commitMutation (base→result revision IDs), runExclusive (surface/duration/outcome), applyResourceOp (key/op/recordId) all record MutationEvents in editorTelemetry; 4 new tests pass
- [x] M1a: EditableObjectDescriptor + EditorTarget identity (tested)
- [x] M1b: preview clicks carry repeat index + structural locator → descriptor; AI scoped to that instance
- [x] M1c: reacquire selection highlight after rerender — VFSPreview stores last selection identity (selector/section/structuralPath/repeatIndex/resource), bridge resolves it after rebuild (resource mark → selector+index → structural path) and re-applies highlight; drops selection when object vanished
- [ ] M2 (PR2/3): Preview as sole primary edit UI — [x] inspector routes data-bound text/media to resource commands (replace "Edit it from the content panel" dead-end), [x] fill missing lane executors (binding), [x] upload picker from preview context (site storage, no inline data); [x] pending/saved/error + undo states; [ ] six-fixture reload exit check (needs signed-in browser run)
- [ ] M3 (PR4): unified Resources UX (Records/Collections), one canonical record type per use case (testimonials/projects/FAQ collisions), catalogOperations delegates to Resource Runtime
- [ ] M4 (PR5): retire Creator Playground overlap behind `previewFirstResources` flag; PlaygroundSyncController hydrate-only
- [ ] M5: tenant scoping/RLS verification, dedicated-backend content/profile adapters, expected-revision concurrency on record updates
- [ ] M6: AI edits ride the same EditorCommand/ResourceRuntime plane
- [ ] M7: cross-industry E2E beta gate (10 cases in guidebook)

## Blocked
- Per-site dedicated databases: awaiting account/billing choice (owner token vs customer OAuth)
