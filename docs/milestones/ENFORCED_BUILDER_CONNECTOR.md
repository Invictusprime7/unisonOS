# Enforced Builder Connector

## Phase 1 — Context seam

`src/types/unisonBuilderConnector.ts` defines a read-only projection of the existing request envelope, selected property ownership, project/revision identity, connected catalog summary, bounded registry and sealed design-token roles. `src/services/unisonBuilderConnector.ts` assembles and validates it without database reads, writes or additional file crawls.

The AI Builder passes its already-resolved context into both the App Builder source-edit facade and the shared Builder transport. App Builder edits validate the source target inventory before assembling the existing Composer request. The transport validates connector identity before touching auth or sending a request, strips the local context object, and carries compact guidance in the existing messages contract. No new endpoint, model, operation registry, save queue or writer is introduced.

### Implemented enforcement

- Reject selected elements from another supplied project or revision.
- Reject missing existing-file targets and traversal paths.
- Reject supplied registry projections containing implementations not certified approved/portable.
- Preserve saved-record ownership and report unavailable context explicitly.
- Preserve existing Composer hunk/candidate gates, deterministic router generation, permission checks and `runBuilderAiMutation` → `commitMutation` acceptance.

Token roles and hunk policies are guidance at this seam, not a replacement for output validation. Certification checks validate the resolved projection; they do not independently re-certify the registry. Missing legacy context is reported rather than synthesized. Fresh launch and page generation continue through the existing App Builder orchestration; they are not yet consolidated into this new context seam.

## Next phases

1. Dispatch existing `AgentOperationName` tools through their established executors, with property-owner and capability checks.
2. Enforce model-produced proposals at the existing Composer edge boundary; no parallel lane or endpoint unless a concrete contract requires it.
3. Audit legacy file consumers and migrate each caller before removals. The earlier removal list is a candidate audit list, not proof that those files are dead.
4. Verify signed-in edits, page creation, catalog saves, reload and checkpoints across industries.

## Migration policy

Phase 1 needs no schema migration and changes no production records. Persistent connector auditing should first reuse existing agent/editor telemetry and revision provenance. If a new schema is justified later, ship a timestamped canonical `supabase/migrations` file with access controls and tests through the UNISON GitHub deployment workflow. Do not create duplicate session/log tables merely to mirror existing telemetry, and do not copy destructive cleanup migrations.

## Verification

`unisonBuilderConnector.test.ts` tests ownership, revision, path, certification and context rules. `builderBrainSession.test.ts` tests the connector's actual transport boundary, including pre-auth rejection and avoiding duplicate source payloads. Existing App Builder and AI candidate tests cover the retained authoring and acceptance flow. An authenticated live-site edit remains unverified; these tests do not establish production readiness or guarantee repair-free generation.
## Phase 3a — Composer proposal scope

Builder requests carry explicit `sourceTargets`, separate from read-only `files`. The mirrored contract rejects out-of-target and duplicate operations, creates overwriting supplied source, and edits/deletes without supplied source. The existing edge lane and client repair loop apply the same policy; repairs retain original targets and rejected operations never accumulate.

Existing-file edits require SEARCH/REPLACE blocks at the edge; JSON cannot bypass the hunk policy. Empty searches and ambiguous whitespace-normalized matches are rejected. Builder requests without targets fail before provider invocation; launch scope is unchanged.

This validates proposals against the supplied request, not authenticated ownership, capabilities or server revision freshness. Canonical acceptance and `commitMutation` remain authoritative. Route/dependency/capability enforcement and authenticated cross-industry acceptance remain pending. No endpoint, database or production records change; deployment uses the existing GitHub workflow.
