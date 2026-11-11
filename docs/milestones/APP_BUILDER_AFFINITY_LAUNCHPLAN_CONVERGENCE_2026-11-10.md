# App Builder + Affinity Launch Plan Convergence

**Status:** proposed active milestone, sequenced for implementation. **Date:** 2026-11-10.

## Goal

Make every explicit user choice made in the home discovery chat or guided Wizard selection flow part of one authoritative, persisted launch plan carried by `UniversalCreation`, preserve it through canonical planning and App Builder generation, and verify that the generated site actually contains the requested pages, visitor actions, design language, UI Foundation, motion and experience.

Use the existing inline discovery selections under the home chat as the conversational control surface. When setup details are missing, the assistant asks focused follow-up questions and presents Wizard-style selections in the same conversation. Answers update the structured plan and are sent back as user turns; the AI may recommend, but cannot silently override, an explicit selection. The owner reviews and confirms the final plan before launch.

This is convergence work, not a second generator. `UniversalCreation` is the durable user-intent record, not an ephemeral prompt payload. Persist its draft and finalized answers through the existing canonical project/launch persistence owner and retain the finalized plan with accepted launch/revision metadata for continuity and audit. `UnisonAppBuilder` remains the sole fresh-launch source author; the canonical launch pipeline remains the authority for topology, capabilities, intents, Theme, Art Direction, UI Foundation, protected runtime and acceptance. The accepted revision and SiteBundleSnapshot remain the rendering authority; reopening must never regenerate source from `UniversalCreation`.

## Current Baseline

- `chatLaunchPlan.ts` already parses a confirmed chat brief, prefills Wizard choices and gives final Wizard selections precedence in the synchronized vision brief.
- `HeroSection` already hosts `AIAssistantCore`; its `discoverySelections` slot renders `LauncherWizard` in chat presentation for an assistant question. Reuse this path rather than building another chat or a second choice system.
- `canonicalLaunchPlan.ts` already resolves the Wizard selections, requested pages, design intervention, registry context, Generated UI Foundation, motion/experience capability metadata and protected infrastructure.
- `launchOrchestrator.ts` already constructs `WizardSelections` and invokes `buildAppBuildContract`; `appBuilderOrchestrator.ts` passes the composition plan to page authorship.
- Remaining convergence gaps to close include making `UniversalCreation` durable and complete, proving every selected field survives each boundary, guaranteeing every requested page reaches the authored site/runtime, ensuring UI Foundation and registry choices affect the generated page prompt and candidate, and making design/content quality failures block acceptance when they contradict the plan.
- Existing composition profiles are uneven across industries and roles. Explicit user page purposes must not fall through to a generic role simply because a profile or alias is missing.

## Invariants

1. `UniversalCreation` is a versioned, inspectable and persisted Launch Plan from the first captured answer through chat/Wizard edits, `CanonicalLaunchPlan`, `AppBuildContract`, candidate and accepted launch/revision metadata.
2. The finalized plan includes site purpose, industry, business/brand name, visitor actions/goals, ordered requested pages, capabilities, visual requirements, and selected/requested UI Foundation, motion and experience choices. Preserve original prompt detail and distinguish explicit, inferred, defaulted and unresolved values.
3. Explicit user choices outrank AI inference, industry defaults and prompt wording. Defaults may fill only unanswered fields and must be identifiable as defaults.
4. Canonical contract fields are projections of the persisted plan and are checked for drift; do not create separately editable duplicate selections. After acceptance, the revision and SiteBundleSnapshot are authoritative for rendering and reopening.
5. Every requested page is either present in the generated site with its requested route and purpose, or generation stops with an explicit, actionable error. Page caps, timeouts and repair budgets never silently remove requested pages.
6. Selected UI primitives, motion, experience and capabilities are drawn from canonical inventories, checked for compatibility, carried into the sealed contract and actually used where the selected design requires them.
7. Page composition is jointly coherent and page-specific: shared site identity stays sealed while each page retains its requested role, intent, content, section plan and legal variation.
8. Visitor action affinity (CTA intent and destination) and visual/composition affinity are related but separately validated contracts.
9. Candidate quality is judged on meaningful content and behavior, not merely parse success, section counts or imported-component presence.
10. Fresh-launch authorship and promotion remain one App Builder candidate and the existing canonical commit boundary. Saved-project hydration remains read-only.

## Sequenced Milestones

### M0 — Freeze the Contract and Build Golden Launch Fixtures

**Deliverables**
- Inventory the existing Wizard fields, `ChatLaunchPlan`, `UniversalCreationInput`, `WizardSelections`, `CanonicalLaunchPlan`, AppBuildContract, registry context, page-composition inputs and actual persistence owner. Record each field's source, authority, durability, destination and whether it is explicit, inferred, defaulted or unresolved.
- Define a normalized launch fixture covering site purpose, industry, business/brand name, goal, visitor actions/capabilities, requested pages with route/title/purpose/role, visual direction, experience, UI primitives, motion and owner-provided business facts.
- Add boundary-level tests that serialize and persist a fixture at every handoff and identify the first boundary that drops or changes a selection. Include refresh, retry and accepted-project reopen.

**Gate**
- A single golden fixture demonstrates where every user choice enters and where it must arrive. No implementation proceeds on undocumented duplicate sources of truth.

### M1 — Formalize the Versioned Launch Plan

**Deliverables**
- Promote `UniversalCreationInput` from its current ephemeral intent projection into the existing shared, versioned and durably persisted Launch Plan contract; do not introduce a competing plan object. Keep chat extraction, Wizard editing, canonical resolution and App Builder transport as projections of that same intent.
- Persist incremental draft answers and every confirmed selection through the existing canonical launch/project persistence owner before generation; chat history or local storage may cache the plan but cannot be its only durable home. Do not add a new table/store without an audited persistence decision.
- Persist the finalized `UniversalCreation` payload or stable plan reference with accepted launch/revision metadata. Keep accepted source and SiteBundleSnapshot authoritative so restore never replays generation.
- Add backward-compatible parsing/migration for existing `UniversalCreation` payloads and saved drafts; never reinterpret an old accepted project as a request to regenerate.
- Represent page requests as stable structured records: requested route, title, purpose, suggested/canonical role, source of request, and explicit/default status. Preserve custom routes and repeated/renamed page requests deterministically.
- Represent selected brand/business identity, purpose/subject, goals, actions, capabilities, design direction, experience, UI Foundation and motion requirements with clear distinction between owner choice and AI recommendation.
- Preserve the source prompt, answer status, and stable canonical IDs for selected registry options so the exact confirmed plan can be reproduced and diagnosed after reload.
- Make user-authored constraints, original prompt details, and owner-supplied catalog/profile facts durable prompt context without treating AI-inferred facts as owner data.
- Define conflict rules: newest explicit user choice wins; AI may ask, explain compatibility constraints, or propose an alternative, but cannot silently mutate a confirmed value.

**Gate**
- Contract and persistence tests prove stable round-trip, incremental save, reload/resume, backward compatibility, and authority for every field across direct prompt, guided chat and Wizard entry paths.

### M2 — Complete Inline Affinity Follow-Up Selections

**Deliverables**
- Reuse `AIAssistantCore.discoverySelections` and `LauncherWizard`'s chat presentation. Render selectable answers immediately beneath the setup question in the same home chat thread.
- Use single-select controls for categorical choices and multi-select controls for pages/actions. Keep free-text response available for custom pages, brand names, and choices not covered by the options.
- Send a button selection back into the same AI conversation as a user answer and update the structured Launch Plan from its typed value, not by reparsing display copy.
- Ask only for unresolved, consequential fields. Suggested sequence: purpose/industry, visitor actions, pages, brand name, then visual direction/experience; skip fields already explicit in the prompt.
- Show a compact editable plan recap before launch. Users can change any answer without restarting discovery; persist conversation context and `UniversalCreation` answers on reload using the existing canonical persistence owner. Local conversation cache alone is insufficient.
- Preserve the existing guided Wizard continuation as an accessible fallback, and keep chat answers synchronized when a Wizard field changes.

**Gate**
- UI tests cover question display, option selection, multi-select, free text, pending/disabled behavior, same-thread submission, persisted `UniversalCreation` answers after refresh/resume, Wizard/chat parity and final recap confirmation.

### M3 — Carry Every Confirmed Page Into Generation and Runtime

**Deliverables**
- Project the confirmed page records into topology, canonical launch planning, `AppBuildContract`, authoring targets, route generation and runtime route manifests without re-deriving or filtering them from prompt text.
- Verify exact route, page identity, role and purpose alignment from Launch Plan through `sitePlan`, `pageRegistry`, authored source targets, router and accepted snapshot.
- Remove or constrain silent page truncation such as `maxPages`: if requested pages exceed a configured budget, ask the owner to reduce scope or fail the launch with the unfulfilled pages listed.
- Preserve custom pages and explicit aliases. Unknown roles retain their requested purpose and receive a custom purpose-fit composition; they must not inherit generic “about” content by accident.
- Include each page's own request and user constraints in its authoring brief, while keeping site-wide visual invariants shared.

**Gate**
- An end-to-end contract test asserts one generated route and authored page target for every requested page, including custom paths; omission makes the candidate ineligible for promotion.

### M4 — Close UI Foundation, Motion, Experience and Registry Parity

**Deliverables**
- Carry the final UI Foundation manifest and approved capability set from canonical resolution through App Builder context, per-page prompts, import validation, preflight and accepted runtime metadata.
- Include selected and eligible primitives, motion recipes, interaction patterns, visual implementations and experience capabilities in bounded per-page context. Rank/select through canonical registries and page/industry eligibility; never expose or import arbitrary unapproved modules.
- Validate that requested experience requirements (including motion or immersive capabilities) are both approved and materially present in the authored candidate, or reported as an explicit incompatibility before launch.
- Audit registry coverage for the supported industries and page roles. Add missing industry vocabulary, page profiles, aliases and legal implementations as data in the owning registries; avoid a second composition engine.
- Treat a missing eligible design source as a visible coverage gap. Do not silently downgrade a page to generic boilerplate when a compatible richer implementation exists.

**Gate**
- Registry and contract tests prove selected primitives/motion/experience survive into generated imports and runtime metadata, ineligible sources are refused, and supported page roles resolve to intentional profiles.

### M5 — Make Prompt-Driven Composition Affinity Page-Aware

**Deliverables**
- Resolve one sealed, deterministic site composition plan after final selections and before App Builder authorship. It covers every requested page and carries industry, page purpose/role, goal/action, selected art direction, density, section-family order, design-source eligibility and cross-page differentiation constraints.
- Use the existing universal composition planner and `compositionAffinity` machinery as the ranking/selection authority for legal implementations. Keep eligibility hard-gated by certification, pack membership, role, dependencies and capabilities; affinity ranks only legal candidates.
- Render the page's actual plan into the prompt with concrete per-page requirements and high-value industry vocabulary. State which families/variants are available, what the page must accomplish, what neighboring pages already cover, and what must not be repeated.
- Keep CTA/action affinity separate: every primary action must map to a requested canonical intent and a valid requested destination/capability. Validate destinations against the final page set.
- Require differentiated content and layout by page purpose, not arbitrary novelty. Preserve shared brand, tokens, typography, art direction and chrome; allow page-local variation only within those constraints.

**Gate**
- Determinism tests prove same selections and registry version yield the same plan. Cross-page tests prove distinct page jobs and valid CTA destinations without weakening explicit user requests.

### M6 — Enforce Content-Rich Candidate Closure

**Deliverables**
- Upgrade page structure validation from syntactic section counting to substantive checks: non-empty authored content, required page-specific content families, useful copy/items/media where relevant, actual shared chrome, and the planned primary action.
- Reject placeholder copy, empty arrays/sections, generic repeated section bodies, missing owner-required content and empty CTA cards. Use advisory diagnostics for style preference, but make missing requested content or behavior a blocker.
- Make design-source usage, generic fallback usage, page repetition and missing planned families visible in the candidate report. Promote to blockers where the confirmed plan requires the source/behavior or where the result contradicts explicit choices.
- Ensure bounded repair sees diagnostics naming the affected page and missing requirement; if repair cannot satisfy the plan, keep the candidate rejected and explain what was not fulfilled.

**Gate**
- Negative tests reject empty-shell pages, generic CTA cards, repeated unrelated bodies, missing routes/actions and unauthorized capability claims. Positive fixtures preserve legitimate custom-authored pages and valid local components.

### M7 — Cross-Path Acceptance and Rollout

**Deliverables**
- Run a golden matrix through direct home chat, inline follow-up choices, guided Wizard and open-ended custom creation. Compare persisted `UniversalCreation` before and after reload, the structured plan, page topology, UI Foundation, composition plan, candidate diagnostics and accepted preview/runtime.
- Cover at least a service business, restaurant/hospitality and a non-template/custom case; include explicit pages, custom routes, omitted optional capabilities, selected motion/experience and changed answers.
- Verify chat history and `UniversalCreation` survive reload and project reopen; verify accepted revision metadata retains the finalized plan, preview uses the accepted candidate, and no downstream stage replays old defaults over owner selections.
- Add launch telemetry/reporting for requested-versus-authored page IDs, selected-versus-used UI Foundation, affinity fallbacks, and unfulfilled requirements, without logging sensitive prompt or business data unnecessarily.
- Roll out behind existing launch controls if needed. Keep the guided Wizard available until parity acceptance is met; remove no compatibility path before equivalent behavior is proven.

**Gate**
- All golden cases pass from confirmation through generated runtime, and no explicitly requested page, visitor action or selected design requirement disappears silently. Signed-in save/reopen and hosted deployment are recorded separately from local test evidence.

## Definition of Done

- One authoritative, versioned `UniversalCreation` Launch Plan is durably persisted, inspectable and round-tripped across chat, Wizard, canonical launch, App Builder, candidate, accepted revision and preview/runtime.
- Draft and confirmed answers survive refresh, retry and project reopen; accepted source remains authoritative and does not regenerate.
- Inline follow-up choices formalize setup in the existing home chat and are behaviorally equivalent to the corresponding Wizard selections.
- Every explicit user-requested page appears at the requested route with its intended purpose, or launch fails visibly before acceptance.
- UI Foundation, legal registry sources, motion, experience, action wiring and composition affinity are all represented in the final plan and verified against the candidate.
- Empty, generic, repetitive or behaviorally incomplete pages cannot pass merely because they compile or contain section tags.
- No competing author, planner, router, design registry or canonical writer is introduced.

## Current Ownership References

- [Architecture and launch ownership](../ARCHITECTURE.md)
- [Chat and Wizard launch plan](../../src/services/launch/chatLaunchPlan.ts)
- [Canonical launch-plan resolution](../../src/services/launch/canonicalLaunchPlan.ts)
- [Home chat and inline Wizard selections](../../src/components/home/sections/HeroSection.tsx)
- [App Builder contract](../../src/services/app-builder/appBuilderContracts.ts)
- [App Builder generation context](../../src/services/app-builder/appBuilderGenerationContext.ts)
- [Universal page composition planner](../../src/services/composition/siteCompositionPlanner.ts)
- [Affinity selection policy](../UNISON_AFFINITY.md)
