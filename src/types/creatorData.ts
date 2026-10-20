/**
 * Creator Data Layer — Structured business content that all pages consume.
 * This is the editable business payload inside SiteBundle.
 */

import type { AssetRef, IntentId, PageId } from "./siteBundle";

// ============================================================================
// Content Objects
// ============================================================================

export interface CreatorProduct {
  productId: string;
  name: string;
  slug?: string;
  sku?: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  priceSuffix?: string;
  currency: string;
  imageAssetId?: string;
  images?: AssetRef[];
  category?: string;
  tags?: string[];
  featured?: boolean;
  visibility?: "public" | "hidden" | "featured";
  billingType?: "one_time" | "subscription";
  billingInterval?: "week" | "month" | "quarter" | "year";
  ctaLabel?: string;
  checkoutLabel?: string;
  fulfillmentType?: "digital" | "physical" | "service" | "custom";
  variants?: Array<{ label: string; price?: number; sku?: string }>;
  /** Lifecycle status. Defaults to "active". */
  status?: "draft" | "active" | "archived";
  /** When true, inStock is derived from stockQuantity + inventoryPolicy. When false, product is always considered available. */
  trackInventory?: boolean;
  /** Available units. Only meaningful when trackInventory=true. */
  stockQuantity?: number;
  /** What to do when stockQuantity hits 0. Defaults to "deny_when_out". */
  inventoryPolicy?: "deny_when_out" | "allow_backorder";
  /** UI badge threshold ("Only N left"). */
  lowStockThreshold?: number;
  sortOrder: number;
}

/**
 * Canonical availability check. Replaces the legacy `inStock` boolean.
 * Use this everywhere downstream (ProductCard, cart, AI generators).
 */
export function isProductInStock(
  p: Pick<CreatorProduct, "status" | "trackInventory" | "stockQuantity" | "inventoryPolicy">,
): boolean {
  if (p.status === "archived" || p.status === "draft") return false;
  if (!p.trackInventory) return true;
  if (p.inventoryPolicy === "allow_backorder") return true;
  return (p.stockQuantity ?? 0) > 0;
}

export interface CreatorService {
  serviceId: string;
  name: string;
  slug?: string;
  serviceCode?: string;
  description?: string;
  price?: number;
  duration?: number; // minutes
  currency?: string;
  imageAssetId?: string;
  category?: string;
  locationLabel?: string;
  availabilitySummary?: string;
  ctaLabel?: string;
  featured?: boolean;
  visibility?: "public" | "hidden" | "featured";
  bookable: boolean;
  sortOrder: number;
}

export interface CreatorTestimonial {
  testimonialId: string;
  author: string;
  role?: string;
  company?: string;
  content: string;
  rating?: number; // 1-5
  avatarAssetId?: string;
  sortOrder: number;
}

export interface CreatorFaqItem {
  faqId: string;
  question: string;
  answer: string;
  category?: string;
  sortOrder: number;
}

export interface CreatorGalleryItem {
  galleryItemId: string;
  assetId: string;
  caption?: string;
  category?: string;
  sortOrder: number;
}

export interface CreatorTeamMember {
  memberId: string;
  name: string;
  role: string;
  bio?: string;
  avatarAssetId?: string;
  socialLinks?: Record<string, string>;
  sortOrder: number;
}

// ============================================================================
// Collections (groupings of content objects)
// ============================================================================

export interface CreatorCollection {
  collectionId: string;
  name: string;
  type: "products" | "services" | "gallery" | "testimonials" | "faq" | "team";
  itemIds: string[]; // references to the appropriate content type
  sortOrder: number;
}

// ============================================================================
// Form Definitions
// ============================================================================

export type FormFieldType = "text" | "email" | "phone" | "textarea" | "select" | "checkbox" | "date" | "number";

export interface CreatorFormField {
  fieldId: string;
  label: string;
  type: FormFieldType;
  placeholder?: string;
  helpText?: string;
  width?: "full" | "half";
  required: boolean;
  options?: string[]; // for select
  sortOrder: number;
}

export interface CreatorForm {
  formId: string;
  name: string;
  fields: CreatorFormField[];
  submitLabel: string;
  successMessage: string;
  themeName?: string;
  destinationType?: "crm" | "email" | "webhook" | "calendar" | "custom";
  destinationLabel?: string;
  enablePayments?: boolean;
  paymentProductId?: string;
  /** Intent to fire on submit */
  submitIntentId?: IntentId;
  /** Where to redirect after submit */
  redirectPageId?: PageId;
  sortOrder: number;
}

// ============================================================================
// Overlays / Modals
// ============================================================================

export interface CreatorOverlay {
  overlayId: string;
  name: string;
  type: "modal" | "drawer" | "popup" | "banner";
  trigger: "intent" | "timer" | "scroll" | "exit";
  triggerConfig?: {
    delayMs?: number;
    scrollPercent?: number;
    intentId?: IntentId;
  };
  /** Page source for overlay content, or inline content */
  contentPageId?: PageId;
  inlineContent?: string;
  sortOrder: number;
}

// ============================================================================
// Business Info (globals)
// ============================================================================

export interface CreatorBusinessInfo {
  businessName: string;
  tagline?: string;
  description?: string;
  phone?: string;
  email?: string;
  notificationEmail?: string;
  address?: string;
  bookingOwner?: string;
  paymentProvider?: string;
  crmDestination?: string;
  publishDomain?: string;
  followUpChannel?: string;
  hours?: Array<{ day: string; open: string; close: string; closed?: boolean }>;
  socialLinks?: Record<string, string>;
  logoAssetId?: string;
  faviconAssetId?: string;
  brandProfile?: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    surfaceColor?: string;
    headingFont?: string;
    bodyFont?: string;
    buttonRadius?: string;
  };
  customValues?: Record<string, string>;
}

// ============================================================================
// Component Instances (reusable section bindings)
// ============================================================================

export interface CreatorComponentInstance {
  instanceId: string;
  componentType: string; // "hero" | "pricing-table" | "product-grid" | etc.
  componentSlug?: string;
  label: string;
  category?: "leads" | "booking" | "commerce" | "support" | "payments";
  targetType?: "form" | "calendar" | "product" | "checkout" | "chat";
  /** Data bindings — what content this component reads */
  bindings: Record<string, string>; // e.g. { collectionId: "col_1", formId: "form_1" }
  /** Override props */
  props: Record<string, unknown>;
  /** Which pages use this instance */
  usedOnPages: PageId[];
  requiredCapabilities?: string[];
  outputEvents?: string[];
  status?: "draft" | "ready" | "stubbed";
}

// ============================================================================
// Main Creator Data Payload
// ============================================================================

export interface CreatorData {
  products: Record<string, CreatorProduct>;
  services: Record<string, CreatorService>;
  testimonials: Record<string, CreatorTestimonial>;
  faqs: Record<string, CreatorFaqItem>;
  gallery: Record<string, CreatorGalleryItem>;
  team: Record<string, CreatorTeamMember>;
  collections: Record<string, CreatorCollection>;
  forms: Record<string, CreatorForm>;
  overlays: Record<string, CreatorOverlay>;
  businessInfo: CreatorBusinessInfo;
  componentInstances: Record<string, CreatorComponentInstance>;
}

// ============================================================================
// Empty defaults
// ============================================================================

export function createEmptyCreatorData(businessName = "My Business"): CreatorData {
  return {
    products: {},
    services: {},
    testimonials: {},
    faqs: {},
    gallery: {},
    team: {},
    collections: {},
    forms: {},
    overlays: {},
    businessInfo: {
      businessName,
    },
    componentInstances: {},
  };
}
