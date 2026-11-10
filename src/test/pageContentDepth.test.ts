// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as ts from 'typescript';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { ALL_COMPOSITIONS } from '@/sections/templates';
import { curateMarketplaceTemplate } from '@/marketplace/curateMarketplaceTemplate';
import { buildAppBuilderGenerationContext } from '@/services/app-builder/appBuilderGenerationContext';
import { COMPOSER_CONTEXT_LIMIT, packContextBlocks } from '@/services/app-builder/contextBudget';
import { verifiedPhotosFor } from '@/services/app-builder/design/pageStructureGate';
import { resolveIndustryVertical } from '@/services/composition/verticals';
import { CONTEXTUAL_IMAGES } from '@/utils/sandpackFilePrep';
import { AUTHORED_PROP_NORMALIZER } from '@/sections/compositionToFileSet';
import { repairAuthoredImageSource } from '@/services/builder/authoredImageRepair';

const WEDDING_PROMPT = "Create a wedding website for Eman & Kiara. Romantic and editorial with soft florals. Pages: Home, Our Story, The Day's Details with a day schedule, and an RSVP page where guests confirm attendance and meal choice. Include an FAQ about dress code and parking.";

function weddingContract() {
  const curated = curateMarketplaceTemplate(ALL_COMPOSITIONS.find((c) => c.id === 'salon-premium')!, THEME_PRESETS[0]);
  curated.contract.business.universalCreation = {
    mode: 'open-ended', originalPrompt: WEDDING_PROMPT, sitePurpose: 'wedding website', subject: 'Eman & Kiara wedding',
    pages: [], visualRequirements: ['soft florals'], requestedCapabilities: [],
    vertical: resolveIndustryVertical(WEDDING_PROMPT) ?? undefined,
    creativeBrief: { tone: ['romantic'], typography: [], color: [], imagery: [], composition: [], motion: [], interactions: [], references: [] },
  } as never;
  return curated.contract;
}

const headings = (text: string) => text.split('\n').filter((line) => /^[A-Z][A-Z \-/]{6,}[:(—]/.test(line)).map((line) => line.slice(0, 40));

describe('page context is never silently cut', () => {
  it('moves required blocks that do not fit into overflow instead of tail-cutting them', () => {
    const packed = packContextBlocks([
      { priority: 1, text: 'A '.repeat(30) },
      { priority: 3, text: 'OPTIONS list' },
      { priority: 1, text: 'FORM PLACEMENT rule' },
    ], 70);
    expect(packed.text.length).toBeLessThanOrEqual(70);
    expect(`${packed.text}\n${packed.overflow}`).toContain('OPTIONS list');
    expect(`${packed.text}\n${packed.overflow}`).toContain('FORM PLACEMENT rule');
    expect(packed.text).not.toMatch(/FORM PLACEMENT r$/);
  });

  it('delivers every page rule, including design prop contracts, to each wedding page', () => {
    const contract = weddingContract();
    const generation = buildAppBuilderGenerationContext(contract);
    let pagesWithOptions = 0;
    for (const page of contract.topology.sitePlan.pages) {
      const full = generation.runtimeContextForPage(page.id, Number.POSITIVE_INFINITY);
      const runtime = generation.runtimeContextForPage(page.id, COMPOSER_CONTEXT_LIMIT);
      const overflow = generation.runtimeContextOverflowForPage(page.id, COMPOSER_CONTEXT_LIMIT);
      expect(runtime.length).toBeLessThanOrEqual(COMPOSER_CONTEXT_LIMIT);
      expect(headings(`${runtime}\n${overflow}`).sort()).toEqual(headings(full).sort());
      // Prop contracts ride in the capped channel itself, early, not only in overflow.
      if (full.includes('CERTIFIED OPTIONS FOR THIS PAGE')) {
        pagesWithOptions += 1;
        expect(runtime).toContain('CERTIFIED OPTIONS FOR THIS PAGE');
        expect(runtime).toContain('SECTION CONTENT DEPTH');
        expect(runtime).toMatch(/props \{headline/);
      }
    }
    expect(pagesWithOptions).toBeGreaterThan(0);
  });
});

describe('vertical photography', () => {
  it('gives a wedding site wedding photos, not office or laptop photos', () => {
    const photos = verifiedPhotosFor(undefined, 6, ['weddings']);
    const wedding = new Set(CONTEXTUAL_IMAGES.weddings.map((url) => url.replace(/\?.*$/, '')));
    const office = new Set([...CONTEXTUAL_IMAGES.default, ...CONTEXTUAL_IMAGES.agency].map((url) => url.replace(/\?.*$/, '')));
    expect(photos).toHaveLength(6);
    for (const url of photos) {
      expect(wedding.has(url.replace(/\?.*$/, ''))).toBe(true);
      expect(office.has(url.replace(/\?.*$/, ''))).toBe(false);
    }
  });

  it('keeps the generic pool only when no specific photos exist', () => {
    expect(verifiedPhotosFor('unknown-trade', 3)).toEqual(CONTEXTUAL_IMAGES.default.slice(0, 3).map((url) => url.replace(/\?.*$/, '?w=1600&q=80')));
  });

  it('replaces invented photo ids on a wedding page with wedding photos', () => {
    const repaired = repairAuthoredImageSource('const rsvp = "RSVP for the wedding"; const img = "https://images.unsplash.com/photo-9999999999999-aaaaaaaaaaaa?w=800";');
    expect(CONTEXTUAL_IMAGES.weddings.some((url) => repaired.includes(url))).toBe(true);
  });
});

describe('certified section prop names', () => {
  const normalize = (() => {
    const js = ts.transpileModule(`${AUTHORED_PROP_NORMALIZER}\nreturn normalizeAuthoredProps;`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
    return new Function(js)() as (props: unknown) => Record<string, unknown>;
  })();

  it('renders copy written under common alternate names', () => {
    const props = normalize({ title: 'We would be honoured', body: 'Join us in the garden at golden hour.', buttons: [{ label: 'RSVP', href: '/rsvp' }] });
    expect(props.headline).toBe('We would be honoured');
    expect(props.description).toBe('Join us in the garden at golden hour.');
    expect(props.ctas).toEqual([{ label: 'RSVP', href: '/rsvp' }]);
    expect(props.cta).toEqual({ label: 'RSVP', href: '/rsvp' });
  });

  it('never overrides the canonical names a variant reads', () => {
    const props = normalize({ headline: 'Canonical', title: 'Alias', description: 'Real', body: 'Other', items: [{ title: 'Ceremony', name: 'Alt', text: '14:00 in the chapel' }] });
    expect(props.headline).toBe('Canonical');
    expect(props.description).toBe('Real');
    expect(props.items).toEqual([{ title: 'Ceremony', name: 'Alt', text: '14:00 in the chapel', description: '14:00 in the chapel' }]);
  });
});
