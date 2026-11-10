import type { ArtDirectionPackId } from '@/sections/variants/artDirectionPacks';
import type { VariantId } from '@/sections/variants/types';

export const WIZARD_DESIGN_SELECTION_VERSION = '1.0' as const;

export type WizardDesignSelectionMode = 'auto' | 'guided' | 'custom';
export type WizardExperiencePreference = 'standard' | 'motion-rich' | 'immersive';

/**
 * Canonical Wizard control layer over the existing Variant Registry.
 * It is selection state only: packs and variants remain registry-owned.
 */
export interface WizardDesignSelection {
  version: typeof WIZARD_DESIGN_SELECTION_VERSION;
  mode: WizardDesignSelectionMode;
  artDirectionPackId?: ArtDirectionPackId;
  experience: WizardExperiencePreference;
  /** Stable section instance id -> certified registry implementation id. */
  sectionPins: Record<string, VariantId>;
  /**
   * Page route -> section type -> certified implementation id. The
   * conversational equivalent of picking a layout for one page only
   * ("on the gallery page, use masonry"). Site-wide choices stay in sectionPins.
   */
  routePins?: Record<string, Record<string, VariantId>>;
}

export function createWizardDesignSelection(
  input: Partial<Omit<WizardDesignSelection, 'version'>> = {},
): WizardDesignSelection {
  return {
    version: WIZARD_DESIGN_SELECTION_VERSION,
    mode: input.mode ?? (input.artDirectionPackId ? 'guided' : 'auto'),
    artDirectionPackId: input.artDirectionPackId,
    experience: input.experience ?? 'standard',
    sectionPins: { ...(input.sectionPins ?? {}) },
    ...(input.routePins && Object.keys(input.routePins).length
      ? { routePins: Object.fromEntries(Object.entries(input.routePins).map(([route, pins]) => [route, { ...pins }])) }
      : {}),
  };
}