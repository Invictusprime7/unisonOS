import { describe, expect, it } from 'vitest';
import { analyzeReactSite, resolveEditTarget, resolveEditSourceTargets, type ComponentInfo } from '@/utils/reactSiteAnalysis';

const component = (name: string, file: string, sectionLabel: string | null): ComponentInfo => ({
  name,
  file,
  isDefault: true,
  sectionLabel,
  headings: [],
  hasForm: false,
  hasButtons: false,
  hasImages: false,
  hasLinks: false,
  childComponents: [],
  intentWiring: [],
  lineCount: 10,
});

describe('resolveEditTarget', () => {
  const sharedFiles = {
    '/src/pages/Home.tsx': "import SiteNav from '../components/SiteNav'; export default function Home(){return <><SiteNav/><main>Home</main></>}",
    '/src/pages/Pricing.tsx': "import SiteNav from '../components/SiteNav'; export default function Pricing(){return <><SiteNav/><main>Pricing</main></>}",
    '/src/components/SiteNav.tsx': 'export default function SiteNav(){return <nav><a href="/">Home</a></nav>}',
  };
  it('targets the actual shared navbar rather than the default Pricing page', () => {
    expect(resolveEditSourceTargets('Turn navbar into a floating nav', analyzeReactSite(sharedFiles), {
      files: sharedFiles, preferredFile: '/src/pages/Pricing.tsx', pageFiles: ['/src/pages/Home.tsx', '/src/pages/Pricing.tsx'], siteScope: false,
    })).toEqual(['/src/components/SiteNav.tsx']);
  });
  it('deduplicates a shared owner across all pages without adding unrelated page writes', () => {
    expect(resolveEditSourceTargets('Turn navbar into a floating nav across all pages', analyzeReactSite(sharedFiles), {
      files: sharedFiles, preferredFile: '/src/pages/Pricing.tsx', pageFiles: ['/src/pages/Home.tsx', '/src/pages/Pricing.tsx'], siteScope: true,
    })).toEqual(['/src/components/SiteNav.tsx']);
  });
  it('includes each inline navbar owner for site-wide navigation edits', () => {
    const files = { '/src/pages/Home.tsx': 'export default function Home(){return <nav/>}', '/src/pages/Pricing.tsx': 'export default function Pricing(){return <nav/>}' };
    expect(resolveEditSourceTargets('Change navbar across all pages', analyzeReactSite(files), {
      files, preferredFile: '/src/pages/Pricing.tsx', pageFiles: Object.keys(files), siteScope: true,
    })).toEqual(Object.keys(files));
  });
  it('never expands a pinned selection to other owners', () => {
    expect(resolveEditSourceTargets('Change navbar across all pages', analyzeReactSite(sharedFiles), {
      files: sharedFiles, preferredFile: '/src/pages/Pricing.tsx', pageFiles: Object.keys(sharedFiles), siteScope: true, pinnedFile: '/src/pages/Pricing.tsx',
    })).toEqual(['/src/pages/Pricing.tsx']);
  });
  it('prefers the active page reachable component over a stale duplicate', () => {
    const analysis = {
      components: [
        component('Hero', '/src/components/Hero.tsx', 'Hero'),
        component('CinematicHero', '/src/project-components/home/CinematicHero.tsx', 'Hero'),
      ],
      entryFile: '/src/pages/Home.tsx',
      sectionMap: '',
    };
    const files = {
      '/src/pages/Home.tsx': "import CinematicHero from '../project-components/home/CinematicHero'; export default function Home(){return <CinematicHero/>}",
      '/src/project-components/home/CinematicHero.tsx': 'export default function CinematicHero(){return <section/>}',
      '/src/components/Hero.tsx': 'export default function Hero(){return <section/>}',
    };

    expect(resolveEditTarget('Change only the Home page hero eyebrow text.', analysis, {
      preferredFile: '/src/pages/Home.tsx',
      files,
    })).toMatchObject({
      file: '/src/project-components/home/CinematicHero.tsx',
      component: 'CinematicHero',
      section: 'Hero',
    });
  });

  it('resolves navbar wording to the rendered navigation component', () => {
    const analysis = {
      components: [
        component('App', '/src/main.tsx', null),
        { ...component('SiteNav', '/src/project-components/site/SiteNav.tsx', 'Navigation'), hasLinks: true },
      ],
      entryFile: '/src/main.tsx',
      sectionMap: '',
    };
    const files = {
      '/src/main.tsx': "import SiteNav from './project-components/site/SiteNav'; export default function App(){return <SiteNav/>}",
      '/src/project-components/site/SiteNav.tsx': 'export default function SiteNav(){return <nav><a href="/">Home</a></nav>}',
    };

    expect(resolveEditTarget('Change the navbar to a floating horizontal cascade.', analysis, {
      preferredFile: '/src/main.tsx',
      files,
    })).toMatchObject({
      file: '/src/project-components/site/SiteNav.tsx',
      component: 'SiteNav',
      section: 'Navigation',
      confidence: 'high',
    });
  });

  it('does not fall back to a matching component on a different explicitly unrequested page', () => {
    const analysis = {
      components: [
        component('Home', '/src/pages/Home.tsx', null),
        component('ContactHero', '/src/pages/Contact.tsx', 'Hero'),
      ],
      entryFile: '/src/App.tsx',
      sectionMap: '',
    };
    const files = {
      '/src/pages/Home.tsx': 'export default function Home(){return <main/>}',
      '/src/pages/Contact.tsx': 'export default function ContactHero(){return <section/>}',
    };

    expect(resolveEditTarget('Change the hero on the Home page.', analysis, {
      preferredFile: '/src/pages/Home.tsx',
      files,
      restrictToPreferredFile: true,
    })).toMatchObject({ file: '/src/pages/Home.tsx', component: 'Home' });
  });
});
