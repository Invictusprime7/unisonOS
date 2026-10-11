import { familyIdFromThemePreset, familyOfPack, qualifiedPackRef } from '@/sections/variants/artDirectionFamilies';
import { validateAIPageComposition, COMPOSITION_ROLES, type AIPageCompositionPlan } from '@/sections/aiPageComposition';
import type { BusinessModel, IndustryOverlay } from '@/types/playground';
import { getCompositionById } from '@/sections/templates';
import { getGenerationVariantsForSection, getVariantById, getVariantIdForLayout, getVariantsForSection, resolveExperienceRequirement, familyForSection } from '@/sections/variants';
import type { ActiveVariantMap, VariantId } from '@/sections/variants';
import {
  childSeed,
  deriveDesignSeed,
  seededRotate,
} from '@/platform/core/generationSeed';
import {
  ART_DIRECTION_PACKS,
  isArtDirectionPackId,
  resolveArtDirectionPackId,
  type ArtDirectionPackId,
} from '@/sections/variants/artDirectionPacks';
import {
  describeExperienceEnvelope,
  resolveExperienceEnvelope,
  EXPERIENCE_ENVELOPE_VERSION,
  type ExperienceEnvelope,
} from '@/services/experienceCapabilityResolver';
import type {
  VocabularyDensity,
  VocabularySymmetry,
  VocabularyVisualDominance,
  VocabularyMotionIntensity,
} from '@/platform/core/designVocabulary';
import { getDesignImplementation, getImplementationVocabularyRefs } from '@/services/designImplementationRegistry';
import { resolveAvailableAutoArtDirectionPackId } from '@/services/wizardDesignAvailability';
import { selectAffineVariant } from '@/sections/compositionAffinity';




export const WIZARD_DESIGN_INTERVENTION_VERSION = '2.0' as const;
/** Briefs written before the Phase 2 design brief existed. Migrated on read. */
const LEGACY_INTERVENTION_VERSIONS = new Set(['1.0']);


export type WizardMotionRecipe =
  | 'editorial-reveal'
  | 'product-focus'
  | 'service-progressive-disclosure'
  | 'proof-led-stagger'
  | 'gallery-inspection'
  | 'conversion-feedback';

export type WizardSectionVariant =
  | 'collage-hero'
  | 'split-media-hero'
  | 'proof-hero'
  | 'bento-services'
  | 'comparison-services'
  | 'testimonial-rail'
  | 'pricing-accordion'
  | 'gallery-lightbox'
  | 'conversion-form';

/** Experience (3D/WebGL) recipes Lane B may compose from @/unison/ui/experience. */
export type WizardExperienceRecipe =
  | 'immersive-hero'
  | 'product-stage'
  | 'floating-media'
  | 'depth-gallery'
  | 'particle-ambience'
  | 'scene-backdrop'
  | 'model-showcase';

export type WizardExperienceBudget = 'none' | 'accent' | 'immersive';

/**
 * Phase 2 art-direction brief. This is what turns Lane B from "make something
 * premium" into an actual design commission: archetype, composition rules,
 * typography contrast, media treatment, motion intensity and experience budget.
 */
export interface WizardArtDirectionBrief {
  visualArchetype: string;
  composition: {
    symmetry: VocabularySymmetry;
    density: VocabularyDensity;
    sectionRhythm: 'uniform' | 'variable';
    heroScale: 'contained' | 'generous' | 'monumental';
  };
  typography: {
    contrast: 'subtle' | 'strong' | 'extreme';
    displayTreatment: 'restrained' | 'balanced' | 'oversized';
  };
  media: {
    dominance: VocabularyVisualDominance;
    cropping: 'uniform' | 'editorial';
    treatments: string[];
  };
  motion: {
    intensity: VocabularyMotionIntensity;
    scrollLinked: boolean;
  };
  experience: {
    webglEligible: boolean;
    canvasBudget: number;
  };
}



export interface WizardDesignIntervention {
  compositionPlan?: AIPageCompositionPlan;
  version: typeof WIZARD_DESIGN_INTERVENTION_VERSION;
  source: 'deterministic-baseline';
  seed: string;
  industry: string;
  businessModel: BusinessModel;
  templateId: string | null;
  themePresetId: string;
  /**
   * Resolved ONCE here and sealed onto the snapshot. Every downstream layer
   * (CSS emission, compiler, Lane B brief, previewer, export) reads this id
   * back instead of re-deriving art direction — one truth, no drift.
   */
  artDirectionPackId: ArtDirectionPackId;

  layoutRecipe: 'floating-navbar' | 'collage-hero' | 'bento-features' | 'media-card-grid' | 'conversion-form' | 'rich-footer';
  sectionVariants: WizardSectionVariant[];
  /** Stable section instance id -> registry-owned visual variant id. */
  activeVariants: ActiveVariantMap;
  motionRecipes: WizardMotionRecipe[];
  interactionRecipes: Array<'mobile-nav-dialog' | 'image-lightbox' | 'accordion' | 'tabs'>;
  motionBudget: 'restrained' | 'expressive';
  /** Sealed experience-layer plan; the preflight gate budgets against it. */
  experienceRecipes: WizardExperienceRecipe[];
  experienceBudget: WizardExperienceBudget;
  /** Absent on existing projects until an explicit composition upgrade. */
  compositionPolicy?: 'maximum-compatible';
  /** Phase 2: the constrained vocabulary Lane B may compose from. */
  envelope: ExperienceEnvelope;
  /** Phase 2: the art-direction brief handed to Lane B. */
  brief: WizardArtDirectionBrief;
  aiDirective: string;
}


export interface WizardDesignInterventionInput {
  compositionPlan?: AIPageCompositionPlan;
  businessName: string;
  businessModel: BusinessModel;
  industryOverlay?: IndustryOverlay | string | null;
  templateId?: string | null;
  themePresetId: string;
  /** Launch identity only — never participates in a design decision. */
  wizardSeedId?: string | null;
  /** Set only when the user intentionally asks for another take. */
  regenerationNonce?: string | null;

  /** Wizard goal + page selections participate in the generation seed. */
  primaryGoal?: string | null;
  secondaryGoals?: readonly string[] | null;
  requestedPages?: readonly string[] | null;
  projectId?: string | null;
  needsBooking?: boolean;
  sellsProducts?: boolean;
  wantsLeadCapture?: boolean;
  needsImmersive?: boolean;
  designSelection?: import('@/services/wizardDesignSelection').WizardDesignSelection;
}

const LAYOUT_RECIPES = new Set<WizardDesignIntervention['layoutRecipe']>([
  'floating-navbar', 'collage-hero', 'bento-features', 'media-card-grid', 'conversion-form', 'rich-footer',
]);
const SECTION_VARIANTS = new Set<WizardSectionVariant>([
  'collage-hero', 'split-media-hero', 'proof-hero', 'bento-services', 'comparison-services',
  'testimonial-rail', 'pricing-accordion', 'gallery-lightbox', 'conversion-form',
]);
const MOTION_RECIPES = new Set<WizardMotionRecipe>([
  'editorial-reveal', 'product-focus', 'service-progressive-disclosure', 'proof-led-stagger',
  'gallery-inspection', 'conversion-feedback',
]);
const INTERACTION_RECIPES = new Set<WizardDesignIntervention['interactionRecipes'][number]>([
  'mobile-nav-dialog', 'image-lightbox', 'accordion', 'tabs',
]);
const EXPERIENCE_RECIPES = new Set<WizardExperienceRecipe>([
  'immersive-hero', 'product-stage', 'floating-media', 'depth-gallery',
  'particle-ambience', 'scene-backdrop', 'model-showcase',
]);
const EXPERIENCE_BUDGETS = new Set<WizardExperienceBudget>(['none', 'accent', 'immersive']);

const MODEL_EXPERIENCE: Record<BusinessModel, { recipes: WizardExperienceRecipe[]; budget: WizardExperienceBudget }> = {
  appointment_service: { recipes: ['scene-backdrop', 'floating-media'], budget: 'accent' },
  quote_lead: { recipes: ['scene-backdrop'], budget: 'accent' },
  ecommerce: { recipes: ['product-stage', 'immersive-hero', 'depth-gallery'], budget: 'immersive' },
  portfolio_creator: { recipes: ['immersive-hero', 'depth-gallery', 'floating-media'], budget: 'immersive' },
  restaurant_hospitality: { recipes: ['immersive-hero', 'floating-media'], budget: 'accent' },
  saas_digital: { recipes: ['particle-ambience', 'immersive-hero'], budget: 'accent' },
  nonprofit: { recipes: ['scene-backdrop'], budget: 'accent' },
  general: { recipes: ['scene-backdrop'], budget: 'accent' },
};

const MOTION_BUDGETS = new Set<WizardDesignIntervention['motionBudget']>(['restrained', 'expressive']);

function hasOnlyAllowedValues<T extends string>(values: unknown, allowed: Set<T>): values is T[] {
  return Array.isArray(values) && values.every((value) => typeof value === 'string' && allowed.has(value as T));
}

/** Reads only the versioned design brief emitted by the canonical pipeline. */
export function readWizardDesignIntervention(
  files: Record<string, string> | null | undefined,
): WizardDesignIntervention | null {
  const raw = files?.['/.unison/design-intervention.json'];
  if (!raw) return null;
  try {
    const intervention = JSON.parse(raw) as Partial<WizardDesignIntervention>;
    if (
      (intervention.version !== WIZARD_DESIGN_INTERVENTION_VERSION &&
        !LEGACY_INTERVENTION_VERSIONS.has(String(intervention.version))) ||
      intervention.source !== 'deterministic-baseline' ||
      typeof intervention.layoutRecipe !== 'string' ||
      !LAYOUT_RECIPES.has(intervention.layoutRecipe as WizardDesignIntervention['layoutRecipe']) ||
      !hasOnlyAllowedValues(intervention.sectionVariants, SECTION_VARIANTS) ||
      (intervention.activeVariants !== undefined && (
        !intervention.activeVariants ||
        typeof intervention.activeVariants !== 'object' ||
        Object.values(intervention.activeVariants).some((variantId) => (
          typeof variantId !== 'string' || !getVariantById(variantId as VariantId)
        ))
      )) ||
      !hasOnlyAllowedValues(intervention.motionRecipes, MOTION_RECIPES) ||
      !hasOnlyAllowedValues(intervention.interactionRecipes, INTERACTION_RECIPES) ||
      !MOTION_BUDGETS.has(intervention.motionBudget as WizardDesignIntervention['motionBudget']) ||
      typeof intervention.aiDirective !== 'string' ||
      (intervention.experienceRecipes !== undefined &&
        !hasOnlyAllowedValues(intervention.experienceRecipes, EXPERIENCE_RECIPES)) ||
      (intervention.experienceBudget !== undefined &&
        !EXPERIENCE_BUDGETS.has(intervention.experienceBudget as WizardExperienceBudget))
    ) {
      return null;
    }
    if (!intervention.experienceRecipes || !intervention.experienceBudget) {
      // Legacy brief written before the experience layer existed.
      const baseline = MODEL_EXPERIENCE[intervention.businessModel as BusinessModel] ?? MODEL_EXPERIENCE.general;
      intervention.experienceRecipes = intervention.experienceRecipes ?? [...baseline.recipes];
      intervention.experienceBudget = intervention.experienceBudget ?? baseline.budget;
    }
    if (!intervention.activeVariants) {
      intervention.activeVariants = buildActiveVariants(intervention.templateId, intervention.seed || 'legacy', undefined, intervention.industry);
    }
    if (!isArtDirectionPackId(intervention.artDirectionPackId)) {
      // Legacy brief written before art direction was sealed — re-derive it
      // from the SAME inputs so the result is identical to a fresh compile.
      intervention.artDirectionPackId = resolveArtDirectionPackId({
        industry: intervention.industry,
        themePresetId: intervention.themePresetId,
        seed: intervention.seed,
      });
    }
    // Phase 2 migration: a v1 brief carries no envelope/art-direction brief.
    // Re-derive them from the SAME sealed inputs so a hydrated draft resolves
    // exactly what a fresh compile of those selections would.
    if (
      !intervention.envelope ||
      intervention.envelope.version !== EXPERIENCE_ENVELOPE_VERSION ||
      !intervention.brief
    ) {
      const model = (intervention.businessModel as BusinessModel) || 'general';
      const envelope = resolveExperienceEnvelope({
        seed: intervention.seed || 'legacy',
        businessModel: model,
        industry: intervention.industry || 'general',
        templateId: intervention.templateId,
        themePresetId: intervention.themePresetId,
        styleIntent: intervention.themePresetId,
        disallowWebgl: intervention.experienceBudget === 'none',
      });
      intervention.envelope = envelope;
      intervention.brief = buildArtDirectionBrief(envelope, intervention.artDirectionPackId);
    }
    intervention.version = WIZARD_DESIGN_INTERVENTION_VERSION;
    return intervention as WizardDesignIntervention;



  } catch {
    return null;
  }
}

const MODEL_RECIPES: Record<BusinessModel, Omit<WizardDesignIntervention, 'version' | 'source' | 'seed' | 'industry' | 'businessModel' | 'templateId' | 'themePresetId' | 'activeVariants' | 'aiDirective' | 'artDirectionPackId' | 'experienceRecipes' | 'experienceBudget' | 'envelope' | 'brief'>> = {
  appointment_service: {
    layoutRecipe: 'collage-hero', sectionVariants: ['split-media-hero', 'bento-services', 'testimonial-rail', 'conversion-form'],
    motionRecipes: ['service-progressive-disclosure', 'proof-led-stagger', 'conversion-feedback'], interactionRecipes: ['mobile-nav-dialog', 'accordion'], motionBudget: 'restrained',
  },
  quote_lead: {
    layoutRecipe: 'bento-features', sectionVariants: ['proof-hero', 'comparison-services', 'testimonial-rail', 'conversion-form'],
    motionRecipes: ['proof-led-stagger', 'service-progressive-disclosure', 'conversion-feedback'], interactionRecipes: ['mobile-nav-dialog', 'accordion'], motionBudget: 'restrained',
  },
  ecommerce: {
    layoutRecipe: 'media-card-grid', sectionVariants: ['split-media-hero', 'bento-services', 'gallery-lightbox', 'pricing-accordion'],
    motionRecipes: ['product-focus', 'gallery-inspection', 'conversion-feedback'], interactionRecipes: ['mobile-nav-dialog', 'image-lightbox', 'tabs'], motionBudget: 'expressive',
  },
  portfolio_creator: {
    layoutRecipe: 'collage-hero', sectionVariants: ['collage-hero', 'gallery-lightbox', 'testimonial-rail', 'conversion-form'],
    motionRecipes: ['editorial-reveal', 'gallery-inspection', 'proof-led-stagger'], interactionRecipes: ['mobile-nav-dialog', 'image-lightbox'], motionBudget: 'expressive',
  },
  restaurant_hospitality: {
    layoutRecipe: 'rich-footer', sectionVariants: ['collage-hero', 'bento-services', 'gallery-lightbox', 'conversion-form'],
    motionRecipes: ['editorial-reveal', 'gallery-inspection', 'conversion-feedback'], interactionRecipes: ['mobile-nav-dialog', 'image-lightbox', 'tabs'], motionBudget: 'expressive',
  },
  saas_digital: {
    layoutRecipe: 'bento-features', sectionVariants: ['proof-hero', 'bento-services', 'pricing-accordion', 'conversion-form'],
    motionRecipes: ['proof-led-stagger', 'service-progressive-disclosure', 'conversion-feedback'], interactionRecipes: ['mobile-nav-dialog', 'tabs', 'accordion'], motionBudget: 'restrained',
  },
  nonprofit: {
    layoutRecipe: 'rich-footer', sectionVariants: ['proof-hero', 'testimonial-rail', 'gallery-lightbox', 'conversion-form'],
    motionRecipes: ['editorial-reveal', 'proof-led-stagger', 'conversion-feedback'], interactionRecipes: ['mobile-nav-dialog', 'image-lightbox'], motionBudget: 'restrained',
  },
  general: {
    layoutRecipe: 'conversion-form', sectionVariants: ['split-media-hero', 'bento-services', 'testimonial-rail', 'conversion-form'],
    motionRecipes: ['editorial-reveal', 'proof-led-stagger', 'conversion-feedback'], interactionRecipes: ['mobile-nav-dialog', 'accordion'], motionBudget: 'restrained',
  },
};

function buildActiveVariants(templateId: string | null | undefined, seed: string, packId?: ArtDirectionPackId, industry?: string | null): ActiveVariantMap {
  const composition = templateId ? getCompositionById(templateId) : null;
  if (!composition) return {};

  return Object.fromEntries(composition.sections.flatMap((section) => {
    const candidates = getGenerationVariantsForSection(section.type, packId ? ART_DIRECTION_PACKS[packId] : undefined, 'home');
    if (!candidates.length) throw new Error('No certified 21st implementation for ' + section.type);
    const layout = (section.props as { layout?: string }).layout;
    const baselineVariantId = section.variantId ?? getVariantIdForLayout(section.type, layout);
    // Affinity ranks the legal candidates (art direction order, industry
    // dialect, page role, provenance); the seed only decides among the
    // implementations that tie at the top, so selection stays deterministic
    // without being arbitrary.
    const selected = selectAffineVariant(candidates, `${seed}|${section.id}`, {
      packId, industry, role: 'home', baselineVariantId,
      neighbors: composition.sections.map((entry) => entry.type),
    })?.id;
    return selected ? [[section.id, selected]] : [];
  })) as Record<string, VariantId>;
}


/**
 * The art-direction brief. Derived ONLY from the sealed envelope + art
 * direction pack so every hydration path (fresh compile, legacy migration,
 * recompile) resolves the identical brief.
 */
export function buildArtDirectionBrief(
  envelope: ExperienceEnvelope,
  artDirectionPackId: ArtDirectionPackId,
): WizardArtDirectionBrief {
  const pack = ART_DIRECTION_PACKS[artDirectionPackId];
  const expressive = envelope.motion === 'expressive';
  const oversized = envelope.typographyScale === 'oversized';

  return {
    visualArchetype: `${artDirectionPackId}/${envelope.layoutSymmetry}-${envelope.visualDominance}-dominance`,
    composition: {
      symmetry: envelope.layoutSymmetry,
      density: envelope.density,
      sectionRhythm: envelope.layoutSymmetry === 'asymmetric' ? 'variable' : 'uniform',
      heroScale: oversized ? 'monumental' : envelope.density === 'compact' ? 'contained' : 'generous',
    },
    typography: {
      contrast: oversized ? 'extreme' : envelope.typographyScale === 'restrained' ? 'subtle' : 'strong',
      displayTreatment: envelope.typographyScale,
    },
    media: {
      dominance: envelope.visualDominance,
      cropping: envelope.layoutSymmetry === 'asymmetric' ? 'editorial' : 'uniform',
      treatments: Array.from(new Set([
        pack.design.mediaTreatment,
        ...envelope.mediaCandidates.slice(0, 2),
      ])).filter(Boolean) as string[],
    },
    motion: {
      intensity: envelope.motion,
      scrollLinked: expressive || envelope.motionCandidates.includes('scroll-linked'),
    },
    experience: {
      webglEligible: envelope.webgl !== 'ineligible',
      canvasBudget: envelope.canvasBudget,
    },
  };
}

/** Human-readable art-direction block for the Lane B prompt. */
export function describeArtDirectionBrief(intervention: WizardDesignIntervention): string {
  const { brief } = intervention;
  return [
    `ART DIRECTION BRIEF (LOCKED) — you are the composer, not a template filler.`,
    `Archetype: ${brief.visualArchetype}.`,
    `Composition: ${brief.composition.symmetry}, ${brief.composition.density} density, ${brief.composition.sectionRhythm} section rhythm, ${brief.composition.heroScale} hero scale.`,
    `Typography: ${brief.typography.contrast} contrast, ${brief.typography.displayTreatment} display treatment.`,
    `Media: ${brief.media.dominance} dominance, ${brief.media.cropping} cropping, treatments ${brief.media.treatments.join(', ')}.`,
    `Motion: ${brief.motion.intensity}${brief.motion.scrollLinked ? ', scroll-linked' : ''}.`,
    `Experience: WebGL ${brief.experience.webglEligible ? 'eligible' : 'not eligible'}, canvas budget ${brief.experience.canvasBudget}.`,
    describeExperienceEnvelope(intervention.envelope),
  ].join('\n');
}

function familyDirective(themePresetId: string | null | undefined, packId: string): string {
  const familyId = familyIdFromThemePreset(themePresetId) ?? familyOfPack(packId);
  if (!familyId) return '';
  const qualified = qualifiedPackRef(packId, familyId)?.qualifiedId ?? packId;
  return `Art Direction Family "${familyId}", pack "${qualified}": compose creatively inside this grammar and never switch family.`;
}

export function buildWizardDesignIntervention(

  input: WizardDesignInterventionInput,
): WizardDesignIntervention {
  const industry = input.industryOverlay || 'general';
  // ONE canonical design seed: every wizard answer participates. The launch
  // identity (wizardSeedId) is deliberately excluded — the same answers must
  // compile the same site on every run. Only an intentional regeneration
  // token moves the design.
  const seed = deriveDesignSeed({
    businessName: input.businessName,
    businessModel: input.businessModel,
    industry: typeof industry === 'string' ? industry : String(industry),
    templateId: input.templateId,
    themePresetId: input.themePresetId,
    primaryGoal: input.primaryGoal,
    secondaryGoals: input.secondaryGoals,
    requestedPages: input.requestedPages,
    projectId: input.projectId,
    regenerationNonce: input.regenerationNonce,
  });

  const baseline = MODEL_RECIPES[input.businessModel];
  const sectionVariants = seededRotate(childSeed(seed, 'section-variants'), baseline.sectionVariants);

  // ART DIRECTION — resolved ONCE, from the style card first. Everything that
  // follows (motion, interaction, CSS, Lane B brief) obeys this pack.
  const sealedPackId = input.designSelection?.artDirectionPackId;
  const preferredPackId = resolveArtDirectionPackId({
    themePresetId: input.themePresetId,
    industry,
    seed,
    sealedPackId,
  });
  // §35: an explicitly selected direction is never swapped or degraded; auto
  // mode moves deterministically to another complete compatible direction when
  // the preferred one cannot cover the selected topology.
  const artDirectionPackId = sealedPackId
    ? preferredPackId
    : resolveAvailableAutoArtDirectionPackId(preferredPackId, {
        selectedPages: input.requestedPages ?? [],
        experience: input.designSelection?.experience ?? 'standard',
        seed,
      });
  const pack = ART_DIRECTION_PACKS[artDirectionPackId];


  const interactionRecipes = Array.from(
    new Set([pack.interactionProfile, ...baseline.interactionRecipes]),
  );

  if ((input.sellsProducts || input.businessModel === 'ecommerce') && !interactionRecipes.includes('image-lightbox')) {
    interactionRecipes.push('image-lightbox');
  }
  if ((input.needsBooking || input.wantsLeadCapture) && !interactionRecipes.includes('accordion')) {
    interactionRecipes.push('accordion');
  }


  const experience = MODEL_EXPERIENCE[input.businessModel] ?? MODEL_EXPERIENCE.general;
  const experienceRecipes = seededRotate(childSeed(seed, 'experience'), experience.recipes);
  if (input.sellsProducts && !experienceRecipes.includes('product-stage')) {
    experienceRecipes.unshift('product-stage');  }

  // PHASE 2 — resolve the constrained vocabulary envelope, then the brief.
  const envelope = resolveExperienceEnvelope({
    seed,
    businessModel: input.businessModel,
    industry: typeof industry === 'string' ? industry : String(industry),
    templateId: input.templateId,
    themePresetId: input.themePresetId,
    styleIntent: input.themePresetId,
    primaryGoal: input.primaryGoal,
    sellsProducts: input.sellsProducts,
    needsBooking: input.needsBooking,
    wantsLeadCapture: input.wantsLeadCapture,
    immersiveRequested: input.needsImmersive || input.designSelection?.experience === 'immersive',
    disallowWebgl: experience.budget === 'none',
  });
  const brief = buildArtDirectionBrief(envelope, artDirectionPackId);

  const pinnedVariants = Object.fromEntries(Object.values(input.designSelection?.sectionPins ?? {})
    .map(id => [String(id).split(':')[0], id]));
  const compositionPlan = input.compositionPlan
    ? validateAIPageComposition(input.compositionPlan, artDirectionPackId, COMPOSITION_ROLES, {
        experiencePreference: input.designSelection?.experience,
        pinnedVariants,
      }) ?? undefined : undefined;
  const activeVariants = buildActiveVariants(input.templateId, seed, artDirectionPackId, typeof industry === 'string' ? industry : String(industry));
  const homeChoices = compositionPlan?.pages.find(page => page.role === 'home')?.variants;
  const home = input.templateId ? getCompositionById(input.templateId) : undefined;
  for (const section of home?.sections ?? []) {
    if (homeChoices?.[section.type]) activeVariants[section.id] = homeChoices[section.type] as VariantId;
  }
  // Explicit user pins are the final authority: user pin > accepted AI choice
  // > deterministic seeded choice. Eligibility is already constrained by the
  // Wizard's registry-derived picker and is revalidated at compile time.
  // A pin key is either a section instance id or a section type; the Wizard
  // pins by type because instance ids only exist after composition.
  for (const [pinKey, variantId] of Object.entries(input.designSelection?.sectionPins ?? {})) {
    const sectionType = String(variantId).split(':')[0];
    if (pinKey === sectionType) {
      for (const [sectionId, current] of Object.entries(activeVariants)) {
        if (String(current).split(':')[0] === sectionType) activeVariants[sectionId] = variantId;
      }
      continue;
    }
    activeVariants[pinKey] = variantId;
  }

  // The immersive layer is only offered when a registered implementation
  // enables it; otherwise the launch approves nothing and preflight would
  // reject any edit that followed an immersive instruction.
  const experienceApproved = input.needsImmersive || input.designSelection?.experience === 'immersive' ||
    resolveExperienceRequirement(Object.values(activeVariants)).capabilities.length > 0;
  const experienceDirective = experienceApproved
    ? `Experience budget is "${experience.budget}" — compose the immersive layer only from @/unison/ui/experience (${experienceRecipes.join(', ')}), at most one heavy primitive per page band and two per page, and never import three/@react-three/* directly.`
    : 'Additional immersive components are not approved for this launch. Preserve the compiler-owned composition adapters and their recorded capability decisions; never add experience imports or import three/@react-three/* directly.';

  // The brief must describe the composition that was actually resolved; naming
  // an unselected vocabulary pattern invites Lane B to hand-author it.
  const resolvedImplementations = [...new Set(Object.values(activeVariants))].sort();
  const resolvedPatterns = [...new Set(
    resolvedImplementations
      .flatMap((id) => {
        const implementation = getDesignImplementation(id);
        return implementation ? getImplementationVocabularyRefs(implementation).map((ref) => ref.id) : [];
      }),
  )];
  const compositionDirective = [
    resolvedImplementations.length > 0
      ? `This launch resolved the registered implementations ${resolvedImplementations.join(', ')} — compose within them and never author replacement section source.`
      : 'Compose within the registered section implementations resolved for this launch and never author replacement section source.',
    resolvedPatterns.length > 0
      ? `Their design language is ${resolvedPatterns.join(', ')}; vary the pattern between pages instead of repeating one section shape.`
      : 'Vary the pattern between pages instead of repeating one section shape.',
  ].join(' ');

  return {
    version: WIZARD_DESIGN_INTERVENTION_VERSION,
    source: 'deterministic-baseline',
    ...(compositionPlan ? { compositionPlan } : {}),
    seed,
    industry,
    businessModel: input.businessModel,
    templateId: input.templateId || null,
    themePresetId: input.themePresetId,
    artDirectionPackId,
    layoutRecipe: baseline.layoutRecipe,
    sectionVariants,
    activeVariants,
    // The pack's motion profile leads; the business-model recipes follow.
    motionRecipes: Array.from(
      new Set([pack.motionProfile, ...seededRotate(childSeed(seed, 'motion'), baseline.motionRecipes)]),
    ),
    interactionRecipes,
    motionBudget: baseline.motionBudget,
    experienceRecipes,
    experienceBudget: experience.budget,
    compositionPolicy: 'maximum-compatible',
    envelope,
    brief,
    aiDirective: `Compose only with snapshot-owned UI primitives and semantic Stage 4b tokens. Art direction is "${pack.name}" — ${pack.description} ${familyDirective(input.themePresetId, artDirectionPackId)} ${compositionDirective} ${experienceDirective} Preserve the motion budget, selected recipes, accessibility, responsive constraints, and canonical intent bindings.`,


  };
}
