/**
 * Requirement coverage for an App Builder candidate (Native Authorship guide §8).
 *
 * Compares the owner's ID-carrying requirements with the exact candidate
 * source: pages requested vs routed and visible in navigation, original
 * experiences requested vs implemented in site-local source, motion and
 * imagery evidence, section provenance and sample-data labelling. Read-only
 * evidence: it never edits source and never blocks a save, but a build with
 * missing requirements is never reported as fully satisfied.
 */
import type { CreationRequirement } from '@/platform/core/universalCreation';

export type CoverageStatus = 'met' | 'partial' | 'missing' | 'unverified';

export interface RequirementCoverageItem {
  id: string;
  kind: CreationRequirement['kind'] | 'data';
  text: string;
  status: CoverageStatus;
  evidence: string[];
}

export interface RequirementCoverageReport {
  items: RequirementCoverageItem[];
  counts: Record<CoverageStatus, number>;
  /** True only when every verifiable requirement is fully met. */
  complete: boolean;
  pages: { requested: string[]; generated: string[]; routed: string[]; inNavigation: string[]; missing: string[] };
  provenance: { certifiedSections: number; customSections: number; authoredModules: string[]; adaptedModules: string[] };
  /** One-line owner-facing summary. */
  summary: string;
  /**
   * Original site-local modules that implement a requested experience. They
   * stay in the project; reusable ones are candidates to add to the Unison
   * library upstream (never copied into the managed design-system source).
   */
  promotionCandidates: Array<{ requirementId: string; modulePath: string }>;
}

export interface CoveragePage {
  route: string;
  filePath: string;
  title: string;
  visibleInNav?: boolean;
}

const AUTHORED = /^\/src\/(?:project-components|components\/generated)\//;
const CHROME = /^\/src\/project-components\/site\/|\/Site(?:Nav|Navbar|Footer)\.[jt]sx?$/;
const DERIVED = /@unison-derived-from\b|@unison-adapted\b/;
const LIVE_DATA = /\b(?:live|score|scores|stat|stats|statistics|ticker|standings|league|leaderboard|scoreboard|fixtures?|results?)\b/i;
const SAMPLE_LABEL = /\b(?:sample|demo|demonstration|illustrative|example|placeholder)\b/i;
const MOTION = /from\s+["']framer-motion["']|\bmotion\.[a-z]+|<Reveal\b|\bwhileInView\b|\buseScroll\b|\banimate-[a-z]|\btransition(?:-[a-z]+)?\b|@keyframes|\bparallax\b/;
const IMAGE = /<img\b|<MediaFrame\b|backgroundImage|bg-\[url|<video\b|<picture\b/g;
const SECTION_VARIANT = /<section\b[^>]*\bdata-ut-variant\s*=\s*["']([^"']+)["']/g;

const STOP = new Set(['the', 'and', 'with', 'for', 'live', 'interactive', 'page', 'pages', 'site']);

/** Searchable words of a source file, with camelCase identifiers split. */
function wordsOf(source: string): string {
  return source.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
}

function termsOf(phrase: string): string[][] {
  return phrase.toLowerCase().replace(/^[a-z]+:\s*/, '').split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP.has(word))
    .map((word) => {
      const stem = word.replace(/(?:ies)$/, 'y').replace(/(?:es|s)$/, '');
      const variants = new Set([word, stem]);
      if (/centre$/.test(word)) variants.add(word.replace(/centre$/, 'center'));
      if (/center$/.test(word)) variants.add(word.replace(/center$/, 'centre'));
      return [...variants].filter((variant) => variant.length > 2);
    });
}

function mentions(words: string, terms: string[][]): boolean {
  return terms.length > 0 && terms.every((alternatives) => alternatives.some((term) => new RegExp(`\\b${term}`).test(words)));
}

function routedIn(router: string, page: CoveragePage): boolean {
  if (!router) return true;
  const importPath = page.filePath.replace(/^\/src\//, './').replace(/\.[jt]sx?$/, '');
  return router.includes(importPath) || router.includes(`"${page.route}"`) || router.includes(`'${page.route}'`);
}

function linkedIn(sources: readonly string[], route: string): boolean {
  if (route === '/') return true;
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?:to|href)\\s*=\\s*\\{?\\s*["'\`]${escaped}["'\`]|["'\`]${escaped}["'\`]`);
  return sources.some((source) => pattern.test(source));
}

const SECTION_TAG = /<section\b[^>]*>/g;
const EXPERIENCE_LAYER = /from\s+["']@\/unison\/ui\/experience["']|@react-three\/|from\s+["']three["']/;

function attribute(tag: string, name: string): string | null {
  return new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`).exec(tag)?.[1] ?? null;
}

function sealedPackId(files: Readonly<Record<string, string>>): string | null {
  for (const path of ['/.unison/wizard-registry-context.json', '/.unison/design-intervention.json']) {
    try {
      const parsed = JSON.parse(files[path] ?? '') as { artDirectionPackId?: unknown };
      if (typeof parsed.artDirectionPackId === 'string') return parsed.artDirectionPackId;
    } catch { /* absent or unreadable — try the next owner */ }
  }
  return null;
}

/**
 * Conversational creative decisions are checked against the exact source:
 * the certified design the owner's words selected (REUSE), a site-local
 * derivative marked with its base (ADAPT) or an original module (AUTHOR) on
 * the page the decision belongs to.
 */
function experienceCoverage(
  requirement: CreationRequirement,
  context: {
    files: Readonly<Record<string, string>>;
    pages: readonly CoveragePage[];
    pageSources: readonly string[];
    moduleWords: ReadonlyArray<{ path: string; words: string }>;
    adaptedModules: readonly string[];
    allSource: string;
  },
  promotionCandidates: RequirementCoverageReport['promotionCandidates'],
): RequirementCoverageItem {
  const design = requirement.design;
  const label = requirement.evidenceTerms?.[0] ? `${design?.family ?? 'design'}: "${requirement.evidenceTerms[0]}"` : requirement.text.split(' — ')[0];
  const base = { id: requirement.id, kind: requirement.kind, text: label };
  if (!design) return { ...base, status: 'unverified', evidence: ['no design target recorded'] };
  if (design.kind === 'art-direction') {
    const sealed = sealedPackId(context.files);
    if (!sealed) return { ...base, status: 'unverified', evidence: ['sealed art direction not in candidate files'] };
    return { ...base, status: sealed === design.packId ? 'met' : 'missing',
      evidence: [sealed === design.packId ? `sealed ${sealed}` : `sealed ${sealed}, owner direction was ${design.packId}`] };
  }
  if (design.kind === 'experience') {
    if (design.experience === 'standard') return { ...base, status: 'met', evidence: ['restrained motion budget'] };
    const layer = EXPERIENCE_LAYER.exec(context.allSource);
    const motion = MOTION.exec(context.allSource);
    const met = design.experience === 'immersive' ? Boolean(layer) : Boolean(motion || layer);
    return { ...base, status: met ? 'met' : motion ? 'partial' : 'missing',
      evidence: [met ? `${design.experience}: ${(layer ?? motion)![0].slice(0, 40)}` : motion ? 'motion only; no immersive layer' : 'no motion found'] };
  }
  const scoped = requirement.pageRoute
    ? context.pages.filter((page) => page.route.toLowerCase() === requirement.pageRoute!.toLowerCase())
    : context.pages;
  const scopedSources = scoped.map((page) => ({ path: page.filePath, source: context.files[page.filePath] ?? '' }));
  if (requirement.pageRoute && !scopedSources.some((entry) => entry.source.trim())) {
    return { ...base, status: 'missing', evidence: [`no page for ${requirement.pageRoute}`] };
  }
  const phrasings = [...(requirement.evidenceTerms ?? [])].map(termsOf).filter((terms) => terms.length);
  const matches = (text: string) => phrasings.some((terms) => mentions(text, terms));
  const family = design.family ?? '';
  const ids = design.implementationIds ?? [];
  const tags = scopedSources.flatMap((entry) => [...entry.source.matchAll(SECTION_TAG)].map((match) => ({ path: entry.path, tag: match[0] })));
  const familyTags = tags.filter(({ tag }) => attribute(tag, 'data-ut-section-type') === family
    || (attribute(tag, 'data-ut-variant') ?? '').startsWith(`${family}:`));
  const exact = familyTags.find(({ tag }) => ids.includes(attribute(tag, 'data-ut-variant') ?? ''));
  const derived = context.adaptedModules.find((path) => ids.some((id) => (context.files[path] ?? '').includes(`@unison-derived-from ${id}`)));
  const original = context.moduleWords.filter((entry) => matches(entry.words) && !context.adaptedModules.includes(entry.path)).map((entry) => entry.path);
  const custom = tags.find(({ tag }) => (attribute(tag, 'data-ut-variant') ?? '').startsWith('custom:') && matches(wordsOf(tag)));
  if (design.kind === 'original') {
    for (const path of original) promotionCandidates.push({ requirementId: requirement.id, modulePath: path });
    const mentioned = scopedSources.some((entry) => matches(wordsOf(entry.source)));
    return { ...base, status: original.length || custom ? 'met' : mentioned ? 'partial' : 'missing',
      evidence: original.length ? original.map((path) => `authored in ${path}`) : custom ? [`custom section in ${custom.path}`]
        : mentioned ? ['only mentioned in page copy; no original component implements it'] : ['no source implements it'] };
  }
  if (exact) return { ...base, status: 'met', evidence: [`${attribute(exact.tag, 'data-ut-variant')} in ${exact.path}`] };
  if (derived) return { ...base, status: 'met', evidence: [`adapted in ${derived}`] };
  if (design.resolution !== 'reuse' && (original.length || custom)) {
    return { ...base, status: 'met', evidence: original.length ? original.map((path) => `authored in ${path}`) : [`custom section in ${custom!.path}`] };
  }
  if (familyTags.length) {
    return { ...base, status: 'partial',
      evidence: [`used ${attribute(familyTags[0].tag, 'data-ut-variant') ?? family} instead of ${ids[0] ?? 'the requested design'}`] };
  }
  return { ...base, status: 'missing', evidence: [`no ${family} section${requirement.pageRoute ? ` on ${requirement.pageRoute}` : ''}`] };
}

export function buildRequirementCoverage(input: {
  requirements: readonly CreationRequirement[];
  files: Readonly<Record<string, string>>;
  pages: readonly CoveragePage[];
}): RequirementCoverageReport {
  const { files, pages } = input;
  const router = files['/src/App.tsx'] ?? '';
  const authoredModules = Object.keys(files).filter((path) => AUTHORED.test(path) && !CHROME.test(path) && /\.[jt]sx?$/.test(path)).sort();
  const adaptedModules = authoredModules.filter((path) => DERIVED.test(files[path] ?? ''));
  const chromeSources = Object.entries(files).filter(([path]) => CHROME.test(path) || /\/(?:Nav|Navbar|Header|Footer)\.[jt]sx?$/.test(path)).map(([, source]) => source);
  const pageSources = pages.map((page) => files[page.filePath] ?? '');
  const navSources = [...chromeSources, ...pageSources];
  const moduleWords = authoredModules.map((path) => ({ path, words: wordsOf(`${path} ${files[path]}`) }));
  const pageWords = pages.map((page) => ({ path: page.filePath, words: wordsOf(files[page.filePath] ?? '') }));
  const allSource = [...pageSources, ...authoredModules.map((path) => files[path] ?? '')].join('\n');

  let certifiedSections = 0;
  let customSections = 0;
  for (const source of pageSources) {
    for (const match of source.matchAll(SECTION_VARIANT)) {
      if (match[1].startsWith('custom:')) customSections += 1;
      else certifiedSections += 1;
    }
  }

  const generated = pages.filter((page) => (files[page.filePath] ?? '').trim()).map((page) => page.route);
  const routed = pages.filter((page) => (files[page.filePath] ?? '').trim() && routedIn(router, page)).map((page) => page.route);
  const inNavigation = pages.filter((page) => page.visibleInNav !== false && linkedIn(navSources, page.route)).map((page) => page.route);

  const items: RequirementCoverageItem[] = [];
  const promotionCandidates: RequirementCoverageReport['promotionCandidates'] = [];
  const requestedPages: string[] = [];
  for (const requirement of input.requirements) {
    const base = { id: requirement.id, kind: requirement.kind, text: requirement.text };
    switch (requirement.kind) {
      case 'page': {
        const route = requirement.pageRoute ?? '';
        requestedPages.push(route);
        const page = pages.find((candidate) => candidate.route.toLowerCase() === route.toLowerCase());
        const exists = Boolean(page && generated.includes(page.route));
        const isRouted = Boolean(page && routed.includes(page.route));
        const visible = Boolean(page && inNavigation.includes(page.route));
        items.push({ ...base,
          status: exists && isRouted && visible ? 'met' : exists ? 'partial' : 'missing',
          evidence: [exists ? `${page!.filePath} authored` : `no page for ${route}`, ...(exists ? [isRouted ? 'routed' : 'not routed', visible ? 'in navigation' : 'not linked from navigation'] : [])] });
        break;
      }
      case 'navigation': {
        const navigable = inNavigation.filter((route) => routed.includes(route));
        items.push({ ...base, status: navigable.length >= 2 ? 'met' : routed.length >= 2 ? 'partial' : 'missing',
          evidence: [`${routed.length} routed page(s)`, `${navigable.length} reachable from navigation`] });
        break;
      }
      case 'interaction': {
        // Any one phrasing evidences the experience (e.g. "flight status" or a DeparturesBoard module).
        const phrasings = [requirement.text, ...(requirement.evidenceTerms ?? [])].map(termsOf).filter((terms) => terms.length);
        const matches = (text: string) => phrasings.some((terms) => mentions(text, terms));
        const inModule = moduleWords.filter((entry) => matches(entry.words)).map((entry) => entry.path);
        const inPage = pageWords.filter((entry) => matches(entry.words)).map((entry) => entry.path);
        const customOnPage = pageSources.some((source) => [...source.matchAll(SECTION_VARIANT)]
          .some((match) => match[1].startsWith('custom:') && matches(wordsOf(match[0] + match[1]))));
        for (const path of inModule) if (!adaptedModules.includes(path)) promotionCandidates.push({ requirementId: requirement.id, modulePath: path });
        items.push({ ...base,
          status: inModule.length || customOnPage ? 'met' : inPage.length ? 'partial' : 'missing',
          evidence: inModule.length ? inModule.map((path) => `implemented in ${path}`)
            : inPage.length ? inPage.map((path) => `only mentioned in ${path}, no original section implements it`)
            : ['no source implements it'] });
        break;
      }
      case 'motion': {
        const found = MOTION.exec(allSource);
        items.push({ ...base, status: found ? 'met' : 'missing', evidence: [found ? `motion: ${found[0].slice(0, 40)}` : 'no motion found in page or component source'] });
        break;
      }
      case 'visual': {
        if (/^imagery:/.test(requirement.text)) {
          const images = (allSource.match(IMAGE) ?? []).length;
          items.push({ ...base, status: images >= 3 ? 'met' : images > 0 ? 'partial' : 'missing', evidence: [`${images} image/media element(s)`] });
        } else {
          items.push({ ...base, status: 'unverified', evidence: ['design judgement — review in Preview'] });
        }
        break;
      }
      case 'experience': {
        items.push(experienceCoverage(requirement, { files, pages, pageSources, moduleWords, adaptedModules, allSource }, promotionCandidates));
        break;
      }
      default:
        items.push({ ...base, status: 'unverified', evidence: [requirement.kind === 'capability' ? 'checked by capability authorization and bindings' : 'inspiration only'] });
    }
  }

  // Live-data experiences must use clearly labelled sample data unless a real
  // source is connected; fabricated scores or statistics never count as met.
  const liveIds = new Set(input.requirements
    .filter((requirement) => requirement.kind === 'interaction' && (requirement.sampleDataRequired || LIVE_DATA.test(requirement.text)))
    .map((requirement) => requirement.id));
  if (liveIds.size) {
    const implementing = items.filter((item) => liveIds.has(item.id) && item.status === 'met')
      .flatMap((item) => item.evidence.map((line) => line.replace(/^implemented in /, '')))
      .filter((path) => path in files);
    const labelled = implementing.length > 0 && implementing.every((path) => SAMPLE_LABEL.test(files[path] ?? ''));
    items.push({ id: 'req:data:labelled-sample', kind: 'data', text: 'live data is real or clearly labelled as sample data',
      status: implementing.length === 0 ? 'unverified' : labelled ? 'met' : 'missing',
      evidence: [implementing.length === 0 ? 'no live-data component yet' : labelled ? 'sample data is labelled' : 'live-looking data without a sample label'] });
  }

  const counts: Record<CoverageStatus, number> = { met: 0, partial: 0, missing: 0, unverified: 0 };
  for (const item of items) counts[item.status] += 1;
  const verifiable = items.filter((item) => item.status !== 'unverified');
  const complete = verifiable.every((item) => item.status === 'met');
  const open = items.filter((item) => item.status === 'missing' || item.status === 'partial');
  const summary = !items.length
    ? 'No explicit requirements to check.'
    : complete
      ? `All ${verifiable.length} checkable requests are built${counts.unverified ? `; ${counts.unverified} need a visual check in Preview` : ''}.`
      : `${counts.met} of ${verifiable.length} checkable requests are fully built; still open: ${open.slice(0, 4).map((item) => item.text.replace(/^[a-z]+:\s*/, '')).join('; ')}${open.length > 4 ? '…' : ''}.`;

  return {
    items,
    counts,
    complete,
    pages: {
      requested: requestedPages,
      generated,
      routed,
      inNavigation,
      missing: requestedPages.filter((route) => !generated.some((candidate) => candidate.toLowerCase() === route.toLowerCase())),
    },
    provenance: { certifiedSections, customSections, authoredModules, adaptedModules },
    summary,
    promotionCandidates: promotionCandidates.filter((candidate, index) =>
      promotionCandidates.findIndex((other) => other.modulePath === candidate.modulePath && other.requirementId === candidate.requirementId) === index),
  };
}
