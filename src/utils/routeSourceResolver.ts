const joinPath = (fromFile: string, specifier: string): string => {
  const parts = fromFile.split('/').slice(0, -1);
  for (const segment of specifier.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }
  return parts.join('/') || '/';
};

const resolveSpecifier = (fromFile: string, specifier: string, files: Record<string, unknown>): string | null => {
  const base = specifier.startsWith('@/') ? `/src/${specifier.slice(2)}` : specifier.startsWith('.') ? joinPath(fromFile, specifier) : null;
  if (!base) return null;
  const candidates = [base, `${base}.tsx`, `${base}.jsx`, `${base}.ts`, `${base}.js`, `${base}/index.tsx`];
  return candidates.find((candidate) => candidate in files) ?? null;
};

/** Resolve the imported source module rendered for a route in the canonical router. */
export function resolveRouteSourceFile(
  files: Record<string, string>,
  route: string | null | undefined,
  appPath = '/src/App.tsx',
): string | null {
  const appSource = files[appPath];
  if (!appSource || route == null) return null;
  const wanted = normalizeRoute(route);
  const routePattern = /<Route\b[^>]*?\bpath=\{?\s*["'`]([^"'`]+)["'`][^>]*?\belement=\{\s*<\s*([A-Z][\w]*)/g;
  let match: RegExpExecArray | null;
  let component: string | null = null;
  while ((match = routePattern.exec(appSource))) {
    if (normalizeRoute(match[1]) === wanted) {
      component = match[2];
      break;
    }
  }
  if (!component) return null;
  const importPattern = new RegExp(`import\\s+(?:${component}\\b[^'"]*|\\{[^}]*\\b${component}\\b[^}]*\\})\\s+from\\s+['"]([^'"]+)['"]`);
  const specifier = appSource.match(importPattern)?.[1];
  return specifier ? resolveSpecifier(appPath, specifier, files) : null;
}

/** Local files a page imports directly. */
export function resolveLocalImports(files: Record<string, string>, fromFile: string): string[] {
  const source = files[fromFile];
  if (!source) return [];
  const out: string[] = [];
  const importPattern = /import\s+[^'"]*?from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(source))) {
    const resolved = resolveSpecifier(fromFile, match[1], files);
    if (resolved && !out.includes(resolved) && !resolved.startsWith('/src/unison/')) out.push(resolved);
  }
  return out;
}

function normalizeRoute(route: string): string {
  const trimmed = route.trim().replace(/[?#].*$/, '');
  if (!trimmed || trimmed === '/') return '/';
  return (`/${trimmed.replace(/^\/+/, '')}`).replace(/\/+$/, '').toLowerCase();
}