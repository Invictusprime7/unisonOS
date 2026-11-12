/**
 * Browser stand-ins for the Next.js modules a page imports, used only by the
 * imported-source build of Next projects. They let the original page and
 * layout files render in the browser unchanged: routing, links, images,
 * fonts, head tags, scripts and dynamic imports behave like their Next
 * counterparts on the client. Server-only APIs (headers, cookies, caching,
 * server actions) are inert and reported by the build.
 *
 * Module sources are plain JavaScript strings; the bundler serves them as
 * virtual modules. Nothing here edits the imported project.
 */
import type { SourceBuildPlan } from './sourceBuildPlan';

const RUNTIME = String.raw`
import { createElement as h, Component, Fragment, Suspense, lazy, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';

const listeners = new Set();
const snap = () => ({ pathname: decodeURI(location.pathname), search: location.search, hash: location.hash });
let current = snap();
const emit = () => { current = snap(); listeners.forEach((l) => l()); };
addEventListener('popstate', emit);
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
export const useLocationState = () => useSyncExternalStore(subscribe, () => current, () => current);
export let currentParams = {};
export let currentRoute = '/';

export function hrefOf(href) {
  if (typeof href === 'string') return href;
  if (!href) return location.pathname;
  let path = href.pathname || location.pathname;
  const query = { ...(href.query || {}) };
  path = path.replace(/\[(?:\.\.\.)?([^\]]+)\]/g, (_, k) => { const v = query[k]; delete query[k]; return Array.isArray(v) ? v.join('/') : (v ?? ''); });
  const q = new URLSearchParams(query).toString();
  const hash = href.hash ? (String(href.hash).startsWith('#') ? href.hash : '#' + href.hash) : '';
  return path + (q ? '?' + q : '') + hash;
}
export function navigate(href, replace, scroll) {
  const target = hrefOf(href);
  const url = new URL(target, location.href);
  const here = new URL(location.href);
  if (url.protocol !== here.protocol || url.host !== here.host) { location.href = url.href; return; }
  history[replace ? 'replaceState' : 'pushState'](null, '', url.pathname + url.search + url.hash);
  emit();
  if (url.hash) document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView();
  else if (scroll !== false) scrollTo(0, 0);
}
export const router = {
  push: (href, opts) => navigate(href, false, opts?.scroll),
  replace: (href, opts) => navigate(href, true, opts?.scroll),
  back: () => history.back(),
  forward: () => history.forward(),
  refresh: () => emit(),
  prefetch: () => Promise.resolve(),
  reload: () => location.reload(),
  beforePopState: () => {},
  events: { on() {}, off() {}, emit() {} },
};

function compile(pattern) {
  const segs = pattern.split('/').filter(Boolean);
  return (pathname) => {
    const parts = pathname.split('/').filter(Boolean);
    const params = {};
    for (let i = 0; i < segs.length; i += 1) {
      const s = segs[i];
      if (s.startsWith('*')) {
        const optional = s.endsWith('?');
        const name = s.slice(1).replace(/\?$/, '');
        const rest = parts.slice(i);
        if (!rest.length && !optional) return null;
        if (rest.length) params[name] = rest;
        return params;
      }
      if (i >= parts.length) return null;
      if (s.startsWith(':')) params[s.slice(1)] = parts[i];
      else if (s !== parts[i]) return null;
    }
    return parts.length === segs.length ? params : null;
  };
}
const score = (pattern) => pattern.split('/').filter(Boolean).reduce((n, s) => n + (s.startsWith('*') ? 1 : s.startsWith(':') ? 10 : 100), 0) * 10 - (pattern.includes('*') ? 5 : 0);

const isAsync = (C) => typeof C === 'function' && C.constructor && C.constructor.name === 'AsyncFunction';
function Async({ C, props }) {
  const [state, setState] = useState(null);
  const key = JSON.stringify(props.params || {}) + (props.__path || '');
  useEffect(() => {
    let live = true;
    setState(null);
    Promise.resolve().then(() => C(props)).then((el) => live && setState({ el }), (err) => live && setState({ err }));
    return () => { live = false; };
  }, [C, key]);
  if (state && state.err) throw state.err;
  return state ? state.el : null;
}
const render = (C, props) => (!C ? (props.children ?? null) : isAsync(C) ? h(Async, { C, props }) : h(C, props));

class Signal extends Error {}
export class RedirectSignal extends Signal { constructor(url, replace) { super('NEXT_REDIRECT'); this.url = url; this.replace = replace; } }
export class NotFoundSignal extends Signal { constructor() { super('NEXT_NOT_FOUND'); } }
class Boundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { if (error instanceof RedirectSignal) setTimeout(() => navigate(error.url, error.replace !== false)); }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    const e = this.state.error;
    if (!e) return this.props.children;
    if (e instanceof RedirectSignal) return null;
    if (e instanceof NotFoundSignal) return this.props.notFound();
    throw e;
  }
}

const withProps = (obj) => Object.assign(Promise.resolve(obj), obj);

async function applyMetadata(mods, props) {
  let title = null; let template = null; let description = null;
  for (const m of mods) {
    if (!m) continue;
    let md = m.metadata;
    if (!md && typeof m.generateMetadata === 'function') { try { md = await m.generateMetadata(props, Promise.resolve({})); } catch (_) { md = null; } }
    if (!md) continue;
    const t = md.title;
    if (typeof t === 'string') title = template ? template.replace('%s', t) : t;
    else if (t && typeof t === 'object') {
      if (t.absolute) title = t.absolute;
      else if (t.default) title = t.default;
      if (t.template) template = t.template;
    }
    if (md.description) description = md.description;
  }
  if (title) document.title = title;
  if (description) {
    let el = document.querySelector('meta[name="description"]');
    if (!el) { el = document.createElement('meta'); el.setAttribute('name', 'description'); document.head.appendChild(el); }
    el.setAttribute('content', description);
  }
}

function DefaultNotFound() {
  return h('div', { style: { fontFamily: 'system-ui, sans-serif', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
    h('h1', { style: { fontSize: 24, fontWeight: 500 } }, '404 | This page could not be found.'));
}

export function mountNext(config) {
  const routes = config.routes.map((r) => ({ ...r, match: compile(r.path), score: score(r.path) })).sort((a, b) => b.score - a.score);
  const NotFound = (config.notFound && config.notFound.default) || DefaultNotFound;
  const AppShell = config.app && config.app.default;
  function Root() {
    const loc = useLocationState();
    const path = loc.pathname.replace(/\/+$/, '') || '/';
    const hit = useMemo(() => { for (const r of routes) { const params = r.match(path); if (params) return { r, params }; } return null; }, [path]);
    currentParams = hit ? hit.params : {};
    currentRoute = hit ? hit.r.path : path;
    const searchParams = Object.fromEntries(new URLSearchParams(loc.search));
    const params = withProps(currentParams);
    const sp = withProps(searchParams);
    useEffect(() => { if (hit) applyMetadata([...(hit.r.layouts || []), hit.r.page], { params, searchParams: sp }); }, [hit, loc.search]);
    let el;
    if (config.router === 'app') {
      el = hit ? render(hit.r.page.default, { params, searchParams: sp, __path: path }) : h(NotFound);
      for (const t of [...(hit ? hit.r.templates : [])].reverse()) el = render(t.default, { children: el, params });
      el = h(Boundary, { resetKey: path, notFound: () => h(NotFound) }, el);
      const layouts = hit ? hit.r.layouts : (routes.find((r) => r.path === '/') || { layouts: [] }).layouts.slice(0, 1);
      for (const l of [...layouts].reverse()) el = render(l.default, { children: el, params });
    } else {
      const Page = hit ? hit.r.page.default : NotFound;
      el = h(PagesPage, { mod: hit ? hit.r.page : null, Page, params: currentParams, query: { ...searchParams, ...currentParams }, path, AppShell });
    }
    return h(Boundary, { resetKey: path, notFound: () => h(NotFound) }, h(Suspense, { fallback: null }, el));
  }
  const host = document.getElementById('__next') || document.body.appendChild(Object.assign(document.createElement('div'), { id: '__next' }));
  // Next's own document shape: the App Router renders the root layout's body
  // children straight into <body> after a hidden boundary marker, so the host
  // is a display:contents box behind that marker; both routers append the
  // route announcer that reads the new page title to screen readers.
  if (config.router === 'app') {
    host.style.display = 'contents';
    host.before(Object.assign(document.createElement('div'), { hidden: true }));
  }
  mountRouteAnnouncer(config.router === 'app');
  createRoot(host).render(h(Root));
}

const ANNOUNCER_STYLE = 'border:0;clip:rect(0 0 0 0);height:1px;margin:-1px;overflow:hidden;padding:0;position:absolute;top:0;width:1px;white-space:nowrap;word-wrap:normal';
function mountRouteAnnouncer(appRouter) {
  const host = document.createElement('next-route-announcer');
  const live = document.createElement(appRouter ? 'div' : 'p');
  live.id = '__next-route-announcer__';
  live.setAttribute('aria-live', 'assertive');
  live.setAttribute('role', 'alert');
  live.setAttribute('style', ANNOUNCER_STYLE);
  if (appRouter) { host.style.position = 'absolute'; host.attachShadow({ mode: 'open' }).appendChild(live); } else host.appendChild(live);
  document.body.appendChild(host);
  let first = true;
  const announce = () => {
    if (first) { first = false; return; }
    setTimeout(() => { live.textContent = document.title || (document.querySelector('h1') || {}).textContent || location.pathname; }, 50);
  };
  listeners.add(announce);
  announce();
}

function PagesPage({ mod, Page, params, query, path, AppShell }) {
  const [state, setState] = useState(() => ({ path: null, props: {} }));
  const loader = mod && (mod.getStaticProps || mod.getServerSideProps);
  useEffect(() => {
    if (!loader) return;
    let live = true;
    Promise.resolve().then(() => loader({ params, query, locale: undefined, req: {}, res: {} })).then((out) => {
      if (!live) return;
      if (out && out.redirect) { navigate(out.redirect.destination, true); return; }
      setState({ path, props: (out && out.props) || {}, notFound: Boolean(out && out.notFound) });
    }, (err) => live && setState({ path, props: {}, error: err }));
    return () => { live = false; };
  }, [path]);
  if (loader && state.path !== path) return null;
  if (state.error) throw state.error;
  if (state.notFound) throw new NotFoundSignal();
  const pageProps = state.props;
  return AppShell ? h(AppShell, { Component: Page, pageProps, router }) : h(Page, pageProps);
}

const fontLinks = new Set();
function fontStyle(css) { const s = document.createElement('style'); s.dataset.unisonFont = ''; s.textContent = css; document.head.appendChild(s); }
let fontSeq = 0;
function fontResult(family, opts, fallback) {
  fontSeq += 1;
  const cls = '__font_' + fontSeq;
  const varCls = '__font_var_' + fontSeq;
  // next/font names a local metric fallback "<Family> Fallback" (backed by
  // Arial) ahead of any declared fallbacks; the same stack is kept here.
  const fallbackFace = family + ' Fallback';
  const declared = (opts && opts.fallback) || [];
  const stack = "'" + family + "', '" + fallbackFace + "'" + (declared.length ? ', ' + declared.join(', ') : '');
  fontStyle("@font-face{font-family:'" + fallbackFace + "';src:local(\"Arial\");}" + '.' + cls + '{font-family:' + stack + ';}' + (opts && opts.variable ? '.' + varCls + '{' + opts.variable + ':' + stack + ';}' : ''));
  return { className: cls, variable: varCls, style: { fontFamily: stack } };
}
export function loadGoogleFont(family, opts = {}) {
  const weights = opts.weight ? [].concat(opts.weight) : ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
  const styles = opts.style ? [].concat(opts.style) : ['normal'];
  const variants = [];
  for (const w of weights) for (const s of styles) variants.push(String(w) + (s === 'italic' ? 'italic' : ''));
  const url = 'https://fonts.googleapis.com/css?family=' + encodeURIComponent(family).replace(/%20/g, '+') + ':' + variants.join(',') + '&display=' + (opts.display || 'swap');
  if (!fontLinks.has(url)) {
    fontLinks.add(url);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
  }
  return fontResult(family, opts, opts.fallback || ['sans-serif']);
}
const join = (dir, rel) => { const out = []; for (const seg of (dir + '/' + rel).split('/')) { if (!seg || seg === '.') continue; if (seg === '..') out.pop(); else out.push(seg); } return '/' + out.join('/'); };
export function loadLocalFont(opts, dir, urls) {
  fontSeq += 1;
  const family = '__local_font_' + fontSeq;
  const sources = Array.isArray(opts.src) ? opts.src : [{ path: opts.src, weight: opts.weight, style: opts.style }];
  const faces = sources.map((s) => {
    const path = typeof s === 'string' ? s : s.path;
    const resolved = urls[join(dir, path)] || path;
    const format = /\.woff2$/.test(path) ? 'woff2' : /\.woff$/.test(path) ? 'woff' : /\.otf$/.test(path) ? 'opentype' : 'truetype';
    return '@font-face{font-family:\'' + family + '\';src:url("' + resolved + '") format("' + format + '");font-display:' + (opts.display || 'swap') + ';' + (s.weight || opts.weight ? 'font-weight:' + (s.weight || opts.weight) + ';' : '') + (s.style || opts.style ? 'font-style:' + (s.style || opts.style) + ';' : '') + '}';
  });
  fontStyle(faces.join(''));
  return fontResult(family, opts, opts.fallback);
}

export function Html({ children, ...attrs }) { useLayoutEffect(() => applyAttrs(document.documentElement, attrs)); return children ?? null; }
export function Body({ children, ...attrs }) { useLayoutEffect(() => applyAttrs(document.body, attrs)); return children ?? null; }
export function Head({ children }) { return createPortal(children, document.head); }
function applyAttrs(el, attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'suppressHydrationWarning' || v == null || typeof v === 'function') continue;
    if (k === 'className') el.className = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k === 'htmlFor' ? 'for' : k, String(v));
  }
}
export { lazy, Suspense, Fragment, h };
`;

const JSX_RUNTIME = String.raw`
import * as R from 'react/jsx-runtime';
import { Html, Body, Head } from 'unison:next-runtime';
const map = (t) => (t === 'html' ? Html : t === 'body' ? Body : t === 'head' ? Head : t);
export const Fragment = R.Fragment;
export const jsx = (t, p, k) => R.jsx(map(t), p, k);
export const jsxs = (t, p, k) => R.jsxs(map(t), p, k);
export const jsxDEV = (t, p, k) => R.jsx(map(t), p, k);
`;

const LINK = String.raw`
import { createElement as h, Children, cloneElement, forwardRef, isValidElement } from 'react';
import { hrefOf, navigate } from 'unison:next-runtime';
const Link = forwardRef(function Link({ href, as, replace, scroll, prefetch, shallow, locale, legacyBehavior, passHref, onClick, children, ...rest }, ref) {
  const target = hrefOf(as || href);
  const handle = (e) => {
    if (onClick) onClick(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (rest.target && rest.target !== '_self') return;
    if (/^(https?:)?\/\//.test(target) || /^(mailto|tel):/.test(target)) return;
    e.preventDefault();
    navigate(target, replace, scroll);
  };
  if (legacyBehavior && isValidElement(children)) return cloneElement(Children.only(children), { href: target, onClick: handle, ref });
  return h('a', { ...rest, ref, href: target, onClick: handle }, children);
});
export default Link;
`;

const IMAGE = String.raw`
import { createElement as h, forwardRef } from 'react';
const Image = forwardRef(function Image({ src, alt, width, height, fill, sizes, quality, priority, placeholder, blurDataURL, loader, unoptimized, overrideSrc, onLoadingComplete, layout, objectFit, objectPosition, style, ...rest }, ref) {
  const data = src && typeof src === 'object' ? (src.default || src) : null;
  let url = data ? data.src : src;
  const w = width ?? (data && data.width) ?? undefined;
  const hgt = height ?? (data && data.height) ?? undefined;
  if (loader && url && !unoptimized) url = loader({ src: url, width: Number(w) || 1080, quality: quality || 75 });
  const fillStyle = fill || layout === 'fill' ? { position: 'absolute', height: '100%', width: '100%', inset: 0, objectFit, objectPosition } : {};
  return h('img', {
    ...rest, ref, alt: alt ?? '', src: overrideSrc || url, sizes,
    width: fill ? undefined : (w || undefined), height: fill ? undefined : (hgt || undefined),
    loading: priority ? 'eager' : (rest.loading || 'lazy'), decoding: 'async',
    style: { color: 'transparent', ...fillStyle, ...style },
    onLoad: (e) => { rest.onLoad && rest.onLoad(e); onLoadingComplete && onLoadingComplete(e.currentTarget); },
  });
});
export const getImageProps = (props) => ({ props: { ...props, src: typeof props.src === 'object' ? props.src.src : props.src } });
export default Image;
`;

const NAVIGATION = String.raw`
import { useMemo } from 'react';
import { useLocationState, router, currentParams, RedirectSignal, NotFoundSignal } from 'unison:next-runtime';
export const useRouter = () => router;
export const usePathname = () => useLocationState().pathname;
export const useSearchParams = () => { const { search } = useLocationState(); return useMemo(() => new URLSearchParams(search), [search]); };
export const useParams = () => { useLocationState(); return currentParams; };
export const useSelectedLayoutSegment = () => { const p = useLocationState().pathname.split('/').filter(Boolean); return p[0] ?? null; };
export const useSelectedLayoutSegments = () => useLocationState().pathname.split('/').filter(Boolean);
export const redirect = (url, type) => { throw new RedirectSignal(url, type !== 'push'); };
export const permanentRedirect = (url) => { throw new RedirectSignal(url, true); };
export const notFound = () => { throw new NotFoundSignal(); };
export const forbidden = () => { throw new NotFoundSignal(); };
export const unauthorized = () => { throw new NotFoundSignal(); };
export const RedirectType = { push: 'push', replace: 'replace' };
export const ReadonlyURLSearchParams = URLSearchParams;
`;

const ROUTER = String.raw`
import { useLocationState, router, currentParams, currentRoute } from 'unison:next-runtime';
const build = (loc) => ({ ...router, pathname: currentRoute.replace(/:([^/]+)/g, '[$1]').replace(/\*([^/?]+)\??/g, '[...$1]'), route: currentRoute, asPath: loc.pathname + loc.search + loc.hash, query: { ...Object.fromEntries(new URLSearchParams(loc.search)), ...currentParams }, isReady: true, isFallback: false, isPreview: false, basePath: '', locale: undefined });
export const useRouter = () => build(useLocationState());
export const withRouter = (C) => (props) => { const r = useRouter(); return C({ ...props, router: r }); };
const Router = new Proxy({}, { get: (_, key) => build({ pathname: location.pathname, search: location.search, hash: location.hash })[key] });
export default Router;
`;

const HEAD = String.raw`
import { Head } from 'unison:next-runtime';
export default Head;
`;

const SCRIPT = String.raw`
import { useEffect } from 'react';
export default function Script({ src, id, strategy, onLoad, onReady, onError, children, dangerouslySetInnerHTML, ...rest }) {
  useEffect(() => {
    if (id && document.getElementById(id)) return undefined;
    const s = document.createElement('script');
    if (src) s.src = src;
    if (id) s.id = id;
    for (const [k, v] of Object.entries(rest)) if (typeof v === 'string' || typeof v === 'boolean') s.setAttribute(k, String(v));
    const code = (dangerouslySetInnerHTML && dangerouslySetInnerHTML.__html) || (typeof children === 'string' ? children : null);
    if (code) s.textContent = code;
    s.onload = (e) => { onLoad && onLoad(e); onReady && onReady(); };
    if (onError) s.onerror = onError;
    document.body.appendChild(s);
    if (!src && onReady) onReady();
    return () => { s.remove(); };
  }, [src, id]);
  return null;
}
`;

const DYNAMIC = String.raw`
import { createElement as h, lazy, Suspense } from 'react';
export default function dynamic(loader, options = {}) {
  const load = typeof loader === 'function' ? loader : options.loader;
  const Lazy = lazy(() => Promise.resolve(load()).then((m) => ({ default: (m && m.default) || m })));
  const Loading = options.loading;
  return function DynamicComponent(props) { return h(Suspense, { fallback: Loading ? h(Loading, { isLoading: true }) : null }, h(Lazy, props)); };
}
`;

const SERVER_STUBS: Record<string, string> = {
  'next/headers': `export const cookies = () => ({ get: () => undefined, getAll: () => [], has: () => false, set() {}, delete() {}, toString: () => '' });\nexport const headers = () => new Headers();\nexport const draftMode = () => ({ isEnabled: false, enable() {}, disable() {} });`,
  'next/cache': `export const revalidatePath = () => {};\nexport const revalidateTag = () => {};\nexport const unstable_cache = (fn) => fn;\nexport const unstable_noStore = () => {};\nexport const cache = (fn) => fn;`,
  'next/server': `export const NextResponse = { json: (b, i) => new Response(JSON.stringify(b), i), redirect: (u) => Response.redirect(u), next: () => new Response(null) };\nexport class NextRequest extends Request {}\nexport const after = () => {};`,
  'server-only': 'export {};',
  'client-only': 'export {};',
  'next/config': 'export default () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} });',
};

export const NEXT_RUNTIME_ID = 'unison:next-runtime';
export const NEXT_JSX_SOURCE = 'unison-next';

/** Virtual module source for a Next import, or null when there is no browser equivalent. */
export function nextShimSource(specifier: string): string | null {
  switch (specifier) {
    case NEXT_RUNTIME_ID: return RUNTIME;
    case `${NEXT_JSX_SOURCE}/jsx-runtime`:
    case `${NEXT_JSX_SOURCE}/jsx-dev-runtime`: return JSX_RUNTIME;
    case 'next/link': case 'next/link.js': return LINK;
    case 'next/image': case 'next/image.js': case 'next/legacy/image': return IMAGE;
    case 'next/navigation': case 'next/navigation.js': return NAVIGATION;
    case 'next/router': case 'next/router.js': return ROUTER;
    case 'next/head': case 'next/head.js': return HEAD;
    case 'next/script': case 'next/script.js': return SCRIPT;
    case 'next/dynamic': case 'next/dynamic.js': return DYNAMIC;
    default: return SERVER_STUBS[specifier] ?? null;
  }
}

/** next/font/google: one loader per font the project imports. */
export function nextGoogleFontSource(names: string[]): string {
  const lines = [`import { loadGoogleFont } from '${NEXT_RUNTIME_ID}';`];
  for (const name of [...new Set(names)].sort()) {
    lines.push(`export const ${name} = (o) => loadGoogleFont(${JSON.stringify(name.replace(/_/g, ' '))}, o);`);
  }
  lines.push('export default {};');
  return lines.join('\n');
}

/** next/font/local for one importing file: its `src` paths resolve from that file's folder. */
export function nextLocalFontSource(importerDir: string, fontUrls: Record<string, string>): string {
  return `import { loadLocalFont } from '${NEXT_RUNTIME_ID}';\nconst urls = ${JSON.stringify(fontUrls)};\nexport default (o) => loadLocalFont(o, ${JSON.stringify(importerDir)}, urls);`;
}

/** Entry module: imports every page, layout and template, then mounts the router. */
export function nextEntrySource(plan: SourceBuildPlan): string {
  const next = plan.next!;
  const ids = new Map<string, string>();
  const id = (path: string) => { if (!ids.has(path)) ids.set(path, `m${ids.size}`); return ids.get(path)!; };
  const routes = next.routes.map((r) => `{ path: ${JSON.stringify(r.path)}, page: ${id(r.page)}, layouts: [${r.layouts.map(id).join(', ')}], templates: [${r.templates.map(id).join(', ')}] }`);
  const notFound = next.notFound ? id(next.notFound) : 'null';
  const app = next.app ? id(next.app) : 'null';
  const imports = [...ids.entries()].map(([path, name]) => `import * as ${name} from ${JSON.stringify(path)};`);
  return [
    `import { mountNext } from '${NEXT_RUNTIME_ID}';`,
    ...imports,
    `mountNext({ router: ${JSON.stringify(next.router)}, routes: [${routes.join(', ')}], notFound: ${notFound}, app: ${app} });`,
  ].join('\n');
}
