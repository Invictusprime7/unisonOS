import { describe, expect, it } from 'vitest';
import {
  assertSiteShellClosure,
  buildSiteShellTopology,
  describeSiteShellNavigation,
} from '@/services/siteShellTopology';
import type { PageRegistry } from '@/types/pageRegistry';

function registry(): PageRegistry {
  const page = (
    pageId: string,
    title: string,
    path: string,
    filePath: string,
    navOrder: number,
    extra: Record<string, unknown> = {},
  ) => ({
    pageId,
    title,
    path,
    filePath,
    pageType: 'landing',
    navOrder,
    showInNav: true,
    isHome: false,
    source: { tsx: '' },
    output: {},
    ...extra,
  });

  return {
    pages: {
      home: page('home', 'Home', '/', '/src/pages/Home.tsx', 0, { isHome: true }),
      about: page('about', 'About', '/about', '/src/pages/About.tsx', 10),
      contact: page('contact', 'Contact', '/contact', '/src/pages/Contact.tsx', 20),
      checkout: page('checkout', 'Checkout', '/checkout', '/src/pages/Checkout.tsx', 30, {
        pageType: 'checkout',
        showInNav: false,
      }),
    },
  } as unknown as PageRegistry;
}

describe('site shell topology', () => {
  it('projects the registry into ordered route truth', () => {
    const topology = buildSiteShellTopology(registry());
    expect(topology.home?.pageId).toBe('home');
    expect(topology.routes.map((route) => route.path)).toEqual(['/', '/about', '/contact', '/checkout']);
    expect(topology.primaryNav.map((route) => route.href)).toEqual(['#/', '#/about', '#/contact']);
    expect(topology.footerNav.map((route) => route.label)).toEqual(['Home', 'About', 'Contact']);
  });

  it('accepts chrome that mirrors the projection', () => {
    const topology = buildSiteShellTopology(registry());
    const source = `
      <header><nav>
        <a href="#/">Home</a><a href="#/about">About</a><a href="#/contact">Contact</a>
      </nav></header>
      <footer><a href="#/about">About</a><a href="#/contact">Contact</a></footer>
    `;
    expect(
      assertSiteShellClosure(topology, {
        pageSources: { '/src/pages/Home.tsx': source },
        routerRoutes: ['/', '/about', '/contact', '/checkout'],
      }),
    ).toEqual([]);
  });

  it('validates canonical routes serialized in shared dispatcher props', () => {
    const topology = buildSiteShellTopology(registry());
    const page = `import { SiteNav } from "@/project-components/site/SiteNav";
import { SiteFooter } from "@/project-components/site/SiteFooter";
export default function Home(){return <><SiteNav/><main><section/></main><SiteFooter/></>}`;
    const sharedShell = `export function SiteNav(){return <header><Navbar props={{"links":[{"label":"About","href":"#/about"},{"label":"Contact","href":"#/contact"}]}} /></header>}
export function SiteFooter(){return <footer><Footer props={{"columns":[{"links":[{"label":"About","href":"#/about"},{"label":"Contact","href":"#/contact"}]}]}} /></footer>}`;

    expect(assertSiteShellClosure(topology, {
      pageSources: { '/src/pages/Home.tsx': `${page}\n${sharedShell}` },
      routerRoutes: ['/', '/about', '/contact', '/checkout'],
    })).toEqual([]);
  });

  it('flags stale links, missing nav routes and duplicated chrome', () => {
    const topology = buildSiteShellTopology(registry());
    const source = `
      <header><nav><a href="#/about">About</a><a href="#/team">Team</a></nav></header>
      <header><nav><a href="#/about">About</a></nav></header>
      <footer>a</footer><footer>b</footer>
    `;
    const codes = assertSiteShellClosure(topology, {
      pageSources: { '/src/pages/Home.tsx': source },
    }).map((violation) => violation.code);

    expect(codes).toContain('stale-chrome-link');
    expect(codes).toContain('missing-nav-link');
    expect(codes).toContain('duplicate-primary-navbar');
    expect(codes).toContain('duplicate-footer');
  });

  it('ignores section-level headers and footers nested in page content', () => {
    const topology = buildSiteShellTopology(registry());
    const source = `
      <header><nav><a href="#/about">About</a></nav></header>
      <main>
        <section><header><h2>Story</h2></header></section>
        <article><header>Card</header><footer>meta</footer></article>
        <section><header>Team</header></section>
      </main>
      <footer>site</footer>
    `;
    const codes = assertSiteShellClosure(topology, {
      pageSources: { '/src/pages/Home.tsx': source },
    }).map((violation) => violation.code);
    expect(codes).not.toContain('duplicate-primary-navbar');
    expect(codes).not.toContain('duplicate-footer');
  });

  it('flags router drift in both directions', () => {
    const topology = buildSiteShellTopology(registry());
    const violations = assertSiteShellClosure(topology, {
      routerRoutes: ['/', '/about', '/legacy'],
    });
    expect(violations.find((v) => v.code === 'router-route-missing')?.path).toBe('/contact');
    expect(violations.find((v) => v.code === 'router-route-unknown')?.path).toBe('/legacy');
  });

  it('describes the navigation contract for generation lanes', () => {
    const description = describeSiteShellNavigation(buildSiteShellTopology(registry()));
    expect(description).toContain('About → #/about');
    expect(description).toContain('Hidden from nav');
  });
});
