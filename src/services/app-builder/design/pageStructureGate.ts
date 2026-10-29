/**
 * Structural floor every App Builder page must clear before it is accepted:
 * shared site chrome (nav + footer), a real body composition, and imagery on
 * media-led pages. Shared chrome must come from the compiler-owned site shell;
 * page-local landmarks are not substitutes.
 */

import { CONTEXTUAL_IMAGES } from '@/utils/sandpackFilePrep';

export interface PageStructureRequirement {
  role: string;
  /** Minimum rendered body sections (excluding nav/footer). */
  minSections: number;
  /** Whether this page must show real photography. */
  imageLed: boolean;
  /** Verified photo URLs the author may use (named in the repair message). */
  photoUrls?: readonly string[];
}

const IMAGE_LED_ROLES = new Set(['home', 'gallery', 'work', 'portfolio', 'about', 'shop', 'products', 'collection', 'menu']);

export function isImageLedRole(role: string): boolean {
  return IMAGE_LED_ROLES.has(role);
}

/**
 * Verified, reachable photos for an industry. The author has no image catalog
 * of its own, so without these it either ships a text-only page (rejected by
 * this gate) or invents ids that 404.
 */
export function verifiedPhotosFor(industry: string | undefined, count = 6): string[] {
  const key = (industry ?? '').toLowerCase();
  const pool = CONTEXTUAL_IMAGES[key] ?? [];
  const merged = [...pool, ...CONTEXTUAL_IMAGES.default, ...CONTEXTUAL_IMAGES.agency, ...CONTEXTUAL_IMAGES.portfolio];
  return [...new Set(merged)].slice(0, count).map((url) => url.replace(/\?.*$/, '?w=1600&q=80'));
}

export function pageStructureRequirement(role: string, contractMinSections?: number, photoUrls?: readonly string[]): PageStructureRequirement {
  const floor = role === 'home' ? 3 : 2;
  return {
    role,
    minSections: Math.max(floor, Math.min(contractMinSections ?? floor, 4)),
    imageLed: IMAGE_LED_ROLES.has(role),
    photoUrls,
  };
}

const LOCAL_IMPORT = /import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"]((?:\.{1,2}\/|@\/)[^'"]+)['"]/g;
const IMAGE_SIGNAL = /<img\b|\bbackgroundImage\b|url\(\s*['"`]?https?:|['"`]https?:\/\/[^'"`\s]+\.(?:jpe?g|png|webp|avif)|['"`]https?:\/\/images\.unsplash\.com|\b(?:image|imageUrl|imageSrc|src|images|photo|photos|media|cover|poster)\s*[:=]\s*[{'"`[]/i;
const NAV_NAME = /(?:Nav|Navbar|Navigation|Header|Menu)\b/;
const FOOTER_NAME = /Footer\b/;

function resolveImport(specifier: string, from: string, files: Readonly<Record<string, string>>): string | undefined {
  let base: string;
  if (specifier.startsWith('@/')) base = `/src/${specifier.slice(2)}`;
  else {
    const parts = from.split('/').slice(0, -1);
    for (const seg of specifier.split('/')) {
      if (seg === '..') parts.pop();
      else if (seg !== '.') parts.push(seg);
    }
    base = parts.join('/');
  }
  base = base.replace(/\.(?:tsx|ts|jsx|js)$/, '');
  for (const ext of ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']) {
    if (files[base + ext] !== undefined) return base + ext;
  }
  return undefined;
}

interface ImportedComponent { name: string; path?: string; specifier: string }

function importedComponents(path: string, source: string, files: Readonly<Record<string, string>>): ImportedComponent[] {
  const out: ImportedComponent[] = [];
  for (const match of source.matchAll(LOCAL_IMPORT)) {
    const resolved = resolveImport(match[3], path, files);
    const names = [
      ...(match[1] ? [match[1]] : []),
      ...(match[2] ?? '').split(',').map((n) => n.trim().split(/\s+as\s+/).pop()!.trim()).filter(Boolean),
    ].filter((n) => /^[A-Z]/.test(n));
    for (const name of names) out.push({ name, path: resolved, specifier: match[3] });
  }
  return out;
}

function rendered(source: string, name: string): boolean {
  return new RegExp(`<${name}(?=[\\s/>])`).test(source);
}

function renderCount(source: string, name: string): number {
  return [...source.matchAll(new RegExp(`<${name}(?=[\\s/>])`, 'g'))].length;
}

export function findPageStructureIssues(
  path: string,
  source: string,
  files: Readonly<Record<string, string>>,
  requirement: PageStructureRequirement,
): string[] {
  const issues: string[] = [];
  const used = importedComponents(path, source, files).filter((c) => rendered(source, c.name));
  const usedSources = used.map((c) => (c.path ? files[c.path] ?? '' : ''));
  const navIndex = source.indexOf('<SiteNav');
  const mainIndex = source.search(/<main\b/);
  const mainCloseIndex = source.lastIndexOf('</main>');
  const footerIndex = source.indexOf('<SiteFooter');

  const hasNav = used.some((component) => component.name === 'SiteNav'
    && component.path === '/src/project-components/site/SiteNav.tsx')
    && renderCount(source, 'SiteNav') === 1
    && mainIndex >= 0 && navIndex >= 0 && navIndex < mainIndex;
  const hasFooter = used.some((component) => component.name === 'SiteFooter'
    && component.path === '/src/project-components/site/SiteFooter.tsx')
    && renderCount(source, 'SiteFooter') === 1
    && mainCloseIndex >= 0 && footerIndex > mainCloseIndex;
  if (!hasNav) {
    issues.push(`${path} renders no site navigation from the canonical shared SiteNav at @/project-components/site/SiteNav exactly once before <main>.`);
  }
  if (!hasFooter) {
    issues.push(`${path} renders no site footer from the canonical shared SiteFooter at @/project-components/site/SiteFooter exactly once after </main>.`);
  }

  const bodyComponents = used.filter((c) => !NAV_NAME.test(c.name) && !FOOTER_NAME.test(c.name) && !/\/(?:components|unison)\/ui(?:\/|$)|\/lib\//.test(c.specifier));
  const sectionTags = (source.match(/<section\b/g) ?? []).length;
  const sections = sectionTags + bodyComponents.length;
  if (sections < requirement.minSections) {
    issues.push(`${path} has only ${sections} body section(s); the ${requirement.role} page needs at least ${requirement.minSections} distinct sections that follow its COMPOSITION TARGET (hero plus the suggested section order, using certified design sources or project-local components).`);
  }

  if (requirement.imageLed) {
    const hasImagery = IMAGE_SIGNAL.test(source) || usedSources.some((s) => IMAGE_SIGNAL.test(s))
      || used.some((c) => c.specifier.includes('/unison/design-sources/') && /Gallery|Hero(?!PageTitle|Underline|Centered)|AboutImage|Team|BeforeAfter/.test(c.name));
    if (!hasImagery) {
      const examples = requirement.photoUrls?.length
        ? ` Render them as <img src="..."> with these verified URLs (copy exactly, do not invent others): ${requirement.photoUrls.slice(0, 4).join(' , ')}`
        : '';
      issues.push(`${path} shows no photography. The ${requirement.role} page is image-led: use real business-appropriate photos (an image-led hero, gallery or media split), never a text-only page.${examples}`);
    }
  }
  return issues;
}
