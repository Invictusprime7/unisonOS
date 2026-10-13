/**
 * Industry → Capability Matrix
 * 
 * Canonical mapping from industry/category to allowed capabilities,
 * default automation packs, CRM pipeline types, and page maps.
 * 
 * This is the deterministic bridge between "what industry is this?"
 * and "what capabilities should be provisioned?"
 */

import type { CapabilityId } from './capabilityRegistry';
import type { BusinessSystemType, LayoutCategory } from '@/data/templates/types';
import type { CoreIntent } from './coreIntents';

// ============================================================================
// Industry Profile
// ============================================================================

export interface IndustryProfile {
  /** Industry key (matches composition industry field) */
  industry: string;
  /** Human name */
  name: string;
  /** Maps to BusinessSystemType for backend provisioning */
  systemType: BusinessSystemType;
  /** Layout categories this industry uses */
  layoutCategories: LayoutCategory[];
  /** Capabilities enabled by default for this industry */
  defaultCapabilities: CapabilityId[];
  /** Primary intent family for this industry (used for hero CTA defaults) */
  primaryIntent: CoreIntent;
  /** Default CRM pipeline for this industry */
  crmPipeline: {
    name: string;
    stages: string[];
    defaultStage: string;
  };
  /** Default page map for a new site in this industry */
  defaultPages: PageSpec[];
  /** Automation recipe pack to install */
  automationPack: string;
  /** Seed data requirements */
  seedDataKeys: string[];
}

export interface PageSpec {
  title: string;
  path: string;
  purpose: 'landing' | 'services' | 'portfolio' | 'contact' | 'about' | 'blog' | 'shop' | 'checkout' | 'booking' | 'pricing' | 'faq' | 'immersive';
  /** Section types expected on this page */
  expectedSections: string[];
}

// ============================================================================
// Matrix
// ============================================================================

export const INDUSTRY_MATRIX: Record<string, IndustryProfile> = {
  saas: {
    industry: 'saas',
    name: 'SaaS & Software',
    systemType: 'saas',
    layoutCategories: ['saas', 'landing'],
    defaultCapabilities: ['contact', 'newsletter', 'lead-capture'],
    primaryIntent: 'contact.submit',
    crmPipeline: {
      name: 'SaaS Pipeline',
      stages: ['New Lead', 'Demo Requested', 'Trial Started', 'Qualified', 'Customer'],
      defaultStage: 'New Lead',
    },
    defaultPages: [
      { title: 'Home', path: '/', purpose: 'landing', expectedSections: ['navbar', 'hero', 'logo-cloud', 'features', 'stats', 'testimonials', 'cta', 'footer'] },
      { title: 'Product', path: '/services', purpose: 'services', expectedSections: ['navbar', 'hero', 'features', 'services', 'before-after', 'cta', 'footer'] },
      { title: 'Pricing', path: '/pricing', purpose: 'pricing', expectedSections: ['navbar', 'hero', 'pricing', 'faq', 'cta', 'footer'] },
      { title: 'Customers', path: '/gallery', purpose: 'portfolio', expectedSections: ['navbar', 'hero', 'logo-cloud', 'testimonials', 'stats', 'footer'] },
      { title: 'Company', path: '/about', purpose: 'about', expectedSections: ['navbar', 'hero', 'about', 'team', 'stats', 'footer'] },
      { title: 'Blog', path: '/blog', purpose: 'blog', expectedSections: ['navbar', 'hero', 'blog-preview', 'cta', 'footer'] },
      { title: 'Contact', path: '/contact', purpose: 'contact', expectedSections: ['navbar', 'hero', 'contact', 'faq', 'footer'] },
    ],
    automationPack: 'saas_growth',
    seedDataKeys: ['business_name', 'business_email', 'features', 'pricing_tiers'],
  },

  salon: {
    industry: 'salon',
    name: 'Salon & Spa',
    systemType: 'booking',
    layoutCategories: ['salon'],
    defaultCapabilities: ['booking', 'contact', 'newsletter'],
    primaryIntent: 'booking.create',
    crmPipeline: {
      name: 'Salon Clients',
      stages: ['New Client', 'Booked', 'Completed', 'VIP', 'Inactive'],
      defaultStage: 'New Client',
    },
    defaultPages: [
      { title: 'Home', path: '/', purpose: 'landing', expectedSections: ['navbar', 'hero', 'services', 'gallery', 'testimonials', 'cta', 'footer'] },
      { title: 'Services', path: '/services', purpose: 'services', expectedSections: ['navbar', 'hero', 'services', 'pricing', 'faq', 'footer'] },
      { title: 'Gallery', path: '/gallery', purpose: 'portfolio', expectedSections: ['navbar', 'hero', 'gallery', 'before-after', 'cta', 'footer'] },
      { title: 'Our Studio', path: '/about', purpose: 'about', expectedSections: ['navbar', 'hero', 'about', 'team', 'testimonials', 'footer'] },
      { title: 'Book', path: '/booking', purpose: 'booking', expectedSections: ['navbar', 'hero', 'services', 'contact', 'faq', 'footer'] },
      { title: 'FAQ', path: '/faq', purpose: 'faq', expectedSections: ['navbar', 'hero', 'faq', 'cta', 'footer'] },
      { title: 'Contact', path: '/contact', purpose: 'contact', expectedSections: ['navbar', 'hero', 'contact', 'footer'] },
    ],
    automationPack: 'booking_salon',
    seedDataKeys: ['business_name', 'business_email', 'services', 'operating_hours'],
  },

  restaurant: {
    industry: 'restaurant',
    name: 'Restaurant & Food',
    systemType: 'booking',
    layoutCategories: ['restaurant'],
    defaultCapabilities: ['booking', 'contact', 'newsletter'],
    primaryIntent: 'booking.create',
    crmPipeline: {
      name: 'Restaurant Guests',
      stages: ['New Reservation', 'Confirmed', 'Seated', 'Completed', 'VIP'],
      defaultStage: 'New Reservation',
    },
    defaultPages: [
      { title: 'Home', path: '/', purpose: 'landing', expectedSections: ['navbar', 'hero', 'services', 'gallery', 'testimonials', 'cta', 'footer'] },
      { title: 'Menu', path: '/menu', purpose: 'services', expectedSections: ['navbar', 'hero', 'services', 'pricing', 'cta', 'footer'] },
      { title: 'Gallery', path: '/gallery', purpose: 'portfolio', expectedSections: ['navbar', 'hero', 'gallery', 'cta', 'footer'] },
      { title: 'Our Story', path: '/about', purpose: 'about', expectedSections: ['navbar', 'hero', 'about', 'team', 'stats', 'footer'] },
      { title: 'Reservations', path: '/booking', purpose: 'booking', expectedSections: ['navbar', 'hero', 'contact', 'faq', 'footer'] },
      { title: 'Contact', path: '/contact', purpose: 'contact', expectedSections: ['navbar', 'hero', 'contact', 'footer'] },
    ],
    automationPack: 'booking_restaurant',
    seedDataKeys: ['business_name', 'business_email', 'menu_items', 'operating_hours'],
  },

  'local-service': {
    industry: 'local-service',
    name: 'Local Service / Contractor',
    systemType: 'booking',
    layoutCategories: ['contractor'],
    defaultCapabilities: ['quoting', 'contact', 'newsletter', 'lead-capture'],
    primaryIntent: 'quote.request',
    crmPipeline: {
      name: 'Service Pipeline',
      stages: ['New Lead', 'Quote Sent', 'Scheduled', 'In Progress', 'Completed', 'Follow-up'],
      defaultStage: 'New Lead',
    },
    defaultPages: [
      { title: 'Home', path: '/', purpose: 'landing', expectedSections: ['navbar', 'hero', 'services', 'stats', 'before-after', 'testimonials', 'cta', 'footer'] },
      { title: 'Services', path: '/services', purpose: 'services', expectedSections: ['navbar', 'hero', 'services', 'pricing', 'faq', 'footer'] },
      { title: 'Projects', path: '/projects', purpose: 'portfolio', expectedSections: ['navbar', 'hero', 'gallery', 'before-after', 'testimonials', 'footer'] },
      { title: 'About', path: '/about', purpose: 'about', expectedSections: ['navbar', 'hero', 'about', 'team', 'stats', 'footer'] },
      { title: 'FAQ', path: '/faq', purpose: 'faq', expectedSections: ['navbar', 'hero', 'faq', 'cta', 'footer'] },
      { title: 'Get a Quote', path: '/contact', purpose: 'contact', expectedSections: ['navbar', 'hero', 'contact', 'stats', 'footer'] },
    ],
    automationPack: 'local_service',
    seedDataKeys: ['business_name', 'business_email', 'services', 'service_areas'],
  },

  coaching: {
    industry: 'coaching',
    name: 'Coaching & Consulting',
    systemType: 'booking',
    layoutCategories: ['coaching'],
    defaultCapabilities: ['booking', 'contact', 'newsletter', 'lead-capture'],
    primaryIntent: 'booking.create',
    crmPipeline: {
      name: 'Coaching Pipeline',
      stages: ['Discovery', 'Proposal', 'Active Client', 'Completed', 'Alumni'],
      defaultStage: 'Discovery',
    },
    defaultPages: [
      { title: 'Home', path: '/', purpose: 'landing', expectedSections: ['navbar', 'hero', 'services', 'about', 'testimonials', 'stats', 'cta', 'footer'] },
      { title: 'Programs', path: '/programs', purpose: 'services', expectedSections: ['navbar', 'hero', 'services', 'pricing', 'faq', 'footer'] },
      { title: 'About', path: '/about', purpose: 'about', expectedSections: ['navbar', 'hero', 'about', 'stats', 'testimonials', 'footer'] },
      { title: 'Results', path: '/gallery', purpose: 'portfolio', expectedSections: ['navbar', 'hero', 'before-after', 'testimonials', 'stats', 'footer'] },
      { title: 'Insights', path: '/blog', purpose: 'blog', expectedSections: ['navbar', 'hero', 'blog-preview', 'cta', 'footer'] },
      { title: 'Book a Call', path: '/booking', purpose: 'booking', expectedSections: ['navbar', 'hero', 'services', 'contact', 'faq', 'footer'] },
      { title: 'Contact', path: '/contact', purpose: 'contact', expectedSections: ['navbar', 'hero', 'contact', 'footer'] },
    ],
    automationPack: 'coaching',
    seedDataKeys: ['business_name', 'business_email', 'programs', 'credentials'],
  },

  'real-estate': {
    industry: 'real-estate',
    name: 'Real Estate',
    systemType: 'agency',
    layoutCategories: ['realestate'],
    defaultCapabilities: ['contact', 'lead-capture', 'booking', 'newsletter'],
    primaryIntent: 'contact.submit',
    crmPipeline: {
      name: 'Real Estate Pipeline',
      stages: ['New Lead', 'Showing Scheduled', 'Offer Made', 'Under Contract', 'Closed'],
      defaultStage: 'New Lead',
    },
    defaultPages: [
      { title: 'Home', path: '/', purpose: 'landing', expectedSections: ['navbar', 'hero', 'services', 'gallery', 'stats', 'testimonials', 'cta', 'footer'] },
      { title: 'Listings', path: '/listings', purpose: 'portfolio', expectedSections: ['navbar', 'hero', 'gallery', 'cta', 'footer'] },
      { title: 'Services', path: '/services', purpose: 'services', expectedSections: ['navbar', 'hero', 'services', 'stats', 'faq', 'footer'] },
      { title: 'About', path: '/about', purpose: 'about', expectedSections: ['navbar', 'hero', 'about', 'team', 'testimonials', 'footer'] },
      { title: 'Book a Viewing', path: '/booking', purpose: 'booking', expectedSections: ['navbar', 'hero', 'contact', 'faq', 'footer'] },
      { title: 'Contact', path: '/contact', purpose: 'contact', expectedSections: ['navbar', 'hero', 'contact', 'footer'] },
    ],
    automationPack: 'real_estate',
    seedDataKeys: ['business_name', 'business_email', 'service_areas', 'specialties'],
  },

  ecommerce: {
    industry: 'ecommerce',
    name: 'E-Commerce',
    systemType: 'store',
    layoutCategories: ['store'],
    defaultCapabilities: ['commerce', 'contact', 'newsletter'],
    primaryIntent: 'cart.add',
    crmPipeline: {
      name: 'Customer Pipeline',
      stages: ['Prospect', 'First Purchase', 'Repeat Customer', 'VIP', 'Win-back'],
      defaultStage: 'Prospect',
    },
    defaultPages: [
      { title: 'Home', path: '/', purpose: 'landing', expectedSections: ['navbar', 'hero', 'services', 'gallery', 'testimonials', 'cta', 'footer'] },
      { title: 'Shop', path: '/shop', purpose: 'shop', expectedSections: ['navbar', 'hero', 'services', 'gallery', 'cta', 'footer'] },
      { title: 'Our Story', path: '/about', purpose: 'about', expectedSections: ['navbar', 'hero', 'about', 'stats', 'testimonials', 'footer'] },
      { title: 'Journal', path: '/blog', purpose: 'blog', expectedSections: ['navbar', 'hero', 'blog-preview', 'cta', 'footer'] },
      { title: 'Help', path: '/faq', purpose: 'faq', expectedSections: ['navbar', 'hero', 'faq', 'contact', 'footer'] },
      { title: 'Checkout', path: '/checkout', purpose: 'checkout', expectedSections: ['navbar', 'hero', 'contact', 'footer'] },
      { title: 'Contact', path: '/contact', purpose: 'contact', expectedSections: ['navbar', 'hero', 'contact', 'faq', 'footer'] },
    ],
    automationPack: 'ecommerce',
    seedDataKeys: ['business_name', 'business_email', 'products', 'shipping_info'],
  },

  portfolio: {
    industry: 'portfolio',
    name: 'Portfolio & Creative',
    systemType: 'portfolio',
    layoutCategories: ['portfolio'],
    defaultCapabilities: ['contact', 'newsletter'],
    primaryIntent: 'contact.submit',
    crmPipeline: {
      name: 'Creative Pipeline',
      stages: ['Inquiry', 'Briefing', 'Proposal', 'Active Project', 'Delivered'],
      defaultStage: 'Inquiry',
    },
    defaultPages: [
      { title: 'Home', path: '/', purpose: 'landing', expectedSections: ['navbar', 'hero', 'gallery', 'about', 'testimonials', 'cta', 'footer'] },
      { title: 'Work', path: '/work', purpose: 'portfolio', expectedSections: ['navbar', 'hero', 'gallery', 'cta', 'footer'] },
      { title: 'Studio', path: '/about', purpose: 'about', expectedSections: ['navbar', 'hero', 'about', 'stats', 'team', 'footer'] },
      { title: 'Services', path: '/services', purpose: 'services', expectedSections: ['navbar', 'hero', 'services', 'pricing', 'faq', 'footer'] },
      { title: 'Journal', path: '/blog', purpose: 'blog', expectedSections: ['navbar', 'hero', 'blog-preview', 'cta', 'footer'] },
      { title: 'Contact', path: '/contact', purpose: 'contact', expectedSections: ['navbar', 'hero', 'contact', 'footer'] },
    ],
    automationPack: 'portfolio',
    seedDataKeys: ['business_name', 'business_email', 'portfolio_items'],
  },

  nonprofit: {
    industry: 'nonprofit',
    name: 'Nonprofit & Charity',
    systemType: 'content',
    layoutCategories: ['nonprofit'],
    defaultCapabilities: ['donation', 'contact', 'newsletter'],
    primaryIntent: 'donation.start',
    crmPipeline: {
      name: 'Donor Pipeline',
      stages: ['Prospect', 'First-time Donor', 'Recurring Donor', 'Major Donor', 'Lapsed'],
      defaultStage: 'Prospect',
    },
    defaultPages: [
      { title: 'Home', path: '/', purpose: 'landing', expectedSections: ['navbar', 'hero', 'stats', 'services', 'testimonials', 'cta', 'footer'] },
      { title: 'About', path: '/about', purpose: 'about', expectedSections: ['navbar', 'hero', 'about', 'team', 'stats', 'footer'] },
      { title: 'Programs', path: '/services', purpose: 'services', expectedSections: ['navbar', 'hero', 'services', 'stats', 'cta', 'footer'] },
      { title: 'Impact', path: '/gallery', purpose: 'portfolio', expectedSections: ['navbar', 'hero', 'gallery', 'stats', 'testimonials', 'footer'] },
      { title: 'Stories', path: '/blog', purpose: 'blog', expectedSections: ['navbar', 'hero', 'blog-preview', 'cta', 'footer'] },
      { title: 'FAQ', path: '/faq', purpose: 'faq', expectedSections: ['navbar', 'hero', 'faq', 'cta', 'footer'] },
      { title: 'Contact', path: '/contact', purpose: 'contact', expectedSections: ['navbar', 'hero', 'contact', 'footer'] },
    ],
    automationPack: 'nonprofit',
    seedDataKeys: ['business_name', 'business_email', 'mission_statement', 'programs'],
  },

  agency: {
    industry: 'agency',
    name: 'Agency & Professional Services',
    systemType: 'agency',
    layoutCategories: ['agency', 'landing'],
    defaultCapabilities: ['contact', 'quoting', 'lead-capture', 'newsletter'],
    primaryIntent: 'contact.submit',
    crmPipeline: {
      name: 'Agency Pipeline',
      stages: ['New Lead', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'],
      defaultStage: 'New Lead',
    },
    defaultPages: [
      { title: 'Home', path: '/', purpose: 'landing', expectedSections: ['navbar', 'hero', 'logo-cloud', 'services', 'stats', 'testimonials', 'cta', 'footer'] },
      { title: 'Services', path: '/services', purpose: 'services', expectedSections: ['navbar', 'hero', 'services', 'pricing', 'faq', 'footer'] },
      { title: 'Work', path: '/work', purpose: 'portfolio', expectedSections: ['navbar', 'hero', 'gallery', 'logo-cloud', 'testimonials', 'footer'] },
      { title: 'Studio', path: '/about', purpose: 'about', expectedSections: ['navbar', 'hero', 'about', 'team', 'stats', 'footer'] },
      { title: 'Insights', path: '/blog', purpose: 'blog', expectedSections: ['navbar', 'hero', 'blog-preview', 'cta', 'footer'] },
      { title: 'Contact', path: '/contact', purpose: 'contact', expectedSections: ['navbar', 'hero', 'contact', 'faq', 'footer'] },
    ],
    automationPack: 'agency',
    seedDataKeys: ['business_name', 'business_email', 'services', 'case_studies'],
  },
};

const INDUSTRY_ALIASES: Record<string, string> = {
  barber: 'salon',
  medspa: 'salon',
  wellness: 'salon',
  dental: 'local-service',
  healthcare: 'local-service',
  contractor: 'local-service',
  local_service: 'local-service',
  hvac: 'local-service',
  cleaning: 'local-service',
  landscaping: 'local-service',
  auto_detailing: 'local-service',
  moving: 'local-service',
  legal: 'agency',
  realestate: 'real-estate',
  real_estate: 'real-estate',
  ecommerce: 'ecommerce',
  store: 'ecommerce',
  'e-commerce': 'ecommerce',
  photographer: 'portfolio',
  photography: 'portfolio',
  creative: 'portfolio',
  creator: 'portfolio',
  fitness: 'coaching',
  content: 'nonprofit',
  landing: 'agency',
  cafe: 'restaurant',
  bakery: 'restaurant',
  bistro: 'restaurant',
  diner: 'restaurant',
  eatery: 'restaurant',
  pizzeria: 'restaurant',
  foodtruck: 'restaurant',
  'food-truck': 'restaurant',
  'coffee-shop': 'restaurant',
  'restaurant-hospitality': 'restaurant',
};

// ============================================================================
// Lookup Helpers
// ============================================================================

export function normalizeIndustryKey(industry: string): string {
  const key = industry.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  return INDUSTRY_ALIASES[key] || key;
}

export function getIndustryProfile(industry: string): IndustryProfile | undefined {
  return INDUSTRY_MATRIX[normalizeIndustryKey(industry)];
}

export function getIndustryForCategory(category: LayoutCategory): IndustryProfile | undefined {
  return Object.values(INDUSTRY_MATRIX).find(p =>
    p.layoutCategories.includes(category)
  );
}

export function getIndustryForSystemType(systemType: BusinessSystemType): IndustryProfile[] {
  return Object.values(INDUSTRY_MATRIX).filter(p => p.systemType === systemType);
}

export function getAllIndustries(): IndustryProfile[] {
  return Object.values(INDUSTRY_MATRIX);
}
