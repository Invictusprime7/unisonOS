# 21st Equivalence Migration, then Expansion

## Objective (as I understand it)
1. Bring every section design and every registry entry up to 21st-equivalent standard (real 21st provenance, approved certification, portable recipe, `preferred` status).
2. Only after equivalence is proven, delete the generic/legacy designs and the legacy rendering path.
3. Then expand the design library, making full use of the 49 installed UI components recorded in `DESIGNS/design.json`.

Yes, this is clear. I agree with the direction, with three corrections below.

## Where things actually stand
- 92 registered section designs. 36 carry 21st provenance, 31 are certified approved, 35 are marked `preferred`.
- So roughly 56 designs are still generic/legacy and cannot be generated into sites today.
- A second, older rendering path still exists: 15 hand-written section components (`src/sections/components/*`) wired through `src/sections/registry.ts`, separate from the variant registry.
- `DESIGNS/design.json` lists design tokens plus `src/components/ui` (50 files). It is a manifest of UI primitives and tokens — it is not a library of finished design blocks.

## My objections / corrections
1. **Do not delete legacy before coverage is proven per family and per visual direction.** Every one of the 14 visual directions must resolve a certified design for every section family it declares. We hit exactly this failure recently ("no certified implementation for logo-cloud"). Removal must be gated by a passing coverage test, not by a date.
2. **"21st equivalence" cannot mean fabricating provenance.** With your paid yearly 21st.dev plan there is no retrieval limit, so the default for all ~56 generic designs is a genuine 21st source adaptation with real source id, author, and licence recorded. Owner-authorised adaptation stays the exception, used only where no suitable 21st source exists, and each one is recorded as such.
3. **Expansion from `design.json` is composition, not installation.** The 50 primitives already pinned and wired become the building blocks for new certified section designs; they do not themselves become section designs.

## Plan

### Phase A — Equivalence audit (no deletions)
- Emit a per-design ledger: origin, certification, portable recipe, generation status, pack usage, and the reason each design is not yet generation-eligible.
- Emit a coverage matrix: 14 visual directions x every section family, marking which families survive if legacy is removed today.
- Fail CI on any regression in that matrix.

### Phase B — Migrate to equivalence, family by family
Work families in dependency order (navbar, hero, footer first — they are compiler-owned chrome), then content families. Per design: normalise tokens, stamp canonical identity/slots/intents, add interaction and reduced-motion states, certify the portable recipe, register provenance, promote to `preferred`.

### Phase C — Retire legacy
Only families that are green in the Phase A matrix, at every visual direction:
- Remove the superseded generic variants from the variant registry.
- Collapse the older `src/sections/components/*` path into the variant registry so there is one design authority.
- Keep registry-derived Wizard pickers, art-direction packs, and coverage tests passing at each step.

### Phase D — Expansion
- Pull genuine 21st sources broadly (no retrieval cap) and grow every family's choice, prioritising the thinnest ones.
- Compose new certified designs on top of the installed primitives already pinned in the runtime.
- Every new design registers automatically through the existing registry pipeline; no new registries.

## Technical notes
Authorities stay unchanged: Variant Registry, DesignImplementationRegistry, Art Direction Packs, Artifact Registry, Wizard Registry Context. No new registries are introduced; pickers, coverage, and AI context remain projections over those owners. Every migrated design keeps real source metadata (source id, author, url, licence, derivation). Deletions land behind the coverage gate, and each phase ends with the full suite, typecheck, and preview build green.

## Before I start
Phase A is read-only and safe, so I will begin there unless you say otherwise. For 21st source retrieval I will need the account credential available to this project; if it is not already stored I will ask for it at the start of Phase B.
