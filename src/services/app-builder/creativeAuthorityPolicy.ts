/**
 * One authoring policy for prompt-first App Builder generation (UPG-01 §1, §5).
 *
 * Every page turn (site authoring brief and App Builder runtime context) reads
 * these exact strings, so the model never receives competing rules such as
 * "always use the registry dispatcher" next to "never use registry modules".
 */

/** Authority hierarchy, highest first. Only level 1 is never negotiable. */
export const CREATIVE_AUTHORITY_ORDER = [
  'AUTHORITY ORDER (highest first):',
  '1. Safety and runtime invariants: protected files, valid TSX/imports, stable section IDs, authorized capabilities and intents, durable assets, revision integrity. Never optional.',
  '2. The owner\'s original prompt and confirmed chat refinements: the primary creative and functional authority.',
  '3. The derived page and creative plan: a revisable projection of the prompt; it must not narrow it.',
  '4. Certified Unison designs and the art direction pack: high-quality options and site-wide visual language, not a compulsory composition.',
  '5. Industry archetypes, composition targets and starter defaults: advisory hints only.',
].join('\n');

/** Per-section strategy shared by every page turn. */
export const MIXED_SECTION_AUTHORING_POLICY = [
  'SECTION AUTHORING POLICY — choose REUSE, ADAPT or AUTHOR for each body section, whichever best serves the owner\'s prompt:',
  '- REUSE a certified design: import the family dispatcher (e.g. import Services from "@/unison/design-sources/Services") and render it alone inside <section data-ut-section-id="<pageId>:<family>:<n>" data-ut-section-type="<family>" data-ut-variant="<certified variantId>"> as <Services sectionId="<same id>" variantId="<same variantId>" props={{ ...JSON-serializable literal }} />.',
  '- ADAPT: configure a certified design through its serializable props; when its source itself must change, write a site-local derivative under /src/project-components/ with its own custom:<kebab-slug> variant. Never edit registry source or reuse its registry variant ID for changed source.',
  '- AUTHOR: write an original default-exported component under /src/project-components/ or /src/components/generated/ and render it inside <section data-ut-section-id="<pageId>:<purpose>:<n>" data-ut-section-type="<kebab purpose, e.g. match-centre>" data-ut-variant="custom:<kebab-slug>">. Any composition, props, layout, imagery, motion and interaction is allowed.',
  'Certified designs are options, not required families: do not force a registered variant merely because one exists, and do not make every section custom when a certified design already fits. When the prompt asks for an original or interactive experience no certified option delivers, AUTHOR it; never substitute a generic card, feature or services section. Never invent a registry variant ID for custom source.',
  'Hard invariants for every strategy: literal data-ut-section-id/-type/-variant on each section root; one dispatcher or one site-local component per section; meaningful visible content (no empty or form-only sections); imports only from project files, @/unison/* and approved packages; registered intent, CTA, resource, slot and component-instance markers unchanged; shared site:navbar and site:footer chrome reused; semantic theme tokens, keyboard access, visible focus, responsive layout and reduced-motion support.',
].join('\n');

/** Page archetype families and counts guide, operational requirements bind. */
export const ARCHETYPE_ADVISORY_POLICY = 'PAGE ARCHETYPE (advisory): the page role\'s typical families, section count and composition target are guidance. The owner\'s prompt may replace, reorder or add sections, including families outside the archetype. Registered forms, bindings and requested operational capabilities remain required.';

/** Default share of the page brief the owner's prompt may use before layout hints yield. */
export const OWNER_BRIEF_LIMIT = 6_000;

/**
 * The owner's prompt as the primary creative authority. Returns '' when no
 * prompt exists; never truncates below the explicit requirements it carries.
 */
export function renderOwnerCreativeBrief(vision: string | undefined, limit = OWNER_BRIEF_LIMIT): string {
  const text = vision?.trim();
  if (!text) return '';
  const body = text.length > limit
    ? `${text.slice(0, limit)}\n[Prompt continues; the full original prompt is in VISITOR CREATION SPECIFICATION.]`
    : text;
  return `OWNER CREATIVE BRIEF (primary creative authority — realize the experience, layout, imagery, interactions and motion described here; plans, archetypes and registry suggestions yield to it, only safety/runtime/capability invariants override it):\n${body}`;
}
