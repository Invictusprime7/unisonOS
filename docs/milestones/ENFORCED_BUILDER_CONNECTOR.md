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

Verification: 60 tests pass across seven Composer, App Builder and connector suites, including actual edge-lane rejection/repair, client pre-candidate rejection, target assembly, four-file explicit scope, and byte-mirror parity. Preview build is OK. Canonical workflow deployment and real signed-in edit/read-back remain unverified; no live backend deployment was attempted.

## Phase 3b — Planned routes and dependency requests

Builder request assembly projects existing `initialRouteOps` into the Composer wire schema (excluding host-only `createdBy`) and reads accepted dependencies from the current `/package.json` without sending that file. Repairs carry the same approvals. Both the edge and client proposal checks reject unplanned or modified route operations, duplicate route operations and dependency requests outside that inventory. Missing approvals permit neither route changes nor dependency requests.

Launch and dedicated multi-page authoring retain their existing topology path. These request approvals are not server ownership authorization, capability verification or permission to install a new package. External imports not declared in `requestedDependencies` and capability/intent membership remain pending work; source parsing, import resolution and canonical acceptance remain authoritative. No migrations, live records or backend deployment changed.

Verification: 75 tests pass across nine suites, including exact route matching independent of key order, altered route/navigation rejection, duplicate route rejection, dependency inventory assembly, edge repair, client pre-candidate refusal and positive launch page creation. Preview build is OK; deployment and authenticated edit/read-back remain unverified.

## Phase 3c — Intent/capability authoring vocabulary

Builder request assembly derives `approvedIntents` from the canonical intent registry and accepted registry capability IDs, not supplied `providedIntents` claims. Universal user actions remain available; aliases, deprecated intents and lifecycle/workflow events are excluded. Missing capability context permits only universal actions.

The mirrored proposal check rejects unapproved `intentsUsed` and new literal `data-ut-intent` occurrences even when response metadata omits them. Unchanged existing legacy occurrences survive unrelated edits. Edge repair and client pre-candidate checks share this policy. Launch authoring keeps its existing validation path.

This is request vocabulary enforcement, not server authorization or confirmation that payments, emails or other live handlers are configured. Computed bindings are not covered by the literal scanner; runtime/canonical gates remain authoritative. No migrations, production records or backend deployment changed. Authenticated edit/read-back and canonical workflow deployment remain unverified.

Verification: 84 tests pass across ten suites, including canonical capability derivation, alias/lifecycle rejection, literal bindings without metadata, preservation of old occurrences, duplicate prevention, edge repair and client refusal. Contract byte parity and preview build are OK.

## Phase 3d — Actual source imports

The mirrored proposal check now parses changed TypeScript/JSX with Babel and inspects static imports, side-effect imports, re-exports, dynamic imports, require calls and TypeScript import forms. New package roots must belong to the accepted dependency inventory even when `DEPENDENCIES` is omitted. Local paths remain subject to canonical import resolution. New remote/protocol and computed module loads are rejected; unparseable source cannot receive unverifiable approval.

Existing specifier occurrences survive unrelated edits, but adding occurrences requires approval. Comments and ordinary strings are ignored. This is an inventory check, not a replacement for dependencyResolver classification/certification or runtime authorization. Direct require calls are conservatively checked, including locally shadowed require identifiers. Launch intake remains unchanged.

The existing Composer endpoint, repair loop and sole commit writer are preserved. No migrations or production records changed; canonical workflow deployment and authenticated edit/read-back remain pending.

Verification: 107 tests pass across eleven suites, including nine module syntax forms, scoped subpaths, local imports, remote/protocol rejection, computed loads, comment/string handling, existing-import preservation, edge repair and pre-candidate client refusal. Mirrored contracts match and preview build is OK. Edge import maps pin the explicit parser version; deployed edge execution is not verified.

## Phase 4a — Audited legacy cleanup

Removed `src/utils/stripComposerTrailer.ts`: repository-wide source, function, script and documentation searches found no imports or callers. Active Composer parsing remains in `composerLane.ts`; this removal changes neither authoring nor accepted saved source. The existing legacy-retirement test now prevents this unused helper from returning.

| Audited consumer | Decision | Reason |
| --- | --- | --- |
| `src/utils/aiResponseParser.ts` | Retain | Builder panel still consumes multi-file and stylesheet extraction for non-Composer turns. |
| `src/services/builder/sequentialAiTasks.ts` | Retain | Builder panel consumes it during multi-file candidate application. |
| `src/services/builder/canonicalAuthoringRequest.ts` | Retain | Active request assembly and eligibility for Builder, launch and repair. |
| `src/services/builder/aiRepairLoop.ts` | Retain | Shared by App Builder, WebBuilder and launch authoring. |
| Dependency resolver/extractor | Retain | Classification and accepted inventory assembly are not replaced by Composer import approvals. |

No active fallback or saved-project compatibility path was removed. Remaining fallback consolidation requires caller migration and acceptance evidence, not deletion based on filenames. Verification: 116 tests pass across ten suites, including saved declarative-page hydration, certified defaults, Composer parsing/repair and connector dispatch; fresh-launch authority lint and preview build are OK. No database operations or deployments occurred. Authenticated cross-industry edit/read-back remains blocked by the available session's backend mismatch.

### Phase 4a continuation — Extraction-only parser

Removed unused structured-tag parsing, response-to-VFS generation, component-signature APIs and HTML-import re-exports from `aiResponseParser.ts`. Repository-wide caller searches found only the Builder panel and extraction tests importing this module; both use the retained `extractMultiFileOutput` and `extractStylesheetOutput`. Those implementations are unchanged, including malformed JSON compatibility and explicit deletions. The underlying `aiWebParser.ts` importer remains intact.

The parser's public-export regression test asserts it exposes exactly the two extraction functions. Verification: 74 tests pass across six extraction, legacy isolation/hydration, request assembly, App Builder and import-enforcement suites; authority lint and preview build are OK. This is dead-API retirement, not migration of active fallback mutations. Phase 4b still requires caller migration and authenticated acceptance; no records, endpoints or deployments changed.
