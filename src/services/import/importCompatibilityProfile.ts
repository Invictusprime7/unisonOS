/**
 * UIMP-01 Phase C — read-only compatibility profile for imported source.
 *
 * Detects what the project IS (framework, toolchain, routes, styles, fonts,
 * aliases, environment names, server capabilities, any Unison brief) without
 * changing a byte. The profile also decides honestly whether Unison has a
 * source-compatible Preview runtime for it. Plain HTML sites run unchanged in
 * an isolated frame; frameworks that need their own build worker resolve to a
 * blocked adapter with a reason — Unison never substitutes its own runtime or
 * components to "make it render".
 */
import { STATIC_HTML_PREVIEW_ADAPTER } from './staticHtmlPreview';
import type { ImportManifest } from './secureIntake';
import { planSourceBuild, SOURCE_BUILD_ADAPTER } from '@/services/import/sourceBuild/sourceBuildPlan';

export type ImportFramework =
  | 'tanstack-start'
  | 'next'
  | 'remix'
  | 'react-router-framework'
  | 'astro'
  | 'sveltekit'
  | 'nuxt'
  | 'vue-vite'
  | 'vite-react'
  | 'create-react-app'
  | 'static-html'
  | 'react-source-only'
  | 'unknown';

export type RouteSystem =
  | 'tanstack-file-routes'
  | 'next-app-router'
  | 'next-pages-router'
  | 'remix-routes'
  | 'react-router'
  | 'astro-pages'
  | 'sveltekit-routes'
  | 'static-pages'
  | 'none';

export interface ImportedRoute {
  path: string;
  file: string;
  kind: 'page' | 'layout' | 'server' | 'root';
}

export interface ImportCompatibilityProfile {
  version: 1;
  framework: ImportFramework;
  frameworkEvidence: string[];
  packageManager: 'bun' | 'pnpm' | 'yarn' | 'npm' | 'deno' | 'unknown';
  lockfile: string | null;
  packageName: string | null;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  toolchain: {
    typescript: boolean;
    vite: boolean;
    tailwind: '3' | '4' | null;
    tailwindEvidence: string[];
    configFiles: string[];
  };
  entrypoints: string[];
  routing: { system: RouteSystem; routes: ImportedRoute[] };
  styles: { stylesheets: string[]; globalStylesheets: string[]; fontFamilies: string[]; fontFiles: string[]; remoteFontUrls: string[] };
  aliases: Record<string, string>;
  envNames: string[];
  serverCapabilities: string[];
  externalServices: string[];
  unisonBrief: { path: string; projectName: string | null; industry: string | null; pages: string[]; artDirection: string | null } | null;
  nestedAppRoots: string[];
  counts: { files: number; sourceFiles: number; assets: number; excluded: number };
  previewAdapter: { status: 'available' | 'unavailable'; adapter: string | null; reason: string; requires: string[] };
}

/** Static sites run in the browser itself, so their original files can run unchanged. */
export const STATIC_HTML_ADAPTER_INFO: ImportCompatibilityProfile['previewAdapter'] = {
  status: 'available',
  adapter: STATIC_HTML_PREVIEW_ADAPTER,
  reason: 'Runs the original HTML, styles and scripts unchanged in an isolated frame. Local file links point at the saved files; nothing in the saved source is changed.',
  requires: [],
};

export const ISOLATED_SOURCE_PREVIEW_ADAPTER = 'isolated-source-worker-v1';

/**
 * Live adapter decision for an imported revision. Imports saved before an
 * adapter existed keep their frozen profile record, so the decision is made
 * from the detected framework and the files actually present.
 */
export function resolveImportPreviewAdapter(profile: ImportCompatibilityProfile, files: Record<string, string>): ImportCompatibilityProfile['previewAdapter'] {
  if (profile.framework === 'static-html' && Object.keys(files).some((p) => /\.html?$/i.test(p) && !p.startsWith('/.unison-import/'))) return STATIC_HTML_ADAPTER_INFO;
  const sourceBuild = planSourceBuild(profile, files);
  if (sourceBuild.status === 'supported') {
    return {
      status: 'available',
      adapter: SOURCE_BUILD_ADAPTER,
      reason: `${sourceBuild.reason} The project runs in a sealed frame with no access to your Unison account.`,
      requires: [],
    };
  }
  if (profile.scripts.dev || profile.scripts.start) {
    return {
      status: 'unavailable',
      adapter: ISOLATED_SOURCE_PREVIEW_ADAPTER,
      reason: `${sourceBuild.reason} It can preview only on a build server running its own toolchain, which is not configured in this environment, so Unison will not substitute or rewrite the imported design.`,
      requires: [...new Set([...profile.previewAdapter.requires, 'isolated preview worker'])],
    };
  }
  return profile.previewAdapter;
}

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

function parseJsonLoose<T>(text: string | undefined): T | null {
  if (typeof text !== 'string') return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    // tsconfig/jsconfig allow comments and trailing commas.
    try {
      const stripped = text
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:"'])\/\/.*$/gm, '$1')
        .replace(/,(\s*[}\]])/g, '$1');
      return JSON.parse(stripped) as T;
    } catch {
      return null;
    }
  }
}

const has = (deps: Record<string, string>, name: string) => Object.prototype.hasOwnProperty.call(deps, name);
const majorOf = (range: string | undefined) => {
  const m = /(\d+)/.exec(range ?? '');
  return m ? Number(m[1]) : null;
};

function tanstackRoutePath(rel: string): ImportedRoute {
  // rel is relative to the routes directory, extension removed.
  if (rel === '__root') return { path: '/', file: rel, kind: 'root' };
  const segments = rel.split('/').flatMap((part) => part.split('.'));
  const out: string[] = [];
  for (const seg of segments) {
    if (seg === 'index' || seg === 'route' || seg === '') continue;
    if (seg.startsWith('_') || (seg.startsWith('(') && seg.endsWith(')'))) continue; // pathless layout / group
    if (seg === '$') out.push('*');
    else if (seg.startsWith('$')) out.push(`:${seg.slice(1)}`);
    else out.push(seg.replace(/_$/, ''));
  }
  const last = rel.split('/').pop() ?? '';
  const isLayout = last.startsWith('_') && !last.includes('.');
  return { path: `/${out.join('/')}`.replace(/\/+$/, '') || '/', file: rel, kind: isLayout ? 'layout' : 'page' };
}

function nextRoutePath(rel: string, system: 'app' | 'pages'): ImportedRoute | null {
  const parts = rel.split('/');
  const leaf = parts[parts.length - 1];
  if (system === 'app') {
    if (!/^(page|route|layout)$/.test(leaf)) return null;
    const segs = parts.slice(0, -1).filter((s) => !(s.startsWith('(') && s.endsWith(')')) && !s.startsWith('@'))
      .map((s) => s.replace(/^\[\.\.\.(.+)\]$/, '*').replace(/^\[(.+)\]$/, ':$1'));
    return { path: `/${segs.join('/')}`.replace(/\/+$/, '') || '/', file: rel, kind: leaf === 'route' ? 'server' : leaf === 'layout' ? 'layout' : 'page' };
  }
  if (leaf.startsWith('_')) return null;
  const segs = parts.map((s) => s.replace(/^\[\.\.\.(.+)\]$/, '*').replace(/^\[(.+)\]$/, ':$1')).filter((s) => s !== 'index');
  return { path: `/${segs.join('/')}`.replace(/\/+$/, '') || '/', file: rel, kind: parts[0] === 'api' ? 'server' : 'page' };
}

const SOURCE_FILE = /\.(tsx?|jsx?|mjs|cjs|mts|cts|vue|svelte|astro|mdx)$/;

export function analyzeImportedProject(input: {
  manifest: ImportManifest;
  textFiles: Record<string, string>;
}): ImportCompatibilityProfile {
  const { manifest, textFiles } = input;
  const paths = manifest.files.map((f) => f.path);
  const pathSet = new Set(paths);
  const pkg = parseJsonLoose<PackageJson>(textFiles['package.json']) ?? {};
  const dependencies = { ...(pkg.dependencies ?? {}) };
  const devDependencies = { ...(pkg.devDependencies ?? {}) };
  const all = { ...(pkg.peerDependencies ?? {}), ...devDependencies, ...dependencies };
  const evidence: string[] = [];
  const configFiles = paths.filter((p) => !p.includes('/') && /\.(config|rc)\.(c|m)?(t|j)s$|^(tsconfig|jsconfig)(\..+)?\.json$|^(vercel|netlify|wrangler)\.(json|toml)$|^components\.json$|^postcss\.config/.test(p));

  // ── framework ────────────────────────────────────────────────────────────
  let framework: ImportFramework = 'unknown';
  const routesDir = ['src/routes', 'app/routes'].find((dir) => paths.some((p) => p.startsWith(`${dir}/`))) ?? null;
  if (has(all, '@tanstack/react-start') || has(all, '@tanstack/start') || has(all, '@tanstack/solid-start')) {
    framework = 'tanstack-start';
    evidence.push(`package.json depends on ${['@tanstack/react-start', '@tanstack/start', '@tanstack/solid-start'].find((d) => has(all, d))}`);
  } else if (has(all, 'next')) {
    framework = 'next';
    evidence.push('package.json depends on next');
  } else if (has(all, '@remix-run/react') || has(all, '@remix-run/dev')) {
    framework = 'remix';
    evidence.push('package.json depends on Remix');
  } else if (has(all, '@react-router/dev')) {
    framework = 'react-router-framework';
    evidence.push('package.json depends on @react-router/dev');
  } else if (has(all, 'astro')) {
    framework = 'astro';
    evidence.push('package.json depends on astro');
  } else if (has(all, '@sveltejs/kit')) {
    framework = 'sveltekit';
    evidence.push('package.json depends on @sveltejs/kit');
  } else if (has(all, 'nuxt')) {
    framework = 'nuxt';
    evidence.push('package.json depends on nuxt');
  } else if (has(all, 'vue') && has(all, 'vite')) {
    framework = 'vue-vite';
    evidence.push('package.json depends on vue + vite');
  } else if (has(all, 'react-scripts')) {
    framework = 'create-react-app';
    evidence.push('package.json depends on react-scripts');
  } else if (has(all, 'react') && (has(all, 'vite') || paths.some((p) => /^vite\.config\./.test(p)))) {
    framework = 'vite-react';
    evidence.push('package.json depends on react + vite');
  } else if (!textFiles['package.json'] && paths.some((p) => /\.html?$/.test(p)) && !paths.some((p) => SOURCE_FILE.test(p) && !p.endsWith('.js'))) {
    framework = 'static-html';
    evidence.push('HTML pages without a package manifest');
  } else if (paths.some((p) => /\.(tsx|jsx)$/.test(p))) {
    framework = 'react-source-only';
    evidence.push('React source files without a package manifest');
  }
  if (framework === 'tanstack-start' && pathSet.has('app.config.ts')) evidence.push('app.config.ts present');
  if (framework === 'tanstack-start' && paths.some((p) => /routeTree\.gen\.ts$/.test(p))) evidence.push('generated route tree present');

  // ── package manager ──────────────────────────────────────────────────────
  const lockfile = ['bun.lock', 'bun.lockb', 'pnpm-lock.yaml', 'yarn.lock', 'package-lock.json', 'deno.lock'].find((f) => pathSet.has(f)) ?? null;
  const packageManager: ImportCompatibilityProfile['packageManager'] = lockfile?.startsWith('bun') ? 'bun'
    : lockfile === 'pnpm-lock.yaml' ? 'pnpm'
      : lockfile === 'yarn.lock' ? 'yarn'
        : lockfile === 'package-lock.json' ? 'npm'
          : lockfile === 'deno.lock' || pathSet.has('deno.json') ? 'deno' : 'unknown';

  // ── styles / tailwind / fonts ────────────────────────────────────────────
  const stylesheets = paths.filter((p) => /\.(css|scss|sass|less|pcss)$/.test(p));
  const tailwindEvidence: string[] = [];
  let tailwind: '3' | '4' | null = null;
  const twMajor = majorOf(all.tailwindcss);
  if (has(all, '@tailwindcss/vite') || has(all, '@tailwindcss/postcss')) {
    tailwind = '4';
    tailwindEvidence.push(has(all, '@tailwindcss/vite') ? '@tailwindcss/vite dependency' : '@tailwindcss/postcss dependency');
  } else if (twMajor !== null) {
    tailwind = twMajor >= 4 ? '4' : '3';
    tailwindEvidence.push(`tailwindcss@${all.tailwindcss}`);
  }
  const globalStylesheets: string[] = [];
  const fontFamilies = new Set<string>();
  const remoteFontUrls = new Set<string>();
  for (const sheet of stylesheets) {
    const css = textFiles[sheet] ?? '';
    if (/@import\s+["']tailwindcss["']|@theme\b/.test(css)) {
      if (!tailwind) tailwind = '4';
      tailwindEvidence.push(`${sheet} uses Tailwind 4 directives`);
      globalStylesheets.push(sheet);
    } else if (/@tailwind\s+(base|components|utilities)/.test(css)) {
      if (!tailwind) tailwind = '3';
      tailwindEvidence.push(`${sheet} uses Tailwind 3 directives`);
      globalStylesheets.push(sheet);
    } else if (/(^|\n)\s*(:root|html|body)\s*[{,]/.test(css)) {
      globalStylesheets.push(sheet);
    }
    for (const m of css.matchAll(/@font-face\s*{[^}]*font-family\s*:\s*["']?([^;"'}]+)["']?/g)) fontFamilies.add(m[1].trim());
    for (const m of css.matchAll(/--font-[\w-]+\s*:\s*["']?([^,;"']+)/g)) fontFamilies.add(m[1].trim());
    for (const m of css.matchAll(/https?:\/\/fonts\.(?:googleapis|gstatic|bunny)\.[a-z.]+\/[^\s"')]+/g)) remoteFontUrls.add(m[0]);
  }
  for (const [path, text] of Object.entries(textFiles)) {
    if (!/\.(html?|tsx?|jsx?)$/.test(path)) continue;
    for (const m of text.matchAll(/https?:\/\/fonts\.(?:googleapis|bunny)\.[a-z.]+\/css2?\?[^\s"'`)]+/g)) remoteFontUrls.add(m[0]);
    for (const m of text.matchAll(/family=([A-Za-z0-9+]+)/g)) {
      if (/fonts\.(googleapis|bunny)/.test(text)) fontFamilies.add(decodeURIComponent(m[1].replace(/\+/g, ' ')));
    }
  }
  const fontFiles = manifest.files.filter((f) => f.kind === 'font').map((f) => f.path);

  // ── aliases ──────────────────────────────────────────────────────────────
  const aliases: Record<string, string> = {};
  for (const cfg of ['tsconfig.json', 'tsconfig.app.json', 'jsconfig.json']) {
    const parsed = parseJsonLoose<{ compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } }>(textFiles[cfg]);
    const base = (parsed?.compilerOptions?.baseUrl ?? '.').replace(/^\.\/?/, '').replace(/\/$/, '');
    for (const [alias, targets] of Object.entries(parsed?.compilerOptions?.paths ?? {})) {
      const target = targets?.[0];
      if (!target || aliases[alias]) continue;
      const joined = [base, target.replace(/^\.\//, '')].filter(Boolean).join('/');
      aliases[alias] = joined;
    }
  }

  // ── routes ───────────────────────────────────────────────────────────────
  let system: RouteSystem = 'none';
  const routes: ImportedRoute[] = [];
  const stripExt = (p: string) => p.replace(/\.(tsx?|jsx?|mdx?)$/, '');
  if ((framework === 'tanstack-start' || has(all, '@tanstack/react-router')) && routesDir) {
    system = 'tanstack-file-routes';
    for (const p of paths) {
      if (!p.startsWith(`${routesDir}/`) || !/\.(tsx?|jsx?)$/.test(p)) continue;
      const rel = stripExt(p.slice(routesDir.length + 1));
      if (rel.split('/').some((seg) => seg.startsWith('-'))) continue; // ignored route files
      const route = tanstackRoutePath(rel);
      const source = textFiles[p] ?? '';
      const isServer = /createServerFileRoute|createAPIFileRoute|\bserver\s*:\s*{\s*handlers/.test(source) || rel.startsWith('api/');
      routes.push({ ...route, file: p, kind: isServer ? 'server' : route.kind });
    }
  } else if (framework === 'next') {
    const appDir = ['app', 'src/app'].find((d) => paths.some((p) => p.startsWith(`${d}/`)));
    const pagesDir = ['pages', 'src/pages'].find((d) => paths.some((p) => p.startsWith(`${d}/`)));
    if (appDir) {
      system = 'next-app-router';
      for (const p of paths) if (p.startsWith(`${appDir}/`) && /\.(tsx?|jsx?)$/.test(p)) {
        const r = nextRoutePath(stripExt(p.slice(appDir.length + 1)), 'app');
        if (r) routes.push({ ...r, file: p });
      }
    } else if (pagesDir) {
      system = 'next-pages-router';
      for (const p of paths) if (p.startsWith(`${pagesDir}/`) && /\.(tsx?|jsx?|mdx)$/.test(p)) {
        const r = nextRoutePath(stripExt(p.slice(pagesDir.length + 1)), 'pages');
        if (r) routes.push({ ...r, file: p });
      }
    }
  } else if (framework === 'remix' && routesDir) {
    system = 'remix-routes';
    for (const p of paths) if (p.startsWith(`${routesDir}/`) && /\.(tsx?|jsx?)$/.test(p)) {
      routes.push({ ...tanstackRoutePath(stripExt(p.slice(routesDir.length + 1))), file: p });
    }
  } else if (framework === 'astro' || framework === 'sveltekit') {
    system = framework === 'astro' ? 'astro-pages' : 'sveltekit-routes';
    const dir = framework === 'astro' ? 'src/pages' : 'src/routes';
    for (const p of paths) if (p.startsWith(`${dir}/`)) routes.push({ path: `/${stripExt(p.slice(dir.length + 1)).replace(/\.(astro|svelte)$/, '').replace(/(^|\/)(index|\+page)$/, '')}`.replace(/\/+$/, '') || '/', file: p, kind: /\+server|\.ts$/.test(p) ? 'server' : 'page' });
  } else if (framework === 'static-html') {
    system = 'static-pages';
    for (const p of paths) if (/\.html?$/.test(p)) routes.push({ path: `/${p.replace(/(^|\/)index\.html?$/, '$1').replace(/\.html?$/, '')}`.replace(/\/+$/, '') || '/', file: p, kind: 'page' });
  } else {
    const routerSource = Object.entries(textFiles).find(([p, t]) => SOURCE_FILE.test(p) && /<Route\b[^>]*\bpath=|createBrowserRouter|createHashRouter/.test(t));
    if (routerSource) {
      system = 'react-router';
      for (const m of routerSource[1].matchAll(/<Route\b[^>]*\bpath=["']([^"']+)["']/g)) routes.push({ path: m[1].startsWith('/') ? m[1] : `/${m[1]}`, file: routerSource[0], kind: 'page' });
      for (const m of routerSource[1].matchAll(/\bpath\s*:\s*["']([^"']+)["']/g)) routes.push({ path: m[1].startsWith('/') ? m[1] : `/${m[1]}`, file: routerSource[0], kind: 'page' });
    }
  }
  routes.sort((a, b) => (a.path === b.path ? a.file.localeCompare(b.file) : a.path.localeCompare(b.path)));

  // ── entrypoints ──────────────────────────────────────────────────────────
  const entryCandidates = ['index.html', 'src/main.tsx', 'src/main.ts', 'src/main.jsx', 'src/index.tsx', 'src/index.jsx', 'src/client.tsx', 'src/server.ts', 'src/router.tsx', 'src/routes/__root.tsx', 'app/client.tsx', 'app/router.tsx', 'app/routes/__root.tsx', 'app/root.tsx', 'app/layout.tsx', 'src/app/layout.tsx', 'pages/_app.tsx', 'src/App.tsx'];
  const entrypoints = entryCandidates.filter((p) => pathSet.has(p));

  // ── env / server / services ──────────────────────────────────────────────
  const envNames = new Set(manifest.envNames);
  const serverCapabilities = new Set<string>();
  const externalServices = new Set<string>();
  const serviceDeps: Array<[RegExp, string]> = [
    [/^@supabase\//, 'Supabase'], [/^stripe$|^@stripe\//, 'Stripe'], [/^firebase/, 'Firebase'], [/^@clerk\//, 'Clerk'],
    [/^resend$/, 'Resend'], [/^@sendgrid\//, 'SendGrid'], [/^openai$/, 'OpenAI'], [/^@anthropic-ai\//, 'Anthropic'],
    [/^@vercel\/analytics/, 'Vercel Analytics'], [/^posthog/, 'PostHog'], [/^@sentry\//, 'Sentry'], [/^convex$/, 'Convex'],
    [/^@prisma\/client$|^prisma$/, 'Prisma'], [/^drizzle-orm$/, 'Drizzle'], [/^mapbox-gl$|^@react-google-maps\//, 'Maps'],
  ];
  for (const dep of Object.keys(all)) for (const [re, label] of serviceDeps) if (re.test(dep)) externalServices.add(label);
  for (const [path, text] of Object.entries(textFiles)) {
    if (!SOURCE_FILE.test(path)) continue;
    for (const m of text.matchAll(/import\.meta\.env\.([A-Z_][A-Z0-9_]*)|process\.env\.([A-Z_][A-Z0-9_]*)|Deno\.env\.get\(["']([A-Z_][A-Z0-9_]*)["']\)/g)) {
      const name = m[1] ?? m[2] ?? m[3];
      if (name && !['MODE', 'DEV', 'PROD', 'SSR', 'BASE_URL', 'NODE_ENV'].includes(name)) envNames.add(name);
    }
    if (/createServerFn\b/.test(text)) serverCapabilities.add('server functions');
    if (/createServerFileRoute|createAPIFileRoute/.test(text)) serverCapabilities.add('API routes');
    if (/createMiddleware\b/.test(text)) serverCapabilities.add('server middleware');
    if (/^\s*["']use server["']/m.test(text)) serverCapabilities.add('server actions');
    if (/export\s+(async\s+)?function\s+(loader|action)\b/.test(text) && framework === 'remix') serverCapabilities.add('route loaders/actions');
  }
  if (routes.some((r) => r.kind === 'server')) serverCapabilities.add('API routes');
  if (paths.some((p) => /^(middleware|src\/middleware)\.(t|j)s$/.test(p))) serverCapabilities.add('server middleware');
  if (paths.some((p) => p.startsWith('supabase/functions/'))) serverCapabilities.add('edge functions');
  if (paths.some((p) => p.startsWith('supabase/migrations/'))) serverCapabilities.add('database migrations');

  // ── Unison brief (projects designed with Unison elsewhere) ───────────────
  const briefPath = paths.find((p) => /^\.unison\/(creative-brief|brief|project)\.json$|^unison(\.brief)?\.json$/.test(p)) ?? null;
  let unisonBrief: ImportCompatibilityProfile['unisonBrief'] = null;
  if (briefPath) {
    const brief = parseJsonLoose<Record<string, unknown>>(textFiles[briefPath]) ?? {};
    const site = (brief.site && typeof brief.site === 'object' ? brief.site : {}) as Record<string, unknown>;
    const str = (...values: unknown[]) => values.find((v): v is string => typeof v === 'string' && v.length > 0) ?? null;
    const pagesRaw = (brief.pages ?? site.pages ?? brief.pageRoles) as unknown;
    unisonBrief = {
      path: briefPath,
      projectName: str(brief.projectName, brief.name, site.name),
      industry: str(brief.industry, site.industry),
      pages: Array.isArray(pagesRaw) ? pagesRaw.map((p) => (typeof p === 'string' ? p : (p as { role?: string; name?: string })?.role ?? (p as { name?: string })?.name ?? '')).filter(Boolean) : [],
      artDirection: str(brief.artDirection, brief.artDirectionPackId, brief.sealedArtDirectionPackId, (brief.design as Record<string, unknown> | undefined)?.artDirection),
    };
  }

  // ── preview adapter (honest) ─────────────────────────────────────────────
  const requires: string[] = [];
  if (framework === 'tanstack-start') requires.push('TanStack Start dev/build server (Vite + server functions)');
  else if (framework === 'next') requires.push('Next.js build server');
  else if (framework === 'remix' || framework === 'react-router-framework') requires.push('Remix / React Router framework server');
  else if (framework === 'astro' || framework === 'sveltekit' || framework === 'nuxt' || framework === 'vue-vite') requires.push(`${framework} build toolchain`);
  else if (framework === 'vite-react' || framework === 'create-react-app') requires.push('the project\'s own Vite/webpack build with its pinned dependencies');
  else requires.push('a build toolchain matching the source');
  if (tailwind === '4') requires.push('Tailwind CSS 4 compiler');
  if (serverCapabilities.size > 0) requires.push(`server runtime for ${[...serverCapabilities].join(', ')}`);
  if (Object.keys(aliases).length > 0) requires.push(`path aliases ${Object.keys(aliases).join(', ')}`);
  const previewAdapter: ImportCompatibilityProfile['previewAdapter'] = framework === 'static-html' && routes.length > 0 ? STATIC_HTML_ADAPTER_INFO : {
    status: 'unavailable',
    adapter: null,
    reason: 'Unison does not yet run imported projects in an isolated, source-compatible build. The built-in preview runtime would have to change this project\'s code, styles or components to display it, so the preview stays off instead of showing a different design.',
    requires,
  };

  return {
    version: 1,
    framework,
    frameworkEvidence: evidence,
    packageManager,
    lockfile,
    packageName: pkg.name ?? null,
    dependencies,
    devDependencies,
    scripts: { ...(pkg.scripts ?? {}) },
    toolchain: {
      typescript: paths.some((p) => /\.(ts|tsx|mts|cts)$/.test(p)) || pathSet.has('tsconfig.json'),
      vite: has(all, 'vite') || paths.some((p) => /^vite\.config\./.test(p)),
      tailwind,
      tailwindEvidence: [...new Set(tailwindEvidence)],
      configFiles,
    },
    entrypoints,
    routing: { system, routes },
    styles: {
      stylesheets,
      globalStylesheets,
      fontFamilies: [...fontFamilies].sort(),
      fontFiles,
      remoteFontUrls: [...remoteFontUrls].sort(),
    },
    aliases,
    envNames: [...envNames].sort(),
    serverCapabilities: [...serverCapabilities].sort(),
    externalServices: [...externalServices].sort(),
    unisonBrief,
    nestedAppRoots: manifest.nestedAppRoots,
    counts: {
      files: manifest.files.length,
      sourceFiles: manifest.files.filter((f) => f.kind === 'source').length,
      assets: manifest.files.filter((f) => f.storage === 'binary').length,
      excluded: manifest.excluded.length,
    },
    previewAdapter,
  };
}
