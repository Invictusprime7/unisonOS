# Directory rules
- `agentOperations` catalog tools delegate to Resource Runtime with project scope; resource adapters alone own storage/invalidation. Record edits never propose matching-literal JSX swaps. Why: AI and Preview must edit one owner without changing unrelated cards or bypassing dedicated-backend routing.
- Site parts are named with node addresses (`page:/x`, `section:/x#id`, `button:/x#label`, `component:Name`, `file:/path`) resolved read-only by `agent-runtime/nodeAddress.ts` over `buildSystemGraph`. Why: AI, terminal and command menu must agree on which file owns a part.
- `propose_section_action` delegates to `sectionActions.ts` and returns source proposals, never commits directly; why: AI, command menu and terminal must share section semantics and acceptance.
- Browser verifier/probe providers are observers; Playwright stays outside the client bundle; why: verification must not become a competing writer or runtime.

Current operations/context and limitations: `docs/AGENTIC_IDE.md`. Resource storage and invalidation: `docs/RESOURCE_RUNTIME.md`.
