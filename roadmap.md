# Roadmap

## Active: Cross-file resource integration closure
- [x] Unify generated-slug identity resolution for editor reads and preview adoption; reject ambiguous matches without creating duplicates. UUID identities remain unchanged; CMS titles and pricing adoption covered.
- [x] Load job-local CMS schemas into App Builder generation without UI/global registry dependence; failed scoped reads stop authoring rather than reuse global state.
- [x] Preserve owner product/service/testimonial/team media and team social links; normalize pricing intervals during launch seeding using scoped media inventory.
- [x] Create Records entries from their registered schemas and support empty planned CMS collections through explicit New record; no implicit backend provisioning.
- [x] Verify focused integrations: 113 tests pass across 10 suites; final generation rerun 14/14; preview build OK and public entry renders without page errors.
- [x] Frontend publication requested on 2026-10-19 at https://unisonai.lovable.app; deployment completion is not confirmed.
- [ ] Authoritative backend deployment and authenticated public read-back; blocked by unavailable UNISON workflow access/session. Never deploy into the unrelated managed database.
- [ ] Continue atomic content/profile write safety and shared/dedicated schema/publication parity; implement and test safe contract changes without modifying the unrelated managed database. Authoritative migration validation and provisioned site-database acceptance remain required.
- [x] Conditional site-profile override updates preserve unrelated fields and reject concurrent update/insert races; observed site-field expectations reach the write service. No schema or record changes applied.
- [x] Dedicated publication checks accepted component reads and literal saved resource marks through an authenticated read-only gateway schema probe before hosting; incompatible/unconfirmed resources refuse publication. Shared backend routing unchanged.
- [x] Verify concurrency/publication/resource integrations: 110 tests pass across eight suites; canonical VFS write lint passes. Live signed-in acceptance and deployment remain blocked below.
- [ ] Extend shared content/account-profile commands with locked-row expected-value validation and verify full schema/publication parity; blocked by authoritative migration/deployment access and provisioned-site acceptance. Mixed account/site writes are not a single transaction.

## Affinity same-site page generation
- [x] Wire requested pages to generate-page, reusing the authenticated Composer handler, accepted homepage source/design, and a combined page/navigation candidate through the existing canonical commit.
- [x] Run page-generation, candidate-save, route-output, and authentication regressions: 99 tests pass; browser/server Composer contracts match; preview build OK.
- [ ] Deploy generate-page and the updated AI handler/contracts through the UNISON GitHub workflow; verify live generation → preview → reopen. Blocked by unavailable authoritative deployment access and signed-in session.

## Database performance and running credits
- [x] Measure October 6–19 scoped usage: 242.33 requested running credits, of which XL compute is 207 for 167.1 instance-hours; built-in Cloud diagnostics do not measure authoritative UNISON. Query/index/cron audit documented in docs/DATABASE_COST_REVIEW_2026-10-19.md.
- [x] Serialize Home refresh bursts with a trailing read; accepted-draft lookup reads one canonical row and legacy identity lookup excludes embedded snapshots. 19 focused regressions pass; preview build OK. No record, schema, schedule or instance changes.
- [ ] Authoritative UNISON query plans and signed-in Home → project read-back; blocked by unavailable authoritative database diagnostics/session.
- [ ] Reduce XL billed hours/size or background cron/storage growth; blocked by active-consumer/peak-load evidence and explicit pause/resize/retention approval. Investigate rising Cloud rollbacks first; no savings established.

## Account-persistent Live Demo
- [x] Replace browser-only usage with account-owned reservation and canonical revision settlement; migration prepared for authoritative UNISON workflow, not applied to the unrelated built-in backend.
- [x] Test one free generation, failed/discarded retry, duplicate reservations, expired/late commits, account isolation, permissions, rollback and persistent UI read-back; 40 tests pass across account Demo, Wizard, Home handoff and canonical launch suites. Preview build OK; signed-out Demo gates to Auth without page errors.
- [ ] Deploy account demo migration through the existing UNISON GitHub workflow and verify live signed-in generation → saved draft → returning exhausted state; blocked: authoritative RPC is still missing (read-only HTTP 404/PGRST202), no deployment credentials or authoritative test session available.

## Affinity naming
- [x] Show Affinity in the visible Builder header and Wizard title; add a token-based glow around Home’s AI chat box. 13 Home/Wizard regressions pass; build OK. Signed-in visual verification remains unavailable (Home redirects to sign-in).
- [x] Rename the active Wizard, Home chat, Builder chat, selected-element chat, commands, accessibility labels and related help text to Affinity; preserve technical identifiers and behavior. 21 Wizard/auth/workspace regression tests pass; sign-in demo shows Affinity without page errors. Authenticated Builder viewing remains blocked by the unavailable authoritative UNISON session.
- [x] Bring the Affinity name into the Unison Home hero (badge, gradient headline, subtitle) with the same treatment as the Live Demo; Home-only overrides, shared hero component and demo copy untouched.


## Active: Builder prompted-edit completion
- [x] Fix futuristic color edits rejecting valid surface shadows (including layered and token-colored shadows); 24 regressions pass, including canonical edit → save → reload with unchanged page source. Real signed-in verification remains blocked by the unavailable UNISON session.
- [x] Audit remaining VFSCommitService save blockers: replace blanket stale-structured refusals with captured dependency checks for typed page/theme/motion edits; retain conflicts, protected paths and reviewed-artifact safety. Identity/shape checks also run before no-op coalescing. 93 save/recovery/hydration regressions pass; preview build OK. Live signed-in acceptance remains blocked below.
- [x] Fix canonical save queue rejecting file-only AI candidates after a newer non-overlapping save; 61 regressions pass, build OK; preserve unrelated source and candidate lineage, reject overlaps/structured side effects/mismatched candidate bases. Live signed-in project check remains blocked below.
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
- [x] Converge password/email/OAuth authentication to Home or Demo only; return-path/checkout overrides removed, callback audit no longer blocks entry. 20 regression tests pass; build OK. Real-account verification remains below.
- [x] Stop reused route gates and pending launcher handoffs from looping sign-in; 22 auth regressions pass, sign-in stays open with a pending handoff, zero browser errors, build OK. Real-account verification remains below.
- [x] Home redirects no longer wait for guest claims, onboarding reads time out safely, and stale project/dashboard return links no longer reopen automatically; first-time users still enter Live Demo. 24 auth regressions pass; signed-out browser stable and build OK. Real-account verification remains blocked by unavailable UNISON session.
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
- [ ] M2 (PR2/3): Preview as sole primary edit UI — [x] inspector routes data-bound text/media to resource commands (replace "Edit it from the content panel" dead-end), [x] fill missing lane executors (binding), [x] upload picker from preview context (site storage, no inline data); [x] pending/saved/error + undo states; [ ] six-fixture reload exit check (needs signed-in browser run)
- [ ] M3 (PR4): unified Resources UX (Records/Collections), one canonical record type per use case (testimonials/projects/FAQ collisions); [x] catalogOperations → agentOperations → Resource Runtime
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
- [x] project-backend edge change live on UNISON (verified 2026-10-18: service boots and answers its auth check); live signed-in slice check still open
- [x] WYSIWYG never gated on manual save: unmatched slug marks auto-create the record in one write (seeded name from the mark), "Save the site first" dead-end removed; 30 resource tests pass
- [x] Finish click/AI conflict wiring: inline original text, loaded inspector fields, guarded undo, failed reads never auto-create duplicate records; record fields auto-apply on blur/toggle
- [x] Cross-industry service integration: second product image, menu price/category, service duration, concurrent edits, unbound edits, safe undo and failed-write invalidation; persistent adapter fixtures, not live database proof
- [ ] Full ten-case M7 browser acceptance (booking availability, case-study publish, mounted save concurrency included): needs authoritative signed-in session and approved test projects
- [ ] M3 data collisions: scoped live audit and approved migration needed before choosing/merging testimonial/project/FAQ record owners; no existing records moved or deleted
- [ ] M4 safe removal of mounted Playground editing: replacement equivalence requires the signed-in acceptance above; useful operations stay mounted

## Runtime Integrity & Preview Editing Validation (2026-10-18)
- [x] First-edit creation limited to generated seed slugs on collections
- [x] Explicit project resume gives persisted revision identity, snapshot, and VFS precedence over stale route metadata; canonical recovery regression passes; authenticated refresh/reopen remains blocked below.
- [x] Records lists every registered collection family
- [x] Site-database gateway checks table structure (SCHEMA_INCOMPATIBLE) — needs GitHub deploy
- [ ] Real CRUD against a provisioned site database — blocked: no provisioned site database
- [x] Catalog/Content pages deep-link to filtered Records
- [x] Retire Playground record editing (unused Products/Services editors removed; Assets uses Records editor)
- [ ] Merge/remove `-UnrealDev` duplicates — needs owner decision per file
- [ ] Signed-in edit → refresh → reopen → publish journey — blocked: UNISON session
- [ ] Guest demo project hand-off to new account + Home resume
- [x] Guest demo continuity: `claim_guest_demo` RPC (migration 20261018170000) transfers the guest's demo project + draft to the new account server-side and marks the session claimed (credits stop). Client stashes the anonymous user id, claims after signup/sign-in (best-effort, never blocks auth), and Home lists recent projects with Resume. Tests: guestDemoClaim.test.ts (5). Deploys via the GitHub UNISON workflow.
- [x] Auth loop fix + Live Demo: Auth no longer redirects anonymous guest sessions (the /auth ↔ /dashboard loop source); post-auth destination is /demo for new/first-time users and /home for returning users (was /dashboard). New /demo page (LiveDemo.tsx) requires an account — signed-out visitors are sent to /auth?next=/demo first. Verified in preview: /auth stays stable, /demo gates to sign-in, no page errors.

## Affinity conversational intelligence (2026-10-19)
- [x] Expand registry-derived generation resource context, industry seed addresses and eligible cart surfaces; seven editable catalogs exposed to agent operations, explicit cross-industry menu/pricing/products seeds, typed longform collections and profile identity/metadata preservation. 114 regressions pass; build OK. No schema or existing record mutations. Signed-in generation → persisted records → preview → reopen remains unverified: available session targets the non-authoritative backend.
- [x] Show public Affinity explanations automatically as paragraphs; retire collapsible reasoning/step UI and stop discarding Composer summaries. 30 reply/status/canonical-authoring regressions pass, including non-English prose and private-thinking separation. Signed-in generation remains blocked by the unavailable authoritative UNISON session.
- Done: AFFINITY_REASONING prompt contract (Understanding → Plan → Result → Next step), language/length-agnostic interpreter rule, out-of-scope honesty contract, normalizer outOfScope metadata, chat panel out-of-scope note rendering. 62 edge tests pass, tsgo clean, build OK.
- Remaining: deploy ai-code-assistant + builder-request-interpreter via .github/workflows/supabase-auto-update.yml; signed-in live verification.
