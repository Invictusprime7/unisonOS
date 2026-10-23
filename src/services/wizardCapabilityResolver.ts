/**
 * Wizard Capability Resolver — Deterministic capability pack from wizard answers.
 * 
 * Turns WizardSelections into a CapabilityPack that drives downstream
 * topology planning, playground materialization, and compilation.
 * 
 * V2: Binding specs now use section + slot + canonical intent instead of
 * raw button labels. Labels are presentation-only.
 * 
 * This is fully deterministic — no AI, no randomness.
 */

import { nanoid } from 'nanoid';
import type {
  WizardSelections,
  BusinessModel,
  IndustryOverlay,
  CapabilityPack,
  PlaygroundPageRole,
  PlaygroundFunnelGoal,
  PlaygroundBindingSpec,
  PlaygroundBindingSpecV2,
  PlaygroundBindingIntent,
  BindingSectionType,
  BindingSlotRole,
} from '@/types/playground';
import {
  getIndustryIntentProfile,
  synthesizeIndustryBindings,
} from '@/platform/core/industryIntentProfiles';

// ============================================================================
// Business Model → Required Pages
// ============================================================================

const MODEL_PAGES: Record<BusinessModel, PlaygroundPageRole[]> = {
  appointment_service: ['home', 'services', 'pricing', 'booking', 'booking_confirmation', 'about', 'contact'],
  quote_lead:          ['home', 'services', 'gallery', 'about', 'contact', 'faq', 'thankyou'],
  ecommerce:           ['home', 'shop', 'checkout', 'thankyou', 'about', 'contact', 'faq'],
  portfolio_creator:   ['home', 'gallery', 'about', 'contact', 'pricing'],
  restaurant_hospitality: ['home', 'services', 'gallery', 'booking', 'booking_confirmation', 'contact'],
  saas_digital:        ['home', 'pricing', 'about', 'contact', 'faq'],
  nonprofit:           ['home', 'about', 'gallery', 'contact'],
  general:             ['home', 'about', 'contact'],
};

// ============================================================================
// Business Model → Required Funnels
// ============================================================================

const MODEL_FUNNELS: Record<BusinessModel, PlaygroundFunnelGoal[]> = {
  appointment_service: ['booking'],
  quote_lead:          ['lead_capture'],
  ecommerce:           ['purchase'],
  portfolio_creator:   ['lead_capture'],
  restaurant_hospitality: ['booking'],
  saas_digital:        ['lead_capture'],
  nonprofit:           ['lead_capture'],
  general:             ['lead_capture'],
};

// ============================================================================
// Business Model → Required Forms
// ============================================================================

const MODEL_FORMS: Record<BusinessModel, string[]> = {
  appointment_service: ['booking_intake', 'contact'],
  quote_lead:          ['quote_request', 'contact'],
  ecommerce:           ['contact'],
  portfolio_creator:   ['contact', 'project_inquiry'],
  restaurant_hospitality: ['reservation', 'contact'],
  saas_digital:        ['demo_request', 'contact'],
  nonprofit:           ['volunteer', 'contact'],
  general:             ['contact'],
};

const MODEL_CALENDARS: Record<BusinessModel, string[]> = {
  appointment_service: ['main_booking'],
  quote_lead:          [],
  ecommerce:           [],
  portfolio_creator:   [],
  restaurant_hospitality: ['reservation'],
  saas_digital:        [],
  nonprofit:           [],
  general:             [],
};

// ============================================================================
// Industry Overlay Augmentation (V2 — slot-bound)
// ============================================================================

interface IndustryAugment {
  extraPages?: PlaygroundPageRole[];
  extraForms?: string[];
  calendars?: string[];
  products?: string[];
  popups?: string[];
  /** @deprecated Use extraBindingsV2 */
  extraBindings?: PlaygroundBindingSpec[];
  extraBindingsV2?: PlaygroundBindingSpecV2[];
}

const INDUSTRY_AUGMENTS: Partial<Record<IndustryOverlay, IndustryAugment>> = {
  salon: {
    calendars: ['main_booking'],
    popups: ['new_client_offer'],
    extraBindings: [
      { sourcePageRole: 'home', sourceLabel: 'Book Now', intent: 'calendar.open', targetRef: 'main_booking' },
      { sourcePageRole: 'pricing', sourceLabel: 'Book Now', intent: 'calendar.open', targetRef: 'main_booking' },
    ],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Book Now', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'main_booking', uiAction: 'overlay' },
      { sourcePageRole: 'pricing', sourceSection: 'pricing', sourceSlot: 'card-cta', label: 'Book Now', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'main_booking', uiAction: 'overlay' },
    ],
  },
  barber: {
    calendars: ['main_booking'],
    popups: ['first_visit_discount'],
    extraBindings: [
      { sourcePageRole: 'home', sourceLabel: 'Book Now', intent: 'calendar.open', targetRef: 'main_booking' },
    ],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Book Now', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'main_booking', uiAction: 'overlay' },
    ],
  },
  medspa: {
    extraPages: ['pricing'],
    calendars: ['consultation_booking'],
    popups: ['free_consultation_offer'],
    extraForms: ['consultation_intake'],
    extraBindings: [
      { sourcePageRole: 'home', sourceLabel: 'Book Consultation', intent: 'calendar.open', targetRef: 'consultation_booking' },
      { sourcePageRole: 'services', sourceLabel: 'Book Now', intent: 'calendar.open', targetRef: 'consultation_booking' },
    ],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Book Consultation', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'consultation_booking', uiAction: 'overlay' },
      { sourcePageRole: 'services', sourceSection: 'services', sourceSlot: 'card-cta', label: 'Book Now', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'consultation_booking', uiAction: 'overlay' },
    ],
  },
  wellness: {
    calendars: ['session_booking'],
    extraBindings: [
      { sourcePageRole: 'home', sourceLabel: 'Book Session', intent: 'calendar.open', targetRef: 'session_booking' },
    ],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Book Session', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'session_booking', uiAction: 'overlay' },
    ],
  },
  dental: {
    calendars: ['appointment_booking'],
    extraForms: ['patient_intake'],
    extraBindings: [
      { sourcePageRole: 'home', sourceLabel: 'Book Appointment', intent: 'calendar.open', targetRef: 'appointment_booking' },
    ],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Book Appointment', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'appointment_booking', uiAction: 'overlay' },
    ],
  },
  fitness: {
    calendars: ['class_booking'],
    extraPages: ['pricing'],
    extraBindings: [
      { sourcePageRole: 'home', sourceLabel: 'Join a Class', intent: 'calendar.open', targetRef: 'class_booking' },
    ],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Join a Class', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'class_booking', uiAction: 'overlay' },
    ],
  },
  contractor: {
    extraPages: ['gallery'],
    popups: ['free_estimate_popup'],
    extraBindings: [
      { sourcePageRole: 'home', sourceLabel: 'Get a Quote', intent: 'form.open', targetRef: 'quote_request' },
      { sourcePageRole: 'services', sourceLabel: 'Get Estimate', intent: 'form.open', targetRef: 'quote_request' },
    ],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Get a Quote', coreIntent: 'quote.request', intent: 'form.open', targetRef: 'quote_request', uiAction: 'overlay' },
      { sourcePageRole: 'services', sourceSection: 'services', sourceSlot: 'card-cta', label: 'Get Estimate', coreIntent: 'quote.request', intent: 'form.open', targetRef: 'quote_request', uiAction: 'overlay' },
    ],
  },
  hvac: {
    extraPages: ['faq'],
    popups: ['seasonal_offer'],
    extraBindings: [
      { sourcePageRole: 'home', sourceLabel: 'Get a Quote', intent: 'form.open', targetRef: 'quote_request' },
    ],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Get a Quote', coreIntent: 'quote.request', intent: 'form.open', targetRef: 'quote_request', uiAction: 'overlay' },
    ],
  },
  cleaning: {
    popups: ['first_clean_discount'],
    extraBindings: [
      { sourcePageRole: 'home', sourceLabel: 'Get a Quote', intent: 'form.open', targetRef: 'quote_request' },
      { sourcePageRole: 'pricing', sourceLabel: 'Book Now', intent: 'form.open', targetRef: 'quote_request' },
    ],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Get a Quote', coreIntent: 'quote.request', intent: 'form.open', targetRef: 'quote_request', uiAction: 'overlay' },
      { sourcePageRole: 'pricing', sourceSection: 'pricing', sourceSlot: 'card-cta', label: 'Book Now', coreIntent: 'quote.request', intent: 'form.open', targetRef: 'quote_request', uiAction: 'overlay' },
    ],
  },
  landscaping: {
    extraPages: ['gallery'],
    extraBindings: [
      { sourcePageRole: 'home', sourceLabel: 'Get Estimate', intent: 'form.open', targetRef: 'quote_request' },
    ],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Get Estimate', coreIntent: 'quote.request', intent: 'form.open', targetRef: 'quote_request', uiAction: 'overlay' },
    ],
  },
  coaching: {
    calendars: ['discovery_call'],
    extraPages: ['pricing'],
    popups: ['free_session_offer'],
    extraBindings: [
      { sourcePageRole: 'home', sourceLabel: 'Book Discovery Call', intent: 'calendar.open', targetRef: 'discovery_call' },
      { sourcePageRole: 'pricing', sourceLabel: 'Get Started', intent: 'calendar.open', targetRef: 'discovery_call' },
    ],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Book Discovery Call', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'discovery_call', uiAction: 'overlay' },
      { sourcePageRole: 'pricing', sourceSection: 'pricing', sourceSlot: 'card-cta', label: 'Get Started', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'discovery_call', uiAction: 'overlay' },
    ],
  },
  restaurant: {
    calendars: ['reservation'],
    extraBindings: [
      { sourcePageRole: 'home', sourceLabel: 'Reserve a Table', intent: 'calendar.open', targetRef: 'reservation' },
    ],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Reserve a Table', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'reservation', uiAction: 'overlay' },
    ],
  },
  photographer: {
    calendars: ['session_booking'],
    extraPages: ['gallery', 'pricing'],
    extraForms: ['project_inquiry'],
    extraBindings: [
      { sourcePageRole: 'home', sourceLabel: 'Book a Session', intent: 'calendar.open', targetRef: 'session_booking' },
      { sourcePageRole: 'gallery', sourceLabel: 'Book Now', intent: 'calendar.open', targetRef: 'session_booking' },
    ],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Book a Session', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'session_booking', uiAction: 'overlay' },
      { sourcePageRole: 'gallery', sourceSection: 'gallery', sourceSlot: 'card-cta', label: 'Book Now', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'session_booking', uiAction: 'overlay' },
    ],
  },
  auto_detailing: {
    extraPages: ['gallery'],
    extraForms: ['quote_request'],
    popups: ['free_estimate_popup'],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Get Detailing Quote', coreIntent: 'quote.request', intent: 'form.open', targetRef: 'quote_request', uiAction: 'overlay' },
      { sourcePageRole: 'gallery', sourceSection: 'gallery', sourceSlot: 'card-cta', label: 'Book This Package', coreIntent: 'quote.request', intent: 'form.open', targetRef: 'quote_request', uiAction: 'overlay' },
    ],
  },
  moving: {
    extraForms: ['quote_request'],
    extraPages: ['faq'],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Get Moving Quote', coreIntent: 'quote.request', intent: 'form.open', targetRef: 'quote_request', uiAction: 'overlay' },
      { sourcePageRole: 'services', sourceSection: 'services', sourceSlot: 'card-cta', label: 'Request Estimate', coreIntent: 'quote.request', intent: 'form.open', targetRef: 'quote_request', uiAction: 'overlay' },
    ],
  },
  legal: {
    calendars: ['consultation_booking'],
    extraForms: ['consultation_intake'],
    extraPages: ['faq'],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Book Consultation', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'consultation_booking', uiAction: 'overlay' },
      { sourcePageRole: 'services', sourceSection: 'services', sourceSlot: 'card-cta', label: 'Request Case Review', coreIntent: 'lead.capture', intent: 'form.open', targetRef: 'consultation_intake', uiAction: 'overlay' },
    ],
  },
  cafe: {
    calendars: ['reservation'],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Reserve a Table', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'reservation', uiAction: 'overlay' },
    ],
  },
  bakery: {
    extraForms: ['quote_request'],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Order Catering', coreIntent: 'quote.request', intent: 'form.open', targetRef: 'quote_request', uiAction: 'overlay' },
      { sourcePageRole: 'services', sourceSection: 'services', sourceSlot: 'card-cta', label: 'Request Catering', coreIntent: 'quote.request', intent: 'form.open', targetRef: 'quote_request', uiAction: 'overlay' },
    ],
  },
  creator: {
    extraPages: ['gallery', 'pricing'],
    extraForms: ['project_inquiry'],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'secondary-cta', label: 'Start Project', coreIntent: 'lead.capture', intent: 'form.open', targetRef: 'project_inquiry', uiAction: 'overlay' },
      { sourcePageRole: 'gallery', sourceSection: 'gallery', sourceSlot: 'card-cta', label: 'Request Availability', coreIntent: 'lead.capture', intent: 'form.open', targetRef: 'project_inquiry', uiAction: 'overlay' },
    ],
  },
  agency: {
    extraPages: ['pricing'],
    extraForms: ['quote_request'],
    calendars: ['discovery_call'],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Request Proposal', coreIntent: 'quote.request', intent: 'form.open', targetRef: 'quote_request', uiAction: 'overlay' },
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'secondary-cta', label: 'Book Strategy Call', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'discovery_call', uiAction: 'overlay' },
      { sourcePageRole: 'pricing', sourceSection: 'pricing', sourceSlot: 'card-cta', label: 'Discuss This Plan', coreIntent: 'lead.capture', intent: 'form.open', targetRef: 'quote_request', uiAction: 'overlay' },
    ],
  },
  nonprofit: {
    extraForms: ['volunteer'],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Donate Now', coreIntent: 'donation.start', intent: 'checkout.start', targetRef: 'donation', uiAction: 'navigate', payloadTemplate: { donationType: 'one-time' } },
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'secondary-cta', label: 'Contact Our Team', coreIntent: 'contact.submit', intent: 'form.open', targetRef: 'contact', uiAction: 'overlay' },
    ],
  },
  ecommerce: {
    products: ['ecommerce_primary'],
    extraBindings: [
      { sourcePageRole: 'home', sourceLabel: 'Shop Now', intent: 'nav.goto_page', targetRef: 'shop' },
    ],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Shop Now', coreIntent: 'nav.goto', intent: 'nav.goto_page', targetRef: 'shop', uiAction: 'navigate' },
      { sourcePageRole: 'shop', sourceSection: 'shop-grid', sourceSlot: 'card-cta', label: 'Add to Cart', coreIntent: 'cart.add', intent: 'checkout.start', targetRef: 'cart', uiAction: 'state', payloadTemplate: { productId: '$product.id', name: '$product.name', price: '$product.price', quantity: 1 } },
      { sourcePageRole: 'shop', sourceSection: 'cart', sourceSlot: 'checkout-cta', label: 'Checkout', coreIntent: 'cart.checkout', intent: 'checkout.start', targetRef: 'cart-overlay', uiAction: 'overlay' },
      { sourcePageRole: 'home', sourceSection: 'navbar', sourceSlot: 'cart-trigger', label: 'Cart', coreIntent: 'cart.view', intent: 'cart.view', targetRef: 'cart-overlay', uiAction: 'overlay' },
    ],
  },
  real_estate: {
    extraPages: ['gallery'],
    extraForms: ['property_inquiry'],
    extraBindings: [
      { sourcePageRole: 'home', sourceLabel: 'View Listings', intent: 'nav.goto_page', targetRef: 'gallery' },
      { sourcePageRole: 'home', sourceLabel: 'Contact Agent', intent: 'form.open', targetRef: 'property_inquiry' },
    ],
    extraBindingsV2: [
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'View Listings', coreIntent: 'nav.goto', intent: 'nav.goto_page', targetRef: 'gallery', uiAction: 'navigate' },
      { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'secondary-cta', label: 'Contact Agent', coreIntent: 'contact.submit', intent: 'form.open', targetRef: 'property_inquiry', uiAction: 'overlay' },
    ],
  },
};

// ============================================================================
// Universal Icon Bindings — Added to ALL business models
// ============================================================================

/** Icons that appear on every wizard-generated site regardless of model */
const UNIVERSAL_ICON_BINDINGS: PlaygroundBindingSpecV2[] = [
  // Search icon in navbar — inline-expand search field
  { sourcePageRole: 'home', sourceSection: 'navbar', sourceSlot: 'icon-search', label: 'Search', coreIntent: 'search.open', intent: 'nav.goto_page', targetRef: 'search', uiAction: 'overlay', payloadTemplate: { iconKey: 'search', interactive: 'search-field', uiBehavior: 'inline-expand' } },
  // User/account icon in navbar — dropdown auth menu
  { sourcePageRole: 'home', sourceSection: 'navbar', sourceSlot: 'icon-user', label: 'Account', coreIntent: 'account.open', intent: 'nav.goto_page', targetRef: 'auth', uiAction: 'overlay', payloadTemplate: { iconKey: 'user', interactive: 'user-menu', uiBehavior: 'dropdown' } },
  // Mobile menu hamburger
  { sourcePageRole: 'home', sourceSection: 'navbar', sourceSlot: 'icon-menu', label: 'Menu', coreIntent: 'menu.open', intent: 'nav.goto_page', targetRef: 'mobile-nav', uiAction: 'overlay', payloadTemplate: { iconKey: 'menu', interactive: 'mobile-menu', uiBehavior: 'overlay' } },
];

/** Ecommerce-specific icon bindings */
const ECOMMERCE_ICON_BINDINGS: PlaygroundBindingSpecV2[] = [
  // Cart icon in navbar — opens cart drawer with badge
  { sourcePageRole: 'home', sourceSection: 'navbar', sourceSlot: 'icon-cart', label: 'Cart', coreIntent: 'cart.view', intent: 'cart.view', targetRef: 'cart-overlay', uiAction: 'overlay', payloadTemplate: { iconKey: 'cart', interactive: 'cart-drawer', uiBehavior: 'overlay', hasBadge: true } },
  // Filter icon on shop grid
  { sourcePageRole: 'shop', sourceSection: 'shop-grid', sourceSlot: 'icon-filter', label: 'Filter', coreIntent: 'filter.open', intent: 'nav.goto_page', targetRef: 'filter', uiAction: 'overlay', payloadTemplate: { iconKey: 'filter', interactive: 'filter-panel', uiBehavior: 'inline-expand' } },
  // Sort icon on shop grid
  { sourcePageRole: 'shop', sourceSection: 'shop-grid', sourceSlot: 'icon-sort', label: 'Sort', coreIntent: 'sort.open', intent: 'nav.goto_page', targetRef: 'sort', uiAction: 'overlay', payloadTemplate: { iconKey: 'sort', interactive: 'sort-dropdown', uiBehavior: 'dropdown' } },
  // Favorite icon on product cards
  { sourcePageRole: 'shop', sourceSection: 'shop-grid', sourceSlot: 'icon-favorite', label: 'Favorite', coreIntent: 'favorite.toggle', intent: 'checkout.start', targetRef: 'favorites', uiAction: 'state', payloadTemplate: { iconKey: 'favorite', interactive: 'favorites-drawer', uiBehavior: 'state-toggle' } },
];

/** Booking-specific icon bindings */
const BOOKING_ICON_BINDINGS: PlaygroundBindingSpecV2[] = [
  // Calendar icon in navbar for booking models
  { sourcePageRole: 'home', sourceSection: 'navbar', sourceSlot: 'icon-calendar', label: 'Book', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'main_booking', uiAction: 'overlay', payloadTemplate: { iconKey: 'calendar', interactive: 'none', uiBehavior: 'overlay' } },
];

// ============================================================================
// Default CTA Bindings per Business Model (V2 — slot-bound)
// ============================================================================

const MODEL_BINDINGS_V2: Record<BusinessModel, PlaygroundBindingSpecV2[]> = {
  appointment_service: [
    { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Book Now', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'main_booking', uiAction: 'overlay' },
    { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'secondary-cta', label: 'View Services', coreIntent: 'nav.goto', intent: 'nav.goto_page', targetRef: 'services', uiAction: 'navigate' },
    { sourcePageRole: 'services', sourceSection: 'services', sourceSlot: 'card-cta', label: 'Book Now', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'main_booking', uiAction: 'overlay' },
    { sourcePageRole: 'pricing', sourceSection: 'pricing', sourceSlot: 'card-cta', label: 'Book Now', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'main_booking', uiAction: 'overlay' },
    { sourcePageRole: 'home', sourceSection: 'navbar', sourceSlot: 'primary-cta', label: 'Book Now', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'main_booking', uiAction: 'overlay' },
  ],
  quote_lead: [
    { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Get a Quote', coreIntent: 'quote.request', intent: 'form.open', targetRef: 'quote_request', uiAction: 'overlay' },
    { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'secondary-cta', label: 'View Services', coreIntent: 'nav.goto', intent: 'nav.goto_page', targetRef: 'services', uiAction: 'navigate' },
    { sourcePageRole: 'services', sourceSection: 'services', sourceSlot: 'card-cta', label: 'Get a Quote', coreIntent: 'quote.request', intent: 'form.open', targetRef: 'quote_request', uiAction: 'overlay' },
    { sourcePageRole: 'home', sourceSection: 'navbar', sourceSlot: 'primary-cta', label: 'Request Quote', coreIntent: 'quote.request', intent: 'form.open', targetRef: 'quote_request', uiAction: 'overlay' },
  ],
  ecommerce: [
    { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Shop Now', coreIntent: 'nav.goto', intent: 'nav.goto_page', targetRef: 'shop', uiAction: 'navigate' },
    { sourcePageRole: 'shop', sourceSection: 'shop-grid', sourceSlot: 'card-cta', label: 'Add to Cart', coreIntent: 'cart.add', intent: 'checkout.start', targetRef: 'cart', uiAction: 'state', payloadTemplate: { productId: '$product.id', name: '$product.name', price: '$product.price', quantity: 1 } },
    { sourcePageRole: 'shop', sourceSection: 'cart', sourceSlot: 'checkout-cta', label: 'Checkout', coreIntent: 'cart.checkout', intent: 'checkout.start', targetRef: 'cart-overlay', uiAction: 'overlay' },
  ],
  portfolio_creator: [
    { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'View Work', coreIntent: 'nav.goto', intent: 'nav.goto_page', targetRef: 'gallery', uiAction: 'navigate' },
    { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'secondary-cta', label: 'Start Project', coreIntent: 'lead.capture', intent: 'form.open', targetRef: 'project_inquiry', uiAction: 'overlay' },
    { sourcePageRole: 'gallery', sourceSection: 'gallery', sourceSlot: 'card-cta', label: 'Request Availability', coreIntent: 'lead.capture', intent: 'form.open', targetRef: 'project_inquiry', uiAction: 'overlay' },
  ],
  restaurant_hospitality: [
    { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Reserve a Table', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'reservation', uiAction: 'overlay' },
    { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'secondary-cta', label: 'View Menu', coreIntent: 'nav.goto', intent: 'nav.goto_page', targetRef: 'services', uiAction: 'navigate' },
    { sourcePageRole: 'home', sourceSection: 'navbar', sourceSlot: 'primary-cta', label: 'Reserve', coreIntent: 'booking.create', intent: 'calendar.open', targetRef: 'reservation', uiAction: 'overlay' },
  ],
  saas_digital: [
    { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Start Free Trial', coreIntent: 'auth.register', intent: 'popup.open', targetRef: 'auth-register', uiAction: 'overlay' },
    { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'secondary-cta', label: 'Request Demo', coreIntent: 'lead.capture', intent: 'form.open', targetRef: 'demo_request', uiAction: 'overlay' },
    { sourcePageRole: 'pricing', sourceSection: 'pricing', sourceSlot: 'card-cta', label: 'Contact Sales', coreIntent: 'lead.capture', intent: 'form.open', targetRef: 'demo_request', uiAction: 'overlay' },
    { sourcePageRole: 'home', sourceSection: 'navbar', sourceSlot: 'primary-cta', label: 'Start Trial', coreIntent: 'auth.register', intent: 'popup.open', targetRef: 'auth-register', uiAction: 'overlay' },
  ],
  nonprofit: [
    { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Donate Now', coreIntent: 'donation.start', intent: 'checkout.start', targetRef: 'donation', uiAction: 'navigate', payloadTemplate: { donationType: 'one-time' } },
    { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'secondary-cta', label: 'Contact Our Team', coreIntent: 'contact.submit', intent: 'form.open', targetRef: 'contact', uiAction: 'overlay' },
  ],
  general: [
    { sourcePageRole: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta', label: 'Contact Us', coreIntent: 'contact.submit', intent: 'form.open', targetRef: 'contact', uiAction: 'overlay' },
  ],
};

/** @deprecated Legacy label-bound bindings. Use MODEL_BINDINGS_V2. */
const MODEL_BINDINGS: Record<BusinessModel, PlaygroundBindingSpec[]> = {
  appointment_service: [
    { sourcePageRole: 'home', sourceLabel: 'Book Now', intent: 'calendar.open', targetRef: 'main_booking' },
    { sourcePageRole: 'home', sourceLabel: 'View Services', intent: 'nav.goto_page', targetRef: 'services' },
    { sourcePageRole: 'services', sourceLabel: 'Book Now', intent: 'calendar.open', targetRef: 'main_booking' },
    { sourcePageRole: 'pricing', sourceLabel: 'Book Now', intent: 'calendar.open', targetRef: 'main_booking' },
  ],
  quote_lead: [
    { sourcePageRole: 'home', sourceLabel: 'Get a Quote', intent: 'form.open', targetRef: 'quote_request' },
    { sourcePageRole: 'home', sourceLabel: 'View Services', intent: 'nav.goto_page', targetRef: 'services' },
    { sourcePageRole: 'services', sourceLabel: 'Get a Quote', intent: 'form.open', targetRef: 'quote_request' },
  ],
  ecommerce: [
    { sourcePageRole: 'home', sourceLabel: 'Shop Now', intent: 'nav.goto_page', targetRef: 'shop' },
    { sourcePageRole: 'shop', sourceLabel: 'Checkout', intent: 'nav.goto_page', targetRef: 'checkout' },
  ],
  portfolio_creator: [
    { sourcePageRole: 'home', sourceLabel: 'View Work', intent: 'nav.goto_page', targetRef: 'gallery' },
    { sourcePageRole: 'home', sourceLabel: 'Get in Touch', intent: 'form.open', targetRef: 'project_inquiry' },
    { sourcePageRole: 'gallery', sourceLabel: 'Contact', intent: 'form.open', targetRef: 'project_inquiry' },
  ],
  restaurant_hospitality: [
    { sourcePageRole: 'home', sourceLabel: 'Reserve a Table', intent: 'calendar.open', targetRef: 'reservation' },
    { sourcePageRole: 'home', sourceLabel: 'View Menu', intent: 'nav.goto_page', targetRef: 'services' },
  ],
  saas_digital: [
    { sourcePageRole: 'home', sourceLabel: 'Get Started', intent: 'popup.open', targetRef: 'auth-register' },
    { sourcePageRole: 'pricing', sourceLabel: 'Contact Sales', intent: 'form.open', targetRef: 'demo_request' },
  ],
  nonprofit: [
    { sourcePageRole: 'home', sourceLabel: 'Learn More', intent: 'nav.goto_page', targetRef: 'about' },
    { sourcePageRole: 'home', sourceLabel: 'Get Involved', intent: 'form.open', targetRef: 'volunteer' },
  ],
  general: [
    { sourcePageRole: 'home', sourceLabel: 'Contact Us', intent: 'form.open', targetRef: 'contact' },
  ],
};

// ============================================================================
// Core Resolver
// ============================================================================

/**
 * Resolve wizard selections into a deterministic capability pack.
 * No AI, no randomness — purely data-driven.
 */
export function resolveCapabilities(selections: WizardSelections): CapabilityPack {
  const model = selections.businessModel;
  const overlay = selections.industryOverlay;
  const augment = INDUSTRY_AUGMENTS[overlay] || {};

  // 1. Pages: model defaults + industry augments + goal-based additions
  const pageSet = new Set<PlaygroundPageRole>(MODEL_PAGES[model] || MODEL_PAGES.general);
  if (augment.extraPages) augment.extraPages.forEach(p => pageSet.add(p));
  if (selections.needsBooking && !pageSet.has('booking')) {
    pageSet.add('booking');
    pageSet.add('booking_confirmation');
  }
  if (selections.sellsProducts && !pageSet.has('shop')) {
    pageSet.add('shop');
    pageSet.add('checkout');
    pageSet.add('thankyou');
  }
  if (selections.wantsLeadCapture && !pageSet.has('contact')) {
    pageSet.add('contact');
  }

  // Honor visitor-selected pages from the Wizard "Pages" step. These are the
  // pages the user explicitly checked; they must surface in the registry,
  // topology, router, and binding guide regardless of business-model defaults.
  const VALID_REQUESTED: PlaygroundPageRole[] = [
    'home','about','services','pricing','gallery','contact','booking',
    'booking_confirmation','checkout','thankyou','faq','blog','shop','immersive','custom',
  ];
  for (const raw of selections.requestedPages ?? []) {
    const role = (raw as PlaygroundPageRole);
    if (VALID_REQUESTED.includes(role)) pageSet.add(role);
  }

  // 2. Funnels
  const funnelSet = new Set<PlaygroundFunnelGoal>(MODEL_FUNNELS[model] || MODEL_FUNNELS.general);
  if (selections.needsBooking) funnelSet.add('booking');
  if (selections.sellsProducts) funnelSet.add('purchase');
  if (selections.wantsLeadCapture) funnelSet.add('lead_capture');

  // 3. Forms
  const formSet = new Set<string>(MODEL_FORMS[model] || MODEL_FORMS.general);
  if (augment.extraForms) augment.extraForms.forEach(f => formSet.add(f));

  // 4. Calendars
  const calendarSet = new Set<string>(MODEL_CALENDARS[model] || []);
  if (augment.calendars) augment.calendars.forEach((calendar) => calendarSet.add(calendar));
  if (selections.needsBooking && calendarSet.size === 0) calendarSet.add('main_booking');

  // 5. Products
  const productSet = new Set<string>(augment.products || []);

  // 6. Popups
  const popupSet = new Set<string>(augment.popups || []);

  // 7. Legacy bindings (backward compat)
  const bindingSpecs: PlaygroundBindingSpec[] = [
    ...(MODEL_BINDINGS[model] || MODEL_BINDINGS.general),
  ];
  if (augment.extraBindings) {
    for (const ib of augment.extraBindings) {
      const existingIdx = bindingSpecs.findIndex(
        b => b.sourcePageRole === ib.sourcePageRole && b.sourceLabel === ib.sourceLabel
      );
      if (existingIdx >= 0) {
        bindingSpecs[existingIdx] = ib;
      } else {
        bindingSpecs.push(ib);
      }
    }
  }

  // 8. V2 slot-bound bindings (authoritative) — CTA + Icon bindings
  const bindingSpecsV2: PlaygroundBindingSpecV2[] = [
    ...(MODEL_BINDINGS_V2[model] || MODEL_BINDINGS_V2.general),
    // Universal icon bindings (search, user, menu — all models)
    ...UNIVERSAL_ICON_BINDINGS,
  ];

  // Add model-specific icon bindings
  if (model === 'ecommerce' || selections.sellsProducts) {
    bindingSpecsV2.push(...ECOMMERCE_ICON_BINDINGS);
  }
  if (model === 'appointment_service' || model === 'restaurant_hospitality' || selections.needsBooking) {
    bindingSpecsV2.push(...BOOKING_ICON_BINDINGS);
  }

  // Merge industry augments (dedup by page + section + slot)
  if (augment.extraBindingsV2) {
    for (const ib of augment.extraBindingsV2) {
      // Slot-bound dedup: same page + section + slot = override
      const existingIdx = bindingSpecsV2.findIndex(
        b => b.sourcePageRole === ib.sourcePageRole &&
             b.sourceSection === ib.sourceSection &&
             b.sourceSlot === ib.sourceSlot
      );
      if (existingIdx >= 0) {
        bindingSpecsV2[existingIdx] = ib;
      } else {
        bindingSpecsV2.push(ib);
      }
    }
  }

  // 9. Industry profile synthesis — strip forbidden intents and stamp any
  // required/primary/secondary intents that no binding spec covers yet.
  // Driven by INDUSTRY_INTENT_PROFILES[industryOverlay].intents (unified shape).
  const profile = getIndustryIntentProfile(selections.industryOverlay as string);
  const synth = synthesizeIndustryBindings(profile, bindingSpecsV2, {
    availablePageRoles: pageSet,
  });
  const finalBindingsV2 = [...synth.kept, ...synth.synthesized];

  return {
    id: `cap_${nanoid(8)}`,
    requiredPages: Array.from(pageSet),
    requiredFunnels: Array.from(funnelSet),
    requiredForms: Array.from(formSet),
    requiredCalendars: Array.from(calendarSet),
    requiredProducts: Array.from(productSet),
    recommendedPopups: Array.from(popupSet),
    recommendedBindings: bindingSpecs,
    recommendedBindingsV2: finalBindingsV2,
  };
}
