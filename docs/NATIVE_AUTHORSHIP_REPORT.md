# Native AI Authorship Restoration — report (2026-11-09, Sprints 1–4)

## Phase A — where authorship is decided and lost

Call graph (prompt-first): `PromptLaunchPanel` → `buildPromptLaunchInput` (`deriveChatLaunchPlan` + `creativePlan`) → `runLaunchPipeline` → `planUniversalCreation` → `buildCanonicalLaunchPlan` (+ `buildWizardDesignIntervention`) → `UnisonAppBuilder` → `authorSitePages` → `runComposerRepairLoop` → `generate-page` → `ai-code-assistant/composerLane` → `prepareAICandidate` → page projection → closure → `commitMutation`.

History: original `/src/project-components/` authoring first appears 2026-09-27 (`76fd5f4c8`); the strongest successful baseline (`d2aa069f4`, Oct 4) authored pages but no original body modules; no commit proves original body TSX authored, imported, rendered and accepted end-to-end. The 2026-03-14 snapshot had explicit separate-module instructions.

Restrictive instructions found and retired:

| Where | Old text | Now |
| --- | --- | --- |
| `wizardDesignIntervention.ts` compositionDirective | "compose within them and never author replacement section source" | reuse/adapt where they fit, author original sections where they do not |
| `wizardDesignIntervention.ts` aiDirective | "Compose only with snapshot-owned UI primitives…" | leads with the single policy; tokens/art direction kept |
| `canonicalPipelinePrompt.ts` design layers | "use the highest layer that fits; never skip down to hand-rolled markup" | prompt chooses; author site-local TSX on L1 when nothing fits |
| `canonicalPipelinePrompt.ts` recipes | "Compose pages from the supplied recipes … before hand-rolling markup" | reuse where they fit; author when the prompt needs it |
| `canonicalPipelinePrompt.ts` brief | "Never invent section variants, components…" | never invent registry IDs/facts/paths; original site-local components allowed |
| `composerLane.ts` | "Follow the ART DIRECTION … in the brief" | realize the owner brief and every requirement ID first |
| Saved `/.unison/design-intervention.json` | old directive text | `retireLegacyRegistryOnlyDirective` on read (AI Builder panel, page composition) |

Provenance trace (`src/services/launch/authorshipTrace.ts`, off unless `localStorage['unison:authorship-trace']='1'` or `VITE_UNISON_AUTHORSHIP_TRACE=1`): records `launchPrompt`, `resolvedIntent`, `chosenDirection`, `authorSiteInvocation` (requirement-ID hashes actually in the brief), `rawCandidateFileManifest`, `normalizedCandidateFileManifest` (repair loop and page projection), `validationResult`, `acceptedVfsManifest`, `previewRouteManifest`. Hashes, paths, counts and import edges only. `firstLossBoundary(events)` names the first boundary: before the AI, AI output, normalization, commit or Preview. Read in the browser with `__unisonAuthorshipTraces()`.

`designReferences` (considered/selected certified designs with reasons) is recorded by `designSystemResolver.ts`.

## Phase B — creative plan

- `src/services/launch/creativePlan.ts`: deterministic tone/typography/color/imagery/composition/motion/interaction/reference dimensions; requirement IDs (`req:page:*`, `req:navigation:multi-page`, `req:motion:*`, `req:interaction:*`, `req:capability:*`, `req:reference:*`) with origin `explicit`/`confirmed`; negation aware.
- Design direction: earliest family the owner names → confirmed chat direction → labelled **provisional** base for unmapped styles (cinematic/noir → bold, etc.) or none. No silent first-preset Modern.
- Pages from an explicit page list in the confirmed direction are kept (origin `confirmed`); prose mentions never add pages.
- `CREATIVE REQUIREMENTS … END CREATIVE REQUIREMENTS` block is never truncated by `renderOwnerCreativeBrief`; prose is shortened with a pointer to the full prompt. `VISITOR CREATION SPECIFICATION` also carries requirements, confirmed direction and refinements. New string fields are redacted for private routing values.

## Sprints 2–4 — what changed

- C: original `/src/project-components/**` modules are accepted next to certified sections; normalization keeps them byte-for-byte; adapted derivatives carry `// @unison-derived-from <variantId>`.
- D: certified design retrieval ranks by owner prompt, creative brief, requirements, confirmed direction and refinements inside the sealed registry (never widens it).
- E: topology fallback inserts a real Home page instead of renaming the first page; coverage requires source + router + navigation for each requested page.
- F: `requirementCoverage.ts` reports met/partial/missing/unverified per requirement ID (advisory, shown in launch review). Style judgement is reported `unverified`, never inferred. Live-looking data must carry a visible sample label.
- G: Affinity edits of authored modules run through the canonical Composer gates; a new `data-honesty` gate rejects an edit that drops a visible "Sample data" label unless the owner asked about it.
- H: three unused duplicate App Builder authorities (`*-3manBeatz.ts`) removed; other `-3manBeatz` artifacts were not audited.

## Live AI evidence (Lovable Cloud test copy, not Unison)

Real Gemini calls through the real App Builder page path (`generatePages` → `generate-page`) and edit path (`edit` → `ai-code-assistant`):

1. Prompt: Whistle Blower bold multi-page live-sports blog, interactive match centre, cinematic motion, labelled sample data. The AI wrote `/src/project-components/sports/MatchCentre.tsx` (26 KB, original: fixture ticker, scoreboard, filterable timeline, stats tab) and `/src/pages/MatchCentre.tsx` importing it. Candidate `ready-for-commit`, no diagnostics, ~55 s.
2. Rendered in headless Chromium: 4 sections, 10 controls, clicking a fixture switches the match, no runtime errors.
3. Affinity edit ("ticker in a left sidebar next to the scoreboard"): only the component changed, `ready-for-commit`, two-column layout rendered. The first edit run silently dropped the "(Sample Data)" label — this produced the data-honesty gate; the rerun kept it.
4. Coverage on that output correctly reported imagery `missing` (no images) and `/blog` `missing` (only one page requested in the probe).

## Evidence and limits

- Offline: `nativeAuthorshipPolicy` and `nativeAuthorshipMatrix` (Whistle Blower, cinematic music, salon, commerce, SaaS, unfamiliar style) plus 31 launch/App Builder/composer suites pass; App Builder tests cover authored-module acceptance, registry-only output staying incomplete, and source-scoped edits.
- Not proven: save to a revision and reopen (needs the Unison backend and a signed-in account); a full multi-page launch through the chat UI; matrix scenarios 7 (reopen/edit/publish readiness) and 8 (failure paths); Preview page-selector/export agreement.
- Server wording reaches users only after Unison redeploys `ai-code-assistant`/`generate-page`.
