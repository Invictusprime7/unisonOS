import type { AppBuildContract } from '../appBuilderContracts';
import type { SectionType } from '@/sections/types';
import { verifiedPhotosFor } from './pageStructureGate';

export interface AppBuilderScaffoldImplementation {
  modulePath: string;
  sectionType: string;
  props?: string;
}

export interface AppBuilderScaffoldRegistry {
  implementations: Readonly<Record<string, AppBuilderScaffoldImplementation>>;
  eligibleByPage: Readonly<Record<string, readonly string[]>>;
}

interface PlannedScaffoldSection {
  sectionType: SectionType;
  variantId: string;
  modulePath: string;
  propHint?: string;
}

function safeRouteHref(path: string | undefined): string {
  if (!path) return '#/';
  return `#${path.startsWith('/') ? path : `/${path}`}`;
}

function actionMarkup(contract: AppBuildContract, pageId: string): string[] {
  return contract.business.intentBindings
    .filter((binding) => binding.pageId === pageId
      && binding.missingCapabilities.length === 0
      && binding.ctaMarkers.length > 0)
    .flatMap((binding) => {
      const marker = binding.ctaMarkers.find((value) => value.startsWith('cta.') || value.startsWith('icon.'));
      if (!marker) return [];
      const label = binding.sourceLabel?.trim() || marker.slice(marker.indexOf('.') + 1).replace(/[-.]/g, ' ');
      const jsxLabel = `{${JSON.stringify(label)}}`;
      const accessibleName = marker.startsWith('icon.') ? ` aria-label=${JSON.stringify(label)}` : '';
      const isNavigation = binding.domIntent === 'nav.goto';
      const targetPage = binding.targetType === 'page'
        ? contract.topology.pageRegistry.pages[binding.targetId]
        : undefined;
      const href = binding.targetType === 'url'
        ? binding.targetId
        : safeRouteHref(targetPage?.path ?? (binding.targetId.startsWith('/') ? binding.targetId : undefined));
      return [isNavigation
        ? `<a href=${JSON.stringify(href)}${accessibleName} data-ut-cta=${JSON.stringify(marker)} className="inline-flex min-h-11 items-center rounded-md border px-5 py-3 font-medium">${jsxLabel}</a>`
        : `<button type="button"${accessibleName} data-ut-cta=${JSON.stringify(marker)} className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground">${jsxLabel}</button>`];
    });
}

  function sectionContent(contract: AppBuildContract, page: AppBuildContract['topology']['sitePlan']['pages'][number], family: SectionType, pageTitle: string, imageUrl?: string) {
    const planned = contract.design.compositionPlan.pages.find((candidate) => candidate.pageId === page.id);
    const vocabulary = planned?.profile.domainVocabulary ?? [];
    const vocabularyHint = vocabulary.length ? vocabulary[0] : page.title.toLowerCase();
    const isPortfolio = String(contract.business.industry ?? '').toLowerCase().includes('portfolio');
    if (family === 'features') {
      return {
        eyebrow: isPortfolio ? 'Selected practice' : `About ${vocabularyHint}`,
        title: isPortfolio ? 'A point of view, made tangible' : 'Thoughtful by design',
        description: isPortfolio
          ? 'A focused approach to ideas, form, and the details that make each project distinct.'
          : 'A clear foundation, carefully considered details, and a result built to last.',
        items: isPortfolio
          ? [
              { title: 'Identity', description: 'Distinctive visual systems with a clear point of view.' },
              { title: 'Digital', description: 'Useful, expressive experiences shaped around real people.' },
              { title: 'Story', description: 'A consistent voice across every place your work appears.' },
            ]
          : [
              { title: 'Clarity', description: 'A strong direction before the details take shape.' },
              { title: 'Craft', description: 'Careful choices in every part of the experience.' },
              { title: 'Continuity', description: 'A coherent result from first impression to follow-through.' },
            ],
      };
    }
    if (family === 'services') {
      return {
        eyebrow: isPortfolio ? 'How we work' : 'The approach',
        title: isPortfolio ? 'From first sketch to final detail' : 'A considered process, start to finish',
        description: 'Each step has a purpose, keeping the work clear and moving forward.',
        items: [
          { title: 'Discover', description: 'Find the right questions and a useful starting point.' },
          { title: 'Shape', description: 'Turn the direction into a thoughtful, usable experience.' },
          { title: 'Refine', description: 'Bring the details together and prepare the work to meet the world.' },
        ],
      };
    }
    if (family === 'gallery') {
      return {
        eyebrow: 'Selected work',
        title: `A closer look at ${vocabularyHint}`,
        description: 'A visual introduction to the details, materials, and character behind the work.',
        items: imageUrl ? [
          { title: 'Featured work', description: 'A considered detail from the collection.', imageUrl },
          { title: 'In context', description: 'A closer view of the finished experience.', imageUrl },
          { title: 'The details', description: 'Small choices shape the whole.', imageUrl },
        ] : [],
      };
    }
    return {
      eyebrow: family === 'hero' ? 'Welcome' : family,
      title: family === 'hero' ? `Welcome to ${contract.business.businessName}` : `${pageTitle}: ${vocabularyHint}`,
      description: contract.business.businessProfile.description?.trim()
        || contract.business.parameters.description?.trim()
        || `A starter page for ${contract.business.businessName}.`,
      items: [
        { title: 'Start here', description: `Add the key ${vocabularyHint} details for your business.` },
        { title: 'The details', description: 'Shape this section around the information visitors need.' },
        { title: 'Next steps', description: 'Connect this content to the owner-approved workflow.' },
      ],
    };
  }

  function resolvePageSections(
    contract: AppBuildContract,
    page: AppBuildContract['topology']['sitePlan']['pages'][number],
    registry: AppBuilderScaffoldRegistry,
  ): PlannedScaffoldSection[] {
    const planned = contract.design.compositionPlan.pages.find((candidate) => candidate.pageId === page.id);
    if (!planned?.target.sectionOrder.length) {
      throw new Error(`[AppBuilderScaffold] ${page.filePath} has no canonical composition section order.`);
    }
    const eligibleIds = registry.eligibleByPage[page.id] ?? [];
    const occurrenceByFamily = new Map<string, number>();
    return planned.target.sectionOrder.map((sectionType) => {
      const variantId = eligibleIds.find((id) => registry.implementations[id]?.sectionType === sectionType);
      const implementation = variantId ? registry.implementations[variantId] : undefined;
      if (!variantId || !implementation) {
        throw new Error(`[AppBuilderScaffold] ${page.filePath} has no page-eligible ${sectionType} implementation from the canonical registry.`);
      }
      occurrenceByFamily.set(sectionType, (occurrenceByFamily.get(sectionType) ?? 0) + 1);
      return {
        sectionType: sectionType as PlannedScaffoldSection['sectionType'],
        variantId,
        modulePath: implementation.modulePath,
        propHint: implementation.props,
      };
    });
  }

  function propValue(
    key: string,
    content: ReturnType<typeof sectionContent>,
    contract: AppBuildContract,
    headingLevel: 'h1' | 'h2',
    imageUrl?: string,
  ): unknown {
    if (['eyebrow', 'kicker', 'label'].includes(key)) return content.eyebrow;
    if (['title', 'headline', 'heading'].includes(key)) return content.title;
    if (['description', 'subtitle', 'subheading', 'body', 'copy', 'text'].includes(key)) return content.description;
    if (['headingLevel', 'headingTag'].includes(key)) return headingLevel;
    if (['image', 'imageUrl', 'src', 'url', 'backgroundImage'].includes(key)) return imageUrl;
    if (['brand', 'businessName', 'siteName'].includes(key)) return contract.business.businessName;
    if (['items', 'features', 'services', 'projects', 'cards', 'images'].includes(key)) return content.items;
    if (['testimonials', 'reviews'].includes(key)) return content.items.map((item) => ({
      quote: 'Owner-provided testimonial goes here.',
      author: 'Owner-provided',
      role: 'Add an approved attribution',
      ...item,
    }));
    if (['faqs', 'questions'].includes(key)) return content.items.map((item) => ({
      question: item.title,
      answer: item.description,
    }));
    if (['logos', 'links', 'columns', 'socials', 'ctas', 'actions', 'stats', 'badges', 'fields'].includes(key)) return undefined;
    return undefined;
  }

  function propsFromRegistryHint(
    hint: string | undefined,
    content: ReturnType<typeof sectionContent>,
    contract: AppBuildContract,
    headingLevel: 'h1' | 'h2',
    imageUrl?: string,
  ): Record<string, unknown> {
    const props: Record<string, unknown> = {};
    for (const token of (hint ?? '').split(/,\s*/).filter(Boolean)) {
      const array = /^(\w+)(\?)?\[\](?:\{([^}]*)\})?$/.exec(token);
      if (array) {
        const [, name, optional, fieldHint] = array;
        if (optional && !content.items.length) continue;
        const fields = (fieldHint ?? '').split('|').map((field) => field.replace(/\?$/, '')).filter(Boolean);
        props[name] = content.items.map((item, index) => Object.fromEntries(fields.map((field) => {
          const value = propValue(field, content, contract, headingLevel, imageUrl);
          if (value !== undefined) return [field, value];
          if (['title', 'name', 'label'].includes(field)) return [field, item.title];
          if (['description', 'text', 'answer'].includes(field)) return [field, item.description];
          if (['question'].includes(field)) return [field, `What should visitors know about ${contract.business.businessName}?`];
          if (['quote'].includes(field)) return [field, 'Owner-provided testimonial goes here.'];
          if (['author'].includes(field)) return [field, 'Owner-provided'];
          if (['alt', 'caption'].includes(field)) return [field, `${item.title} for ${contract.business.businessName}`];
          if (['value'].includes(field)) return [field, `Add ${index + 1}`];
          if (['src', 'image', 'imageUrl', 'url'].includes(field) && imageUrl) return [field, imageUrl];
          return [field, item.description];
        })));
        continue;
      }
      const scalar = /^(\w+)(\?)?$/.exec(token);
      if (!scalar) continue;
      const [, name, optional] = scalar;
      const value = propValue(name, content, contract, headingLevel, imageUrl);
      if (value !== undefined) props[name] = value;
      else if (!optional && ['title', 'headline', 'heading'].includes(name)) props[name] = content.title;
      else if (!optional && ['description', 'subtitle', 'body', 'text'].includes(name)) props[name] = content.description;
    }
    return props;
  }

  function renderPage(
    contract: AppBuildContract,
    page: AppBuildContract['topology']['sitePlan']['pages'][number],
    sections: readonly PlannedScaffoldSection[],
    imageUrl?: string,
  ): string {
  const pageId = page.id;
  const description = contract.business.businessProfile.description?.trim()
    || contract.business.parameters.description?.trim()
    || `A starter page for ${contract.business.businessName}.`;
  const actions = actionMarkup(contract, pageId);
    const importByFamily = new Map<string, string>();
    const occurrences = new Map<string, number>();
    const sectionMarkup = sections.map((section, index) => {
      const family = section.sectionType;
      const dispatcherName = section.modulePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
      const importPath = section.modulePath.replace(/^\/src\//, '@/').replace(/\.[^.]+$/, '');
      if (!dispatcherName || !importPath) throw new Error(`[AppBuilderScaffold] Invalid dispatcher for ${section.variantId}.`);
      importByFamily.set(dispatcherName, importPath);
      const occurrence = occurrences.get(family) ?? 0;
      occurrences.set(family, occurrence + 1);
      const sectionId = `${pageId}:${family}:${occurrence}`;
      const content = sectionContent(contract, page, family, page.title, imageUrl);
      const headingLevel = page.isHome && index === 0 ? 'h1' : 'h2';
      const props = propsFromRegistryHint(section.propHint, content, contract, headingLevel, imageUrl);
      if (!Object.keys(props).length) {
        throw new Error(`[AppBuilderScaffold] ${page.filePath} ${section.variantId} has no canonical prop projection.`);
      }
    return `<section data-ut-section-id=${JSON.stringify(sectionId)} data-ut-section-type=${JSON.stringify(family)} data-ut-variant=${JSON.stringify(section.variantId)}>
        <${dispatcherName} sectionId=${JSON.stringify(sectionId)} variantId=${JSON.stringify(section.variantId)} props={${JSON.stringify(props)}} />
      ${index === 0 ? actions.join('\n      ') : ''}
    </section>`;
  });

    const sectionImports = [...importByFamily].map(([name, path]) => `import ${name} from ${JSON.stringify(path)};`).join('\n');
    return `import React from "react";
import { SiteNav } from "@/project-components/site/SiteNav";
import { SiteFooter } from "@/project-components/site/SiteFooter";
  ${sectionImports}

export default function ${page.isHome ? 'Home' : `Page${pageId.replace(/[^a-zA-Z0-9]/g, '')}`}() {
  return <><SiteNav /><main className="mx-auto w-full max-w-6xl space-y-10 px-6 py-10">
      ${sectionMarkup.join('\n    ')}
  </main><SiteFooter /></>;
}
`;
}

/** Build a clearly non-AI starter from canonical pages, active bindings, and public profile facts. */
  export function materializeDeterministicAppBuilderScaffold(
    contract: AppBuildContract,
    registry: AppBuilderScaffoldRegistry,
  ): Record<string, string> {
  const pages = contract.topology.sitePlan.pages;
  const photos = verifiedPhotosFor(contract.design.resolvedSiteDesignContext.contract.industry);
  const image = photos[0];
    return Object.fromEntries(pages.map((page, index) => {
      const sections = resolvePageSections(contract, page, registry);
      return [page.filePath, renderPage(
        contract,
        page,
        sections,
        image ? photos[index % Math.max(1, photos.length)] : undefined,
      )];
    }));
}