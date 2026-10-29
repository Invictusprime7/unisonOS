import { buildSiteShellTopology } from '@/services/siteShellTopology';
import type { PageRegistry } from '@/types/pageRegistry';
import type { DesignSourceBundle } from './DesignSourceBundle';
import type { DesignSourceMaterialization } from './designSourceMaterializer';

const SITE_NAV_PATH = '/src/project-components/site/SiteNav.tsx';
const SITE_FOOTER_PATH = '/src/project-components/site/SiteFooter.tsx';

function sharedImplementation(
  sectionType: 'navbar' | 'footer',
  anchorPageIds: readonly string[],
  bundle: DesignSourceBundle,
  materialization: DesignSourceMaterialization,
): { id: string; modulePath: string } | undefined {
  const manifest = materialization.manifest.implementations;
  for (const pageId of anchorPageIds) {
    for (const id of bundle.eligibleByPage[pageId] ?? []) {
      const implementation = manifest[id];
      if (implementation?.sectionType !== sectionType) continue;
      if (!materialization.files[implementation.modulePath]) continue;
      return { id, modulePath: implementation.modulePath };
    }
  }
  return undefined;
}

function toImportPath(modulePath: string): string {
  return modulePath.replace(/^\/src\//, '@/').replace(/\.(?:tsx?|jsx?)$/i, '');
}

/** Compile one stable shared shell from canonical routes and common eligible variants. */
export function materializeAppBuilderSiteShell(input: {
  registry: PageRegistry;
  businessName: string;
  bundle: DesignSourceBundle;
  materialization: DesignSourceMaterialization;
}): Record<string, string> {
  const topology = buildSiteShellTopology(input.registry);
  const anchorPageIds = [...new Set([
    topology.home?.pageId,
    ...topology.primaryNav.map((route) => route.pageId),
    ...topology.routes.map((route) => route.pageId),
  ].filter((pageId): pageId is string => Boolean(pageId)))];
  const navbar = sharedImplementation('navbar', anchorPageIds, input.bundle, input.materialization);
  const footer = sharedImplementation('footer', anchorPageIds, input.bundle, input.materialization);
  if (!navbar || !footer) return {};

  const brand = input.businessName.trim() || 'Business';
  const navigationLinks = topology.primaryNav.map(({ label, href }) => ({ label, href, intent: 'nav.goto' }));
  const footerLinks = topology.footerNav.map(({ label, href }) => ({ label, href }));
  const navbarImport = toImportPath(navbar.modulePath);
  const footerImport = toImportPath(footer.modulePath);
  const navSource = `import Navbar from ${JSON.stringify(navbarImport)};\n\nexport function SiteNav() {\n  return <header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant=${JSON.stringify(navbar.id)}>\n    <Navbar sectionId="site:navbar" variantId=${JSON.stringify(navbar.id)} props={${JSON.stringify({ brand, links: navigationLinks })}} />\n  </header>;\n}\n`;
  const footerSource = `import Footer from ${JSON.stringify(footerImport)};\n\nexport function SiteFooter() {\n  return <footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant=${JSON.stringify(footer.id)}>\n    <Footer sectionId="site:footer" variantId=${JSON.stringify(footer.id)} props={${JSON.stringify({
      brand,
      columns: [{ title: 'Explore', links: footerLinks }],
      socials: [],
    })}} />\n  </footer>;\n}\n`;
  return { [SITE_NAV_PATH]: navSource, [SITE_FOOTER_PATH]: footerSource };
}
