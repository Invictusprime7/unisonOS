# Preview runtime architecture

Active guide; source-reviewed 2026-10-08. See [architecture](ARCHITECTURE.md) for acceptance and persistence ownership.

## One source-backed website preview

```text
Accepted revision + SiteBundleSnapshot / current coordinated VFS
  → snapshot projection (preserve live authored bytes)
  → prepareSandpackFiles in sandpackFilePrep.ts
  → Sandpack overlay / runtime bridges
  → VFSPreview
```

Preview preparation is a projection. It does not author fresh pages or accept a new canonical revision. Compatibility preparation/shims must not be represented as a new acceptance point or permission to replace an unparseable user edit with a stub.

The source project requires `/src/main.tsx`, `/src/index.css` and `/src/App.tsx`. The latter is the canonical PageRegistry-generated router; generated previews use HashRouter. Sandpack maps source into its own entry/overlay format. The application's outer BrowserRouter is a separate concern.

The shared `prepareSandpackFiles` path handles preview package/import/entry adaptation and runtime bridges. The source VFS stays in canonical `/src/**` form. Library shims or compatibility files in the overlay are not authored source to save back indiscriminately.

## Current UI

- `src/components/VFSPreview.tsx` renders the website in Sandpack.
- `src/components/creatives/code-editor/VFSCodeView.tsx` hosts the complete Split code workspace with resizable preview.
- `snapshotProjector.ts` preserves current VFS bytes rather than replaying stale embedded snapshot bytes.
- `PreviewRuntimeController` wraps existing preview services; it is not a second compiler.
- Graphic Design Studio can use Fabric; website Canvas remains the React preview with selection/edit tooling.

The active Builder does not automatically fall back to ECS/Docker or static HTML after a compile failure. Older preview services in the repository are compatibility/tooling, not runtime ownership. Existing saved sites reopen from their accepted revision, never a default seed.

## Preview signals versus save outcomes

`src/services/builder/previewVerification.ts` tracks pending/loaded/error state and emits agent events. The activity ribbon can report “Updating preview”, “Preview updated” or a preview error after source edits. These signals reflect compile/load observations; they do not prove every route, field or business workflow.

A successful source commit remains saved even when preview verification times out or detects a problem. Do not rewrite a saved success as “not applied” merely because the preview has not answered. Conversely, a visible optimistic change is not a confirmed commit.

## Post-commit checks

`src/services/agent-runtime/browserVerification.ts` provides:

1. `captureIntentBaseline`: probe controls actually visible before the save.
2. `deriveIntentChecks`: derive surviving action attributes from changed source.
3. `verifyCommittedChange`: wait for preview load and recheck relevant visible controls.

Results distinguish `verified`, `preview-error`, `unconfirmed` and `mismatch`. Checks cover the current route. A route change reports unconfirmed; closed menus and controls on other pages are not automatically “missing”. An intent attribute being visible does not establish successful intent execution, checkout or persistence.

## Provider boundaries

| Provider | Delivered behavior | Limit |
| --- | --- | --- |
| Default in-preview probes | postMessage read-only selector/text/intent checks | Current preview route, no browser clicks |
| `inPreviewVerifier` | Interface compatibility + selector visibility | `open` only validates route-shaped input; it does not navigate. `getText` returns selector/existence evidence, not extracted text |
| Local Playwright script | Open/click/read text/assert visibility/screenshot on a developer machine | Standalone tooling; no automatic hosted integration or authentication |
| Hosted worker | Swappable interface (`playwright-worker`) | Hosting adapter and isolated candidate previews remain unimplemented |

Client modules must never import Playwright. Browser verification remains an observer, not a VFS/database writer.

## Running local checks

On a developer machine with Chromium installed:

```bash
npx playwright install chromium
node scripts/verify-browser-local.mjs http://localhost:8080 /absolute/path/to/steps.json
```

The optional JSON is an array of steps with `open`, `click`, `visible`, `text` or `viewport` entries. Click/text/visible values are Playwright selectors. The script writes `browser-verify.png` in its working directory and exits nonzero for failed assertions/page errors. Run from a temporary evidence directory when needed.

It does not establish an authenticated session. A real Builder/resource verification must authenticate, select the intended site and check actual input/save/read-back/undo. A public homepage screenshot alone cannot close that gate.

## Resource refresh and selection

Saved-record invalidation uses `CATALOG_BINDINGS_CHANGED` with `RESOURCE_INVALIDATED` metadata. Live bound sections can refresh matching records without remounting the preview. Source-only hardcoded elements do not become database-bound automatically.

Selection carries the displayed route and element/resource identity back to Builder. Page controls and clicked scope must agree before a source mutation. See [Agentic IDE](AGENTIC_IDE.md) and [Resource Runtime](RESOURCE_RUNTIME.md).

## Operations and outstanding verification

Start with browser/runtime logs, exact saved revision and actual route; distinguish compile error, transport failure, stale projection and missing record binding. Preserve authored bytes and inspect the source before changing the compiler.

Hosted browser checks and candidate preview infrastructure require outside hosting approval. Authenticated live-site click/record/save/undo checks remain open in `roadmap.md`. This guide does not assert those gates passed.
