# Affinity conversational intelligence upgrade

## What changes for you

- Affinity understands any request phrasing — long paragraphs, casual language, mixed languages, vague references ("the thing at the top") — and maps them to concrete site edits instead of failing or misreading them.
- Every Affinity reply follows a readable reasoning flow: **what I understood → what I decided → what I changed → what's next**, written as short sequential paragraphs, not terse one-liners or raw code dumps.
- When Affinity cannot do something, it explains plainly *why it is outside its scope* (e.g. "this needs a backend capability your site doesn't have installed — here's exactly what's missing") so you can patch the gap, instead of a bare error toast.
- Open-ended requests get a short clarifying question or 2–3 named Unison options before acting; clear requests act immediately.
- All of this runs on the configured Gemini service (Gemini 3.8 Flash via the existing provider router), with the managed gateway as backup — no new keys or providers.

## What stays protected

- `commitMutation` remains the sole writer; compile/import/stale-write/ownership/protected-path checks stay hard gates.
- No changes to security findings, RLS, or record data. Server changes deploy only via the GitHub workflow.

## Technical details

1. **Prompt layer** (`supabase/functions/ai-code-assistant/prompts/builderPrompts.ts`, `composerLane.ts`):
   - Replace `CONVERSATION_AWARENESS` with a stronger `AFFINITY_REASONING` block: identity as Affinity, language-agnostic intent extraction (interpret meaning, not keywords; handle any length), and a required response shape — short reasoning paragraphs (Understanding → Plan → Result/Options → Next step) before any file output.
   - Add an explicit "out of scope" contract: when a request can't be fulfilled, reply with a structured explanation naming the missing capability/permission/context and the exact patch needed, with no partial file output.
2. **Response parsing** (`orchestrator.ts`, `_shared/responseNormalizer.ts`): accept and preserve the reasoning prose alongside the files map; never strip the explanation. When the model returns explanation-only (no files), surface it as a conversational reply instead of an "empty result" failure.
3. **Panel rendering** (`AIBuilderPanel.tsx` + activity feed): render Affinity's reasoning paragraphs as the chat message body (markdown), keep file changes as the applied result, and render out-of-scope explanations as a distinct, readable note with the suggested patch. Option replies remain tappable choices.
4. **Intent tolerance** (`builderRequestInterpreter.ts` / task classifier): loosen keyword dependence — route on interpreted intent from the model when heuristics are unsure, so unusual phrasing still reaches the edit lane instead of falling through to a generic answer.
5. **Tests**: one per behavior — long/vague prompt still produces a scoped edit; non-English request maps correctly; out-of-scope request yields the structured explanation and no file writes; reasoning text survives normalization into the panel.
6. Deploy `ai-code-assistant` through the existing GitHub workflow after tests pass; live signed-in verification remains a separate step.
