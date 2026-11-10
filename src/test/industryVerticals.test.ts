import { describe, expect, it } from 'vitest';
import {
  VERTICAL_PACKS,
  compositionIndustryFor,
  inferVerticalPages,
  renderVerticalKnowledge,
  resolveIndustryVertical,
  verticalInteractionRequirements,
} from '@/services/composition/verticals';
import { hasDedicatedCompositionProfiles, resolveComposition, resolvePageCompositionProfile } from '@/services/composition/industryCompositionRegistry';
import { pageArchetypeIssues } from '@/sections/pageArchetypeContract';
import { deriveChatLaunchPlan } from '@/services/launch/chatLaunchPlan';
import { buildRequirementCoverage } from '@/services/app-builder/requirementCoverage';

const SECTION_TYPES = new Set(['hero', 'services', 'features', 'pricing', 'testimonials', 'team', 'gallery', 'faq', 'cta', 'contact', 'stats', 'about', 'logo-cloud', 'blog-preview', 'before-after']);
const ROLES = new Set(['home', 'services', 'gallery', 'about', 'booking', 'contact', 'pricing', 'shop', 'blog', 'faq', 'custom']);

describe('industry vertical detection', () => {
  it.each([
    ['Create Whistle Blower: a bold multi-page live-sports blog with live scores and a match centre.', 'sports', 'fan-media'],
    ['A football club website for Accra Lions FC with fixtures and the squad.', 'sports', 'club'],
    ['A private jet charter company in Accra that lists empty legs.', 'travel', 'charter'],
    ['An airline site where people search flights and check flight status.', 'travel', 'airline'],
    ['Website for a music festival with the lineup, tickets and a site map.', 'events', 'festival'],
    ['A fintech conference with an agenda and speakers.', 'events', 'conference'],
    ['Portfolio site for a rapper with tour dates and a music player.', 'music', 'artist'],
    ['Our wedding website: RSVP, a countdown and our story. We are getting married in May!', 'weddings', 'couple-site'],
    ['A wedding planner for destination weddings in Zanzibar.', 'weddings', 'planner'],
    ['A boutique yoga studio with a class timetable.', 'fitness', 'boutique-studio'],
    ['An eco lodge in the Volta region with rooms and a virtual tour.', 'hospitality', 'resort-lodge'],
    ['A documentary film production company with a showreel.', 'photography', 'film-production'],
  ])('%s → %s/%s', (prompt, packId, variantId) => {
    const vertical = resolveIndustryVertical(prompt);
    expect(vertical?.packId).toBe(packId);
    expect(vertical?.variantId).toBe(variantId);
  });

  it('reads a wedding photographer as photography blended with weddings', () => {
    const vertical = resolveIndustryVertical('Site for a wedding photographer in Kumasi.');
    expect(vertical).toMatchObject({ packId: 'photography', variantId: 'wedding-portrait', blendPackId: 'weddings' });
  });

  it('ignores negated trades and unrelated businesses', () => {
    expect(resolveIndustryVertical('A strength gym, no weddings or festivals.')).toMatchObject({ packId: 'fitness', blendPackId: null });
    expect(resolveIndustryVertical('A used truck dealership in Tamale.')).toBeNull();
  });
});

describe('vertical pack integrity', () => {
  it.each(VERTICAL_PACKS.map((pack) => [pack.id, pack] as const))('%s is complete and self-consistent', (_id, pack) => {
    const interactionIds = pack.interactions.map((interaction) => interaction.id);
    expect(new Set(interactionIds).size).toBe(interactionIds.length);
    expect(pack.variants.length).toBeGreaterThanOrEqual(3);
    expect(pack.interactions.length).toBeGreaterThanOrEqual(5);
    expect(pack.contentObjects.length).toBeGreaterThanOrEqual(4);
    expect(pack.honesty.length).toBeGreaterThan(0);
    for (const interaction of pack.interactions) {
      expect(interaction.keywords.length).toBeGreaterThan(0);
      expect(interaction.originalComponent).toMatch(/^[A-Z][A-Za-z]+$/);
      for (const family of interaction.certifiedFamilies) expect(SECTION_TYPES.has(family)).toBe(true);
    }
    for (const variant of pack.variants) {
      for (const id of variant.signatureInteractions) expect(interactionIds).toContain(id);
      const routes = variant.pages.map((page) => page.route);
      expect(new Set(routes).size).toBe(routes.length);
      for (const page of variant.pages) {
        expect(ROLES.has(page.role)).toBe(true);
        expect(page.route).toMatch(/^\/[a-z0-9-]+$/);
      }
    }
  });

  it('every vertical role profile resolves to a legal page composition for many seeds', () => {
    for (const pack of VERTICAL_PACKS) {
      expect(hasDedicatedCompositionProfiles(pack.id)).toBe(true);
      for (const role of Object.keys(pack.roleProfiles)) {
        expect(resolvePageCompositionProfile(pack.id, role).industryId).toBe(pack.id);
        for (let seed = 0; seed < 12; seed += 1) {
          const resolution = resolveComposition({ industry: pack.id, pageIntent: role, seed: `seed-${seed}` });
          expect(pageArchetypeIssues(resolution.profile.pageRole, resolution.sectionOrder)).toEqual([]);
        }
      }
    }
  });
});

describe('vertical knowledge reaches the plan and the brief', () => {
  it('a vertical replaces generic composition only when the industry has no profiles of its own', () => {
    const sports = resolveIndustryVertical('A sports fan blog')!;
    expect(compositionIndustryFor('universal', sports, hasDedicatedCompositionProfiles)).toBe('sports');
    expect(compositionIndustryFor('salon', sports, hasDedicatedCompositionProfiles)).toBe('salon');
    expect(compositionIndustryFor('universal', null, hasDedicatedCompositionProfiles)).toBe('universal');
  });

  it('turns trade phrases the owner used into interaction requirements', () => {
    const text = 'A private jet charter site with a seat map and a route map.';
    const ids = verticalInteractionRequirements(text, 'explicit', resolveIndustryVertical(text)).map((requirement) => requirement.id);
    expect(ids).toEqual(expect.arrayContaining(['req:interaction:seat-map', 'req:interaction:route-map']));
    // Single trade words only count for the vertical the prompt is about.
    expect(verticalInteractionRequirements('A bakery with classes and rooms.', 'explicit', null)).toEqual([]);
  });

  it('chat plan carries the vertical, its requirements and inferred pages for unnamed multi-page sites', () => {
    const plan = deriveChatLaunchPlan('Build a multi-page site for our boutique hotel in Cape Coast with an availability search.', { promptFirst: true });
    const creation = plan.creationInput;
    expect(creation.vertical).toMatchObject({ packId: 'hospitality', variantId: 'boutique-hotel' });
    expect(creation.requirements?.map((requirement) => requirement.id)).toContain('req:interaction:availability-search');
    const inferred = creation.requirements?.filter((requirement) => requirement.kind === 'page' && requirement.origin === 'inferred') ?? [];
    expect(inferred.length).toBeGreaterThanOrEqual(2);
    expect(creation.pages.map((page) => page.route)).toEqual(expect.arrayContaining(['/rooms']));
  });

  it('never infers pages when the owner named the pages or asked for one page', () => {
    const named = deriveChatLaunchPlan('A multi-page wedding website with Our Story, RSVP and Travel pages.', { promptFirst: true }).creationInput;
    expect(named.requirements?.some((requirement) => requirement.kind === 'page' && requirement.origin === 'inferred')).toBe(false);
    const single = deriveChatLaunchPlan('A one-page site for my yoga studio.', { promptFirst: true }).creationInput;
    expect(single.pages).toHaveLength(1);
  });

  it('does not duplicate a role the owner already named', () => {
    const pages = inferVerticalPages(resolveIndustryVertical('A sports fan blog'), [{ route: '/', suggestedRole: 'home' }, { route: '/blog', suggestedRole: 'blog' }]);
    expect(pages.some((page) => page.role === 'blog')).toBe(false);
  });

  it('renders guidance that defers to the owner and keeps honesty rules', () => {
    const block = renderVerticalKnowledge(resolveIndustryVertical('A rapper with tour dates'));
    expect(block).toContain('INDUSTRY KNOWLEDGE (Music & artists · Solo artist / band');
    expect(block).toContain('owner\'s prompt and CREATIVE REQUIREMENTS win');
    expect(block).toContain('/src/project-components/music/TourDates.tsx');
    expect(block).toContain('Streams, chart positions and press quotes only from the owner.');
    expect(renderVerticalKnowledge(null)).toBe('');
  });
});

describe('coverage understands vertical experiences', () => {
  const requirements = verticalInteractionRequirements('An airline site with a flight status board.', 'explicit', resolveIndustryVertical('airline'));
  const pages = [{ route: '/', filePath: '/src/pages/Home.tsx', title: 'Home' }];

  it('a DeparturesBoard module meets "flight status board" and is a library promotion candidate', () => {
    const report = buildRequirementCoverage({ requirements, pages, files: {
      '/src/pages/Home.tsx': 'import DeparturesBoard from "../project-components/travel/DeparturesBoard"; export default function H(){return <DeparturesBoard/>}',
      '/src/project-components/travel/DeparturesBoard.tsx': 'export default function DeparturesBoard(){return <section><p>Departures (sample data)</p></section>}',
    } });
    expect(report.items.find((item) => item.id === 'req:interaction:flight-status')?.status).toBe('met');
    expect(report.items.find((item) => item.id === 'req:data:labelled-sample')?.status).toBe('met');
    expect(report.promotionCandidates).toEqual([{ requirementId: 'req:interaction:flight-status', modulePath: '/src/project-components/travel/DeparturesBoard.tsx' }]);
  });

  it('live-looking departures without a sample label are flagged', () => {
    const report = buildRequirementCoverage({ requirements, pages, files: {
      '/src/pages/Home.tsx': 'export default function H(){return null}',
      '/src/project-components/travel/DeparturesBoard.tsx': 'export default function DeparturesBoard(){return <p>ACC to LHR on time</p>}',
    } });
    expect(report.items.find((item) => item.id === 'req:data:labelled-sample')?.status).toBe('missing');
  });
});
