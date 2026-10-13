import { resolveSectionLayout } from '@/sections/resolveSectionLayout';
/**
 * Wizard Catalog — the static vocabulary of the System Launcher wizard.
 *
 * Guidebook rule: the wizard UI is a *selection surface only*. Everything here
 * is presentation metadata plus the deterministic mappings the canonical
 * pipeline needs (business model, industry overlay, template composition
 * resolution). No generation logic, no VFS writes, no AI calls.
 */

import {
  type BusinessSystemType,
  type LayoutCategory,
} from "@/data/templates/types";
import { getCompositionsBySystemType } from "@/sections/templates";
import { getDefaultTemplateIdForIndustry } from "@/sections/templates/industryDefaultRegistry";
import type { BusinessModel, IndustryOverlay } from "@/types/playground";
import {
  getAllIndustries,
  getIndustryProfile,
  normalizeIndustryKey,
} from "@/platform/core/industryMatrix";

// ── Steps ───────────────────────────────────────────────────────────────────

export type WizardStep = "industry" | "goals" | "questions" | "aesthetic";

export const STEP_META: {
  key: WizardStep;
  num: number;
  label: string;
  sublabel: string;
}[] = [
  { key: "industry", num: 1, label: "Idea", sublabel: "What you do" },
  { key: "goals", num: 2, label: "Goals", sublabel: "Site purpose" },
  { key: "questions", num: 3, label: "Visitors", sublabel: "Actions & pages" },
  { key: "aesthetic", num: 4, label: "Style", sublabel: "Name & style" },
];

// ── Answer vocabulary ───────────────────────────────────────────────────────

export type PrimaryGoal =
  | "collect_leads"
  | "book_appointments"
  | "sell_offers"
  | "showcase_work"
  | "drive_calls"
  | "grow_email_list";

export type CustomerNeed =
  | "request_quote"
  | "book_service"
  | "buy_offer"
  | "fill_form"
  | "browse_services"
  | "explore_immersive";

export type PageChoice =
  | "about"
  | "services"
  | "pricing"
  | "gallery"
  | "faq"
  | "contact"
  | "booking"
  | "checkout"
  | "blog"
  | "shop";

export const PRIMARY_GOALS: {
  id: PrimaryGoal;
  label: string;
  icon: string;
  description: string;
}[] = [
  { id: "collect_leads", label: "Collect Leads", icon: "📩", description: "Capture contact info and grow your pipeline" },
  { id: "book_appointments", label: "Book Appointments", icon: "📅", description: "Let clients schedule sessions online" },
  { id: "sell_offers", label: "Sell Offers", icon: "💰", description: "Sell products, packages, or services" },
  { id: "showcase_work", label: "Showcase Work", icon: "🎨", description: "Display your portfolio and past projects" },
  { id: "drive_calls", label: "Drive Calls", icon: "📞", description: "Get prospects to call or message you" },
  { id: "grow_email_list", label: "Grow Email List", icon: "📧", description: "Build a subscriber list for marketing" },
];

export const CUSTOMER_NEEDS: { id: CustomerNeed; label: string; icon: string }[] = [
  { id: "request_quote", label: "Request a quote", icon: "📋" },
  { id: "book_service", label: "Book a service", icon: "🗓️" },
  { id: "buy_offer", label: "Buy an offer/package", icon: "🛒" },
  { id: "fill_form", label: "Fill out a form", icon: "📝" },
  { id: "browse_services", label: "Browse services/products", icon: "🔍" },
  { id: "explore_immersive", label: "Explore an interactive experience", icon: "✦" },
];

export const PAGE_CHOICES: { id: PageChoice; label: string; icon: string }[] = [
  { id: "about", label: "About", icon: "ℹ️" },
  { id: "services", label: "Services", icon: "⚙️" },
  { id: "pricing", label: "Pricing", icon: "💲" },
  { id: "gallery", label: "Gallery", icon: "🖼️" },
  { id: "faq", label: "FAQ", icon: "❓" },
  { id: "contact", label: "Contact", icon: "✉️" },
  { id: "booking", label: "Booking", icon: "📅" },
  { id: "shop", label: "Shop", icon: "🛒" },
  { id: "checkout", label: "Checkout", icon: "🛍️" },
  { id: "blog", label: "Blog", icon: "📰" },
];

// ── Canonical pipeline mappings ─────────────────────────────────────────────

export const SYSTEM_TO_BUSINESS_MODEL: Record<BusinessSystemType, BusinessModel> = {
  booking: "appointment_service",
  saas: "saas_digital",
  agency: "quote_lead",
  portfolio: "portfolio_creator",
  store: "ecommerce",
  content: "general",
};

export const SYSTEM_TO_INDUSTRY_OVERLAY: Record<BusinessSystemType, IndustryOverlay> = {
  booking: "salon",
  saas: "saas" as IndustryOverlay,
  agency: "agency",
  portfolio: "portfolio" as IndustryOverlay,
  store: "ecommerce",
  content: "nonprofit",
};

export const GOAL_TO_NEEDS: Record<
  PrimaryGoal,
  { needsBooking?: boolean; sellsProducts?: boolean; wantsLeadCapture?: boolean }
> = {
  collect_leads: { wantsLeadCapture: true },
  book_appointments: { needsBooking: true },
  sell_offers: { sellsProducts: true },
  showcase_work: {},
  drive_calls: { wantsLeadCapture: true },
  grow_email_list: { wantsLeadCapture: true },
};

export const INDUSTRY_DISPLAY: Record<string, { label: string; icon: string }> = {
  salon: { label: "Salon & Beauty", icon: "💇" },
  "local-service": { label: "Local Service", icon: "🔧" },
  contractor: { label: "Contractor & Trades", icon: "🏗️" },
  coaching: { label: "Coaching & Consulting", icon: "🎯" },
  restaurant: { label: "Restaurant & Food", icon: "🍽️" },
  ecommerce: { label: "E-Commerce", icon: "🛍️" },
  fitness: { label: "Fitness & Wellness", icon: "💪" },
  legal: { label: "Legal", icon: "⚖️" },
  realestate: { label: "Real Estate", icon: "🏠" },
  "real-estate": { label: "Real Estate", icon: "🏠" },
  photography: { label: "Photography", icon: "📷" },
  universal: { label: "Universal", icon: "✦" },
  saas: { label: "SaaS & Software", icon: "🚀" },
  agency: { label: "Agency & Creative", icon: "🏢" },
  portfolio: { label: "Portfolio & Creative", icon: "🎨" },
  store: { label: "Store & E-Commerce", icon: "🛍️" },
  nonprofit: { label: "Content & Media", icon: "📝" },
};

export const TEMPLATE_INDUSTRY_TO_CATEGORY: Partial<Record<string, LayoutCategory>> = {
  salon: "salon",
  "local-service": "contractor",
  contractor: "contractor",
  coaching: "coaching",
  restaurant: "restaurant",
  cafe: "restaurant",
  bakery: "restaurant",
  bistro: "restaurant",
  diner: "restaurant",
  eatery: "restaurant",
  pizzeria: "restaurant",
  "food-truck": "restaurant",
  "coffee-shop": "restaurant",
  ecommerce: "store",
  realestate: "realestate",
  "real-estate": "realestate",
  real_estate: "realestate",
  photography: "portfolio",
  legal: "agency",
  fitness: "coaching",
  saas: "saas",
  agency: "agency",
  portfolio: "portfolio",
  store: "store",
  nonprofit: "nonprofit",
};

export function resolveTemplateIndustryCategory(industry: string): LayoutCategory | undefined {
  const canonicalIndustry = normalizeIndustryKey(industry);
  return TEMPLATE_INDUSTRY_TO_CATEGORY[canonicalIndustry]
    ?? getIndustryProfile(canonicalIndustry)?.layoutCategories[0];
}

export const INDUSTRY_CARDS: {
  systemId: BusinessSystemType;
  icon: string;
  label: string;
  tagline: string;
  gradient: string;
  glowColor: string;
}[] = [
  {
    systemId: "booking",
    icon: "📅",
    label: "Booking & Services",
    tagline: "Salons, spas, restaurants, contractors",
    gradient: "from-pink-500/20 via-transparent to-transparent",
    glowColor: "rgba(236,72,153,0.15)",
  },
  {
    systemId: "saas",
    icon: "🚀",
    label: "SaaS & Software",
    tagline: "Products, platforms, developer tools",
    gradient: "from-blue-500/20 via-transparent to-transparent",
    glowColor: "rgba(59,130,246,0.15)",
  },
  {
    systemId: "agency",
    icon: "🏢",
    label: "Agency & Consulting",
    tagline: "Creative studios, legal, real estate",
    gradient: "from-purple-500/20 via-transparent to-transparent",
    glowColor: "rgba(168,85,247,0.15)",
  },
  {
    systemId: "portfolio",
    icon: "🎨",
    label: "Portfolio & Creative",
    tagline: "Designers, photographers, artists",
    gradient: "from-amber-500/20 via-transparent to-transparent",
    glowColor: "rgba(245,158,11,0.15)",
  },
  {
    systemId: "store",
    icon: "🛍️",
    label: "Store & E-Commerce",
    tagline: "Products, retail, marketplace",
    gradient: "from-emerald-500/20 via-transparent to-transparent",
    glowColor: "rgba(16,185,129,0.15)",
  },
  {
    systemId: "content",
    icon: "📝",
    label: "Content & Media",
    tagline: "Blogs, newsletters, nonprofits",
    gradient: "from-orange-500/20 via-transparent to-transparent",
    glowColor: "rgba(249,115,22,0.15)",
  },
];

// ── Template cards ──────────────────────────────────────────────────────────

export interface TemplateCardData {
  id: string;
  label: string;
  description: string;
  /** Covers both IndustryTag and composition industry values. */
  industry: string;
  sectionTypes: string[];
  sections: Array<{ id: string; type: string; label: string; description: string; thumbnail?: string; variantId?: string }>;
  traits: string[];
  themeColors?: { primary: string; secondary: string };
}

/**
 * Authority rule #2: every wizard template card must resolve to a registered
 * TemplateComposition. No synthetic fallback cards, ever.
 */
export function buildCompositionCards(systemId: BusinessSystemType): TemplateCardData[] {
  return getCompositionsBySystemType(systemId).map((c) => {
    const sections = c.sections.filter(section => !section.hidden).map(section => {
      const variant = resolveSectionLayout(section);
      return {
        id: section.id, type: section.type,
        label: variant?.name || section.type,
        description: variant?.description || section.type,
        thumbnail: variant?.thumbnail, variantId: variant?.id,
      };
    });
    const hero = sections.find(section => section.type === 'hero');
    const content = sections.filter(section => !['navbar', 'hero', 'footer', 'cta'].includes(section.type));
    return {
      id: c.id,
      label: [hero && hero.label + ' hero', content[0] && content[0].label + ' ' + content[0].type.replace(/-/g, ' ')].filter(Boolean).join(' + ') || c.name,
      description: content.length
        ? content.map(section => section.type.replace(/-/g, ' ') + ': ' + section.label).join(' / ') + '.'
        : sections.map(section => section.label).join(' / ') + '.',
      industry: c.industry,
      sectionTypes: sections.map(section => section.type),
      sections,
      traits: c.tags && c.tags.length > 0 ? c.tags : [c.category],
      themeColors: c.theme
        ? { primary: c.theme.colors.primary, secondary: c.theme.colors.secondary }
        : undefined,
    };
  });
}

export interface IndustryFocusCard {
  industry: string;
  systemId: BusinessSystemType;
  label: string;
  icon: string;
  tagline: string;
  defaultTemplateId: string | null;
}

const INDUSTRY_FOCUS_ICONS: Record<string, string> = {
  salon: "✂️",
  restaurant: "🍽️",
  "local-service": "🔧",
  contractor: "🏗️",
  coaching: "🎯",
  "real-estate": "🏠",
  ecommerce: "🛍️",
  portfolio: "🎨",
  nonprofit: "🤝",
  agency: "🏢",
  saas: "🚀",
};

/**
 * Real industry choices for Launcher Step 1. The canonical Industry Matrix is
 * still the authority; this merely adapts it into presentation metadata.
 */
export const INDUSTRY_FOCUS_CARDS: IndustryFocusCard[] = getAllIndustries().map((profile) => ({
  industry: profile.industry,
  systemId: profile.systemType,
  label: profile.name,
  icon: INDUSTRY_FOCUS_ICONS[profile.industry] || "✦",
  tagline: profile.defaultPages
    .filter((page) => page.path !== "/")
    .slice(0, 3)
    .map((page) => page.title)
    .join(" · ") || "Industry-ready site",
  defaultTemplateId: getDefaultTemplateIdForIndustry(profile.industry) || null,
}));

export function getDefaultTemplateCardForIndustry(industry: string | null | undefined): TemplateCardData | null {
  if (!industry) return null;
  const profile = getIndustryProfile(industry);
  if (!profile) return null;
  const cards = buildCompositionCards(profile.systemType);
  const normalized = normalizeIndustryKey(industry);
  const defaultId = getDefaultTemplateIdForIndustry(industry);
  return (defaultId ? cards.find((card) => card.id === defaultId) : undefined)
    || cards.find((card) => normalizeIndustryKey(card.industry) === normalized)
    || null;
}

export function getCompositionCardsForIndustry(industry: string | null | undefined): TemplateCardData[] {
  if (!industry) return [];
  const profile = getIndustryProfile(industry);
  if (!profile) return [];
  const normalized = normalizeIndustryKey(industry);
  const exact = buildCompositionCards(profile.systemType).filter(
    (card) => normalizeIndustryKey(card.industry) === normalized,
  );
  // A canonical industry must always expose its registered default. If an
  // older alias composition normalizes differently, keep the default visible.
  const defaultCard = getDefaultTemplateCardForIndustry(industry);
  if (defaultCard && !exact.some((card) => card.id === defaultCard.id)) exact.unshift(defaultCard);
  return exact;
}

function pageChoiceForPurpose(purpose: string): PageChoice | null {
  switch (purpose) {
    case "services": return "services";
    case "portfolio": return "gallery";
    case "contact": return "contact";
    case "about": return "about";
    case "blog": return "blog";
    case "shop": return "shop";
    case "checkout": return "checkout";
    case "booking": return "booking";
    case "pricing": return "pricing";
    case "faq": return "faq";
    default: return null;
  }
}

export function getIndustryDefaultPageChoices(industry: string): PageChoice[] {
  const profile = getIndustryProfile(industry);
  if (!profile) return [];
  return uniqueValues(
    profile.defaultPages
      .filter((page) => page.path !== "/")
      .map((page) => pageChoiceForPurpose(page.purpose))
      .filter((page): page is PageChoice => Boolean(page)),
  );
}

/**
 * Keep the compact wizard role vocabulary, but display the industry's authored
 * route identity. Contractor users see “Projects”, restaurant users see “Menu”,
 * real-estate users see “Listings”, etc., while optional roles keep their
 * generic labels.
 */
export function getIndustryPageChoiceCards(industry: string | null | undefined) {
  if (!industry) return PAGE_CHOICES;
  const profile = getIndustryProfile(industry);
  if (!profile) return PAGE_CHOICES;
  const authoredLabels = new Map<PageChoice, string>();
  for (const page of profile.defaultPages) {
    if (page.path === "/") continue;
    const choice = pageChoiceForPurpose(page.purpose);
    if (choice) authoredLabels.set(choice, page.title);
  }
  return PAGE_CHOICES.map((choice) => ({
    ...choice,
    label: authoredLabels.get(choice.id) || choice.label,
  }));
}

export function getIndustryPrimaryGoal(industry: string): PrimaryGoal {
  const profile = getIndustryProfile(industry);
  switch (profile?.primaryIntent) {
    case "booking.create": return "book_appointments";
    case "cart.add": return "sell_offers";
    case "donation.start": return "grow_email_list";
    case "contact.submit":
      return profile?.systemType === "portfolio" ? "showcase_work" : "collect_leads";
    case "quote.request":
    default: return profile?.systemType === "content" ? "grow_email_list" : "collect_leads";
  }
}

export function getIndustryCustomerNeeds(industry: string): CustomerNeed[] {
  const profile = getIndustryProfile(industry);
  switch (profile?.primaryIntent) {
    case "booking.create": return ["book_service", "browse_services", "fill_form"];
    case "cart.add": return ["buy_offer", "browse_services"];
    case "quote.request": return ["request_quote", "browse_services", "fill_form"];
    case "contact.submit": return ["request_quote", "fill_form"];
    case "donation.start": return ["fill_form", "browse_services"];
    default: return ["fill_form", "browse_services"];
  }
}

// ── Deterministic per-system preselects ─────────────────────────────────────

export interface LauncherPreselect {
  primaryGoal: PrimaryGoal;
  customerNeeds: CustomerNeed[];
  pages: PageChoice[];
}

export function uniqueValues<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values));
}

/**
 * Every business system gets a complete, industry-faithful preselection so the
 * launcher journey ends in a coherent first preview. These mirror the contracts
 * in `src/platform/core/industryIntentProfiles.ts`.
 */
export const LAUNCHER_PRESELECTS: Record<
  BusinessSystemType,
  LauncherPreselect & { preferredIndustry?: string }
> = {
  booking: {
    primaryGoal: "book_appointments",
    customerNeeds: ["book_service", "browse_services", "fill_form"],
    pages: ["about", "services", "pricing", "gallery", "booking", "contact", "faq"],
    preferredIndustry: "salon",
  },
  saas: {
    primaryGoal: "collect_leads",
    customerNeeds: ["fill_form", "browse_services"],
    pages: ["about", "services", "pricing", "faq", "contact", "blog"],
    preferredIndustry: "saas",
  },
  agency: {
    primaryGoal: "collect_leads",
    customerNeeds: ["request_quote", "fill_form", "browse_services"],
    pages: ["about", "services", "pricing", "gallery", "contact", "faq"],
    preferredIndustry: "agency",
  },
  portfolio: {
    primaryGoal: "showcase_work",
    customerNeeds: ["request_quote", "fill_form"],
    pages: ["about", "gallery", "services", "contact"],
    preferredIndustry: "portfolio",
  },
  store: {
    primaryGoal: "sell_offers",
    customerNeeds: ["buy_offer", "browse_services"],
    pages: ["about", "services", "pricing", "gallery", "shop", "checkout", "contact", "faq"],
    preferredIndustry: "ecommerce",
  },
  content: {
    primaryGoal: "grow_email_list",
    customerNeeds: ["fill_form", "browse_services"],
    pages: ["about", "blog", "services", "contact"],
    preferredIndustry: "nonprofit",
  },
};

export function getDefaultTemplateCardFor(
  systemId: BusinessSystemType | null,
): TemplateCardData | null {
  if (!systemId) return null;
  const cards = buildCompositionCards(systemId);
  if (cards.length === 0) return null;
  const preferred = LAUNCHER_PRESELECTS[systemId]?.preferredIndustry;
  if (preferred) {
    const defaultTemplateId = getDefaultTemplateIdForIndustry(preferred);
    const match =
      (defaultTemplateId ? cards.find((card) => card.id === defaultTemplateId) : undefined) ||
      cards.find((card) => normalizeIndustryKey(card.industry) === normalizeIndustryKey(preferred));
    if (match) return match;
  }
  return cards[0];
}
