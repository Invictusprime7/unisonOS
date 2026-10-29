import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { findPageStructureIssues, pageStructureRequirement } from '@/services/app-builder/design/pageStructureGate';

const bareHome = `import React from 'react';
export default function Home() {
  return <main><section className="text-center"><h1>Eman Amanni: Crafting Exceptional Digital Experiences</h1><a href="#/contact">Start a Project</a></section></main>;
}`;

describe('page structure gate', () => {
  it('rejects a lone centered hero with no chrome or imagery', () => {
    const issues = findPageStructureIssues('/src/pages/Home.tsx', bareHome, { '/src/pages/Home.tsx': bareHome }, pageStructureRequirement('home', 3));
    expect(issues.join(' ')).toMatch(/no site navigation/);
    expect(issues.join(' ')).toMatch(/no site footer/);
    expect(issues.join(' ')).toMatch(/only 1 body section/);
    expect(issues.join(' ')).toMatch(/no photography/);
  });

  it('rejects page-local header and footer markup without canonical shared wrappers', () => {
    const source = `export default function Home(){return <><header><nav>Home</nav></header><main><section><img src="https://images.unsplash.com/photo-1" alt="" /></section><section/><section/></main><footer>Contact</footer></>}`;
    const issues = findPageStructureIssues('/src/pages/Home.tsx', source, { '/src/pages/Home.tsx': source }, pageStructureRequirement('home', 3));

    expect(issues.join(' ')).toMatch(/no site navigation from the canonical shared SiteNav/);
    expect(issues.join(' ')).toMatch(/no site footer from the canonical shared SiteFooter/);
  });

  it('requires each canonical wrapper exactly once outside the main content', () => {
    const page = `import { SiteNav } from "@/project-components/site/SiteNav";
import { SiteFooter } from "@/project-components/site/SiteFooter";
export default function Home(){return <><main><SiteNav/><section/><section/><SiteFooter/></main><SiteNav/></>}`;
    const files = {
      '/src/pages/Home.tsx': page,
      '/src/project-components/site/SiteNav.tsx': 'export function SiteNav(){return <header/>}',
      '/src/project-components/site/SiteFooter.tsx': 'export function SiteFooter(){return <footer/>}',
    };
    const issues = findPageStructureIssues('/src/pages/Home.tsx', page, files, pageStructureRequirement('contact', 2));

    expect(issues.join(' ')).toMatch(/SiteNav.*exactly once before <main>/);
    expect(issues.join(' ')).toMatch(/SiteFooter.*exactly once after <\/main>/);
  });

  it('accepts a composed page whose chrome, sections and imagery live in shared components', () => {
    const files = {
      '/src/pages/Home.tsx': `import { SiteNav } from '../project-components/site/SiteNav';
import { SiteFooter } from '../project-components/site/SiteFooter';
import { CinematicHero } from '../project-components/home/CinematicHero';
import { Services } from '../project-components/home/Services';
import { Button } from '@/components/ui/button';
export default function Home() { return <><SiteNav /><main><CinematicHero /><Services /><section><Button>Book</Button></section></main><SiteFooter /></>; }`,
      '/src/project-components/site/SiteNav.tsx': 'export const SiteNav = () => <nav />;',
      '/src/project-components/site/SiteFooter.tsx': 'export const SiteFooter = () => <footer />;',
      '/src/project-components/home/CinematicHero.tsx': 'export const CinematicHero = () => <img src="https://images.unsplash.com/photo-1" alt="" />;',
      '/src/project-components/home/Services.tsx': 'export const Services = () => <section />;',
    };
    expect(findPageStructureIssues('/src/pages/Home.tsx', files['/src/pages/Home.tsx'], files, pageStructureRequirement('home', 3))).toEqual([]);
  });

  it('accepts every page of a real previously generated site', () => {
    const dump = '/tmp/probe/draft.json';
    if (!existsSync(dump)) return;
    const files = JSON.parse(readFileSync(dump, 'utf8'))[0].vfs_files as Record<string, string>;
    const roles: Record<string, string> = { Home: 'home', Work: 'work', About: 'about', Services: 'services', Blog: 'blog', Contact: 'contact' };
    for (const [name, role] of Object.entries(roles)) {
      const path = `/src/pages/${name}.tsx`;
      const issues = findPageStructureIssues(path, files[path], files, pageStructureRequirement(role, 2));
      expect(issues, path).toEqual([]);
    }
  });
});
