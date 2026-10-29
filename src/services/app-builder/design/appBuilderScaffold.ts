import type { AppBuildContract } from '../appBuilderContracts';
import type { SectionType } from '@/sections/types';
import { verifiedPhotosFor } from './pageStructureGate';

const SCAFFOLD_SECTION_PATH = '/src/project-components/AppBuilderScaffoldSection.tsx';

const ROLE_SECTIONS: Record<string, readonly SectionType[]> = {
  home: ['hero', 'features', 'services'],
  landing: ['hero', 'features'],
  about: ['about', 'team'],
  service: ['services', 'features'],
  services: ['services', 'features'],
  contact: ['contact', 'faq'],
  shop: ['gallery', 'features'],
  checkout: ['pricing', 'contact'],
  booking: ['services', 'contact'],
  gallery: ['gallery', 'features'],
  pricing: ['pricing', 'faq'],
};

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

function renderPage(contract: AppBuildContract, page: AppBuildContract['topology']['sitePlan']['pages'][number], imageUrl?: string): string {
  const pageId = page.id;
  const role = page.role.toLowerCase();
  const families = ROLE_SECTIONS[role] ?? ['about', 'features'];
  const description = contract.business.businessProfile.description?.trim()
    || contract.business.parameters.description?.trim()
    || `A starter page for ${contract.business.businessName}.`;
  const actions = actionMarkup(contract, pageId);
  const sections = families.map((family, index) => {
    const sectionId = `${pageId}:${family}:${index}`;
    const variantId = `custom:${family}-scaffold`;
    const title = family === 'hero' ? `Welcome to ${contract.business.businessName}` : page.title;
    const sectionDescription = index === 0 ? description : `Explore ${contract.business.businessName}.`;
    const props = {
      eyebrow: page.title,
      title,
      description: sectionDescription,
      ...(index === 0 && imageUrl ? { imageUrl } : {}),
      headingLevel: page.isHome && index === 0 ? 'h1' : 'h2',
    };
    return `<section data-ut-section-id=${JSON.stringify(sectionId)} data-ut-section-type=${JSON.stringify(family)} data-ut-variant=${JSON.stringify(variantId)}>
      <ScaffoldSection sectionId=${JSON.stringify(sectionId)} variantId=${JSON.stringify(variantId)} props={${JSON.stringify(props)}} />
      ${index === 0 ? actions.join('\n      ') : ''}
    </section>`;
  });

  return `import React from "react";
import { SiteNav } from "@/project-components/site/SiteNav";
import { SiteFooter } from "@/project-components/site/SiteFooter";
import ScaffoldSection from "@/project-components/AppBuilderScaffoldSection";

export default function ${page.isHome ? 'Home' : `Page${pageId.replace(/[^a-zA-Z0-9]/g, '')}`}() {
  return <><SiteNav /><main className="mx-auto w-full max-w-6xl space-y-10 px-6 py-10">
    ${sections.join('\n    ')}
  </main><SiteFooter /></>;
}
`;
}

/** Build a clearly non-AI starter from canonical pages, active bindings, and public profile facts. */
export function materializeDeterministicAppBuilderScaffold(contract: AppBuildContract): Record<string, string> {
  const pages = contract.topology.sitePlan.pages;
  const photos = verifiedPhotosFor(contract.design.resolvedSiteDesignContext.contract.industry);
  const image = photos[0];
  return {
    [SCAFFOLD_SECTION_PATH]: `import React from "react";

interface ScaffoldSectionProps {
  sectionId: string;
  variantId: string;
  props: { eyebrow: string; title: string; description: string; imageUrl?: string; headingLevel: "h1" | "h2" };
}

export default function ScaffoldSection({ props }: ScaffoldSectionProps) {
  const Heading = props.headingLevel;
  return <div className="grid items-center gap-8 md:grid-cols-2">
    <div className="space-y-4">
      <p className="text-sm font-medium text-muted-foreground">{props.eyebrow}</p>
      <Heading className="text-3xl font-semibold tracking-normal text-foreground">{props.title}</Heading>
      <p className="max-w-prose text-base leading-7 text-muted-foreground">{props.description}</p>
    </div>
    {props.imageUrl ? <img src={props.imageUrl} alt="" className="aspect-[4/3] w-full rounded-md object-cover" /> : null}
  </div>;
}
`,
    ...Object.fromEntries(pages.map((page, index) => [
      page.filePath,
      renderPage(contract, page, image ? photos[index % Math.max(1, photos.length)] : undefined),
    ])),
  };
}