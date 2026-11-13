/**
 * Builder page tabs are a projection of the routes the Live Preview actually
 * renders: the `<Route path>` entries in the VFS `/src/App.tsx`. Registry
 * pages that the preview does not route are hidden, and every rendered route
 * gets a tab even if the registry lacks it, so the two can never disagree.
 */
export { resolveLocalImports, resolveRouteSourceFile } from '@/utils/routeSourceResolver';

export interface PageTab {
  path: string;
  label: string;
  isMain: boolean;
}

export interface RegistryPageLike {
  pageId: string;
  path: string;
  title?: string;
  isHome?: boolean;
  navOrder?: number;
}

export interface PageSourceTarget {
  pageId?: string;
  title: string;
  route: string;
  filePath: string;
  isHome?: boolean;
}

/** Prefix for tabs that map to a rendered route with no registry page. */
export const ROUTE_TAB_PREFIX = "route:";

export function routeFromPreviewTabPath(path: string): string | null {
  if (!path.startsWith(ROUTE_TAB_PREFIX)) return null;
  return normalizeRoute(path.slice(ROUTE_TAB_PREFIX.length));
}

const normalizeRoute = (route: string) => {
  const trimmed = route.trim().replace(/[?#].*$/, '');
  if (!trimmed || trimmed === '/') return '/';
  return ('/' + trimmed.replace(/^\/+/, '')).replace(/\/+$/, '').toLowerCase();
};

const normalizeWords = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Resolve an explicitly named page without mistaking section names for routes. */
export function resolveExplicitPageTarget(
  prompt: string,
  targets: PageSourceTarget[],
): PageSourceTarget | null {
  const normalizedPrompt = normalizeWords(prompt);
  const compactPrompt = normalizedPrompt.replace(/\s+/g, "");
  const matches = targets.flatMap((target) => {
    const aliases = [
      target.title,
      normalizeRoute(target.route).split("/").filter(Boolean).join(" "),
      target.filePath.split('/').pop()?.replace(/\.[^.]+$/, '').replace(/Page$/, '') ?? '',
    ].map(normalizeWords).filter(Boolean);
    let score = 0;
    for (const alias of new Set(aliases)) {
      if (normalizedPrompt.includes(`${alias} page`) || normalizedPrompt.includes(`page ${alias}`)) {
        score = Math.max(score, 3);
      }
      if (target.route !== '/' && prompt.toLowerCase().includes(target.route.toLowerCase())) {
        score = Math.max(score, 2);
      }
    }
    if (target.isHome || normalizeRoute(target.route) === '/') {
      if (/\b(homepage|home page|landing page|root page)\b/.test(normalizedPrompt)) score = Math.max(score, 4);
      if (compactPrompt.includes('homepage')) score = Math.max(score, 4);
    }
    return score > 0 ? [{ target, score }] : [];
  });
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.score - a.score);
  if (matches[1]?.score === matches[0].score) return null;
  return matches[0].target;
}

/** Ordered, de-duplicated route paths rendered by App.tsx (excludes `*`). */
export function extractRenderedRoutes(appSource: string | undefined): string[] {
  if (!appSource) return [];
  const routes: string[] = [];
  const re = /<Route\b[^>]*?\bpath=\{?\s*["'`]([^"'`]+)["'`]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(appSource))) {
    const raw = match[1];
    if (raw.includes('*') || raw.includes(':')) continue;
    const route = normalizeRoute(raw);
    if (!routes.includes(route)) routes.push(route);
  }
  return routes;
}

const labelFromRoute = (route: string) => {
  if (route === '/') return 'Home';
  const last = route.split('/').filter(Boolean).pop() ?? route;
  return last.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

export function buildPreviewRouteTabs(
  pages: RegistryPageLike[],
  appSource: string | undefined,
): PageTab[] {
  const byRoute = new Map<string, RegistryPageLike>();
  for (const page of pages) {
    const key = page.isHome ? "/" : normalizeRoute(page.path);
    if (!byRoute.has(key)) byRoute.set(key, page);
  }
  const rendered = extractRenderedRoutes(appSource);

  // No router yet (first paint before App.tsx exists): fall back to registry order.
  if (rendered.length === 0) {
    return pages
      .slice()
      .sort((a, b) => (a.isHome ? -1 : b.isHome ? 1 : (a.navOrder ?? 0) - (b.navOrder ?? 0)))
      .map((p) => ({ path: p.pageId, label: p.title || labelFromRoute(normalizeRoute(p.path)), isMain: !!p.isHome }));
  }

  return rendered.map((route) => {
    const page = byRoute.get(route);
    return page
      ? { path: page.pageId, label: page.title || labelFromRoute(route), isMain: route === '/' }
      : { path: `${ROUTE_TAB_PREFIX}${route}`, label: labelFromRoute(route), isMain: route === '/' };
  });
}
