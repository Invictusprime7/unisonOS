import { describe, expect, it } from 'vitest';
import { compositionToReactFileSet, updateResolvedCompositionVariants } from '@/sections/compositionToFileSet';
import { ALL_COMPOSITIONS, getCompositionById } from '@/sections/templates';
import { buildWizardDesignIntervention } from '@/services/wizardDesignIntervention';
import { generateTopologyPlaceholderFiles } from '@/utils/topologyVFSScaffolder';
import type { GeneratedSitePlan, PageRouteNode } from '@/platform/core/siteTopologyPlanner';
import type { SectionEntry } from '@/sections/types';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';

function readSections(source: string): SectionEntry[] {
  const match = source.match(/const SECTIONS = ([\s\S]*?);\nconst HYDRATABLE/);
  if (!match) throw new Error('Compiled page did not serialize sections');
  return JSON.parse(match[1]) as SectionEntry[];
}

function routePlan(templateId: string, industry: string, page: PageRouteNode): GeneratedSitePlan {
  return {
    siteId: `test-${templateId}`,
    industry,
    businessName: 'Test Studio',
    homePageId: 'home-page',
    pages: [page],
    navItems: [page.id],
    funnels: [],
    redirects: [],
    generatedAt: '2026-08-06T00:00:00.000Z',
    selectedTemplateId: templateId,
  };
}

function compileHome(templateId: string) {
  const composition = getCompositionById(templateId);
  if (!composition) throw new Error(`Missing composition: ${templateId}`);
  return compositionToReactFileSet(composition, '/src/pages/Home.tsx');
}

describe('composition VFS variants', () => {
  it('swaps an App Builder section renderer without changing its data or bindings', () => {
    const source = `import Services from "@/unison/design-sources/Services";
import Testimonials from "@/unison/design-sources/Testimonials";
export default function About() {
  return <main>
    <section data-ut-section-id="about:services:0" data-ut-section-type="services" data-ut-variant="services:editorial-rows">
      <Services sectionId="about:services:0" variantId="services:editorial-rows" props={{ headline: "Treatments", items: [{ title: "Cut", description: "A tailored cut" }] }} />
      <a data-ut-intent="booking.create" href="/booking">Book</a>
    </section>
    <section data-ut-section-id="about:testimonials:0" data-ut-section-type="testimonials" data-ut-variant="testimonials:columns"><Testimonials variantId="testimonials:columns" props={{ items: [{ quote: "Proof", author: "Client" }] }} /></section>
  </main>;
}`;
    const previous = {
      version: '1.0',
      compiledBy: 'app-builder',
      pageFilePath: '/src/pages/About.tsx',
      sections: [
        {
          sectionId: 'about:services:0',
          semanticType: 'services',
          primitiveId: 'Services',
          variantId: 'services:editorial-rows',
          data: { headline: 'Treatments', items: [{ title: 'Cut', description: 'A tailored cut' }] },
        },
        { sectionId: 'about:testimonials:0', semanticType: 'testimonials', primitiveId: 'Testimonials', variantId: 'testimonials:columns' },
      ],
      variantOverrides: { 'about:services:0': 'services:editorial-rows', 'about:testimonials:0': 'testimonials:columns' },
    } as const;

    const result = updateResolvedCompositionVariants(source, previous, {
      ...previous.variantOverrides,
      'about:services:0': 'services:expandable',
    });

    expect(result.source).toContain('data-ut-section-id="about:services:0"');
    expect(result.source).toContain('data-ut-variant="services:expandable"');
    expect(result.source).toContain('variantId="services:expandable"');
    expect(result.source).toContain('data-ut-intent="booking.create"');
    expect(result.source).toContain('variantId="testimonials:columns"');
    expect(result.source).toContain('items: [{ title: "Cut", description: "A tailored cut" }]');
    expect(result.composition.sections[0]).toMatchObject({
      variantId: 'services:expandable',
      data: { headline: 'Treatments', items: [{ title: 'Cut', description: 'A tailored cut' }] },
    });
  });

  it('swaps a shared navbar through the same App Builder section identity path', () => {
    const source = `import Navbar from "@/unison/design-sources/Navbar";
import Footer from "@/unison/design-sources/Footer";
export default function About(){return <>
  <header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:standard"><Navbar sectionId="site:navbar" variantId="navbar:standard" props={{ links: [{ label: "Home", href: "/" }] }} /></header>
  <footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:columns"><Footer sectionId="site:footer" variantId="footer:columns" props={{ links: [] }} /></footer>
</>}`;
    const previous = {
      version: '1.0',
      compiledBy: 'app-builder',
      pageFilePath: '/src/pages/About.tsx',
      sections: [
        { sectionId: 'site:navbar', semanticType: 'navbar', primitiveId: 'Navbar', variantId: 'navbar:standard', data: { links: [{ label: 'Home', href: '/' }] } },
        { sectionId: 'site:footer', semanticType: 'footer', primitiveId: 'Footer', variantId: 'footer:columns', data: { links: [] } },
      ],
      variantOverrides: { 'site:navbar': 'navbar:standard', 'site:footer': 'footer:columns' },
    } as const;

    const result = updateResolvedCompositionVariants(source, previous, {
      ...previous.variantOverrides,
      'site:navbar': 'navbar:centered-logo',
    });

    expect(result.source).toContain('data-ut-section-id="site:navbar"');
    expect(result.source).toContain('data-ut-variant="navbar:centered-logo"');
    expect(result.source).toContain('variantId="navbar:centered-logo"');
    expect(result.source).toContain('variantId="footer:columns"');
    expect(result.composition.sections.find(section => section.sectionId === 'site:navbar')?.data).toEqual({
      links: [{ label: 'Home', href: '/' }],
    });
  });

  it('migrates a stable legacy sidecar when swapping an authored JSX section', () => {
    const source = `import { ServicesEditorialRows } from "@/unison/design-sources/Services";
  export default function About(){return <section data-ut-section-id="treatment-menu" data-ut-section-type="services" data-ut-variant="services:editorial-rows"><ServicesEditorialRows headline="Owner data" items={[{ title: "Cut", description: "Tailored" }]} /><a data-ut-intent="booking.create">Book</a></section>}`;
    const previous = {
      version: '1.0',
      compiledBy: 'stage-4b',
      pageFilePath: '/src/pages/About.tsx',
      sections: [{
        sectionId: 'treatment-menu', semanticType: 'services', primitiveId: 'Services',
        legacyRendererName: 'ServicesEditorialRows', sourceModulePath: '/src/unison/design-sources/Services.tsx',
        variantId: 'services:editorial-rows', data: { headline: 'Owner data', items: [{ title: 'Cut', description: 'Tailored' }] },
      }],
      variantOverrides: { 'treatment-menu': 'services:editorial-rows' },
    } as const;

    const result = updateResolvedCompositionVariants(source, previous, { 'treatment-menu': 'services:expandable' });

    expect(result.composition.compiledBy).toBe('app-builder');
    expect(result.source).toContain('import Services from "@/unison/design-sources/Services"');
    expect(result.source).toContain('<Services sectionId="treatment-menu" variantId="services:expandable" props={');
    expect(result.source).toContain('"headline":"Owner data"');
    expect(result.source).toContain('data-ut-intent="booking.create"');
    expect(result.composition.sections[0]).not.toHaveProperty('legacyRendererName');
  });

  it('resolves a repeated nested section ID to one outer layout target', () => {
    const sectionId = '7fdb7cd1-ba2d-4e5c-9f2f-d58e9fedb52d-hero-0';
    const source = `import Hero from "@/unison/design-sources/Hero";
export default function Services(){return <section data-ut-section-id="${sectionId}" data-ut-section-type="hero" data-ut-variant="hero:split-image">
  <Hero data-ut-section-id="${sectionId}" sectionId="${sectionId}" variantId="hero:split-image" props={{ headline: "Owner headline" }} />
</section>}`;
    const previous = {
      version: '1.0',
      compiledBy: 'app-builder',
      pageFilePath: '/src/pages/Services.tsx',
      sections: [{
        sectionId,
        semanticType: 'hero',
        primitiveId: 'Hero',
        variantId: 'hero:split-image',
        data: { headline: 'Owner headline' },
      }],
      variantOverrides: { [sectionId]: 'hero:split-image' },
    } as const;

    const result = updateResolvedCompositionVariants(source, previous, { [sectionId]: 'hero:prisma-cinematic' });

    expect(result.source).toContain(`data-ut-section-id="${sectionId}" data-ut-section-type="hero" data-ut-variant="hero:prisma-cinematic"`);
    expect(result.source).toContain('variantId="hero:prisma-cinematic"');
    expect(result.source).toContain('headline: "Owner headline"');
    expect(result.composition.sections[0].variantId).toBe('hero:prisma-cinematic');
  });

  it('updates an identified section in its imported project component file', () => {
    const sectionId = '7fdb7cd1-ba2d-4e5c-9f2f-d58e9fedb52d-hero-0';
    const pagePath = '/src/pages/Services.tsx';
    const componentPath = '/src/project-components/Hero.tsx';
    const pageSource = `import HeroSection from "../project-components/Hero";
export default function Services(){return <main><HeroSection /></main>}`;
    const componentSource = `import Hero from "@/unison/design-sources/Hero";
export default function HeroSection(){return <section data-ut-section-id="${sectionId}" data-ut-section-type="hero" data-ut-variant="hero:split-image"><Hero data-ut-section-id="${sectionId}" sectionId="${sectionId}" variantId="hero:split-image" props={{ headline: "Owner headline" }} /></section>}`;
    const previous = {
      version: '1.0',
      compiledBy: 'app-builder',
      pageFilePath: pagePath,
      sections: [{
        sectionId,
        semanticType: 'hero',
        primitiveId: 'Hero',
        sourcePath: componentPath,
        variantId: 'hero:split-image',
        data: { headline: 'Owner headline' },
      }],
      variantOverrides: { [sectionId]: 'hero:split-image' },
    } as const;

    const result = updateResolvedCompositionVariants(pageSource, previous, { [sectionId]: 'hero:prisma-cinematic' }, {
      [pagePath]: pageSource,
      [componentPath]: componentSource,
    });

    expect(result.source).toBe(pageSource);
    expect(result.updatedSources[componentPath]).toContain(`data-ut-variant="hero:prisma-cinematic"`);
    expect(result.updatedSources[componentPath]).toContain('variantId="hero:prisma-cinematic"');
    expect(result.updatedSources[componentPath]).toContain('headline: "Owner headline"');
    expect(result.composition.sections[0].sourcePath).toBe(componentPath);
  });

  it('emits distinct registered page-role heroes despite an inherited Home override', () => {
    const template = getCompositionById('salon-premium')!;
    const hero = template.sections.find((section): section is SectionEntry<'hero'> => section.type === 'hero')!;
    const expected = {
      about: 'hero:variable-type', services: 'hero:launch-showcase', pricing: 'hero:page-title',
      gallery: 'hero:image-fan', booking: 'hero:editorial-banner', contact: 'hero:editorial-banner', faq: 'hero:page-title',
    } as const;
    for (const [role, variantId] of Object.entries(expected)) {
      const page: PageRouteNode = {
        id: `${role}-page`, name: role, title: role, route: `/${role}`, role: role as PageRouteNode['role'],
        filePath: `/src/pages/${role}.tsx`, visibleInNav: true, isHome: false, generatedBy: 'wizard',
      };
      const files = generateTopologyPlaceholderFiles(page, routePlan(template.id, template.industry, page), template, {

        designIntervention: { motionRecipes: [], sectionVariants: [], activeVariants: { [hero.id]: 'hero:centered' } },
      });
      const routeHero = readSections(files[page.filePath]).find((section): section is SectionEntry<'hero'> => section.type === 'hero')!;
      const pageDefinition = template.pageCompositions?.[page.role];
      if (pageDefinition) {
        expect(pageDefinition.alternatives.map(alternative => alternative.heroVariantId), role).toContain(routeHero.variantId);
      } else {
        expect(routeHero.variantId, role).toBe(variantId);
      }
      expect(routeHero.sourceSectionId).toBe(hero.id);
      expect(routeHero.props.ctas).toEqual(hero.props.ctas);
      expect(files['/src/components/recipes/Hero.ts']).toContain('HeroPageIntro');
      expect(files['/src/components/Hero.tsx']).not.toContain("from '../../types'");
    }
  });

  it('preserves every selected template home section across theme presets', () => {
    for (const template of ALL_COMPOSITIONS) {
      for (const preset of THEME_PRESETS) {
        const page: PageRouteNode = {
          id: 'home-page', name: 'Home', title: 'Home', route: '/', role: 'home',
          filePath: '/src/pages/Home.tsx', visibleInNav: true, isHome: true, generatedBy: 'wizard',
        };
        const files = generateTopologyPlaceholderFiles(page, {
          ...routePlan(template.id, template.industry, page),
          selectedThemePresetId: preset.id,
        });
        const sections = readSections(files[page.filePath]);

        expect(sections.map((section) => section.sourceSectionId || section.id), `${template.id}/${preset.id}`)
          .toEqual(template.sections.map((section) => section.sourceSectionId || section.id));
        expect(sections.map((section) => section.type)).toEqual(template.sections.map((section) => section.type));
      }
    }
  });

  it('preserves explicit subpage pools and repeated sections across themes', () => {
    const baseline = getCompositionById('salon-premium')!;
    const gallery = baseline.sections.find((section) => section.type === 'gallery')!;
    const template = {
      ...baseline,
      sections: [...baseline.sections, { ...gallery, id: `${gallery.id}-second` }],
      pageCompositions: undefined,
      sectionPool: { gallery: ['navbar', 'hero', 'gallery', 'footer'] as SectionEntry['type'][] },
    };
    const expected = template.sections
      .filter((section) => template.sectionPool.gallery.includes(section.type))
      .sort((left, right) => Number(left.type === 'footer') - Number(right.type === 'footer'));
    const page: PageRouteNode = {
      id: 'gallery-page', name: 'Gallery', title: 'Gallery', route: '/gallery', role: 'gallery',
      filePath: '/src/pages/Gallery.tsx', visibleInNav: true, isHome: false, generatedBy: 'wizard',
    };
    for (const preset of THEME_PRESETS) {
      const files = generateTopologyPlaceholderFiles(page, {
        ...routePlan(template.id, template.industry, page), selectedThemePresetId: preset.id,
      }, template);
      const sections = readSections(files[page.filePath]);
      // The explicit pool is preserved, then the industry route contract may
      // add required body families for the canonical /gallery route.
      expect(sections.map((section) => section.sourceSectionId), preset.id)
        .toEqual(expect.arrayContaining(expected.map((section) => section.id)));
      expect(sections[sections.length - 1]?.type, preset.id).toBe('footer');
      expect(new Set(sections.map((section) => section.id)).size).toBe(sections.length);
    }
  });

  it('makes LauncherWizard business identity override template sample content', () => {
    const template = getCompositionById('salon-premium');
    if (!template) throw new Error('Missing salon composition');
    const page: PageRouteNode = {
      id: 'home-page', name: 'Home', title: 'Home', route: '/', role: 'home',
      filePath: '/src/pages/Home.tsx', visibleInNav: true, isHome: true, generatedBy: 'wizard',
    };
    const plan: GeneratedSitePlan = {
      ...routePlan(template.id, template.industry, page),
      businessName: 'Northstar Dental',
      wizardSeed: {
        business: { name: 'Northstar Dental', industry: 'dental' },
        socials: [{ platform: 'instagram', href: 'https://instagram.com/northstar' }],
      },
    };

    const files = generateTopologyPlaceholderFiles(page, plan, template);
    const source = files[page.filePath];
    const sections = readSections(source);
    const navbar = sections.find((section) => section.type === 'navbar');
    const footer = sections.find((section) => section.type === 'footer');
    const navbarProps = navbar?.props as Record<string, unknown> | undefined;
    const footerProps = footer?.props as Record<string, unknown> | undefined;

    expect(source).toContain('Northstar Dental');
    expect(source).not.toContain('LumiÃ¨re Studio');
    expect(navbarProps?.brand).toBe('Northstar Dental');
    expect(footerProps?.brand).toBe('Northstar Dental');
    expect(footerProps?.copyright).toContain('Northstar Dental');
    expect(footerProps?.socials).toEqual([
      { platform: 'instagram', url: 'https://instagram.com/northstar' },
    ]);

    const contactPage: PageRouteNode = {
      id: 'contact-page', name: 'Contact', title: 'Contact', route: '/contact', role: 'contact',
      filePath: '/src/pages/Contact.tsx', visibleInNav: true, isHome: false, generatedBy: 'wizard',
    };
    const contactFiles = generateTopologyPlaceholderFiles(contactPage, {
      ...plan,
      pages: [contactPage],
      navItems: [contactPage.id],
    }, template);

    expect(contactFiles[contactPage.filePath]).toContain('Explore contact from Northstar Dental.');
    expect(contactFiles[contactPage.filePath]).not.toContain('Salon Premium');
  });

  it('derives a route-specific hero instead of serializing the home hero on subpages', () => {
    const template = getCompositionById('restaurant-premium');
    if (!template) throw new Error('Missing restaurant composition');
    const page: PageRouteNode = {
      id: 'services-page', name: 'Services', title: 'Services', route: '/services', role: 'services',
      filePath: '/src/pages/Services.tsx', visibleInNav: true, isHome: false, generatedBy: 'wizard',
    };
    const plan: GeneratedSitePlan = {
      siteId: 'test-site', industry: 'restaurant', businessName: 'Table', homePageId: 'home-page',
      pages: [page], navItems: [page.id], funnels: [], redirects: [], generatedAt: '2026-08-06T00:00:00.000Z',
      selectedTemplateId: template.id,
    };
    const files = generateTopologyPlaceholderFiles(page, plan, template);
    const source = files['/src/pages/Services.tsx'];
    const homeHero = template.sections.find(
      (section): section is SectionEntry<'hero'> => section.type === 'hero',
    );
    if (!homeHero) throw new Error('Restaurant composition must include a hero');
    const routeSectionsMatch = source.match(/const SECTIONS = ([\s\S]*?);\nconst HYDRATABLE/);
    if (!routeSectionsMatch) throw new Error('Route page did not serialize sections');
    const routeSections = JSON.parse(routeSectionsMatch[1]) as Array<SectionEntry>;
    const routeHero = routeSections.find(
      (section): section is SectionEntry<'hero'> => section.type === 'hero',
    );
    if (!routeHero) throw new Error('Route page must include a hero');

    expect(source).toContain('"headline": "Services"');
  expect(source).toContain('"badge": "Our Offerings"');
    expect(source).not.toContain(`"headline": ${JSON.stringify(homeHero?.props.headline)}`);
    expect(source).not.toContain(JSON.stringify(homeHero?.props.backgroundImage));
    expect(routeHero.variantId).toBe('hero:split-image');
    expect(routeHero.props.layout).toBe('split');
  });

  it('keeps an explicit page hero override when the hero is cloned for a route', () => {
    const template = getCompositionById('salon-premium');
    if (!template) throw new Error('Missing salon composition');
    const hero = template.sections.find((section): section is SectionEntry<'hero'> => section.type === 'hero');
    if (!hero) throw new Error('Salon composition must include a hero');
    const page: PageRouteNode = {
      id: 'salon-contact', name: 'Contact', title: 'Contact', route: '/contact', role: 'contact',
      filePath: '/src/pages/Contact.tsx', visibleInNav: true, isHome: false, generatedBy: 'wizard',
    };
    const files = generateTopologyPlaceholderFiles(page, routePlan(template.id, template.industry, page), template, {
      designIntervention: {
        motionRecipes: [],
        sectionVariants: [],
        activeVariants: { [`${page.id}-hero-0`]: 'hero:full-bleed' },
      },
    });
    const routeHero = readSections(files[page.filePath]).find(
      (section): section is SectionEntry<'hero'> => section.type === 'hero',
    );

    expect(routeHero?.sourceSectionId).toBe(hero.id);
    expect(routeHero?.variantId).toBe('hero:full-bleed');
    expect(files[page.filePath]).toContain('"variantId": "hero:full-bleed"');
    // Recovery Phase 2 â€” variant identity travels as data on the section, not
    // through a generated per-variant wrapper module.
    expect(Object.values(files).some((source) => source.includes('/src/components/variants/'))).toBe(false);
  });

  it('emits at least four canonical body sections for contact routes across all industries', () => {
    for (const template of ALL_COMPOSITIONS) {
      const page: PageRouteNode = {
        id: `${template.id}-contact`, name: 'Contact', title: 'Contact', route: '/contact', role: 'contact',
        filePath: '/src/pages/Contact.tsx', visibleInNav: true, isHome: false, generatedBy: 'wizard',
      };
      const files = generateTopologyPlaceholderFiles(page, routePlan(template.id, template.industry, page), template);
      const sections = readSections(files[page.filePath]);

      expect(sections.length, template.id).toBeGreaterThanOrEqual(4);
      // Chrome is page-owned now: a page may open with its own navbar section.
      expect(sections.some((section) => section.type === 'hero'), template.id).toBe(true);
    }
  });

  it('serializes each selected composition layout into the canonical page VFS', () => {
    const restaurant = compileHome('restaurant-premium');
    const saas = compileHome('saas-dark');
    const restaurantPage = restaurant['/src/pages/Home.tsx'];
    const saasPage = saas['/src/pages/Home.tsx'];

    expect(restaurantPage).toContain('"layout": "centered-logo"');
    expect(restaurantPage).toContain('"layout": "full-bleed"');
    expect(restaurantPage).toContain('"layout": "split-card"');
    expect(restaurantPage).toContain('"layout": "dark-band"');
    expect(restaurantPage).toContain('photo-1517248135467-4c7edcad34c4');

    expect(saasPage).toContain('"layout": "minimal-dark"');
    expect(saasPage).toContain('"layout": "centered"');
    expect(saasPage).toContain('"layout": "centered-minimal"');
    expect(saasPage).not.toContain('"layout": "full-bleed"');
    expect(saasPage).not.toBe(restaurantPage);
  });

  it('emits structural renderer branches for variant layouts and supplied media', () => {
    const files = compileHome('restaurant-premium');

    // M4: structural branches live in the certified family recipes.
    expect(files['/src/components/recipes/Hero.ts']).toContain('"hero:full-bleed"');
    expect(files['/src/components/Hero.tsx']).toContain('"hero:full-bleed"');
    expect(files['/src/components/recipes/Hero.ts']).not.toContain("paddingTop: '8rem'");
    expect(files['/src/components/recipes/Hero.ts']).not.toContain("paddingTop: '10rem'");
    expect(files['/src/components/recipes/Services.ts']).toContain('"services:alternating"');
    expect(files['/src/components/recipes/Testimonials.ts']).toContain('"testimonials:rail"');
    expect(files['/src/components/recipes/CTA.ts']).toContain('"cta:split-card"');
    expect(files['/src/components/recipes/Contact.ts']).toContain('"contact:split-card"');
    expect(files['/src/components/recipes/Footer.ts']).toContain('"footer:dark-band"');
    // Certified media handling is reservation-based (explicit aspect ratio),
    // not the removed hand-rolled media-frame wrapper.
    expect(files['/src/components/recipes/Hero.ts']).toContain('aspectRatio');
    expect(files['/src/components/recipes/Services.ts']).toContain('item.image');
    expect(files['/src/pages/Home.tsx']).toContain('data-ut-media-treatment={section.type === \'hero\' ? mediaTreatment : undefined}');
  });

  it('keeps legacy snapshot motion recipes inert until an explicit upgrade', () => {
    const restaurant = getCompositionById('restaurant-premium');
    if (!restaurant) throw new Error('Restaurant composition must be registered');
    const designIntervention = buildWizardDesignIntervention({
      businessName: 'Motion Kitchen', businessModel: 'restaurant_hospitality', industryOverlay: 'restaurant',
      templateId: restaurant.id, themePresetId: 'organic',
    });
    const page = compositionToReactFileSet(restaurant, '/src/pages/Home.tsx', { designIntervention: { ...designIntervention, compositionPolicy: undefined } })['/src/pages/Home.tsx'];

    expect(designIntervention.motionRecipes.length).toBeGreaterThan(0);
    expect(page).not.toContain("from '@/unison/ui/motion'");
    expect(page).not.toContain('const DESIGN_MOTION');
    expect(page).not.toContain('<Reveal recipe={motionRecipe}>');
  });

  it('projects selected section variants into supported renderer layouts', () => {
    const restaurant = getCompositionById('restaurant-premium');
    if (!restaurant) throw new Error('Restaurant composition must be registered');
    const page = compositionToReactFileSet(restaurant, '/src/pages/Home.tsx', {
      designIntervention: {
        motionRecipes: [],
        sectionVariants: ['split-media-hero', 'comparison-services', 'testimonial-rail', 'conversion-form'],
        activeVariants: {},
      },
    })['/src/pages/Home.tsx'];
    const sectionsMatch = page.match(/const SECTIONS = ([\s\S]*?);\nconst HYDRATABLE/);
    if (!sectionsMatch) throw new Error('Compiled page did not serialize sections');
    const sections = JSON.parse(sectionsMatch[1]) as Array<{ type: string; variantId?: string; props: { layout?: string } }>;

    // Recipes resolve to executable variant ids (Phase 5), not vague layout words.
    expect(sections.find((section) => section.type === 'hero')?.variantId).toBe('hero:split-image');
    expect(sections.find((section) => section.type === 'services')?.variantId).toBe('services:alternating');
    expect(sections.find((section) => section.type === 'contact')?.variantId).toBe('contact:split-card');
    expect(sections.find((section) => section.type === 'hero')?.props.layout).toBe('split');
    expect(sections.find((section) => section.type === 'testimonials')?.props.layout).toBe('carousel');
  });

  it('persists stable section variant identity in the compiled page VFS', () => {
    const restaurant = getCompositionById('restaurant-premium');
    if (!restaurant) throw new Error('Restaurant composition must be registered');
    const hero = restaurant.sections.find((section) => section.type === 'hero');
    if (!hero) throw new Error('Restaurant composition must include a hero');
    const files = compositionToReactFileSet(restaurant, '/src/pages/Home.tsx', {
      designIntervention: {
        motionRecipes: [],
        sectionVariants: [],
        activeVariants: { [hero.id]: 'hero:split-image' },
      },
    });
    const page = files['/src/pages/Home.tsx'];
    const variantModules = Object.keys(files).filter((path) => path.startsWith('/src/components/variants/'));

    expect(page).toContain(`"variantId": "hero:split-image"`);
    expect(page).toContain('data-ut-variant={section.variantId || undefined}');
    expect(page).toContain('SECTION_MAP[section.id] || SECTION_MAP[section.type]');
    // No variant wrapper tier: the semantic component receives the variant via props.
    expect(variantModules).toEqual([]);
  });

  it('preserves section variant identity when presentation order changes', () => {
    const restaurant = getCompositionById('restaurant-premium');
    if (!restaurant) throw new Error('Restaurant composition must be registered');
    const intervention = buildWizardDesignIntervention({
      businessName: 'Reordered Kitchen',
      businessModel: 'restaurant_hospitality',
      industryOverlay: 'restaurant',
      templateId: restaurant.id,
      themePresetId: 'organic',
    });
    const reordered = { ...restaurant, sections: [...restaurant.sections].reverse() };
    const page = compositionToReactFileSet(reordered, '/src/pages/Home.tsx', {
      designIntervention: intervention,
    })['/src/pages/Home.tsx'];

    for (const [sectionId, variantId] of Object.entries(intervention.activeVariants)) {
      expect(page).toContain(`"id": "${sectionId}"`);
      expect(page).toContain(`"variantId": "${variantId}"`);
    }
  });

  it('does not reference motion primitives when no intervention is supplied', () => {
    const page = compileHome('restaurant-premium')['/src/pages/Home.tsx'];
    expect(page).not.toContain("from '@/unison/ui/motion'");
    expect(page).not.toContain('<Reveal recipe={motionRecipe}>');
  });

  it('uses Stage 4b semantic tokens and does not project unselected section modules', () => {
    const restaurant = getCompositionById('restaurant-premium');
    if (!restaurant) throw new Error('Missing restaurant composition');

    const heroOnly = compositionToReactFileSet({
      ...restaurant,
      sections: restaurant.sections.filter((section) => section.type === 'hero'),
    }, '/src/pages/Offer.tsx');

    expect(heroOnly['/src/components/theme.ts']).toContain('"primary": "var(--primary)"');
    expect(heroOnly['/src/components/theme.ts']).toContain('"headingFont": "var(--font-heading)"');
    expect(heroOnly['/src/components/SiteLayout.tsx']).not.toContain('TEMPLATE_GLOBAL_STYLES');
    expect(heroOnly['/src/components/Hero.tsx']).toBeDefined();
    expect(heroOnly['/src/components/Navbar.tsx']).toBeUndefined();
    expect(heroOnly['/src/components/Footer.tsx']).toBeUndefined();
    expect(heroOnly['/src/pages/Offer.sections.ts']).not.toContain("import Navbar");
  });

  it('keeps Stage 4b authoritative over scaffold presentation', () => {
    const files = compileHome('restaurant-premium');
    const visualModules = Object.entries(files).filter(([path]) => (
      /\/src\/components\/(?:theme\.ts|(?:SiteLayout|Navbar|Hero|Services|Testimonials|CTA|Contact|Footer|Stats|Team|FAQ)\.tsx)$/.test(path)
    ));
    const forbiddenPresentation = [
      /document\.body\.style\./,
      /export const (?:headingStyle|bodyStyle|primaryBtnStyle|outlineBtnStyle|cardStyle)/,
      /fontFamily\s*:/,
      /(?:background|backgroundColor|color|borderColor|boxShadow|borderRadius)\s*:/,
      /#[0-9a-f]{3,8}\b/i,
      /\brgba?\(/i,
    ];

    for (const [path, source] of visualModules) {
      for (const pattern of forbiddenPresentation) {
        expect(source, `${path} contains scaffold presentation matching ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('routes generated social icons through the snapshot VFS facade', () => {
    const files = compileHome('restaurant-premium');

    expect(files['/src/components/SocialIcon.tsx']).toContain("from '@/unison/ui/icons'");
    expect(files['/src/components/SocialIcon.tsx']).not.toContain("from 'lucide-react'");
  });

  it('requires explicit shell layouts and keeps representative industries structurally distinct', () => {
    for (const composition of ALL_COMPOSITIONS) {
      for (const section of composition.sections.filter((entry) => (
        entry.type === 'navbar' || entry.type === 'footer' || entry.type === 'contact'
      ))) {
        expect((section.props as { layout?: unknown }).layout, `${composition.id}:${section.id}`).toEqual(expect.any(String));
      }
    }

    const templateIds = [
      'restaurant-premium',
      'saas-dark',
      'salon-minimal',
      'store-boutique',
      'portfolio-photography',
      'agency-editorial',
      'coaching-fitness',
    ];
    const fingerprints = templateIds.map((templateId) => {
      const page = compileHome(templateId)['/src/pages/Home.tsx'];
      return Array.from(page.matchAll(/"type": "([^"]+)"[\s\S]{0,180}?"layout": "([^"]+)"/g))
        .map((match) => `${match[1]}:${match[2]}`)
        .join('|');
    });

    expect(new Set(fingerprints).size).toBe(templateIds.length);
  });
});
