import { describe, expect, it } from 'vitest';
import {
  buildPromptLaunchInput,
  extractPromptSocialLinks,
  inferPromptExperience,
} from '@/services/launch/promptLaunchInput';
import { clearRetiredInterviewDrafts } from '@/components/launch/PromptLaunchPanel';
import {
  ARCHETYPE_ADVISORY_POLICY,
  MIXED_SECTION_AUTHORING_POLICY,
  renderOwnerCreativeBrief,
} from '@/services/app-builder/creativeAuthorityPolicy';
import { buildSyncedVisionBrief, deriveChatLaunchPlan } from '@/services/launch/chatLaunchPlan';
import { countSectionOrigins } from '@/services/app-builder/sectionOrigins';
import { materializeAppBuilderSectionModelsWithDiagnostics } from '@/services/app-builder/appBuilderSectionModel';

const FOOTBALL = 'Build a Ghanaian football publication called Black Star Pulse with an interactive match centre, live score cards and team stories in Ghana colours.';

describe('prompt-first launch input (UPG-01)', () => {
  it('builds the canonical launch input from the prompt alone, with no guided selections', () => {
    const { input, plan } = buildPromptLaunchInput(FOOTBALL);
    expect(input.industry).toBe('universal');
    expect(input.generationMode).toBe('ai');
    expect(input.primaryGoal).toBeNull();
    expect(input.customerNeeds).toEqual([]);
    expect(input.designSelection?.mode).toBe('auto');
    expect(input.universalCreation?.mode).toBe('open-ended');
    expect(input.universalCreation?.originalPrompt).toBe(FOOTBALL);
    expect(input.selectedPages).toEqual(plan.selectedPages);
    expect(input.businessName).toBe('Black Star Pulse');
  });

  it('keeps the original prompt as the first line of the brief App Builder receives', () => {
    const { input } = buildPromptLaunchInput(FOOTBALL);
    expect(input.visionPrompt.split('\n')[0]).toContain(FOOTBALL);
    expect(input.visionPrompt.split('\n')[0]).toContain('primary creative authority');
  });

  it('rejects an empty prompt instead of launching a default site', () => {
    expect(() => buildPromptLaunchInput('   ')).toThrow('Describe the site you want to create.');
  });

  it('pre-fills public contact details from saved business details', () => {
    const { input } = buildPromptLaunchInput(FOOTBALL, {
      prefill: { businessId: 'biz-1', email: 'hello@pulse.example', phone: '+233 20 123 4567', notificationEmail: 'owner@pulse.example' },
    });
    expect(input.existingBusinessId).toBe('biz-1');
    expect(input.businessParameters?.ctaDestinations?.call).toBe('tel:+233201234567');
    expect(input.businessParameters?.ctaDestinations?.email).toBe('mailto:hello@pulse.example');
    expect(input.businessParameters?.notificationEmail).toBe('owner@pulse.example');
  });

  it('infers the motion budget from the prompt', () => {
    expect(inferPromptExperience('a cinematic, scroll-driven portfolio')).toBe('motion-rich');
    expect(inferPromptExperience('an immersive 3D product world')).toBe('immersive');
    expect(inferPromptExperience('a calm bakery site')).toBe('standard');
  });
});

describe('creative authority', () => {
  it('lets confirmed refinements override inferred defaults without dropping the prompt', () => {
    const plan = deriveChatLaunchPlan(FOOTBALL, { promptFirst: true });
    const brief = buildSyncedVisionBrief(plan, {
      industry: null,
      businessName: 'Pulse Weekly',
      primaryGoal: null,
      selectedPages: plan.selectedPages,
      themePresetId: null,
    });
    expect(brief).toContain(FOOTBALL);
    expect(brief).toContain('REVISABLE PLAN DEFAULTS');
  });

  it('offers REUSE, ADAPT and AUTHOR without a registry-only or custom-only ceiling', () => {
    expect(MIXED_SECTION_AUTHORING_POLICY).toContain('REUSE a certified design');
    expect(MIXED_SECTION_AUTHORING_POLICY).toContain('AUTHOR: write an original');
    expect(MIXED_SECTION_AUTHORING_POLICY).toContain('do not make every section custom');
    expect(MIXED_SECTION_AUTHORING_POLICY).toContain('do not force a registered variant');
    expect(ARCHETYPE_ADVISORY_POLICY).toContain('advisory');
  });

  it('renders the owner brief and points to the full prompt when it is long', () => {
    expect(renderOwnerCreativeBrief('')).toBe('');
    const long = renderOwnerCreativeBrief('x'.repeat(50), 10);
    expect(long).toContain('OWNER CREATIVE BRIEF');
    expect(long).toContain('VISITOR CREATION SPECIFICATION');
  });
});

describe('mixed certified and site-local sections', () => {
  const implementations = {
    'navbar:standard': { modulePath: '/src/unison/design-sources/Navbar.tsx', sectionType: 'navbar' },
    'services:editorial-rows': { modulePath: '/src/unison/design-sources/Services.tsx', sectionType: 'services' },
    'footer:columns': { modulePath: '/src/unison/design-sources/Footer.tsx', sectionType: 'footer' },
  };
  const page = `import Navbar from "@/unison/design-sources/Navbar";
import Services from "@/unison/design-sources/Services";
import Footer from "@/unison/design-sources/Footer";
import MatchCentre from "@/project-components/football/MatchCentre";
export default function Home(){return <><header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:standard"><Navbar sectionId="site:navbar" variantId="navbar:standard" props={{links:[]}} /></header><main><section data-ut-section-id="home:match-centre:0" data-ut-section-type="match-centre" data-ut-variant="custom:match-centre"><MatchCentre title="Ghana v Senegal" /></section><section data-ut-section-id="home:services:0" data-ut-section-type="services" data-ut-variant="services:editorial-rows"><Services sectionId="home:services:0" variantId="services:editorial-rows" props={{ headline: "Coverage", items: [{ title: "Match reports", description: "Every Black Stars fixture" }] }} /></section></main><footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:columns"><Footer sectionId="site:footer" variantId="footer:columns" props={{links:[]}} /></footer></>}`;

  it('accepts a page that reuses a certified design next to an original component', () => {
    const result = materializeAppBuilderSectionModelsWithDiagnostics(
      {
        '/src/pages/Home.tsx': page,
        '/src/project-components/football/MatchCentre.tsx': 'export default function MatchCentre({title}:{title:string}){return <article><h2>{title}</h2><p>Live</p></article>}',
      },
      [{ id: 'home', filePath: '/src/pages/Home.tsx' }],
      implementations,
      { home: ['navbar:standard', 'services:editorial-rows', 'footer:columns'] },
      ['navbar:standard', 'footer:columns'],
    );
    expect(result.diagnostics).toEqual([]);
    const sections = result.pages[0].inspection.sections;
    expect(sections.find((s) => s.sectionId === 'home:services:0')?.variantId).toBe('services:editorial-rows');
    expect(sections.find((s) => s.sectionId === 'home:match-centre:0')?.variantId?.startsWith('custom:')).toBe(true);
    expect(countSectionOrigins(result.files, ['/src/pages/Home.tsx'])).toEqual({ certified: 1, custom: 1 });
  });
});

describe('prompt-first launch replaces the retired guided setup responsibilities', () => {
  it('carries social profiles written in the conversation into the launch', () => {
    const { input } = buildPromptLaunchInput(
      'Build a bakery site called Crumb. Our Instagram is https://instagram.com/crumbbakes and TikTok https://www.tiktok.com/@crumb.',
    );
    expect(input.socialLinks).toEqual({
      instagram: 'https://instagram.com/crumbbakes',
      tiktok: 'https://www.tiktok.com/@crumb',
    });
    expect(input.businessParameters?.socialLinks).toEqual(input.socialLinks);
  });

  it('ignores non-social links and bare network homepages', () => {
    expect(extractPromptSocialLinks('See https://crumb.example/menu and https://instagram.com/ for ideas')).toEqual({});
  });

  it('lets a link stated in the conversation replace a saved business profile link', () => {
    const { input } = buildPromptLaunchInput('A studio site. Instagram: https://instagram.com/new-handle', {
      prefill: { socialLinks: { instagram: 'https://instagram.com/old-handle', facebook: 'https://facebook.com/studio' } },
    });
    expect(input.socialLinks).toEqual({
      instagram: 'https://instagram.com/new-handle',
      facebook: 'https://facebook.com/studio',
    });
  });

  it('clears answers the retired guided setup saved in the browser, and nothing else', () => {
    const store = new Map<string, string>([
      ['unison.launch-interview.v1.user-1', '{"privateAnswers":{"ownerEmail":"a@b.c"}}'],
      ['unison.launch-interview.v1.anonymous', '{}'],
      ['unison.site-discovery.user-1', '[]'],
    ]);
    const storage = {
      get length() { return store.size; },
      key: (index: number) => [...store.keys()][index] ?? null,
      removeItem: (key: string) => { store.delete(key); },
    };
    clearRetiredInterviewDrafts(storage);
    expect([...store.keys()]).toEqual(['unison.site-discovery.user-1']);
  });
});
