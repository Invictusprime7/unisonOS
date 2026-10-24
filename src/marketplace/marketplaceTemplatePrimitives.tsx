/* eslint-disable react-refresh/only-export-components */

import { useContext, type ComponentType, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import type { CartItem } from '@/runtime/intentExecutor';
import { MarketplaceCartCountContext } from '@/marketplace/MarketplacePreviewCart';
import { getCapability } from '@/platform/core/capabilityRegistry';
import { getIntentDef, type IntentDef } from '@/platform/core/intentSurfaceRegistry';
import { themePresetToThemeTokens } from '@/components/onboarding/themePresetToTokens';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import type { SectionEntry, ThemeTokens } from '@/sections/types';
import type { PageArchetypeRole } from '@/sections/pageArchetypeContract';

export type MarketplacePreviewSection =
  | SectionEntry<'gallery'>
  | SectionEntry<'blog-preview'>
  | SectionEntry<'features'>
  | SectionEntry<'services'>
  | SectionEntry<'stats'>
  | SectionEntry<'team'>
  | SectionEntry<'testimonials'>
  | SectionEntry<'faq'>
  | SectionEntry<'pricing'>
  | SectionEntry<'cta'>
  | SectionEntry<'contact'>
  | SectionEntry<'navbar'>
  | SectionEntry<'footer'>
  | SectionEntry<'about'>
  | SectionEntry<'before-after'>;

export interface MarketplaceTemplatePage {
  id: string;
  path: string;
  archetype: PageArchetypeRole;
  label: string;
  title: string;
  description: string;
  sections: MarketplacePreviewSection[];
}

export interface MarketplacePreviewProps {
  compact: boolean;
  onIntent: (binding: MarketplaceTemplateBinding) => void;
  templateId: string;
  templateName: string;
  pages: MarketplaceTemplatePage[];
  currentPagePath: string;
  onNavigate: (path: string) => void;
}

export interface MarketplaceTemplateBinding {
  id: string;
  intent: string;
  label: string;
  sourceSection: string;
  sourceSlot: string;
  targetSectionId?: string;
  product?: CartItem;
}

export interface ResolvedMarketplaceTemplateBinding extends MarketplaceTemplateBinding {
  definition: IntentDef;
  capabilities: ReturnType<typeof getCapability>[];
}

export interface AuthoredMarketplaceTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  artDirection: string;
  coverImage: string;
  intentPreviewTheme?: {
    surface: string;
    border: string;
    muted: string;
    button: string;
  };
  theme: ThemeTokens;
  pages: MarketplaceTemplatePage[];
  bindings: MarketplaceTemplateBinding[];
  preview: ComponentType<MarketplacePreviewProps>;
}

export function resolveMarketplaceTemplateBinding(binding: MarketplaceTemplateBinding): ResolvedMarketplaceTemplateBinding {
  const definition = getIntentDef(binding.intent);
  if (!definition || definition.status !== 'stable' || definition.triggerType !== 'user-action') {
    throw new Error(`Marketplace template binding ${binding.id} must target a stable, registered user action.`);
  }

  return {
    ...binding,
    intent: definition.name,
    definition,
    capabilities: (definition.requiredCapabilities ?? []).map((capability) => getCapability(capability)),
  };
}

export function marketplaceBindingAttributes(binding: MarketplaceTemplateBinding) {
  const resolved = resolveMarketplaceTemplateBinding(binding);
  return {
    'data-ut-cta': binding.id,
    'data-ut-intent': resolved.definition.name,
    'data-intent': resolved.definition.name,
    'data-ut-label': binding.label,
    'data-ut-binding-id': binding.id,
    'data-ut-section-role': binding.sourceSection,
    'data-ut-slot': binding.sourceSlot,
  };
}

export function RegistryBoundLink({
  binding,
  href,
  onIntent,
  className,
  children,
}: {
  binding: MarketplaceTemplateBinding;
  href: string;
  onIntent: MarketplacePreviewProps['onIntent'];
  className?: string;
  children: ReactNode;
}) {
  const attributes = marketplaceBindingAttributes(binding);
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (binding.targetSectionId) {
      event.preventDefault();
      const surface = event.currentTarget.closest('[data-marketplace-preview-surface]');
      const target = event.currentTarget.ownerDocument.getElementById(binding.targetSectionId);
      if (surface?.contains(target)) {
        surface.setAttribute('data-marketplace-current-section', binding.targetSectionId);
        if (target && typeof target.scrollIntoView === 'function') {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
    onIntent(binding);
  };

  return <a href={href} className={className} onClick={handleClick} {...attributes}>{children}</a>;
}

export function RegistryBoundButton({
  binding,
  onIntent,
  className,
  type = 'button',
  children,
}: {
  binding: MarketplaceTemplateBinding;
  onIntent: MarketplacePreviewProps['onIntent'];
  className?: string;
  type?: 'button' | 'submit';
  children: ReactNode;
}) {
  const cartCount = useContext(MarketplaceCartCountContext);
  return <button type={type} className={className} onClick={() => onIntent(binding)} {...marketplaceBindingAttributes(binding)}>{children}{binding.intent === 'cart.view' && <output data-ut-cart-count aria-label="Bag item count">{cartCount}</output>}</button>;
}

export function MarketplacePageNavigation({
  templateId,
  templateName,
  pages,
  currentPagePath,
  onNavigate,
  className,
}: {
  templateId: string;
  templateName: string;
  pages: readonly MarketplaceTemplatePage[];
  currentPagePath: string;
  onNavigate: MarketplacePreviewProps['onNavigate'];
  className?: string;
}) {
  const destinations = [{ id: 'home', path: '/', label: 'Home' }, ...pages];
  return (
    <nav aria-label={`${templateName} pages`} className={className}>
      {destinations.map((page) => {
        const binding: MarketplaceTemplateBinding = {
          id: `${templateId}:route:${page.id}`,
          intent: 'nav.goto',
          label: page.label,
          sourceSection: 'navbar',
          sourceSlot: 'page-route',
        };
        return (
          <a
            key={page.id}
            href={page.path}
            {...marketplaceBindingAttributes(binding)}
            data-ut-path={page.path}
            data-ut-target-page-id={page.id}
            aria-current={currentPagePath === page.path ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(page.path);
            }}
            className={`shrink-0 whitespace-nowrap ${currentPagePath === page.path ? 'font-semibold text-current' : 'opacity-70 hover:opacity-100'}`}
          >
            {page.label}
          </a>
        );
      })}
    </nav>
  );
}

export function RegistryBoundForm({
  binding,
  onIntent,
  className,
  children,
}: {
  binding: MarketplaceTemplateBinding;
  onIntent: MarketplacePreviewProps['onIntent'];
  className?: string;
  children: ReactNode;
}) {
  const resolved = resolveMarketplaceTemplateBinding(binding);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onIntent(binding);
  };

  return (
    <form
      className={className}
      data-intent={resolved.definition.name}
      data-ut-intent={resolved.definition.name}
      data-ut-binding-id={binding.id}
      data-ut-section-role={binding.sourceSection}
      data-ut-slot={binding.sourceSlot}
      onSubmit={handleSubmit}
    >
      {children}
    </form>
  );
}

export function getMarketplaceVariantTheme(presetId: string, colors: Partial<ThemeTokens['colors']>): ThemeTokens {
  const preset = THEME_PRESETS.find((candidate) => candidate.id === presetId);
  if (!preset) throw new Error(`Marketplace preview has no theme preset ${presetId}.`);
  const theme = themePresetToThemeTokens(preset);
  return { ...theme, colors: { ...theme.colors, ...colors } };
}
