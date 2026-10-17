# Make the AI Builder conversational and stop policy checks from blocking edits

## What changes for you

- The AI Builder talks with you before acting when a request is open-ended ("make it feel more premium"). It asks one short question or offers 2–3 concrete Unison options (for example: "floating pill nav, minimal dark nav, or centered-logo nav?"), then carries out the one you pick.
- Clear requests ("make the nav floating", "change the primary color to deep green", "move the stats above the testimonials") apply straight away.
- Layout changes, component swaps, color/theme changes and text edits are no longer refused for style or scope reasons. Only problems that would actually break the site, lose your work, or touch another project still stop an edit — and when that happens the AI fixes it or explains in one plain sentence.

## Which checks stay (they protect your site)

- Code that would not compile, imports that point nowhere, empty files.
- Edits prepared on an older saved version (now auto-replayed when possible instead of refused).
- Writing to another project or business, or to the wrong selected record.
- The router file and generated system files (changed through page operations, not by hand).
- Never silently overwriting your saved work or erasing the entry file.
- Button/login wiring that would stop working.

## Which checks become advice instead of blocks

| Check today | New behavior |
|---|---|
| Scoped edit "touched more than 3 files / more than 1 new file" | Allowed; listed in the activity feed |
| Edit touched a page you didn't select (e.g. shared nav) | Allowed when the change is in a shared part that page shows; otherwise asked, not refused |
| "This edit breaks the site's design language" | Shown as a suggestion with an "undo" option; edit is saved |
| Theme: unknown preset / unfamiliar value / non-token color | Accepted when it maps to a valid color, font or size; converted to the nearest theme token |
| Theme edit mixed with a content edit | Split into two saves automatically instead of refused |
| Button destination change during a design edit | Allowed when you asked for it; still blocked when you didn't |
| New intents / packages not pre-approved | Known Unison intents and already-installed packages allowed; truly unknown ones asked about |
| Composer must return line-by-line edits for existing files | Whole-file replies accepted when the result passes the build check |
| Page creation touching another page | Allowed for nav/footer links to the new page |
| Source budget too large to include every file | Proceeds with the files that matter plus a note, instead of refusing |
| Composition count/structure fingerprint after theme step | Only checked when you didn't ask for that structural change |

## Technical details

- Add one shared `editPolicy` classification (`hard` | `advisory`) used by `aiCandidateGates`, `reviewScope.ts`, `orchestrator.ts`, `aiComposerContract.ts` (byte-mirrored both copies), `composerLane.ts`, `builderToolDispatch`, `vfsCommitService` design-contract and theme sections, and `themeEdit.ts`. Advisory findings ride the result as `advisories[]` and render in the activity feed; only `hard` findings reject.
- `vfsCommitService` site design contract (~1010–1034): downgrade to advisory for AI edits.
- `reviewScope.ts` file-count/new-file/stub limits: advisory; keep locked-intent removal as hard unless the request names that control.
- `composerLane.ts`: accept FILE replace for existing files when SEARCH hunks fail, gated by candidate transpile + import closure; keep SEARCH/REPLACE as the preferred format.
- `aiComposerContract.ts`: approve any intent in the canonical intent library and any dependency already in the project/Sandpack base; unknown → advisory question.
- `themeEdit.ts` / `themeTokenOverrides.ts`: normalize hex/rgb/named colors to HSL token values; split mixed theme+content proposals into two queued commits via `runExclusive`.
- `canonicalAuthoringRequest.sourceContextComplete`: require completeness only for the edit targets; omitted non-target context becomes a note.
- `builderMutationService` intent retarget: allow when the prompt explicitly names the destination.
- Prompts: rewrite `buildEditAssistantPrompt` / `CONVERSATION_AWARENESS` in `builderPrompts.ts` so it is always injected: classify request as clear vs open-ended; for open-ended, reply with one question or 2–3 named Unison options (from the resolved registry variants and Art Direction pack) before authoring; when clear, act and summarize in one line; suggest one follow-up improvement grounded in the certified vocabulary.
- `AIBuilderPanel`: render option replies as tappable choices that send the chosen option as the next request.
- Keep `commitMutation` as the sole writer; no changes to security, RLS, or data. Update `AGENTS.md` with the hard/advisory rule. Tests: one per relaxed check proving it no longer rejects, one per kept hard check proving it still rejects; redeploy `ai-code-assistant` via the existing workflow.
