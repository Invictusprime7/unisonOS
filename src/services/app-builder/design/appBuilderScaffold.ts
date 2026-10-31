import type { AppBuildContract } from '../appBuilderContracts';
import type { SectionType } from '@/sections/types';
import { verifiedPhotosFor } from './pageStructureGate';
import { resolvePageCompositionProfile } from '@/services/composition/industryCompositionRegistry';
import { getIndustryContext } from '@/sections/references/industryContext';
import { getIndustrySeeds } from '../../../../supabase/functions/install-system/industrySeeds';

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

  type ScaffoldItem = { title: string; description: string; imageUrl?: string };
  const money = (cents: number) => `$${Math.round(cents / 100)}`;
  const sentence = (text: string) => text ? text[0].toUpperCase() + text.slice(1) : text;

  /** Section copy from Unison registries: composition profile, industry context and industry catalog seeds. */
  function sectionContent(contract: AppBuildContract, page: AppBuildContract['topology']['sitePlan']['pages'][number], family: SectionType, pageTitle: string, imageUrl?: string) {
    const industry = String(contract.business.industry ?? contract.design.resolvedSiteDesignContext?.contract.industry ?? '');
    const name = contract.business.businessName;
    const planned = contract.design.compositionPlan.pages.find((candidate) => candidate.pageId === page.id);
    const profile = planned?.profile ?? resolvePageCompositionProfile(industry, page.role);
    const vocabulary = profile.domainVocabulary ?? [];
    const goals = profile.narrativeGoals ?? [];
    const context = getIndustryContext(industry as never);
    const seeds = getIndustrySeeds(industry);
    const owner = contract.business.businessProfile.description?.trim() || contract.business.parameters.description?.trim();
    const intro = owner || (context ? `${context.label} by ${name}. ${goals[0] ? sentence(goals[0]) + '.' : ''}`.trim() : `${name} — ${pageTitle}.`);
    const catalog: ScaffoldItem[] = [
      ...(seeds.services ?? []).map((s) => ({ title: s.name, description: `${s.description} ${s.duration_minutes} min · from ${money(s.price_cents)}` })),
      ...(seeds.menu_items ?? []).map((s) => ({ title: s.name, description: `${s.description} · ${money(s.price_cents)}` })),
      ...(seeds.products ?? []).map((s) => ({ title: s.name, description: s.description ?? `$${s.price}` })),
      ...(seeds.pricing_plans ?? []).map((s) => ({ title: s.name, description: s.description })),
    ];
    const trust: ScaffoldItem[] = (context?.trustSignals ?? []).map((signal) => ({ title: signal, description: `${name}: ${signal.toLowerCase()}.` }));
    const goalItems: ScaffoldItem[] = goals.map((goal, index) => ({ title: sentence(vocabulary[index] ?? goal), description: `${sentence(goal)}.` }));
    const heading = sentence(vocabulary[0] ?? pageTitle);
    const pick = (...lists: ScaffoldItem[][]) => (lists.find((list) => list.length >= 2) ?? lists.flat()).slice(0, 6);
    switch (family) {
      case 'hero':
        return { eyebrow: context?.label ?? pageTitle, title: page.isHome ? name : `${pageTitle} at ${name}`, description: intro, items: pick(catalog, trust) };
      case 'services': case 'pricing': case 'features':
        return { eyebrow: heading, title: family === 'features' ? `Why ${name}` : `${heading} at ${name}`, description: goals[0] ? `${sentence(goals[0])}.` : intro, items: family === 'features' ? pick(trust, goalItems) : pick(catalog, goalItems) };
      case 'gallery':
        return { eyebrow: heading, title: `Inside ${name}`, description: intro, items: imageUrl ? pick(catalog, trust).slice(0, 3).map((item) => ({ ...item, imageUrl })) : [] };
      case 'testimonials':
        return { eyebrow: 'Client words', title: `What people say about ${name}`, description: 'Replace with approved client reviews.', items: trust.slice(0, 3) };
      case 'faq':
        return { eyebrow: 'Questions', title: `Before you visit ${name}`, description: intro, items: pick(goalItems, catalog) };
      case 'cta': case 'contact':
        return { eyebrow: context?.conversionGoals[0] ?? pageTitle, title: context?.conversionGoals[0] ? `${context.conversionGoals[0]} with ${name}` : `Get in touch with ${name}`, description: intro, items: (context?.conversionGoals ?? []).map((goal) => ({ title: goal, description: `${goal} with ${name}.` })) };
      default:
        return { eyebrow: heading, title: family === 'about' ? `About ${name}` : `${heading} — ${name}`, description: intro, items: pick(trust, goalItems, catalog) };
    }
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
      quote: item.description,
      author: item.title,
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
        // Links, buttons, stats and similar lists need owner-approved values; never fill them with filler copy.
        if (['ctas', 'actions', 'stats', 'badges', 'logos', 'links', 'columns', 'socials', 'fields'].includes(name)) continue;
        const fields = (fieldHint ?? '').split('|').filter(Boolean);
        props[name] = content.items.map((item, index) => Object.fromEntries(fields.flatMap((rawField) => {
          const field = rawField.replace(/\?$/, '');
          const isOptional = rawField.endsWith('?');
          if (['title', 'name', 'label'].includes(field)) return [[field, item.title]];
          if (['description', 'text', 'answer', 'body'].includes(field)) return [[field, item.description]];
          if (['question'].includes(field)) return [[field, `${item.title}?`]];
          if (['quote'].includes(field)) return [[field, item.description]];
          if (['author'].includes(field)) return [[field, item.title]];
          if (['alt', 'caption'].includes(field)) return [[field, `${item.title} for ${contract.business.businessName}`]];
          if (['value'].includes(field)) return [[field, String(index + 1)]];
          if (['src', 'image', 'imageUrl', 'url'].includes(field)) return imageUrl ? [[field, imageUrl]] : [];
          if (isOptional) return [];
          return [[field, item.description]];
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
  return <><SiteNav /><main>
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