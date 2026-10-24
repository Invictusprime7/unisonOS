# Roadmap

## Active: Builder prompted-edit completion
- [x] Resolve prompted parts against visible-page source owners; site-wide navigation unions owners without guessing unrelated pages
- [x] Preserve selected-element instructions and complete conversation context through canonical App Builder edits; interpretation failures close the pending turn and timers clear on every exit
- [x] Verify source-owner resolution, incomplete-source rejection and canonical candidate/revision boundaries: 57 tests, both authority lints and preview build pass; durable save acceptance remains below
- [ ] Verify signed-in save → preview → reopen on the designated UNISON project; blocked by unavailable authoritative session
- [x] Remove false "Pending source conflicts" after in-line text edits: commits absorb captured pending ops, autosave baseline follows every accepted revision, same-revision ops never conflict; 45 tests pass
- [x] Launch check and button wiring read markers in the shared nav/footer components a page renders (newsletter, menu/search/account icons, nav quote); 34 tests pass; live relaunch unverified

## Active: Uploaded preview-first architecture merge
- [x] Merge recommendations into the guidebook; retain the mounted operations modal, distinct resource schemas, canonical launch compilation and binding services
- [x] Retire unused Playground compile API and unmounted duplicate panel; inferred hydration stays clean; catalog tools delegate to project-scoped Resource Runtime without global source swaps
- [x] Run 53 ownership/hydration/resource/canonical-edit tests and both authority lints; preview build passes
- [ ] Signed-in record save → preview → reopen acceptance; requires authoritative UNISON session and designated project
- [x] Refresh two stale previewSingleOwner expectations to retain the existing pendingSourceConflictPolicy; preview implementation unchanged

## Active: Web Builder browser startup
- [x] Replace Babel's Node-only breaking-mode flag without exposing host environment variables
- [x] Verify Babel initialization without `process` in isolated browser bundles, 22 editor regressions, authority lint, and live Builder startup with zero page errors; saved-project content remains blocked by the authoritative-session issue below

## Active: Selected text editing
- [x] Preserve nested inline formatting/icons in selected literal text and canonical slot edits; anchor direct edits to clicked text, prefer explicit AI source ownership and refuse ambiguous text matches
- [x] Run nested-text, inspector, rendering and canonical edit regressions
- [ ] Verify selected text → save → reopen on the saved project; blocked by the unavailable authoritative UNISON session

## Active: Builder result and preview closure
- [x] Retire remaining AI editing fallback paths; removed unused response extraction, legacy code/file callbacks and synthesized file responses; candidate apply stays canonical
- [x] Fix portable table export collision, safe table cell values/record ownership, and diagnose malformed Tailwind arbitrary values before acceptance; 80 regression tests pass
- [ ] Verify Builder result → save → preview → reopen on the designated project; available session targets the other backend, so the sandbox loads an empty workspace rather than the saved site

## Active: Recipe contract corrections
- [x] Correct FAQ layout-derived IDs and canonical auth bindings; remove unregistered intents from locally handled controls, regenerate portable recipes; 211 regression tests pass
- [x] Resolve auth submit ownership and local toggle behavior in portable recipes; generated auth forms submit once through site-auth, candidate guards reject overlay-submit and local ui.toggle bindings
- [x] Ground generated export/variant identities and AI context in verified App Builder recipe manifests; preserve supplied section/component IDs; 103 focused regressions pass
- [ ] Verify real-site auth, canonical functional instance allocation, and save → preview → reopen on UNISON; requires an authoritative session and designated test project

## Active: AI Builder frontend replacement
- [x] Replace Builder chrome/composer with minimal borders and reduced hover fills; expose compact feature settings
- [x] Enforce feature toggles at request dispatch, use the connector for tool actions, and retire legacy source-writing/debug fallback branches
- [x] Verify real panel controls in isolation: switches persist, command tools disable, accessible input, zero runtime errors; 78 regressions and authority lint pass
- [ ] Verify authenticated save → preview → reopen for all four flows; blocked by unavailable authoritative UNISON session and designated test project

## Active: Unified AI Builder request closure
- [x] Wire React debug repairs to App Builder candidates; page creation carries connector context; image requests and catalog/selection inspections use enforced tools; capture live VFS/revision, refuse stale preparation/selection and unsupported capability bindings
- [ ] Verify page creation, image replacement, catalog edits and capability bindings through save → preview → reopen on UNISON (regressions pass; browser reaches sign-in without runtime errors, but available session targets another backend)
- [x] Remove Builder response-to-source extraction and direct theme/icon/layout/debug source shortcuts; source authorship is Composer-only. Launch/catalog transport remains; unsupported non-React source editing refuses.
- [ ] Complete replacement acceptance before removing compatibility helpers outside Builder; requires a valid UNISON session and designated test project

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
- [x] Builder intent/capability authoring enforcement: canonical capability-derived actions; reject unsupported declared and new literal DOM intents before candidate preparation; 84 regression tests pass; computed bindings, deployment and live readiness remain unverified
- [x] Actual-import dependency enforcement: AST inspection at the shared proposal boundary for undeclared packages, remote/computed imports; 107 regression tests pass; deployment and signed-in acceptance remain unverified
- [x] Phase 4a: audited Builder consumers; removed unused Composer trailer helper, retained active parser/repair/compatibility paths; 116 tests and authority lint pass
- [x] Phase 4a continuation: retired unused response-to-VFS authoring exports; active fallback extraction preserved; 74 tests and authority lint pass
- [x] Phase 4b first boundary: prepared Composer candidates bypass response extraction and compatibility sanitization; complete file operations apply together without sequential splitting
- [x] Phase 4b document context: forward uploaded links and extracted file text to App Builder, ahead of optional runtime context so truncation cannot crowd them out; image vision remains on its existing path
- [x] Phase 4b image transport preparation: typed references through App Builder and Composer repairs, actual image content parts and payload preservation; 71 regression tests pass; production routing remains unchanged pending provider fallback and signed-in checks
- [x] Phase 4b provider boundary: deterministic real-adapter tests verify Gemini/OpenAI/gateway image bytes and placement context through failover and Composer repair; 2 new tests + 39 client regressions pass; no live calls or routing changes
- [x] Phase 4b image enablement: shared toAnthropicMessages converts OpenAI image_url data-URL parts to Anthropic base64 image blocks in providerClient.callAnthropic and aiProviderLoop Phase 4; attachment exclusion removed from shouldUseCanonicalComposer and AIBuilderPanel threads typed images into unisonAppBuilder.edit; edge 71/71 and client 21/21 pass; signed-in acceptance still pending
- [x] Edge regression drift resolved: budget test updated to current 145s, builder_source_edit gateway-lead expectation matches composer routing; full edge suite 71 passed / 0 failed
- [ ] Phase 4b remainder: authenticated attachment/source acceptance before removing compatibility helpers outside Builder; Builder itself is now candidate-only
- Later: authenticated cross-industry browser acceptance
- Live verification blocked: available managed session targets the built-in backend, not authoritative UNISON
- Audit persistence: evaluate existing telemetry before adding canonical migrations; no new tables or record changes in Phase 1

## Active: Preview-First Resource & Editing Consolidation (guidebook: docs/milestones/PREVIEW_FIRST_RESOURCE_CONSOLIDATION_2026-10-11.md)

- [x] Records page at /business/records: project-scoped collection filters, search, schema editor, create and content lifecycle actions; existing content/catalog pages link to it.
- [x] Registry alias convergence: catalog renderer aliases preserved; CMS FAQ/case-study/review/project aliases normalize to logical types retaining all historical type IDs, fields and record addresses; launch/adoption reuse aliases.
- [ ] Physical catalog↔CMS record migration: requires authoritative live audit and approved mapping; legacy records appear in one logical collection but remain in original stores with publishing history intact.

- [x] M0 (PR1): editor command instrumentation (correlation IDs, lane, save target) + golden ownership fixture matrix test
- [x] M0 remainder: mutation telemetry — commitMutation (base→result revision IDs), runExclusive (surface/duration/outcome), applyResourceOp (key/op/recordId) all record MutationEvents in editorTelemetry; 4 new tests pass
- [x] M1a: EditableObjectDescriptor + EditorTarget identity (tested)
- [x] M1b: preview clicks carry repeat index + structural locator → descriptor; AI scoped to that instance
- [x] M1c: reacquire selection highlight after rerender — VFSPreview stores last selection identity (selector/section/structuralPath/repeatIndex/resource), bridge resolves it after rebuild (resource mark → selector+index → structural path) and re-applies highlight; drops selection when object vanished
- [ ] M2 (PR2/3): Preview as sole primary edit UI — [x] inspector routes data-bound text/media to resource commands (replace "Edit it from the content panel" dead-end), [x] fill missing lane executors (binding), [x] upload picker from preview context (site storage, no inline data); [x] pending/saved/error + undo states; [x] service-level six-fixture text/image persistence + URL field reopen tests (`crossIndustryResourceEditing.test.ts`); [ ] signed-in browser six-fixture resource edit/reload exit check (authenticated FLIXX project reload restores six pages and renders; Connected Data reports no live-data sections bound, so browser resource edits cannot be exercised)
- [ ] M3 (PR4): unified Resources UX (Records/Collections), one canonical record type per use case (testimonials/projects/FAQ collisions); [x] CMS admin uses Records/Collections labels without changing routes or lifecycle commands; [x] catalogOperations → agentOperations → Resource Runtime
- [ ] M4 (PR5): remaining mounted Creator Playground UX consolidation; [x] unused duplicate panel retired and PlaygroundSyncController hydration-only
- [ ] M5 live tenant/RLS verification: needs authoritative sign-in; [x] AI reads scoped via Resource Runtime; [x] cross-project edit rejection and live-event filtering tested; [x] catalog conditional updates implemented in existing handlers; [x] content/profile observed-value checks wired; [ ] atomic shared content/profile commands require canonical migration tooling (available migration target is the wrong backend; no schema applied)
- [x] M6 source wiring: AI catalog and generic resource field updates issue EditorCommand with observed fields and return the actual saved record; hide uses the same update path; creation/deletion retain Resource Runtime; authenticated preview/reopen evidence remains below
- [ ] M7: cross-industry E2E beta gate (10 cases in guidebook)

## Blocked
- Per-site dedicated databases: awaiting account/billing choice (owner token vs customer OAuth)
- [x] Typing during an AI save is held and replayed on top of the AI result (conflict → keep/discard choice)
- [x] Shared editor, theme and style save points covered by conflict tests (`savePointConflicts.test.ts`)
- [x] Real pending-source conflicts offer "Keep my edit on the latest version" / "Discard" in the preview card
- [x] AI activity feed claims "saved"/"shown in preview" only after a commit and preview confirmation in that run
- [ ] Live signed-in verification of the above (needs a signed-in session)
- [x] Hard vs advisory edit policy: relax style/scope blockers, keep safety blockers (plan 2026-10-17)
- [x] Conversational AI Builder: ask/offer 2–3 Unison options for open-ended requests; tappable choices
- [ ] Server AI changes go live after the GitHub deploy workflow runs (prompt, scope, whole-file replies)
- [x] Preview Execution Convergence (plan 2026-10-17): inspector text/asset/intent ops route through executeEditorCommand (source 'inspector'); planInspectorExecution stays the pure planner
- [x] Restaurant slice acceptance test: menu item name/price/image edit → record write scoped to project → invalidation carries projectId + sourceTables → other project untouched (previewExecutionConvergence.test.ts, 108 tests pass)
- [x] Resource executor resolves default fields from the resource schema (menu image → image_url), never hardcoded guesses
- [x] Dedicated-backend gateway contract extended to content entries + site profile (project-backend edge); client resourceRuntime no longer throws for non-catalog adapters — gateway is the authority
- [ ] Deploy project-backend edge change via GitHub workflow; live signed-in slice check still open
- [x] WYSIWYG never gated on manual save: unmatched slug marks auto-create the record in one write (seeded name from the mark), "Save the site first" dead-end removed; 30 resource tests pass
- [x] Finish click/AI conflict wiring: inline original text, loaded inspector fields, guarded undo, failed reads never auto-create duplicate records; record fields auto-apply on blur/toggle
- [x] Cross-industry service integration: second product image, menu price/category, service duration, concurrent edits, unbound edits, safe undo and failed-write invalidation; persistent adapter fixtures, not live database proof
- [ ] Full ten-case M7 browser acceptance (booking availability, case-study publish, mounted save concurrency included): needs authoritative signed-in session and approved test projects
- [ ] M3 data collisions: scoped live audit and approved migration needed before choosing/merging testimonial/project/FAQ record owners; no existing records moved or deleted
- [ ] M4 safe removal of mounted Playground editing: replacement equivalence requires the signed-in acceptance above; useful operations stay mounted

## Active: Post-restore recovery (commit 8704cda6d reverted non-Home work)
- [ ] Batch 1 Security: restore publicBusinessGate, trustedPreviewOrigin, endpoint auth/ownership gates (create-lead, intent-*, automation-event, chat, create-order-checkout, ghl-*, template-*), preview origin checks
- [ ] Batch 2 Auth/routing: useAuth, authSessionRecovery, authStorageQuota, Auth/AuthCallback destinations, routeAccessPolicy, routeConfig Home/Demo routes
- [ ] Batch 3 AI/generation: UnisonAppBuilder job-scoped schemas, generate-page transport, guest metering, scopedEditContentGuard, responseNormalizer out-of-scope, builderPrompts guidance
- [ ] Batch 4 Resources/DB/assets: resourceRegistry job-local projection, BusinessRecords/Catalog, recordsProjection, catalogOps, resourceExecutor identity, previewAssetScan, seedLaunchAssets, businessProfileService, deploymentService, project-backend check action, builderDraftBridge
- [ ] Batch 5 Revision/preview/theme: vfsCommitService typed rebase, WebBuilder resume precedence, VFSPreview Sandpack recovery, vite Babel defs, themeTokenOverrides shadow parsing, themeEdit errors
- [ ] Batch 6 Tests/docs/scripts: restore removed test coverage, README/AGENTS/roadmap entries, exemption registry, lint allowlist
- [ ] Delete 39 dead -UnrealDev parallel files + 3 dead SocialIcon.tsx duplicates (keep vendor design-system tree intact)
- [ ] Full verification: vitest, tsgo, build log

## Active: Marketplace R6
- [x] R6-P0 replace stale concept-preview test
- [x] M2.1 concept labelling, no price/purchase on concepts
- [x] R6-P1 move trusted-promotion SQL into canonical timestamped migrations; remove parallel pending SQL
- [ ] R6-P1 verify certification guards and staging regressions
- [ ] R6-P1 apply trusted-promotion SQL to UNISON (blocked: requires canonical GitHub workflow deployment)
- [ ] R6-P1 certify one design-only release (blocked: needs admin reviewer + accepted revision)
- [ ] R6-P2..P5 certified preview, free-claim install, brand contract, Stripe
