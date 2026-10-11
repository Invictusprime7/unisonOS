# Roadmap — Agentic IDE milestone
- [x] Refresh README and first-party documentation against current Unison architecture; distinguish active guidance, historical evidence and unverified milestone work.
- [x] Phase 1 (slice): agent-runtime operations registry, intent-destination check before every AI save, live activity feed in AI chat
- [x] Phase 0: save step — applied the never-deployed changed-files-only save + timeout recovery (confirmed by user)
- [x] Phase 2: SystemGraph projection fed into AI context
- [ ] Phase 3: extend change sets (topology/data/migrations); edge function streams same events
- [x] Phase 4 (slice): Ctrl/Cmd+K command menu with site map + fonts
- [x] click-to-target from preview
- [x] Phase 4 rest: site map + session Changes list in command menu
- [x] Phase 5: automatic sync saves (binding, GHL, republish) refused when based on a version older than a saved AI change
- [x] Chat no longer says "not applied" after a real checkpoint save
- [ ] Verify click-to-target with a real AI edit (label confirmed; full edit needs the user)
- [x] Product/catalog edits (price, image) write the real database record (command menu)
- [x] Conversational backend setup: AI asks inline questions in chat (saved with the conversation), user answers inline, AI wires backend + authors UI
- [x] Catalog panel (products/services) on the canonical catalog writer; preview reads live data
- [x] agentOperations is the sole catalog read/write surface (registry-aware); retire catalogOperations row ops and migrate their callers
- [x] Move remaining catalog writers (crm-managers, TemplateRuntimeProvider, backendOpExecutor) onto agentOperations

## Milestone: canonical terminal, node mutations, browser verification (2026-10-07)
- [x] Phase 1: mutation coordinator (queue, autosave pause, safe rebase of stale AI edits, plain stale message)
- [x] Phase 2: terminal writes through the canonical writer; touch/mv/cp/rm/rename; staged mode; revision/routes/intents commands (graph → Phase 3)
- [x] Phase 3: node addressing + typed section actions shared by terminal and AI/command menu (propose_section_action)
- [ ] Phase 4B: provider-agnostic BrowserVerifier — local Playwright done (scripts/verify-browser-local.mjs); hosted adapter only when remote AI verification is enabled
- [x] Phase 5: tests + zero-bypass guard (no client Playwright, terminal never writes directly)
- [x] Revised plan P0.12: post-commit browser check after terminal saves (provider-swappable probe)
- [x] Revised P0.9: `page rename` (typed route op through the canonical writer)
- [x] Revised P0.9: swap a section variant from the terminal (`section variant`)
- [ ] Revised P0.1–P0.3/P0.11: hosted Playwright worker + candidate preview (needs your approval of an outside host)

## Milestone: Unified Resource Runtime (2026-10-08)
- [x] P0.1–4: resource types, registry above catalogSurfaceRegistry, catalog/content/profile adapters, runtime reads/writes
- [x] P0.10–11, 13: ResourceEntityRef on EditableEntity, ResourceDataOp, RESOURCE_INVALIDATED (event bus + preview postMessage)
- [x] Content storage (FAQs, articles) added to the database with content permissions
- [x] P0.9 provenance: AI-written pages and product cards tag records; click reports the record
- [x] P0.5–8: live record rows carry their record tag (useSectionData is the shared connection; no new hook file per project rule)
- [x] P0.13 live rehydration: record saves now reach preview sections bound to that table
- [x] P0.12: profile writes via business_apply_profile_command gateway
- [x] P0.18a: AI actions list_resources / read_resource / update_resource_field
- [x] P0.14: schema-driven record edit boxes in the floating toolbar
- [x] P0.17: undo for record edits
- [ ] P0.15–16: live verification on a real site (needs the user)

- [x] AI Builder live file activity ribbon above input (clickable files open in editor)
- [x] AI Builder detects and shows when preview updated after its edits

- [x] Live Assets: include case studies, portfolio projects, team, gallery; Playground shows only asset types relevant to the site's industry and composed sections
- [x] Playground: Build (Pages/Layers/Design) + Manage (Assets: Catalog/Content/Business/Media; Operations: Bookings/Orders/Leads); assets shown in their real on-site appearance
- [x] Assets: "Show on site" reveals the real rendered item
- [ ] Assets: inline live snippets and "Place on page"
- [x] Assets: seed testimonials at launch
- [ ] Assets: seed FAQ/team/gallery at launch (needs content types per business)
- [x] Assets: "Place on page" hands a grounded request to the AI Builder for items not yet on the site
- [x] Assets: live appearance snippet renders the record’s real preview markup+CSS in a sealed frame

## Articles & case studies (production-ready)
- [x] 1. Articles / Case studies content types; launch seeding; live scan + "Save to assets"
- [x] 2. Article detail page per saved item (/insights/:slug) reading saved content
- [x] 3. Bind "Read Essay"/"Read case study" buttons to the item's page
- [x] 4. "Write full article" in Assets: AI drafts body, saved as Draft

## Launch control plane (2026-10-09 milestone)
- [x] P0.1 launch task contract + PlaygroundService read facade
- [x] P0.3 launch dialog shows canonical tasks (no fake ticks)
- [x] P0.5 capability-aware setup plan
- [x] P0.2 control-plane publish blockers feed launch tasks
- [x] P0.4 Playground Launch shows same task list
- [ ] P0.6-P0.20 per milestone doc
- [x] Deterministic article/case-study pages + Read button wiring (Create page & link button / Create all pages)
- [ ] Run it on SPARK (needs user click: Assets → Content → Articles)

- [~] Direct WYSIWYG + project-isolated backend (guidebook 2026-10-09): Phases 0,1,2,4,5,6,9 done; Phase 7 shared-mode slice done (public resolve_published_site_backend + publishedRuntimeBackend read client); Phase 8 shared-mode slice done (deploy backend preflight + unison.runtime.json injected into deploys); Phase 3 (per-site databases) blocked on Supabase account choice; Phase 10 and dedicated-mode reads follow Phase 3
- [x] P0 CMS-to-published consistency: published sites live-read catalog + business profile via the public read gateway (flat body, hash path); booking reads already correct; 35/35 tests
- [x] P0 AI editing E2E tests: src/test/aiEditEndToEnd.test.ts — multi-file atomic edits, page creation + route ops, broken-import and empty-file gates, stale-candidate refuse/rebase (5/5)
- [ ] Motion/3D: App Builder launch can't generate it; in-builder AI can't apply motion edits
- [x] Registry expansion: eligibility resolver now orders/narrows Wizard per-section design lists
- [x] 3D/motion intake: three.js sources gated (not rejected) behind --capability=threeD; experiencePackIntake.ts assesses motion level, 3D capability, blockers, lifecycle
- [x] Quarantined 5 sources: Halide Topo Hero, Spatial Depth Hero, Tunnel Hero (three.js), Reveal, Scroll Reveal
- [ ] Adapt quarantined sources onto Unison experience primitives + reduced-motion, license review, then promote (needs owner license sign-off)
