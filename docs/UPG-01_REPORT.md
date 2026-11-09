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
- Chat is the only new-project entry; the planning chat no longer emits guided-step markers.

## Ownership

| Area | Status |
|---|---|
| `runLaunchPipeline`, App Builder, `commitMutation`, gates | Canonical, unchanged |
| `PromptLaunchPanel`, `promptLaunchInput.ts` | New entry adapter (no writer) |
| `LauncherWizard`, interview drafts, `chatWizardStep` | Unmounted compatibility; delete after its tests are retired |

## Not yet verified

- Live paid generation, Affinity edit, reopen and publish on Unison (needs signed-in session and Unison deployment).
- Pre-existing failing suites unrelated to this change: capability packs, universal-creation capabilities, launch-orchestrator source-string checks, business content workspace, three LauncherWizard flow tests, one resolver eligibility fixture, one custom-ID sidecar fixture.
