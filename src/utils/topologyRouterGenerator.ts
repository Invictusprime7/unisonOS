/**
 * Topology Router Generator
 * 
 * Generates/patches a canonical App.tsx in VFS that includes a HashRouter
 * with routes for file-backed pages in the PageRegistry.
 * 
 * Called whenever:
 *   - AI Builder hydrates a missing page file
 *   - A page is added/removed via PageRouteBar or CreatorPlayground
 *   - The site topology is initialized from a GeneratedSitePlan
 */

import type { PageRegistry, BuilderPage } from '@/types/pageRegistry';
import type { GeneratedSitePlan } from '@/platform/core/siteTopologyPlanner';

// ============================================================================
// Types
// ============================================================================

interface RouteEntry {
  route: string;
  componentName: string;
  importPath: string;
  isHome: boolean;
}

// ============================================================================
// Core: Generate canonical App.tsx with HashRouter
// ============================================================================

/**
 * Generate a canonical App.tsx that routes all registered pages via HashRouter.
 * This replaces the VFS /src/App.tsx so the preview renders a real multi-page site.
 */
export function generateCanonicalRouter(
  registry: PageRegistry,
  businessName?: string,
): string {
  const pages = Object.values(registry.pages).sort((a, b) => a.navOrder - b.navOrder);
  if (pages.length === 0) return '';

  const routes = pagesToRoutes(pages);
  return buildRouterCode(routes, businessName);
}

/**
 * Generate a canonical App.tsx only for pages whose component files are present
 * in VFS. Missing pages are intentionally left out until the AI Builder writes
 * their route component.
 */
export function generateCanonicalRouterForFiles(
  registry: PageRegistry,
  existingFiles: Record<string, string>,
  businessName?: string,
): string {
  const ordered = Object.values(registry.pages).sort((a, b) => a.navOrder - b.navOrder);
  const hasBody = (page: BuilderPage) => {
    const filePath = page.filePath || derivePageFilePath(page);
    return Boolean(filePath && existingFiles[filePath]);
  };

  const pages = ordered.filter(hasBody);
  if (pages.length === 0) return '';

  // Registered pages whose body has not been authored yet still get a route,
  // rendering an explicit pending notice. Without it the catch-all silently
  // redirected every selected page back to home, which reads as a dead tab
  // in the Builder page router.
  const pendingRoutes = ordered
    .filter((page) => !hasBody(page) && !page.isHome)
    .map((page) => ({ route: page.path, title: page.title }));

  const routes = pagesToRoutes(pages);
  // Chrome authority lives in the page body: navigation and footer are
  // deterministic composition sections derived from the wizard selections.
  // The router therefore never renders its own navbar/footer, which is what
  // used to produce two competing navbars and two footers per page.
  return buildRouterCode(routes, businessName, pendingRoutes);
}

/**
 * Generate a canonical App.tsx from a GeneratedSitePlan (before registry is populated).
 */
export function generateCanonicalRouterFromPlan(plan: GeneratedSitePlan): string {
  const routes: RouteEntry[] = plan.pages.map(p => ({
    route: p.route,
    componentName: extractComponentName(p.filePath),
    importPath: vfsPathToImport(p.filePath),
    isHome: p.isHome,
  }));
  return buildRouterCode(routes, plan.businessName);
}

/**
 * Given existing VFS files and a registry, returns updated files map
 * with the canonical router patched into /src/App.tsx.
 */
export function patchVFSWithRouter(
  existingFiles: Record<string, string>,
  registry: PageRegistry,
  businessName?: string
): Record<string, string> {
  const routerCode = generateCanonicalRouterForFiles(registry, existingFiles, businessName);
  if (!routerCode) return existingFiles;
  return { ...existingFiles, '/src/App.tsx': routerCode };
}

// ============================================================================
// Helpers
// ============================================================================

function pagesToRoutes(pages: BuilderPage[]): RouteEntry[] {
  return pages.map(p => {
    // Prefer filePath from registry (set by topology planner)
    if (p.filePath) {
      const componentName = extractComponentName(p.filePath);
      return {
        route: p.path,
        componentName,
        importPath: vfsPathToImport(p.filePath),
        isHome: p.isHome,
      };
    }

    // Fallback: derive from route slug
    const slug = p.path.replace(/^\//, '') || 'Home';
    const componentName = slug
      .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
      .replace(/^(.)/, (_, c: string) => c.toUpperCase())
      .replace(/[^a-zA-Z0-9]/g, '') || 'Page';
    
    return {
      route: p.path,
      componentName,
      importPath: `./pages/${componentName}.tsx`,
      isHome: p.isHome,
    };
  });
}

function derivePageFilePath(page: BuilderPage): string {
  const slug = page.path.replace(/^\//, '') || 'Home';
  const componentName = slug
    .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (_, c: string) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '') || 'Page';
  return `/src/pages/${componentName}.tsx`;
}

function extractComponentName(filePath: string): string {
  const fileName = filePath.split('/').pop()?.replace(/\.(tsx|jsx|ts|js)$/, '') || 'Page';
  return fileName.charAt(0).toUpperCase() + fileName.slice(1);
}

function vfsPathToImport(filePath: string): string {
  // /src/pages/Contact.tsx → ./pages/Contact.tsx
  // Sandpack requires file extensions in import paths
  return filePath.replace(/^\/src\//, './');
}

function buildRouterCode(
  routes: RouteEntry[],
  businessName?: string,
  pendingRoutes: Array<{ route: string; title: string }> = [],
): string {
  if (routes.length === 0) return '';

  // File names and page IDs are not JavaScript identifiers (e.g. shop-products).
  // Alias by source path, retaining distinct routes even when basenames collide.
  const aliases = new Map<string, string>();
  const uniqueRoutes = routes.map(route => {
    if (!aliases.has(route.importPath)) aliases.set(route.importPath, `UnisonPage${aliases.size}`);
    return { ...route, componentName: aliases.get(route.importPath) ?? 'UnisonPage0' };
  });

  const homeRoute = uniqueRoutes.find(r => r.isHome) || uniqueRoutes[0];

  const imports = [...aliases].map(([path, alias]) =>
    `import ${alias} from ${JSON.stringify(path)};`
  ).join('\n');
  const routeElements: string[] = [];

  // Home route always gets "/"
  routeElements.push(`        <Route path="/" element={<${homeRoute.componentName} />} />`);

  // Non-home routes
  for (const r of uniqueRoutes) {
    if (r === homeRoute || r.isHome) continue;
    routeElements.push(`        <Route path="${r.route}" element={<${r.componentName} />} />`);
  }

  const knownRoutes = new Set(uniqueRoutes.map(r => r.route));
  const pending = pendingRoutes.filter(p => p.route && p.route !== '/' && !knownRoutes.has(p.route));
  for (const p of pending) {
    routeElements.push(`        <Route path="${p.route}" element={<UnisonPendingPage title=${JSON.stringify(p.title)} route=${JSON.stringify(p.route)} />} />`);
  }

  // Add catch-all
  routeElements.push(`        <Route path="*" element={<Navigate to="/" replace />} />`);

  const pendingComponent = pending.length
    ? `
function UnisonPendingPage({ title, route }) {
  return (
    <main data-ut-pending-route={route} style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '4rem 1.5rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{title}</h1>
      <p style={{ opacity: 0.7, maxWidth: '32rem' }}>This page is part of your site but its content has not been generated yet.</p>
    </main>
  );
}
`
    : '';

  return `// @unison-canonical-router
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
${imports}
${pendingComponent}
export default function App() {
  return (
    <HashRouter>
      <div className="unison-runtime-glass">
        <Routes>
${routeElements.join('\n')}
        </Routes>
      </div>
    </HashRouter>
  );
}
`;
}
