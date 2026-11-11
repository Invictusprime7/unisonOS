/**
 * Native Authorship guide §11 test matrix — offline evidence through the real
 * planner, brief and coverage code. Live generation needs a funded AI backend
 * and is recorded separately in docs/NATIVE_AUTHORSHIP_REPORT.md.
 */
import { describe, expect, it } from 'vitest';
import { buildPromptLaunchInput } from '@/services/launch/promptLaunchInput';
import { buildRequirementCoverage } from '@/services/app-builder/requirementCoverage';
import type { CreationRequirement } from '@/platform/core/universalCreation';
import { renderVerticalKnowledge } from '@/services/composition/verticals';

const ids = (requirements: readonly CreationRequirement[] | undefined) => (requirements ?? []).map((requirement) => requirement.id);

const WHISTLE_BLOWER = 'Create Whistle Blower: a bold, visually rich, multi-page live-sports blog with live scores, a match centre, fixtures and match reports, plus cinematic motion.';

const router = (pages: string[]) => `import Home from "./pages/Home";\n${pages.map((page) => `import ${page} from "./pages/${page}";`).join('\n')}`;
const nav = (routes: string[]) => `export default function SiteNav(){return <nav>${routes.map((route) => `<a href="${route}">x</a>`).join('')}</nav>}`;

describe('1 · Whistle Blower regression', () => {
  const { input } = buildPromptLaunchInput(WHISTLE_BLOWER);
  const creation = input.universalCreation!;

  it('reads bold, multi-page, sports interactions and motion from the prompt', () => {
    expect(input.theme.id).toBe('bold');
    expect(creation.designDirection).toMatchObject({ familyId: 'bold', origin: 'explicit' });
    expect(creation.multiPage).toBe(true);
    expect(ids(creation.requirements)).toEqual(expect.arrayContaining([
      'req:navigation:multi-page', 'req:interaction:live-scores', 'req:interaction:match-centre', 'req:interaction:fixtures', 'req:motion:cinematic', 'req:imagery:visually-rich',
    ]));
    expect(input.visionPrompt).toContain('[req:interaction:match-centre]');
  });

  it('knows the sports vertical and maps the owner-listed destinations onto its pages', () => {
    expect(creation.vertical).toMatchObject({ packId: 'sports', variantId: 'fan-media' });
    // "live scores, a match centre, fixtures and match reports" are destinations
    // the owner listed, so they are owner pages (P0 intent-to-implementation),
    // mapped through the sports page vocabulary — never replaced by inferred ones.
    const pageRequirements = (creation.requirements ?? []).filter((requirement) => requirement.kind === 'page');
    expect(pageRequirements.map((requirement) => requirement.pageRoute)).toEqual(expect.arrayContaining(['/live', '/match-centre', '/match-reports']));
    expect(pageRequirements.every((requirement) => requirement.origin !== 'inferred')).toBe(true);
    // "cinematic motion" is a treatment the creative brief owns, not a page.
    expect(pageRequirements.map((requirement) => requirement.pageRoute)).not.toContain('/cinematic-motion');
    expect(renderVerticalKnowledge(creation.vertical)).toContain('INDUSTRY KNOWLEDGE (Sports · Fan blog / sports media');
  });

  const pages = [
    { route: '/', filePath: '/src/pages/Home.tsx', title: 'Home', visibleInNav: true },
    { route: '/fixtures', filePath: '/src/pages/Fixtures.tsx', title: 'Fixtures', visibleInNav: true },
    { route: '/blog', filePath: '/src/pages/Blog.tsx', title: 'Blog', visibleInNav: true },
    { route: '/live', filePath: '/src/pages/Live.tsx', title: 'Live Scores', visibleInNav: true },
    { route: '/match-centre', filePath: '/src/pages/MatchCentrePage.tsx', title: 'Match Centre', visibleInNav: true },
    { route: '/match-reports', filePath: '/src/pages/MatchReports.tsx', title: 'Match Reports', visibleInNav: true },
  ];
  const requirements = [
    ...(creation.requirements ?? []),
    { id: 'req:page:fixtures', kind: 'page' as const, text: 'page /fixtures', origin: 'explicit' as const, pageRoute: '/fixtures' },
  ];

  it('does not count inferred suggestions as failed owner requests', () => {
    const report = buildRequirementCoverage({
      requirements: [{ id: 'req:interaction:recommended-map', kind: 'interaction', text: 'interactive venue map', origin: 'inferred' }],
      files: { '/src/pages/Home.tsx': 'export default function Home(){return <main>Welcome</main>}' },
      pages: [{ route: '/', filePath: '/src/pages/Home.tsx', title: 'Home' }],
    });

    expect(report.complete).toBe(true);
    expect(report.items[0]).toMatchObject({ origin: 'inferred', status: 'missing' });
    expect(report.summary).toContain('1 inferred suggestion');
  });

  it('uses only page-reachable certified design sources as request evidence', () => {
    const requirement: CreationRequirement = {
      id: 'req:interaction:class-schedule',
      kind: 'interaction',
      text: 'interactions: interactive class schedules',
      origin: 'explicit',
    };
    const pages = [{ route: '/', filePath: '/src/pages/Home.tsx', title: 'Home' }];
    const page = `import { ClassSchedule } from '@/unison/design-sources/Services';
export default function Home(){return <main><ClassSchedule variantId="services:schedule" /></main>}`;
    const files = {
      '/src/pages/Home.tsx': page,
      '/src/unison/design-sources/Services.tsx': 'export const ClassSchedule=()=> <section>Class schedule by weekday</section>;',
      '/src/unison/design-sources/unused/FacilityMap.tsx': 'export const FacilityMap=()=> <section>Interactive facility map</section>;',
    };

    const report = buildRequirementCoverage({ requirements: [requirement], files, pages });

    expect(report.items[0]).toMatchObject({ status: 'met', evidence: expect.arrayContaining([expect.stringContaining('/Services.tsx')]) });
    expect(report.items[0].evidence.join(' ')).not.toContain('FacilityMap');
    expect(report.promotionCandidates).toEqual([]);
  });

  it('does not require intentionally hidden requested routes in navigation', () => {
    const report = buildRequirementCoverage({
      requirements: [{ id: 'req:page:checkout', kind: 'page', text: 'page /checkout', origin: 'explicit', pageRoute: '/checkout' }],
      files: {
        '/src/App.tsx': 'const checkoutRoute = "/checkout";',
        '/src/pages/Checkout.tsx': 'export default function Checkout(){return <main>Checkout</main>}',
      },
      pages: [{ route: '/checkout', filePath: '/src/pages/Checkout.tsx', title: 'Checkout', visibleInNav: false }],
    });

    expect(report.items[0]).toMatchObject({ status: 'met', evidence: expect.arrayContaining(['intentionally hidden from navigation']) });
  });

  it('passes as complete only with original, labelled, routed and navigable source', () => {
    const files = {
      '/src/App.tsx': router(['Fixtures', 'Blog', 'Live', 'MatchCentrePage', 'MatchReports']),
      '/src/project-components/site/SiteNav.tsx': nav(['/', '/fixtures', '/blog', '/live', '/match-centre', '/match-reports']),
      '/src/pages/MatchReports.tsx': 'export default function MatchReports(){return <main>Match reports</main>}',
      '/src/pages/Blog.tsx': 'export default function Blog(){return <main>Match reports</main>}',
      '/src/pages/Live.tsx': 'export default function Live(){return <main>Live</main>}',
      '/src/pages/MatchCentrePage.tsx': 'export default function MatchCentrePage(){return <main>Match</main>}',
      '/src/pages/Home.tsx': 'import MatchCentre from "../project-components/sports/MatchCentre";\nimport LiveScores from "../project-components/sports/LiveScores";\nimport { motion } from "framer-motion";\nexport default function Home(){return <main><motion.div whileInView={{opacity:1}}><img src="a"/><img src="b"/><img src="c"/></motion.div><section data-ut-section-id="home:match-centre:0" data-ut-section-type="match-centre" data-ut-variant="custom:match-centre"><MatchCentre/></section><section data-ut-section-id="home:hero:0" data-ut-section-type="hero" data-ut-variant="hero:prisma-cinematic"></section><LiveScores/></main>}',
      '/src/pages/Fixtures.tsx': 'import FixtureList from "../project-components/sports/FixtureList";\nexport default function Fixtures(){return <main><FixtureList/></main>}',
      '/src/project-components/sports/MatchCentre.tsx': 'export default function MatchCentre(){return <article><span>Sample data</span>Match centre</article>}',
      '/src/project-components/sports/LiveScores.tsx': 'export default function LiveScores(){return <ol aria-label="Live scores"><li>Demo data</li></ol>}',
      '/src/project-components/sports/FixtureList.tsx': 'export default function FixtureList(){return <ul aria-label="Fixtures"><li>Sample fixtures</li></ul>}',
    };
    const report = buildRequirementCoverage({ requirements, files, pages });
    expect(report.items.filter((item) => item.status === 'missing' || item.status === 'partial')).toEqual([]);
    expect(report.complete).toBe(true);
    expect(report.provenance).toMatchObject({ certifiedSections: 1, customSections: 1 });
  });

  it('flags fabricated-looking live data and an unlinked page', () => {
    const files = {
      '/src/App.tsx': router(['Fixtures', 'Blog']),
      '/src/project-components/site/SiteNav.tsx': nav(['/', '/blog']),
      '/src/pages/Blog.tsx': 'export default function Blog(){return <main>Match reports</main>}',
      '/src/pages/Home.tsx': 'import MatchCentre from "../project-components/MatchCentre";\nexport default function Home(){return <main><MatchCentre/></main>}',
      '/src/pages/Fixtures.tsx': 'export default function Fixtures(){return <main>Fixtures</main>}',
      '/src/project-components/MatchCentre.tsx': 'export default function MatchCentre(){return <article>Match centre: Ghana 2–1 Senegal, live scores</article>}',
    };
    const report = buildRequirementCoverage({ requirements, files, pages });
    const byId = Object.fromEntries(report.items.map((item) => [item.id, item]));
    expect(byId['req:data:labelled-sample'].status).toBe('missing');
    expect(byId['req:page:fixtures'].status).toBe('partial');
    expect(byId['req:page:fixtures'].evidence).toContain('not linked from navigation');
    expect(byId['req:motion:cinematic'].status).toBe('missing');
    expect(report.complete).toBe(false);
  });
});

describe('2 · Cinematic music label', () => {
  it('keeps cinematic as an unmapped style with motion and showcase requirements', () => {
    const { input } = buildPromptLaunchInput('A cinematic music label site with an artist showcase, scroll reveals and full-bleed imagery.');
    expect(input.universalCreation?.designDirection).toMatchObject({ familyId: 'bold', origin: 'provisional' });
    expect(input.universalCreation?.designDirection?.unmappedStyles).toContain('cinematic');
    expect(ids(input.universalCreation?.requirements)).toEqual(expect.arrayContaining(['req:motion:cinematic', 'req:interaction:artist-showcase']));
  });
});

describe('3 · Salon booking', () => {
  it('requests booking only when asked, and never claims it built', () => {
    const asked = buildPromptLaunchInput('A calm botanical salon site where clients can book appointments online.').input.universalCreation!;
    const notAsked = buildPromptLaunchInput('A calm botanical salon portfolio of our hair colour work.').input.universalCreation!;
    expect(asked.designDirection?.familyId).toBe('organic');
    expect(asked.requestedCapabilities).toContain('booking');
    expect(notAsked.requestedCapabilities).not.toContain('booking');
    const report = buildRequirementCoverage({ requirements: asked.requirements ?? [], files: {}, pages: [] });
    expect(report.items.find((item) => item.id === 'req:capability:booking')?.status).toBe('unverified');
  });
});

describe('fitness interaction requests', () => {
  it('preserves multiword schedule and facility interactions as separate requirements', () => {
    const creation = buildPromptLaunchInput('Create a fitness website with interactive class schedules and an interactive facility map.').input.universalCreation!;
    const interactions = (creation.requirements ?? []).filter((requirement) => requirement.kind === 'interaction').map((requirement) => requirement.text.toLowerCase());

    expect(interactions).toEqual(expect.arrayContaining([
      expect.stringContaining('interactive class schedules'),
      expect.stringContaining('interactive facility map'),
    ]));
  });
});

describe('4 · Ecommerce', () => {
  it('records commerce as a capability that authorization, not the design, must satisfy', () => {
    const creation = buildPromptLaunchInput('A sleek online store for handmade ceramics with a cart and checkout.').input.universalCreation!;
    expect(creation.designDirection?.familyId).toBe('modern');
    expect(creation.requestedCapabilities).toEqual(expect.arrayContaining(['commerce']));
    expect(ids(creation.requirements).some((id) => id.startsWith('req:capability:commerce'))).toBe(true);
  });
});

describe('5 · SaaS', () => {
  it('turns an interactive dashboard into an original-experience requirement', () => {
    const creation = buildPromptLaunchInput('A futuristic SaaS landing site with an interactive analytics dashboard preview.').input.universalCreation!;
    expect(creation.designDirection?.familyId).toBe('futuristic');
    expect(ids(creation.requirements)).toEqual(expect.arrayContaining(['req:interaction:interactive-analytics', 'req:interaction:dashboard']));
    expect(creation.requestedCapabilities).not.toContain('auth');
  });
});

describe('6 · Creative edge case', () => {
  it('never collapses an unfamiliar aesthetic to Modern silently', () => {
    const { input } = buildPromptLaunchInput('A vaporwave zine for a record shop.');
    expect(input.universalCreation?.designDirection).toMatchObject({ familyId: 'futuristic', origin: 'provisional' });
    expect(input.visionPrompt).toContain('PROVISIONAL');
  });
});
