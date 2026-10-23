import type { SectionEntry, TemplateComposition } from '../types';
import { PORTFOLIO_COMPOSITIONS } from './portfolio';
import { GENERATED_INDUSTRY_DEFAULT_COMPOSITIONS } from './industryDefaultRegistry';

interface ProfileTemplateDerivation {
  id: string;
  source: TemplateComposition | undefined;
  name: string;
  brand: string;
  description: string;
  industry: string;
  category: string;
  systemType: string;
  pageRoles: NonNullable<TemplateComposition['pageRoles']>;
  tags: string[];
}

const DERIVATIONS: ProfileTemplateDerivation[] = [
  {
    id: 'profile-derived-modernist-studio',
    source: PORTFOLIO_COMPOSITIONS.find((template) => template.id === 'portfolio-photography'),
    name: 'Modernist Studio Portfolio',
    brand: 'Modernist Studio',
    description: 'A restrained creative portfolio with dedicated services, work, and booking routes.',
    industry: 'portfolio',
    category: 'portfolio',
    systemType: 'portfolio',
    pageRoles: ['services', 'gallery', 'booking'],
    tags: ['portfolio', 'minimalist', 'profile-derived', 'multi-page'],
  },
  {
    id: 'profile-derived-warm-property-collection',
    source: GENERATED_INDUSTRY_DEFAULT_COMPOSITIONS.find((template) => template.id === 'real-estate-premium'),
    name: 'Warm Property Collection',
    brand: 'Warm Property Collection',
    description: 'An editorial property showcase with services, listings, about, and contact routes.',
    industry: 'realestate',
    category: 'realestate',
    systemType: 'agency',
    pageRoles: ['services', 'gallery', 'about', 'contact'],
    tags: ['real-estate', 'editorial', 'profile-derived', 'multi-page'],
  },
];

function rebrand(value: unknown, brand: string): unknown {
  if (Array.isArray(value)) return value.map((item) => rebrand(item, brand));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    key === 'brand' && typeof child === 'string' ? brand : rebrand(child, brand),
  ]));
}

function rebrandSections(sections: readonly SectionEntry[], brand: string): SectionEntry[] {
  return rebrand(sections, brand) as SectionEntry[];
}

function deriveTemplate(source: ProfileTemplateDerivation): TemplateComposition {
  if (!source.source) throw new Error(`Profile-derived template ${source.id} has no Unison registry composition.`);

  const pageCompositions = Object.fromEntries(
    Object.entries(source.source.pageCompositions ?? {}).map(([role, composition]) => [role, {
      ...composition,
      sections: rebrandSections(composition.sections, source.brand),
    }]),
  ) as TemplateComposition['pageCompositions'];

  return {
    ...source.source,
    id: source.id,
    name: source.name,
    description: source.description,
    industry: source.industry,
    category: source.category,
    systemType: source.systemType,
    pageRoles: source.pageRoles,
    tags: source.tags,
    sections: rebrandSections(source.source.sections, source.brand),
    pageCompositions,
  };
}

// Private project copy, business identifiers, and external assets are not reused.
export const PROFILE_DERIVED_COMPOSITIONS: TemplateComposition[] = DERIVATIONS.map(deriveTemplate);