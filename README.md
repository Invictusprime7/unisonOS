# Unison

Unison turns a business idea into a source-backed React website and a connected business workspace. Chat, guided setup, AI editing, visual editing, code, saved history and publishing continue from the same project.

## What you can do

- Describe a site in chat, review the guided choices and launch a complete application.
- Edit pages with AI, select an element in the preview, or work in the full code-and-preview Split workspace.
- Inspect pages, sections, files and visitor actions through the command menu and terminal.
- Edit saved products, services, prices, content and business details where the site carries a live record connection.
- Reopen saved projects and per-draft AI conversations across sessions using the same backend and account.
- See file activity, open relevant files, and distinguish a saved edit from a preview that has confirmed loading it.
- Review checkpoint descriptions and restore an accepted source revision.

## One continuous project

```text
Chat + guided choices
  → shared site plan
  → AI-authored application candidate
  → validation and accepted revision
  → Builder + live React preview
  → editing, business setup and publishing
```

The guided setup collects selections; App Builder authors the application. Planning owns page identities, business actions, visual direction and protected infrastructure. An accepted launch becomes the saved project; reopening it does not regenerate its pages.

Design combines industry, theme family, a sealed art-direction pack, page roles, experience, brand, content and a stable design seed. Modern, Editorial, Futuristic, Minimalist, Bold and Organic are families, not fixed color palettes. Unison's curated, production-certified design registry supplies executable vocabulary; validated project-local compositions can also be authored. Stable planning does not mean AI-generated source is byte-identical across new requests.

The attached **Unison X Loveable Design** library supplies managed components and tokens. Consumer compositions remain outside the managed library copy.

## Editing and saving

AI, the floating toolbar, terminal and code workspace share the canonical source-save flow. Saves are coordinated so conflicting work is rejected or safely rebased rather than silently overwriting newer edits. Automated older binding/CRM/republish updates cannot replace a newer accepted AI change.

AI Auto mode proceeds without ordinary approval prompts while retaining save validation, authorization and protected infrastructure checks. Mixed and Review retain their permission controls. The toolbar's AI action uses the same Builder conversation and context, not a separate author.

The terminal accepts commands and recognized plain-language requests. Read-only requests run immediately; recognized changes show their exact command for confirmation. Unrecognized requests go to AI Builder. The terminal never calls an independent AI service or writes project files directly.

Saved-record edits are separate from source revisions. A marked product or business detail updates its real record through the shared resource runtime. The save toast can undo the captured values. That undo is not a checkpoint restore, and old hardcoded pages are not automatically connected to saved records.

Preview-first consolidation preserves business operations and developer tools while retiring redundant editing paths. AI catalog tools use the same project-scoped record runtime as visual edits; a price or photo change does not rewrite unrelated matching text in source. Playground hydration is a compatibility read, not a source regeneration API.

Generation reads the current project's content schemas independently of open Records screens. Records creation follows the selected collection's fields, including empty planned collections; editor and preview adoption reject ambiguous generated identities. Launch seeding preserves supplied media and normalizes pricing intervals. These integrations have focused regression coverage; authenticated generation-to-publication verification remains open.

## Preview and publishing

The active website preview runs React source in Sandpack through the shared VFS preparation path. Canvas and Split are views of that project, not separate site generators. Fabric belongs to graphic/design tooling, not the website's rendering authority. Docker/static helpers are not automatic fallback previews for accepted sites.

Saving, loading the preview and verifying an interaction are separate outcomes. The activity ribbon reports emitted file stages and preview signals; a “Preview updated” indicator is not proof that every route or checkout was tested. Current in-preview checks are read-only and limited to the displayed route. Local Playwright tooling is available; a hosted browser worker is not yet integrated.

Publishing has stricter readiness requirements than ordinary Builder saves or restoring an accepted revision. Missing business connections can block publishing without preventing continued editing.

## Current limits

- Full live-site verification of click targeting, saved-record editing, preview read-back and undo remains open.
- Broader typed change sets and shared edge activity streaming remain milestone work.
- Hosted browser verification/candidate previews require outside hosting approval and implementation.
- AI/image generation depends on provider availability and funded usage; a timeout or quota error is surfaced, not hidden behind a generic replacement site.
- Project synchronization across separate deployments requires the same backend and account; this is not automatic cross-backend replication.

See [the roadmap](roadmap.md) for outstanding work. Historical test reports are evidence for their recorded revision, not a certification of every current workflow.

## Technology

| Area | Current repository |
| --- | --- |
| Application | React 19.2, TypeScript 5.9, Vite 7.3, React Router 7 |
| Interface | Tailwind 3.4 application stylesheet, Radix/shadcn shell, attached Unison design system |
| Code workspace | Monaco, CodeMirror and shared virtual files |
| Website preview | Sandpack 2.20 |
| Cloud | Lovable Cloud authentication, Postgres, access rules, storage, realtime and functions |
| AI | Authenticated server-side text/code provider runtime; existing image-generation function |
| Automation | Inngest and workflow functions; task-specific background integrations |
| Browser tooling | Playwright 1.56.1, outside the client bundle |

Installed dependencies do not establish active architectural ownership. The running product uses React Router and Vite; additional router/build packages in the manifest are not proof of a completed migration.

## Local development

Use Node.js `>=22 <23` (see `.nvmrc`) and the repository lockfile.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Configure only public browser connection values from your intended backend. Do not copy an old deployment's identifiers from documentation. Provider credentials belong in server-side secret settings, never `VITE_*`, source control or browser storage. Lovable Cloud does not expose its managed database password or service-role key.

For local browser tooling on your own machine:

```bash
npx playwright install chromium
node scripts/verify-browser-local.mjs http://localhost:8080 /absolute/path/to/steps.json
```

That script does not sign into your project automatically. A signed-out smoke check is not authenticated Builder verification.

### Repository checks

```bash
npm test
npm run lint
npm run lint:app-builder-authority
npm run lint:canonical-vfs-writes
npm run lint:catalog-contracts
npm run lint:pipeline-bypass
npm run lint:single-source-of-truth
npm run verify
npm run ci
```

These are available repository commands, not a claim they all passed during the documentation refresh. Deployment is separate and explicit.

## Documentation

Start with [the documentation index](docs/README.md). The [architecture guide](docs/ARCHITECTURE.md), [Agentic IDE](docs/AGENTIC_IDE.md), [Resource Runtime](docs/RESOURCE_RUNTIME.md), [preview guide](docs/PREVIEW_RUNTIME_ARCHITECTURE.md) and [AI configuration](docs/ai-providers.md) describe the current system. Historical plans and incident reports remain labeled evidence, not current setup instructions.

## Security and license

Private editing and business commands require authentication and server-enforced access checks. Public visitor runtimes validate their own site, capability and input boundaries. Shared client context and preview probes never grant database privileges.

Licensed under the [MIT License](LICENSE); third-party components/assets retain their own provenance and license obligations.
