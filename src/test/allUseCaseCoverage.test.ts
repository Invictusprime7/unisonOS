// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { VERTICAL_PACKS, resolveIndustryVertical, verticalForIndustry, renderVerticalKnowledge } from '@/services/composition/verticals';
import { photoLibraryKey, verifiedPhotosFor } from '@/services/app-builder/design/pageStructureGate';
import { CONTEXTUAL_IMAGES } from '@/utils/sandpackFilePrep';
import { INDUSTRY_MATRIX } from '@/platform/core/industryMatrix';
import { IndustrySchema } from '@/schemas/BusinessBlueprint';
import {
  CREATIVE_BRIEF_PATH,
  deriveExperienceDirection,
  readCreativeBrief,
  refinedCreativeBriefFile,
  serializeCreativeBrief,
} from '@/services/launch/experienceDirector';
import { createUnisonBuilderContext, renderUnisonBuilderDirective } from '@/services/unisonBuilderConnector';
import { createUnisonAppBuilder } from '@/services/app-builder/UnisonAppBuilder';
import { repairAuthoredImageSource } from '@/services/builder/authoredImageRepair';

const bare = (url: string) => url.replace(/\?.*$/, '');
const OFFICE = new Set(CONTEXTUAL_IMAGES.default.map(bare));

describe('every common website use case is recognised', () => {
  it.each([
    ['A cosy café and bakery in Osu with brunch and pastries.', 'restaurant', 'cafe-bakery'],
    ['A barbershop with fades and online booking.', 'salon', 'hair-salon'],
    ['Emergency plumber covering Accra with free quotes.', 'local-service', 'home-repair'],
    ['I am a life coach helping women change careers.', 'coaching', 'personal-coach'],
    ['A realtor site with homes for sale and viewings.', 'real-estate', 'agency'],
    ['Online store for our streetwear brand.', 'ecommerce', 'fashion'],
    ['Portfolio for a UX designer with case studies.', 'portfolio', 'designer'],
    ['A marketing agency that runs paid social campaigns.', 'agency', 'marketing-growth'],
    ['A charity building wells; people can donate and volunteer.', 'nonprofit', 'charity'],
    ['B2B SaaS for invoice automation with a free trial.', 'saas', 'b2b-saas'],
    ['A family dental clinic taking new patients.', 'medical', 'clinic'],
    ['An immigration law firm in Toronto.', 'professional-services', 'law'],
    ['An online course teaching beginner Python.', 'education', 'online-course'],
    ['Website for our weekly podcast about African tech.', 'media', 'podcast'],
  ])('%s → %s/%s', (prompt, packId, variantId) => {
    expect(resolveIndustryVertical(prompt)).toMatchObject({ packId, variantId });
  });

  it('keeps first-wave trades ahead of the generic words they contain', () => {
    expect(resolveIndustryVertical('A boutique hotel with a rooftop restaurant.')?.packId).toBe('hospitality');
    expect(resolveIndustryVertical('A music school offering guitar lessons.')?.packId).toBe('music');
    expect(resolveIndustryVertical('A charity gala with tickets and a lineup.')?.packId).toBe('events');
  });

  it('maps every canonical industry id onto its knowledge pack', () => {
    for (const id of [...Object.keys(INDUSTRY_MATRIX), ...IndustrySchema.options.filter((option) => option !== 'other')]) {
      expect(verticalForIndustry(id), id).not.toBeNull();
    }
  });
});

describe('every use case has its own verified photo library', () => {
  it.each(VERTICAL_PACKS.map((pack) => [pack.id] as const))('%s', (packId) => {
    const pool = CONTEXTUAL_IMAGES[photoLibraryKey(packId)] ?? [];
    expect(pool.length).toBeGreaterThanOrEqual(4);
    const photos = verifiedPhotosFor(undefined, 6, [packId]);
    expect(photos.length).toBeGreaterThanOrEqual(4);
    for (const url of photos) expect(pool.map(bare)).toContain(bare(url));
  });

  it('gives schema industry spellings the right photos, not office stock', () => {
    for (const industry of ['real_estate', 'nonprofit', 'salon_spa', 'local_service']) {
      for (const url of verifiedPhotosFor(industry, 4)) expect(OFFICE.has(bare(url))).toBe(false);
    }
  });

  it('repairs invented photos on a listing page with property photos', () => {
    const repaired = repairAuthoredImageSource('const t = "3 bedrooms for sale"; const i = "https://images.unsplash.com/photo-9999999999999-aaaaaaaaaaaa?w=800";');
    expect(CONTEXTUAL_IMAGES['real-estate'].some((url) => repaired.includes(url))).toBe(true);
  });
});

const WEDDING = 'Our wedding website: RSVP, a countdown and our story. Romantic and editorial.';

function weddingFiles() {
  const direction = deriveExperienceDirection({ ownerText: WEDDING });
  return {
    '/src/pages/Home.tsx': 'export default function Home(){return <main>Home</main>}',
    [CREATIVE_BRIEF_PATH]: serializeCreativeBrief(direction, [{ route: '/', title: 'Home' }], {
      industry: 'agency', vertical: resolveIndustryVertical(WEDDING),
    }),
  };
}

describe('launch enrichment persists after the first build', () => {
  it('seals the industry and vertical into the saved brief and keeps them through edits', () => {
    const files = weddingFiles();
    expect(readCreativeBrief(files)?.site).toMatchObject({ industry: 'agency', vertical: { packId: 'weddings' } });
    const refined = refinedCreativeBriefFile(files, 'Make the hero more cinematic.');
    expect(refined).not.toBeNull();
    expect(readCreativeBrief({ [CREATIVE_BRIEF_PATH]: refined!.contents })?.site?.vertical?.packId).toBe('weddings');
  });

  it('every Affinity edit carries trade knowledge, copy depth and the site photos ahead of long recipe lists', () => {
    const directive = renderUnisonBuilderDirective(createUnisonBuilderContext({ files: weddingFiles() }));
    expect(directive).toContain('INDUSTRY KNOWLEDGE (Weddings');
    expect(directive).toContain('SECTION CONTENT DEPTH');
    expect(directive).toContain(bare(CONTEXTUAL_IMAGES.weddings[0]));
    expect(directive.indexOf('SITE ENRICHMENT')).toBeLessThan(directive.indexOf('App Builder materialized portable recipes'));
  });

  it('sites saved before enrichment was sealed fall back to their industry pack', () => {
    const registry = { industry: 'restaurant', implementations: [] } as never;
    const directive = renderUnisonBuilderDirective(createUnisonBuilderContext({ files: {}, registryContext: registry }));
    expect(directive).toContain('INDUSTRY KNOWLEDGE (Restaurants, cafés & food');
  });

  it('a page added later inherits the sealed vertical and never tail-cuts its instructions', async () => {
    const authorSite = vi.fn(async (input: Parameters<NonNullable<Parameters<typeof createUnisonAppBuilder>[0]['authorSite']>>[0]) => ({
      files: { ...input.files, '/src/pages/Gallery.tsx': 'export default function Gallery(){return <main>Gallery</main>}' },
      revisionId: input.revisionId,
      outcomes: input.pages.map((page) => ({ page, status: 'authored' as const, reason: 'accepted' as const, attempts: 1, errors: [] })),
    }));
    const longPanelContext = Array.from({ length: 400 }, (_, index) => `panel fact ${index}`).join('\n');
    await createUnisonAppBuilder({ authorSite }).generatePages({
      operationId: 'add-gallery', baseRevisionId: 'r1', currentFiles: weddingFiles(),
      pages: [{ pageId: 'gallery', title: 'Gallery', route: '/gallery', filePath: '/src/pages/Gallery.tsx', role: 'gallery', pageType: 'gallery' as never }],
      businessName: 'Eman & Kiara', industry: 'generic', visionBrief: 'add a gallery page', runtimeContext: longPanelContext,
    });
    const input = authorSite.mock.calls[0][0];
    expect(input.vertical?.packId).toBe('weddings');
    const budget = 6000;
    const text = input.runtimeContextForPage!('gallery', {}, undefined, budget);
    const overflow = input.runtimeContextOverflowForPage!('gallery', {}, undefined, budget);
    expect(text.length).toBeLessThanOrEqual(budget);
    expect(`${text}\n${overflow}`).toContain('panel fact 399');
    expect(`${text}\n${overflow}`).toContain('INDUSTRY KNOWLEDGE (Weddings');
  });

  it('template builds without a prompt still receive their industry knowledge', () => {
    expect(renderVerticalKnowledge(verticalForIndustry('salon_spa'))).toContain('Salons, beauty & wellness');
  });
});
