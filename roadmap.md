# Roadmap

## Active: Enforced AI Builder Connector
- [ ] Phase 1: typed context connector integrated with existing App Builder edits and shared transport; ownership, revision and registry validation; regression tests
- [ ] Phase 2: shared typed tool dispatch and capability/binding preflight
- [ ] Phase 3: edge-side proposal enforcement using existing Composer lanes
- [ ] Phase 4: remove legacy files only after call-site and replacement verification
- [ ] Phase 5: authenticated cross-industry browser acceptance
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
