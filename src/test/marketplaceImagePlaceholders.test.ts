import { describe, expect, it } from 'vitest';
import { MARKETPLACE_SAMPLE_IMAGES as images, withMarketplaceImagePlaceholders as fill } from '@/marketplace/marketplaceImagePlaceholders';
import type { MarketplacePreviewSection } from '@/marketplace/marketplaceTemplatePrimitives';

describe('persistent marketplace sample image assignments', () => {
  it('fills Terra House about content identically after serialized reopen without mutating source', () => {
    const section: MarketplacePreviewSection = { id: 'terra-neighborhood-practice', type: 'about', props: { description: 'Neighborhood practice' } };
    const first = fill('terra-house', section);
    expect(first.props).toHaveProperty('image', images.house);
    expect(fill('terra-house', JSON.parse(JSON.stringify(section)))).toEqual(first);
    expect(section.props).not.toHaveProperty('image');
  });

  it('fills every product card while preserving its price and existing image', () => {
    const section: MarketplacePreviewSection = { id: 'products', type: 'services', props: { items: [
      { title: 'Sunday cup', description: 'Cup', price: '$38' },
      { title: 'Watch', description: 'Watch', image: '/existing-watch.jpg' },
    ] } };
    const result = fill('pollen-objects', section);
    expect(result.props).toHaveProperty('items', [
      { title: 'Sunday cup', description: 'Cup', price: '$38', image: images.objects },
      { title: 'Watch', description: 'Watch', image: '/existing-watch.jpg' },
    ]);
  });

  it.each(['team', 'testimonials', 'blog-preview', 'gallery', 'before-after', 'features', 'cta'] as const)('fills the %s image contract', (type) => {
    const sections: Record<typeof type, MarketplacePreviewSection> = {
      team: { id: 'team', type: 'team', props: { members: [{ name: 'Sample', role: 'Host' }] } },
      testimonials: { id: 'notes', type: 'testimonials', props: { items: [{ author: 'Sample', quote: 'Sample' }] } },
      'blog-preview': { id: 'journal', type: 'blog-preview', props: { posts: [{ title: 'Sample', excerpt: 'Sample' }] } },
      gallery: { id: 'gallery', type: 'gallery', props: { items: [{ src: '', alt: 'Sample' }] } },
      'before-after': { id: 'comparison', type: 'before-after', props: { items: [{ before: '', after: '' }] } },
      features: { id: 'features', type: 'features', props: { items: [{ title: 'Sample', description: 'Sample' }] } },
      cta: { id: 'cta', type: 'cta', props: { headline: 'Sample', ctas: [] } },
    };
    const expected = {
      team: { members: [{ name: 'Sample', role: 'Host', image: images.portrait }] },
      testimonials: { items: [{ author: 'Sample', quote: 'Sample', avatar: images.portrait }] },
      'blog-preview': { posts: [{ title: 'Sample', excerpt: 'Sample', image: images.house }] },
      gallery: { items: [{ src: images.house, alt: 'Sample' }] },
      'before-after': { items: [{ before: images.house, after: images.house }] },
      features: { items: [{ title: 'Sample', description: 'Sample', image: images.house }] },
      cta: { headline: 'Sample', ctas: [], backgroundImage: images.house },
    };
    expect(fill('terra-house', sections[type]).props).toEqual(expected[type]);
  });

  it('preserves authored backgrounds and leaves text-only content unchanged', () => {
    const cta: MarketplacePreviewSection = { id: 'cta', type: 'cta', props: { headline: 'Sample', ctas: [], backgroundImage: '/owner-background.jpg' } };
    expect(fill('terra-house', cta)).toEqual(cta);
    const faq: MarketplacePreviewSection = { id: 'faq', type: 'faq', props: { items: [] } };
    expect(fill('terra-house', faq)).toBe(faq);
  });
});