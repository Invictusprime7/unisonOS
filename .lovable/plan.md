# Make Affinity build the pages the owner actually asks for

## Short answer
You do not need to keep growing a fixed page list by hand. The fixed list only knows ~12 generic page types (About, Services, Pricing, Gallery, FAQ, Contact, Book, Blog, Shop...). Words like **RSVP, Tour dates, Releases, Lineup, Schedule, Our Story, Travel, Registry, Fan sign-up** are not in it, so they are dropped and the industry pack "fills in" typical pages instead (that is the unrelated page you saw). The fix is to treat any page the owner names as a real page, and let the industry packs teach Affinity what those names mean.

## What is going wrong today (confirmed in code)
1. Page names are only picked up when they match the generic list, or when the owner writes a list of 2+ names ending in the word "pages" ("with Our Story, RSVP and Travel pages"). "An RSVP page" or "tour dates" alone is ignored.
2. The confirmed summary ("Here is the plan for your site") is only read for pages when it has a "Pages:" line. Affinity's summaries use bold bullets like "**Releases**:" / "**Tour dates**:", so nothing from them becomes a page.
3. When fewer than 2 pages were recognised, the industry pack adds its own typical pages (e.g. Lineup/Tickets/Info), which crowds out what was asked.
4. The final check correctly notices "RSVP still open" (your screenshot), but nothing creates the page — it only reports it after the fact.

## The fix
1. **Industry packs supply page vocabulary.** Each of the 8 packs already lists its typical pages; add the words owners use for them (events: RSVP, tickets, lineup, schedule, agenda; weddings: our story, RSVP, travel, registry, schedule; music: releases, discography, tour dates, shows, fan club/sign-up; etc.) and map each to a page type (RSVP → form page, Tour dates → events listing, Releases → gallery/listing).
2. **Read single named pages.** Recognise "an RSVP page", "a page for tour dates", "RSVP section/page", and "/rsvp", not just plural lists.
3. **Read Affinity's own summary bullets.** Each "**Name**:" bullet in the confirmed plan that describes a destination (releases, tour dates, RSVP) becomes a confirmed page; bullets like "Look & feel" or "Site identity" are skipped.
4. **Named pages always win.** Industry-typical pages only fill empty slots when the owner said "several pages" without naming them, and never replace or outnumber named ones.
5. **Unknown names still become pages.** Anything named but unmapped becomes its own custom page at its own address with the owner's title, instead of being dropped.
6. **Block before building, not after.** If a named page is missing from the plan, Affinity adds it before spending AI on authoring; the "still open" message remains as a last safety check.

## Checks
- New tests with real prompts: event site with RSVP; wedding with Our Story/RSVP/Travel; your 3manbeatz music prompt + confirmed summary → Releases, Tour Dates, Fan Sign-up pages; "no blog" stays excluded; generic "several pages" still uses pack suggestions.
- Re-run the existing launch-plan and industry-vertical tests.

## Technical details
- `src/services/composition/verticals/*.ts`: add `pageAliases` per pack page (alias → route/title/role); expose `matchVerticalPageAliases(text, vertical)` from `verticals/index.ts`.
- `src/services/launch/chatLaunchPlan.ts`: add single-name page extraction and summary-bullet extraction; merge vertical alias pages into `namedCreationPages`; gate `inferredPages` on "multi-page without names" only.
- `src/services/launch/creativePlan.ts` `confirmedPageNames`: accept `- **Name**:` bullets, with a skip list for non-page bullets.
- `siteTopologyPlanner.ts` alias table stays generic (no industry words); unmapped names keep using the existing `custom` role.
- Pre-author gate in the App Builder plan: every owner/confirmed page route must exist in topology before authoring starts.
- Record one rule in `src/services/AGENTS.md`: named pages come from owner/confirmed text plus pack vocabulary and are never replaced by inferred pages.
