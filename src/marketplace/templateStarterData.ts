import { createEmptyCreatorData, type CreatorData } from '@/types/creatorData';
import type { AuthoredMarketplaceTemplate } from './marketplaceTemplatePrimitives';
import { withMarketplaceImagePlaceholders } from './marketplaceImagePlaceholders';

/** Only public authored template content, never seller records or operational settings. */
export function templateStarterData(template: AuthoredMarketplaceTemplate) {
  const data = createEmptyCreatorData(template.name);
  const mediaAssets: Array<{ id: string; kind: string; url: string }> = [];
  const commerce = template.bindings.some(binding => binding.intent === 'cart.add');
  const image = (id: string, url: unknown) => {
    if (typeof url !== 'string' || !url.trim()) return undefined;
    mediaAssets.push({ id, kind: 'image', url });
    return id;
  };
  const text = (value: unknown) => typeof value === 'string' ? value : '';
  const price = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string' || !/^\s*\$?\s*\d[\d,]*(?:\.\d+)?\s*$/.test(value)) return undefined;
    return Number(value.replace(/[$,\s]/g, ''));
  };
  for (const page of template.pages) for (const original of page.sections) {
    const section = withMarketplaceImagePlaceholders(template.id, original);
    const props = section.props as Record<string, unknown>;
    const rows = props.items ?? props.members ?? props.posts;
    if (!Array.isArray(rows)) continue;
    rows.forEach((row: Record<string, unknown>, index: number) => {
      const id = `${section.id}:${index}`;
      const name = text(row.title ?? row.name);
      const imageAssetId = image(`${id}:image`, row.image ?? row.src ?? row.avatar);
      if (section.type === 'services' && name) {
        const amount = price(row.price);
        if (commerce && amount !== undefined) data.products[id] = { productId: id, catalogSurface: 'products', name,
          description: text(row.description), price: amount, currency: 'USD', imageAssetId, sortOrder: index };
        else data.services[id] = { serviceId: id, name, description: text(row.description), price: amount,
          imageAssetId, bookable: template.bindings.some(binding => binding.intent.startsWith('booking.')), sortOrder: index };
      }
      if (section.type === 'faq' && text(row.question)) data.faqs[id] = { faqId: id, question: text(row.question), answer: text(row.answer), sortOrder: index };
      if (section.type === 'testimonials' && text(row.quote)) data.testimonials[id] = { testimonialId: id, author: text(row.author), content: text(row.quote), role: text(row.role), avatarAssetId: imageAssetId, sortOrder: index };
      if (section.type === 'team' && name) data.team[id] = { memberId: id, name, role: text(row.role), bio: text(row.bio), avatarAssetId: imageAssetId, sortOrder: index };
      if (section.type === 'gallery' && imageAssetId) data.gallery[id] = { galleryItemId: id, assetId: imageAssetId, caption: text(row.caption ?? row.alt), category: text(row.category), sortOrder: index };
      if (section.type === 'blog-preview' && name) {
        data.articles ??= {};
        data.articles[id] = { title: name, excerpt: text(row.excerpt), image: text(row.image), author: text(row.author) };
      }
    });
  }
  for (const binding of template.bindings) {
    const product = binding.product;
    if (!product?.name || product.price === undefined) continue;
    const existing = Object.entries(data.products).find(([, item]) => item.name.toLowerCase() === product.name?.toLowerCase());
    if (existing) {
      delete data.products[existing[0]];
      data.products[product.productId] = { ...existing[1], productId: product.productId };
    } else data.products[product.productId] = { productId: product.productId, catalogSurface: 'products', name: product.name,
      price: product.price, currency: 'USD', sortOrder: Object.keys(data.products).length };
  }
  return { creatorData: data as CreatorData, mediaAssets };
}