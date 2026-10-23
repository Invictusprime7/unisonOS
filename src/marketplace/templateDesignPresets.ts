import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { ART_DIRECTION_PACKS, type ArtDirectionPackId } from '@/sections/variants/artDirectionPacks';

export interface MarketplaceTemplateDesignPreset {
  themePresetId: string;
  artDirectionPackId: ArtDirectionPackId;
}

export const MARKETPLACE_TEMPLATE_DESIGN_PRESETS: Readonly<Record<string, MarketplaceTemplateDesignPreset>> = {
  'agency-bold': { themePresetId: 'bold', artDirectionPackId: 'brutalist-poster' },
  'agency-consulting': { themePresetId: 'minimalist', artDirectionPackId: 'swiss-grid' },
  'agency-editorial': { themePresetId: 'editorial', artDirectionPackId: 'print-serif' },
  'coaching-premium': { themePresetId: 'organic', artDirectionPackId: 'warm-craft' },
  'coaching-fitness': { themePresetId: 'bold', artDirectionPackId: 'bold-commercial' },
  'coaching-mindful': { themePresetId: 'organic', artDirectionPackId: 'soft-editorial' },
  'nonprofit-premium': { themePresetId: 'editorial', artDirectionPackId: 'soft-editorial' },
  'portfolio-photography': { themePresetId: 'editorial', artDirectionPackId: 'cinematic-portfolio' },
  'portfolio-designer': { themePresetId: 'modern', artDirectionPackId: 'swiss-grid' },
  'portfolio-architect': { themePresetId: 'minimalist', artDirectionPackId: 'swiss-grid' },
  'restaurant-premium': { themePresetId: 'organic', artDirectionPackId: 'warm-craft' },
  'restaurant-casual': { themePresetId: 'modern', artDirectionPackId: 'warm-craft' },
  'restaurant-fine-dining': { themePresetId: 'editorial', artDirectionPackId: 'editorial-noir' },
  'saas-dark': { themePresetId: 'futuristic', artDirectionPackId: 'neon-grid' },
  'saas-light': { themePresetId: 'modern', artDirectionPackId: 'glass-tech' },
  'saas-developer': { themePresetId: 'minimalist', artDirectionPackId: 'mono-terminal' },
  'salon-premium': { themePresetId: 'editorial', artDirectionPackId: 'luxury-minimal' },
  'salon-minimal': { themePresetId: 'minimalist', artDirectionPackId: 'swiss-grid' },
  'salon-organic': { themePresetId: 'organic', artDirectionPackId: 'organic-studio' },
  'store-premium': { themePresetId: 'modern', artDirectionPackId: 'commerce-editorial' },
  'store-minimal': { themePresetId: 'minimalist', artDirectionPackId: 'commerce-editorial' },
  'store-boutique': { themePresetId: 'organic', artDirectionPackId: 'warm-craft' },
  'local-service-premium': { themePresetId: 'modern', artDirectionPackId: 'bold-commercial' },
  'contractor-premium': { themePresetId: 'bold', artDirectionPackId: 'bold-commercial' },
  'real-estate-premium': { themePresetId: 'editorial', artDirectionPackId: 'luxury-minimal' },
};

export function getMarketplaceTemplateDesignPreset(templateId: string): MarketplaceTemplateDesignPreset {
  const designPreset = MARKETPLACE_TEMPLATE_DESIGN_PRESETS[templateId];
  if (
    !designPreset
    || !THEME_PRESETS.some((preset) => preset.id === designPreset.themePresetId)
    || !ART_DIRECTION_PACKS[designPreset.artDirectionPackId]
  ) {
    throw new Error(`Marketplace template ${templateId} has no registered design recommendation.`);
  }
  return designPreset;
}

export function getMarketplaceTemplateStylePresetId(templateId: string): string {
  return getMarketplaceTemplateDesignPreset(templateId).themePresetId;
}