# Unison Runtime Integrity & Preview Editing Validation

Goal: prove complete user journeys instead of adding capability. First proven journey: ecommerce. Then portfolio, restaurant, booking, SaaS.

## 1. Dedicated backend schema parity (P0)
- Write one explicit dedicated-runtime schema contract: which tables and columns a provisioned site database must have for catalog, CMS content and site profile.
- Align the per-site gateway with the real shared schema: content uses `content_type_id` (resolved from the type slug), and the profile reads and writes inside `site_profiles.overrides` instead of top-level columns.
- Add a provisioning schema check: the gateway reports "schema incompatible" as its own error instead of failing on individual writes.
- Tests: contract tests for create/read/update on all three resource kinds against the declared schema.

## 2. Preview object identity (P0)
- Audit generated catalog/content sections so every rendered record field carries a resource mark (`resource#id.field`).
- Restrict auto-create in the resource executor: a missing record may be created only when the mark comes from a generated seed that has no saved row yet. Mistyped or unknown identities, and IDs that look like real saved IDs but don't match, are refused with a clear message.
- Tests: rendered-card fixture, then selection, then the exact record resolved; legitimate vs illegitimate creation.

## 3. One universal Records interface (P0)
- Extend the Records read model from four families to every registered resource family (products, services, menu, pricing, testimonials, projects, case studies, FAQs, other CMS types), keeping each schema and business rule.
- Catalog and Content pages become filtered views of Records (links kept), so there is one editing destination.

## 4. Playground consolidation (P1)
- Move remaining Products/Services/Catalog/Assets record editing out of the Creator Playground to Records/Preview; the Playground keeps only operational controls (pages, funnels, launch).

## 5. Duplicate source cleanup (P1)
- Compare each `-UnrealDev` file under `src` with its active counterpart, merge anything worth keeping, then delete the duplicates and exclude any remainder from type checking.

## 6. Authenticated end-to-end tests
- Add a repeatable browser script: sign in, open project, edit product name/price/photo in Preview, refresh, reopen, publish, check the published page.
- It runs when a valid UNISON session is available. In this sandbox the session can't be issued, so you run it from your own signed-in preview.

## 7. Guest project continuity
- After signup, a guest's demo project transfers to the new account (server-side, with credits respected). Home then shows recent projects, including the demo-started one, with a Resume button.

## Technical details
- Files mainly touched: `supabase/functions/project-backend/index.ts`, `src/services/resources/{resourceExecutor,resourceRegistry,recordsProjection}.ts`, `src/pages/BusinessRecords.tsx`, `CreatorPlaygroundModal.tsx`, `src/pages/Home.tsx`, plus a guest-claim function and migration.
- Backend changes ship via the GitHub UNISON workflow; no existing records are moved or deleted.
- Done means: focused tests pass, the build is clean, and the ecommerce journey script passes once signed in.
