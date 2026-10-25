import house from '@/assets/marketplace-sample-house.jpg';
import objects from '@/assets/marketplace-sample-objects.jpg';
import food from '@/assets/marketplace-sample-food.jpg';
import portrait from '@/assets/marketplace-sample-portrait.jpg';
import workspace from '@/assets/marketplace-sample-workspace.jpg';
import wellness from '@/assets/marketplace-sample-wellness.jpg';
import type { MarketplacePreviewSection } from './marketplaceTemplatePrimitives';

// Durable project assets, not temporary URLs or DOM-only repairs. Existing
// authored pictures and release asset-rights decisions remain untouched.
export const MARKETPLACE_SAMPLE_IMAGES = { house, objects, food, portrait, workspace, wellness };

function sampleForTemplate(templateId: string): string {
  if (templateId === 'sorella-house') return food;
  if (templateId === 'pollen-objects') return objects;
  if (templateId === 'aster-skin-studio' || templateId === 'tempo-field-club') return wellness;
  if (['terra-house', 'formworks-studio', 'lowtide-house', 'northline-works', 'juniper-frame'].includes(templateId)) return house;
  return workspace;
}

function useSampleImage(image: string | undefined, sample: string): string {
  return !image || image === '/assets/marketplace-placeholder.svg' ? sample : image;
}

/** Pure, deterministic content hydration used on Home and every secondary page. */
export function withMarketplaceImagePlaceholders(
  templateId: string,
  section: MarketplacePreviewSection,
): MarketplacePreviewSection {
  const sample = sampleForTemplate(templateId);
  switch (section.type) {
    case 'about':
      return { ...section, props: { ...section.props, image: useSampleImage(section.props.image, sample) } };
    case 'services':
      return { ...section, props: { ...section.props, items: section.props.items.map((item) => ({ ...item, image: useSampleImage(item.image, sample) })) } };
    case 'features':
      return { ...section, props: { ...section.props, items: section.props.items.map((item) => ({ ...item, image: useSampleImage(item.image, sample) })) } };
    case 'gallery':
      return { ...section, props: { ...section.props, items: section.props.items.map((item) => ({ ...item, src: useSampleImage(item.src, sample) })) } };
    case 'team':
      return { ...section, props: { ...section.props, members: section.props.members.map((member) => ({ ...member, image: useSampleImage(member.image, portrait) })) } };
    case 'testimonials':
      return { ...section, props: { ...section.props, items: section.props.items.map((item) => ({ ...item, avatar: useSampleImage(item.avatar, portrait) })) } };
    case 'blog-preview':
      return { ...section, props: { ...section.props, posts: section.props.posts.map((post) => ({ ...post, image: useSampleImage(post.image, sample) })) } };
    case 'before-after':
      return { ...section, props: { ...section.props, items: section.props.items.map((item) => ({ ...item, before: useSampleImage(item.before, sample), after: useSampleImage(item.after, sample) })) } };
    case 'cta':
      return { ...section, props: { ...section.props, backgroundImage: useSampleImage(section.props.backgroundImage, sample) } };
    default:
      return section;
  }
}