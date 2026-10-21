import { createClient } from "npm:@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
type RuntimeClient = any;
import { publicCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { secureJsonResponse, errorResponse } from "../_shared/response.ts";
import { safeParseBody } from "../_shared/validate.ts";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "../_shared/rateLimit.ts";

const RATE_LIMIT_CONFIG = { maxRequests: 60, windowSeconds: 60 };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Surface = {
  sourceKind: string;
  sourceTable: string;
  requiredCapability: string;
  bindingPrefix: string;
  aliases: string[];
  columns: string[];
  title: string;
  description?: string;
  image?: string;
  priceCents?: string;
  price?: string;
  category?: string;
  featured?: string;
  active?: string;
  ctaIntent?: string;
};

const SURFACES: Record<string, Surface> = {
  services: {
    sourceKind: "service", sourceTable: "services",
    requiredCapability: "catalog.services",
    bindingPrefix: "ServiceGrid", aliases: ["servicegrid", "servicesgrid", "service_grid", "featured_services", "services"],
    columns: ["id", "name", "description", "image_url", "price_cents", "currency", "category", "featured", "is_active", "duration_minutes"],
    title: "name", description: "description", image: "image_url", priceCents: "price_cents", category: "category", featured: "featured", active: "is_active",
  },
  products: {
    sourceKind: "product", sourceTable: "products",
    requiredCapability: "catalog.products",
    bindingPrefix: "ProductGrid", aliases: ["productgrid", "productsgrid", "product_grid", "shop", "featured_products", "products"],
    columns: ["id", "name", "description", "image_url", "price", "currency", "category", "featured", "is_active", "inventory_count"],
    title: "name", description: "description", image: "image_url", price: "price", category: "category", featured: "featured", active: "is_active",
  },
  menu_items: {
    sourceKind: "menu_item", sourceTable: "menu_items",
    requiredCapability: "catalog.menu",
    bindingPrefix: "MenuSection", aliases: ["menusection", "menu", "menu_section", "menu_items"],
    columns: ["id", "name", "description", "image_url", "price_cents", "currency", "category", "featured", "available"],
    title: "name", description: "description", image: "image_url", priceCents: "price_cents", category: "category", featured: "featured", active: "available",
  },
  pricing_plans: {
    sourceKind: "pricing_plan", sourceTable: "pricing_plans",
    requiredCapability: "cms.content",
    bindingPrefix: "PricingTable", aliases: ["pricingtable", "pricing_table", "pricing", "plans", "pricing_plans"],
    columns: ["id", "name", "description", "price_cents", "currency", "highlighted", "is_active", "cta_intent", "billing_interval"],
    title: "name", description: "description", priceCents: "price_cents", featured: "highlighted", active: "is_active", ctaIntent: "cta_intent",
  },
  featured_offers: {
    sourceKind: "offer", sourceTable: "featured_offers",
    requiredCapability: "cms.content",
    bindingPrefix: "FeaturedOffers", aliases: ["featuredoffers", "featured_offers", "offers", "promotions", "deals"],
    columns: ["id", "title", "subtitle", "description", "image_url", "cta_label", "cta_intent", "cta_href", "discount_label", "active"],
    title: "title", description: "description", image: "image_url", featured: "active", active: "active", ctaIntent: "cta_intent",
  },
  testimonials: {
    sourceKind: "testimonial", sourceTable: "testimonials",
    requiredCapability: "cms.content",
    bindingPrefix: "Testimonials", aliases: ["testimonials", "reviews", "social_proof"],
    columns: ["id", "author_name", "author_role", "author_avatar_url", "quote", "rating", "source", "featured"],
    title: "author_name", description: "quote", image: "author_avatar_url", featured: "featured",
  },
  portfolio_projects: {
    sourceKind: "project", sourceTable: "portfolio_projects",
    requiredCapability: "cms.content",
    bindingPrefix: "PortfolioGrid", aliases: ["portfoliogrid", "portfolio", "portfolio_grid", "projects", "case_studies", "gallery", "work"],
    columns: ["id", "title", "subtitle", "summary", "cover_image_url", "client_name", "external_url", "featured"],
    title: "title", description: "summary", image: "cover_image_url", featured: "featured",
  },
  availability_slots: {
    sourceKind: "availability_slot", sourceTable: "availability_slots",
    requiredCapability: "booking",
    bindingPrefix: "BookingAvailability", aliases: ["bookingavailability", "availability", "availability_slots", "slots"],
    columns: ["id", "starts_at", "ends_at", "is_booked", "service_id"],
    title: "starts_at", active: "is_booked",
  },
};

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function primitiveFilters(filters: unknown, surface: Surface): Array<[string, string | number | boolean]> {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) return [];
  const allowed = new Set(surface.columns);
  return Object.entries(filters as Record<string, unknown>).flatMap(([key, value]) => {
    if (!allowed.has(key) || !["string", "number", "boolean"].includes(typeof value)) return [];
    return [[key, value as string | number | boolean]];
  });
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function projectCard(surface: Surface, row: Record<string, unknown>) {
  const pick = (column?: string) => column ? row[column] : undefined;
  const asString = (value: unknown) => value == null ? undefined : String(value);
  const asBool = (value: unknown) => typeof value === "boolean" ? value : undefined;
  const centsValue = pick(surface.priceCents);
  const priceValue = pick(surface.price);
  const priceCents = typeof centsValue === "number"
    ? Math.round(centsValue)
    : typeof priceValue === "number" ? Math.round(priceValue * 100) : undefined;

  return {
    id: String(row.id ?? ""),
    sourceKind: surface.sourceKind,
    sourceTable: surface.sourceTable,
    title: asString(pick(surface.title)) ?? "",
    description: asString(pick(surface.description)),
    imageUrl: asString(pick(surface.image)),
    priceCents,
    priceLabel: priceCents == null ? undefined : formatPrice(priceCents),
    category: asString(pick(surface.category)),
    featured: asBool(pick(surface.featured)),
    active: asBool(pick(surface.active)),
    ctaIntent: asString(pick(surface.ctaIntent)),
    raw: row,
  };
}

function findSurface(sectionType: string): Surface | null {
  const normalized = sectionType.toLowerCase().replace(/[\s-]/g, "_");
  return Object.values(SURFACES).find((surface) =>
    surface.sourceTable === normalized ||
    surface.sourceKind === normalized ||
    surface.bindingPrefix.toLowerCase() === normalized ||
    surface.aliases.includes(normalized),
  ) ?? null;
}

async function loadRuntimeContext(supabase: RuntimeClient, siteId: string) {
  const [siteResult, runtimeResult, capabilityResult] = await Promise.all([
    supabase.from("sites").select("id,business_id,status").eq("id", siteId).maybeSingle(),
    supabase.from("site_runtime_configs").select("site_id,public_runtime_enabled").eq("site_id", siteId).maybeSingle(),
    supabase.from("site_capabilities").select("capability_id,status").eq("site_id", siteId).eq("capability_id", "business_profile").eq("status", "enabled").maybeSingle(),
  ]);
  if (siteResult.error || runtimeResult.error || capabilityResult.error) return null;
  if (!siteResult.data || !runtimeResult.data?.public_runtime_enabled || !capabilityResult.data) return null;
  if (!['preview', 'published'].includes(siteResult.data.status)) return null;

  const projectResult = await supabase
    .from("projects")
    .select("id,business_id")
    .eq("site_id", siteId)
    .eq("business_id", siteResult.data.business_id)
    .maybeSingle();
  if (projectResult.error || !projectResult.data) return null;

  return {
    businessId: siteResult.data.business_id as string,
    projectId: projectResult.data.id as string,
  };
}

async function isSurfaceEnabled(
  supabase: RuntimeClient,
  siteId: string,
  surface: Surface,
): Promise<boolean> {
  const legacyCapabilityId = surface.requiredCapability === 'catalog.services'
    || surface.requiredCapability === 'catalog.menu'
    ? 'booking'
    : null;
  const { data, error } = await supabase
    .from("site_capabilities")
    .select("capability_id")
    .eq("site_id", siteId)
    .in("capability_id", legacyCapabilityId
      ? [surface.requiredCapability, legacyCapabilityId]
      : [surface.requiredCapability])
    .eq("status", "enabled")
    .maybeSingle();
  return !error && Boolean(data);
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req, publicCorsHeaders);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405, publicCorsHeaders);

  const limiter = checkRateLimit("site-runtime-read", getClientIp(req), RATE_LIMIT_CONFIG);
  const rateHeaders = rateLimitHeaders(limiter, RATE_LIMIT_CONFIG);
  if (!limiter.allowed) {
    return secureJsonResponse({ success: false, error: "Too many runtime requests. Please try again later." }, 429, publicCorsHeaders, rateHeaders);
  }

  const { data: body, error: bodyError } = await safeParseBody<Record<string, unknown>>(req, 16_384);
  if (bodyError || !body || !isUuid(body.siteId)) {
    return errorResponse("Invalid site runtime request", 400, publicCorsHeaders);
  }
  if (body.type !== "catalog" && body.type !== "profile" && body.type !== "watch") {
    return errorResponse("Unsupported site runtime request", 400, publicCorsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !secretKey) {
    console.error("[site-runtime-read] missing Supabase server credentials");
    return errorResponse("Runtime temporarily unavailable", 503, publicCorsHeaders);
  }
  const supabase: RuntimeClient = createClient(supabaseUrl, secretKey);
  const context = await loadRuntimeContext(supabase, body.siteId);
  if (!context) return errorResponse("Site runtime is unavailable", 404, publicCorsHeaders);

  if (body.type === "watch") {
    // Long-poll: resolve as soon as any saved catalog/content row for this
    // site's business changes (private broadcast sent by a database trigger),
    // or after ~25s with changed:false. Visitors receive only "something
    // changed" — never row data or credentials — and then re-read normally.
    const changed = await new Promise<{ changed: boolean; table?: string }>((resolve) => {
      let settled = false;
      const channel = supabase.channel(`site-live:${context.businessId}`, { config: { private: true } });
      const finish = (value: { changed: boolean; table?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        void supabase.removeChannel(channel);
        resolve(value);
      };
      const timer = setTimeout(() => finish({ changed: false }), 25_000);
      channel
        .on("broadcast", { event: "changed" }, (msg: { payload?: { table?: unknown } }) => {
          finish({ changed: true, table: typeof msg.payload?.table === "string" ? msg.payload.table : undefined });
        })
        .subscribe((status: string) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") finish({ changed: false });
        });
    });
    return secureJsonResponse({ success: true, ...changed }, 200, publicCorsHeaders, rateHeaders);
  }

  if (body.type === "profile") {
    const { data: profile, error } = await supabase
      .from("businesses")
      .select("id,name,slug,industry,tagline,description,logo_url,brand_color,website,phone,email,timezone,address,hours,social_links")
      .eq("id", context.businessId)
      .maybeSingle();
    if (error || !profile) return errorResponse("Business profile is unavailable", 404, publicCorsHeaders);
    return secureJsonResponse({
      success: true,
      profile: {
        businessId: profile.id,
        name: profile.name,
        slug: profile.slug,
        industry: profile.industry,
        tagline: profile.tagline,
        description: profile.description,
        logoUrl: profile.logo_url,
        brandColor: profile.brand_color,
        website: profile.website,
        phone: profile.phone,
        email: profile.email,
        timezone: profile.timezone || "UTC",
        address: profile.address || {},
        hours: Array.isArray(profile.hours) ? profile.hours : [],
        socialLinks: profile.social_links || {},
      },
    }, 200, publicCorsHeaders, rateHeaders);
  }

  const pagePath = typeof body.pagePath === "string" && body.pagePath.startsWith("/") ? body.pagePath.slice(0, 500) : "/";
  const sectionId = typeof body.sectionId === "string" ? body.sectionId.slice(0, 200) : null;
  const sectionType = typeof body.sectionType === "string" ? body.sectionType.slice(0, 100) : null;
  const occurrenceIndex = typeof body.occurrenceIndex === "number" && body.occurrenceIndex >= 0
    ? Math.floor(body.occurrenceIndex) : 0;

  let bindingQuery = supabase
    .from("site_data_bindings")
    .select("business_id,project_id,page_path,section_id,source_kind,source_table,collection_id,filters,sort,limit_count,fallback_mode")
    .eq("project_id", context.projectId)
    .eq("business_id", context.businessId)
    .eq("page_path", pagePath);
  if (sectionId) bindingQuery = bindingQuery.eq("section_id", sectionId);
  const { data: directBindings, error: bindingError } = await bindingQuery.order("section_id", { ascending: true });
  if (bindingError) return errorResponse("Catalog binding is unavailable", 404, publicCorsHeaders);

  // deno-lint-ignore no-explicit-any
  let binding: any = directBindings?.[0] ?? null;
  if (!binding && sectionType) {
    const surface = findSurface(sectionType);
    if (surface) {
      const { data: candidates } = await supabase
        .from("site_data_bindings")
        .select("business_id,project_id,page_path,section_id,source_kind,source_table,collection_id,filters,sort,limit_count,fallback_mode")
        .eq("project_id", context.projectId)
        .eq("business_id", context.businessId)
        .eq("page_path", pagePath)
        .like("section_id", `${surface.bindingPrefix}-%`)
        .order("section_id", { ascending: true });
      binding = candidates?.[Math.min(occurrenceIndex, Math.max(0, (candidates?.length ?? 1) - 1))] ?? null;
    }
  }
  if (!binding) return secureJsonResponse({ success: true, rows: [], cardBinding: null, fallback: "hide_section" }, 200, publicCorsHeaders, rateHeaders);

  const surface = SURFACES[String(binding.source_table)];
  if (!surface || surface.sourceKind !== binding.source_kind) {
    return errorResponse("Catalog surface is unavailable", 404, publicCorsHeaders);
  }
  if (!(await isSurfaceEnabled(supabase, body.siteId, surface))) {
    return errorResponse("Catalog surface is unavailable", 404, publicCorsHeaders);
  }
  let catalogQuery = supabase
    .from(surface.sourceTable)
    .select(surface.columns.join(","))
    .eq("business_id", context.businessId)
    // Guidebook §13: both business and project; NULL = shared-legacy row.
    .or(`project_id.eq.${context.projectId},project_id.is.null`);
  for (const [key, value] of primitiveFilters(binding.filters, surface)) catalogQuery = catalogQuery.eq(key, value);
  if (binding.collection_id) {
    const { data: collection } = await supabase
      .from("catalog_collections")
      .select("manual_item_ids")
      .eq("id", binding.collection_id)
      .eq("business_id", context.businessId)
      .eq("is_active", true)
      .maybeSingle();
    if (!collection) return secureJsonResponse({ success: true, rows: [], cardBinding: null, fallback: binding.fallback_mode }, 200, publicCorsHeaders, rateHeaders);
    if (Array.isArray(collection.manual_item_ids) && collection.manual_item_ids.length > 0) {
      catalogQuery = catalogQuery.in("id", collection.manual_item_ids);
    }
  }
  const sort = binding.sort && typeof binding.sort === "object" ? binding.sort as Record<string, unknown> : {};
  if (typeof sort.field === "string" && surface.columns.includes(sort.field)) {
    catalogQuery = catalogQuery.order(sort.field, { ascending: sort.direction !== "desc" });
  }
  const limit = typeof binding.limit_count === "number" ? Math.min(Math.max(1, binding.limit_count), 50) : 12;
  const { data: rows, error: rowsError } = await catalogQuery.limit(limit);
  if (rowsError) return errorResponse("Catalog data is unavailable", 404, publicCorsHeaders);

  const projectedRows = ((rows ?? []) as unknown as Array<Record<string, unknown>>).map((row) => projectCard(surface, row));
  return secureJsonResponse({
    success: true,
    rows: projectedRows,
    cardBinding: { sourceKind: surface.sourceKind, sourceTable: surface.sourceTable },
    fallback: projectedRows.length === 0 ? binding.fallback_mode : "ok",
  }, 200, publicCorsHeaders, rateHeaders);
});