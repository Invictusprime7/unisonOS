import { resolveTopologyPageRoleAlias } from '@/platform/core/siteTopologyPlanner';
/**
 * Universal industry composition registry — data only.
 * Adding an industry means adding profiles here; the planner never changes.
 */
import type { CompositionCharacter, IndustryPageCompositionProfile } from './types';
import type { CompositionResolution, CompositionResolutionInput } from './types';
import { hashSeed } from '@/platform/core/generationSeed';

type ProfileSeed = Omit<IndustryPageCompositionProfile, 'industryId' | 'pageRole' | 'compositionCharacter' | 'customCompositionAllowed' | 'customComponentsAllowed'> & {
  character: Partial<CompositionCharacter> & Pick<CompositionCharacter, 'density'>;
};

const BASE: Omit<CompositionCharacter, 'density'> = {
  mediaDominance: 0.5, typographyDominance: 0.5, editoriality: 0.4, informationDensity: 0.5,
  conversionPressure: 0.4, interactionDepth: 0.3, asymmetry: 0.3, layering: 0.3,
};

function build(industryId: string, roles: Record<string, ProfileSeed>): IndustryPageCompositionProfile[] {
  return Object.entries(roles).map(([pageRole, { character, ...rest }]) => {
    const { industryId: _i, pageRole: _r, compositionCharacter: _c, ...clean } = rest as typeof rest & Partial<IndustryPageCompositionProfile>;
    return {
      ...clean,
      industryId,
      pageRole,
      compositionCharacter: { ...BASE, ...character },
      customCompositionAllowed: true,
      customComponentsAllowed: clean.noveltyBudget >= 0.5,
    };
  });
}

const SALON = build('salon', {
  home: {
    narrativeGoals: ['establish atmosphere and brand feeling', 'preview signature services', 'drive booking'],
    primaryIntent: 'booking.open', requiredCapabilities: ['booking'],
    domainVocabulary: ['signature treatments', 'stylists', 'rituals', 'appointments'],
    character: { density: 'low', mediaDominance: 0.85, editoriality: 0.6, conversionPressure: 0.6, layering: 0.6 },
    preferredFamilies: ['hero', 'services', 'gallery', 'before-after', 'about', 'testimonials', 'cta'],
    sectionOrderCandidates: [
      ['hero', 'services', 'gallery', 'testimonials', 'cta'],
      ['hero', 'about', 'services', 'before-after', 'testimonials', 'cta'],
      ['hero', 'gallery', 'services', 'about', 'cta'],
    ],
    heroCandidates: ['immersive-media', 'split-media'], geometryCandidates: ['full-bleed', 'layered', 'asymmetric'],
    preferredCompositionPatterns: ['atmospheric full-bleed opener', 'curated service teaser', 'social proof strip'],
    discouragedCompositionPatterns: ['full price list', 'dense FAQ'], noveltyBudget: 0.6,
  },
  services: {
    narrativeGoals: ['help clients choose a treatment', 'make duration and price scannable'],
    primaryIntent: 'booking.open', requiredCapabilities: ['booking'],
    domainVocabulary: ['treatment menu', 'duration', 'from price', 'add-ons'],
    character: { density: 'high', mediaDominance: 0.3, informationDensity: 0.85, typographyDominance: 0.6 },
    preferredFamilies: ['hero', 'services', 'pricing', 'before-after', 'testimonials', 'faq', 'cta'],
    sectionOrderCandidates: [
      ['hero', 'services', 'pricing', 'faq', 'cta'],
      ['hero', 'services', 'before-after', 'testimonials', 'faq', 'cta'],
    ],
    heroCandidates: ['utility-header', 'typographic'], geometryCandidates: ['grid', 'split'],
    preferredCompositionPatterns: ['categorised treatment menu', 'price/duration rows'],
    discouragedCompositionPatterns: ['immersive hero', 'repeat of home service teaser'], noveltyBudget: 0.3,
  },
  'service-detail': {
    narrativeGoals: ['explain one treatment deeply', 'show credible transformation proof', 'drive a confident booking'],
    primaryIntent: 'booking.open', requiredCapabilities: ['booking'],
    domainVocabulary: ['treatment benefits', 'consultation', 'aftercare', 'results'],
    character: { density: 'medium', mediaDominance: 0.6, editoriality: 0.65, conversionPressure: 0.75 },
    preferredFamilies: ['hero', 'about', 'before-after', 'testimonials', 'faq', 'cta'],
    sectionOrderCandidates: [
      ['hero', 'about', 'before-after', 'testimonials', 'faq', 'cta'],
      ['hero', 'before-after', 'about', 'faq', 'testimonials', 'cta'],
    ],
    heroCandidates: ['split-media', 'editorial-intro'], geometryCandidates: ['split', 'asymmetric'],
    preferredCompositionPatterns: ['treatment narrative with proof', 'results-led consultation path'],
    discouragedCompositionPatterns: ['generic service grid', 'full catalog'], noveltyBudget: 0.5,
  },
  gallery: {
    narrativeGoals: ['prove craft through results', 'let imagery lead'],
    requiredCapabilities: [], domainVocabulary: ['before & after', 'looks', 'transformations'],
    character: { density: 'medium', mediaDominance: 0.95, typographyDominance: 0.2, asymmetry: 0.7 },
    preferredFamilies: ['gallery', 'testimonials', 'cta'],
    heroCandidates: ['typographic', 'none'], geometryCandidates: ['asymmetric', 'grid'],
    preferredCompositionPatterns: ['masonry or editorial image grid', 'before/after comparison'],
    discouragedCompositionPatterns: ['text-heavy intro', 'service cards'], noveltyBudget: 0.7,
  },
  about: {
    narrativeGoals: ['build trust in the team', 'tell the studio story'],
    requiredCapabilities: [], domainVocabulary: ['our stylists', 'philosophy', 'products we use'],
    character: { density: 'medium', editoriality: 0.85, typographyDominance: 0.7, asymmetry: 0.5 },
    preferredFamilies: ['about', 'team', 'testimonials', 'cta'],
    heroCandidates: ['editorial-intro', 'split-media'], geometryCandidates: ['asymmetric', 'split'],
    preferredCompositionPatterns: ['editorial story block', 'team portraits'],
    discouragedCompositionPatterns: ['pricing', 'booking form'], noveltyBudget: 0.5,
  },
  booking: {
    narrativeGoals: ['complete an appointment with minimal friction'],
    primaryIntent: 'booking.open', requiredCapabilities: ['booking'],
    domainVocabulary: ['choose a service', 'pick a time', 'confirm'],
    character: { density: 'low', mediaDominance: 0.2, conversionPressure: 0.95, interactionDepth: 0.8 },
    preferredFamilies: ['services', 'contact', 'faq'],
    sectionOrderCandidates: [
      ['hero', 'services', 'contact', 'faq'],
      ['hero', 'contact', 'faq', 'testimonials'],
    ],
    heroCandidates: ['utility-header'], geometryCandidates: ['centered', 'split'],
    preferredCompositionPatterns: ['focused booking flow', 'reassurance sidebar'],
    discouragedCompositionPatterns: ['gallery', 'long story copy', 'immersive hero'], noveltyBudget: 0.2,
  },
  contact: {
    narrativeGoals: ['make it easy to reach or visit'],
    primaryIntent: 'contact.submit', requiredCapabilities: ['contact'],
    domainVocabulary: ['visit the studio', 'hours', 'directions'],
    character: { density: 'medium', mediaDominance: 0.35, informationDensity: 0.6, conversionPressure: 0.6 },
    preferredFamilies: ['contact', 'faq', 'stats'],
    heroCandidates: ['utility-header', 'typographic'], geometryCandidates: ['split', 'centered'],
    preferredCompositionPatterns: ['hours + location + form split'],
    discouragedCompositionPatterns: ['service grid', 'gallery'], noveltyBudget: 0.3,
  },
  faq: {
    narrativeGoals: ['resolve practical objections', 'route unresolved questions to the studio'],
    requiredCapabilities: [], domainVocabulary: ['appointments', 'consultations', 'policies', 'aftercare'],
    character: { density: 'medium', informationDensity: 0.8, typographyDominance: 0.65, conversionPressure: 0.35 },
    preferredFamilies: ['hero', 'faq', 'contact', 'cta'],
    sectionOrderCandidates: [['hero', 'faq', 'contact', 'cta'], ['hero', 'faq', 'cta']],
    heroCandidates: ['utility-header', 'typographic'], geometryCandidates: ['centered', 'split'],
    preferredCompositionPatterns: ['grouped questions with a contact escape hatch'],
    discouragedCompositionPatterns: ['immersive media', 'service catalog'], noveltyBudget: 0.25,
  },
});

const RESTAURANT = build('restaurant', {
  home: {
    narrativeGoals: ['convey the dining experience', 'drive reservations'],
    primaryIntent: 'booking.open', requiredCapabilities: ['booking'],
    domainVocabulary: ['chef', 'seasonal menu', 'reserve a table'],
    character: { density: 'low', mediaDominance: 0.9, editoriality: 0.6, conversionPressure: 0.6, layering: 0.6 },
    preferredFamilies: ['hero', 'services', 'gallery', 'about', 'testimonials', 'cta'],
    sectionOrderCandidates: [
      ['hero', 'services', 'gallery', 'testimonials', 'cta'],
      ['hero', 'about', 'services', 'gallery', 'cta'],
    ],
    heroCandidates: ['immersive-media', 'split-media'], geometryCandidates: ['full-bleed', 'layered'],
    preferredCompositionPatterns: ['atmospheric food/room imagery', 'menu highlights'],
    discouragedCompositionPatterns: ['full menu', 'dense FAQ'], noveltyBudget: 0.6,
  },
  menu: {
    narrativeGoals: ['let guests browse dishes and prices quickly'],
    requiredCapabilities: [], domainVocabulary: ['starters', 'mains', 'dietary notes', 'wine'],
    character: { density: 'high', mediaDominance: 0.25, informationDensity: 0.9, typographyDominance: 0.7 },
    preferredFamilies: ['hero', 'services', 'faq', 'cta'],
    sectionOrderCandidates: [
      ['hero', 'services', 'faq', 'cta'],
      ['hero', 'services', 'about', 'cta'],
    ],
    heroCandidates: ['typographic', 'utility-header'], geometryCandidates: ['grid', 'split'],
    preferredCompositionPatterns: ['sectioned menu with dotted price leaders'],
    discouragedCompositionPatterns: ['immersive hero'], noveltyBudget: 0.3,
  },
  services: {
    narrativeGoals: ['let guests browse the menu by course', 'surface dietary context without card-grid sameness'],
    requiredCapabilities: [], domainVocabulary: ['starters', 'mains', 'dietary notes', 'wine'],
    character: { density: 'high', mediaDominance: 0.25, informationDensity: 0.9, typographyDominance: 0.7 },
    preferredFamilies: ['hero', 'services', 'faq', 'about', 'cta'],
    sectionOrderCandidates: [
      ['hero', 'services', 'faq', 'cta'],
      ['hero', 'about', 'services', 'cta'],
    ],
    heroCandidates: ['typographic', 'utility-header'], geometryCandidates: ['grid', 'split'],
    preferredCompositionPatterns: ['course-led menu typography', 'chef context followed by menu'],
    discouragedCompositionPatterns: ['generic service cards', 'immersive hero'], noveltyBudget: 0.3,
  },
  gallery: {
    narrativeGoals: ['show the room, the plates and the mood'],
    requiredCapabilities: [], domainVocabulary: ['the room', 'plates', 'events'],
    character: { density: 'medium', mediaDominance: 0.95, typographyDominance: 0.2, asymmetry: 0.7 },
    preferredFamilies: ['gallery', 'cta'],
    heroCandidates: ['none', 'typographic'], geometryCandidates: ['asymmetric', 'grid'],
    preferredCompositionPatterns: ['editorial image mosaic'], discouragedCompositionPatterns: ['menu list'], noveltyBudget: 0.7,
  },
  about: {
    narrativeGoals: ['tell the chef and sourcing story'],
    requiredCapabilities: [], domainVocabulary: ['our kitchen', 'producers', 'history'],
    character: { density: 'medium', editoriality: 0.85, typographyDominance: 0.7 },
    preferredFamilies: ['about', 'team', 'testimonials'],
    heroCandidates: ['editorial-intro', 'split-media'], geometryCandidates: ['asymmetric', 'split'],
    preferredCompositionPatterns: ['long-form editorial story'], discouragedCompositionPatterns: ['reservation form'], noveltyBudget: 0.5,
  },
  booking: {
    narrativeGoals: ['reserve a table quickly'],
    primaryIntent: 'booking.open', requiredCapabilities: ['booking'],
    domainVocabulary: ['party size', 'date', 'time'],
    character: { density: 'low', mediaDominance: 0.2, conversionPressure: 0.95, interactionDepth: 0.8 },
    preferredFamilies: ['contact', 'faq', 'testimonials'],
    sectionOrderCandidates: [
      ['hero', 'contact', 'faq'],
      ['hero', 'contact', 'testimonials', 'faq'],
    ],
    heroCandidates: ['utility-header'], geometryCandidates: ['centered', 'split'],
    preferredCompositionPatterns: ['focused reservation widget'], discouragedCompositionPatterns: ['gallery'], noveltyBudget: 0.2,
  },
  contact: {
    narrativeGoals: ['find us, call us, see opening hours'],
    primaryIntent: 'contact.submit', requiredCapabilities: ['contact'],
    domainVocabulary: ['opening hours', 'address', 'private dining'],
    character: { density: 'medium', mediaDominance: 0.35, informationDensity: 0.6 },
    preferredFamilies: ['contact', 'faq', 'about'],
    heroCandidates: ['utility-header', 'typographic'], geometryCandidates: ['split', 'centered'],
    preferredCompositionPatterns: ['hours + map split'], discouragedCompositionPatterns: ['menu list'], noveltyBudget: 0.3,
  },
});

/** Generic role jobs used for industries without dedicated profiles yet. */
const GENERIC = build('*', {
  home: { ...SALON[0], character: { ...SALON[0].compositionCharacter }, domainVocabulary: [], primaryIntent: undefined, requiredCapabilities: [] },
  services: { ...SALON[1], character: { ...SALON[1].compositionCharacter }, domainVocabulary: [], requiredCapabilities: [] },
  gallery: { ...SALON[2], character: { ...SALON[2].compositionCharacter }, domainVocabulary: [] },
  about: { ...SALON[3], character: { ...SALON[3].compositionCharacter }, domainVocabulary: [] },
  booking: { ...SALON[4], character: { ...SALON[4].compositionCharacter }, domainVocabulary: [] },
  contact: { ...SALON[5], character: { ...SALON[5].compositionCharacter }, domainVocabulary: [] },
});

const REGISTRY: IndustryPageCompositionProfile[] = [...SALON, ...RESTAURANT, ...GENERIC];

const ROLE_ALIASES: Record<string, string> = {
  index: 'home', landing: 'home', 'book-now': 'booking', book: 'booking', reservations: 'booking', reserve: 'booking',
  portfolio: 'gallery', work: 'gallery', 'our-studio': 'about', team: 'about', story: 'about', pricing: 'services',
};

export function normalizePageRole(role: string): string {
  const key = role.toLowerCase().trim().replace(/^\//, '').replace(/\s+/g, '-');
  return ROLE_ALIASES[key] ?? resolveTopologyPageRoleAlias(role) ?? (key || 'home');
}

export function listIndustryProfiles(industryId: string): IndustryPageCompositionProfile[] {
  return REGISTRY.filter((p) => p.industryId === industryId);
}

export function resolvePageCompositionProfile(industryId: string, role: string): IndustryPageCompositionProfile {
  const r = normalizePageRole(role);
  const found = REGISTRY.find((p) => p.industryId === industryId && p.pageRole === r)
    ?? REGISTRY.find((p) => p.industryId === '*' && p.pageRole === r);
  if (found) return found;
  // Unknown role: a loose, medium-density editorial page.
  const about = REGISTRY.find((p) => p.industryId === '*' && p.pageRole === 'about')!;
  return { ...about, industryId, pageRole: r, narrativeGoals: [`serve the "${role}" page purpose`] };
}

/** Universal resolver: industries add data above; selection logic stays here. */
export function resolveComposition(input: CompositionResolutionInput): CompositionResolution {
  const profile = resolvePageCompositionProfile(input.industry, input.pageIntent);
  const candidates = profile.sectionOrderCandidates?.length
    ? profile.sectionOrderCandidates
    : [profile.preferredFamilies];
  const keyParts = [
    input.industry,
    profile.pageRole,
    input.artDirection ?? 'default',
    [...(input.businessTraits ?? [])].sort().join(','),
    [...(input.availableCapabilities ?? [])].sort().join(','),
    input.seed,
  ];
  const index = hashSeed(keyParts.join('|')) % candidates.length;
  return {
    profile,
    sectionOrder: [...candidates[index]],
    compositionKey: `${input.industry}:${profile.pageRole}:${input.artDirection ?? 'default'}:${index}`,
  };
}
