# Unison Golden Journeys — Status Reference

Golden journeys are the strongest evidence tier in the Evidence Method
(published/runtime proof, not unit tests alone). Use these as release gates.
Update the **Status** line only after tracing the journey against current
source (or, ideally, running it) — never from a prior session's memory.

## 1. Project creation -> Wizard -> committed snapshot -> builder -> refresh/reopen

Restores the same revision and selected page.

**Status:** Assessed Real (call-site trace, not a live browser run) — 2026-08-13.
See Stage 0 in `roadmap-state.md`.

## 2. AI or manual edit -> validated commit -> cloud persistence -> refresh -> deterministic rollback

**Status:** Unknown — not assessed this cycle. `vfsCommitService.ts`'s
`commitMutation` is the known canonical writer (Stage 0), but rollback/undo
determinism has not been independently traced.

## 3. Booking visitor -> availability -> conflict-safe booking -> customer/activity creation -> confirmation -> reschedule/cancel

**Status:** Partial, one gap closed — 2026-08-13.
- Availability + conflict-safe create: Real (`publishedActionRuntimeModule.ts`
  -> `site-runtime` -> `private.create_atomic_booking`).
- Customer/activity (CRM) creation on booking: **Fixed this cycle.**
  Independently confirmed absent (not a subagent-only claim this time), then
  implemented in `supabase/functions/_shared/canonicalBooking.ts`
  (`linkBookingToCrm`) — business-scoped `crm_contacts` upsert +
  `crm_activities` insert, best-effort/non-throwing, skipped on duplicate
  (idempotent-retry) bookings. Not yet verified against a live database
  (deno check + source-string tests only — still Moderate evidence tier,
  not Strongest).
- Confirmation delivery: not checked.
- Reschedule/cancel: not checked.

## 4. Two-business negative journey -> no cross-tenant reads, writes, realtime events, or identity leakage

**Status:** Unknown — 2026-08-13. RLS policies were quoted (not
independently re-read) for `bookings`/`services`/`availability_slots`; no
RLS-level cross-tenant integration test was found, only an
application-layer contract test (`businessRuntimeContract.test.ts`).

## 5. Approved preview -> publish -> matching revision, navigation, data, intents, and actions in production

**Status:** Partial, one specific gap fixed — 2026-08-13. The published
site's own runtime adapter (`publishedActionRuntimeModule.ts`) was already
correctly wired to `site-runtime`. The builder's *internal* preview overlay
(`PreviewOverlayManager.tsx`) used a different dispatcher
(`intentRouter.ts`) that force-routed `booking.create` to the wrong
transport and got a confusing 409 — fixed in commit `79cf0c06` (now returns
an honest message instead of a technical error; it still does not perform
a real booking from that overlay, since the overlay's simple form cannot
supply the `componentId`/`slot`/`serviceId`/`slotId` contract `site-runtime`
requires). Full adapter/router parity across Sandpack preview, external
preview, Docker preview, and production has not been assessed.

## 6. Agency owner/staff/client -> only explicitly assigned businesses, projects, and operations are visible

**Status:** Unknown — not assessed this cycle.

## Pattern warning (record before trusting any "broken" finding)

Three separate times in the 2026-08-13 session, a component that looked
broken or disconnected turned out to be a legacy/unused parallel path, not
the real production one:

1. `src/sections/PageRenderer.tsx` — legacy template-gallery codegen, not
   the real Wizard page renderer.
2. `IntentBookingForm.tsx` — unused functional-block, not the real
   generated booking form.
3. The `intent-exec` 409 for `booking.*` — intentional, tested hardening,
   not a regression; the actual bug was one narrow client dispatcher
   (`intentRouter.ts`) not respecting the already-correct canonical handler
   declaration.

**Before calling anything a regression in this repo:** grep
`src/test/**/*.test.ts` for existing assertions about the exact
files/behavior in question. This codebase has unusually thorough
source-string contract tests (see
`src/test/launchBusinessRuntimePersistence.test.ts`) that often already
encode the *intended* architecture and can immediately disprove a wrong
hypothesis before any code changes are made.
