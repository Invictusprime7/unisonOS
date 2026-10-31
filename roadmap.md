# Roadmap

## Active: Starter completeness and AI enrichment separation
- [ ] Enforce sealed page archetypes, legal variants and every planned section in builds without AI, preserving repeated sections and objects.
- [ ] Prevent AI authoring from accepting or projecting untouched starter sections as AI-enriched output.
- [ ] Run focused generation regressions and render checks; report any live generation/session limitation.

## Active: Remaining App Builder intent wiring
- [x] Native contact/lead/quote/newsletter CTAs focus their form instead of dispatching empty submissions; missing forms show a warning. Booking validates native fields, prevents in-flight duplicate submissions and requires explicit backend acknowledgment. Runtime sessions are site-scoped; unhandled intent-exec actions fail instead of falsely claiming completion. No shared enquiry recipient configured.
- [x] 63 runtime/contract checks and 139 isolated edge checks pass; both authority lints and preview build OK. Existing contact/quote CRM metadata already preserves custom answers; no extra storage pipeline added.
- [ ] Verify production behavior and provision additional actions (demo/consultation/proposal/coupon/volunteer) per site's actual configured handlers; requires authoritative UNISON deployment/session and each site's usable business connections. They now report unconfigured rather than pretending to persist. No live enquiry/email delivery or booking test performed.

## Active: Unison Gemini rate-limit recovery
- [x] Default to one page worker and align whole-site budgets with that concurrency; preserve explicit concurrency overrides and existing provisional checkpoints.
- [x] Provider loop honors Gemini Retry-After and Google RetryInfo once within the remaining request budget; no nested Gemini/gateway retries, shortened cooldowns, billing retries or timed-out work replay. Retry waits use request cancellation rather than the expired generation timer.
- [x] 53 focused authoring checks, 133 isolated edge checks, 34 App Builder checks and 21 marketplace checks pass; both authority lints and preview build OK. Two previously known launchRun Node-only storage checks still fail; no launchRun code changed.
- [ ] Verify live recovery through the canonical UNISON deployment and an authoritative signed-in launch. Uploaded report records a timeout, not a confirmed 429; fallback configuration and paid end-to-end generation remain unverified. No alternate-backend deployment performed.

## Active: Efficient multi-page finalization and selected contact fields
- [x] Remove cosmetic full-page re-authoring, exclude provisioning/contract issues from paid repairs and require a usable correction window; retain existing exact-request provisional checkpoints, never accept unfinished page source.
- [x] Finalize pending operational component bindings with explicit draft advisories exposed in launch progress; ready binding markers, ownership, native submission correctness, render safety and publish gates remain enforced.
- [x] Repair registered native forms by JSX source spans before closure, including required selected fields field_F0EFea and field_lBxDTO; 127 focused checks plus 124 neighboring checks (34 overlapping) and both authority lints pass. Preview build OK. No paid live generation or delivery test performed.
- [ ] Verify live multi-page generation → save → reopen and contact delivery; requires authoritative UNISON session/deployment.

## Active: Visit-page save classification
- [x] Shared route aliases classify informational Visit pages as contact; explicit role/type takes precedence over route inference. Saved authored source and renderability checks remain unchanged.
- [x] All 20 role/compilation/launch regressions and both authority lints pass; preview build OK. Saved Visit source survives recompile and /visit remains in the router.
- [ ] Live Sorella House edit → save → reopen: the designated project redirects to sign-in in the sandbox (zero runtime errors); requires an authoritative UNISON session.

## Active: Marketplace final-check timeout
- [x] Replace all-page repair fallback with diagnostic-owned requests using complete target source and direct imports, page-specific context and EDIT guidance; validate after each provisional fix and refuse unrelated source changes. Unknown/protected owners never trigger an all-site rewrite. Provider timeouts stop without replay; completed provisional fixes remain in the candidate, not an accepted revision.
- [x] Test targeted page/shared-component repair, separate multi-page fixes, prior-fix preservation on later timeout, and existing marketplace acceptance: 103 checks across six suites pass; both authority lints and preview build OK.
- [ ] Verify live install and backup availability; blocked by authoritative UNISON session/deployment access. No gateway key was configured on a different backend, and no paid live request was replayed. This change does not recover the already-failed install across reload.

## Active: Home sidecar wiring and downstream context
- [x] Project each provisional page through existing canonical component, binding and composition materializers before handing it forward. Home source and its composition sidecar reach subsequent requests with value-safe canonical object/binding/capability references; Home remains read-only and later pages keep their own roles and permissions. Home failure prevents secondary requests; skipped/budget/projection-failed pages cannot count as a complete application. No partial revision is accepted.
- [x] Verify Home wiring, downstream inheritance and failure isolation: 146 checks across eight suites pass, including applicable Home binding materialization, sidecar/data handoff, invalid Home barriers, read-only Home enforcement, inactive capability metadata, final closure and marketplace regressions. Both save/authoring authority lints pass; preview build OK. Tests use controlled authoring responses, not a live Gemini launch.
- [ ] Verify a real multi-page launch and saved reload; requires an authoritative UNISON session and usable deployed Gemini service.

## Active: Wizard launch progress
- [x] Show actual launch stages, page/batch updates and a bounded public Affinity activity feed during designing, without internal reasoning or simulated completion; reset progress for each launch and ignore stale callbacks.
- [x] Verify the display with controlled browser progress events and 48 progress/batch/authoring checks; preview build OK. The broader launchRun suite has two Node-only storage failures, and jsdom is unavailable because native canvas is missing.
- [ ] Verify progress during real production authoring; requires an authoritative UNISON session. The browser check renders controlled events, not a paid live generation.

## Active: Wizard business fields and native contact submissions
- [x] Carry canonical selected form fields into App Builder component and intent contracts, preserving required name/email/message and selected extra fields. Business field bindings carry scoped profile references and readiness, never private destination values.
- [x] Verify native contact ownership, no local success handlers, preserved selections and explicit deterministic starter behavior. Published native forms require ready registered slots, validate fields, prevent duplicate submissions and require confirmed backend success; hosted preview bridge recognizes native forms without immediate success claims.
- [x] Run focused contract/materialization/launch regressions: 129 checks and both authority lints pass; preview build OK.
- [ ] Verify authenticated live contact submission and read-back; blocked by the unavailable authoritative UNISON session. Runtime delivery tests use controlled backend responses, not production writes.

## Active: App Builder authoring reliability
- [x] Enforce complete-source file operations and transactional batch validation; safely retain completed batches and resume only failed work. Checkpoints live only in bounded tab memory for 15 minutes, keyed by exact request/source/plan/settings; refresh clears provisional progress, and no partial revision is committed.
- [x] Separate bounded provider calls from multi-batch page/site budgets; derive Wizard watchdog and marketplace budget from sealed section counts. Verify deterministic Home independently through canonical planning → App Builder → section-model closure, without AI calls.
- [x] Run focused reliability regressions: 123 client checks plus the independent deterministic Home test and all 125 edge checks pass; both authority lints pass. Node test environment avoids unavailable native canvas. Provider fixtures require ambient provider keys removed.
- [x] Resolve the broad App Builder failures: normalize Landing/Portfolio request roles, inherit generic profiles by role identity, correct unsupported Contact/Gallery/Booking/FAQ families before sealing, and give Pricing/Shop/Checkout/Blog explicit page jobs. Compact Shop/FAQ/Blog and Checkout start with their content rather than requiring a hero absent from some sealed packs. Industry coverage tests now use each industry's own default pages, not unrelated cross-industry page unions. All 89 targeted checks plus 102 neighboring composition checks pass (one existing skip); both authority lints and preview build pass. Canonical registry and sealed-target guards remain unchanged.
- [ ] Verify deployed Gemini, configured fallback, five-page launch and saved reload; requires canonical deployment and an authoritative UNISON session.
- [x] Recheck verification access (2026-10-30): 59 launch/batch/preflight/install regressions and both authority lints pass; preview reports build OK. Fresh browser `/home` redirects to sign-in. No canonical deployment credentials or GitHub workflow-dispatch credentials are available in this sandbox; no paid AI request or alternate-backend deployment was attempted.

### Production checklist: 0 / 8 verified live
1. Small Gemini request through deployed backend — blocked by authoritative session/deployment; fixture passes.
2. Gemini top-up recognized without cooldown lockout — same blocker; edge recovery fixture passes.
3. One-page AI authoring completes without timeout — same blocker; bounded invocation fixture passes.
4. Multiple batches preserve earlier sections — same blocker; source preservation fixture passes.
5. Failed batch resumes without regenerating completed sections — same blocker; exact-request tab-memory recovery fixture passes, not durable refresh recovery.
6. Deterministic Home passes section-model validation — independent local canonical launch fixture passes; production not verified.
7. Five-page ecommerce reaches Live Workspace — same blocker; complete five-page scaffold → candidate closure → section-model fixture now passes without AI calls or commit.
8. Saved revision survives reload and preview — blocked by authoritative session; latest sandbox status is signed_out, and a fresh browser /home redirects to /auth?next=%2Fhome. Managed session minting targets the attached noncanonical backend and cannot supply a UNISON session.
Fallback production configuration remains unverified; no relay, credential change, alternate-backend deployment or paid live generation was attempted.

## Active: Gemini install preflight
- [x] Add an authenticated, bounded direct-Gemini check before any release claim, project creation or page authoring; report credit, connectivity and permission failures without starting installation.
- [x] Run preflight and installation regressions: 21 client checks and all 125 edge checks pass (ambient provider keys removed for fixture isolation); preview build OK.
- [ ] Verify live preflight and install after canonical backend deployment; requires the UNISON deploy workflow and an authoritative session.

## Active: Uploaded Gemini timeout follow-up
- [x] Replace the full-page timeout replay with bounded, sequential page-section requests before final candidate validation; preserve sealed order, repeated sections, owner settings and source quantities.
- [x] Verify section accumulation, provider-stop behavior, and existing authoring regressions: 36 original checks pass; the follow-up above also resolves the broader App Builder scaffold failures and verifies all 27 facade tests.
- [ ] Verify live generation → save → reopen; requires an authoritative UNISON session and a successful real provider response.

## Active: Marketplace install failure follow-up
- [x] Align marketplace installation with App Builder owner AI preferences through the shared facade, including page authoring and closure repair; 23 client regressions pass and Gemini provider/backup tests pass. No server credential or provider-policy changes; live installation still awaits canonical deployment and authoritative sign-in below.
- [x] Enforce the owner's Gemini key for App Builder and marketplace authoring, with no OpenAI/Anthropic attempts or stale-model bypass; preserve managed Gemini backup. All 120 edge tests pass, including direct timeout → managed Gemini and owner-key-alias routing.
- [x] Trace prior routing: it permitted OpenAI after Gemini; the owner's follow-up now replaces that App Builder policy with direct Gemini and managed Gemini only.
- [x] Separate terminal authoring failures from unfinished-page validation errors and deduplicate install diagnostics; targeted materialization/install/error tests pass.
- [x] Diagnose latest install failure: owner's Gemini key returned 402 "prepayment credits depleted" (Google AI Studio); built-in backup secret absent on UNISON. Credits replies now stop authoring at the first page, return 402 from the backend, and name the AI Studio remedy.
- [ ] Owner adds Google AI Studio credits (and optionally the built-in AI backup key on UNISON), then runs the deploy workflow.
- [ ] Verify live installation after canonical deployment and authoritative sign-in are available.

## Active: Floating toolbar actions
- [x] Repair command routing: move now reaches the source executor matching the shared owner resolver; hide/duplicate/delete retain their existing canonical host handlers.
- [x] Run command-routing and source-mutation regressions: 29 checks pass, including both move directions, hide, duplicate/delete and read-only refusal; move-down source-splicing regression already passed and required no production change.
- [ ] Verify saved-site toolbar actions and reopen in the browser: available session redirects the designated Terra House project to sign-in.
- [x] Explain marketplace AI error: screenshot shows Gemini timeout, failed OpenAI credit fallback, absent managed fallback and section-contract errors; follow-up confirms current source allows configured OpenAI behind Gemini. Deployed version remains unverified and this project's gateway logs contain no matching requests.

## Active: WYSIWYG selection recognition
- [x] Repair preview section/node identity and direct edit source targeting for saved sites; exact source locators own toolbar edits, structural actions include imported files, inspector derives missing family from registered variants/slots and reads live composition.
- [x] Run selection/toolbar source regressions (40 checks passed using Node environment; default browser environment lacks native canvas).
- [ ] Verify Terra House click → edit → save → reopen; restored available session redirects to sign-in rather than opening the authoritative project.

## Active: OS8 canonical creative freedom
- [x] P1: loaded revisions report whether their design index is database-stamped for that exact version (durable) or provisional, and never claim full coverage when source is uncertain.
- [x] P1: opening a committed revision with an unproven design index rebuilds it from saved files, kept provisional (unstamped) until a new stamped save.
- [x] P1: confirm the stamping migration is applied on UNISON (remote ledger: `20261026001823`, verified 2026-10-29).
- [x] P0: refused saves record attempted operation, expected owner and reason per path (protected-file fixture asserts them).
- [x] P0 fixtures: free-form hero and multi-file component accepted; broken import and broken required binding refused with their codes.
- [x] P2: resolver maps a preview click's source locator to its JSX node, owner file, repeated/shared/dynamic flags, and falls back to inspect-only when a rewrite is unsafe.
- [x] P2: Affinity panel resolves selected elements through the resolver; refuses protected or stale targets with a clear message.
- [x] P3: edit-intent contract (scope, operation, allowed files, required buttons, expected version, packages, consent) enforced before Builder AI saves when supplied.
- [x] P3: Builder saves build the contract from each Affinity request; naming other pages/shared chrome, adding pages, or naming business data in the prompt counts as consent.
- [x] P4: project media manifest saved with Affinity edits.
- [x] P5: publish refuses when an older version would ship.

## Active: Marketplace preview draft installation
- [x] Correct missing required p_target_status in content create/update RPC requests; four handler execution regressions cover audited/idempotent signatures, 20 focused checks pass.
- [ ] Verify corrected content setup on a signed-in Lowtide House install: requires canonical GitHub deployment of cms-records and an authoritative UNISON session; supplied managed session belongs to the other backend.
- [x] Correct Lowtide House preview-dependency acceptance: caller page checks trigger closure repair and remain enforced afterward; preserve terminal OpenAI credit failures rather than accepting untouched previews.
- [x] App Builder page writing/repair/Builder edits switched to Gemini-only (no OpenAI attempts).
- [ ] Retry Lowtide House install → saved draft → reopen: needs the backend deploy workflow run and a signed-in UNISON session.
- [x] Materialize standalone pages through App Builder (including preview-dependency repair checks) and seed buyer-owned editable data and capability bindings through canonical launch services; 68 focused checks pass.
- [x] Route concept and published installation material through App Builder before canonical acceptance; generated routers use syntax-safe aliases and retain colliding page basenames.
- [x] Give published listings the same full-window preview shell and cascading description as concept previews; Zen Site renders full-width in browser.
- [x] Expose draft installation in every template preview using canonical, buyer-owned draft acceptance; all 12 concept source packages pass local validation.
- [x] Verify preview controls, signed-out handling, source packages and canonical save tests.
- [ ] Verify authenticated install → saved draft → reopen: requires authoritative UNISON session and GitHub deployment of marketplace-install-template. Paid releases still need an existing entitlement; checkout is not implemented.

## Active: Marketplace image placeholders
- [x] Persist real sample images for image-bearing sections and repeated content across all concept pages without changing vendor layouts or redistribution rights.
- [x] Run image assignment regressions and verify Terra House imagery survives page navigation and reload.

## Active: Marketplace concept action repair
- [x] Replace the shared informational cart action overlay with functional, template-scoped persistent cart actions and quantity badges; registered catalog products use the same cart. Business actions remain labelled samples, without creator-service authorization.
- [x] Run marketplace action regressions and verify add → bag → reload in the public marketplace preview, including a catalog product.

## Active: Marketplace cart and capability persistence
- [x] Enable canonical add-to-cart with site-scoped browser persistence, quantity badges, restored saved capabilities and runtime-connected bag icons.
- [x] Preserve declared capability requirements and portable slot bindings in staged manifests and buyer packages without copying creator approvals or record payloads.
- [ ] Buyer-owned marketplace installation/provisioning acceptance: install control and authorized package endpoint are implemented; live acceptance awaits GitHub deployment and authoritative UNISON session. Requirements transfer is not working-installation proof.
- [x] Run focused cart, published adapter, capability hydration and release requirements regressions.
- [ ] Real installed-template add → bag → reload and booking/payment persistence: requires the buyer installation path, canonical GitHub deployment of changed release functions, and authoritative UNISON session.

## Marketplace card covers
- [x] Use the shared Concept Preview static cover surface for published cards; remove embedded Sandpack runtimes and verify safe image selection.

## Active: Marketplace trusted promotion (R6)
- [x] Staging extracts every photo/font reference into the release manifest with content fingerprints; unreachable assets stay reference-only
- [x] Certification service (marketplace-certify-release): per-asset include/exclude rights with license evidence, immutable six-verdict reviews, private ZIP package with excluded assets rewritten to placeholders
- [x] Client calls + tests: 12 Deno service tests, 35 marketplace vitest suites pass; tsgo and build clean
- [ ] Deploy marketplace-certify-release via the UNISON deploy workflow, then run the review on release f200a98e-75dd-42eb-8107-9b2c6cad2d87 from a staff account

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
- [x] Verify Babel initialization without `process` in isolated browser bundles, 22 editor regressions, authority lint, live Builder startup, and signed-in Lowtide House draft hydration; fresh generation and durable save/reopen acceptance remain open below

## Active: Canonical page-target binding closure
- [x] Match existing AI-authored React Router controls by canonical `data-ut-target-page-id` or registered route before label heuristics; stamp the binding ID and CTA marker in place without duplicating the authored link.
- [x] App Builder integration regression reaches `ready-for-commit` with a canonical `targetPageId` link and no unresolved-binding diagnostic; the existing target path is retained as a hash route.
- [x] Local Playwright on signed-in Lowtide House: home → `/the-house`, footer → `/rooms`, and back home all rendered; the four Shore footer links resolve to registered `/the-house` metadata. Candidate was not applied and no save/deploy was performed.
- [x] Preserve closure-repair provider failures in the App Builder result instead of masking them as section-validation failures; regression asserts `provider-error` and keeps closure blockers as secondary diagnostics.
- [ ] Live AI generation attempt on a separate named test project: planning and contract completed, but page authoring hit Gemini timeout/HTTP 500 with no configured fallback. Closure also rejected Home's unmaterialized section roots (missing literal identity/type/variant and serialized section model); the newly preserved provider failure is now the primary diagnostic. No candidate was accepted, no project was created, and no deterministic fallback was used.
- [ ] Retry AI generation after a usable provider/fallback is configured; then verify candidate closure, canonical commit, preview, route interaction, and reopen. Supabase MCP log/advisor access was unauthorized in this session.
- [ ] Clear local browser diagnostics: Home's `cleanup_empty_projects` RPC returns 404, Sandpack telemetry request to `col.csbops.io` timed out, and Motion reports non-animatable transparent background transitions. These did not block the tested preview routes.

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
- [x] R6-P1 verify existing certification guards locally: 33 marketplace tests + 4 staging tests pass; buyer reads isolated, private evidence inaccessible, revoked/mismatched/failed approvals rejected; not live RLS proof
- [ ] R6-P1 apply trusted-promotion SQL to UNISON (blocked: requires canonical GitHub workflow deployment)
- [ ] R6-P1 certify designated project 59c5ef14-4fd0-4c57-bedf-6a6659d6cfaf (blocked: authoritative admin session, deployment, source/private-data review, licensed assets, real package build/reimport and preview parity)
- [ ] R6-P2..P5 certified preview, free-claim install, brand contract, Stripe
