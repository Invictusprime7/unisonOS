# Directory rules
- `agentOperations` record updates issue `executeEditorCommand` with observed fields; adapters own baseline enforcement (shared content/profile currently pre-read only), and failed reads never create records. Reads/writes carry project scope. Why: AI and Preview share one owner without pretending pre-read checks are atomic.
- Inspector text/asset/intent ops route through `executeEditorCommand` (source `inspector`); `planInspectorExecution` stays the pure planner, and default record fields resolve from the resource schema. Why: every editing surface shares one ownership, telemetry and resource-lane path.
- Site parts are named with node addresses (`page:/x`, `section:/x#id`, `button:/x#label`, `component:Name`, `file:/path`) resolved read-only by `agent-runtime/nodeAddress.ts` over `buildSystemGraph`. Why: AI, terminal and command menu must agree on which file owns a part.
- `propose_section_action` delegates to `sectionActions.ts` and returns source proposals, never commits directly; why: AI, command menu and terminal must share section semantics and acceptance.
- Browser verifier/probe providers are observers; Playwright stays outside the client bundle; why: verification must not become a competing writer or runtime.

Current operations/context and limitations: `docs/AGENTIC_IDE.md`. Resource storage and invalidation: `docs/RESOURCE_RUNTIME.md`.
