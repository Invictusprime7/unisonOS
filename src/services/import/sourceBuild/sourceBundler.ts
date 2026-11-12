/**
 * UIMP-01 in-browser source build. Bundles an imported project from its saved
 * VFS bytes with esbuild, exactly as written: no source rewriting, no Unison
 * components, no theme injection. Packages load at the lockfile's exact
 * versions (or package.json's) from a public module CDN through an import
 * map; local images come from the project's stored assets; local workspace
 * packages resolve inside the upload.
 *
 * The esbuild instance, Tailwind 4 compiler, component compiler (Vue, Svelte,
 * Solid, Sass, Less) and text fetcher are injected so the same build runs in
 * the browser and in tests.
 *
 * Host adaptations — never edits to the saved source — are listed in
 * `adaptations` so the preview can say exactly what differs from the
 * project's own toolchain.
 */
import { isImportRecordPath } from '@/services/import/importedSourceRecords';
import type { SourceBuildPlan } from './sourceBuildPlan';
import { NEXT_JSX_SOURCE, NEXT_RUNTIME_ID, nextEntrySource, nextGoogleFontSource, nextLocalFontSource, nextShimSource } from './nextClientRuntime';

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

export type ComponentCompileKind = 'vue' | 'svelte' | 'svelte-module' | 'solid' | 'sass' | 'less';
export interface ComponentCompileRequest {
  kind: ComponentCompileKind;
  version: string;
  path: string;
  source: string;
  /** Text files the compiler may read (style partials, type imports). */
  files?: Record<string, string>;
  /** Package versions, for stylesheet imports from packages. */
  versions?: Record<string, string>;
  options?: Record<string, unknown>;
}
export interface ComponentCompileResult {
  code?: string;
  css?: string[];
  lang?: string;
  warnings?: string[];
  error?: string;
}
export interface ComponentCompiler {
  compile(request: ComponentCompileRequest): Promise<ComponentCompileResult>;
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
  compiler?: ComponentCompiler | null;
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

const STYLE_EXT = /\.(css|pcss|postcss|scss|sass|less)$/;
const ASSET_EXT = /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp|woff2?|ttf|otf|eot|mp4|webm|mov|mp3|wav|ogg|m4a|pdf|glb|gltf|hdr|wasm|txt|md|csv)$/i;
const RESOLVE_SUFFIXES = ['', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs', '.mts', '.vue', '.svelte', '.json', '.css', '.scss', '/index.tsx', '/index.ts', '/index.jsx', '/index.js', '/index.mjs', '/index.vue', '/index.svelte'];
const MIME: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon', avif: 'image/avif', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json', css: 'text/css', js: 'text/javascript', html: 'text/html' };
const FONT_EXT = /\.(woff2?|ttf|otf|eot)$/i;
const NODE_BUILTIN = /^node:|^(fs|fs\/promises|path|os|crypto|child_process|stream|http|https|url|util|zlib|net|tls|worker_threads|module|process|buffer|events|assert|dns|readline|vm|perf_hooks|async_hooks|cluster|v8)$/;

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
function shortHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36).slice(0, 6);
}

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

/**
 * CSS Modules: every local class gets a file-unique name, as the project's own
 * bundler does; `:global(...)` stays as written. Returns the scoped CSS and the
 * exported name map.
 */
export function scopeCssModule(css: string, path: string): { css: string; map: Record<string, string> } {
  const suffix = shortHash(path);
  const map: Record<string, string> = {};
  const scopeSelector = (selector: string) => {
    const globals: string[] = [];
    let s = selector.replace(/:global\(([^)]*)\)/g, (_, inner: string) => { globals.push(inner); return `\u0000${globals.length - 1}\u0000`; });
    s = s.replace(/:local\(([^)]*)\)/g, '$1');
    s = s.replace(/\.(-?[_a-zA-Z][\w-]*)/g, (_, name: string) => { map[name] ??= `${name}_${suffix}`; return `.${map[name]}`; });
    return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => globals[Number(i)]);
  };
  let out = '';
  let i = 0;
  let depthKeyframes = -1;
  let depth = 0;
  while (i < css.length) {
    if (css.startsWith('/*', i)) { const end = css.indexOf('*/', i + 2); const stop = end < 0 ? css.length : end + 2; out += css.slice(i, stop); i = stop; continue; }
    const open = css.indexOf('{', i);
    const close = css.indexOf('}', i);
    if (open < 0 && close < 0) { out += css.slice(i); break; }
    if (close >= 0 && (open < 0 || close < open)) {
      out += css.slice(i, close + 1);
      depth -= 1;
      if (depth <= depthKeyframes) depthKeyframes = -1;
      i = close + 1;
      continue;
    }
    const prelude = css.slice(i, open);
    const trimmed = prelude.trim();
    const lastSemi = prelude.lastIndexOf(';');
    const head = lastSemi >= 0 ? prelude.slice(0, lastSemi + 1) : '';
    const selector = lastSemi >= 0 ? prelude.slice(lastSemi + 1) : prelude;
    if (trimmed.startsWith('@')) {
      if (/^@(-\w+-)?keyframes\b/.test(trimmed)) depthKeyframes = depth;
      out += prelude + '{';
    } else if (depthKeyframes >= 0) {
      out += prelude + '{';
    } else {
      out += head + scopeSelector(selector) + '{';
    }
    depth += 1;
    i = open + 1;
  }
  out = out.replace(/composes\s*:[^;]+;/g, '');
  return { css: out, map };
}

interface GlobOptions { eager?: boolean; import?: string; query?: string }
function relativeFrom(fromDir: string, to: string): string {
  const a = fromDir.split('/').filter(Boolean);
  const b = to.split('/').filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i += 1;
  const up = a.length - i;
  return `${up ? '../'.repeat(up) : './'}${b.slice(i).join('/')}`;
}
function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') { re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*'; i += glob[i + 2] === '/' ? 2 : 1; }
    else if (ch === '*') re += '[^/]*';
    else if (ch === '?') re += '[^/]';
    else if (ch === '{') { const end = glob.indexOf('}', i); re += `(?:${glob.slice(i + 1, end).split(',').map((p) => p.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|')})`; i = end; }
    else re += ch.replace(/[.+^$()|[\]\\/]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export async function buildImportedSource(input: SourceBuildInput): Promise<SourceBuildResult> {
  const { esbuild, plan, assetUrls, fetchText } = input;
  const cdn = (input.cdnOrigin ?? 'https://esm.sh').replace(/\/$/, '');
  const files = Object.fromEntries(Object.entries(input.files).filter(([p]) => !isImportRecordPath(p)));
  const diagnostics: SourceBuildDiagnostic[] = [];
  const adaptations = new Set<string>();
  const root = plan.root ?? '';
  const publicDir = `${root}/public`;
  const isNext = plan.kind === 'next-client';
  const has = (p: string) => Object.prototype.hasOwnProperty.call(files, p) || Object.prototype.hasOwnProperty.call(assetUrls, p);
  const pkgVersion = (name: string) => plan.packages[name] ?? null;
  const usedPackages = new Set<string>();
  const warned = new Set<string>();
  const warnOnce = (d: SourceBuildDiagnostic) => { const key = `${d.code}:${d.message}`; if (!warned.has(key)) { warned.add(key); diagnostics.push(d); } };
  const jsxImportSource = isNext && plan.jsxImportSource === 'react' ? NEXT_JSX_SOURCE : plan.jsxImportSource;
  if (root) adaptations.add(`The app was found in ${root.slice(1)}/ inside the upload and builds from there.`);

  // ── local files & public folder ───────────────────────────────────────────
  const publicUrls: Record<string, string> = {};
  for (const path of [...Object.keys(files), ...Object.keys(assetUrls)]) {
    if (!path.startsWith(`${publicDir}/`)) continue;
    const served = path.slice(publicDir.length);
    publicUrls[served] = assetUrls[path] ?? textDataUrl(path, files[path]);
  }
  const urlForLocalFile = (path: string): string | null => {
    if (assetUrls[path]) return assetUrls[path];
    if (files[path] !== undefined) return textDataUrl(path, files[path]);
    return publicUrls[path] ?? null;
  };
  const withSuffix = (target: string): string | null => {
    for (const suffix of RESOLVE_SUFFIXES) if (has(`${target}${suffix}`)) return `${target}${suffix}`;
    // TypeScript ESM style: './x.js' written for './x.ts'.
    const js = /\.(m|c)?js$/.exec(target);
    if (js) for (const ext of ['.ts', '.tsx', '.mts', '.cts']) { const alt = target.replace(/\.(m|c)?js$/, ext); if (has(alt)) return alt; }
    return null;
  };
  const resolveLocal = (specifier: string, importer: string): string | null => {
    let target: string | null = null;
    const alias = plan.aliases.find((a) => specifier === a.find.replace(/\/$/, '') || specifier.startsWith(a.find));
    if (alias) target = joinPath('/', `${alias.replacement}${specifier.slice(alias.find.length)}`);
    else if (specifier.startsWith('./') || specifier.startsWith('../') || specifier === '.' || specifier === '..') target = joinPath(dirname(importer), specifier);
    else if (specifier.startsWith('/')) {
      if (root && specifier.startsWith(`${root}/`)) target = specifier;
      else {
        const inRoot = withSuffix(`${root}${specifier}`);
        if (inRoot) return inRoot;
        if (has(`${publicDir}${specifier}`)) return `${publicDir}${specifier}`;
        target = specifier;
      }
    }
    if (!target) return null;
    const hit = withSuffix(target);
    if (hit) return hit;
    if (!target.startsWith(`${root}/src/`) && has(`${publicDir}${target.slice(root.length)}`)) return `${publicDir}${target.slice(root.length)}`;
    return null;
  };

  // ── local workspace packages ──────────────────────────────────────────────
  const pickExport = (value: any): string | null => {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return null;
    for (const key of ['source', 'browser', 'import', 'module', 'default', 'require']) {
      if (key in value) { const hit = pickExport(value[key]); if (hit) return hit; }
    }
    return null;
  };
  const resolveWorkspace = (specifier: string): string | null => {
    const name = packageNameOf(specifier);
    const dir = plan.localPackages?.[name];
    if (!dir) return null;
    const sub = specifier.slice(name.length);
    let manifest: any = {};
    try { manifest = JSON.parse(files[`${dir}/package.json`] ?? '{}'); } catch { manifest = {}; }
    const candidates: string[] = [];
    const exp = manifest.exports;
    if (sub) {
      const key = `.${sub}`;
      if (exp && typeof exp === 'object' && exp[key]) { const e = pickExport(exp[key]); if (e) candidates.push(joinPath(dir, e)); }
      if (exp && typeof exp === 'object') {
        for (const [pattern, target] of Object.entries(exp)) {
          if (!pattern.includes('*')) continue;
          const [pre, post] = pattern.split('*');
          if (key.startsWith(pre) && key.endsWith(post)) {
            const e = pickExport(target);
            if (e) candidates.push(joinPath(dir, e.replace('*', key.slice(pre.length, key.length - post.length))));
          }
        }
      }
      candidates.push(joinPath(dir, sub.slice(1)), joinPath(dir, `src${sub}`));
    } else {
      if (manifest.source) candidates.push(joinPath(dir, manifest.source));
      const dot = exp && (typeof exp === 'string' || Array.isArray(exp) ? exp : exp['.'] ?? (Object.keys(exp).every((k) => !k.startsWith('.')) ? exp : null));
      const e = pickExport(dot);
      if (e) candidates.push(joinPath(dir, e));
      for (const field of ['module', 'browser', 'main']) if (typeof manifest[field] === 'string') candidates.push(joinPath(dir, manifest[field]));
      candidates.push(`${dir}/src/index`, `${dir}/index`);
    }
    for (const c of candidates) {
      const hit = withSuffix(c);
      if (hit) return hit;
      // Built output is not part of an import; fall back to the package's source.
      const fromSource = withSuffix(c.replace(/\/(dist|build|lib|out)\//, '/src/').replace(/\.(m|c)?js$/, ''));
      if (fromSource) return fromSource;
    }
    return null;
  };

  // ── component compiler ────────────────────────────────────────────────────
  const styleFiles = Object.fromEntries(Object.entries(files).filter(([p]) => STYLE_EXT.test(p)));
  const compile = async (request: Omit<ComponentCompileRequest, 'version'>, version: string | null): Promise<ComponentCompileResult | null> => {
    if (!input.compiler || !version) {
      diagnostics.push({ level: 'error', code: 'compiler-missing', message: `${request.path.slice(1)} needs the ${request.kind} compiler, which is not available here.`, path: request.path });
      return null;
    }
    const out = await input.compiler.compile({ ...request, version });
    for (const w of out.warnings?.slice(0, 5) ?? []) diagnostics.push({ level: 'info', code: `${request.kind}-warning`, message: w, path: request.path });
    if (out.error) { diagnostics.push({ level: 'error', code: `${request.kind}-error`, message: `${request.path.slice(1)}: ${out.error}`, path: request.path }); return null; }
    return out;
  };

  // ── styles ────────────────────────────────────────────────────────────────
  const packageCss = async (specifier: string): Promise<{ path: string; content: string }> => {
    const name = packageNameOf(specifier.replace(/^~/, ''));
    const spec = specifier.replace(/^~/, '');
    const version = pkgVersion(name) ?? plan.versions[name] ?? null;
    const pinned = version ?? 'latest';
    let sub = spec.slice(name.length).replace(/^\//, '');
    if (!sub) {
      if (name === 'tailwindcss') sub = 'index.css';
      else {
        const manifest = JSON.parse(await fetchText(`https://cdn.jsdelivr.net/npm/${name}@${pinned}/package.json`)) as { style?: string; exports?: any };
        const dot = manifest.exports?.['.'];
        sub = (typeof dot === 'object' && (dot.style ?? dot.default)) || manifest.style || 'index.css';
        sub = String(sub).replace(/^\.\//, '');
      }
    } else if (!/\.css$/.test(sub)) {
      const exportsCss = await fetchText(`https://cdn.jsdelivr.net/npm/${name}@${pinned}/package.json`).then((t) => JSON.parse(t)?.exports?.[`./${sub}`]).catch(() => null);
      const viaExports = exportsCss && (typeof exportsCss === 'string' ? exportsCss : exportsCss.style ?? exportsCss.default ?? exportsCss.import);
      sub = typeof viaExports === 'string' && viaExports.endsWith('.css') ? viaExports.replace(/^\.\//, '') : `${sub}.css`;
    }
    if (!version) warnOnce({ level: 'warning', code: 'css-package-unpinned', message: `${name} is not in package.json; its latest stylesheet was used.` });
    return { path: `npm:${name}/${sub}`, content: await fetchText(`https://cdn.jsdelivr.net/npm/${name}@${pinned}/${sub}`) };
  };
  const rewriteCssUrls = (css: string, fromPath: string): string => css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, _quote, ref: string) => {
    if (/^(data:|https?:|#|blob:|\/\/)/.test(ref) || fromPath.startsWith('npm:')) return whole;
    const clean = ref.split(/[?#]/)[0];
    const resolved = clean.startsWith('/')
      ? (has(`${publicDir}${clean}`) ? `${publicDir}${clean}` : has(`${root}${clean}`) ? `${root}${clean}` : clean)
      : (resolveLocal(clean, fromPath) ?? joinPath(dirname(fromPath), clean));
    const url = urlForLocalFile(resolved);
    if (!url) { warnOnce({ level: 'warning', code: 'css-asset-missing', message: `${ref} is referenced by ${fromPath.slice(1)} but is not in the imported files.`, path: fromPath }); return whole; }
    return `url(${JSON.stringify(url)})`;
  });
  const inlinePlainImports = async (css: string, fromPath: string, seen: Set<string>): Promise<string> => {
    const parts: string[] = [];
    let rest = css;
    const re = /@import\s+(?:url\()?\s*["']([^"']+)["']\s*\)?\s*([^;]*);/;
    for (let m = re.exec(rest); m; m = re.exec(rest)) {
      parts.push(rest.slice(0, m.index));
      const ref = m[1];
      if (/^(https?:)?\/\//.test(ref)) parts.push(m[0]);
      else {
        const local = ref.startsWith('.') || ref.startsWith('/') || plan.aliases.some((a) => ref.startsWith(a.find)) ? resolveLocal(ref, fromPath) ?? joinPath(dirname(fromPath), ref) : null;
        if (local && files[local] !== undefined && !seen.has(local)) {
          seen.add(local);
          const nested = /\.(s[ac]ss|less)$/.test(local) ? (await compileStylesheet(local)).css : await inlinePlainImports(rewriteCssUrls(files[local], local), local, seen);
          parts.push(m[2]?.trim() ? `@media ${m[2].trim()}{${nested}}` : nested);
        } else if (!local) {
          try { const pkg = await packageCss(ref); parts.push(pkg.content); }
          catch { warnOnce({ level: 'warning', code: 'css-import-missing', message: `${fromPath.slice(1)} imports ${ref}, which could not be loaded.`, path: fromPath }); }
        } else parts.push(m[0]);
      }
      rest = rest.slice(m.index + m[0].length);
    }
    parts.push(rest);
    // Keep remote @import rules first, as CSS requires.
    const joined = parts.join('');
    const remoteRe = /@import\s+url\([^)]*\)[^;]*;|@import\s+["'](?:https?:)?\/\/[^"']+["'][^;]*;/g;
    const remote = joined.match(remoteRe) ?? [];
    return remote.length ? `${remote.join('\n')}\n${joined.replace(remoteRe, '')}` : joined;
  };
  let candidates: string[] | null = null;
  const tailwind3Sheets: string[] = [];
  const compileStylesheet = async (path: string): Promise<{ css: string; tailwind3: boolean }> => {
    let source = files[path];
    if (/\.(s[ac]ss)$/.test(path) || /\.less$/.test(path)) {
      const kind = /\.less$/.test(path) ? 'less' : 'sass';
      const out = await compile({ kind, path, source, files: styleFiles, versions: plan.versions, options: { indented: path.endsWith('.sass'), loadPaths: [`${root}/src`, root || '/'] } }, plan.compilers?.[kind] ?? (kind === 'sass' ? '1' : '4'));
      source = out?.code ?? '';
    }
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
          if (id.startsWith('.') || id.startsWith('/') || plan.aliases.some((a) => id.startsWith(a.find))) {
            const local = resolveLocal(id, `${base}/x.css`) ?? joinPath(base, id);
            if (files[local] === undefined) throw new Error(`Stylesheet ${id} is not in the imported files.`);
            return { path: local, base: dirname(local), content: rewriteCssUrls(files[local], local) };
          }
          const pkg = await packageCss(id);
          return { path: pkg.path, base: dirname(pkg.path), content: pkg.content };
        },
        loadModule: async (id, base, hint) => {
          warnOnce({ level: 'warning', code: 'tailwind-module-skipped', message: `Tailwind ${hint} "${id}" runs only in the project's own toolchain; its extra utilities are not in this preview.`, path });
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
  const styleModule = async (path: string, query: string): Promise<string> => {
    const { css, tailwind3 } = await compileStylesheet(path);
    if (tailwind3) { tailwind3Sheets.push(css); return ''; }
    if (/(^|&)url($|&)/.test(query)) return `export default URL.createObjectURL(new Blob([${JSON.stringify(css)}], { type: 'text/css' }));`;
    if (/(^|&)inline($|&)/.test(query)) return `export default ${JSON.stringify(css)};`;
    if (/\.module\.\w+$/.test(path)) {
      const scoped = scopeCssModule(css, path);
      adaptations.add('CSS Modules are scoped with file-unique class names, as the project\'s own bundler does.');
      return `__unisonStyle(${JSON.stringify(path)}, ${JSON.stringify(scoped.css)});\nconst styles = ${JSON.stringify(scoped.map)};\nexport default new Proxy(styles, { get: (t, k) => (typeof k === 'string' ? (t[k] ?? k) : undefined) });`;
    }
    return `__unisonStyle(${JSON.stringify(path)}, ${JSON.stringify(css)});`;
  };

  // ── pointer assets (`foo.png.asset.json`) ─────────────────────────────────
  const pointerUrl = (path: string): string | null => {
    try {
      const pointer = JSON.parse(files[path]) as { url?: string; project_id?: string };
      if (!pointer.url) return null;
      if (/^https?:/.test(pointer.url)) return pointer.url;
      if (input.pointerOrigin) {
        adaptations.add(`Hosted images (${'*.asset.json'}) load from ${input.pointerOrigin}.`);
        return `${input.pointerOrigin.replace(/\/$/, '')}${pointer.url}`;
      }
      // A Lovable asset pointer resolves on the preview address of the project that owns it.
      if (pointer.project_id && /^[0-9a-f-]{36}$/i.test(pointer.project_id) && pointer.url.startsWith('/')) {
        adaptations.add('Hosted images (*.asset.json) load from the project they were uploaded to.');
        return `https://id-preview--${pointer.project_id.toLowerCase()}.lovable.app${pointer.url}`;
      }
      warnOnce({ level: 'warning', code: 'asset-pointer-origin', message: `${path.slice(1)} points at ${pointer.url} on the site it was published from; add that site address to load it.`, path });
      return pointer.url;
    } catch { return null; }
  };

  // ── Vite import.meta.glob ─────────────────────────────────────────────────
  const expandGlobs = (text: string, path: string): string => {
    if (!text.includes('import.meta.glob')) return text;
    const hoisted: string[] = [];
    let n = 0;
    const replaced = text.replace(/import\.meta\.glob(?:<[^>]*>)?\(\s*(\[[^\]]*\]|(['"`])[^'"`]+\2)\s*(?:,\s*(\{[^}]*\}))?\s*\)/g, (_whole, patternsRaw: string, _q, optsRaw?: string) => {
      const patterns = [...patternsRaw.matchAll(/(['"`])([^'"`]+)\1/g)].map((m) => m[2]);
      const opts: GlobOptions = {};
      if (optsRaw) {
        if (/eager\s*:\s*true/.test(optsRaw)) opts.eager = true;
        opts.import = /import\s*:\s*(['"])([^'"]+)\1/.exec(optsRaw)?.[2];
        opts.query = /query\s*:\s*(['"])([^'"]+)\1/.exec(optsRaw)?.[2] ?? (/as\s*:\s*(['"])raw\1/.test(optsRaw) ? '?raw' : undefined);
      }
      const positive = patterns.filter((p) => !p.startsWith('!'));
      const negative = patterns.filter((p) => p.startsWith('!')).map((p) => p.slice(1));
      const toAbs = (p: string) => {
        const alias = plan.aliases.find((a) => p.startsWith(a.find));
        if (alias) return joinPath('/', `${alias.replacement}${p.slice(alias.find.length)}`);
        return p.startsWith('/') ? `${root}${p}` : joinPath(dirname(path), p);
      };
      const matchers = positive.map((p) => ({ raw: p, re: globToRegExp(toAbs(p)) }));
      const excluders = negative.map((p) => globToRegExp(toAbs(p)));
      const hits = Object.keys(files).concat(Object.keys(assetUrls)).filter((f) => f !== path && matchers.some((m) => m.re.test(f)) && !excluders.some((re) => re.test(f))).sort();
      const entries = hits.map((abs) => {
        const raw = matchers.find((m) => m.re.test(abs))!.raw;
        const key = raw.startsWith('.') ? relativeFrom(dirname(path), abs) : abs.slice(root.length);
        const spec = JSON.stringify(`${abs}${opts.query ?? ''}`);
        if (opts.eager) {
          const id = `__unison_glob_${n++}`;
          hoisted.push(opts.import && opts.import !== '*' ? `import { ${opts.import === 'default' ? 'default' : opts.import} as ${id} } from ${spec};` : `import * as ${id} from ${spec};`);
          return `${JSON.stringify(key)}: ${id}`;
        }
        const pick = opts.import && opts.import !== '*' ? `.then((m) => m[${JSON.stringify(opts.import)}])` : '';
        return `${JSON.stringify(key)}: () => import(${spec})${pick}`;
      });
      adaptations.add('Vite import.meta.glob patterns are expanded from the imported files at build time.');
      return `({ ${entries.join(', ')} })`;
    });
    return hoisted.length ? `${hoisted.join('\n')}\n${replaced}` : replaced;
  };

  // ── Next.js fonts ─────────────────────────────────────────────────────────
  const googleFontNames: string[] = [];
  if (isNext) {
    for (const text of Object.values(files)) {
      for (const m of text.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']next\/font\/google["']/g)) {
        for (const part of m[1].split(',')) { const name = part.trim().split(/\s+as\s+/)[0]?.trim(); if (name && /^\w+$/.test(name)) googleFontNames.push(name); }
      }
    }
  }
  const fontUrls = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const p of [...Object.keys(files), ...Object.keys(assetUrls)]) if (FONT_EXT.test(p)) { const u = urlForLocalFile(p); if (u) out[p] = u; }
    return out;
  };

  // ── esbuild plugin ────────────────────────────────────────────────────────
  const ENTRY = 'unison-runtime-entry';
  const svgComponent = (svgText: string) => [
    `import { createElement, forwardRef } from 'react';`,
    `const svg = ${JSON.stringify(svgText)};`,
    `const SvgComponent = forwardRef(function SvgComponent(props, ref) {`,
    `  return createElement('svg', { ...props, ref: (el) => {`,
    `    if (typeof ref === 'function') ref(el); else if (ref) ref.current = el;`,
    `    if (!el || el.__unisonSvg) return; el.__unisonSvg = true;`,
    `    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;`,
    `    for (const a of [...doc.attributes]) if (!el.hasAttribute(a.name)) el.setAttribute(a.name, a.value);`,
    `    el.innerHTML = doc.innerHTML;`,
    `  } });`,
    `});`,
  ].join('\n');
  const plugin = {
    name: 'unison-imported-source',
    setup(build: any) {
      build.onResolve({ filter: /.*/ }, (args: any) => {
        if (args.path === ENTRY) return { path: ENTRY, namespace: 'unison' };
        const [specifier, query = ''] = args.path.split('?');
        const importer = args.namespace === 'vfs' ? args.importer : `${root}/index.html`;
        if (/^(https?:|data:)/.test(specifier)) return { path: args.path, external: true };
        if (isNext || specifier === NEXT_RUNTIME_ID) {
          if (specifier === 'next/font/google') return { path: specifier, namespace: 'unison-shim' };
          if (specifier === 'next/font/local') return { path: `${specifier}#${importer}`, namespace: 'unison-shim', pluginData: { importer } };
          if (nextShimSource(specifier) !== null) return { path: specifier, namespace: 'unison-shim' };
          if (specifier === 'next' || specifier.startsWith('next/')) {
            warnOnce({ level: 'warning', code: 'next-module-missing', message: `${importer.slice(1)} imports ${specifier}, which has no browser equivalent; an empty module stands in for it.`, path: importer });
            return { path: specifier, namespace: 'unison-missing' };
          }
        }
        const local = resolveLocal(specifier, importer);
        if (local) return { path: local, namespace: 'vfs', pluginData: { query } };
        const workspace = !specifier.startsWith('.') && !specifier.startsWith('/') ? resolveWorkspace(specifier) : null;
        if (workspace) {
          adaptations.add(`Workspace packages (${Object.keys(plan.localPackages).slice(0, 4).join(', ')}) build from their source in the upload.`);
          return { path: workspace, namespace: 'vfs', pluginData: { query } };
        }
        if (specifier.startsWith('.') || specifier.startsWith('/') || plan.aliases.some((a) => specifier.startsWith(a.find)) || specifier.startsWith('virtual:') || specifier.startsWith('~') || specifier.startsWith('$') || specifier.startsWith('#')) {
          warnOnce(ASSET_EXT.test(specifier)
            ? { level: 'warning', code: 'asset-missing', message: `${specifier} (used by ${importer.slice(1)}) is not in the imported files.`, path: importer }
            : { level: 'warning', code: 'module-missing', message: `${specifier} (imported by ${importer.slice(1)}) is generated by the project's toolchain or missing; an empty module stands in for it.`, path: importer });
          return { path: specifier, namespace: 'unison-missing' };
        }
        if (NODE_BUILTIN.test(specifier)) {
          warnOnce({ level: 'warning', code: 'node-builtin', message: `${importer.slice(1)} imports the server module ${specifier}; it is unavailable in the browser.`, path: importer });
          return { path: specifier, namespace: 'unison-missing' };
        }
        const name = packageNameOf(specifier);
        if (STYLE_EXT.test(specifier)) return { path: specifier, namespace: 'npm-css' };
        usedPackages.add(name);
        if (!pkgVersion(name)) warnOnce({ level: 'warning', code: 'package-undeclared', message: `${name} is imported but its version is not recorded in package.json; its latest version was used.`, path: importer });
        return { path: specifier, external: true };
      });
      build.onLoad({ filter: /.*/, namespace: 'unison' }, () => ({ contents: entrySource(), loader: 'tsx', resolveDir: root || '/' }));
      build.onLoad({ filter: /.*/, namespace: 'unison-missing' }, () => ({ contents: 'module.exports = new Proxy({}, { get: (t, k) => (k === "__esModule" ? false : k === "default" ? t : undefined) });', loader: 'js' }));
      build.onLoad({ filter: /.*/, namespace: 'unison-shim' }, (args: any) => {
        if (args.path === 'next/font/google') { adaptations.add('next/font/google fonts load from Google Fonts directly.'); return { contents: nextGoogleFontSource(googleFontNames), loader: 'js', resolveDir: '/' }; }
        if (args.path.startsWith('next/font/local')) return { contents: nextLocalFontSource(dirname(args.pluginData.importer), fontUrls()), loader: 'js', resolveDir: '/' };
        return { contents: nextShimSource(args.path) ?? 'export {};', loader: 'js', resolveDir: '/' };
      });
      build.onLoad({ filter: /.*/, namespace: 'npm-css' }, async (args: any) => {
        if (/\.(s[ac]ss)$/.test(args.path)) {
          const out = await compile({ kind: 'sass', path: `/__packages__/${args.path}`, source: `@import ${JSON.stringify(args.path)};`, files: styleFiles, versions: plan.versions, options: { loadPaths: [`${root}/src`, root || '/'] } }, plan.compilers?.sass ?? '1');
          return { contents: `__unisonStyle(${JSON.stringify(args.path)}, ${JSON.stringify(out?.code ?? '')});`, loader: 'js' };
        }
        try {
          const pkg = await packageCss(args.path);
          return { contents: `__unisonStyle(${JSON.stringify(pkg.path)}, ${JSON.stringify(pkg.content)});`, loader: 'js' };
        } catch {
          warnOnce({ level: 'warning', code: 'css-import-missing', message: `The stylesheet ${args.path} could not be loaded.` });
          return { contents: '', loader: 'js' };
        }
      });
      build.onLoad({ filter: /.*/, namespace: 'vfs' }, async (args: any) => {
        const path: string = args.path;
        const query: string = args.pluginData?.query ?? '';
        const resolveDir = dirname(path);
        const text = files[path];
        if (/(^|&)raw($|&)/.test(query)) return { contents: `export default ${JSON.stringify(text ?? '')};`, loader: 'js' };
        if (STYLE_EXT.test(path) && text !== undefined) return { contents: await styleModule(path, query), loader: 'js', resolveDir };
        if (/\.asset\.json$/.test(path) && text !== undefined) {
          const url = pointerUrl(path);
          // JSON semantics are kept: the default export is the pointer object;
          // only its url is made absolute so the image loads in the preview.
          return { contents: `export default { ...${text.trim() || '{}'}, url: ${JSON.stringify(url)} };`, loader: 'js' };
        }
        if (/\.svg$/i.test(path) && text !== undefined && (/(^|&)react($|&)/.test(query) || /(^|&)component($|&)/.test(query))) {
          return { contents: `${svgComponent(text)}\nexport default SvgComponent;`, loader: 'js', resolveDir };
        }
        if (ASSET_EXT.test(path) || (text === undefined && assetUrls[path])) {
          const url = urlForLocalFile(path);
          if (!url) warnOnce({ level: 'warning', code: 'asset-missing', message: `${path.slice(1)} could not be loaded.`, path });
          if (/(^|&)url($|&)/.test(query) || !isNext || !/\.(png|jpe?g|gif|webp|avif|svg|ico|bmp)$/i.test(path)) {
            const svgExtra = /\.svg$/i.test(path) && text !== undefined && Boolean(plan.packages.react) && !isNext ? `\n${svgComponent(text)}\nexport const ReactComponent = SvgComponent;` : '';
            return { contents: `export default ${JSON.stringify(url ?? '')};${svgExtra}`, loader: 'js', resolveDir };
          }
          // Next.js static image imports are objects ({ src, width, height }).
          return { contents: `export default { src: ${JSON.stringify(url ?? '')}, width: 0, height: 0, blurDataURL: ${JSON.stringify(url ?? '')} };`, loader: 'js' };
        }
        if (text === undefined) return { contents: 'export default undefined;', loader: 'js' };
        if (/\.json$/.test(path)) return { contents: text, loader: 'json' };
        if (/\.vue$/.test(path)) {
          const out = await compile({ kind: 'vue', path, source: text, files: Object.fromEntries(Object.entries(files).filter(([p]) => /\.(ts|vue|d\.ts)$/.test(p))), versions: plan.versions }, plan.compilers?.vue ?? null);
          if (!out) return { contents: 'export default {};', loader: 'js' };
          adaptations.add('Vue single-file components are compiled with the project\'s own Vue compiler version.');
          const styles = (out.css ?? []).map((css, i) => `__unisonStyle(${JSON.stringify(`${path}#${i}`)}, ${JSON.stringify(rewriteCssUrls(css, path))});`).join('\n');
          return { contents: `${styles}\n${expandGlobs(out.code ?? '', path)}`, loader: out.lang === 'ts' || out.lang === 'tsx' ? (out.lang as 'ts' | 'tsx') : 'js', resolveDir };
        }
        if (/\.svelte$/.test(path) || (plan.compilers?.svelte && Number(plan.compilers.svelte.split('.')[0]) >= 5 && /\.svelte\.(js|ts)$/.test(path))) {
          const out = await compile({ kind: /\.svelte$/.test(path) ? 'svelte' : 'svelte-module', path, source: text }, plan.compilers?.svelte ?? null);
          if (!out) return { contents: 'export default function Missing() {}', loader: 'js' };
          adaptations.add('Svelte components are compiled with the project\'s own Svelte compiler version.');
          const styles = (out.css ?? []).filter(Boolean).map((css, i) => `__unisonStyle(${JSON.stringify(`${path}#${i}`)}, ${JSON.stringify(rewriteCssUrls(css, path))});`).join('\n');
          return { contents: `${styles}\n${out.code ?? ''}`, loader: 'js', resolveDir };
        }
        const ext = path.split('.').pop() ?? 'js';
        if (plan.compilers?.solid && /\.(jsx|tsx)$/.test(path)) {
          const out = await compile({ kind: 'solid', path, source: text }, plan.compilers.solid);
          if (!out) return { contents: 'export default () => null;', loader: 'js' };
          adaptations.add('Solid components are compiled with Solid\'s own JSX compiler.');
          return { contents: expandGlobs(out.code ?? '', path), loader: 'js', resolveDir };
        }
        const loader = ext === 'tsx' ? 'tsx' : ext === 'jsx' ? 'jsx' : /^(ts|mts|cts)$/.test(ext) ? 'ts' : 'jsx';
        if (plan.kind === 'tanstack-start' && plan.routesDir && path.startsWith(`${plan.routesDir}/`) && /\bserver\s*:\s*{/.test(text) && !/\bcomponent\s*:/.test(text)) {
          const route = /createFileRoute\(\s*(["'`])([^"'`]+)\1\s*\)/.exec(text)?.[2] ?? '/';
          diagnostics.push({ level: 'info', code: 'server-route', message: `${path.slice(1)} (${route}) is a server-only route; it runs only on the project's own server.`, path });
          adaptations.add('Server-only routes are registered without their server handlers, as the project\'s own client build does.');
          return { contents: `import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute(${JSON.stringify(route)})({});`, loader: 'ts', resolveDir };
        }
        return { contents: expandGlobs(text, path), loader, resolveDir };
      });
    },
  };

  const mountIds = (entry: string | null): string[] => {
    const text = entry ? files[entry] ?? '' : '';
    const ids = new Set<string>();
    for (const m of text.matchAll(/getElementById\(\s*["'`]([\w-]+)["'`]/g)) ids.add(m[1]);
    for (const m of text.matchAll(/(?:querySelector|mount|\$mount|render)\([^)]*?["'`]#([\w-]+)["'`]/g)) ids.add(m[1]);
    for (const m of text.matchAll(/\bel\s*:\s*["'`]#([\w-]+)["'`]/g)) ids.add(m[1]);
    if (ids.size === 0) ids.add(plan.compilers?.vue || plan.compilers?.svelte ? 'app' : 'root');
    return [...ids];
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
    if (plan.kind === 'next-client') return nextEntrySource(plan);
    if (plan.kind === 'script-entry' && plan.mountComponent && plan.entry) {
      const preact = plan.jsxImportSource === 'preact';
      adaptations.add(`${plan.entry.slice(1)} exports a component without mounting it, so the preview mounts it into #${mountIds(plan.entry)[0]}.`);
      return preact
        ? `import App from ${JSON.stringify(plan.entry)};\nimport { h, render } from 'preact';\nrender(h(App, {}), document.getElementById(${JSON.stringify(mountIds(plan.entry)[0])}));`
        : `import App from ${JSON.stringify(plan.entry)};\nimport { createElement } from 'react';\nimport { createRoot } from 'react-dom/client';\ncreateRoot(document.getElementById(${JSON.stringify(mountIds(plan.entry)[0])})).render(createElement(App));`;
    }
    return (plan.entries.length ? plan.entries : plan.entry ? [plan.entry] : []).map((e) => `import ${JSON.stringify(e)};`).join('\n');
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
      jsxImportSource,
      tsconfigRaw: { ...plan.tsconfigRaw, compilerOptions: { ...(plan.tsconfigRaw as any)?.compilerOptions, jsxImportSource } },
      mainFields: ['browser', 'module', 'main'],
      conditions: ['browser', 'import', 'module', 'default'],
      define: {
        'import.meta.env': JSON.stringify(env),
        'process.env.NODE_ENV': '"production"',
        'process.env': JSON.stringify({ NODE_ENV: 'production', PUBLIC_URL: '', BASE_URL: '/' }),
        'import.meta.hot': 'undefined',
        global: 'globalThis',
        __DEV__: 'false',
        __VUE_OPTIONS_API__: 'true',
        __VUE_PROD_DEVTOOLS__: 'false',
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
      },
      outdir: '/out',
      plugins: [plugin],
    });
    output = result.outputFiles?.find((f) => f.path.endsWith('.js'))?.text ?? '';
    for (const out of Object.values((result.metafile?.outputs ?? {}) as Record<string, { imports?: Array<{ path: string; external?: boolean }> }>)) {
      for (const imp of out.imports ?? []) if (imp.external && !/^(https?:|data:)/.test(imp.path)) bareImports.add(imp.path);
    }
    for (const warning of result.warnings.slice(0, 20)) {
      if (/directive|"use client"|"use server"/i.test(warning.text)) continue;
      diagnostics.push({ level: 'info', code: 'build-warning', message: warning.text, path: warning.location?.file });
    }
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
  for (const name of plan.unpinned) if (usedPackages.has(name)) warnOnce({ level: 'warning', code: 'package-unpinned', message: `${name} has no lockfile entry; ${plan.packages[name] ? `version ${plan.packages[name]} from package.json` : 'its latest version'} was used.` });

  const helper = `window.__unisonStyle = (id, css) => { const el = document.createElement('style'); el.dataset.unisonSource = id; el.textContent = css; document.head.appendChild(el); };`;
  const head = [
    `<script type="importmap">${escapeScript(JSON.stringify({ imports }))}</script>`,
    `<script>${helper}</script>`,
  ];
  const moduleTag = `<script type="module">${escapeScript(output)}</script>`;

  // ── the page the app starts in ────────────────────────────────────────────
  let html: string;
  const mapHtmlRefs = (source: string, templatePath: string) => source.replace(/(<(?:link|img|script|source|video|audio|image|use)\b[^>]*\s(?:href|src|poster|xlink:href)=["'])([^"'#?:]+)(["'])/gi, (whole, pre: string, ref: string, post: string) => {
    if (/^(https?:|data:|\/\/|#|mailto:|tel:)/.test(ref)) return whole;
    const abs = ref.startsWith('/') ? ref : joinPath(dirname(templatePath).slice(root.length) || '/', ref);
    const url = publicUrls[abs] ?? urlForLocalFile(`${root}${abs}`) ?? urlForLocalFile(abs);
    return url ? `${pre}${url}${post}` : whole;
  });
  if ((plan.kind === 'vite-html' || plan.kind === 'script-entry') && plan.htmlTemplate) {
    const templatePath = plan.htmlTemplate;
    html = files[templatePath]
      .replace(/%PUBLIC_URL%/g, '')
      .replace(/<%=\s*BASE_URL\s*%>/g, '/')
      .replace(/<%=?[^%]*%>/g, '')
      .replace(/%(REACT_APP|VITE)_[A-Z0-9_]+%/g, '');
    if (plan.kind === 'vite-html') {
      let first = true;
      html = html.replace(/<script\b([^>]*)>\s*<\/script>/gi, (whole, attrs: string) => {
        if (!/type\s*=\s*["']module["']/i.test(attrs)) return whole;
        const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
        if (!src) return whole;
        const clean = src.split(/[?#]/)[0];
        const resolved = clean.startsWith('/') ? `${root}${clean}` : joinPath(dirname(templatePath), clean);
        if (!plan.entries.includes(resolved) && !plan.entries.includes(`${root}/${clean.replace(/^\.\//, '')}`)) return whole;
        if (!first) return '';
        first = false;
        return moduleTag;
      });
      if (first) html = html.replace(/<\/body>/i, `${moduleTag}</body>`);
    } else {
      html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${moduleTag}</body>`) : `${html}${moduleTag}`;
      adaptations.add(`The app starts from ${plan.entry!.slice(1)} inside ${templatePath.slice(1)}, as its own bundler injects it.`);
    }
    // Stylesheets linked from the page are built like imported ones.
    const linkRe = /<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi;
    const links = html.match(linkRe) ?? [];
    for (const tag of links) {
      const href = /\bhref=["']([^"']+)["']/i.exec(tag)?.[1];
      if (!href || /^(https?:|data:|\/\/)/.test(href)) continue;
      const clean = href.split(/[?#]/)[0];
      const target = clean.startsWith('/') ? (has(`${root}${clean}`) ? `${root}${clean}` : `${publicDir}${clean}`) : joinPath(dirname(templatePath), clean);
      if (files[target] === undefined) continue;
      const { css, tailwind3 } = await compileStylesheet(target);
      if (tailwind3) { tailwind3Sheets.push(css); html = html.replace(tag, ''); continue; }
      html = html.replace(tag, `<style data-unison-source="${target}">${css.replace(/<\/style/gi, '<\\/style')}</style>`);
    }
    html = mapHtmlRefs(html, templatePath);
  } else if (plan.kind === 'script-entry') {
    const ids = mountIds(plan.entry);
    adaptations.add(`The project has no HTML page, so the preview provides a blank page with ${ids.map((id) => `#${id}`).join(', ')} for ${plan.entry!.slice(1)} to start in.`);
    html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${ids.map((id) => `<div id="${id}"></div>`).join('')}${moduleTag}</body></html>`;
  } else if (plan.kind === 'next-client') {
    adaptations.add('Next.js renders every page in the browser here; layouts own the <html> and <body> attributes as in the original.');
    html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="__next"></div>${moduleTag}</body></html>`;
  } else {
    html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${moduleTag}</body></html>`;
  }
  if (tailwind3Sheets.length) {
    // The Tailwind CDN only serves exact versions ("3" is rejected).
    const declaredTw = plan.versions.tailwindcss ?? '';
    const twVersion = /^3\.\d+\.\d+$/.test(declaredTw) ? declaredTw : '3.4.17';
    head.push(...tailwind3Sheets.map((css) => `<style type="text/tailwindcss">${css.replace(/<\/style/gi, '<\\/style')}</style>`));
    // A page that already loads the Tailwind CDN (with its own config) keeps that one script.
    if (!/<script\b[^>]*src=["']https:\/\/cdn\.tailwindcss\.com/i.test(html)) head.push(`<script src="https://cdn.tailwindcss.com/${twVersion}"></script>`);
    diagnostics.push({ level: 'info', code: 'tailwind3-runtime', message: 'Tailwind 3 styles are generated in the preview frame; plugins and JavaScript config options from tailwind.config are not applied.' });
  }
  const document = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}\n${head.join('\n')}`) : `${head.join('\n')}${html}`;

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
