/**
 * catalogSurfaceRegistry — THE single source of truth for Unison's catalog.
 *
 * Phase 1 (Milestones 1–4): every file that used to hand-roll its own
 * table map, kind→table map, field mapping, or CRUD schema now derives
 * from this registry. If you find yourself declaring `TABLE_SCHEMAS`,
 * `SECTION_DATA_REQUIREMENTS`, `SECTION_DATA_CONTRACTS`, `KIND_DEFAULTS`,
 * `WIZARD_TYPE_TO_REQUIREMENT`, `HYDRATABLE_SECTION_TYPES`, `KNOWN_TABLES`,
 * or `CATALOG_KIND_TO_TABLE` outside of this file — stop and add/adjust a
 * surface here instead.
 *
 * Three orthogonal ID spaces (never conflate them):
 *   - CatalogKind    = business object      ("service", "product", …)
 *   - surfaceId      = builder section key  ("services", "products", …)
 *   - componentType  = React renderer name  ("ServiceGrid", "ProductGrid", …)
 *
 * Legacy names (ServicesGrid, Menu, Portfolio, FeaturedProducts …) are
 * absorbed via `aliases` so old wizard output and old DB rows still resolve
 * to a canonical surface without renaming existing site_data_bindings.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CatalogKind =
  | 'service'
  | 'product'
  | 'menu_item'
  | 'pricing_plan'
  | 'offer'
  | 'testimonial'
  | 'project'
  | 'availability_slot';

export type CatalogSourceTable =
  | 'services'
  | 'products'
  | 'menu_items'
  | 'pricing_plans'
  | 'featured_offers'
  | 'testimonials'
  | 'portfolio_projects'
  | 'availability_slots';

export type CatalogFallbackMode =
  | 'empty_state'
  | 'hide_section'
  | 'show_placeholder';

/** Canonical UI shape every hydrated card renders against. */
export interface CatalogCardViewModel {
  id: string;
  sourceKind: CatalogKind;
  sourceTable: CatalogSourceTable;
  title: string;
  description?: string;
  imageUrl?: string;
  priceCents?: number;
  priceLabel?: string;
  category?: string;
  dietaryTags?: string[];
  featured?: boolean;
  active?: boolean;
  ctaIntent?: string;
  /** Original DB row, preserved so bespoke sections can read extras. */
  raw?: Record<string, unknown>;
}

/** Field type used by BusinessCatalogEditor to render inputs + coerce values. */
export type CatalogFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'money'         // stored as numeric dollars      (products.price)
  | 'money-cents'   // stored as integer cents        (services.price_cents, pricing_plans.price_cents, menu_items.price_cents)
  | 'image'
  | 'tags'
  | 'boolean'
  | 'rating';

export interface CatalogFieldSpec {
  key: string;                        // DB column name
  label: string;                      // Editor label
  type: CatalogFieldType;
  placeholder?: string;
  required?: boolean;
  span?: 'full' | 'half';
}

export interface CatalogSurface {
  /** Canonical UI id — this is what AI Builder + Business Center speak. */
  surfaceId: string;
  /** Business object. */
  catalogKind: CatalogKind;
  /** Underlying Supabase table. */
  sourceTable: CatalogSourceTable;
  /** Canonical React renderer name. */
  componentType: string;
  /** Human labels. */
  friendlyName: string;
  rowLabel: string;
  /** Legacy / synonym section-type strings the wizard or old DB rows may use. */
  aliases: readonly string[];
  /** Business Center route where owners edit rows. */
  editorRoute: string;
  /** Prefix for deterministic binding ids in site_data_bindings. */
  bindingPrefix: string;
  /** Publish/readiness threshold. */
  minRows: number;
  /** What to show when there are no rows. */
  fallbackMode: CatalogFallbackMode;
  /** Default Supabase equality filters for hydration. */
  defaultFilters: Record<string, unknown>;
  /** Default sort. */
  defaultSort: { field: string; direction: 'asc' | 'desc' };
  /** Default row limit. */
  defaultLimit: number;
  /**
   * Canonical → DB column mapping used by both hydration (projection) and
   * autoEmit (site_data_bindings.display_mapping).
   * Keys are CatalogCardViewModel props; values are DB column names.
   */
  fields: {
    title: string;
    description?: string;
    image?: string;
    dietaryTags?: string;
    priceCents?: string;   // integer-cents column
    price?: string;        // numeric-dollars column
    category?: string;
    featured?: string;
    active?: string;
    ctaIntent?: string;
    [extra: string]: string | undefined;
  };
  /** Full editable field list for Business Center CRUD (derived UI). */
  editableFields: readonly CatalogFieldSpec[];
  /** Defaults for a "new row" draft. */
  newRowDefaults: Record<string, unknown>;
  /** Which intents this surface's CTAs may bind to. */
  supportedIntents: readonly string[];
  /** Sort/order column used when listing rows in the editor. */
  editorSortField: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const CATALOG_SURFACES: Record<string, CatalogSurface> = {
  services: {
    surfaceId: 'services',
    catalogKind: 'service',
    sourceTable: 'services',
    componentType: 'ServiceGrid',
    friendlyName: 'Services',
    rowLabel: 'service',
    aliases: ['ServiceGrid', 'ServicesGrid', 'service_grid', 'featured_services', 'services'],
    editorRoute: '/business/services',
    bindingPrefix: 'ServiceGrid',
    minRows: 3,
    fallbackMode: 'empty_state',
    defaultFilters: { is_active: true },
    defaultSort: { field: 'sort_order', direction: 'asc' },
    defaultLimit: 12,
    fields: {
      title: 'name',
      description: 'description',
      image: 'image_url',
      priceCents: 'price_cents',
      category: 'category',
      featured: 'featured',
      active: 'is_active',
      duration: 'duration_minutes',
    },
    editableFields: [
      { key: 'name', label: 'Name', type: 'text', required: true, span: 'full' },
      { key: 'category', label: 'Category', type: 'text', span: 'half' },
      { key: 'duration_minutes', label: 'Duration (min)', type: 'number', span: 'half' },
      { key: 'price_cents', label: 'Price', type: 'money-cents', span: 'half' },
      { key: 'sort_order', label: 'Order', type: 'number', span: 'half' },
      { key: 'image_url', label: 'Image URL', type: 'image', span: 'full' },
      { key: 'description', label: 'Description', type: 'textarea', span: 'full' },
      { key: 'featured', label: 'Featured', type: 'boolean', span: 'half' },
      { key: 'is_active', label: 'Active', type: 'boolean', span: 'half' },
    ],
    newRowDefaults: {
      name: 'New service',
      duration_minutes: 30,
      price_cents: 0,
      sort_order: 0,
      is_active: true,
      featured: false,
    },
    supportedIntents: ['booking.create', 'quote.request', 'contact.submit'],
    editorSortField: 'sort_order',
  },

  products: {
    surfaceId: 'products',
    catalogKind: 'product',
    sourceTable: 'products',
    componentType: 'ProductGrid',
    friendlyName: 'Products',
    rowLabel: 'product',
    aliases: ['ProductGrid', 'ProductsGrid', 'product_grid', 'shop', 'featured_products', 'FeaturedProducts', 'products'],
    editorRoute: '/business/products',
    bindingPrefix: 'ProductGrid',
    minRows: 4,
    fallbackMode: 'empty_state',
    defaultFilters: { is_active: true },
    defaultSort: { field: 'sort_order', direction: 'asc' },
    defaultLimit: 12,
    fields: {
      title: 'name',
      description: 'description',
      image: 'image_url',
      price: 'price',
      category: 'category',
      featured: 'featured',
      active: 'is_active',
      inventory: 'inventory_count',
    },
    editableFields: [
      { key: 'name', label: 'Name', type: 'text', required: true, span: 'full' },
      { key: 'category', label: 'Category', type: 'text', span: 'half' },
      { key: 'price', label: 'Price', type: 'money', span: 'half' },
      { key: 'currency', label: 'Currency', type: 'text', placeholder: 'USD', span: 'half' },
      { key: 'inventory_count', label: 'Inventory', type: 'number', span: 'half' },
      { key: 'sort_order', label: 'Order', type: 'number', span: 'half' },
      { key: 'image_url', label: 'Image URL', type: 'image', span: 'full' },
      { key: 'description', label: 'Description', type: 'textarea', span: 'full' },
      { key: 'featured', label: 'Featured', type: 'boolean', span: 'half' },
      { key: 'is_active', label: 'Active', type: 'boolean', span: 'half' },
    ],
    newRowDefaults: {
      name: 'New product',
      currency: 'USD',
      price: 0,
      inventory_count: 0,
      sort_order: 0,
      is_active: true,
      featured: false,
    },
    supportedIntents: ['cart.add', 'cart.view', 'cart.checkout', 'product.view'],
    editorSortField: 'sort_order',
  },

  menu: {
    surfaceId: 'menu',
    catalogKind: 'menu_item',
    sourceTable: 'menu_items',
    componentType: 'MenuSection',
    friendlyName: 'Menu',
    rowLabel: 'menu item',
    aliases: ['MenuSection', 'Menu', 'menu_section', 'menu', 'menu_items'],
    editorRoute: '/business/menu',
    bindingPrefix: 'MenuSection',
    minRows: 6,
    fallbackMode: 'empty_state',
    defaultFilters: { available: true },
    defaultSort: { field: 'sort_order', direction: 'asc' },
    defaultLimit: 24,
    fields: {
      title: 'name',
      description: 'description',
      image: 'image_url',
      priceCents: 'price_cents',
      category: 'category',
      dietaryTags: 'dietary_tags',
      featured: 'featured',
      active: 'available',
    },
    editableFields: [
      { key: 'name', label: 'Name', type: 'text', required: true, span: 'full' },
      { key: 'category', label: 'Category', type: 'text', span: 'half' },
      { key: 'price_cents', label: 'Price', type: 'money-cents', span: 'half' },
      { key: 'currency', label: 'Currency', type: 'text', placeholder: 'usd', span: 'half' },
      { key: 'sort_order', label: 'Order', type: 'number', span: 'half' },
      { key: 'image_url', label: 'Image URL', type: 'image', span: 'full' },
      { key: 'description', label: 'Description', type: 'textarea', span: 'full' },
      { key: 'dietary_tags', label: 'Dietary tags', type: 'tags', span: 'full' },
      { key: 'available', label: 'Available', type: 'boolean', span: 'half' },
      { key: 'featured', label: 'Featured', type: 'boolean', span: 'half' },
    ],
    newRowDefaults: {
      name: 'New menu item',
      currency: 'usd',
      price_cents: 0,
      sort_order: 0,
      dietary_tags: [],
      available: true,
      featured: false,
    },
    supportedIntents: ['reservation.create', 'order.create', 'cart.add'],
    editorSortField: 'sort_order',
  },

  pricing: {
    surfaceId: 'pricing',
    catalogKind: 'pricing_plan',
    sourceTable: 'pricing_plans',
    componentType: 'PricingTable',
    friendlyName: 'Pricing plans',
    rowLabel: 'pricing plan',
    aliases: ['PricingTable', 'pricing_table', 'pricing', 'plans', 'pricing_plans'],
    editorRoute: '/business/pricing',
    bindingPrefix: 'PricingTable',
    minRows: 2,
    fallbackMode: 'empty_state',
    defaultFilters: { is_active: true },
    defaultSort: { field: 'sort_order', direction: 'asc' },
    defaultLimit: 6,
    fields: {
      title: 'name',
      description: 'description',
      priceCents: 'price_cents',
      featured: 'highlighted',
      active: 'is_active',
      ctaIntent: 'cta_intent',
      billingInterval: 'billing_interval',
    },
    editableFields: [
      { key: 'name', label: 'Plan name', type: 'text', required: true, span: 'full' },
      { key: 'price_cents', label: 'Price', type: 'money-cents', span: 'half' },
      { key: 'currency', label: 'Currency', type: 'text', placeholder: 'usd', span: 'half' },
      {
        key: 'billing_interval',
        label: 'Billing interval',
        type: 'text',
        placeholder: 'monthly | yearly | one-time',
        span: 'half',
      },
      { key: 'sort_order', label: 'Order', type: 'number', span: 'half' },
      { key: 'description', label: 'Description', type: 'textarea', span: 'full' },
      { key: 'highlighted', label: 'Highlighted', type: 'boolean', span: 'half' },
      { key: 'is_active', label: 'Active', type: 'boolean', span: 'half' },
    ],
    newRowDefaults: {
      name: 'New plan',
      currency: 'usd',
      price_cents: 0,
      billing_interval: 'monthly',
      sort_order: 0,
      is_active: true,
      highlighted: false,
    },
    supportedIntents: ['checkout.start', 'contact.form', 'contact.submit'],
    editorSortField: 'sort_order',
  },

  offers: {
    surfaceId: 'offers',
    catalogKind: 'offer',
    sourceTable: 'featured_offers',
    componentType: 'FeaturedOffers',
    friendlyName: 'Featured offers',
    rowLabel: 'offer',
    aliases: ['FeaturedOffers', 'featured_offers', 'offers', 'promotions', 'deals'],
    editorRoute: '/business/offers',
    bindingPrefix: 'FeaturedOffers',
    minRows: 1,
    fallbackMode: 'hide_section',
    defaultFilters: { active: true },
    defaultSort: { field: 'sort_order', direction: 'asc' },
    defaultLimit: 6,
    fields: {
      title: 'title',
      description: 'description',
      image: 'image_url',
      featured: 'active',
      active: 'active',
      ctaIntent: 'cta_intent',
      badge: 'discount_label',
      subtitle: 'subtitle',
      ctaLabel: 'cta_label',
      ctaHref: 'cta_href',
    },
    editableFields: [
      { key: 'title', label: 'Title', type: 'text', required: true, span: 'full' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', span: 'full' },
      { key: 'discount_label', label: 'Discount label', type: 'text', span: 'half' },
      { key: 'cta_label', label: 'CTA label', type: 'text', span: 'half' },
      { key: 'cta_href', label: 'CTA link', type: 'text', span: 'half' },
      { key: 'cta_intent', label: 'CTA intent', type: 'text', placeholder: 'nav.goto', span: 'half' },
      { key: 'sort_order', label: 'Order', type: 'number', span: 'half' },
      { key: 'image_url', label: 'Image URL', type: 'image', span: 'full' },
      { key: 'description', label: 'Description', type: 'textarea', span: 'full' },
      { key: 'active', label: 'Active', type: 'boolean', span: 'half' },
    ],
    newRowDefaults: {
      title: 'New offer',
      sort_order: 0,
      active: true,
    },
    supportedIntents: ['nav.goto', 'cart.add', 'contact.form', 'contact.submit'],
    editorSortField: 'sort_order',
  },

  testimonials: {
    surfaceId: 'testimonials',
    catalogKind: 'testimonial',
    sourceTable: 'testimonials',
    componentType: 'Testimonials',
    friendlyName: 'Testimonials',
    rowLabel: 'testimonial',
    aliases: ['Testimonials', 'testimonials', 'testimonial', 'reviews', 'review', 'social_proof', 'social-proof', 'customer_reviews', 'customer-reviews'],
    editorRoute: '/business/testimonials',
    bindingPrefix: 'Testimonials',
    minRows: 3,
    fallbackMode: 'hide_section',
    defaultFilters: {},
    defaultSort: { field: 'sort_order', direction: 'asc' },
    defaultLimit: 9,
    fields: {
      title: 'author_name',
      description: 'quote',
      image: 'author_avatar_url',
      featured: 'featured',
      role: 'author_role',
      rating: 'rating',
    },
    editableFields: [
      { key: 'author_name', label: 'Author name', type: 'text', required: true, span: 'half' },
      { key: 'author_role', label: 'Author role', type: 'text', span: 'half' },
      { key: 'rating', label: 'Rating (0–5)', type: 'rating', span: 'half' },
      { key: 'source', label: 'Source', type: 'text', placeholder: 'Google, Yelp…', span: 'half' },
      { key: 'author_avatar_url', label: 'Avatar URL', type: 'image', span: 'full' },
      { key: 'quote', label: 'Quote', type: 'textarea', required: true, span: 'full' },
      { key: 'sort_order', label: 'Order', type: 'number', span: 'half' },
      { key: 'featured', label: 'Featured', type: 'boolean', span: 'half' },
    ],
    newRowDefaults: {
      author_name: 'New reviewer',
      quote: '',
      sort_order: 0,
      featured: false,
    },
    supportedIntents: [],
    editorSortField: 'sort_order',
  },

  portfolio: {
    surfaceId: 'portfolio',
    catalogKind: 'project',
    sourceTable: 'portfolio_projects',
    componentType: 'PortfolioGrid',
    friendlyName: 'Portfolio',
    rowLabel: 'project',
    aliases: ['PortfolioGrid', 'Portfolio', 'portfolio_grid', 'portfolio', 'projects', 'project', 'portfolio_projects', 'portfolio-projects', 'case_studies', 'gallery', 'work'],
    editorRoute: '/business/portfolio',
    bindingPrefix: 'PortfolioGrid',
    minRows: 3,
    fallbackMode: 'hide_section',
    defaultFilters: {},
    defaultSort: { field: 'sort_order', direction: 'asc' },
    defaultLimit: 12,
    fields: {
      title: 'title',
      description: 'summary',
      image: 'cover_image_url',
      featured: 'featured',
      subtitle: 'subtitle',
      client: 'client_name',
    },
    editableFields: [
      { key: 'title', label: 'Title', type: 'text', required: true, span: 'full' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', span: 'half' },
      { key: 'client_name', label: 'Client', type: 'text', span: 'half' },
      { key: 'external_url', label: 'External URL', type: 'text', span: 'half' },
      { key: 'sort_order', label: 'Order', type: 'number', span: 'half' },
      { key: 'cover_image_url', label: 'Cover image URL', type: 'image', span: 'full' },
      { key: 'summary', label: 'Summary', type: 'textarea', span: 'full' },
      { key: 'featured', label: 'Featured', type: 'boolean', span: 'half' },
    ],
    newRowDefaults: {
      title: 'New project',
      sort_order: 0,
      featured: false,
    },
    supportedIntents: ['nav.goto'],
    editorSortField: 'sort_order',
  },

  availability: {
    surfaceId: 'availability',
    catalogKind: 'availability_slot',
    sourceTable: 'availability_slots',
    componentType: 'BookingAvailability',
    friendlyName: 'Availability',
    rowLabel: 'time slot',
    aliases: ['BookingAvailability', 'availability', 'availability_slots', 'slots'],
    editorRoute: '/business/availability',
    bindingPrefix: 'BookingAvailability',
    minRows: 5,
    fallbackMode: 'empty_state',
    defaultFilters: { is_booked: false },
    defaultSort: { field: 'starts_at', direction: 'asc' },
    defaultLimit: 20,
    fields: {
      title: 'starts_at',
      startsAt: 'starts_at',
      endsAt: 'ends_at',
      booked: 'is_booked',
    },
    // Availability has its own calendar surface; editor CRUD is intentionally empty.
    editableFields: [],
    newRowDefaults: {},
    supportedIntents: ['booking.create'],
    editorSortField: 'starts_at',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Derived indexes (built once at module load)
// ─────────────────────────────────────────────────────────────────────────────

const SURFACES = Object.values(CATALOG_SURFACES);

const ALIAS_INDEX: Map<string, CatalogSurface> = (() => {
  const m = new Map<string, CatalogSurface>();
  for (const s of SURFACES) {
    // Index by every legal spelling: surfaceId, componentType, catalogKind, sourceTable, plus each alias.
    const spellings = new Set<string>([
      s.surfaceId,
      s.componentType,
      s.catalogKind,
      s.sourceTable,
      s.bindingPrefix,
      ...s.aliases,
    ]);
    for (const raw of spellings) {
      m.set(normalizeKey(raw), s);
    }
  }
  return m;
})();

function normalizeKey(raw: string): string {
  return String(raw ?? '').trim().toLowerCase().replace(/[-\s]/g, '_');
}

// ─────────────────────────────────────────────────────────────────────────────
// Lookup API — every other file must use these, never local maps.
// ─────────────────────────────────────────────────────────────────────────────

export function getCatalogSurface(anySpelling: string): CatalogSurface | null {
  if (!anySpelling) return null;
  return ALIAS_INDEX.get(normalizeKey(anySpelling)) ?? null;
}

export function getCatalogSurfaceByTable(
  table: CatalogSourceTable | string,
): CatalogSurface | null {
  return getCatalogSurface(table);
}

export function getCatalogSurfaceByKind(
  kind: CatalogKind | string,
): CatalogSurface | null {
  return getCatalogSurface(kind);
}

export function listCatalogSurfaces(): CatalogSurface[] {
  return [...SURFACES];
}

/** Full set of Supabase tables the catalog runtime can read/write. */
export function listCatalogTables(): CatalogSourceTable[] {
  return SURFACES.map((s) => s.sourceTable);
}

/** kind → table map. Replaces the old CATALOG_KIND_TO_TABLE constant. */
export const CATALOG_KIND_TO_TABLE: Record<CatalogKind, CatalogSourceTable> = (() => {
  const out = {} as Record<CatalogKind, CatalogSourceTable>;
  for (const s of SURFACES) out[s.catalogKind] = s.sourceTable;
  return out;
})();

/** Every legal section-type string (aliases + canonical) — used by hydration. */
export function isHydratableSectionType(anySpelling: string): boolean {
  return getCatalogSurface(anySpelling) !== null;
}

export function listHydratableSectionTypes(): string[] {
  const s = new Set<string>();
  for (const surface of SURFACES) {
    s.add(surface.surfaceId);
    s.add(surface.componentType);
    for (const a of surface.aliases) s.add(a);
  }
  return [...s];
}

// ─────────────────────────────────────────────────────────────────────────────
// View-model projection — replaces price/price_cents split forever.
// ─────────────────────────────────────────────────────────────────────────────

function formatMoney(cents: number, currency = 'USD'): string {
  const dollars = cents / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
    }).format(dollars);
  } catch {
    return `$${dollars.toFixed(2)}`;
  }
}

/**
 * Project a raw DB row into the canonical `CatalogCardViewModel`.
 * Handles the money split so downstream renderers only see `priceCents`
 * and a display-ready `priceLabel`.
 */
export function projectRowToCardViewModel(
  surface: CatalogSurface,
  row: Record<string, unknown>,
): CatalogCardViewModel {
  const f = surface.fields;
  const pick = (col?: string): unknown => (col ? row[col] : undefined);
  const asString = (v: unknown): string | undefined =>
    v == null ? undefined : String(v);
  const asBool = (v: unknown): boolean | undefined =>
    typeof v === 'boolean' ? v : v == null ? undefined : Boolean(v);

  // Money: prefer explicit cents column, otherwise fall back to numeric-dollars column.
  let priceCents: number | undefined;
  const rawCents = pick(f.priceCents);
  const rawPrice = pick(f.price);
  if (typeof rawCents === 'number' && Number.isFinite(rawCents)) {
    priceCents = Math.round(rawCents);
  } else if (typeof rawPrice === 'number' && Number.isFinite(rawPrice)) {
    priceCents = Math.round(rawPrice * 100);
  } else if (typeof rawPrice === 'string' && rawPrice.trim() !== '') {
    const n = Number(rawPrice);
    if (Number.isFinite(n)) priceCents = Math.round(n * 100);
  }
  const currency =
    (row['currency'] as string | undefined) ??
    (row['currency_code'] as string | undefined) ??
    'USD';
  const priceLabel =
    priceCents != null ? formatMoney(priceCents, currency) : undefined;

  return {
    id: String(row['id'] ?? ''),
    sourceKind: surface.catalogKind,
    sourceTable: surface.sourceTable,
    title: asString(pick(f.title)) ?? '',
    description: asString(pick(f.description)),
    imageUrl: asString(pick(f.image)),
    priceCents,
    priceLabel,
    category: asString(pick(f.category)),
    featured: asBool(pick(f.featured)),
    active: asBool(pick(f.active)),
    ctaIntent: asString(pick(f.ctaIntent)),
    raw: row,
  };
}

/** Build the `display_mapping` blob written into `site_data_bindings`. */
export function buildDisplayMappingForBinding(
  surface: CatalogSurface,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(surface.fields)) {
    if (v) out[k] = v;
  }
  return out;
}
