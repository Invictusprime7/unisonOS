/**
 * UIMP-01 source-build plan. Decides, from the imported files alone, how the
 * in-browser source build starts this project unchanged: where the app lives
 * inside the upload (nested app roots and monorepos included), which entry it
 * boots from, which packages it uses (pinned to the lockfile when one exists),
 * which component compilers it needs and which local workspace packages it
 * imports.
 *
 * Pure: no network, no DOM. The plan never edits or rewrites source.
 */
import { isImportRecordPath } from '@/services/import/importedSourceRecords';
import type { ImportCompatibilityProfile } from '@/services/import/importCompatibilityProfile';

export const SOURCE_BUILD_ADAPTER = 'browser-source-build-v1';

/**
 * vite-html: an HTML page with module scripts (Vite, Parcel, plain ESM, any framework).
 * script-entry: a conventional entry file with no HTML module script (Create React App, webpack).
 * tanstack-start: TanStack Start / file-routed TanStack Router client.
 * next-client: Next.js app or pages router pages rendered in the browser.
 */
export type SourceBuildKind = 'vite-html' | 'script-entry' | 'tanstack-start' | 'next-client';

export interface NextClientRoute {
  /** Route pattern, e.g. /blog/:slug or /docs/*rest. */
  path: string;
  page: string;
  /** Outermost first (app router only). */
  layouts: string[];
  templates: string[];
}

export interface SourceBuildPlan {
  status: 'supported' | 'unsupported';
  reason: string;
  kind: SourceBuildKind | null;
  /** Human label for the detected stack, e.g. "Vite + Vue". */
  stack: string;
  /** VFS directory of the app inside the upload ('' for the upload root). */
  root: string;
  /** VFS path of the HTML page the app starts from, when it has one. */
  htmlTemplate: string | null;
  /** VFS path of the first browser entry (vite-html, script-entry) or router module (tanstack-start). */
  entry: string | null;
  /** Every module script the HTML page starts, in document order. */
  entries: string[];
  /** script-entry only: the entry exports a component instead of mounting itself. */
  mountComponent: boolean;
  routerExport: string | null;
  packages: Record<string, string>;
  unpinned: string[];
  versions: Record<string, string>;
  tailwind: '3' | '4' | null;
  aliases: Array<{ find: string; replacement: string }>;
  jsxImportSource: string;
  tsconfigRaw: Record<string, unknown>;
  routesDir: string | null;
  /** Local packages found in the upload: package name -> its VFS directory. */
  localPackages: Record<string, string>;
  /** Component compilers the project needs, at the project's own versions. */
  compilers: { vue: string | null; svelte: string | null; solid: string | null; sass: string | null; less: string | null };
  next: { router: 'app' | 'pages'; dir: string; routes: NextClientRoute[]; app: string | null; notFound: string | null } | null;
}

const TOOLING = /^(@types\/|typescript$|vite$|@vitejs\/|eslint|@eslint\/|typescript-eslint$|globals$|prettier|lovable-tagger$|vitest|@vitest\/|postcss$|autoprefixer$|@tailwindcss\/(vite|postcss)$|vite-tsconfig-paths$|@cloudflare\/vite-plugin$|wrangler$|@tanstack\/router-plugin$|tailwindcss$|@sveltejs\/vite-plugin-svelte$|svelte-check$|@tsconfig\/|vite-plugin-|@vue\/tsconfig$|vue-tsc$|@vue\/compiler-sfc$|react-scripts$|@testing-library\/|jest$|@babel\/|babel-|webpack|parcel$|@parcel\/|sass$|sass-embedded$|less$|stylus$|@next\/eslint|eslint-config-next$|@biomejs\/|husky$|lint-staged$|concurrently$|nodemon$|ts-node$|tsx$|cross-env$|rimraf$|npm-run-all$|@playwright\/|playwright$|cypress$|storybook$|@storybook\/|vite-plugin-solid$|solid-devtools$|@preact\/preset-vite$|@lit\/|turbo$|@changesets\/)/;

function stripJsonComments(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === '\\') { out += text[i + 1] ?? ''; i += 1; } else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; continue; }
    if (ch === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i += 1; out += '\n'; continue; }
    if (ch === '/' && text[i + 1] === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1; i += 1; continue; }
    out += ch;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

export function parseJsonc<T>(text: string | undefined): T | null {
  if (!text) return null;
  try { return JSON.parse(stripJsonComments(text)) as T; } catch { return null; }
}

/** Exact versions from bun.lock, package-lock.json, pnpm-lock.yaml or yarn.lock in any of `dirs` (nearest first). */
export function readLockedVersions(files: Record<string, string>, names: string[], dirs: string[] = ['']): Record<string, string> {
  const locked: Record<string, string> = {};
  for (const dir of dirs) {
    const bun = files[`${dir}/bun.lock`];
    const npm = parseJsonc<{ packages?: Record<string, { version?: string }>; dependencies?: Record<string, { version?: string }> }>(files[`${dir}/package-lock.json`]);
    const pnpm = files[`${dir}/pnpm-lock.yaml`];
    const yarn = files[`${dir}/yarn.lock`];
    if (!bun && !npm && !pnpm && !yarn) continue;
    for (const name of names) {
      if (locked[name]) continue;
      const escaped = name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
      let version: string | undefined;
      if (bun) version = new RegExp(`\\n\\s*"${escaped}":\\s*\\["${escaped}@([^"]+)"`).exec(bun)?.[1];
      if (!version && npm) version = npm.packages?.[`node_modules/${name}`]?.version ?? npm.dependencies?.[name]?.version;
      if (!version && pnpm) {
        version = new RegExp(`\\n\\s+'?${escaped}'?:\\s*\\n\\s+specifier:[^\\n]*\\n\\s+version:\\s*([0-9][^\\s(]*)`).exec(pnpm)?.[1]
          ?? new RegExp(`\\n\\s+'?/?${escaped}@([0-9][^(:'\\s]*)'?(\\([^\\n]*\\))?:\\s*\\n`).exec(pnpm)?.[1];
      }
      if (!version && yarn) version = new RegExp(`\\n"?${escaped}@[^\\n]*:\\n\\s+version:? "?([0-9][^"\\n]*)`).exec(yarn)?.[1];
      if (version && /^\d/.test(version)) locked[name] = version;
    }
  }
  return locked;
}

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

const unsupported = (reason: string, root = '', stack = 'unknown'): SourceBuildPlan => ({
  status: 'unsupported', reason, kind: null, stack, root, htmlTemplate: null, entry: null, entries: [], mountComponent: false, routerExport: null,
  packages: {}, unpinned: [], versions: {}, tailwind: null, aliases: [], jsxImportSource: 'react', tsconfigRaw: {}, routesDir: null,
  localPackages: {}, compilers: { vue: null, svelte: null, solid: null, sass: null, less: null }, next: null,
});

const SERVER_FRAMEWORKS: Array<[string, string]> = [
  ['@remix-run/dev', 'Remix'], ['@remix-run/react', 'Remix'], ['@react-router/dev', 'React Router framework mode'],
  ['astro', 'Astro'], ['@sveltejs/kit', 'SvelteKit'], ['nuxt', 'Nuxt'], ['@angular/core', 'Angular'],
  ['@builder.io/qwik', 'Qwik'], ['@solidjs/start', 'SolidStart'], ['gatsby', 'Gatsby'], ['@redwoodjs/core', 'RedwoodJS'],
];

function dirOf(path: string): string { return path.slice(0, path.lastIndexOf('/')); }
function joinVfs(dir: string, rel: string): string {
  const out: string[] = [];
  for (const seg of `${dir}/${rel}`.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') out.pop(); else out.push(seg);
  }
  return `/${out.join('/')}`;
}

/**
 * The app's directory inside the upload. The upload root wins when it holds a
 * package.json or index.html; otherwise the most app-like nested folder
 * (an HTML page, a UI framework dependency, an apps/ or web/ folder), shallowest first.
 */
export function findAppRoot(files: Record<string, string>): string {
  const paths = Object.keys(files).filter((p) => !isImportRecordPath(p));
  const has = (p: string) => Object.prototype.hasOwnProperty.call(files, p);
  if (has('/package.json') || has('/index.html')) {
    const rootPkg = parseJsonc<PackageJson & { workspaces?: unknown }>(files['/package.json']);
    const rootDeps = { ...rootPkg?.devDependencies, ...rootPkg?.dependencies };
    const isWorkspaceShell = !has('/index.html') && Boolean(rootPkg?.workspaces || has('/pnpm-workspace.yaml') || has('/turbo.json'))
      && !Object.keys(rootDeps).some((d) => /^(react|vue|svelte|next|vite|preact|solid-js|@tanstack\/react-start)$/.test(d));
    if (!isWorkspaceShell) return '';
  }
  const candidates = [...new Set(paths.filter((p) => /\/(package\.json|index\.html)$/.test(p)).map(dirOf))]
    .filter((dir) => dir && !/\/(node_modules|dist|build|\.next|out|coverage)(\/|$)/.test(dir) && !/^\/public(\/|$)/.test(dir));
  const score = (dir: string) => {
    const pkg = parseJsonc<PackageJson>(files[`${dir}/package.json`]);
    const deps = { ...pkg?.devDependencies, ...pkg?.dependencies };
    let s = 0;
    if (has(`${dir}/index.html`)) s += 3;
    if (Object.keys(deps).some((d) => /^(react|vue|svelte|next|preact|solid-js|lit|@tanstack\/react-start)$/.test(d))) s += 3;
    if (deps.vite || deps.next || deps['react-scripts']) s += 2;
    if (/^\/(apps|web|frontend|client|site|www)(\/|$)/.test(dir)) s += 1;
    if (/^\/(packages|libs)\//.test(dir)) s -= 2;
    return s;
  };
  const ranked = candidates
    .map((dir) => ({ dir, s: score(dir), depth: dir.split('/').length }))
    .filter((c) => c.s > 0)
    .sort((a, b) => b.s - a.s || a.depth - b.depth || (a.dir < b.dir ? -1 : 1));
  return ranked[0]?.dir ?? '';
}

/** Every package.json in the upload with a name: name -> directory. */
export function findLocalPackages(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const path of Object.keys(files).sort()) {
    if (!path.endsWith('/package.json') || isImportRecordPath(path) || /\/node_modules\//.test(path)) continue;
    const name = parseJsonc<PackageJson>(files[path])?.name;
    if (name && !out[name]) out[name] = dirOf(path);
  }
  return out;
}

function tsconfigFor(files: Record<string, string>, root: string): { compilerOptions: Record<string, unknown>; dir: string } {
  for (const name of ['tsconfig.app.json', 'tsconfig.json', 'jsconfig.json']) {
    const parsed = parseJsonc<{ compilerOptions?: Record<string, unknown>; extends?: string }>(files[`${root}/${name}`]);
    if (parsed?.compilerOptions && (parsed.compilerOptions.paths || name === 'jsconfig.json' || name === 'tsconfig.json')) {
      return { compilerOptions: parsed.compilerOptions, dir: root };
    }
  }
  const any = parseJsonc<{ compilerOptions?: Record<string, unknown> }>(files[`${root}/tsconfig.json`] ?? files[`${root}/tsconfig.app.json`]);
  return { compilerOptions: any?.compilerOptions ?? {}, dir: root };
}

function aliasesFor(files: Record<string, string>, root: string, compilerOptions: Record<string, unknown>): SourceBuildPlan['aliases'] {
  const aliases: SourceBuildPlan['aliases'] = [];
  const baseUrl = typeof compilerOptions.baseUrl === 'string' ? compilerOptions.baseUrl : '.';
  const paths = (compilerOptions.paths ?? {}) as Record<string, string[]>;
  for (const [alias, targets] of Object.entries(paths)) {
    const target = Array.isArray(targets) ? targets[0] : null;
    if (!target) continue;
    const find = alias.replace(/\*$/, '');
    const dest = joinVfs(joinVfs(root || '/', baseUrl), target.replace(/\*$/, ''));
    aliases.push({ find, replacement: find.endsWith('/') || alias.endsWith('*') ? `${dest.replace(/\/$/, '')}/` : dest });
  }
  for (const configName of ['vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs', 'svelte.config.js', 'next.config.js', 'next.config.mjs', 'next.config.ts']) {
    const config = files[`${root}/${configName}`] ?? '';
    for (const m of config.matchAll(/["']([@~#$][\w-]*)["']\s*:\s*(?:(?:path\.)?(?:resolve|join)\([^,]*,\s*["']\.?\/?([^"']+)["']\)|fileURLToPath\(new URL\(\s*["']\.?\/?([^"']+)["']))/g)) {
      const find = `${m[1]}/`;
      const target = (m[2] ?? m[3]).replace(/\/$/, '');
      if (!aliases.some((a) => a.find === find || a.find === m[1])) aliases.push({ find, replacement: `${joinVfs(root || '/', target)}/` });
    }
  }
  // SvelteKit-style $lib is common in plain Svelte projects too.
  if (!aliases.some((a) => a.find.startsWith('$lib')) && Object.keys(files).some((p) => p.startsWith(`${root}/src/lib/`)) && Object.values(files).some((t) => /from\s+["']\$lib\//.test(t))) {
    aliases.push({ find: '$lib/', replacement: `${root}/src/lib/` });
  }
  return aliases.sort((a, b) => b.find.length - a.find.length);
}

const ENTRY_CANDIDATES = ['src/index', 'src/main', 'index', 'main', 'src/app', 'src/App', 'app', 'App'];
const ENTRY_EXTS = ['.tsx', '.ts', '.jsx', '.js', '.mjs'];

function nextRoutes(files: Record<string, string>, root: string): SourceBuildPlan['next'] {
  const paths = Object.keys(files);
  const PAGE = /\.(tsx|jsx|ts|js|mdx)$/;
  for (const base of [`${root}/app`, `${root}/src/app`]) {
    const pages = paths.filter((p) => p.startsWith(`${base}/`) && /\/page\.(tsx|jsx|ts|js)$/.test(p));
    if (!pages.length) continue;
    const special = (dir: string, name: string) => ENTRY_EXTS.map((e) => `${dir}/${name}${e}`).find((p) => files[p] !== undefined) ?? null;
    const routes: NextClientRoute[] = [];
    for (const page of pages.sort()) {
      const rel = page.slice(base.length + 1).split('/').slice(0, -1);
      if (rel.some((s) => s.startsWith('_') || s.startsWith('@'))) continue;
      const segs = rel.filter((s) => !(s.startsWith('(') && s.endsWith(')'))).map((s) => s
        .replace(/^\[\[\.\.\.(.+)\]\]$/, '*$1?').replace(/^\[\.\.\.(.+)\]$/, '*$1').replace(/^\[(.+)\]$/, ':$1'));
      const layouts: string[] = [];
      const templates: string[] = [];
      for (let depth = 0; depth <= rel.length; depth += 1) {
        const dir = [base, ...rel.slice(0, depth)].join('/');
        const layout = special(dir, 'layout');
        const template = special(dir, 'template');
        if (layout) layouts.push(layout);
        if (template) templates.push(template);
      }
      routes.push({ path: `/${segs.join('/')}`.replace(/\/+$/, '') || '/', page, layouts, templates });
    }
    return { router: 'app', dir: base, routes, app: null, notFound: special(base, 'not-found') };
  }
  for (const base of [`${root}/pages`, `${root}/src/pages`]) {
    const pages = paths.filter((p) => p.startsWith(`${base}/`) && PAGE.test(p) && !p.startsWith(`${base}/api/`));
    if (!pages.length) continue;
    const routes: NextClientRoute[] = [];
    let app: string | null = null;
    let notFound: string | null = null;
    for (const page of pages.sort()) {
      const rel = page.slice(base.length + 1).replace(PAGE, '');
      if (/^_app$/.test(rel)) { app = page; continue; }
      if (/^(404)$/.test(rel)) notFound = page;
      if (rel.split('/').some((s) => s.startsWith('_'))) continue;
      const segs = rel.split('/').filter((s) => s !== 'index').map((s) => s
        .replace(/^\[\[\.\.\.(.+)\]\]$/, '*$1?').replace(/^\[\.\.\.(.+)\]$/, '*$1').replace(/^\[(.+)\]$/, ':$1'));
      routes.push({ path: `/${segs.join('/')}`.replace(/\/+$/, '') || '/', page, layouts: [], templates: [] });
    }
    return { router: 'pages', dir: base, routes, app, notFound };
  }
  return null;
}

/** Local module scripts an HTML page starts, resolved to VFS paths. */
function htmlModuleEntries(html: string, htmlPath: string, root: string, has: (p: string) => boolean): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
    const attrs = m[1];
    if (!/type\s*=\s*["']module["']/i.test(attrs)) continue;
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
    if (!src || /^(https?:)?\/\//.test(src) || src.startsWith('data:')) continue;
    const clean = src.split(/[?#]/)[0];
    const candidates = clean.startsWith('/') ? [`${root}${clean}`] : [joinVfs(dirOf(htmlPath) || '/', clean), `${root}/${clean.replace(/^\.\//, '')}`];
    const hit = candidates.find(has);
    if (hit && /\.(m?[jt]sx?|vue|svelte)$/.test(hit)) out.push(hit);
  }
  return [...new Set(out)];
}

export function planSourceBuild(profile: ImportCompatibilityProfile, files: Record<string, string>): SourceBuildPlan {
  const sourceFiles = Object.fromEntries(Object.entries(files).filter(([p]) => !isImportRecordPath(p)));
  const has = (p: string) => Object.prototype.hasOwnProperty.call(sourceFiles, p);
  const root = findAppRoot(sourceFiles);
  const pkg = parseJsonc<PackageJson>(sourceFiles[`${root}/package.json`])
    ?? (root ? null : { dependencies: profile.dependencies, devDependencies: profile.devDependencies });
  const declared: Record<string, string> = { ...(pkg?.peerDependencies ?? {}), ...(pkg?.devDependencies ?? {}), ...(pkg?.dependencies ?? {}) };

  for (const [dep, label] of SERVER_FRAMEWORKS) {
    if (declared[dep]) return unsupported(`${label} projects render through their own server, so they cannot run in the browser source build.`, root, label);
  }

  const { compilerOptions } = tsconfigFor(sourceFiles, root);
  const aliases = aliasesFor(sourceFiles, root, compilerOptions);
  const localAll = findLocalPackages(sourceFiles);
  const localPackages: Record<string, string> = {};
  const lockDirs = [...new Set([root, ...root.split('/').map((_, i, parts) => parts.slice(0, parts.length - 1 - i).join('/'))])];
  const locked = readLockedVersions(sourceFiles, Object.keys(declared), lockDirs);
  const versions: Record<string, string> = {};
  const packages: Record<string, string> = {};
  const unpinned: string[] = [];
  for (const [name, rangeRaw] of Object.entries(declared)) {
    const range = String(rangeRaw);
    const local = /^(workspace:|file:|link:|portal:)/.test(range) || (localAll[name] && localAll[name] !== root);
    if (local && localAll[name]) { localPackages[name] = localAll[name]; continue; }
    const clean = range.replace(/^(npm:[^@]+@)/, '').replace(/^[~^>=<\s]+/, '').split(/\s|\|\|/)[0];
    const version = locked[name] ?? (/^\d/.test(clean) ? clean : null);
    if (version) versions[name] = version;
    if (TOOLING.test(name)) continue;
    if (version) {
      packages[name] = version;
      if (!locked[name]) unpinned.push(name);
    } else unpinned.push(name);
  }
  // Workspace packages imported by name without being declared still resolve locally.
  for (const [name, dir] of Object.entries(localAll)) if (dir !== root && !localPackages[name]) localPackages[name] = dir;

  const major = (name: string) => Number(/^(\d+)/.exec(versions[name] ?? declared[name]?.replace(/^\D+/, '') ?? '')?.[1] ?? NaN);
  const anyFile = (re: RegExp) => Object.keys(sourceFiles).some((p) => re.test(p));
  const tailwind: SourceBuildPlan['tailwind'] = declared['@tailwindcss/vite'] || declared['@tailwindcss/postcss'] || major('tailwindcss') >= 4 ? '4'
    : declared.tailwindcss || anyFile(/\/tailwind\.config\.(c|m)?(t|j)s$/) ? '3' : profile.toolchain.tailwind;
  const usesSolid = Boolean(declared['solid-js']);
  const jsxImportSource = typeof compilerOptions.jsxImportSource === 'string' ? compilerOptions.jsxImportSource
    : declared.preact && !declared.react ? 'preact' : 'react';
  const compilers: SourceBuildPlan['compilers'] = {
    vue: declared.vue || anyFile(/\.vue$/) ? (versions['@vue/compiler-sfc'] ?? versions.vue ?? '3') : null,
    svelte: declared.svelte || anyFile(/\.svelte$/) ? (versions.svelte ?? '5') : null,
    solid: usesSolid ? (versions['babel-preset-solid'] ?? versions['solid-js'] ?? '1') : null,
    sass: anyFile(/\.s[ac]ss$/) || Object.values(sourceFiles).some((t) => /lang=["']s[ac]ss["']/.test(t)) ? (versions.sass ?? versions['sass-embedded'] ?? '1') : null,
    less: anyFile(/\.less$/) ? (versions.less ?? '4') : null,
  };
  const stack = [
    declared.next ? 'Next.js' : declared['@tanstack/react-start'] ? 'TanStack Start' : declared['react-scripts'] ? 'Create React App' : declared.vite ? 'Vite' : declared.parcel ? 'Parcel' : null,
    compilers.vue ? 'Vue' : compilers.svelte ? 'Svelte' : usesSolid ? 'Solid' : declared.preact ? 'Preact' : declared.lit ? 'Lit' : declared.react || anyFile(/\.(t|j)sx$/) ? 'React' : null,
  ].filter(Boolean).join(' + ') || 'JavaScript';

  const base = {
    stack, root, packages, unpinned, versions, tailwind, aliases, jsxImportSource, localPackages, compilers,
    tsconfigRaw: { compilerOptions: { ...compilerOptions, jsx: 'react-jsx', jsxImportSource, paths: undefined, baseUrl: undefined } },
    routesDir: null as string | null, next: null as SourceBuildPlan['next'], entries: [] as string[], mountComponent: false, routerExport: null as string | null,
  };
  const pinnedNote = unpinned.length && Object.keys(locked).length === 0 ? ' No lockfile was included, so package versions come from package.json.' : '';

  if (declared['@tanstack/react-start'] || declared['@tanstack/start'] || (declared['@tanstack/react-router'] && anyFile(/routeTree\.gen\.(t|j)sx?$/) && !has(`${root}/index.html`))) {
    const routerPath = ['src/router.tsx', 'src/router.ts', 'app/router.tsx', 'app/router.ts'].map((p) => `${root}/${p}`).find(has) ?? null;
    if (!routerPath) return unsupported('No router module (src/router.tsx) was found for this TanStack Start project.', root, stack);
    const routerSource = sourceFiles[routerPath];
    const routerExport = /export\s+(?:const|function|async function)\s+(getRouter|createRouter)\b/.exec(routerSource)?.[1]
      ?? (/export\s+(?:const|let)\s+router\b/.test(routerSource) ? 'router' : null);
    if (!routerExport) return unsupported(`${routerPath.slice(1)} does not export getRouter, createRouter or router.`, root, stack);
    const routesDir = [`${root}/src/routes`, `${root}/app/routes`].find((dir) => Object.keys(sourceFiles).some((p) => p.startsWith(`${dir}/`))) ?? null;
    if (!Object.keys(sourceFiles).some((p) => /routeTree\.gen\.(t|j)sx?$/.test(p))) return unsupported('The generated route tree (routeTree.gen.ts) is missing, so the original page list cannot be loaded.', root, stack);
    return { ...base, status: 'supported', reason: `TanStack Start pages run in the browser from the original source; server-only routes and functions stay off.${pinnedNote}`, kind: 'tanstack-start', htmlTemplate: null, entry: routerPath, entries: [routerPath], routerExport, routesDir };
  }

  if (declared.next) {
    const next = nextRoutes(sourceFiles, root);
    if (!next || next.routes.length === 0) return unsupported('This Next.js project has no pages in app/ or pages/.', root, stack);
    return {
      ...base, status: 'supported', kind: 'next-client', htmlTemplate: null, entry: next.routes[0].page, entries: [], next,
      reason: `Next.js ${next.router === 'app' ? 'app router' : 'pages router'} pages render in the browser from the original source. Server-only code (data fetching on the server, route handlers, server actions, headers and cookies) does not run here, and Next's own components (links, images, fonts, navigation) are provided by browser equivalents.${pinnedNote}`,
    };
  }

  const templates = [`${root}/index.html`, `${root}/src/index.html`, `${root}/public/index.html`].filter(has);
  for (const template of templates) {
    const entries = htmlModuleEntries(sourceFiles[template], template, root, has);
    if (entries.length) {
      return { ...base, status: 'supported', kind: 'vite-html', htmlTemplate: template, entry: entries[0], entries,
        reason: `Runs the original ${stack} source in the browser, unchanged, starting from ${template.slice(1)}${Object.keys(locked).length ? ', with the exact package versions from the lockfile' : ''}.${pinnedNote}` };
    }
  }

  for (const stem of ENTRY_CANDIDATES) {
    for (const ext of ENTRY_EXTS) {
      const entry = `${root}/${stem}${ext}`;
      if (!has(entry)) continue;
      const source = sourceFiles[entry];
      const mounts = /\b(createRoot|hydrateRoot|ReactDOM\.render|render\s*\(|createApp\s*\(|new\s+Vue\s*\(|mount\s*\(|customElements\.define|document\.(getElementById|querySelector|body))/.test(source);
      const exportsComponent = /export\s+default\b/.test(source) && /\.(t|j)sx$/.test(ext);
      if (!mounts && !exportsComponent) continue;
      const template = has(`${root}/public/index.html`) ? `${root}/public/index.html` : null;
      return { ...base, status: 'supported', kind: 'script-entry', htmlTemplate: template, entry, entries: [entry], mountComponent: !mounts,
        reason: `Runs the original ${stack} source in the browser, unchanged, starting from ${entry.slice(1)}${template ? ` inside ${template.slice(1)}` : ''}.${pinnedNote}` };
    }
  }

  return unsupported('No app entry (an HTML page with a module script, or src/index or src/main) was found.', root, stack);
}
