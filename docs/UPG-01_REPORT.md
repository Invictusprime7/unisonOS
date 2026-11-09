# UPG-01 — Prompt-first creation report

## Call graph (new project)

```text
Affinity chat (AIAssistantCore, site-discovery)
  └─ confirmed brief (buildConfirmedSiteBrief)
       └─ PromptLaunchPanel                      (Home, Live Demo, Onboarding)
            └─ buildPromptLaunchInput(brief)      pure adapter, no state
                 └─ runLaunchPipeline             canonical stages (unchanged)
                      └─ UnisonAppBuilder → orchestrateAppBuild
                           └─ authorSite → page briefs (siteAuthoringOrchestrator)
                                + runtimeContextForPage (appBuilderGenerationContext)
                      └─ commitMutation           sole canonical writer (unchanged)
                 └─ /web-builder handoff (navigationState)
```

## Where creative authority was lost

1. `buildSyncedVisionBrief` led with guided selections; the prompt followed as context.
2. Page briefs restricted the owner vision to "wording and content" and led with the composition target.
3. Runtime context said both "ORIGINAL BODY DESIGN IS REQUIRED / do not import registry modules" and, in the site brief, "render the registered family dispatcher" — the model received contradictory rules.
4. Design retrieval excluded certified designs by page-role label even for open-ended prompts.

## Changes

- `creativeAuthorityPolicy.ts`: one authority order, one REUSE / ADAPT / AUTHOR section policy, archetypes advisory; read by both the page brief and runtime context.
- Owner prompt leads every page brief; layout hints yield space to it.
- Page context lists ranked, materialized certified options with prop contracts (trimmable).
- Open-ended creation ranks by prompt fit and page role instead of excluding by role.
- Candidate provenance records `sectionOrigins` (certified vs custom counts).
- Chat is the only new-project entry; the planning chat no longer emits guided-step markers, and the chat ignores any marker an older backend still sends.
- PR 6 legacy retirement: deleted `LauncherWizard.tsx` (and its conflict copy), `DesignContractInspector.tsx`, `interviewDraftService.ts`, `chatWizardStep.ts`, the chat's option-card plumbing and the backend `wizardStep` field. Each former Wizard responsibility now has an owner:
  - industry / goals / pages / theme / variant steps → `deriveChatLaunchPlan` + `buildPromptLaunchInput` (revisable defaults);
  - business profile pre-fill → Onboarding business gate → `prefill`;
  - social links → `extractPromptSocialLinks` (links written in the conversation; saved profile links as fallback);
  - project ZIP import / Unison export restore → "Import it instead" in `PromptLaunchPanel`;
  - failure report + technical details → `PromptLaunchPanel` (`createLaunchFailureReport`);
  - saved interview answers → removed from the browser on the next successful launch (`clearRetiredInterviewDrafts`).
- Mixed source model: site-local sections imported by relative path (`../project-components/X`) are now recognised exactly like `@/project-components/X`; before, the App Builder rejected such pages (`uses unavailable … variant "custom:…"`).

## Ownership

| Area | Status |
|---|---|
| `runLaunchPipeline`, App Builder, `commitMutation`, gates | Canonical, unchanged |
| `PromptLaunchPanel`, `promptLaunchInput.ts` | New entry adapter (no writer) |
| `LauncherWizard`, interview drafts, `chatWizardStep` | Deleted (PR 6); guarded by `promptFirstEntryPoints.test.ts` |

## Mixed-generation evidence (raw → accepted)

`src/test/unisonAppBuilder.test.ts` › "UPG-01: accepts a certified design and an original section on one page…" runs the real App Builder (`generate`) with a stubbed page author:

- raw candidate Home: certified scaffold sections plus `<section data-ut-section-id="home:match-centre:0" data-ut-section-type="match-centre" data-ut-variant="custom:match-centre"><MatchCentre fixture="Ghana v Senegal" /></section>`, importing `../project-components/MatchCentre`;
- accepted candidate (`ready-for-commit`): `/src/project-components/MatchCentre.tsx` byte-identical; Home keeps the import and authored props; the only changes are canonical identity (`data-ut-entity-id`, page id/path, stable variant `custom:project-components-match-centre-default`, `sectionId`/`variantId`/`props` on the call site);
- provenance `sectionOrigins`: `custom: 1`, `certified ≥ 1`.

## Test results (this pass)

- New/updated: `promptFirstLaunch`, `promptFirstEntryPoints`, `promptLaunchPanel`, `homepageChatWizardHandoff`, `unisonAppBuilder`, `appBuilderSectionModel`, `appBuilderContextRecovery`, `designSystemResolver`, `launchOrchestratorCanonicalHandoff`, `capabilityPacks`, `universalCreationCapabilities`, `legacyGeneratorSurfaceRemoved`.
- Stale checks brought up to date: capability packs (customer sign-in pack now exists), launch handoff (prompt-first launches never adopt guided defaults), resolver fixture (a test mutated a shared fixture), custom-ID sidecar (custom variants get a stable source-derived ID).

## Not yet verified

- Live paid generation, Affinity edit, reopen and publish on Unison for the six brief scenarios (needs a signed-in Unison session and Unison deployment; the sandbox session belongs to a different backend).
- Unison redeploy of `ai-code-assistant` (the planning prompt change). The chat already hides old markers, so this only changes how the AI phrases questions.
- Remaining unrelated failure: `businessContentWorkspace` (the content page reads its site list directly from the database).
