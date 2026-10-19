/**
 * Launch asset seeding — after the first accepted revision, save the products,
 * services and business details the launch already planned, so a fresh site
 * opens with live, editable assets. Idempotent: never overwrites, never
 * duplicates by name. Writes only through the shared catalog operations and
 * the business profile service.
 */
import { createCatalogItem, listCatalog } from '@/services/agent-runtime/catalogOps';
import { loadBusinessProfile, saveBusinessProfile, type BusinessProfilePatch } from '@/services/businessProfileService';
import { createContentRecord, listContentRecords, listContentTypes, mutateContentRecord } from '@/services/cmsRecordService';
import type { CreatorData, CreatorProduct } from '@/types/creatorData';
import { normalizeIndustryKey } from '@/platform/core/industryMatrix';
import { canonicalContentSlug } from './resourceRegistry';
import type { AssetBundle } from '@/types/siteBundle';

/** Content types a fresh launch can seed, mapped from CreatorData collections. */
export const SEED_CONTENT_TYPES: Record<string, { displayName: string; fields: { key: string; label: string; type: string }[] }> = {
  faq: { displayName: 'FAQs', fields: [
    { key: 'question', label: 'Question', type: 'text' },
    { key: 'answer', label: 'Answer', type: 'textarea' },
    { key: 'category', label: 'Category', type: 'text' },
    { key: 'sort_order', label: 'Order', type: 'number' },
  ] },
  team: { displayName: 'Team', fields: [
    { key: 'role', label: 'Role', type: 'text' },
    { key: 'bio', label: 'Bio', type: 'textarea' },
    { key: 'sort_order', label: 'Order', type: 'number' },
    { key: 'avatar_url', label: 'Avatar', type: 'image' },
    { key: 'social_links', label: 'Social links', type: 'json' },
  ] },
  gallery: { displayName: 'Gallery', fields: [
    { key: 'caption', label: 'Caption', type: 'text' },
    { key: 'category', label: 'Category', type: 'text' },
    { key: 'asset_id', label: 'Asset ID', type: 'text' },
    { key: 'sort_order', label: 'Order', type: 'number' },
  ] },
  articles: { displayName: 'Articles', fields: [
    { key: 'slug', label: 'Link name', type: 'text' },
    { key: 'category', label: 'Category', type: 'text' },
    { key: 'published_on', label: 'Date', type: 'text' },
    { key: 'author', label: 'Author', type: 'text' },
    { key: 'read_time', label: 'Reading time', type: 'text' },
    { key: 'excerpt', label: 'Summary', type: 'textarea' },
    { key: 'body', label: 'Full text', type: 'textarea' },
    { key: 'image_url', label: 'Image', type: 'text' },
  ] },
  'case-studies': { displayName: 'Case studies', fields: [
    { key: 'slug', label: 'Link name', type: 'text' },
    { key: 'client', label: 'Client', type: 'text' },
    { key: 'category', label: 'Category', type: 'text' },
    { key: 'excerpt', label: 'Summary', type: 'textarea' },
    { key: 'results', label: 'Results', type: 'textarea' },
    { key: 'body', label: 'Full story', type: 'textarea' },
    { key: 'image_url', label: 'Image', type: 'text' },
  ] },
};

export const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
interface LongformPlan { title?: string; name?: string; excerpt?: string; description?: string; category?: string; author?: string; date?: string; readTime?: string; body?: string; client?: string; results?: string; image?: string }

export interface SeedLaunchAssetsResult { created: number; profileFields: string[] }

export function resolveProductCatalogSurface(
  industry: string | null | undefined,
  product: Pick<CreatorProduct, 'name' | 'category' | 'tags' | 'fulfillmentType' | 'billingType' | 'catalogSurface'>,
): 'menu' | 'pricing' | 'products' {
  if (product.catalogSurface) return product.catalogSurface;
  const normalizedIndustry = normalizeIndustryKey(String(industry ?? ''));
  if (normalizedIndustry === 'saas' && product.billingType === 'subscription') return 'pricing';
  if (normalizedIndustry !== 'restaurant') return 'products';
  const productContext = [product.name, product.category, ...(product.tags ?? []), product.fulfillmentType]
    .filter(Boolean)
    .join(' ');
  return /\b(gift cards?|merch(?:andise)?|apparel|t-?shirts?|souvenirs?|retail|store credit)\b/i.test(productContext)
    ? 'products'
    : 'menu';
}

export function resolveProductCatalogSurfaces(
  industry: string | null | undefined,
  product: Pick<CreatorProduct, 'name' | 'category' | 'tags' | 'fulfillmentType' | 'billingType' | 'catalogSurface'>,
  enableProductCommerce = false,
): Array<'menu' | 'pricing' | 'products'> {
  const surface = resolveProductCatalogSurface(industry, product);
  return (surface === 'menu' || surface === 'pricing') && enableProductCommerce
    ? [surface, 'products']
    : [surface];
}

export async function seedLaunchAssets(input: { businessId: string; projectId?: string | null; industry?: string | null; enableProductCommerce?: boolean; creatorData?: CreatorData | null; assets?: Readonly<Record<string, AssetBundle>>; mediaAssets?: readonly { id: string; kind: string; url: string }[] }): Promise<SeedLaunchAssetsResult> {
  const data = input.creatorData;
  const result: SeedLaunchAssetsResult = { created: 0, profileFields: [] };
  if (!data) return result;
  const mediaUrl = (assetId: string | undefined): string | undefined => {
    const asset = assetId ? input.assets?.[assetId] : undefined;
    const media = input.mediaAssets?.find((entry) => entry.id === assetId && entry.kind === 'image');
    const url = asset?.type === 'image' ? asset.storage.url : media?.url;
    return url && /^https?:\/\//i.test(url) ? url : undefined;
  };
  const existing = await listCatalog(input.businessId, ['products', 'services', 'menu', 'pricing', 'testimonials'], input.projectId).catch(() => []);
  const have = new Set(existing.map((i) => `${i.surfaceId}:${i.name.trim().toLowerCase()}`));
  const plans: { surface: string; name: string; description?: string; price?: number | null; active?: boolean; extra?: Record<string, unknown> }[] = [
    ...Object.values(data.products ?? {}).flatMap((p) =>
      resolveProductCatalogSurfaces(input.industry, p, input.enableProductCommerce).map((surface) => ({
        surface,
        name: p.name,
        description: p.description,
        price: p.price,
        active: p.status !== 'draft' && p.status !== 'archived' && p.visibility !== 'hidden',
        extra: surface === 'menu' ? {
          image_url: mediaUrl(p.imageAssetId ?? p.images?.[0]?.assetId),
          category: p.category,
          featured: p.featured,
          available: p.status !== 'draft' && p.status !== 'archived' && p.visibility !== 'hidden',
          sort_order: p.sortOrder,
          currency: p.currency,
        } : surface === 'pricing' ? {
          billing_interval: p.billingInterval ? ({ week: 'weekly', month: 'monthly', quarter: 'quarterly', year: 'yearly' } as const)[p.billingInterval] : p.billingType === 'one_time' ? 'one-time' : 'monthly',
          highlighted: p.featured,
          sort_order: p.sortOrder,
          currency: p.currency,
        } : { image_url: mediaUrl(p.imageAssetId ?? p.images?.[0]?.assetId), category: p.category, featured: p.featured, sort_order: p.sortOrder, currency: p.currency, inventory_count: p.stockQuantity },
      }))),
    ...Object.values(data.services ?? {}).map((s) => ({
      surface: 'services',
      name: s.name,
      description: s.description,
      price: s.price ?? null,
      active: s.visibility !== 'hidden',
      extra: {
        image_url: mediaUrl(s.imageAssetId),
        category: s.category,
        duration_minutes: s.duration,
        featured: s.featured,
        sort_order: s.sortOrder,
        currency: s.currency,
      },
    })),
    ...Object.values(data.testimonials ?? {}).filter((t) => t.content?.trim()).map((t) => ({
      surface: 'testimonials', name: t.author, description: t.content,
      extra: { author_avatar_url: mediaUrl(t.avatarAssetId), author_role: [t.role, t.company].filter(Boolean).join(', ') || undefined, rating: t.rating, sort_order: t.sortOrder },
    })),
  ];
  for (const p of plans) {
    const name = String(p.name ?? '').trim();
    const isTestimonial = p.surface === 'testimonials';
    if (!name || have.has(`${p.surface}:${name.toLowerCase()}`)) continue;
    await createCatalogItem(input.businessId, p.surface, isTestimonial
      ? { name, description: p.description ?? null, ...(p.extra ?? {}) }
      : { name, description: p.description ?? null, price: p.price ?? null, active: p.active ?? true, ...(p.extra ?? {}) }, input.projectId);
    have.add(`${p.surface}:${name.toLowerCase()}`);
    result.created += 1;
  }
  const info = data.businessInfo;
  const profile = await loadBusinessProfile(input.businessId).catch(() => null);
  if (info && profile) {
    const patch: Record<string, unknown> = {};
    const cur = profile as unknown as Record<string, unknown>;
    for (const [k, v] of [['name', info.businessName], ['tagline', info.tagline], ['description', info.description], ['phone', info.phone], ['email', info.email], ['notificationEmail', info.notificationEmail]] as const) {
      if (v && !cur[k]) patch[k] = v;
    }
    // Brand and contact details: only fill fields the business has not set.
    if (info.brandProfile?.primaryColor && !cur.brandColor) patch.brandColor = info.brandProfile.primaryColor;
    if (info.socialLinks && Object.keys(info.socialLinks).length && !Object.keys((cur.socialLinks as Record<string, unknown>) ?? {}).length) {
      patch.socialLinks = info.socialLinks;
    }
    if (info.hours?.length && !(cur.hours as unknown[])?.length) patch.hours = info.hours;
    if (info.address && !Object.keys((cur.address as Record<string, unknown>) ?? {}).length) {
      patch.address = { line1: info.address };
    }
    if (Object.keys(patch).length) {
      await saveBusinessProfile(input.businessId, patch as BusinessProfilePatch);
      result.profileFields = Object.keys(patch);
    }
  }

  // Seed FAQs, team members and gallery items as content entries. Content
  // types are created on demand per business; entries are deduped by title.
  const contentPlans: { type: string; title: string; data: Record<string, unknown> }[] = [
    ...Object.values(data.faqs ?? {}).filter((f) => f.question?.trim()).map((f) => ({
      type: 'faq', title: f.question,
      data: { question: f.question, answer: f.answer, category: f.category, sort_order: f.sortOrder },
    })),
    ...Object.values(data.team ?? {}).filter((m) => m.name?.trim()).map((m) => ({
      type: 'team', title: m.name,
      data: { role: m.role, bio: m.bio, sort_order: m.sortOrder, avatar_url: mediaUrl(m.avatarAssetId), social_links: m.socialLinks },
    })),
    ...Object.values(data.gallery ?? {}).filter((g) => g.caption?.trim() || g.assetId).map((g) => ({
      type: 'gallery', title: g.caption?.trim() || 'Gallery item',
      data: { caption: g.caption, category: g.category, asset_id: g.assetId, sort_order: g.sortOrder },
    })),
    ...longform(data, 'articles', 'articles'),
    ...longform(data, 'caseStudies', 'case-studies'),
  ];
  if (contentPlans.length) {
    const types = await listContentTypes({ businessId: input.businessId, projectId: input.projectId });
    const typeIdByKey = new Map<string, string>();
    for (const t of types) {
      const key = String(t.api_key ?? '').trim();
      if (key && t.id) typeIdByKey.set(canonicalContentSlug(key), String(t.id));
    }
    for (const [key, def] of Object.entries(SEED_CONTENT_TYPES)) {
      if (typeIdByKey.has(key) || !contentPlans.some((p) => p.type === key)) continue;
      const created = await mutateContentRecord({
        action: 'content-type-create', businessId: input.businessId, projectId: input.projectId,
        values: { apiKey: key.replace(/-/g, '_'), displayName: def.displayName, fieldSchema: { fields: def.fields } },
      });
      const id = created?.record?.id;
      if (!id) throw new Error(`CMS content-type-create ${key}: the CMS returned no content type id.`);
      typeIdByKey.set(key, String(id));
    }
    for (const plan of contentPlans) {
      const typeId = typeIdByKey.get(plan.type);
      if (!typeId) continue;
      const existingEntries = await listContentRecords({ businessId: input.businessId, projectId: input.projectId, contentTypeId: typeId });
      const titles = new Set(existingEntries.map((e) => String(e.title ?? '').trim().toLowerCase()));
      if (titles.has(plan.title.toLowerCase())) continue;
      await createContentRecord({
        businessId: input.businessId, projectId: input.projectId, contentTypeId: typeId, status: 'published',
        values: { title: plan.title, data: plan.data },
      });
      titles.add(plan.title.toLowerCase());
      result.created += 1;
    }
  }
  return result;
}

/** Articles / case studies: optional launch collections (not all industries plan them). */
function longform(data: CreatorData, field: string, type: string) {
  const bag = ((data as unknown as Record<string, Record<string, LongformPlan> | undefined>)[field]) ?? {};
  return Object.values(bag).map((a) => ({ a, title: String(a.title ?? a.name ?? '').trim() })).filter((x) => x.title).map(({ a, title }) => ({
    type, title,
    data: type === 'articles'
      ? { slug: slugify(title), category: a.category, published_on: a.date, author: a.author, read_time: a.readTime, excerpt: a.excerpt ?? a.description, body: a.body, image_url: a.image }
      : { slug: slugify(title), client: a.client, category: a.category, excerpt: a.excerpt ?? a.description, results: a.results, body: a.body, image_url: a.image },
  }));
}

/**
 * Adopt articles / case studies a live site already shows (source scan) into
 * saved content. Idempotent: creates the type on demand, dedupes by title,
 * never overwrites. Works for any industry and pre-existing sites.
 */
export async function adoptLongformFromSite(input: { businessId: string; projectId?: string | null; vfsFiles: Record<string, string> }): Promise<number> {
  const { extractLongformFromSource } = await import('./longformPages');
  const found = extractLongformFromSource(input.vfsFiles);
  if (!found.length) return 0;
  const types = await listContentTypes({ businessId: input.businessId, projectId: input.projectId }).catch(() => [] as Array<Record<string, unknown>>);
  const typeIdByKey = new Map<string, string>();
  for (const t of types) if (t.api_key && t.id) typeIdByKey.set(canonicalContentSlug(String(t.api_key)), String(t.id));
  let created = 0;
  for (const key of ['articles', 'case-studies'] as const) {
    const items = found.filter((f) => f.kind === key);
    if (!items.length) continue;
    if (!typeIdByKey.has(key)) {
      const def = SEED_CONTENT_TYPES[key];
      const res = await mutateContentRecord({ action: 'content-type-create', businessId: input.businessId, projectId: input.projectId, values: { apiKey: key.replace(/-/g, '_'), displayName: def.displayName, fieldSchema: { fields: def.fields } } }).catch(() => null);
      if (res?.record?.id) typeIdByKey.set(key, String(res.record.id));
    }
    const typeId = typeIdByKey.get(key);
    if (!typeId) continue;
    const existing = await listContentRecords({ businessId: input.businessId, projectId: input.projectId, contentTypeId: typeId }).catch(() => [] as Array<Record<string, unknown>>);
    const titles = new Set(existing.map((e) => String(e.title ?? '').trim().toLowerCase()));
    for (const f of items) {
      if (titles.has(f.title.toLowerCase())) continue;
      await createContentRecord({
        businessId: input.businessId, projectId: input.projectId, contentTypeId: typeId, status: 'published',
        values: { title: f.title, data: { slug: f.slug || slugify(f.title), category: f.category, published_on: f.date, author: f.author, read_time: f.readTime, excerpt: f.excerpt } },
      });
      titles.add(f.title.toLowerCase());
      created += 1;
    }
  }
  return created;
}
