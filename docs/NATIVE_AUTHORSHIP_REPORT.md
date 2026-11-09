# Native AI Authorship Restoration — Sprint 1 report (2026-11-09)

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

Not yet recorded: `artDirectionCandidates`, `designReferences` (Sprint 4 · D).

## Phase B — creative plan

- `src/services/launch/creativePlan.ts`: deterministic tone/typography/color/imagery/composition/motion/interaction/reference dimensions; requirement IDs (`req:page:*`, `req:navigation:multi-page`, `req:motion:*`, `req:interaction:*`, `req:capability:*`, `req:reference:*`) with origin `explicit`/`confirmed`; negation aware.
- Design direction: earliest family the owner names → confirmed chat direction → labelled **provisional** base for unmapped styles (cinematic/noir → bold, etc.) or none. No silent first-preset Modern.
- Pages from an explicit page list in the confirmed direction are kept (origin `confirmed`); prose mentions never add pages.
- `CREATIVE REQUIREMENTS … END CREATIVE REQUIREMENTS` block is never truncated by `renderOwnerCreativeBrief`; prose is shortened with a pointer to the full prompt. `VISITOR CREATION SPECIFICATION` also carries requirements, confirmed direction and refinements. New string fields are redacted for private routing values.

## Evidence and limits

- `src/test/nativeAuthorshipPolicy.test.ts` (15 checks) plus 23 launch/App Builder/composer suites (276 checks) pass; edge suites pass except one sandbox-env-dependent provider check unrelated to this work.
- The first-loss test uses recorded synthetic stages, not a live AI run. No Whistle Blower fixture was provided and the authoritative Unison backend is not reachable from this sandbox, so no live generate → render → edit → reopen proof exists yet.
- Server wording reaches users only after Unison redeploys `ai-code-assistant`/`generate-page`.
