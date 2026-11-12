/** Curated from the 2026-09-29 milestone. Guidance is not executable vocabulary. */
export const DESIGN_KNOWLEDGE_VERSION = '2026-11-12.1';
export const DEFAULT_APP_BUILDER_DESIGN_REFERENCE_IDS = ['unison-loveable-foundations'] as const;
export interface DesignKnowledgeEntry {
  id: string;
  version: string;
  status: 'active' | 'draft' | 'superseded';
  scope: 'core-policy' | 'design-guidance' | 'reference';
  source: string;
  compatibility: { composer: string; registry: string; runtime: string };
  tags: readonly string[];
  supersedes: readonly string[];
  text: string;
}

const entry = (id: string, scope: DesignKnowledgeEntry['scope'], tags: string[], text: string): DesignKnowledgeEntry => ({
  id, version: DESIGN_KNOWLEDGE_VERSION, status: 'active', scope,
  source: 'docs/milestones/UNISON_AI_AUTHORED_CONVERGENCE_MILESTONE_2026-09-29.md',
  compatibility: { composer: 'existing composer tasks', registry: 'verify actual exports per request', runtime: 'verify accepted project revision per request' },
  tags, supersedes: [], text,
});

export const DESIGN_KNOWLEDGE: readonly DesignKnowledgeEntry[] = [
  entry('creative-authority', 'core-policy', ['author', 'design'],
    'Author original executable React/TSX pages and project-local components. Registry examples are a quality floor and optional vocabulary, never a whitelist. Certification and aesthetic audit metadata do not prohibit original composition. Preserve explicit sealed site decisions while varying layout, hierarchy, density and narrative by page purpose.'),
  entry('source-authority', 'core-policy', ['preservation', 'edit'],
    'The accepted revision plus explicit candidate operations defines authored source. Preserve untouched bytes, paths, deletions and renames across pages, components, hooks, utilities, styles and assets. Save, navigation, hydration, theme reconciliation and publish do not authorize regeneration. Repairs that change source must become explicit candidate operations and pass validation. Reject stale bases; retain the last good revision.'),
  entry('runtime-contracts', 'core-policy', ['imports', 'runtime'],
    'Use actual project exports and supported runtime bindings; never invent registry identifiers, imports or business capabilities. Compiler-owned router, topology, metadata, foundation and theme-token contracts remain protected. Original local components are valid. Do not claim a booking, checkout or other interaction works without its runtime evidence.'),
  entry('honest-evidence', 'core-policy', ['evidence', 'context'],
    'Missing source or omitted context is unknown, not evidence of absence. Request exact source or reduce scope when required context is unavailable. Unknown components can be source-editable without visual controls. Report fallback as degraded recovery, not successful authoring. Reference observations apply only to the source, visuals and interactions actually inspected; they do not certify production behavior.'),
  entry('page-narrative', 'design-guidance', ['pages', 'navigation', 'design', 'layout'],
    'Give each route a distinct user job and narrative. Reuse brand typography, shared chrome and approved visual language without cloning the Home hero into every route. Connect navigation to real route IDs; preserve existing Home when editing other pages. Choose composition by intent, not a fixed section recipe.'),
  entry('salon-journey', 'design-guidance', ['salon', 'beauty', 'services', 'booking', 'about'],
    'For a salon, Home establishes identity and trust; Services explains offerings and decision criteria; Booking supports selecting a real service and appointment flow; About establishes people and credibility. Vary composition by those jobs. Do not fabricate availability, prices, testimonials or successful booking state.'),
  entry('interaction-design', 'design-guidance', ['interaction', 'form', 'responsive', 'accessibility'],
    'Design mobile and desktop hierarchy deliberately. Use semantic controls, keyboard access, visible focus and legible contrast. Provide honest loading, empty, validation, error and success states tied to actual behavior. Motion should support orientation and respect reduced-motion preferences.'),
  { ...entry('aria-reference', 'reference', ['aria'], 'ARIA source, screenshots and runtime behavior have not been inspected. No executable or visual certification is available.'), version: '2026-09-29.1', status: 'superseded' },
  {
    ...entry('aria-editorial-composition', 'reference', ['aria', 'portfolio', 'editorial', 'cinematic', 'gallery', 'work'],
      'Inspected ARIA reference: Home uses a full-height image-led hero and staggered 7/5 project grid; Work uses an editorial introduction and 8/4 grid; project detail uses a full-width image and challenge/approach/outcome narrative; Contact uses a 5/7 split that stacks on mobile. Shared local SiteChrome components and semantic tokens maintain identity while original TSX determines page composition. Preserve that principle, not a mandatory recipe. White gallery surfaces, orchid accents, italic Libre Baskerville display, IBM Plex Sans body and JetBrains Mono labels are reference choices, not global rules. Source and local browser views inspected; no production certification. Do not copy hover-only navigation, global arrow-key interception or email-preparation forms as working backend submissions.'),
    source: 'docs/knowledge/references/aria/REFERENCE.md',
    compatibility: { composer: 'design inspiration only; adapt routing and source paths', registry: 'local components, not canonical registry exports', runtime: 'TanStack Router / Tailwind 4 reference; not a drop-in Builder runtime' },
    supersedes: ['aria-reference@2026-09-29.1'],
  },
  {
    ...entry('unison-loveable-foundations', 'reference', ['unison', 'loveable', 'design', 'composition', 'hero', 'services', 'gallery', 'navigation', 'cta'],
      'Optional visual reference: the attached Unison X Loveable catalog includes HeroEditorialBanner, HeroFullBleed and HeroSplitImage compositions; ServicesAlternating and ServicesEditorialRows; GalleryCinematicGrid and GalleryEditorialMosaic; plus distinct navigation, CTA and footer treatments. Use these verified export names to understand the examples, not as generated-project imports or required recipes. Translate their hierarchy, rhythm and composition into the current page job while preserving the App Build Contract’s sealed art direction, theme tokens and responsive/accessibility requirements. The attached library is not automatically materialized into a generated project: use its package alias only when the exact module exists in that project’s available source and import context. Recreate suitable ideas with approved design-source modules or project-local components, and never infer working business behavior from a visual reference.'),
    source: '.lovable/rules/libraries/unison-x-loveable-design-d5be96/library-guidelines.md and src/design-system/unison-x-loveable-design-d5be96/index.ts',
    compatibility: { composer: 'inspiration only; follow the current App Builder contract', registry: 'not a canonical registry or generated-project import', runtime: 'attached library is not automatically materialized into generated projects' },
  },
];

export interface DesignKnowledgeSelection {
  packageVersion: string;
  entries: DesignKnowledgeEntry[];
  omitted: Array<{ id: string; reason: 'not-relevant' | 'budget' | 'inactive' }>;
  text: string;
}

const render = (item: DesignKnowledgeEntry) => `[${item.id}@${item.version}] ${item.text}`;

/** Mandatory policy is independent of search. Guidance uses stable lexical ranking. */
export function selectDesignKnowledge(
  query: string,
  maxCharacters = 5000,
  includeReferenceIds: readonly string[] = [],
): DesignKnowledgeSelection {
  if (!Number.isFinite(maxCharacters) || maxCharacters < 0) throw new Error('Knowledge budget cannot fit mandatory policy.');
  const terms = new Set(query.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const entries = DESIGN_KNOWLEDGE.filter(item => item.status === 'active' && item.scope === 'core-policy');
  let text = entries.map(render).join('\n');
  if (text.length > maxCharacters) throw new Error('Knowledge budget cannot fit mandatory policy.');
  const omitted: DesignKnowledgeSelection['omitted'] = [];
  const requestedIds = [...new Set(includeReferenceIds)];
  const byId = new Map(DESIGN_KNOWLEDGE.map(item => [item.id, item]));
  for (const id of requestedIds) {
    const item = byId.get(id);
    if (!item || item.scope !== 'reference') throw new Error(`Unknown design reference: ${id}.`);
  }
  const explicitlySelected = requestedIds.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
  const explicitlySelectedIds = new Set(requestedIds);
  const ranked = DESIGN_KNOWLEDGE.filter(item => item.scope !== 'core-policy' && !explicitlySelectedIds.has(item.id)).map(item => ({
    item, score: item.tags.reduce((sum, tag) => sum + Number(terms.has(tag)), 0),
  })).sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
  for (const { item, score } of [
    ...explicitlySelected.map((item) => ({ item, score: 1 })),
    ...ranked,
  ]) {
    const reason = item.status !== 'active' ? 'inactive' : !score ? 'not-relevant'
      : text.length + render(item).length + 1 > maxCharacters ? 'budget' : null;
    if (reason) omitted.push({ id: item.id, reason });
    else { entries.push(item); text += `\n${render(item)}`; }
  }
  return { packageVersion: DESIGN_KNOWLEDGE_VERSION, entries, omitted, text };
}

/** Hashes identify exact curated bytes, not certification or a generation whitelist. */
export async function designKnowledgeManifest(selection: DesignKnowledgeSelection) {
  const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  const entries = await Promise.all(selection.entries.map(async item => ({ ...item, contentHash: await hash(item.text) })));
  return { packageVersion: selection.packageVersion, entries, omitted: selection.omitted, contextHash: await hash(JSON.stringify({ entries, omitted: selection.omitted })) };
}

/** Shared Composer entry point. Never truncate an existing project/design brief. */
export function appendDesignKnowledge(brief: string, query: string): string {
  const prefix = '\n\nCURATED DESIGN KNOWLEDGE (guidance; project source remains authoritative):\n';
  const selection = selectDesignKnowledge(query, Math.min(5000, 12000 - brief.length - prefix.length));
  return brief + prefix + selection.text;
}
