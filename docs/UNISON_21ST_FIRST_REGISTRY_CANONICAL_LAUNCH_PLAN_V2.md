# UNISON — 21st-First Registry Reunification, Visual Composition & Canonical Launch Plan

> **SUPERSEDED FOR FRESH-LAUNCH AUTHORITY (2026-09-30):** Retain this document as registry and certification history. [App Builder Canonical Substitution](milestones/UNISON_APP_BUILDER_CANONICAL_SUBSTITUTION_MILESTONE_2026-09-30.md) replaces its optional enrichment over a deterministic Stage 4b website with one App Builder-authored application candidate before revision 1.

## Current Wizard AI policy ? user clarification, 2026-09-17

AI composition is OPTIONAL for new Wizard generation. A missing, invalid or incomplete composition degrades the launch with a visible note and Stage 4b compiles the deterministic Design Intervention for the selected industry layout. AI improves quality but is never an availability risk. The template-free Wizard remains unchanged.

Stage 4b compiles and validates the accepted AI plan using canonical registered implementations. A successful plan does not skip Lane B. Lane B receives that plan as bounded context and may propose registered page-body TSX; only validation, canonical merge, preflight and commitMutation may promote it. Rejected or unavailable refinements preserve the already validated AI-composed pages. Global theme, routes, protected foundation files, intents and commit ownership stay canonical.

This user clarification overrides V3 sections 3/5/24/28 where they propose optional composition or deterministic launch without AI. V3 is retained as a reference plan; its embedded execution prompt is not an independent instruction. Refinement can be disabled through the launch-service policy for diagnostics; composition cannot. Both composition and refinement consume bounded projections derived from Unison's canonical registries; neither receives an unfiltered global registry.

**Version:** 2.0  
**Status:** Canonical implementation plan / VS Code AI coding prompt  
**Revises:** `UNISON_REGISTRY_VISUAL_COMPOSITION_CANONICAL_LAUNCH_PLAN.md`  
**Target branch reviewed:** `unison-tasks-official-feat-richer-industry-compositions`  
**Primary objective:** Make 21st.dev the sole external design-reference/source ecosystem for Unison while preserving the current Launch Wizard, canonical pipeline, business semantics, `SiteBundleSnapshot`, artifact/data contracts, Stage 4b theme authority, and canonical VFS commit model.

---

# 0. Executive Decision

Unison will **not replace its platform architecture with 21st.dev**.

Unison will instead replace and consolidate its weak, inconsistent visual implementation layer with **approved, normalized, certified 21st-derived source implementations**.

The architecture rule is:

> **21st.dev is the sole external design-source ecosystem. Unison remains the runtime, semantic, business, artifact, registry, compilation, persistence, and canonical VFS authority.**

21st is used at **development / ingestion time**, not as a required customer-launch runtime.

The intended relationship is:

```text
21st.dev
   │
   │  development-time source/reference
   ▼
21st Intake + Compatibility Audit
   │
   ▼
Unison Token / Dependency / Runtime Normalization
   │
   ▼
Certified Unison Source Implementation
   │
   ├── Generated UI Foundation primitive
   └── Section Variant implementation
            │
            ▼
      Variant Registry
            │
            ▼
DesignImplementationRegistry
            │
            ▼
     ArtDirectionPacks
            │
            ▼
WizardRegistryAggregation
            │
            ▼
       Launch Wizard
            │
            ▼
 Stage 4b Canonical Compile
            │
            ▼
    SiteBundleSnapshot
            │
            ▼
    Lane B Enrichment
            │
            ▼
 Candidate VFS Patch
            │
            ▼
 Canonical Validation/Merge
            │
            ▼
     commitMutation()
            │
            ▼
       CANONICAL VFS
            │
   Preview / Playground / Publish
```

Do **not** introduce:

- a `TwentyFirstRuntimeRegistry`
- a 21st-specific template engine
- a live 21st dependency in generated sites
- a 21st-specific VFS writer
- a second theme engine
- a second motion engine
- a second artifact model
- a second Launch Wizard
- a second page topology system

The goal is **convergence**, not another layer.

---

# 1. Why This Revision Is Necessary

The current branch already has a sophisticated canonical architecture, but the visual design path remains inconsistent because several visual systems are only partially executable.

The highest-value finding is:

> **Unison currently has more visual registry concepts than it has visual implementations that can actually survive into canonical Launch VFS.**

That means adding more design vocabulary or AI prompting without fixing execution parity will continue producing disappointing launches.

The order must therefore change.

Before mass-ingesting 21st components:

1. make registered visual variants truly materialize into canonical VFS
2. remove parallel / duplicated visual authorities
3. create a safe 21st intake and certification path
4. repopulate existing Unison visual registries with certified 21st-derived implementations
5. pass that real executable universe to the Launch Wizard and Lane B

---

# 2. Real Current Unison Files That Must Remain Canonical

The following existing files/systems should remain core owners.

## Launch orchestration

```text
src/components/onboarding/wizard/LauncherWizard.tsx
src/services/launch/launchOrchestrator.ts
src/services/launch/wizardRegistryAggregation.ts
```

## Canonical platform

```text
src/platform/core/canonicalPipeline.ts
src/services/canonicalLaunchVfs.ts
src/services/vfsCommitService.ts
```

## Semantic / business registry owners

```text
src/platform/core/artifactRegistry.ts
src/platform/core/catalogSurfaceRegistry.ts
src/platform/core/intentSurfaceRegistry.ts
src/platform/core/capabilityRegistry.ts
```

## Visual/design owners

```text
src/platform/core/designVocabulary.ts
src/platform/core/generatedUiFoundation.ts

src/sections/registry.ts
src/sections/variants/types.ts
src/sections/variants/registry.ts
src/sections/variants/artDirectionPacks.ts
src/sections/variants/*
src/sections/templates/*
```

## Derived implementation / AI owners

```text
src/services/designImplementationRegistry.ts
src/services/wizardLaneBEnrichment.ts
src/services/wizardInteractionEnrichment.ts
src/services/laneBBatchPlanner.ts
```

These systems should be **extended and consolidated**, not replaced.

---

# 3. Current 21st Integration Is Metadata-Only

The current repository contains:

```text
DESIGNS/design.json
DESIGNS/DESIGN.md
```

However, `DESIGNS/design.json` currently declares only:

```json
"sources": {
  "tokens": [
    "src/index.css",
    "src/app.css"
  ],
  "components": [
    "src/components/ui"
  ],
  "assets": [],
  "instructions": []
}
```

That means 21st currently sees:

- base tokens
- ordinary `src/components/ui` primitives

It does **not** represent the actual Launch Wizard visual-generation architecture:

```text
src/sections/variants/*
src/sections/variants/artDirectionPacks.ts
src/platform/core/generatedUiFoundation.ts
src/platform/core/designVocabulary.ts
src/platform/core/artifactRegistry.ts
src/services/designImplementationRegistry.ts
src/services/launch/wizardRegistryAggregation.ts
```

Therefore the current `DESIGNS` directory must not be mistaken for a functioning Wizard integration.

It is a starting point for intake/design context only.

---

# 4. 21st Design Source Policy

Add this as a permanent architectural policy:

> ## 21st Design Source Policy
>
> 21st.dev is the sole external UI design-reference/source ecosystem for Unison's generated website pipeline.
>
> Unison does not dynamically depend on 21st.dev during customer launches.
>
> Approved 21st components and patterns are ingested during development, reviewed for source/license/dependency compatibility, normalized into Unison's theme/runtime contracts, and registered as first-class Unison implementations.
>
> The Launch Wizard, Design Intervention, Art Direction Packs and Lane B consume only **approved internal Unison implementations with optional 21st provenance**.
>
> AI may compose and enrich those implementations, but all generated output must continue to satisfy canonical topology, artifact, intent, binding, theme, dependency, snapshot, and VFS commit contracts.

Do not treat:

```text
visible on 21st
```

as equivalent to:

```text
approved for Unison redistribution/runtime
```

Every imported source needs provenance metadata.

---

# 5. Do Not Replace the Entire Unison Registry System

The registry architecture itself is useful.

The primary problem is not that Unison has registries.

The problem is:

- overlapping visual authorities
- registry concepts that do not materialize to VFS
- manually duplicated capability lists
- separate React and string implementations
- stale intent/layout assumptions
- too much design vocabulary without enough executable implementations

The correct strategy is:

```text
KEEP canonical registry contracts
+
RETIRE duplicate visual inspiration systems
+
REPOPULATE visual implementations with certified 21st-derived source
+
MAKE every implementation executable through canonical VFS
```

---

# 6. Program A — Fix Variant → VFS Convergence First

This is the most important precondition.

## 6.1 Current disconnect

`src/sections/variants/registry.ts` contains many visual variants.

However, the portable recipe path is not equally implemented across section families.

The current recipe generation file:

```text
src/sections/recipes/stylexRecipes.generated.json
```

is currently centered heavily on Gallery-family recipe output.

And:

```text
src/sections/compositionToFileSet.ts
```

has explicit Gallery registered-variant resolution while many other families continue to rely on hard-coded generated modules such as:

```text
HERO_MODULE
SERVICES_MODULE
FEATURES_MODULE
PRICING_MODULE
CTA_MODULE
CONTACT_MODULE
```

This produces a dangerous situation:

```text
Beautiful registered React Hero
          │
          ▼
Variant Registry says "available"
          │
          ▼
Art Direction chooses it
          │
          ▼
canonical VFS still emits generic HERO_MODULE
```

That makes the registry appear wired while the generated site remains generic.

## 6.2 Required architecture

All major visual families must converge on one execution path.

Target:

```text
SectionVariant React source
        ↓
portable recipe certification
        ↓
recipe compiler / generated family module
        ↓
REGISTERED_VARIANTS[variantId]
        ↓
compositionToFileSet
        ↓
canonical VFS
```

Required families:

```text
navbar
hero
about
services
features
pricing
gallery
testimonials
stats
cta
contact
footer
logo-cloud
blog-preview
before-after
```

Do not mass-import 21st implementations until these families can actually survive this path.

## 6.3 Exit condition

For every preferred visual implementation:

```text
Wizard preview implementation
=
canonical VFS implementation
=
WebBuilder Preview implementation
=
published runtime implementation
```

No visual implementation should exist only in registry metadata.

---

# 7. Program B — Remove Double-Authored Variant Implementations

Current `src/sections/variants/types.ts` requires both:

```ts
component: ComponentType<...>;
renderJSX: (...) => string;
```

This means a visual variant can have:

```text
React implementation
+
separate string generator
```

That becomes unsustainable with sophisticated 21st-derived components.

## 7.1 Target schema

Move toward:

```ts
export interface SectionVariant {
  id: VariantId;
  sectionType: SectionType;

  component: ComponentType<any>;

  source?: VisualSourceMetadata;

  generationStatus?:
    | 'preferred'
    | 'legacy'
    | 'disabled';

  vocabulary?: VocabularyRef;
  vocabularyRefs?: readonly VocabularyRef[];

  vfs?: {
    mode: 'portable-recipe';
    certification?: 'approved';
  };

  radixPrimitives?: readonly RadixPrimitiveId[];
  runtimeDependencies?: readonly string[];

  /** Legacy only during migration. */
  renderJSX?: (content: ExtractedSectionContent) => string;
}
```

## 7.2 Migration rule

New 21st-derived components:

- must use one real React implementation
- must compile through portable recipe infrastructure
- must not require a second hand-maintained `renderJSX`

`renderJSX` remains temporarily only for compatibility with legacy variants.

## 7.3 Refactor `sectionSwapper.ts`

Do not insert generated JSX strings as the long-term variant switching method.

Target:

```text
visual variant change
    ↓
activeVariants / canonical artifact mutation
    ↓
canonical recompile
    ↓
VFSCommitService
```

This makes visual editing compatible with the same implementation IDs used by the Launch Wizard.

---

# 8. Program C — Create a Dedicated 21st Intake Layer

Do **not** install arbitrary 21st components directly into:

```text
src/components/ui
```

That directory already contains core shadcn primitives and is not an appropriate quarantine boundary.

Create:

```text
src/design/21st-intake/
```

Recommended structure:

```text
src/design/21st-intake/
├── README.md
├── manifest.ts
├── componentIntake.ts
├── compatibilityAudit.ts
├── dependencyResolver.ts
├── tokenAdapter.ts
├── sourceNormalizer.ts
├── provenance.ts
└── imported/
```

This is not a runtime registry.

It is a development-time adaptation area.

---

# 9. 21st Component Intake Record

Create a provenance/adaptation record.

Example:

```ts
export interface TwentyFirstComponentRecord {
  sourceId: string;

  name: string;
  author?: string;
  sourceUrl?: string;

  sourceType:
    | 'component'
    | 'block'
    | 'template'
    | 'effect'
    | 'background'
    | 'navigation';

  dependencies: string[];
  registryDependencies: string[];

  license?: string;
  attribution?: string;

  designTags: string[];

  capabilities: {
    motion: boolean;
    threeD: boolean;
    media: boolean;
    forms: boolean;
    carousel: boolean;
  };

  compatibility: {
    react19: boolean;
    tailwind3: boolean;
    vite: boolean;
    clientOnly: boolean;
  };

  adaptation: {
    tokensNormalized: boolean;
    importsNormalized: boolean;
    reducedMotionSupported: boolean;
    responsiveVerified: boolean;
    canonicalSlotsAdded: boolean;
    intentReady: boolean;
    portableRecipeCertified: boolean;
  };

  implementationId?: string;
}
```

The runtime should not need this object to render the site.

It exists for:

- provenance
- audit
- adaptation
- debugging
- licensing traceability
- registry generation

---

# 10. 21st Intake Lifecycle

Every 21st source should follow this lifecycle.

## Step 1 — Discover / preview

Identify a useful 21st implementation.

Classify it as:

```text
primitive
section
effect
composition
template reference
```

## Step 2 — Quarantine import

Place source under:

```text
src/design/21st-intake/imported/<slug>/
```

Do not register yet.

## Step 3 — Dependency audit

Compare required dependencies against Unison's real stack.

Current preferred baseline:

```text
React 19
Tailwind v3
Framer Motion
Radix
Lucide
Embla
CVA
clsx
tailwind-merge
```

Capability-gated:

```text
three
@react-three/fiber
@react-three/drei
```

Adapt/reject by default:

```text
Next.js runtime APIs
next/image
server-only APIs
Tailwind-v4-only assumptions
second animation frameworks
second carousel engines
duplicate icon libraries
duplicate dialog/focus systems
global CSS frameworks
```

A registry install is never automatically approved simply because dependencies resolve.

## Step 4 — Import normalization

Replace infrastructure imports with Unison facades where relevant.

Examples:

```text
direct framer-motion usage in generated runtime
→ @/unison/ui/animation where required

direct runtime icons
→ approved icon facade / Lucide policy

raw behavior primitives
→ approved Radix / Unison behavior wrapper when required
```

## Step 5 — Theme normalization

Convert:

```text
foreign color literals
foreign radius systems
foreign spacing tokens
foreign type scales
```

into:

```text
Stage 4b semantic variables
Art Direction tokens
generated UI foundation contracts
```

Preserve beautiful geometry.

Do not preserve foreign theme authority.

## Step 6 — Canonical identity

Add stable Unison identity where appropriate:

```text
data-ut-section-id
data-ut-artifact
data-ut-implementation
data-ut-slot
data-ut-intent
```

## Step 7 — Accessibility / responsive audit

Verify:

- reduced motion
- keyboard behavior
- focus behavior
- heading semantics
- overflow
- mobile layout
- image alt contract
- touch target size

## Step 8 — Portable VFS certification

The component is not Launch-Wizard-ready until:

```text
vfs.mode = portable-recipe
vfs.certification = approved
```

and the canonical Launch VFS can actually render it.

## Step 9 — Promote to canonical family

Move the adapted implementation to the appropriate canonical location.

Example:

```text
src/sections/variants/hero/HeroKineticTech.tsx
```

Register it in:

```text
src/sections/variants/registry.ts
```

From this point onward:

> It is a Unison implementation with 21st provenance.

The Launch Wizard should not special-case it.

## Step 10 — Delete intake duplicate

Avoid keeping a second active copy once promotion is complete.

---

# 11. Add Source / Generation Metadata to `SectionVariant`

Extend the existing schema additively.

Recommended:

```ts
export interface VisualSourceMetadata {
  origin:
    | 'unison'
    | '21st';

  sourceId?: string;
  sourceUrl?: string;
  author?: string;
  license?: string;

  importedAt?: string;
  adaptationVersion?: string;
}

export interface SectionVariant {
  // existing fields

  source?: VisualSourceMetadata;

  generationStatus?:
    | 'preferred'
    | 'legacy'
    | 'disabled';

  vocabulary?: VocabularyRef;

  vocabularyRefs?: readonly VocabularyRef[];

  vfs?: {
    mode: 'portable-recipe';
    certification?: 'approved';
  };

  runtimeDependencies?: readonly string[];
}
```

Do not include `21st` in implementation IDs.

Prefer:

```text
hero:kinetic-tech
hero:editorial-collage
hero:floating-media
```

not:

```text
hero:21st-kinetic
```

The source metadata records provenance.

---

# 12. Do Not Delete Existing Weak Variants Immediately

Persisted projects may reference current IDs.

Use migration status.

Example:

```ts
generationStatus: 'legacy'
```

Then:

- existing snapshots can continue resolving the implementation
- new Wizard generations exclude it from preferred selection
- migration tools can later replace it safely

Use:

```text
preferred
legacy
disabled
```

Semantics:

### preferred

Eligible for new Wizard generation and Lane B recommendation.

### legacy

Resolvable for old projects but excluded from new generation unless explicitly requested.

### disabled

Known historical implementation; not renderable for normal generation.

---

# 13. Program D — Repopulate Existing Visual Registries From 21st

Do not make 21st a new registry.

Use 21st source to improve the existing:

```text
Variant Registry
DesignImplementationRegistry
ArtDirectionPacks
DesignVocabulary
Generated UI Foundation
```

21st should populate four layers.

## 13.1 Primitive inspiration

Examples:

```text
animated border
spotlight
magnetic interaction
image reveal
parallax image
animated grid
marquee
shader background
cursor interaction
floating frames
```

After normalization, these become canonical Unison primitives.

## 13.2 Section implementations

Examples:

```text
hero
features
pricing
gallery
testimonials
navigation
logo cloud
CTA
FAQ
stats
team
footer
```

These become `SectionVariant` implementations.

## 13.3 Composition grammar

Some 21st blocks should be used as composition references rather than imported whole.

Extract:

```text
monumental type
asymmetric media
floating labels
moving proof
sticky narrative
horizontal rail
alternating canvas
```

Represent the grammar through Design Vocabulary / Art Direction metadata.

## 13.4 Template references

Use full templates sparingly.

A 21st template may inspire:

```text
page rhythm
hero family
navigation family
surface strategy
media treatment
motion profile
```

but must not replace Unison's canonical industry/page/business architecture.

---

# 14. Program E — Close the Design Vocabulary Execution Gap

Current:

```text
src/platform/core/designVocabulary.ts
```

contains far more vocabulary than the executable implementation registry currently proves.

Do not add another vocabulary for 21st.

Use 21st-derived implementations to make existing vocabulary real.

Example:

```text
21st-derived visual source
        ↓
normalize
        ↓
hero:kinetic-tech
        ↓
vocabularyRefs:
  hero:kinetic-type
  background:glow-field
  motion:mask-reveal
        ↓
portable VFS certified
        ↓
those vocabulary entries become executable
```

The desired progression is:

```text
conceptual vocabulary
→ approved implementation
→ executable vocabulary
```

Never tell Lane B that a vocabulary entry is usable until an actual certified implementation supports it.

---

# 15. Expand `vocabularyRefs`

A sophisticated implementation often represents several visual concepts.

Keep legacy:

```ts
vocabulary?: VocabularyRef;
```

Add:

```ts
vocabularyRefs?: readonly VocabularyRef[];
```

Example:

```ts
{
  id: 'hero:kinetic-tech',

  vocabularyRefs: [
    { category: 'hero', id: 'kinetic-type' },
    { category: 'background', id: 'animated-grid' },
    { category: 'background', id: 'glow-field' },
    { category: 'motion', id: 'mask-reveal' },
  ],
}
```

Update:

```text
src/services/designImplementationRegistry.ts
```

to index both.

---

# 16. Fix Lane B Design Vocabulary Reporting

In:

```text
src/services/launch/launchOrchestrator.ts
```

do not attempt to derive vocabulary directly from `activeVariants` string values.

Use:

```ts
import {
  vocabularyExecutabilityReport,
} from '@/services/designImplementationRegistry';

const report = vocabularyExecutabilityReport();

const designVocabularyReport = {
  executableIds: report.executable,
  unimplementedIds: report.unimplemented,
};
```

This ensures Lane B receives real implementation availability.

---

# 17. Program F — Remove Parallel Visual Inspiration Authorities

21st is now the sole external design source.

That means older hand-authored inspiration systems should not continue competing with it.

## 17.1 `src/data/siteElementsLibrary/*`

This system currently acts as an AI site-element inspiration/resolver catalog.

It should no longer be a primary visual inspiration authority.

### Migration

Replace design-oriented prompt output from:

```text
siteElementsLibrary
```

with a projection generated from:

```text
DesignImplementationRegistry
+
ArtDirectionPacks
+
DesignVocabulary
+
21st provenance metadata
+
WizardRegistryContext
```

Once all consumers have migrated:

```text
siteElementsLibrary
```

should be deleted or reduced to a compatibility shim.

Do not leave it feeding a second independent design universe to `AIBuilderPanel`.

---

# 18. Refactor `componentIntelligenceRegistry.ts`

Do not delete the whole file immediately.

`canonicalPipeline.ts` still benefits from semantic composition intelligence such as:

- required content structure
- component ordering
- max instances per page
- industry suitability
- responsive semantics

However, this file currently also contains visual assumptions and stale behavior vocabulary.

## 18.1 Keep here

```text
prop semantics
required semantic fields
composition rules
max per page
can be first / last
industry suitability
responsive semantic requirements
```

## 18.2 Move out

Visual layout options such as:

```text
centered
split
full-bleed
grid
list
```

should no longer define the ceiling of possible design.

Visual implementation options belong to:

```text
DesignImplementationRegistry
ArtDirectionPacks
21st-derived Variant metadata
```

## 18.3 Remove stale intent ownership

Intent contracts must derive from:

```text
src/platform/core/intentSurfaceRegistry.ts
```

not independent hard-coded strings such as older `nav.goto_page`, `calendar.open`, etc.

---

# 19. Program G — Unify Generated UI Foundation Inventory

`src/platform/core/generatedUiFoundation.ts` should be the canonical runtime primitive owner.

It must expose one real inventory.

## 19.1 Current problem

Different helper functions currently describe different subsets of the motion primitive API.

That creates contradictory AI instructions.

## 19.2 Required change

Export inventories directly.

Example:

```ts
export const GENERATED_MOTION_PRIMITIVES = [
  'Reveal',
  'RevealGroup',
  'Stagger',
  'StaggerGroup',
  'StaggerItem',
  'MotionRecipe',
  'MarqueeBand',
  'HorizontalRail',
  'HoverDepth',
  'ImageReveal',
  'ParallaxMedia',
  'MaskReveal',
  'MotionImage',
] as const;

export const GENERATED_BACKGROUND_PRIMITIVES = [
  'OrbitalBackdrop',
  'GlowField',
  'AnimatedGrid',
  'NoiseField',
  'GradientOrbs',
  'MediaCanvas',
] as const;

export const GENERATED_NAVIGATION_PRIMITIVES = [
  'FloatingNavbar',
  'StandardNavbar',
] as const;
```

Then generate:

- manifests
- prompt directives
- Wizard registry context
- validation allowlists

from these constants.

The registry aggregator must not duplicate these values.

---

# 20. Background / Motion Primitive Expansion

Use 21st as the inspiration/source pool, but normalize all promoted primitives through Unison.

Recommended canonical additions:

```text
OrbitalBackdrop
GlowField
AnimatedGrid
NoiseField
GradientOrbs
MediaCanvas
MarqueeBand
HorizontalRail
HoverDepth
ImageReveal
ParallaxMedia
MaskReveal
MotionImage
```

Do not add another motion library by default.

Keep:

```text
Framer Motion
```

as the ordinary DOM animation runtime.

Keep immersive 3D behind:

```text
@/unison/ui/experience
```

and existing capability gating.

---

# 21. Typography Expansion

Add a true hero display role.

Example:

```ts
type HeadingSize =
  | 'hero'
  | 'display'
  | 'title'
  | 'subtitle';
```

Stage 4b should emit:

```css
--ut-type-hero
```

The theme pipeline owns the numeric scale.

A visual implementation may request:

```tsx
<Heading level={1} size="hero">
```

but may not invent an unrelated type system.

---

# 22. High-Quality 21st-Derived Implementation Families

Prioritize reusable families, not hundreds of unrelated components.

## Hero

```text
hero:kinetic-tech
hero:oversized-editorial
hero:editorial-collage
hero:split-cinematic
hero:layered-product
hero:marquee-media
hero:floating-media
hero:asymmetric-story
```

## Navigation

```text
navbar:floating-tech
navbar:glass-pill
navbar:minimal-dark
navbar:editorial
navbar:mega-menu
```

## Services / features

```text
services:asymmetric-bento
services:horizontal-rail
services:editorial-list
services:sticky-feature
features:spotlight-grid
features:scroll-story
```

## Gallery / portfolio

```text
gallery:masonry
gallery:lookbook
gallery:filmstrip
gallery:stacked
gallery:parallax
gallery:cinematic-grid
```

## Social proof

```text
testimonials:marquee
testimonials:spotlight
testimonials:editorial-quotes
logos:grid
logos:marquee
logos:brand-lockup
stats:kinetic-band
```

## Conversion

```text
cta:oversized-statement
cta:marquee-band
cta:split-media
cta:floating-panel
```

Every implementation must have:

- stable implementation ID
- 21st provenance if applicable
- `generationStatus`
- executable vocabulary references
- approved dependencies
- Stage 4b token normalization
- portable VFS certification
- canonical slot identity
- required intent compatibility
- Preview compatibility
- responsive verification

---

# 23. Art Direction Packs Become Curated 21st-Derived Design Systems

Do not randomly mix beautiful components.

21st contains many stylistic languages.

Unison's existing:

```text
src/sections/variants/artDirectionPacks.ts
```

should become the curation layer that creates coherent families.

Example:

```text
glass-tech
├── navbar:floating-tech
├── hero:kinetic-tech
├── features:spotlight-grid
├── services:horizontal-rail
├── gallery:filmstrip
├── testimonials:marquee
└── cta:floating-panel
```

versus:

```text
editorial
├── navbar:editorial
├── hero:oversized-editorial
├── services:editorial-list
├── gallery:lookbook
├── testimonials:editorial-quotes
└── cta:oversized-statement
```

A pack should contain only certified implementation IDs.

Add tests:

```text
every ArtDirectionPack implementation ID resolves
every preferred implementation is portable-VFS certified
no disabled implementation is referenced
```

---

# 24. Real First-Class Sections Only

If `src/sections/registry.ts` exposes:

```text
logo-cloud
blog-preview
before-after
```

those should not secretly render unrelated generic section implementations.

Create real first-party components and variants.

Minimum:

```text
logo-cloud:grid
logo-cloud:marquee
logo-cloud:brand-lockup

blog-preview:editorial
blog-preview:featured-grid
blog-preview:horizontal-rail

before-after:slider
before-after:grid
before-after:case-study
```

21st can provide source inspiration or implementations.

But after certification these are normal Unison variants.

---

# 25. Program H — Artifact / Catalog / Asset Separation

Do not merge visual registries with business-data registries.

Keep these authorities distinct.

| System | Owns |
|---|---|
| `catalogSurfaceRegistry` | persistent business row surfaces |
| `artifactRegistry` | semantic website artifact contracts |
| `designVocabulary` | visual/composition language |
| `DesignImplementationRegistry` | executable section implementations |
| `generatedUiFoundation` | reusable runtime primitives |
| `AssetRegistry` | media identity and metadata |
| 21st intake | development-time source/provenance only |

They are **aggregated**, not collapsed.

---

# 26. Catalog Surface Expansion Policy

Do not create catalog surfaces for decoration.

Potential future business surfaces:

```text
team
faqs
partners / clients
articles / posts
brand media
business metrics
locations
events
```

A new surface requires:

1. canonical persistence source
2. field contract
3. Business Center editor
4. aliases
5. display mapping
6. intent support where appropriate
7. readiness threshold
8. fallback policy
9. hydration support
10. auto-emitted site binding

Decorative 21st effects such as:

```text
orbital background
shader
marquee animation
glow field
parallax treatment
```

never belong in `catalogSurfaceRegistry`.

---

# 27. Asset Registry → Wizard Wiring

Add media availability to the Wizard's bounded registry context.

Example:

```ts
interface WizardRegistryAssetSummary {
  assetId: string;
  kind: string;
  tags: readonly string[];
  width?: number;
  height?: number;
  aspectRatio?: string;
  dominantColor?: string;
}
```

Lane B should prefer:

```text
registered business assets
```

before inventing remote imagery.

21st source components that assume remote/demo image URLs must be normalized before promotion.

---

# 28. Wizard Registry Context v2

Extend:

```text
src/services/launch/wizardRegistryAggregation.ts
```

into the single bounded view of the executable design universe.

Recommended:

```ts
interface WizardAggregatedRegistryContext {
  version: '2.0';

  generatedAt: string;

  industry: string;
  templateId: string;
  themePresetId: string;
  artDirectionPackId?: string;

  designRegistrySignature: string;

  sections: WizardRegistrySectionSummary[];

  implementations: Array<{
    implementationId: string;
    sectionType: string;
    name: string;
    tags: readonly string[];
    sourceOrigin: 'unison' | '21st';
    generationStatus: 'preferred' | 'legacy' | 'disabled';
    vocabularyRefs: readonly string[];
    vfsMode?: string;
    certified: boolean;
    radixPrimitives?: readonly string[];
    runtimeDependencies?: readonly string[];
  }>;

  artifacts: WizardRegistryArtifactSummary[];

  catalogSurfaces: WizardRegistryCatalogSurfaceSummary[];

  designVocabulary: {
    executable: string[];
    unimplemented: string[];
  };

  primitives: {
    composition: readonly string[];
    motion: readonly string[];
    background: readonly string[];
    navigation: readonly string[];
    experience: readonly string[];
  };

  assets: WizardRegistryAssetSummary[];

  approvedCapabilities: readonly string[];

  motionProfile?: string;
  interactionProfile?: string;
}
```

Filter this context to:

- selected industry
- selected template
- selected Art Direction Pack
- selected capabilities

Do not send the entire global catalog to Lane B if unnecessary.

---

# 29. Lane B Must Receive the Real Registry Context

Update:

```text
src/services/wizardLaneBEnrichment.ts
```

Add a bounded registry context to:

```ts
WizardLaneBEnrichmentRequest
```

Example:

```ts
registryContext: WizardLaneBRegistryContext;
```

Lane B must not reconstruct implementation availability from prose.

It should receive:

```text
available certified implementations
executable vocabulary
available primitives
available assets
allowed runtime dependencies
required artifact bindings
required intents
```

---

# 30. Fix Lane B Validator for Modern 21st-Derived React

Do not require generated TSX to contain:

```text
import React from 'react'
```

Modern React JSX runtime does not require that import.

Replace simplistic string heuristics with actual parsing/AST validation where practical.

## 30.1 Import validation

Validate:

```text
approved package/import source
approved generated runtime facades
no protected infrastructure imports
```

Do not validate by requiring a literal `React` token.

## 30.2 Theme compliance

The current architecture should continue preventing foreign visual systems from overriding Stage 4b.

However, avoid overly broad rules that reject every arbitrary occurrence of:

```text
px
rem
vh
vw
```

without context.

Better:

```text
21st intake certification
→ normalize foreign geometry / theme
→ approve implementation
```

Then Lane B mostly composes certified implementations and semantic tokens.

Page-level freeform geometry should be validated with targeted rules, not an indiscriminate text search.

---

# 31. Lane B Authority

Lane B may author **candidate VFS page bodies**.

It is not canonical simply because AI returned code.

Flow:

```text
Lane B proposal
     ↓
decode
     ↓
schema validation
     ↓
wizard identity validation
     ↓
snapshot signature validation
     ↓
protected-path gate
     ↓
registered-page gate
     ↓
import/dependency gate
     ↓
TSX parse/type preflight
     ↓
theme contract gate
     ↓
intent gate
     ↓
binding/artifact gate
     ↓
canonical merge
     ↓
strict final preflight
     ↓
commitMutation()
     ↓
canonical VFS revision
```

Preserve:

```text
src/services/wizardLaneBEnrichment.ts
```

as the policy owner.

Do not return to old raw System Launcher VFS authority.

---

# 32. Lane B Design Prompt Policy

Lane B should no longer receive vague requests such as:

```text
"make it premium"
```

It should receive a real certified design inventory.

Example context:

```text
AVAILABLE CERTIFIED IMPLEMENTATIONS

Hero:
- hero:kinetic-tech
- hero:editorial-collage
- hero:floating-media

Navigation:
- navbar:floating-tech
- navbar:glass-pill
- navbar:editorial

Features:
- features:spotlight-grid
- services:asymmetric-bento
- services:horizontal-rail

Gallery:
- gallery:filmstrip
- gallery:masonry
- gallery:lookbook

Background:
- OrbitalBackdrop
- AnimatedGrid
- GlowField
- GradientOrbs

Motion:
- MaskReveal
- ImageReveal
- HorizontalRail
- MarqueeBand
- HoverDepth
```

Instruction:

> Compose freely within registered page bodies using only certified registry implementations, approved primitives, semantic Stage 4b theme tokens, and approved runtime dependencies. Do not invent an unregistered component when an approved implementation satisfies the role.

Lane B may still author custom DOM geometry and Framer Motion orchestration where permitted, but it must stay inside canonical contracts.

---

# 33. Program I — Orphan-System Migration

Before large 21st expansion, run a complete source census.

Search for:

```text
SystemLauncher
old launcher
legacy launcher
wizard_seed_generation
siteElementsLibrary
componentIntelligenceRegistry
manual template category maps
duplicate variant registries
duplicate motion inventories
interactionManifest
direct page VFS writes
old Stage 4b wrappers
legacy design element registries
old AI fast paths
deprecated artifact maps
```

Classify each:

```text
KEEP
MIGRATE
DELETE
COMPATIBILITY-ONLY
```

A system is orphaned if:

- it is only consumed by removed System Launcher code
- it declares visual capabilities no current Wizard consumer reads
- it writes page VFS outside canonical merge/commit
- it bypasses `SiteBundleSnapshot`
- it duplicates industry/template mapping
- it duplicates design vocabulary
- it injects interactions outside Design Intervention
- it duplicates intent vocabulary
- it acts as a second AI design-inspiration source

---

# 34. What Must Be Retired or Demoted

## `src/data/siteElementsLibrary/*`

Retire as a design inspiration authority.

If it contains useful semantic facts, migrate them into the canonical registries.

Replace AI Builder prompt generation with projections from:

```text
DesignImplementationRegistry
ArtDirectionPacks
DesignVocabulary
Wizard Registry Context
```

## `src/services/componentIntelligenceRegistry.ts`

Retain semantic composition intelligence.

Remove independent visual design ceilings and stale intent vocabulary.

## Old System Launcher implementation maps

Migrate any useful capability to:

```text
Launch Wizard
Design Intervention
Variant Registry
Wizard Registry Context
```

Then delete the old runtime path.

---

# 35. Stage 4b Remains Theme Authority

21st source must not bring its own competing theme system into canonical generated sites.

The hierarchy remains:

```text
21st source composition
      ↓
Unison normalization
      ↓
registered implementation
      ↓
Art Direction / Design Intervention
      ↓
Stage 4b semantic token resolution
      ↓
generated VFS
```

Allowed:

```text
layout geometry
component hierarchy
media treatment
visual rhythm
motion recipe
hover treatment
```

Not allowed:

```text
independent global color system
independent typography system
foreign CSS reset
foreign design token root
foreign theme provider that overrides Stage 4b
```

---

# 36. Program J — Visual Quality Gate

Syntax correctness is not visual quality.

Add structural design quality analysis.

Example:

```ts
interface VisualCompositionQualityReport {
  pageId: string;

  sectionCount: number;
  implementationDiversity: number;
  geometryDiversity: number;

  hasHeroDisplayScale: boolean;
  hasVisualFocalPoint: boolean;
  hasMediaTreatment: boolean;
  hasInteractionTreatment: boolean;

  repeatedEqualGridPenalty: number;
  repeatedCenteredStackPenalty: number;
  excessiveCardPenalty: number;

  motionBudgetUsed: number;
  motionBudgetExceeded: boolean;

  warnings: string[];
}
```

Use this first as:

```text
warning
diagnostic
AI enrichment hint
```

not as one simplistic subjective pass/fail score.

---

# 37. Program K — Visual Builder / WYSIWYG

After 21st-derived generation is stable, the biggest remaining gap will be direct visual manipulation.

Do not create a separate canvas model.

Use existing canonical identity.

Generated sections should expose:

```tsx
<section
  data-ut-section-id="..."
  data-ut-artifact="hero"
  data-ut-implementation="hero:kinetic-tech"
>
```

Slots:

```text
data-ut-slot="hero.headline"
data-ut-slot="hero.subhead"
data-ut-slot="hero.primary-cta"
data-ut-slot="hero.media"
```

Then:

```text
Preview click
    ↓
section/artifact identity
    ↓
DesignImplementationRegistry
    ↓
SiteBundleSnapshot
    ↓
Property Inspector
```

This is how Unison becomes visually editable without abandoning canonical state.

---

# 38. Property Inspector

For sections:

```text
Variant
Layout
Spacing
Surface
Media treatment
Motion
Interaction
Visibility
Data source
Intent binding
```

For text:

```text
Content
Semantic role
Typography role
Alignment
Max width
Emphasis
```

For media:

```text
Asset
Crop
Aspect ratio
Fit
Position
Treatment
Motion
Alt text
```

Mutations should produce canonical patch plans.

Do not edit arbitrary DOM state disconnected from snapshot identity.

---

# 39. AI + Visual Editor Round Trip

Target:

```text
User selects hero
        ↓
"Make this more cinematic"
        ↓
AI receives:
  selected artifact
  current implementation
  certified sibling implementations
  Art Direction Pack
  Stage 4b theme context
  available assets
  current screenshot/preview context
        ↓
candidate canonical patch
        ↓
preview
        ↓
accept
        ↓
commitMutation()
```

This combines 21st-derived design richness with Unison's canonical edit model.

---

# 40. Design Graph — Later Milestone

Do not implement this during registry convergence.

Later, add compatibility metadata.

Example:

```ts
interface DesignCompatibility {
  implementationId: string;

  prefersBefore?: string[];
  prefersAfter?: string[];

  avoidAdjacent?: string[];

  compatiblePacks?: string[];
}
```

Example:

```text
hero:kinetic-tech
prefers:
  services:horizontal-rail
  logos:marquee
  gallery:filmstrip

avoid adjacent:
  cta:marquee-band
```

This gives deterministic composition and Lane B better page rhythm.

---

# 41. Page-Level Composition Identity

Add a site/page composition strategy later.

Examples:

```text
editorial
cinematic
kinetic
product-led
conversion-dense
story-led
portfolio-led
```

A page-level strategy should coordinate section choices.

It should not replace section implementation identity.

---

# 42. Visual Hierarchy Budgets

Add deterministic restraint rules.

Examples:

```text
maximum 1 dominant hero
maximum 2 continuous animations in a viewport
maximum 1 marquee in the same visual region
maximum 1 heavy immersive/3D experience above fold
limit simultaneous blur/glow/glass effects
```

High quality comes from hierarchy, not maximum animation.

---

# 43. Cross-Page Design Memory

Persist site-level visual grammar.

Examples:

```text
headline treatment
surface strategy
image treatment
grid language
navigation language
motion intensity
radius language
section rhythm
```

Each page should express the grammar differently.

Do not clone Home's exact geometry onto all interior pages.

---

# 44. Recommended Implementation Order

## Milestone 1 — Canonical Variant → VFS parity

Do this first.

Tasks:

- inventory every registered section variant
- inventory which variants are truly portable VFS executable
- generalize Gallery's registered-variant VFS pattern to all major families
- add certification state
- add parity tests
- preserve legacy IDs

**Exit condition:**

Every preferred visual implementation selected by the Wizard can materialize identically into canonical generated VFS.

---

## Milestone 2 — Registry authority cleanup

Tasks:

- add `generationStatus`
- add `source`
- add `vocabularyRefs`
- derive primitive inventories from canonical modules
- fix Lane B vocabulary reporting
- remove contradictory generated-UI directives
- refactor stale intent ownership
- inventory old System Launcher / visual authority systems

**Exit condition:**

No duplicate visual capability declaration is authoritative in the Launch path.

---

## Milestone 3 — 21st intake / certification infrastructure

Tasks:

- create `src/design/21st-intake/`
- create provenance record
- create compatibility audit
- create dependency allowlist policy
- create token normalizer
- create canonical identity adapter
- create portable certification workflow

**Exit condition:**

A 21st source component can enter quarantine, be normalized, be tested, and become a first-class Unison implementation without runtime 21st dependency.

---

## Milestone 4 — Replace weak preferred implementations

Begin with highest-value families:

```text
navbar
hero
services/features
gallery
social proof
CTA
```

Promote 21st-derived implementations.

Mark weak legacy implementations:

```text
generationStatus: legacy
```

Do not delete historical IDs.

**Exit condition:**

Every main Art Direction Pack has a coherent set of modern preferred implementations.

---

## Milestone 5 — Generated UI Foundation expansion

Add/normalize:

```text
OrbitalBackdrop
GlowField
AnimatedGrid
NoiseField
GradientOrbs
BrandLockup
hero type scale
MarqueeBand
HorizontalRail
HoverDepth
ImageReveal
ParallaxMedia
MaskReveal
MotionImage
```

**Exit condition:**

Common 21st visual techniques no longer require bespoke per-page logic.

---

## Milestone 6 — Artifact / catalog / asset wiring

Tasks:

- expand artifact metadata where required
- wire Asset Registry into Wizard context
- promote real first-class placeholder sections
- add catalog surfaces only when persistence exists
- verify business-data binding persistence

**Exit condition:**

Visual richness does not break artifact/business-data identity.

---

## Milestone 7 — Wizard Registry Context v2

Tasks:

- certified implementations
- source provenance
- executable vocabulary
- primitive families
- assets
- approved dependencies
- industry/template filtering

Pass bounded context to Lane B.

**Exit condition:**

Lane B receives the actual executable design universe.

---

## Milestone 8 — Lane B 21st-aware creative enrichment

Tasks:

- update request contract
- fix modern React parse/import validation
- enforce dependency allowlist
- preserve Stage 4b theme
- preserve intents/bindings
- batch pages
- use deterministic fallback
- reject unapproved vocabulary

**Exit condition:**

Lane B can create visually sophisticated candidate page bodies without compromising the canonical launch.

---

## Milestone 9 — Visual selection / property inspector

Tasks:

- DOM identity
- section selection
- slot selection
- variant switching
- layout controls
- asset controls
- data/intent inspector
- contextual AI edits

**Exit condition:**

Users can visually modify what the Wizard generated while preserving the same canonical identities.

---

## Milestone 10 — Immersive / 3D expansion

Only after ordinary DOM/CSS/motion quality is excellent.

Use existing Experience capability infrastructure.

Do not make 3D a prerequisite for premium quality.

---

# 45. Testing Requirements

## Variant → VFS parity

Add tests that prove:

```text
selected implementation ID
→ generated recipe family
→ canonical VFS
→ runtime render
```

No silent generic module fallback.

## Registry tests

Validate:

- no duplicate preferred implementation IDs
- every preferred implementation is portable certified
- every Art Direction Pack reference resolves
- every `vocabularyRefs` entry exists
- every executable vocabulary entry has an implementation
- every primitive advertised to AI exists in generated runtime
- registry signature changes with implementation inventory
- no disabled variant is selected for new generation

## 21st intake tests

Validate:

- provenance required
- disallowed dependency detection
- Tailwind v3 compatibility
- no Next-only imports
- Stage 4b token normalization
- reduced-motion handling
- canonical identity attributes
- portable recipe compilation
- no duplicate active source after promotion

## Lane B tests

Validate:

- protected paths cannot be modified
- modern JSX does not require `import React`
- unsupported dependencies are rejected
- required intents survive enrichment
- bindings survive enrichment
- canonical router survives
- Stage 4b CSS wins
- failed Lane B keeps deterministic page
- committed revision rehydrates identically

## Legacy migration tests

Validate:

- existing historical variant IDs remain resolvable
- legacy variants are excluded from preferred generation
- old project snapshots do not break

---

# 46. Definition of "21st-Certified Unison Implementation"

An implementation is not complete until:

```text
[ ] 21st provenance recorded if applicable
[ ] license/source metadata reviewed
[ ] dependencies audited
[ ] React 19 compatible
[ ] Vite compatible
[ ] Tailwind v3 normalized
[ ] Stage 4b semantic tokens used
[ ] unsupported runtime imports removed
[ ] reduced-motion behavior added
[ ] responsive behavior verified
[ ] canonical section identity added
[ ] canonical slots added
[ ] intents preserved / mapped
[ ] artifact binding compatible
[ ] vocabularyRefs declared
[ ] generationStatus assigned
[ ] portable VFS recipe certified
[ ] Variant Registry contains it
[ ] DesignImplementationRegistry derives it
[ ] Art Direction Pack may select it
[ ] Wizard Registry Context sees it
[ ] Launch Wizard can generate it
[ ] SiteBundleSnapshot preserves it
[ ] VFS materializes it
[ ] Preview renders it
[ ] Playground recognizes it
[ ] canonical commit persists it
[ ] reload preserves it
[ ] tests prove the chain
```

Anything less remains intake or experimental source.

---

# 47. Do Not Confuse 21st With Runtime Business Architecture

21st should never own:

```text
industry resolution
business capabilities
booking semantics
CRM semantics
commerce semantics
catalog hydration
artifact semantics
intent semantics
page topology
publish readiness
VFS authority
snapshot identity
revision persistence
```

These remain Unison's differentiators.

21st supplies:

```text
human-designed visual source
interaction patterns
component geometry
motion techniques
layout inspiration
visual implementation quality
```

Unison supplies:

```text
normalization
semantic composition
business runtime
data binding
industry logic
AI orchestration
canonical state
VFS compilation
visual editing
publishing
```

---

# 48. Strategic Product Direction

Unison should not become a 21st wrapper.

The stronger product is:

```text
21st-derived design quality
+
Unison canonical composition
+
industry-aware business semantics
+
live catalog/business data
+
intent/runtime behavior
+
backend capability provisioning
+
AI candidate code enrichment
+
visual canonical editing
+
portable React output
```

The same artifact that looks beautiful should also understand:

```text
what business object it represents
what data hydrates it
what action it triggers
what backend capability it needs
how the user edits it
how AI may modify it
how the canonical VFS persists it
```

That is the architectural advantage to protect.

---

# 49. VS Code AI Execution Prompt

Use this at the start of implementation:

> Implement this plan incrementally against the current Unison repository.
>
> 21st.dev is now the sole external design-source ecosystem, but **do not create a new 21st runtime registry or replace Unison's canonical platform architecture**.
>
> Begin with **Milestone 1 only: Canonical Variant → VFS parity**.
>
> Before writing new visual components, audit:
>
> 1. every `SectionVariant` in `src/sections/variants/registry.ts`
> 2. every current `vfs.mode`
> 3. every generated recipe family
> 4. every branch in `src/sections/compositionToFileSet.ts`
> 5. every hard-coded family module such as `HERO_MODULE`, `SERVICES_MODULE`, etc.
> 6. every path where `variant.component` and `variant.renderJSX` can diverge
> 7. every current Art Direction Pack reference
>
> Produce a concrete migration table:
>
> ```text
> implementation ID
> → current React implementation
> → current VFS path
> → portable recipe status
> → launch parity status
> → migration action
> ```
>
> Then make the portable registered-variant execution model work for the major section families without changing the Launch Wizard's canonical topology, business semantics, Stage 4b theme authority, `SiteBundleSnapshot`, or `commitMutation()` authority.
>
> Preserve:
>
> - `LauncherWizard.tsx`
> - `launchOrchestrator.ts`
> - `canonicalPipeline.ts`
> - `SiteBundleSnapshot`
> - `artifactRegistry.ts`
> - `catalogSurfaceRegistry.ts`
> - `intentSurfaceRegistry.ts`
> - `DesignIntervention`
> - `ArtDirectionPacks`
> - `DesignImplementationRegistry`
> - `generatedUiFoundation.ts`
> - Lane B candidate VFS architecture
> - `canonicalLaunchVfs.ts`
> - `vfsCommitService.ts`
>
> Do not:
>
> - mass-install 21st components yet
> - create a `TwentyFirstRuntimeRegistry`
> - create a second visual template engine
> - bypass Stage 4b
> - write Launch page VFS outside canonical merge
> - remove historical variant IDs
> - replace business/artifact/catalog registries with 21st concepts
>
> Milestone 1 is complete only when tests prove that a preferred registered Hero, Services, Gallery, Pricing, CTA, Navbar, Testimonial, and Footer variant selected by the Wizard survives into canonical generated VFS without falling back to generic hard-coded family modules.
>
> After Milestone 1 passes, proceed to Milestone 2 registry-authority cleanup. Do not begin 21st intake until the current visual implementation path is genuinely executable end to end.

---

# 50. Final Target

The completed system should allow Unison developers to select high-quality 21st source patterns, safely ingest them once, normalize them into the existing platform, and make them reusable by every current and future industry.

A Launch Wizard generation should then be able to combine:

```text
industry
+
business goals
+
canonical page topology
+
template semantic contract
+
21st-derived certified implementation families
+
Art Direction Pack
+
Stage 4b style selection
+
business catalog data
+
business assets
+
intent requirements
+
Lane B creative enrichment
```

and produce:

- multi-page production React
- consistently high visual quality
- modern typography
- asymmetric composition
- rich media
- motion
- hover interactions
- marquees / horizontal rails
- coherent cross-page design
- live business data
- working intents
- stable artifact identity
- canonical VFS
- reliable Preview
- WYSIWYG-editable state
- publishable runtime

without:

- a removed System Launcher
- a second design registry
- random AI UI invention
- live 21st runtime dependency
- generic family fallback
- VFS drift
- business semantic loss

The key implementation principle is:

> **Do not replace Unison with 21st. Replace Unison's weak visual implementations with certified 21st-derived Unison implementations, and make the existing canonical pipeline actually execute them everywhere.**


## Implementation continuation ? 2026-09-17

The services/forms/route-design batch adds twelve portable variants in seven existing
families. See the September 17 entry in roadmap.md and development preview at
/tools/section-variants.html. Source inspection records live in
src/design/21st-intake/references/; the runtime never imports these records.
Route design selection is a seeded projection of VARIANT_REGISTRY pageRoles and
page-design tags, not another template or routing registry. Existing explicit
page compositions remain unchanged. Certification tests exercise the emitted
recipes, interaction semantics and canonical commit/reload path. Persisted live
publish verification remains a separate open milestone.


## Launcher industry rollout and Registry Context v2 - 2026-09-17

Fresh Launcher generations now prefer approved, preferred 21st-derived variants
inside the resolved Art Direction Pack and Home page-role envelope. All fourteen
packs admit the twelve services, FAQ, contact, about, stats, pricing and gallery
variants. General-purpose variants declare Home eligibility; checkout support
remains restricted to checkout. Existing serialized active variant selections
remain unchanged on read. No external API is called during generation.

Interior route variant identities now take precedence over inherited Home
choices during compilation; an exact section-instance override still wins.
This preserves the authored pricing/FAQ alternatives and seeded contact/checkout
route designs while retaining section IDs, props, actions and topology.

M7 implementation has advanced to Registry Context v2. Its inventory is derived
from executable, non-legacy, pack-compatible variants and includes provenance,
certification status, page roles, vocabulary references and Radix requirements.
All seventeen portable families are correctly reported as first-class. The
production Lane B request carries this inventory, bounded to section families
present in compiled page descriptors. Its selected vocabulary is also derived
from those descriptors, including interior pages; legacy snapshots without
v2 metadata continue to use the existing fallback. Provenance describes the
source relationship and does not imply every referenced source was copied.

Evidence: wizardTwentyFirstIndustries.test.ts traverses every visible Wizard
industry, each registered template and each style preset; it checks deterministic
selection, pack/role legality, source preference, serialized read stability,
compiled section identity/data, component rendering, and bounded Lane B context.
The populated-Home override regression verifies contact and checkout routes.
The local browser fixture /tools/industry-launch-variants.html renders default
Launcher selections for all ten visible industries without launching or saving.

M7 remains open for project-asset projection and full dependency-context closure.
Persisted published-site visual verification, full editor round trips and the
remaining M5/M6/M8 work are not certified by these local checks.

Mobile rollout verification also exposed fixed desktop column counts in the
existing dark/column footers and grid/centered feature variants. These now stack
at narrow widths, preserve authored desktop columns, and wrap long content.
Newsletter inputs can shrink and have an accessible email label. The fixes are
compiled into the same portable recipes used by generated pages.

Validation for this continuation: 204 test files passed (1,767 tests passed,
1 skipped); TypeScript, changed-file lint, recipe freshness, and all four
architecture guards passed. Desktop and 390px browser sweeps rendered all ten
industry defaults; the final mobile sweep reported no horizontal overflow or
browser errors. Browser checks used the local component review fixture and did
not create or publish a project.


## 2026-09-17 ? structured composition and popular-source intake

Implemented the first structured AI composition pass before canonical compilation. AI selects existing section-family order and eligible local variant IDs, preferring suitable 21st sources. Strict validation checks the pack, page role, family and portable implementation. The compiler retains every business section and owns navigation, hero/footer placement, themes, intents and files. Historical first iteration: accepted choices persisted in the design intervention and snapshot and skipped later refinement. The current sequencing below supersedes that skip. Historical behavior (superseded): invalid or unavailable responses used a starter path. New launches now require a valid AI composition.

This phase does not remove templates: they remain semantic content baselines and fallback. Arbitrary section insertion/removal and replacing the Wizard template-selection step remain follow-up work. The new wizard-composition backend mode is implemented locally and requires deployment for live use.

Retrieved eight React prototypes through the 21st MCP: Scroll Expansion Hero, Container Scroll Animation, Spline Scene, Spotlight Card, Radial Orbital Timeline, Bento Grid, Scroll Morph Hero and Testimonials Columns. Popularity was observed from the public catalog and creator pages on the intake date; MCP component search is relevance-ranked, not a verified popularity sort. Original sources and metadata are quarantined under src/design/21st-intake/quarantine/popular-2026-09-17. Source licenses were not supplied by MCP and are not assumed. Local spotlight cards and testimonial columns are visual-reference implementations with portable compiler parity coverage. Unsupported heavy prototypes remain references.

The user-supplied PrismaHero is preserved verbatim under src/design/21st-intake/quarantine/user-prisma-2026-09-17, mapped to the existing hero:prisma-cinematic implementation. Its oversized type, asymmetric copy, media scrim and restrained word reveal inform the composer. Demo media URLs, placeholder navigation and hardcoded colors are not generation defaults. This is durable repository context, not a claim of external/personal AI memory. No runtime 21st API calls or credentials are introduced.


### 2026-09-17 ? Wizard composition wiring correction

Production source inspection confirmed the deployed ai-code-assistant lacked wizard_composition support. The first local implementation also inherited code-generation instructions and used a 20-second client timeout against 35-second provider attempts. Composition now dispatches directly to a JSON-only lane before the general builder pipeline; malformed source/file responses receive a 502 composition_contract error. The client allows 90 seconds, requires coverage of every requested role, and records provider/transport/invalid-response/incomplete-plan fallback reasons. Regression coverage round-trips the backend response through client validation and canonical snapshot compilation.

The corrected ai-code-assistant was deployed to the linked nfrdomdvyrbwuokathtw project. An unauthenticated production request returned 401, preserving the auth gate. Authenticated live generation remains unverified because the available browser session is signed out. Frontend changes remain local until published through the application deployment workflow.


## 2026-09-17 ? Dedicated Wizard site composer

The Launcher now has three steps: Idea, Goals/pages and Brand style. Removed template/layout cards, selected-template state, layout preview and template design inspector from this UI. The launch service resolves an internal industry content baseline for canonical topology and behaviors; users no longer choose it.

Wizard requests use wizard-site-composer through the existing authenticated/retrying transport. The dedicated function validates the brief, researches only the public industry category, reads the authenticated user's last three layout summaries, and asks for original page copy and registered local variants with a fresh launch seed. 21st-derived portable variants are preferred when suitable. No remote component code is imported at runtime.

Plans cover every requested page, carry section order, variant IDs and bounded plain-text copy (headlines, descriptions, service/feature items and FAQs). The compiler preserves existing section identities, actions, assets and business data; it can add eligible about/features/services/FAQ/contact/CTA sections with supplied copy. No arbitrary source code, routes, theme or dependencies are accepted. The baseline remains an internal semantic content source, not a selectable design preset. Full arbitrary content-model replacement is not implemented.

Invalid generation fails visibly with retry guidance; it no longer silently hands off a starter as an AI result. Accepted layout summaries are stored per authenticated user in the existing ai_learning_sessions table; no schema migration is required. Memory/research failures are nonfatal, and research is untrusted design context, never evidence for invented business claims. Fresh seeds and recent-layout context encourage diversity without guaranteeing uniqueness.

Verification: three-step browser flow and mobile review; backend brief-schema/client/compile regression tests; copy/section addition tests; full suite 1,788 passed, one skipped; TypeScript, Deno and architecture checks passed. Authenticated provider-to-live-preview verification remains pending an available signed-in session. Frontend changes still require application deployment.


### Incident: launch_mu66xwcg_0wu1rs

The supplied run failed at 2026-09-17T23:58:56.512Z, before wizard-site-composer was first created at 2026-09-18T00:01:12.868Z (136 seconds later). The one-second request failure is consistent with an undeployed endpoint; the original HTTP response was lost because the client collapsed all errors to provider. The endpoint is now ACTIVE. Client diagnostics now preserve safe HTTP status, schema fields and backend error type; launch reports retain composition-specific codes. Incomplete plans identify the roles missing variants or copy. No raw provider bodies, prompts or credentials enter these reports. An authenticated retry is needed to establish whether any additional issue remains.
