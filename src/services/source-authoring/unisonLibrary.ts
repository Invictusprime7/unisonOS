/**
 * Unison design library as an OPTIONAL building block for source projects.
 *
 * Affinity may import library sections from the project's own `unison-ui`
 * folder (`import { HeroSplitImage } from '../unison-ui'`). Nothing requires
 * it. When a project imports one, the section's source and the files it needs
 * are copied in unchanged, plus a small generated adapter (`index.tsx`,
 * `theme.ts`, `tokens.css`) that lets authored code pass plain content props.
 * The project stays standalone: it builds and publishes without Unison.
 */

const LIBRARY_ROOT = '/src/design-system/unison-x-loveable-design-d5be96/design-system/unison/';
export const VENDOR_ROOT = '/src/unison-ui/';
const ADAPTER_MARKER = '// unison-ui sections:';

type RawLoader = () => Promise<string>;
const LIBRARY_SOURCES = import.meta.glob(
  [
    '/src/design-system/unison-x-loveable-design-d5be96/design-system/unison/**/*.{ts,tsx,css}',
    '!**/certification/**',
    '!**/runtime/**',
  ],
  { query: '?raw', import: 'default' },
) as Record<string, RawLoader>;

/** Folder → the section type its components render. */
const SECTION_TYPE_BY_FOLDER: Record<string, string> = {
  about: 'about', auth: 'auth-form', beforeAfter: 'before-after', blogPreview: 'blog-preview',
  contact: 'contact', cta: 'cta', dataTable: 'data-table', faq: 'faq', features: 'features',
  footer: 'footer', gallery: 'gallery', hero: 'hero', logoCloud: 'logo-cloud', navbar: 'navbar',
  pricing: 'pricing', services: 'services', stats: 'stats', team: 'team', testimonials: 'testimonials',
};

/** Package versions for library dependencies a section may need. */
const PACKAGE_VERSIONS: Record<string, string> = {
  'lucide-react': '^0.462.0',
  'framer-motion': '^11.11.0',
  '@radix-ui/react-dialog': '^1.1.2',
};

export interface LibrarySection {
  name: string;
  sectionType: string;
  /** Path inside the library root, e.g. `components/hero/HeroSplitImage.tsx`. */
  libraryPath: string;
}

const read = async (libraryPath: string): Promise<string | null> => {
  const loader = LIBRARY_SOURCES[`${LIBRARY_ROOT}${libraryPath}`];
  return loader ? loader() : null;
};

let catalogPromise: Promise<LibrarySection[]> | null = null;

/** Public canonical sections only (the library's `components/public.ts`). */
export function librarySections(): Promise<LibrarySection[]> {
  catalogPromise ??= (async () => {
    const publicTs = (await read('components/public.ts')) ?? '';
    const out: LibrarySection[] = [];
    for (const match of publicTs.matchAll(/import\s*\{\s*(\w+)\s*\}\s*from\s*'\.\/([\w/]+)'/g)) {
      const [, name, rel] = match;
      const folder = rel.split('/')[0];
      const sectionType = SECTION_TYPE_BY_FOLDER[folder];
      const libraryPath = `components/${rel}.tsx`;
      if (!sectionType || !(`${LIBRARY_ROOT}${libraryPath}` in LIBRARY_SOURCES)) continue;
      out.push({ name, sectionType, libraryPath });
    }
    return out.sort((a, b) => a.sectionType.localeCompare(b.sectionType) || a.name.localeCompare(b.name));
  })();
  return catalogPromise;
}

/** Advice block for Affinity's brief: how to use the library, what exists, which props each type takes. */
export async function libraryBriefBlock(): Promise<string> {
  const sections = await librarySections();
  const typesTs = (await read('types.ts')) ?? '';
  const start = typesTs.indexOf('/** Navigation link */');
  const end = typesTs.indexOf('// Registry Types');
  const props = start >= 0 && end > start ? typesTs.slice(start, end).replace(/\/\/ =+\n?/g, '').trim() : '';
  const byType = new Map<string, string[]>();
  for (const section of sections) byType.set(section.sectionType, [...(byType.get(section.sectionType) ?? []), section.name]);
  return [
    'UNISON DESIGN LIBRARY (optional — use a section only when it truly fits the owner\'s prompt; original code is always allowed):',
    '- Import named sections from the project folder src/unison-ui (from a page: import { HeroSplitImage } from \'../unison-ui\'). Unison copies the section source into that folder; do not write files under /src/unison-ui/ yourself.',
    '- Each section takes the content props of its section type below as plain JSX props (e.g. <HeroSplitImage headline="…" ctas={[{ label: \'Book\', href: \'/contact\' }]} />).',
    '- Sections read the HSL triplet variables --background --foreground --primary --primary-foreground --secondary --secondary-foreground --accent --accent-foreground --muted --muted-foreground --card --card-foreground --border (e.g. --primary: 7 72% 51%;) and --ut-font-display, --ut-font-sans, --ut-radius-base, --ut-section-space. When you use any section, define these in :root in /src/index.css to match your palette.',
    `Sections by type:\n${[...byType].map(([type, names]) => `- ${type}: ${names.join(', ')}`).join('\n')}`,
    props ? `Content props per section type (TypeScript):\n${props}` : '',
  ].filter(Boolean).join('\n');
}

const IMPORT_FROM = /(?:import|export)\s+(type\s+)?([^'";]*?)\s*from\s*["']([^"']+)["']/g;

function resolveRelative(fromDir: string, specifier: string): string {
  const stack = fromDir ? fromDir.split('/') : [];
  for (const seg of specifier.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') stack.pop(); else stack.push(seg);
  }
  return stack.join('/');
}

const VENDOR_SPECIFIER = /(?:^|\/)unison-ui(?:\/index(?:\.tsx?)?)?$/;

/** Section names that authored files import from the vendored adapter. */
export function requestedLibraryNames(files: Record<string, string>): Set<string> {
  const names = new Set<string>();
  for (const [path, source] of Object.entries(files)) {
    if (path.startsWith(VENDOR_ROOT) || !/\.[jt]sx?$/.test(path)) continue;
    for (const match of source.matchAll(IMPORT_FROM)) {
      const [, , clause, specifier] = match;
      const isVendor = specifier === '@/unison-ui' || ((specifier.startsWith('.') || specifier.startsWith('/'))
        && VENDOR_SPECIFIER.test(specifier)
        && `/${resolveRelative(path.slice(1, path.lastIndexOf('/')), specifier)}`.replace(/\/index(?:\.tsx?)?$/, '').replace(/\.tsx?$/, '') === VENDOR_ROOT.slice(0, -1));
      if (!isVendor) continue;
      const braces = clause.match(/\{([^}]*)\}/)?.[1] ?? '';
      for (const part of braces.split(',')) {
        const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]?.trim();
        if (name) names.add(name);
      }
    }
  }
  return names;
}

function vendoredNames(files: Record<string, string>): string[] {
  const line = files[`${VENDOR_ROOT}index.tsx`]?.split('\n').find((l) => l.startsWith(ADAPTER_MARKER));
  return line ? line.slice(ADAPTER_MARKER.length).split(',').map((n) => n.trim()).filter(Boolean) : [];
}

const THEME_TS = `import type { ThemeTokens } from './types';

/** Library sections read the site's own CSS variables, so they follow its palette and fonts. */
export const unisonTheme: ThemeTokens = {
  colors: {
    primary: 'var(--primary)', primaryForeground: 'var(--primary-foreground)',
    secondary: 'var(--secondary)', secondaryForeground: 'var(--secondary-foreground)',
    accent: 'var(--accent)', accentForeground: 'var(--accent-foreground)',
    background: 'var(--background)', foreground: 'var(--foreground)',
    muted: 'var(--muted)', mutedForeground: 'var(--muted-foreground)',
    card: 'var(--card)', cardForeground: 'var(--card-foreground)',
    border: 'var(--border)',
  },
  typography: {
    headingFont: 'var(--ut-font-display)',
    bodyFont: 'var(--ut-font-sans)',
    headingWeight: '600',
    bodyWeight: '400',
  },
  radius: 'var(--ut-radius-base)',
  sectionPadding: 'var(--ut-section-space) 1.5rem',
  containerWidth: '1200px',
};
`;

function adapterSource(sections: LibrarySection[]): string {
  const lines = [
    `${ADAPTER_MARKER} ${sections.map((s) => s.name).join(', ')}`,
    '// Generated by Unison when this project used library sections. Edit freely; it is your code.',
    "import type { SectionPropsMap } from './types';",
    "import { unisonTheme } from './theme';",
    "import './tokens.css';",
    ...sections.map((s) => `import { ${s.name} as ${s.name}Section } from './${s.libraryPath.replace(/\.tsx$/, '')}';`),
    '',
    ...sections.map((s) => [
      `export function ${s.name}({ id = '${s.sectionType}', ...props }: SectionPropsMap['${s.sectionType}'] & { id?: string }) {`,
      `  return <${s.name}Section section={{ id, type: '${s.sectionType}', props: props as SectionPropsMap['${s.sectionType}'] }} theme={unisonTheme} />;`,
      '}',
    ].join('\n')),
  ];
  return `${lines.join('\n')}\n`;
}

function lowPriorityTokens(css: string): string {
  // Defaults only: zero-specificity selectors so the site's own :root values always win.
  return css
    .replace(/^:root\s*\{/m, ':where(:root) {')
    .replace(/^\[data-theme="dark"\]\s*\{/m, ':where([data-theme="dark"]) {');
}

export interface VendorResult {
  /** Files to add or replace (vendored library sources + adapter). */
  writes: Record<string, string>;
  /** Packages the vendored sources import, to add to package.json. */
  packages: Record<string, string>;
  /** Names the project imports that the library does not provide. */
  unknown: string[];
}

/**
 * Copies the library sections a project imports (and everything they import)
 * into /src/unison-ui/. Returns no writes when nothing new is needed.
 */
export async function vendorLibrarySections(files: Record<string, string>): Promise<VendorResult> {
  const requested = requestedLibraryNames(files);
  const empty: VendorResult = { writes: {}, packages: {}, unknown: [] };
  if (requested.size === 0) return empty;
  const catalog = await librarySections();
  const byName = new Map(catalog.map((s) => [s.name, s]));
  const unknown = [...requested].filter((name) => !byName.has(name));
  const already = vendoredNames(files);
  const wanted = [...new Set([...already, ...requested])].filter((name) => byName.has(name)).sort();
  if (wanted.length === already.length && wanted.every((n, i) => n === [...already].sort()[i])) return { ...empty, unknown };

  const sections = wanted.map((name) => byName.get(name)!);
  const writes: Record<string, string> = {};
  const packages: Record<string, string> = {};
  const queue = ['types.ts', 'themeUtils.ts', ...sections.map((s) => s.libraryPath)];
  const seen = new Set<string>();
  const extensions = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
  while (queue.length) {
    const libraryPath = queue.shift()!;
    if (seen.has(libraryPath)) continue;
    seen.add(libraryPath);
    const text = await read(libraryPath);
    if (text === null) continue;
    writes[`${VENDOR_ROOT}${libraryPath}`] = text;
    const dir = libraryPath.includes('/') ? libraryPath.slice(0, libraryPath.lastIndexOf('/')) : '';
    const specifiers = [
      ...[...text.matchAll(IMPORT_FROM)].map((m) => m[3]),
      ...[...text.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]),
    ];
    for (const specifier of specifiers) {
      if (specifier.startsWith('.')) {
        const base = resolveRelative(dir, specifier);
        const hit = extensions.map((ext) => `${base}${ext}`).find((p) => `${LIBRARY_ROOT}${p}` in LIBRARY_SOURCES);
        if (hit) queue.push(hit);
      } else if (!specifier.startsWith('react') || specifier.startsWith('react-')) {
        const root = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
        if (root !== 'react' && root !== 'react-dom') packages[root] = PACKAGE_VERSIONS[root] ?? 'latest';
      }
    }
  }
  writes[`${VENDOR_ROOT}theme.ts`] = THEME_TS;
  writes[`${VENDOR_ROOT}tokens.css`] = lowPriorityTokens((await read('styles/tokens.css')) ?? ':where(:root) {}\n');
  writes[`${VENDOR_ROOT}index.tsx`] = adapterSource(sections);
  return { writes, packages, unknown };
}

/** Applies a vendor result to a file map, adding missing packages to package.json. */
export function applyVendorResult(files: Record<string, string>, result: VendorResult): Record<string, string> {
  if (Object.keys(result.writes).length === 0) return files;
  const next = { ...files, ...result.writes };
  const missing = Object.entries(result.packages);
  if (missing.length && next['/package.json']) {
    try {
      const pkg = JSON.parse(next['/package.json']) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      const declared = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      const add = missing.filter(([name]) => !(name in declared));
      if (add.length) {
        pkg.dependencies = { ...(pkg.dependencies ?? {}), ...Object.fromEntries(add) };
        next['/package.json'] = `${JSON.stringify(pkg, null, 2)}\n`;
      }
    } catch { /* an invalid package.json is reported by the source checks */ }
  }
  return next;
}
