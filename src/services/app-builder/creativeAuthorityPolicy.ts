/**
 * One authoring policy for prompt-first App Builder generation (UPG-01 §1, §5).
 *
 * Every page turn (site authoring brief and App Builder runtime context) reads
 * these exact strings, so the model never receives competing rules such as
 * "always use the registry dispatcher" next to "never use registry modules".
 */

/**
 * The single prompt-authority policy (Native Authorship guide §4 B3). Every
 * authoring and editing request carries this exact text; no other active
 * instruction may restrict body sections to registered families.
 */
export const PROMPT_CREATIVE_AUTHORITY_POLICY = 'The user\'s prompt and confirmed refinements determine visual composition and page-specific experience. Use Unison primitives and certified designs as implementation context. Reuse, adapt, or author original site-local TSX as needed. Never bypass canonical source identity, protected paths, valid imports, operational authorization, or VFS acceptance.';

/** Authority hierarchy, highest first. Only level 1 is never negotiable. */
export const CREATIVE_AUTHORITY_ORDER = [
  `CREATIVE AUTHORITY: ${PROMPT_CREATIVE_AUTHORITY_POLICY}`,
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
  '- ADAPT: configure a certified design through its serializable props; when its source itself must change, write a site-local derivative under /src/project-components/ with its own custom:<kebab-slug> variant whose first line is the provenance comment // @unison-derived-from <certified variantId> (keep any license header). Never edit registry source or reuse its registry variant ID for changed source.',
  '- AUTHOR: write an original default-exported component under /src/project-components/ or /src/components/generated/ and render it inside <section data-ut-section-id="<pageId>:<purpose>:<n>" data-ut-section-type="<kebab purpose, e.g. match-centre>" data-ut-variant="custom:<kebab-slug>">. Any composition, props, layout, imagery, motion and interaction is allowed.',
  'DATA HONESTY: never fabricate live scores, statistics, prices, reviews or article facts. Unless a connected data source is supplied, render clearly labelled sample data (a visible "Sample" or "Demo data" label inside the component).',
  'Certified designs are options, not required families: do not force a registered variant merely because one exists, and do not make every section custom when a certified design already fits. When the prompt asks for an original or interactive experience no certified option delivers, AUTHOR it; never substitute a generic card, feature or services section. Never invent a registry variant ID for custom source.',
  'Hard invariants for every strategy: literal data-ut-section-id/-type/-variant on each section root; one dispatcher or one site-local component per section; meaningful visible content (no empty or form-only sections); imports only from project files, @/unison/* and approved packages; registered intent, CTA, resource, slot and component-instance markers unchanged; shared site:navbar and site:footer chrome reused; semantic theme tokens, keyboard access, visible focus, responsive layout and reduced-motion support.',
].join('\n');

/** Page archetype families and counts guide, operational requirements bind. */
export const ARCHETYPE_ADVISORY_POLICY = 'PAGE ARCHETYPE (advisory): the page role\'s typical families, section count and composition target are guidance. The owner\'s prompt may replace, reorder or add sections, including families outside the archetype. Registered forms, bindings and requested operational capabilities remain required.';

/** Default share of the page brief the owner's prompt may use before layout hints yield. */
export const OWNER_BRIEF_LIMIT = 6_000;

/** Marker lines of the never-truncated requirement block inside a vision brief. */
const REQUIREMENTS_START = 'CREATIVE REQUIREMENTS (';
const REQUIREMENTS_END = 'END CREATIVE REQUIREMENTS';

/**
 * The owner's prompt as the primary creative authority. Returns '' when no
 * prompt exists. A long prompt's prose may be shortened (with a pointer to the
 * full prompt), but its CREATIVE REQUIREMENTS block is always kept whole.
 */
export function renderOwnerCreativeBrief(vision: string | undefined, limit = OWNER_BRIEF_LIMIT): string {
  const text = vision?.trim();
  if (!text) return '';
  const start = text.indexOf(REQUIREMENTS_START);
  const end = start >= 0 ? text.indexOf(REQUIREMENTS_END, start) : -1;
  const requirements = start >= 0
    ? text.slice(start, end >= 0 ? end : undefined).trim()
    : '';
  const prose = start >= 0
    ? `${text.slice(0, start)}${end >= 0 ? text.slice(end + REQUIREMENTS_END.length) : ''}`.replace(/\n{3,}/g, '\n\n').trim()
    : text;
  // Prose keeps a readable share even beside a large requirement list.
  const room = Math.max(Math.min(limit, 1_500), limit - requirements.length - 1);
  const body = prose.length > room
    ? `${prose.slice(0, room)}\n[Prompt continues; the full original prompt is in VISITOR CREATION SPECIFICATION.]`
    : prose;
  return `OWNER CREATIVE BRIEF (primary creative authority — realize the experience, layout, imagery, interactions and motion described here; plans, archetypes and registry suggestions yield to it, only safety/runtime/capability invariants override it):\n${[body, requirements].filter(Boolean).join('\n')}`;
}

/**
 * Sentences from earlier Wizard/registry-only directives that contradict the
 * prompt-authority policy. Saved projects still carry them in
 * /.unison/design-intervention.json, so every consumer filters them out.
 */
const LEGACY_REGISTRY_ONLY_SENTENCES: readonly RegExp[] = [
  /[^.]*\bcompose within (?:them|the registered section implementations[^.]*) and never author replacement section source\.\s*/gi,
  /[^.]*\bnever author replacement section source\.\s*/gi,
  /Compose only with snapshot-owned UI primitives and semantic Stage 4b tokens\.\s*/gi,
  /[^.]*\b(?:owner(?:'s)? vision|owner brief|prompt) (?:is |applies )?only (?:for|to) (?:wording|copy|content)[^.]*\.\s*/gi,
  /[^.]*\bregistered families are the only valid body sections[^.]*\.\s*/gi,
];

/** Remove legacy registry-only sentences; the result keeps art direction, motion and safety guidance. */
export function retireLegacyRegistryOnlyDirective(text: string | null | undefined): string {
  let next = String(text ?? '');
  for (const pattern of LEGACY_REGISTRY_ONLY_SENTENCES) next = next.replace(pattern, '');
  return next.replace(/\s{2,}/g, ' ').trim();
}

/** True when an instruction still restricts authorship to registered families. */
export function hasLegacyRegistryOnlyDirective(text: string | null | undefined): boolean {
  const value = String(text ?? '');
  return LEGACY_REGISTRY_ONLY_SENTENCES.some((pattern) => new RegExp(pattern.source, pattern.flags.replace('g', '')).test(value));
}

/**
 * Copy depth for every section a page turn writes — launch pages, pages added
 * later and Affinity edits read this same text so enrichment never thins out
 * after the first build.
 */
export const SECTION_CONTENT_DEPTH_POLICY = 'SECTION CONTENT DEPTH: pass a certified dispatcher props={{...}} using exactly the prop names listed for its variant (unlisted names are ignored and render nothing). Fill every listed text prop: headline plus subheadline/description of one to three specific sentences written from the owner\'s prompt; give heroes and CTA sections one or two ctas to real site routes; give item arrays three or more complete items. Descriptive, evocative copy is expected; only names, prices, dates, addresses, ratings and statistics count as facts that must come from the brief.';

