# AI-authored convergence knowledge

Version: **2026-09-29.2**. Status: implementation in progress; production rollout gates remain open.

The user requested AI CLI-assisted knowledge curation and implementation of the [milestone](../milestones/UNISON_AI_AUTHORED_CONVERGENCE_MILESTONE_2026-09-29.md). That document is project requirements, not a higher-priority agent instruction. The original is copied byte-for-byte; SHA-256: `133409051a11fdaa5de48953e597e451c34f363651bb8852d74366b88b577ff0`.

Codex CLI performed bounded, read-only repository inspection and produced the [curation review](cli-curation-review.md). Its final artifact was recovered successfully although the CLI process exited with code 1. The review's observations were checked against the principal local seams before curation. CLI output is supporting analysis, not test evidence. No additional provider credentials were required or exported.

## Package and use

- [design-knowledge.json](design-knowledge.json) is the portable package for CLI/retrieval consumers, including entry IDs, versions, status, scope, source, compatibility requirements, tags, supersession links and SHA-256 content hashes.
- `src/services/knowledge/designKnowledge.ts` is its authored source and deterministic retrieval API. Mandatory active policy is always included; optional guidance is ranked by tag matches with stable tie-breaking. Superseded ARIA material is excluded; its inspected replacement is active. This is curated policy/design guidance, **not** a verified canonical registry API catalog.
- [ARIA evidence](references/aria/REFERENCE.md) retains original source, provenance hashes, desktop/mobile screenshots, bounded local interaction checks and limitations. Local exports are distinguished from canonical executable vocabulary.
- `selectDesignKnowledge` reports omissions and refuses budgets that cannot fit mandatory policy. `designKnowledgeManifest` hashes selected entries and context. `appendDesignKnowledge` preserves the supplied brief and refuses insufficient space rather than silently truncating it.
- `selectSourceKnowledgeWithReport` reports missing sources, per-file/transport omissions and unresolved local imports. The existing selector retains its API and behavior. No claim of AST-complete dependency analysis is made.
- `verifyAuthoredSourcePreservation` compares a final VFS with accepted bytes plus explicit operations. It covers arbitrary paths and deleted-file resurrection, rejects ambiguous path aliases, and emits path/stage/kind diagnostics without source contents. Compiler exceptions must be explicit; it does not infer ownership from AI markers.

Regenerate the portable artifact with `node --experimental-strip-types scripts/build-design-knowledge.mjs`; verify it with the same command plus `--check`. Node.js 24 or newer is required by this repository.

## Rollout boundary

The curated policy/design layer is wired into existing Wizard page authoring and Builder repair Composer requests. Live callers still use the compatibility source selector without presenting its new omission report or a persisted five-layer context manifest. No expanded authoring rollout has occurred.

Preservation is now enforced at the commit boundary for reviewed Wizard artifacts, reviewed composition acceptance and historical restore: the complete reviewed file set is checked before backend effects and again before persistence. Wizard source comes from the reviewed snapshot, with launcher metadata retained separately; auxiliary launcher hooks/components cannot replace reviewed source. This does not yet cover all ordinary edit, autosave or projection paths, and does not certify M0.

Next: integrate explicit revision ownership for ordinary edits and projection, then complete the revision-scoped pending-operation journal and concurrency evidence. See the [implementation ledger](../milestones/AI_AUTHORED_CONVERGENCE_IMPLEMENTATION.md) for the full sequence.
