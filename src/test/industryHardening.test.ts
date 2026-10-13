import { describe, expect, it } from 'vitest';
import {
  INDUSTRY_INTENT_PROFILES,
  getIndustryIntentProfile,
  synthesizeIndustryBindings,
} from '@/platform/core/industryIntentProfiles';
import { getIndustryProfile, normalizeIndustryKey } from '@/platform/core/industryMatrix';
import {
  buildUIIntentContract,
  getUIIntentProfile,
  hasUIIntentProfile,
  resolveUIIntentPlacements,
  UI_INTENT_PROFILES,
} from '@/platform/core/uiIntentProfile';
import type { PlaygroundPageRole } from '@/types/playground';

const HARDENED_INDUSTRIES = [
  'salon',
  'local-service',
  'contractor',
  'coaching',
  'restaurant',
  'ecommerce',
  'agency',
  'nonprofit',
  'portfolio',
  'real-estate',
] as const;

describe('Industry hardening — intent profiles', () => {
  it.each(['cafe', 'caf\u00e9', 'bakery', 'bistro', 'food truck', 'restaurant-hospitality'])(
    'resolves %s to the canonical restaurant profile',
    (alias) => {
      expect(normalizeIndustryKey(alias)).toBe('restaurant');
      expect(getIndustryProfile(alias)?.industry).toBe('restaurant');
      expect(getIndustryIntentProfile(alias)?.industry).toBe('restaurant');
    },
  );

  it.each(HARDENED_INDUSTRIES)('%s ships a unified intent map (profileFromMap)', (industry) => {
    const profile = INDUSTRY_INTENT_PROFILES[industry];
    expect(profile, `profile for ${industry}`).toBeDefined();
    expect(profile.intents, `${industry} must use unified intents map`).toBeDefined();
    expect(Object.keys(profile.intents!).length).toBeGreaterThan(2);
  });

  it.each(HARDENED_INDUSTRIES)('%s declares at least one required intent', (industry) => {
    const profile = INDUSTRY_INTENT_PROFILES[industry];
    expect(profile.required.length, `${industry} required intents`).toBeGreaterThan(0);
  });

  it.each(HARDENED_INDUSTRIES)('%s has synthesis slots for every required intent', (industry) => {
    const profile = INDUSTRY_INTENT_PROFILES[industry];
    for (const reqIntent of profile.required) {
      // nav.goto is structural, not stamped via slots
      if (reqIntent === 'nav.goto') continue;
      const spec = profile.intents![reqIntent];
      expect(
        spec?.synthesize?.length ?? 0,
        `${industry}: required intent "${reqIntent}" needs synthesize slots`,
      ).toBeGreaterThan(0);
    }
  });

  it.each(HARDENED_INDUSTRIES)('%s synthesis is idempotent', (industry) => {
    const profile = INDUSTRY_INTENT_PROFILES[industry];
    const pages = new Set<PlaygroundPageRole>([
      'home', 'about', 'services', 'pricing', 'gallery', 'contact', 'booking', 'shop', 'checkout', 'faq',
    ]);
    const first = synthesizeIndustryBindings(profile, [], { availablePageRoles: pages });
    const second = synthesizeIndustryBindings(profile, [...first.kept, ...first.synthesized], { availablePageRoles: pages });
    expect(second.synthesized.length, `${industry} second pass should not re-synth`).toBe(0);
    expect(first.unsatisfiedRequired, `${industry} required intents must all be satisfiable`).toEqual([]);
  });
});

describe('Industry hardening — UI intent profiles', () => {
  const UI_HARDENED = HARDENED_INDUSTRIES;

  it.each(UI_HARDENED)('%s has a UI intent profile registered', (industry) => {
    expect(hasUIIntentProfile(industry), `${industry} UI profile`).toBe(true);
    const profile = getUIIntentProfile(industry);
    expect(profile.industry === industry || industry === 'contractor').toBeTruthy();
    expect(Object.keys(profile.intents).length).toBeGreaterThan(0);
  });

  it.each(UI_HARDENED)('%s placements all carry icons and labels', (industry) => {
    const profile = UI_INTENT_PROFILES[industry]!;
    for (const [intentName, spec] of Object.entries(profile.intents)) {
      for (const p of spec!.placements) {
        expect(p.icon.length, `${industry}.${intentName} icons`).toBeGreaterThan(0);
        expect(p.labelOptions.length, `${industry}.${intentName} labels`).toBeGreaterThan(0);
      }
    }
  });

  it.each(UI_HARDENED)('%s has at least one required UI placement', (industry) => {
    const profile = UI_INTENT_PROFILES[industry]!;
    const requiredCount = Object.values(profile.intents)
      .flatMap((s) => s!.placements)
      .filter((p) => p.required).length;
    expect(requiredCount, `${industry} required placements`).toBeGreaterThan(0);
  });

  it.each(UI_HARDENED)('%s buildUIIntentContract emits a contract block', (industry) => {
    const pages = new Set<PlaygroundPageRole>(['home', 'services', 'contact', 'gallery', 'shop', 'checkout', 'pricing']);
    const profile = getUIIntentProfile(industry);
    const resolution = resolveUIIntentPlacements(profile, [], pages);
    const contract = buildUIIntentContract(industry, resolution);
    expect(contract).toContain('UI INTENT CONTRACT');
    expect(contract).toContain('[REQUIRED]');
  });
});

describe('Industry hardening — forbidden intents are stripped', () => {
  it('keeps cart actions forbidden for salon', () => {
    expect(getIndustryIntentProfile('salon')?.forbidden).toContain('cart.add');
  });

  it('keeps restaurant cart actions available as an explicit optional intent', () => {
    const result = synthesizeIndustryBindings(
      INDUSTRY_INTENT_PROFILES.restaurant,
      [{
        sourcePageRole: 'services', sourceSection: 'services', sourceSlot: 'card-cta',
        coreIntent: 'cart.add', intent: 'checkout.start', targetRef: 'menu-item-1',
      }],
      { availablePageRoles: new Set(['home', 'services', 'checkout']) },
    );

    expect(result.strippedForbidden).toHaveLength(0);
    expect(result.kept).toHaveLength(1);
  });

  it('ecommerce strips booking.create bindings', () => {
    const profile = INDUSTRY_INTENT_PROFILES.ecommerce;
    const result = synthesizeIndustryBindings(
      profile,
      [{
        sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta',
        coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'x',
      }],
      { availablePageRoles: new Set(['home', 'shop']) },
    );
    expect(result.strippedForbidden).toHaveLength(1);
    expect(result.kept.find((b) => b.coreIntent === 'booking.create')).toBeUndefined();
  });

  it('nonprofit strips cart.add bindings', () => {
    const profile = INDUSTRY_INTENT_PROFILES.nonprofit;
    const result = synthesizeIndustryBindings(
      profile,
      [{
        sourcePageRole: 'home', sourceSection: 'services', sourceSlot: 'card-cta',
        coreIntent: 'cart.add', intent: 'checkout.start', targetRef: 'p1',
      }],
      { availablePageRoles: new Set(['home']) },
    );
    expect(result.strippedForbidden).toHaveLength(1);
  });

  it('salon strips quote.request bindings', () => {
    const profile = INDUSTRY_INTENT_PROFILES.salon;
    const result = synthesizeIndustryBindings(
      profile,
      [{
        sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta',
        coreIntent: 'quote.request', intent: 'form.open', targetRef: 'q',
      }],
      { availablePageRoles: new Set(['home']) },
    );
    expect(result.strippedForbidden).toHaveLength(1);
  });
});
