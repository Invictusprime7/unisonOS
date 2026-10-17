# Preview Execution Convergence — one editing path, proven end to end

Goal from the uploaded review: stop expanding architecture; make inspector, toolbar, and AI use the same execution contract, and prove one full edit slice (select → edit → save → preview → reload → reopen) persists.

## P0 — Converge the inspector onto the command service
- `WebBuilder.tsx` inspector edits currently go through `planInspectorExecution` (`src/services/builder/inspectorPatchExecution.ts`) while text edits and the toolbar use `executeEditorCommand`.
- Route inspector operations (set-slot-text, set-slot-asset, style/visibility) through `executeEditorCommand` with the same `EditorCommandContext` the toolbar adapter uses, so ownership resolution, telemetry, and resource-vs-source routing happen in one place.
- Keep `planInspectorExecution` as a pure planner only if the command service reuses it; otherwise retire it once the command path passes its tests.

## P0 — Persistent preview updates (the acceptance slice)
- Add an end-to-end style test that mirrors the review's restaurant workflow at the service level: create/edit a menu item (name, price, image) via `executeEditorCommand` → assert Resource Runtime write → assert invalidation event carries `projectId` + `sourceTables` → re-query and assert persisted values → assert a second project's records are untouched.
- Verify generated preview sections actually re-render on resource invalidation; fix any bound section that listens to the wrong event or table key.

## P0 — Object identity reliability
- Audit `data-ut-resource` provenance marking on generated catalog/content sections: every rendered record field that is editable must carry a resource mark, so clicks resolve to a record instead of falling back to JSX rewrites. Fill gaps in the section templates/recipes that omit the mark.

## P1 — Universal resource adapters on dedicated backends
- `resourceRuntime.ts` currently throws for non-catalog adapters on dedicated backends. Extend the tenant-scoped contract to `content` and `business-profile` adapters so all three work under the same gateway protocol (`executeResourceCommandCompatible`).

## Out of scope this round
- Playground decomposition (P1 in the review) and advanced visual authoring (P2) — deferred until the slice above is proven.

## Verification
- New tests for each change; run the focused editor/resource suites plus build. Report which parts still need a signed-in live check.
