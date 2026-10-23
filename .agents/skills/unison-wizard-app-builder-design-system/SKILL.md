---
name: unison-wizard-app-builder-design-system
description: "Use when designing or generating Unison Wizard or App Builder sites, marketplace website templates, template previews, or AI-enriched registered-component compositions. Ensures templates are authored by App Builder and use the Unison design system instead of generic hardcoded registry output."
---

# Unison Wizard and App Builder Design System

Use this workflow when creating or improving a website template or design preview for Unison. The goal is a distinctive, usable, AI-authored application that follows Unison's contracts, not a catalog of registered components arranged into a generic page.

## Authority and design sources

- Treat `AGENTS.md`, `copilot-instructions.md`, and the current App Builder architecture as authoritative. The Launcher Wizard gathers intent and selections; it does not author site source. `UnisonAppBuilder` authors the fresh application candidate. The canonical platform owns topology, routes, capabilities, intents, bindings, tokens, protected infrastructure, and acceptance.
- Read the current design-system tokens and theme bridge before choosing colors, typography, spacing, or component treatment. Extend the existing design vocabulary; do not introduce a parallel token system or edit managed vendor source.
- Resolve the user's brief, final Wizard selections, industry profile, and requested capabilities through the existing `AppBuildContract` and composition planning path. Industry profiles contribute data and constraints, not separate generation engines.
- Treat the implementation registry as bounded design knowledge. Use `src/services/designImplementationEligibility.ts` and the implementation's authored `capabilities`, `compatibility`, `lifecycle`, and `ai` contracts to determine whether it is appropriate. Registry presence alone is not design approval.

## Authorship rules

- App Builder must author the actual page composition and visual hierarchy for each template. Use AI enrichment to turn the brief and design contract into deliberate page-specific structure, copy, responsive behavior, and visual treatment.
- Do not ship a generic hardcoded page assembled from registered sections, `TemplateComposition`, or canned hero/card/footer combinations as if it were an AI-authored template.
- A registered implementation without an explicit, compatible AI-enrichment contract is not eligible as the finished visual composition. Omit it, use it only as a reference, or use a narrowly scoped primitive when its contract allows; have App Builder author the surrounding composition and treatment.
- When a registered component is needed for a real capability or canonical interaction, preserve its contract and bindings. AI may enrich presentation but must not replace its behavior with a fake button, toast, one-off handler, or invented backend.
- Make templates meaningfully distinct in page purpose, composition, typography, imagery, and content rhythm. A shared brand language is welcome; duplicating the same section order and card grid with different labels is not meaningful variation.
- Use assets only when their provenance and reuse rights are suitable. Never carry source-project names, private contact details, buyer-supplied assets, or reference-site copy into a reusable template.

## Workflow

1. Read the relevant architecture and current design-token sources. Summarize the intended audience, primary action, selected art direction, page roles, and explicitly requested capabilities before composing.
2. Build the design from the resolved contract and composition plan. Define a coherent system for type, color, spacing, surfaces, imagery, and interaction states using current Unison tokens. Give every route its own responsibility and composition target.
3. Have App Builder author each page as part of one application candidate. Use eligible registered implementations only where their contracts and AI-enrichment support fit the design. Do not widen the registry context or choose a component by name/string resemblance alone.
4. Review the complete candidate at desktop and mobile sizes. Check navigation and footer, meaningful page content, responsive layout, accessible semantics, real interaction behavior, route coherence, and page-to-page visual variety. Use the App Builder page structure gate and canonical candidate checks where available.
5. Repair the same candidate through the existing App Builder flow when checks fail. Do not replace an AI failure or rejected candidate with a generic deterministic website, bypass protected paths, or create a second authoring/commit pipeline.
6. Report what was authored, which registered implementations were used and why, what was validated, and any unresolved gates. A good preview is not proof of marketplace certification or publication eligibility; follow the current marketplace release gates separately.

## Quality bar

Accept a template only when it is recognizably tailored to its intended business and audience, has authored page-level composition rather than preset assembly, uses the current Unison design system, and behaves consistently with the capabilities it claims. If AI-enrichment support, asset rights, or a required canonical contract cannot be verified, state the limitation and do not present the template as certified or release-ready.