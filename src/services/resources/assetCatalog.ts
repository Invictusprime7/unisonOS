/**
 * Asset catalog — the Playground "Manage → Assets" projection over the
 * Resource Runtime. Pure, read-only: it groups resources, ranks them for the
 * site's industry, detects which ones the generated pages actually use, and
 * indexes rendered `data-ut-resource` marks. It stores nothing.
 */
import { listCatalogSurfaces } from '@/platform/core/catalogSurfaceRegistry';
import { normalizeIndustryKey } from '@/platform/core/industryMatrix';
import { listResources, getResource, BUSINESS_PROFILE_RESOURCE_KEY } from './resourceRegistry';
import type { ResourceDefinition } from './resourceTypes';

export type AssetGroup = 'catalog' | 'content' | 'business' | 'media';

export interface AssetType {
  key: string;
  group: AssetGroup;
  label: string;
  def: ResourceDefinition | null;
  /** Generated pages render this type. */
  used: boolean;
  /** Industry relevance score (higher = more relevant). */
  rank: number;
}

/** Content-group catalog surfaces (proof & storytelling, not sellable items). */
const CONTENT_SURFACES = new Set(['testimonials', 'portfolio']);
const HIDDEN_SURFACES = new Set(['availability']);

/** Data-only industry relevance. Keys are surface ids / content slugs. */
const INDUSTRY_RANK: Record<string, string[]> = {
  saas: ['pricing', 'testimonials', 'articles', 'case-studies', 'portfolio'],
  salon: ['services', 'pricing', 'testimonials', 'team', 'gallery', 'offers'],
  restaurant: ['menu', 'offers', 'testimonials', 'gallery', 'faq'],
  ecommerce: ['products', 'offers', 'testimonials', 'faq'],
  agency: ['portfolio', 'case-studies', 'articles', 'services', 'testimonials', 'team', 'pricing'],
  'local-service': ['services', 'pricing', 'testimonials', 'faq', 'gallery'],
  coaching: ['services', 'pricing', 'testimonials', 'faq', 'case-studies', 'articles'],
  fitness: ['pricing', 'services', 'team', 'testimonials', 'gallery'],
  photography: ['portfolio', 'gallery', 'pricing', 'testimonials'],
  portfolio: ['portfolio', 'gallery', 'testimonials', 'pricing', 'articles'],
  'real-estate': ['portfolio', 'team', 'testimonials', 'faq'],
  nonprofit: ['case-studies', 'team', 'testimonials', 'faq', 'gallery'],
};

export function normalizeIndustry(industry?: string | null): string {
  const key = String(industry ?? '').trim().toLowerCase().replace(/_/g, '-');
  if (/salon|barber|spa|beauty|wellness/.test(key)) return 'salon';
  if (/restaurant|cafe|food|bakery|bar/.test(key)) return 'restaurant';
  if (/shop|store|commerce|retail/.test(key)) return 'ecommerce';
  if (/agency|studio|design|marketing|legal|consult/.test(key)) return 'agency';
  if (/photo/.test(key)) return 'photography';
  if (/real/.test(key)) return 'real-estate';
  if (/fitness|gym|yoga/.test(key)) return 'fitness';
  if (/coach/.test(key)) return 'coaching';
  if (/nonprofit|charity/.test(key)) return 'nonprofit';
  if (key.includes('service') || /hvac|clean|contract|plumb|dental|health/.test(key)) return 'local-service';
  return normalizeIndustryKey(key);
}

function rankFor(industry: string, key: string): number {
  const list = INDUSTRY_RANK[industry] ?? [];
  const i = list.indexOf(key.replace(/^content:/, ''));
  return i < 0 ? 0 : list.length - i;
}

/** Which surfaces/content types the generated source renders. */
export function detectUsedAssetKeys(vfsFiles: Record<string, string>): Set<string> {
  const source = Object.entries(vfsFiles)
    .filter(([p]) => /\.(t|j)sx?$/.test(p) && !p.includes('/.unison/'))
    .map(([, c]) => c)
    .join('\n');
  const used = new Set<string>();
  for (const m of source.matchAll(/data-ut-resource=["'{`]+([a-z0-9:_-]+)#/g)) used.add(getResource(m[1])?.key ?? m[1]);
  for (const s of listCatalogSurfaces()) {
    const names = [s.componentType, ...s.aliases].filter((n) => /^[A-Z]/.test(n));
    if (names.some((n) => new RegExp(`\\b${n}\\b`).test(source))) used.add(s.surfaceId);
  }
  const words: Record<string, RegExp> = {
    'content:faq': /\bFAQ|faq/,
    'content:team': /\bTeam[A-Z]\w*|team-member/,
    'content:case-studies': /CaseStud|case-stud/i,
    'content:gallery': /Gallery[A-Z]\w*/,
    'content:articles': /Insight|Article|BlogPreview|Essay|Journal/,
  };
  for (const [k, re] of Object.entries(words)) if (re.test(source)) used.add(k);
  return used;
}

export function listAssetTypes(opts: { industry?: string | null; vfsFiles?: Record<string, string> }): AssetType[] {
  const industry = normalizeIndustry(opts.industry);
  const used = detectUsedAssetKeys(opts.vfsFiles ?? {});
  const out: AssetType[] = [];
  for (const def of listResources()) {
    if (def.key === BUSINESS_PROFILE_RESOURCE_KEY) continue;
    if (HIDDEN_SURFACES.has(def.key)) continue;
    const group: AssetGroup = def.kind === 'content' || CONTENT_SURFACES.has(def.key) ? 'content' : 'catalog';
    out.push({ key: def.key, group, label: def.label, def, used: used.has(def.key), rank: rankFor(industry, def.key) });
  }
  return out.sort((a, b) => Number(b.used) - Number(a.used) || b.rank - a.rank || a.label.localeCompare(b.label));
}

/** Relevant = rendered on the site, or ranked for this industry. */
export function isRelevantAsset(t: AssetType): boolean {
  return t.used || t.rank > 0;
}

/** RenderedResourceIndex: record mark → files that render it. */
export function buildRenderedResourceIndex(vfsFiles: Record<string, string>): Map<string, string[]> {
  const idx = new Map<string, string[]>();
  for (const [path, code] of Object.entries(vfsFiles)) {
    for (const m of code.matchAll(/data-ut-resource=["']([a-z0-9:_-]+#[^."'#\s]+)/g)) {
      const list = idx.get(m[1]) ?? [];
      if (!list.includes(path)) list.push(path);
      idx.set(m[1], list);
    }
  }
  return idx;
}

/** Media: every image the generated pages show. */
export function listSiteImages(vfsFiles: Record<string, string>): { url: string; files: string[] }[] {
  const map = new Map<string, string[]>();
  for (const [path, code] of Object.entries(vfsFiles)) {
    if (!/\.(t|j)sx?$/.test(path)) continue;
    for (const m of code.matchAll(/["'`](https?:\/\/[^"'`\s]+\.(?:png|jpe?g|webp|avif|gif)[^"'`\s]*|https:\/\/images\.unsplash\.com\/[^"'`\s]+)["'`]/gi)) {
      const list = map.get(m[1]) ?? [];
      if (!list.includes(path)) list.push(path);
      map.set(m[1], list);
    }
  }
  return [...map.entries()].map(([url, files]) => ({ url, files }));
}
