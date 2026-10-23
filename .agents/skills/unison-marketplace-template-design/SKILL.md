---
name: unison-marketplace-template-design
description: "Use when adding or revising Unison marketplace website templates, authored design concepts, template previews, long-scroll page sections, or registry-backed preview bindings. Keeps marketplace designs distinct from generic launch compositions and maps interactions to canonical Unison intent and capability registries."
---

# Unison Marketplace Template Design

Use this skill for preview concepts in `src/marketplace/`. Also follow `unison-wizard-app-builder-design-system` for App Builder ownership, Unison visual standards, and marketplace certification boundaries.

## Keep the ownership boundary

- Marketplace design concepts live in `src/marketplace/authoredTemplatePreviews.tsx` and render as individually authored page components. Do not build them by selecting generic `TemplateComposition` records or by rebranding the Wizard's section registry.
- Keep `src/sections/templates/ALL_COMPOSITIONS` and its default registrations intact. Those are launch/Wizard sources, not the marketplace preview catalog.
- Keep preview concepts separate from certified catalog listings and accepted release snapshots. Never label a concept as certified, published, installable, or AI-generated unless the corresponding evidence exists.
- Do not use `TemplateRuntimeProvider`, `handleIntent`, or invented business/project IDs to execute backend actions from a public concept preview. Concept form values must not be sent or persisted.

## Author the page

- Give each template a specific audience, goal, copy voice, art direction, and route/page story. Avoid reusing the same hero-plus-card-grid composition with different labels.
- Across the catalog, do not reuse image sources or copy a complete page-layout recipe. Keep each cover and rendered page image source unique to one template; rotate gallery, journal, and feature variants so every template has a distinct variant combination.
- A full-page concept should have multiple substantial sections beyond the hero: useful domain content, proof or process, a clear primary-action surface, and relevant location/contact/pricing details. Use sections that fit the business rather than adding filler.
- Include industry-specific gallery, journal/editorial, case-study, and features sections when they fit the business. Render actual Unison section components through `MarketplaceRegisteredSection`; do not substitute labels or hand-built approximations for registered layouts.
- Select `gallery`, `blog-preview` (journal), and `features` variants from `MARKETPLACE_TEMPLATE_VARIANT_PROFILES`. The profile's art-direction pack and page role must pass `getGenerationVariantsForSection`; render with the registry component and the template's own `ThemeTokens`.
- Use a meaningful layout mix per industry: for example, hospitality can pair a Feature Split gallery and Horizontal Rail journal; architecture can use a Case Study Gallery and Featured Grid journal; software can use a Cinematic Grid gallery and Bento Mosaic features. These are examples, not exemptions from registry eligibility.
- Keep the preview in the accessible dialog surface: `role="region"`, an informative `aria-label`, `data-marketplace-preview-surface`, and a bounded `min-h-0 overflow-y-auto overscroll-contain` container. The page content must remain vertically scrollable within the dialog.
- Support both compact and desktop layouts without horizontal overflow. Preserve distinct type, palette, image treatment, and content rhythm for each concept. Use suitable, reusable assets and descriptive image alternatives in the rendered page.
- Include a relevant image in every concept page, not only its catalog tile. Add image-led domain sections where useful; do not rely on gradients or decorative shapes as a substitute for product, place, food, or people imagery.
- Forms should use useful, typed fields and native validation. Describe what the real configured workflow will do after installation; do not imply preview data is submitted.

## Wire canonical interactions

- Define each page action in the template's `bindings` metadata with a unique `id`, canonical `intent`, visible `label`, `sourceSection`, and `sourceSlot`. Add `targetSectionId` for an in-preview anchor destination.
- Resolve every binding through `getIntentDef` from `src/platform/core/intentSurfaceRegistry.ts`. Accept only registered, stable `user-action` intents. Use the returned canonical name, never infer backend intent from button text.
- Derive required capability names and readiness fixtures from the intent definition and `getCapability` in `src/platform/core/capabilityRegistry.ts`. Do not duplicate or guess capability requirements.
- Stamp standard binding markers on actions: `data-ut-cta`, `data-ut-intent`, `data-intent`, `data-ut-label`, `data-ut-binding-id`, `data-ut-section-role`, and `data-ut-slot`. Forms also carry canonical `data-intent` and `data-ut-intent` values.
- Route internal links only inside the preview surface: prevent the host page hash from changing, scroll to the bound `targetSectionId`, and record the current preview section. Bind the brand mark to the local top section too.
- Redirect overlay intents by the canonical definition's `surface` and `overlayId`. Render an accessible, template-themed preview dialog for the registered overlay (booking, quote, contact, etc.); show capability/readiness data from the registries and provide a clear return action. Do not leave these actions as informational toasts or status strips.
- In public concept previews, clicking or submitting a binding may display the resolved intent, capability, and readiness requirements. State explicitly that no details were sent or saved. Actual operational dispatch belongs to an accepted generated site with real identity, enabled capabilities, and the canonical runtime.
- Do not invent a new intent or capability to fit a design. If the registries do not support an interaction, revise the design or request a separately scoped registry change.

## Validation

- Add focused tests that every template binding resolves to a stable registry intent and that DOM markers match the canonical name and source slot.
- Assert every selected section variant is generation-eligible for its template's art-direction pack and role, then assert those exact variant IDs render in the preview.
- Assert catalog size and distinct gallery/journal/features combinations, and render each preview to ensure no Unsplash photo ID is reused across catalog covers or page content.
- Test that the page surface is accessible and scrollable, internal links stay within the preview, overlay intents open the matching registered surface, images have useful alternatives, and form data is neither dispatched nor persisted.
- Run `npx vitest run src/test/marketplaceAuthoredPreviews.test.tsx`, `npm run type-check`, and `npm run build`.
- Inspect the marketplace route at desktop and narrow mobile widths. Confirm images render, page content scrolls inside the preview, compact navigation fits, and the browser console has no new errors.