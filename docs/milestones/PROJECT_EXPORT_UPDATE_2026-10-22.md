# Project Source Export Update

**Status:** Priorities 1-6 and 8-10 implemented; priority 7 partially implemented.

## Export behavior

1. All original `/.unison/` sidecars are restored after Sandpack preparation and included in the ZIP; the export-specific runtime manifest is normalized separately.
2. `project-manifest.json` includes project identity, entry point, accepted snapshot ID/hash, and source file inventory.
3. `design-context.json` projects canonical snapshot design/page metadata.
4. `unison.runtime.json` exports a sanitized runtime contract without tenant IDs or secret values.
5. `backend-capabilities.json` derives required tables, columns, RLS policy names, functions, events, permissions, and intents from the canonical capability registry.
6. `asset-manifest.json` lists local asset hashes and external host/source paths. License state is marked `unverified`; it is not proof of redistribution rights.
7. Base Vite/React dependencies use exact installed versions, and known canonical runtime pins are applied. A full project-specific `package-lock.json` is not emitted because the client-side ZIP exporter has no dependency resolver; `export-preflight.json` explicitly warns about floating imported versions and the missing lockfile.
8. `AGENTS.md` and `UNISON_PROJECT.md` are emitted with project-specific instructions and metadata references.
9. Export preflight checks the canonical entrypoint, local import and asset closure, and declared dependency closure before ZIP creation.
10. The exporter/importer integration test verifies `.unison/` metadata, page registry/source, design seed, manifests, assets, and file count across a full round trip.

## Verification and limits

- The `/src/pages/Home.tsx` round trip initially failed because `normalizeLauncherFiles()` interpreted `project-manifest.json`'s `files` collection as a legacy VFS envelope. The manifest uses `filePaths` now, the envelope parser rejects arrays, and generated export metadata is excluded from imported VFS files.
- Export tests verify the metadata sidecars, root manifests, external URL query redaction, local asset hashes, preflight failure behavior, and canonical re-import.
- External assets remain unlicensed until a trusted rights review exists. The export preflight is not a malware scanner or comprehensive PII scrubber.