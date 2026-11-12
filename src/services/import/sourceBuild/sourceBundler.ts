/**
 * UIMP-01 in-browser source build. Bundles an imported React project from its
 * saved VFS bytes with esbuild, exactly as written: no source rewriting, no
 * Unison components, no theme injection. Packages load at the lockfile's exact
 * versions from a public module CDN through an import map; local images come
 * from the project's stored assets.
 *
 * The esbuild instance, Tailwind 4 compiler and text fetcher are injected so
 * the same build runs in the browser (esbuild-wasm) and in tests (native).
 *
 * Host adaptations — never edits to the saved source — are listed in
 * `adaptations` so the preview can say exactly what differs from the
 * project's own toolchain.
 */
import { isImportRecordPath } from '@/services/import/importedSourceRecords';
import type { SourceBuildPlan } from './sourceBuildPlan';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface EsbuildLike {
  build(options: any): Promise<{ outputFiles?: Array<{ path: string; text: string }>; metafile?: any; errors: any[]; warnings: any[] }>;
}

export interface Tailwind4Compiler {
  compile(css: string, options: {
    base: string;
    loadStylesheet: (id: string, base: string) => Promise<{ path: string; base: string; content: string }>;
    loadModule: (id: string, base: string, resourceHint: 'plugin' | 'config') => Promise<{ path: string; base: string; module: unknown }>;
  }): Promise<{ build(candidates: string[]): string }>;
}

export interface SourceBuildDiagnostic {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  path?: string;
}

export interface SourceBuildInput {
  esbuild: EsbuildLike;
  plan: SourceBuildPlan;
  files: Record<string, string>;
  /** VFS path -> URL for binary files kept in storage. */
  assetUrls: Record<string, string>;
  tailwind4?: Tailwind4Compiler | null;
  fetchText: (url: string) => Promise<string>;
  /** Origin that root-relative image pointer files (`*.asset.json`) were published from. */
  pointerOrigin?: string | null;
  cdnOrigin?: string;
}

export interface SourceBuildResult {
  ok: boolean;
  document: string;
  diagnostics: SourceBuildDiagnostic[];
  adaptations: string[];
  /** Exact package URLs the import map serves. */
  importMap: { imports: Record<string, string> };
  /** Root-relative public file path -> URL, used by the runtime URL mapper. */
  publicUrls: Record<string, string>;
  bytes: number;
}

const SCRIPT_EXT = /\.(m?[jt]sx?|cjs|cts|mts)$/;
const STYLE_EXT = /\.(css|pcss)$/;
const ASSET_EXT = /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp|woff2?|ttf|otf|eot|mp4|webm|mp3|wav|ogg|pdf|glb|gltf|hdr)$/i;
const RESOLVE_SUFFIXES = ['', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs', '.mts', '.json', '.css', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
const MIME: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon', avif: 'image/avif', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf' };

function packageNameOf(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}
function dirname(path: string): string { return path.slice(0, path.lastIndexOf('/')) || '/'; }
function joinPath(base: string, rel: string): string {
  const out: string[] = [];
  for (const seg of `${base}/${rel}`.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') out.pop(); else out.push(seg);
  }
  return `/${out.join('/')}`;
}
function textDataUrl(path: string, text: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return `data:${MIME[ext] ?? 'text/plain'};charset=utf-8,${encodeURIComponent(text)}`;
}
function escapeScript(code: string): string { return code.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--'); }

/** Words that may be Tailwind class candidates, from every saved source file. */
export function extractClassCandidates(files: Record<string, string>): string[] {
  const out = new Set<string>();
  for (const [path, text] of Object.entries(files)) {
    if (isImportRecordPath(path) || !/\.(m?[jt]sx?|html?|mdx?|vue|svelte|astro)$/.test(path)) continue;
    for (const raw of text.split(/[\s"`]+/)) {
      if (!raw || raw.length > 200) continue;
      out.add(raw);
      for (const part of raw.split(/'/)) {
        const trimmed = part.replace(/^[^\w!@\-[*.#]+/, '').replace(/[^\w\])%!*]+$/, '');
        if (trimmed) out.add(trimmed);
      }
    }
  }
  return [...out];
}

export async function buildImportedSource(input: SourceBuildInput): Promise<SourceBuildResult> {
  const { esbuild, plan, assetUrls, fetchText } = input;
  const cdn = (input.cdnOrigin ?? 'https://esm.sh').replace(/\/$/, '');
  const files = Object.fromEntries(Object.entries(input.files).filter(([p]) => !isImportRecordPath(p)));
  const diagnostics: SourceBuildDiagnostic[] = [];
  const adaptations = new Set<string>();
  const has = (p: string) => Object.prototype.hasOwnProperty.call(files, p) || Object.prototype.hasOwnProperty.call(assetUrls, p);
  const pkgVersion = (name: string) => plan.packages[name] ?? null;
  const usedPackages = new Set<string>();

  // ── local files & public folder ───────────────────────────────────────────
  const publicUrls: Record<string, string> = {};
  for (const path of [...Object.keys(files), ...Object.keys(assetUrls)]) {
    if (!path.startsWith('/public/')) continue;
    const served = path.slice('/public'.length);
    publicUrls[served] = assetUrls[path] ?? textDataUrl(path, files[path]);
  }
  const urlForLocalFile = (path: string): string | null => {
    if (assetUrls[path]) return assetUrls[path];
    if (files[path] !== undefined) return textDataUrl(path, files[path]);
    return publicUrls[path] ?? null;
  };
  const resolveLocal = (specifier: string, importer: string): string | null => {
    let target: string | null = null;
    const alias = plan.aliases.find((a) => specifier === a.find.replace(/\/$/, '') || specifier.startsWith(a.find));
    if (alias) target = joinPath('/', `${alias.replacement}${specifier.slice(alias.find.length)}`);
    else if (specifier.startsWith('./') || specifier.startsWith('../')) target = joinPath(dirname(importer), specifier);
    else if (specifier.startsWith('/')) target = specifier;
    if (!target) return null;
    for (const suffix of RESOLVE_SUFFIXES) if (has(`${target}${suffix}`)) return `${target}${suffix}`;
    if (target.startsWith('/') && !target.startsWith('/src/') && has(`/public${target}`)) return `/public${target}`;
    return null;
  };

  // ── styles ────────────────────────────────────────────────────────────────
  const packageCss = async (specifier: string): Promise<{ path: string; content: string }> => {
    const name = packageNameOf(specifier);
    const version = pkgVersion(name) ?? plan.versions[name] ?? null;
    const pinned = version ?? 'latest';
    let sub = specifier.slice(name.length).replace(/^\//, '');
    if (!sub) {
      if (name === 'tailwindcss') sub = 'index.css';
      else {
        const manifest = JSON.parse(await fetchText(`https://cdn.jsdelivr.net/npm/${name}@${pinned}/package.json`)) as { style?: string; exports?: any };
        const dot = manifest.exports?.['.'];
        sub = (typeof dot === 'object' && (dot.style ?? dot.default)) || manifest.style || 'index.css';
        sub = String(sub).replace(/^\.\//, '');
      }
    } else if (!/\.css$/.test(sub)) sub = `${sub}.css`;
    if (!version) diagnostics.push({ level: 'warning', code: 'css-package-unpinned', message: `${name} is not in package.json; its latest stylesheet was used.` });
    return { path: `npm:${name}/${sub}`, content: await fetchText(`https://cdn.jsdelivr.net/npm/${name}@${pinned}/${sub}`) };
  };
  const rewriteCssUrls = (css: string, fromPath: string): string => css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, quote, ref: string) => {
    if (/^(data:|https?:|#|blob:)/.test(ref) || fromPath.startsWith('npm:')) return whole;
    const clean = ref.split(/[?#]/)[0];
    const resolved = clean.startsWith('/') ? (has(`/public${clean}`) ? `/public${clean}` : clean) : joinPath(dirname(fromPath), clean);
    const url = urlForLocalFile(resolved);
    if (!url) { diagnostics.push({ level: 'warning', code: 'css-asset-missing', message: `${ref} is referenced by ${fromPath.slice(1)} but is not in the imported files.`, path: fromPath }); return whole; }
    return `url(${JSON.stringify(url)})`;
  });
  const inlinePlainImports = async (css: string, fromPath: string, seen: Set<string>): Promise<string> => {
    const parts: string[] = [];
    let rest = css;
    const re = /@import\s+(?:url\()?\s*["']([^"']+)["']\s*\)?\s*([^;]*);/;
    for (let m = re.exec(rest); m; m = re.exec(rest)) {
      parts.push(rest.slice(0, m.index));
      const ref = m[1];
      if (/^https?:/.test(ref)) parts.push(m[0]);
      else {
        const local = ref.startsWith('.') || ref.startsWith('/') ? resolveLocal(ref, fromPath) ?? joinPath(dirname(fromPath), ref) : null;
        if (local && files[local] !== undefined && !seen.has(local)) {
          seen.add(local);
          parts.push(await inlinePlainImports(rewriteCssUrls(files[local], local), local, seen));
        } else if (!local) {
          const pkg = await packageCss(ref);
          parts.push(pkg.content);
        } else parts.push(m[0]);
      }
      rest = rest.slice(m.index + m[0].length);
    }
    parts.push(rest);
    // Keep remote @import rules first, as CSS requires.
    const joined = parts.join('');
    const remote = joined.match(/@import\s+url\([^)]*\)[^;]*;|@import\s+["']https?:[^"']+["'][^;]*;/g) ?? [];
    return remote.length ? `${remote.join('\n')}\n${joined.replace(/@import\s+url\([^)]*\)[^;]*;|@import\s+["']https?:[^"']+["'][^;]*;/g, '')}` : joined;
  };
  let candidates: string[] | null = null;
  const compileStylesheet = async (path: string): Promise<{ css: string; tailwind3: boolean }> => {
    const source = files[path];
    const isTw4 = /@import\s+["']tailwindcss(\/[^"']*)?["']|@theme\b|@source\b|@plugin\b/.test(source) && plan.tailwind !== '3';
    const isTw3 = /@tailwind\s+(base|components|utilities)/.test(source) || (plan.tailwind === '3' && /@apply\b/.test(source));
    if (isTw4) {
      if (!input.tailwind4) {
        diagnostics.push({ level: 'error', code: 'tailwind4-compiler-missing', message: 'The Tailwind 4 compiler is not available, so this project\'s styles cannot be built.', path });
        return { css: '', tailwind3: false };
      }
      candidates ??= extractClassCandidates(files);
      const compiler = await input.tailwind4.compile(source, {
        base: dirname(path),
        loadStylesheet: async (id, base) => {
          if (id.startsWith('.') || id.startsWith('/')) {
            const local = resolveLocal(id, `${base}/x.css`) ?? joinPath(base, id);
            if (files[local] === undefined) throw new Error(`Stylesheet ${id} is not in the imported files.`);
            return { path: local, base: dirname(local), content: rewriteCssUrls(files[local], local) };
          }
          const pkg = await packageCss(id);
          return { path: pkg.path, base: dirname(pkg.path), content: pkg.content };
        },
        loadModule: async (id, base, hint) => {
          diagnostics.push({ level: 'warning', code: 'tailwind-module-skipped', message: `Tailwind ${hint} "${id}" runs only in the project's own toolchain; its extra utilities are not in this preview.`, path });
          return { path: id, base, module: hint === 'plugin' ? () => {} : {} };
        },
      });
      adaptations.add(`Styles compiled with the Tailwind 4 compiler from ${path.slice(1)} (the project's own @source/@theme rules; class names read from every source file).`);
      return { css: rewriteCssUrls(compiler.build(candidates), path), tailwind3: false };
    }
    const css = await inlinePlainImports(rewriteCssUrls(source, path), path, new Set([path]));
    if (isTw3) adaptations.add(`Tailwind 3 styles in ${path.slice(1)} are generated in the preview frame from the project's tailwind.config.`);
    return { css, tailwind3: isTw3 };
  };

  // ── pointer assets (`foo.png.asset.json`) ─────────────────────────────────
  const pointerUrl = (path: string): string | null => {
    try {
      const pointer = JSON.parse(files[path]) as { url?: string };
      if (!pointer.url) return null;
      if (/^https?:/.test(pointer.url)) return pointer.url;
      if (input.pointerOrigin) {
        adaptations.add(`Hosted images (${'*.asset.json'}) load from ${input.pointerOrigin}.`);
        return `${input.pointerOrigin.replace(/\/$/, '')}${pointer.url}`;
      }
      diagnostics.push({ level: 'warning', code: 'asset-pointer-origin', message: `${path.slice(1)} points at ${pointer.url} on the site it was published from; add that site address to load it.`, path });
      return pointer.url;
    } catch { return null; }
  };

  // ── esbuild plugin ────────────────────────────────────────────────────────
  const ENTRY = 'unison-runtime-entry';
  const tailwind3Sheets: string[] = [];
  const plugin = {
    name: 'unison-imported-source',
    setup(build: any) {
      build.onResolve({ filter: /.*/ }, (args: any) => {
        if (args.path === ENTRY) return { path: ENTRY, namespace: 'unison' };
        const [specifier, query = ''] = args.path.split('?');
        const importer = args.namespace === 'vfs' ? args.importer : '/index.html';
        if (/^(https?:|data:)/.test(specifier)) return { path: args.path, external: true };
        const local = resolveLocal(specifier, importer);
        if (local) return { path: local, namespace: 'vfs', pluginData: { query } };
        if (specifier.startsWith('.') || specifier.startsWith('/') || plan.aliases.some((a) => specifier.startsWith(a.find)) || specifier.startsWith('virtual:') || specifier.startsWith('~')) {
          diagnostics.push(ASSET_EXT.test(specifier)
            ? { level: 'warning', code: 'asset-missing', message: `${specifier} (used by ${importer.slice(1)}) is not in the imported files.`, path: importer }
            : { level: 'warning', code: 'module-missing', message: `${specifier} (imported by ${importer.slice(1)}) is generated by the project's toolchain or missing; an empty module stands in for it.`, path: importer });
          return { path: specifier, namespace: 'unison-missing' };
        }
        if (/^node:|^(fs|path|os|crypto|child_process|stream|http|https|url|util|zlib|net|tls|worker_threads)$/.test(specifier)) {
          diagnostics.push({ level: 'warning', code: 'node-builtin', message: `${importer.slice(1)} imports the server module ${specifier}; it is unavailable in the browser.`, path: importer });
          return { path: specifier, namespace: 'unison-missing' };
        }
        const name = packageNameOf(specifier);
        if (STYLE_EXT.test(specifier)) return { path: specifier, namespace: 'npm-css' };
        usedPackages.add(name);
        if (!pkgVersion(name)) diagnostics.push({ level: 'warning', code: 'package-undeclared', message: `${name} is imported but not declared in package.json; its latest version was used.`, path: importer });
        return { path: specifier, external: true };
      });
      build.onLoad({ filter: /.*/, namespace: 'unison' }, () => ({ contents: entrySource(), loader: 'tsx', resolveDir: '/' }));
      build.onLoad({ filter: /.*/, namespace: 'unison-missing' }, () => ({ contents: 'module.exports = {};', loader: 'js' }));
      build.onLoad({ filter: /.*/, namespace: 'npm-css' }, async (args: any) => {
        const pkg = await packageCss(args.path);
        return { contents: `__unisonStyle(${JSON.stringify(pkg.path)}, ${JSON.stringify(pkg.content)});`, loader: 'js' };
      });
      build.onLoad({ filter: /.*/, namespace: 'vfs' }, async (args: any) => {
        const path: string = args.path;
        const query: string = args.pluginData?.query ?? '';
        const resolveDir = dirname(path);
        const text = files[path];
        if (/(^|&)raw($|&)/.test(query)) return { contents: `export default ${JSON.stringify(text ?? '')};`, loader: 'js' };
        if (STYLE_EXT.test(path)) {
          const { css, tailwind3 } = await compileStylesheet(path);
          if (tailwind3) { tailwind3Sheets.push(css); return { contents: '', loader: 'js' }; }
          if (/(^|&)url($|&)/.test(query)) {
            return { contents: `export default URL.createObjectURL(new Blob([${JSON.stringify(css)}], { type: 'text/css' }));`, loader: 'js' };
          }
          if (/(^|&)inline($|&)/.test(query)) return { contents: `export default ${JSON.stringify(css)};`, loader: 'js' };
          if (/\.module\.(css|pcss)$/.test(path)) {
            diagnostics.push({ level: 'warning', code: 'css-modules', message: `${path.slice(1)} is a CSS module; its class names are kept unscoped in this preview.`, path });
            return { contents: `__unisonStyle(${JSON.stringify(path)}, ${JSON.stringify(css)}); export default new Proxy({}, { get: (_, key) => String(key) });`, loader: 'js' };
          }
          return { contents: `__unisonStyle(${JSON.stringify(path)}, ${JSON.stringify(css)});`, loader: 'js' };
        }
        if (/\.asset\.json$/.test(path) && text !== undefined) {
          const url = pointerUrl(path);
          // JSON semantics are kept: the default export is the pointer object;
          // only its url is made absolute so the image loads in the preview.
          return { contents: `export default { ...${text.trim() || '{}'}, url: ${JSON.stringify(url)} };`, loader: 'js' };
        }
        if (ASSET_EXT.test(path) || (text === undefined && assetUrls[path])) {
          const url = urlForLocalFile(path);
          if (!url) diagnostics.push({ level: 'warning', code: 'asset-missing', message: `${path.slice(1)} could not be loaded.`, path });
          return { contents: `export default ${JSON.stringify(url ?? '')};`, loader: 'js' };
        }
        if (text === undefined) return { contents: 'export default undefined;', loader: 'js' };
        if (/\.json$/.test(path)) return { contents: text, loader: 'json' };
        const ext = path.split('.').pop() ?? 'js';
        const loader = ext === 'tsx' ? 'tsx' : ext === 'jsx' ? 'jsx' : /^(ts|mts|cts)$/.test(ext) ? 'ts' : 'jsx';
        if (plan.kind === 'tanstack-start' && plan.routesDir && path.startsWith(`${plan.routesDir}/`) && /\bserver\s*:\s*{/.test(text) && !/\bcomponent\s*:/.test(text)) {
          const route = /createFileRoute\(\s*(["'`])([^"'`]+)\1\s*\)/.exec(text)?.[2] ?? '/';
          diagnostics.push({ level: 'info', code: 'server-route', message: `${path.slice(1)} (${route}) is a server-only route; it runs only on the project's own server.`, path });
          adaptations.add('Server-only routes are registered without their server handlers, as the project\'s own client build does.');
          return { contents: `import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute(${JSON.stringify(route)})({});`, loader: 'ts', resolveDir };
        }
        return { contents: text, loader, resolveDir };
      });
    },
  };

  const entrySource = (): string => {
    if (plan.kind === 'tanstack-start') {
      return [
        `import * as routerModule from ${JSON.stringify(plan.entry)};`,
        `import { RouterProvider } from '@tanstack/react-router';`,
        `import { createElement } from 'react';`,
        `import { createRoot } from 'react-dom/client';`,
        `const factory = routerModule[${JSON.stringify(plan.routerExport)}];`,
        `const router = typeof factory === 'function' ? factory() : factory;`,
        `createRoot(document).render(createElement(RouterProvider, { router }));`,
      ].join('\n');
    }
    return `import ${JSON.stringify(plan.entry)};`;
  };

  const env: Record<string, unknown> = { MODE: 'production', DEV: false, PROD: true, SSR: false, BASE_URL: '/' };
  let output = '';
  const bareImports = new Set<string>();
  try {
    const result = await esbuild.build({
      entryPoints: [ENTRY],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      minify: true,
      metafile: true,
      logLevel: 'silent',
      jsx: 'automatic',
      jsxImportSource: plan.jsxImportSource,
      tsconfigRaw: plan.tsconfigRaw,
      define: {
        'import.meta.env': JSON.stringify(env),
        'process.env.NODE_ENV': '"production"',
        'import.meta.hot': 'undefined',
      },
      outdir: '/out',
      plugins: [plugin],
    });
    output = result.outputFiles?.find((f) => f.path.endsWith('.js'))?.text ?? '';
    for (const out of Object.values((result.metafile?.outputs ?? {}) as Record<string, { imports?: Array<{ path: string; external?: boolean }> }>)) {
      for (const imp of out.imports ?? []) if (imp.external && !/^(https?:|data:)/.test(imp.path)) bareImports.add(imp.path);
    }
    for (const warning of result.warnings.slice(0, 20)) diagnostics.push({ level: 'info', code: 'build-warning', message: warning.text, path: warning.location?.file });
  } catch (error) {
    const errors = (error as { errors?: Array<{ text: string; location?: { file?: string; line?: number } }> }).errors;
    for (const e of errors?.slice(0, 20) ?? [{ text: error instanceof Error ? error.message : String(error) }]) {
      diagnostics.push({ level: 'error', code: 'build-error', message: e.location?.file ? `${e.location.file}:${e.location.line}: ${e.text}` : e.text, path: e.location?.file });
    }
  }

  // ── import map: exact versions, shared single copies ─────────────────────
  // Every shared package is marked external for every other one, so the page
  // gets one copy of each at the pinned version. The CDN accepts scoped names
  // in that list only in query form, so each specifier the bundle imports gets
  // an exact entry; prefix entries cover deeper subpaths CDN modules request.
  const shared = [...new Set([...usedPackages, ...Object.keys(plan.packages)])].filter((n) => pkgVersion(n) || usedPackages.has(n)).sort();
  const imports: Record<string, string> = {};
  const at = (name: string) => `${cdn}/${name}${pkgVersion(name) ? `@${pkgVersion(name)}` : ''}`;
  for (const name of shared) {
    const others = shared.filter((n) => n !== name && pkgVersion(n));
    const unscoped = others.filter((n) => !n.startsWith('@'));
    imports[name] = `${at(name)}?${others.length ? `external=${others.join(',')}&` : ''}target=es2022`;
    imports[`${name}/`] = `${at(name)}${unscoped.length ? `&external=${unscoped.join(',')}` : ''}&target=es2022/`;
  }
  for (const specifier of [...bareImports].sort()) {
    const name = packageNameOf(specifier);
    if (specifier === name) continue;
    const others = shared.filter((n) => n !== name && pkgVersion(n));
    imports[specifier] = `${at(name)}${specifier.slice(name.length)}?${others.length ? `external=${others.join(',')}&` : ''}target=es2022`;
  }
  for (const name of plan.unpinned) if (usedPackages.has(name)) diagnostics.push({ level: 'warning', code: 'package-unpinned', message: `${name} has no lockfile entry; version ${plan.packages[name]} from package.json was used.` });

  const helper = `window.__unisonStyle = (id, css) => { const el = document.createElement('style'); el.dataset.unisonSource = id; el.textContent = css; document.head.appendChild(el); };`;
  const head = [
    `<script type="importmap">${escapeScript(JSON.stringify({ imports }))}</script>`,
    `<script>${helper}</script>`,
    ...tailwind3Sheets.map((css) => `<style type="text/tailwindcss">${css.replace(/<\/style/gi, '<\\/style')}</style>`),
  ];
  if (tailwind3Sheets.length) {
    const twVersion = plan.versions.tailwindcss ?? '3';
    head.push(`<script src="https://cdn.tailwindcss.com/${twVersion}"></script>`);
    diagnostics.push({ level: 'info', code: 'tailwind3-runtime', message: 'Tailwind 3 styles are generated in the preview frame; plugins and JavaScript config options from tailwind.config are not applied.' });
  }
  const moduleTag = `<script type="module">${escapeScript(output)}</script>`;

  let document = '';
  if (plan.kind === 'vite-html' && plan.htmlTemplate) {
    const entryAttr = plan.entry!.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let html = files[plan.htmlTemplate];
    const entryTag = new RegExp(`<script[^>]*type=["']module["'][^>]*src=["'](?:\\.?/)?${entryAttr}["'][^>]*>\\s*</script>`, 'i');
    html = html.replace(entryTag, moduleTag);
    html = html.replace(/(<(?:link|img|script|source)\b[^>]*\s(?:href|src)=["'])(\/[^"'#?]+)(["'])/gi, (whole, pre, ref: string, post) => {
      const url = publicUrls[ref] ?? urlForLocalFile(ref);
      return url ? `${pre}${url}${post}` : whole;
    });
    html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}\n${head.join('\n')}`) : `${head.join('\n')}${html}`;
    document = html;
  } else {
    document = `<!DOCTYPE html><html><head>${head.join('')}</head><body>${moduleTag}</body></html>`;
  }

  return {
    ok: !diagnostics.some((d) => d.level === 'error') && output.length > 0,
    document,
    diagnostics,
    adaptations: [...adaptations],
    importMap: { imports },
    publicUrls,
    bytes: document.length,
  };
}
