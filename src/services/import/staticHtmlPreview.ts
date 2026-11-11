/**
 * UIMP-01 Phase D — source-compatible Preview adapter for plain HTML sites.
 *
 * A static site's own runtime is the browser, so the original HTML, CSS and
 * scripts run unchanged inside an isolated (opaque-origin) frame. The only
 * serve-time projection is reference resolution: a local `src`/`href`/`url()`
 * that names an imported file is replaced by that file's exact bytes (data
 * URL) or its stored asset link, because a sandboxed frame has no file
 * server. Every other byte of the document is emitted verbatim. Nothing here
 * is ever written back to the saved source.
 */
import { IMPORT_RECORD_ROOT } from './importedSourceRecords';

export const STATIC_HTML_PREVIEW_ADAPTER = 'static-html-sandbox';
export const IMPORT_NAV_MESSAGE = 'unison-import-nav';
/** Page check request/response (`-result`) between the builder and a static page frame. */
export const IMPORT_PROBE_MESSAGE = 'unison-import-probe';

export interface StaticHtmlPreviewDiagnostic {
  from: string;
  ref: string;
  reason: 'missing-file' | 'module-imports' | 'local-fetch' | 'base-element';
}

export interface StaticHtmlPreviewDocument {
  html: string;
  /** Out-of-band runtime overlays added to the served copy (never to source). */
  overlays: Array<'page-navigation-bridge'>;
  resolvedRefs: number;
  diagnostics: StaticHtmlPreviewDiagnostic[];
  /** Local pages this document links to (VFS paths). */
  pageLinks: string[];
}

const EXTERNAL_REF = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?|\$\{|\{\{)/i;
const HTML_PAGE = /\.html?$/i;

const MIME: Record<string, string> = {
  css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', html: 'text/html', htm: 'text/html',
  svg: 'image/svg+xml', txt: 'text/plain', xml: 'application/xml', webmanifest: 'application/manifest+json', map: 'application/json',
};

function mimeOf(path: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase() ?? '';
  return MIME[ext] ?? 'text/plain';
}

function utf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i <= 0 ? '/' : path.slice(0, i + 1);
}

/** Resolves a reference relative to the file that contains it; null for external refs. */
export function resolveLocalRef(ref: string, fromPath: string): string | null {
  const raw = ref.trim().replace(/&amp;/g, '&');
  if (!raw || EXTERNAL_REF.test(raw)) return null;
  const clean = raw.split(/[?#]/)[0];
  if (!clean) return null;
  let decoded = clean;
  try { decoded = decodeURIComponent(clean); } catch { /* keep raw */ }
  const joined = decoded.startsWith('/') ? decoded : `${dirOf(fromPath)}${decoded}`;
  const out: string[] = [];
  for (const part of joined.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return `/${out.join('/')}`;
}

/** HTML pages of an imported static site, index first. */
export function listStaticHtmlPages(files: Record<string, string>): string[] {
  return Object.keys(files)
    .filter((p) => HTML_PAGE.test(p) && !p.startsWith(`${IMPORT_RECORD_ROOT}/`) && !p.includes('/node_modules/'))
    .sort((a, b) => {
      const rank = (p: string) => (p === '/index.html' || p === '/index.htm' ? 0 : /\/index\.html?$/i.test(p) ? 1 : 2);
      return rank(a) - rank(b) || a.split('/').length - b.split('/').length || a.localeCompare(b);
    });
}

interface Ctx {
  files: Record<string, string>;
  assetUrls: Record<string, string>;
  diagnostics: StaticHtmlPreviewDiagnostic[];
  resolved: number;
}

function lookupPage(files: Record<string, string>, path: string): string | null {
  if (HTML_PAGE.test(path) && typeof files[path] === 'string') return path;
  for (const candidate of [`${path.replace(/\/$/, '')}/index.html`, `${path}.html`]) {
    if (typeof files[candidate] === 'string') return candidate;
  }
  return null;
}

/** Exact bytes of a local file as a URL a sandboxed frame can load, or null. */
function urlFor(ctx: Ctx, path: string, from: string, ref: string, seen: Set<string>): string | null {
  if (ctx.assetUrls[path]) { ctx.resolved++; return ctx.assetUrls[path]; }
  const text = ctx.files[path];
  if (typeof text !== 'string') {
    ctx.diagnostics.push({ from, ref, reason: 'missing-file' });
    return null;
  }
  ctx.resolved++;
  const body = /\.css$/i.test(path) && !seen.has(path) ? rewriteCss(ctx, text, path, new Set([...seen, path])) : text;
  return `data:${mimeOf(path)};charset=utf-8;base64,${utf8Base64(body)}`;
}

function rewriteCss(ctx: Ctx, css: string, cssPath: string, seen: Set<string>): string {
  const replaceRef = (ref: string) => {
    const path = resolveLocalRef(ref, cssPath);
    return path ? urlFor(ctx, path, cssPath, ref, seen) : null;
  };
  return css
    .replace(/url\(\s*(["']?)([^"')]*)\1\s*\)/gi, (match, quote: string, ref: string) => {
      const next = replaceRef(ref);
      return next ? `url(${quote}${next}${quote})` : match;
    })
    .replace(/@import\s+(["'])([^"']+)\1/gi, (match, quote: string, ref: string) => {
      const next = replaceRef(ref);
      return next ? `@import ${quote}${next}${quote}` : match;
    });
}

const ATTR = /(\s)([a-zA-Z_:][-a-zA-Z0-9_:.]*)(\s*=\s*)("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

function rewriteTag(ctx: Ctx, tag: string, docPath: string, pages: Map<string, string>): string {
  const name = /^<\s*([a-zA-Z][\w:-]*)/.exec(tag)?.[1]?.toLowerCase() ?? '';
  const rel = /\srel\s*=\s*["']?([^"'>]*)/i.exec(tag)?.[1]?.toLowerCase() ?? '';
  if (name === 'base' && /\shref\s*=/i.test(tag)) ctx.diagnostics.push({ from: docPath, ref: '<base href>', reason: 'base-element' });
  return tag.replace(ATTR, (match, ws: string, attr: string, eq: string, _q: string, dq?: string, sq?: string, bare?: string) => {
    const key = attr.toLowerCase();
    const value = dq ?? sq ?? bare ?? '';
    const quote = dq !== undefined ? '"' : sq !== undefined ? "'" : '';
    const emit = (next: string) => `${ws}${attr}${eq}${quote}${next}${quote}`;
    if (key === 'style') {
      const next = rewriteCss(ctx, value, docPath, new Set());
      return next === value ? match : emit(next);
    }
    if (key === 'srcset' || key === 'imagesrcset') {
      const next = value.replace(/(^|,)(\s*)([^\s,]+)/g, (m, sep: string, sp: string, ref: string) => {
        const path = resolveLocalRef(ref, docPath);
        const url = path ? urlFor(ctx, path, docPath, ref, new Set()) : null;
        return url ? `${sep}${sp}${url}` : m;
      });
      return next === value ? match : emit(next);
    }
    const isRef = key === 'src' || key === 'poster' || (key === 'data' && name === 'object')
      || (key === 'href' && name !== 'a' && name !== 'area' && name !== 'base' && (name !== 'link' || !/\b(canonical|alternate|next|prev)\b/.test(rel)))
      || (key === 'xlink:href');
    if (key === 'href' && (name === 'a' || name === 'area')) {
      const path = resolveLocalRef(value, docPath);
      const page = path ? lookupPage(ctx.files, path) : null;
      if (page) pages.set(value, page);
      return match;
    }
    if (!isRef) return match;
    const path = resolveLocalRef(value, docPath);
    if (!path) return match;
    const url = urlFor(ctx, path, docPath, value, new Set());
    return url ? emit(url) : match;
  });
}

function scanScript(ctx: Ctx, code: string, from: string, isModule: boolean) {
  if (isModule && /(?:^|[;\s])(?:import\s[^'"]*?from\s*|import\s*\(\s*|import\s+)["'](\.{1,2}\/|\/)[^"']+["']/m.test(code)) {
    ctx.diagnostics.push({ from, ref: 'relative module imports', reason: 'module-imports' });
  }
  for (const m of code.matchAll(/fetch\(\s*["'`]((?:\.{0,2}\/)?[\w./-]+\.(?:json|html|txt|csv|xml))["'`]/g)) {
    ctx.diagnostics.push({ from, ref: m[1], reason: 'local-fetch' });
  }
}

function navigationBridge(pages: Map<string, string>): string {
  const map: Record<string, { path: string; hash: string }> = {};
  for (const [href, path] of pages) map[href] = { path, hash: href.includes('#') ? href.slice(href.indexOf('#')) : '' };
  const json = JSON.stringify(map).replace(/</g, '\\u003c');
  return `<script data-unison-import-overlay="navigation">(function(){var P=${json};document.addEventListener('click',function(e){if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;var a=e.target&&e.target.closest?e.target.closest('a[href],area[href]'):null;if(!a)return;var t=a.getAttribute('target');if(t&&t!=='_self')return;var d=P[a.getAttribute('href')];if(!d)return;e.preventDefault();parent.postMessage({type:'${IMPORT_NAV_MESSAGE}',path:d.path,hash:d.hash},'*');});var E=[];addEventListener('error',function(e){if(E.length<50)E.push(String(e.message||(e.target&&(e.target.src||e.target.href)?'Failed to load '+(e.target.src||e.target.href):'error')).slice(0,500));},true);addEventListener('message',function(e){if(e.source!==parent||!e.data||e.data.type!=='${IMPORT_PROBE_MESSAGE}')return;var b=document.body;parent.postMessage({type:'${IMPORT_PROBE_MESSAGE}-result',requestId:e.data.requestId,textLength:b?b.innerText.trim().length:0,elementCount:b?b.getElementsByTagName('*').length:0,imagesBroken:Array.prototype.slice.call(document.images).filter(function(i){return i.complete&&i.naturalWidth===0&&i.currentSrc;}).map(function(i){return i.currentSrc;}).slice(0,20),errors:E.slice()},'*');});})();</script>`;
}

/**
 * Builds the served copy of one HTML page. Bytes outside resolved reference
 * values are identical to the source; raw-text bodies (`<script>`, inline
 * `<style>` outside `url()`, comments) are never reparsed or reformatted.
 */
export function buildStaticHtmlPreviewDocument(input: {
  files: Record<string, string>;
  entryPath: string;
  assetUrls?: Record<string, string>;
}): StaticHtmlPreviewDocument {
  const source = input.files[input.entryPath];
  if (typeof source !== 'string') throw new Error(`No imported page at ${input.entryPath}`);
  const ctx: Ctx = { files: input.files, assetUrls: input.assetUrls ?? {}, diagnostics: [], resolved: 0 };
  const pages = new Map<string, string>();
  const out: string[] = [];
  const token = /<!--[\s\S]*?-->|<(script|style|textarea|title)\b[^>]*>[\s\S]*?<\/\1\s*>|<[a-zA-Z][^<>]*>/gi;
  let last = 0;
  for (const m of source.matchAll(token)) {
    const start = m.index ?? 0;
    out.push(source.slice(last, start));
    const chunk = m[0];
    const raw = m[1]?.toLowerCase();
    if (chunk.startsWith('<!--')) out.push(chunk);
    else if (raw === 'script' || raw === 'style') {
      const openEnd = chunk.indexOf('>') + 1;
      const closeStart = chunk.toLowerCase().lastIndexOf('</');
      const open = chunk.slice(0, openEnd);
      const body = chunk.slice(openEnd, closeStart);
      const close = chunk.slice(closeStart);
      if (raw === 'style') out.push(rewriteTag(ctx, open, input.entryPath, pages), rewriteCss(ctx, body, input.entryPath, new Set()), close);
      else {
        const isModule = /\stype\s*=\s*["']?module/i.test(open);
        const srcRef = /\ssrc\s*=\s*["']?([^"'\s>]+)/i.exec(open)?.[1];
        const srcPath = srcRef ? resolveLocalRef(srcRef, input.entryPath) : null;
        if (srcPath && typeof input.files[srcPath] === 'string') scanScript(ctx, input.files[srcPath], srcPath, isModule);
        else if (!srcRef) scanScript(ctx, body, input.entryPath, isModule);
        out.push(rewriteTag(ctx, open, input.entryPath, pages), body, close);
      }
    } else if (raw) out.push(chunk);
    else out.push(rewriteTag(ctx, chunk, input.entryPath, pages));
    last = start + chunk.length;
  }
  out.push(source.slice(last));
  let html = out.join('');
  const overlays: StaticHtmlPreviewDocument['overlays'] = [];
  if (pages.size > 0) {
    overlays.push('page-navigation-bridge');
    const bridge = navigationBridge(pages);
    const body = /<\/body\s*>/i.exec(html);
    html = body ? `${html.slice(0, body.index)}${bridge}${html.slice(body.index)}` : `${html}${bridge}`;
  }
  return { html, overlays, resolvedRefs: ctx.resolved, diagnostics: ctx.diagnostics, pageLinks: [...new Set(pages.values())].sort() };
}
