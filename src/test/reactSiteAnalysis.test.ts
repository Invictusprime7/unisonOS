import { describe, expect, it } from 'vitest';
import { resolveEditTarget, type ComponentInfo } from '@/utils/reactSiteAnalysis';

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
