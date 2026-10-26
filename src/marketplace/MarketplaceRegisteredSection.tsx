import '@/marketplace/marketplaceActions.css';
import type { FormEvent, MouseEvent } from 'react';
import type { ThemeTokens } from '@/sections/types';
import {
  ART_DIRECTION_PACKS,
  buildArtDirectionTokens,
  familyForSection,
  getGenerationVariantsForSection,
  type ArtDirectionPackId,
  type VariantId,
} from '@/sections/variants';
import { getIntentDef } from '@/platform/core/intentSurfaceRegistry';
import { marketplaceBindingAttributes } from '@/marketplace/marketplaceTemplatePrimitives';
import type { AuthoredMarketplaceTemplate, MarketplacePreviewSection, MarketplaceTemplateBinding } from '@/marketplace/marketplaceTemplatePrimitives';
import { withMarketplaceImagePlaceholders } from '@/marketplace/marketplaceImagePlaceholders';

export type MarketplaceRegisteredSectionEntry = MarketplacePreviewSection;

export type MarketplaceSectionVariantSlot =
  | 'gallery' | 'journal' | 'features' | 'services' | 'stats' | 'team'
  | 'testimonials' | 'faq' | 'pricing' | 'cta' | 'contact' | 'navbar' | 'footer' | 'about' | 'before-after';

const SECTION_ROLE: Record<MarketplaceSectionVariantSlot, string> = {
  gallery: 'gallery', journal: 'blog', features: 'home', services: 'services',
  stats: 'home', team: 'about', testimonials: 'home', faq: 'faq', pricing: 'pricing',
  cta: 'home', contact: 'contact', navbar: 'home', footer: 'home',
  about: 'about', 'before-after': 'gallery',
};

function variantSlotForSection(section: MarketplaceRegisteredSectionEntry): MarketplaceSectionVariantSlot {
  return section.type === 'blog-preview' ? 'journal' : section.type;
}

export const MARKETPLACE_TEMPLATE_VARIANT_PROFILES = {
  'sorella-house': {
    artDirectionPackId: 'warm-craft',
    variants: {
      gallery: 'gallery:feature-split',
      services: 'services:product-cards',
      testimonials: 'testimonials:voice',
      faq: 'faq:accordion',
    },
  },
  'formworks-studio': {
    artDirectionPackId: 'swiss-grid',
    variants: {
      gallery: 'gallery:case-study',
      about: 'about:statement',
      stats: 'stats:row',
      testimonials: 'testimonials:grid',
      services: 'services:compact-list',
    },
  },
  'relay-operations': {
    artDirectionPackId: 'glass-tech',
    variants: {
      gallery: 'gallery:cinematic-grid',
      features: 'features:bento-mosaic',
      stats: 'stats:banded-grid',
      faq: 'faq:cards',
      pricing: 'pricing:comparison-table',
    },
  },
  'aster-skin-studio': {
    artDirectionPackId: 'luxury-minimal',
    variants: { gallery: 'gallery:editorial-mosaic', services: 'services:product-cards', team: 'team:profile-cards', testimonials: 'testimonials:editorial', faq: 'faq:accordion' },
  },
  'terra-house': {
    artDirectionPackId: 'soft-editorial',
    variants: { gallery: 'gallery:lightbox-grid', about: 'about:story-panel', stats: 'stats:highlight', testimonials: 'testimonials:voice', faq: 'faq:accordion' },
  },
  'pollen-objects': {
    artDirectionPackId: 'commerce-editorial',
    variants: { gallery: 'gallery:collection-tiles', services: 'services:product-cards', features: 'features:bento-mosaic', testimonials: 'testimonials:marquee', faq: 'faq:cards' },
  },
  'common-ground-fund': {
    artDirectionPackId: 'print-serif',
    variants: { gallery: 'gallery:case-study', stats: 'stats:row', testimonials: 'testimonials:editorial', team: 'team:editorial' },
  },
  'northline-works': {
    artDirectionPackId: 'bold-commercial',
    variants: { gallery: 'gallery:case-study', services: 'services:compact-list', stats: 'stats:bold', testimonials: 'testimonials:grid', faq: 'faq:cards' },
  },
  'tempo-field-club': {
    artDirectionPackId: 'organic-studio',
    variants: { gallery: 'gallery:case-study', services: 'services:editorial-rows', testimonials: 'testimonials:voice', pricing: 'pricing:accordion', team: 'team:lead-spotlight' },
  },
  'openbook-academy': {
    artDirectionPackId: 'mono-terminal',
    variants: { journal: 'blog-preview:horizontal-rail', pricing: 'pricing:comparison-table', team: 'team:profile-cards', stats: 'stats:banded-grid', faq: 'faq:accordion' },
  },
  'lowtide-house': {
    artDirectionPackId: 'editorial-noir',
    variants: { gallery: 'gallery:horizontal-reel', about: 'about:story-panel', pricing: 'pricing:tiers', testimonials: 'testimonials:editorial', team: 'team:editorial' },
  },
  'juniper-frame': {
    artDirectionPackId: 'cinematic-portfolio',
    variants: { gallery: 'gallery:horizontal-reel', about: 'about:editorial-split', testimonials: 'testimonials:rail', pricing: 'pricing:tiers', stats: 'stats:proof-grid' },
  },
} as const satisfies Record<string, {
  artDirectionPackId: ArtDirectionPackId;
  variants: Partial<Record<MarketplaceSectionVariantSlot, VariantId>>;
}>;

interface MarketplaceRegisteredSectionProps {
  templateId: keyof typeof MARKETPLACE_TEMPLATE_VARIANT_PROFILES;
  section: MarketplaceRegisteredSectionEntry;
  variantId?: VariantId;
  theme: ThemeTokens;
  onIntent?: (binding: MarketplaceTemplateBinding) => void;
  pages?: AuthoredMarketplaceTemplate['pages'];
  onNavigate?: (path: string) => void;
}

function interceptJournalLink(
  event: MouseEvent<HTMLDivElement>,
  templateId: string,
  variantId: VariantId,
  section: MarketplaceRegisteredSectionEntry,
  onIntent?: MarketplaceRegisteredSectionProps['onIntent'],
) {
  const target = event.target as HTMLElement | null;
  const link = target?.closest<HTMLAnchorElement>('a[href^="#"]');
  const destination = link?.getAttribute('href')?.slice(1);
  if (!link || !destination || link.hasAttribute('data-ut-cta')) return;

  event.preventDefault();
  const surface = link.closest('[data-marketplace-preview-surface]');
  const sectionTarget = link.ownerDocument.getElementById(destination);
  if (surface?.contains(sectionTarget)) {
    surface.setAttribute('data-marketplace-current-section', destination);
    if (sectionTarget && typeof sectionTarget.scrollIntoView === 'function') {
      sectionTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const definition = getIntentDef('nav.anchor');
  if (!definition) return;
  const label = link.textContent?.trim() || 'Read article';
  const labelSlug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const bindingId = `${templateId}:${variantId}:${labelSlug || 'article-link'}`;
  const binding = {
    id: bindingId,
    intent: definition.name,
    label,
    sourceSection: section.type,
    sourceSlot: 'article-link',
    targetSectionId: destination,
  };

  link.setAttribute('data-ut-cta', binding.id);
  link.setAttribute('data-ut-intent', definition.name);
  link.setAttribute('data-intent', definition.name);
  link.setAttribute('data-ut-label', label);
  link.setAttribute('data-ut-binding-id', binding.id);
  link.setAttribute('data-ut-section-role', binding.sourceSection);
  link.setAttribute('data-ut-slot', binding.sourceSlot);
  onIntent?.(binding);
}

function handlePreviewContactSubmit(
  event: FormEvent<HTMLDivElement>,
  templateId: string,
  section: MarketplaceRegisteredSectionEntry,
  onIntent?: MarketplaceRegisteredSectionProps['onIntent'],
) {
  if (section.type !== 'contact') return;
  const form = (event.target as HTMLElement | null)?.closest('form');
  if (!form) return;

  event.preventDefault();
  event.stopPropagation();
  onIntent?.({
    id: `${templateId}:${section.id}:submit`,
    intent: section.props.submitIntent || 'contact.submit',
    label: section.props.submitLabel || 'Send message',
    sourceSection: 'contact',
    sourceSlot: 'contact-submit',
  });
}

function handlePreviewRouteNavigation(
  event: MouseEvent<HTMLDivElement>,
  templateId: string,
  section: MarketplaceRegisteredSectionEntry,
  pages: AuthoredMarketplaceTemplate['pages'] | undefined,
  onNavigate: MarketplaceRegisteredSectionProps['onNavigate'],
) {
  if (section.type !== 'navbar' || !pages || !onNavigate) return;
  const anchor = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href]');
  const href = anchor?.getAttribute('href');
  if (!anchor || !href) return;
  const path = href.startsWith('/') ? href : new URL(href, anchor.ownerDocument.baseURI).pathname;
  if (path !== '/' && !pages.some((page) => page.path === path)) return;

  event.preventDefault();
  event.stopPropagation();
  const page = pages.find((candidate) => candidate.path === path);
  const binding = {
    id: `${templateId}:route:${page?.id ?? 'home'}`,
    intent: 'nav.goto',
    label: page?.label ?? 'Home',
    sourceSection: 'navbar',
    sourceSlot: 'page-route',
  } satisfies MarketplaceTemplateBinding;
  for (const [name, value] of Object.entries(marketplaceBindingAttributes(binding))) {
    anchor.setAttribute(name, value);
  }
  onNavigate(path);
}

export function MarketplaceRegisteredSection({
  templateId,
  section,
  variantId: requestedVariantId,
  theme,
  onIntent,
  pages,
  onNavigate,
}: MarketplaceRegisteredSectionProps) {
  const profile = MARKETPLACE_TEMPLATE_VARIANT_PROFILES[templateId];
  const slot = variantSlotForSection(section);
  const role = SECTION_ROLE[slot];
  const pack = ART_DIRECTION_PACKS[profile.artDirectionPackId];
  const eligibleVariants = getGenerationVariantsForSection(
    section.type,
    pack,
    role,
  );
  const preferredVariantId = familyForSection(pack, section.type)
    .find((candidateId) => eligibleVariants.some((candidate) => candidate.id === candidateId));
  const variantId = profile.variants[slot] ?? requestedVariantId ?? preferredVariantId ?? eligibleVariants[0]?.id;
  if (!variantId) throw new Error(`Marketplace template ${templateId} has no registered ${slot} section layout.`);
  if (requestedVariantId && requestedVariantId !== variantId) throw new Error(`Marketplace section ${section.id} must use ${variantId}.`);
  const variant = eligibleVariants.find((candidate) => candidate.id === variantId);

  if (!variant || variant.sectionType !== section.type) {
    throw new Error(`Marketplace variant ${variantId} is not certified for ${templateId} ${role}.`);
  }

  const packTokens = buildArtDirectionTokens(pack);
  // Sealed-pack geometry wins over the colour preset, exactly as Stage 4b does for App Builder sites.
  const packTheme: ThemeTokens = {
    ...theme,
    radius: packTokens['--ut-radius-base'],
    sectionPadding: `var(--ut-rhythm-space, ${packTokens['--ut-rhythm-space']}) var(--ut-inline-gutter, ${packTokens['--ut-inline-gutter']})`,
  };
  const VariantComponent = eligibleVariants.find((variant) => variant.id === variantId)?.component;
  if (!VariantComponent) throw new Error(`Marketplace variant ${variantId} has no registered renderer.`);

  return (
    <div
      data-ut-section-type={section.type}
      data-ut-variant-id={variantId}
      data-ut-marketplace-geometry=""
      style={{ ['--ut-marketplace-radius' as string]: packTokens['--ut-radius-base'] }}
      onClickCapture={(event) => {
        const control = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-ut-intent]');
        const intent = control?.getAttribute('data-ut-intent');
        if (control && intent === 'cart.add' && section.type === 'services') {
          const article = control.closest('article');
          const index = Array.from(event.currentTarget.querySelectorAll('article')).findIndex((entry) => entry === article);
          const item = section.props.items[index];
          if (item) {
            event.preventDefault();
            event.stopPropagation();
            const binding = {
              id: `${templateId}:${section.id}:product:${index}`,
              intent,
              label: item.title,
              sourceSection: section.id,
              sourceSlot: `product:${index}`,
              product: {
                productId: `${templateId}:${section.id}:${index}`,
                name: item.title,
                price: Number.parseFloat(String(item.price ?? '0').replace(/[^\d.]/g, '')) || 0,
                quantity: 1,
              },
            } satisfies MarketplaceTemplateBinding;
            onIntent?.(binding);
            return;
          }
        }
        handlePreviewRouteNavigation(event, templateId, section, pages, onNavigate);
        interceptJournalLink(event, templateId, variantId, section, onIntent);
      }}
      onSubmitCapture={(event) => handlePreviewContactSubmit(event, templateId, section, onIntent)}
    >
      <VariantComponent section={withMarketplaceImagePlaceholders(templateId, section)} theme={packTheme} />
    </div>
  );
}