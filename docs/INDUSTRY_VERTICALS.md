# Industry verticals

Affinity's App Builder carries deep knowledge of these kinds of businesses, each with its own sub-variants:

| Vertical | Sub-variants |
| --- | --- |
| Sports | club, fan blog / sports media, league or tournament, coaching academy |
| Flights & travel | airline, private / charter aviation, travel agency / tour operator |
| Live events & festivals | festival, conference / summit, venue / nightlife |
| Music & artists | artist / band, record label, recording studio / music school |
| Weddings | couple's wedding website, wedding planner, wedding venue |
| Fitness & gyms | gym, boutique studio, personal trainer |
| Hotels & hospitality | boutique hotel, resort / lodge / retreat, guesthouse / holiday rental |
| Photography & film | wedding & portrait, commercial / editorial, film / video production |

## What a pack holds

`src/services/composition/verticals/<id>.ts`, data only:

- keywords that identify the trade and each sub-variant
- trade vocabulary, content objects (with labelled sample shapes), and the proof visitors trust
- signature interactive experiences: a brief, the certified families that can host them, a suggested original component name, and whether live-looking data needs a sample label
- typical pages per sub-variant, used only when the owner asks for several pages without naming them (marked `inferred`)
- imagery, motion and design-ranking terms, honesty rules
- composition profiles per page role. These are checked against page archetypes for many seeds.

## How it is used

1. The chat plan reads the vertical from the owner's words (`resolveIndustryVertical`). A tie goes to the later mention, so a "wedding photographer" reads as photography blended with weddings. It then:
   - turns any trade phrases the owner used ("seat map", "RSVP", "class timetable") into `req:interaction:*` requirements
   - fills in the typical pages only when the owner asked for several pages but didn't name them
2. The App Builder uses the vertical's composition profiles whenever the build's industry has no dedicated profiles of its own.
3. Design retrieval ranks certified designs with the vertical's design terms, inside the sealed registry only.
4. Each page brief includes an `INDUSTRY KNOWLEDGE` block (about 2.5 KB). The owner's prompt and requirements always win over it.
5. Coverage counts any of the pack's phrasings as evidence that an experience was built. It also requires live-looking data to carry a sample label, and lists original site-local modules as **library promotion candidates**.

A vertical never provisions capabilities, adds claims, or changes the canonical industry matrix.

## New designs: per site now, library later

When a vertical needs a design the Unison library lacks, Affinity writes an original module under `/src/project-components/<vertical>/` for that site. The modules that keep recurring get added to the Unison Design System project and published there. They are never copied into the managed design-system folder of a client project.

## Adding a vertical

1. Copy an existing pack file, fill in every field, and add it to `VERTICAL_PACKS` in `index.ts`.
2. Run `src/test/industryVerticals.test.ts`. The integrity test and the legal-composition test cover every pack automatically. Add a detection case for each sub-variant.
