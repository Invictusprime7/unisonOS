/**
 * Industry Intent Profiles — UNIFIED shape.
 *
 * One source of truth per industry. The `intents` map declares BOTH:
 *   1. policy (level: required | primary | secondary | optional | forbidden)
 *   2. synthesis (where to stamp the intent if no binding spec already covers it)
 *
 * Each industry is unique. Synthesis slots are tailored to that industry's
 * conversion model — never copy-paste between verticals.
 *
 * Legacy flat arrays (required/primary/secondary/optional/forbidden) are
 * auto-derived from `intents` for back-compat with existing callers.
 */
import type { CoreIntent } from './coreIntents';
import { normalizeIndustryKey } from './industryMatrix';
import type {
  BindingSectionType,
  BindingSlotRole,
  PlaygroundBindingSpecV2,
  PlaygroundBindingIntent,
  PlaygroundPageRole,
} from './playground';

// ============================================================================
// Types
// ============================================================================

export type IntentLevel = 'required' | 'primary' | 'secondary' | 'optional' | 'forbidden';

export interface SlotCoord {
  pageRole: PlaygroundPageRole;
  section: BindingSectionType;
  slot: BindingSlotRole;
  /** Only synthesize if this page actually exists in the topology */
  ifPageExists?: boolean;
  /** Default label for the synthesized binding */
  label?: string;
  /** Authoring intent (playground-layer) */
  intent?: PlaygroundBindingIntent;
  /** Target reference (pageRole, formId, route, etc.) */
  targetRef?: string;
  /** UI response mode */
  uiAction?: 'navigate' | 'overlay' | 'state' | 'toast';
  /** Optional payload template (data-* attrs at stamp time) */
  payloadTemplate?: Record<string, unknown>;
}

export interface IntentSpec {
  level: IntentLevel;
  /** Slots to stamp this intent on, in priority order */
  synthesize?: SlotCoord[];
}

export interface IndustryIntentProfile {
  industry: string;
  /** Unified intent map (preferred). When present, legacy arrays are auto-derived. */
  intents?: Partial<Record<string, IntentSpec>>;
  required: CoreIntent[];
  primary: CoreIntent[];
  secondary: CoreIntent[];
  optional: CoreIntent[];
  forbidden: CoreIntent[];
}

// ============================================================================
// Helpers
// ============================================================================

/** Builds a profile from a unified intents map; derives legacy arrays. */
function profileFromMap(
  industry: string,
  intents: Partial<Record<string, IntentSpec>>,
): IndustryIntentProfile {
  const bucket = (level: IntentLevel): CoreIntent[] =>
    Object.entries(intents)
      .filter(([, spec]) => spec?.level === level)
      .map(([name]) => name);

  return {
    industry,
    intents,
    required: bucket('required'),
    primary: bucket('primary'),
    secondary: bucket('secondary'),
    optional: bucket('optional'),
    forbidden: bucket('forbidden'),
  };
}

// ============================================================================
// Shared synthesis fragments (NOT copies of salon — common to all industries)
// ============================================================================

const FOOTER_CONTACT_CALL: SlotCoord = {
  pageRole: 'home', section: 'footer', slot: 'phone-link', label: 'Call',
  intent: 'external.open', targetRef: 'tel:$businessInfo.phone', uiAction: 'navigate',
};
const FOOTER_CONTACT_EMAIL: SlotCoord = {
  pageRole: 'home', section: 'footer', slot: 'email-link', label: 'Email',
  intent: 'external.open', targetRef: 'mailto:$businessInfo.email', uiAction: 'navigate',
};
const FOOTER_DIRECTIONS: SlotCoord = {
  pageRole: 'home', section: 'footer', slot: 'address-link', label: 'Directions',
  intent: 'external.open', targetRef: 'maps:$businessInfo.address', uiAction: 'navigate',
};
const FOOTER_NEWSLETTER: SlotCoord = {
  pageRole: 'home', section: 'footer', slot: 'newsletter-submit', label: 'Subscribe',
  intent: 'form.open', targetRef: 'newsletter_form', uiAction: 'state',
};

// ============================================================================
// Profiles — each vertical authored to its own conversion model
// ============================================================================

export const INDUSTRY_INTENT_PROFILES: Record<string, IndustryIntentProfile> = {
  // ─────────────── Salon ───────────────
  salon: profileFromMap('salon', {
    'nav.goto': { level: 'required' },
    'booking.create': {
      level: 'required',
      synthesize: [
        { pageRole: 'home', section: 'hero', slot: 'primary-cta', label: 'Book Now',
          intent: 'calendar.open', targetRef: 'main_booking', uiAction: 'overlay' },
        { pageRole: 'home', section: 'navbar', slot: 'primary-cta', label: 'Book',
          intent: 'calendar.open', targetRef: 'main_booking', uiAction: 'overlay' },
        { pageRole: 'services', section: 'services', slot: 'card-cta', ifPageExists: true,
          label: 'Book Now', intent: 'calendar.open', targetRef: 'main_booking',
          uiAction: 'overlay', payloadTemplate: { 'data-service': '$service.slug' } },
        { pageRole: 'pricing', section: 'pricing', slot: 'card-cta', ifPageExists: true,
          label: 'Book Now', intent: 'calendar.open', targetRef: 'main_booking',
          uiAction: 'overlay', payloadTemplate: { 'data-plan': '$plan.id' } },
        { pageRole: 'booking', section: 'contact', slot: 'form-submit', ifPageExists: true,
          label: 'Book Appointment', intent: 'form.open', targetRef: 'booking_form',
          uiAction: 'state' },
      ],
    },
    'contact.submit': {
      level: 'required',
      synthesize: [
        { pageRole: 'contact', section: 'contact', slot: 'form-submit', ifPageExists: true,
          label: 'Send Message', intent: 'form.open', targetRef: 'contact_form', uiAction: 'state' },
      ],
    },
    'contact.call':       { level: 'secondary', synthesize: [FOOTER_CONTACT_CALL] },
    'location.directions':{ level: 'secondary', synthesize: [FOOTER_DIRECTIONS] },
    'newsletter.subscribe':{ level: 'secondary', synthesize: [FOOTER_NEWSLETTER] },
    'coupon.claim':       { level: 'optional' },
    'pay.checkout':       { level: 'optional' },
    'quote.request':      { level: 'forbidden' },
    'cart.add':           { level: 'forbidden' },
    'cart.checkout':      { level: 'forbidden' },
    'donation.start':     { level: 'forbidden' },
  }),

  // ─────────────── Local Service / Contractor (trust + urgency) ───────────────
  'local-service': profileFromMap('local-service', {
    'nav.goto': { level: 'required' },
    'quote.request': {
      level: 'required',
      synthesize: [
        { pageRole: 'home', section: 'hero', slot: 'primary-cta', label: 'Get Free Estimate',
          intent: 'form.open', targetRef: 'quote_form', uiAction: 'overlay' },
        { pageRole: 'home', section: 'navbar', slot: 'primary-cta', label: 'Get Quote',
          intent: 'form.open', targetRef: 'quote_form', uiAction: 'overlay' },
        { pageRole: 'services', section: 'services', slot: 'card-cta', ifPageExists: true,
          label: 'Request Estimate', intent: 'form.open', targetRef: 'quote_form',
          uiAction: 'overlay', payloadTemplate: { 'data-service': '$service.slug' } },
        { pageRole: 'home', section: 'cta', slot: 'primary-cta', label: 'Get Free Estimate',
          intent: 'form.open', targetRef: 'quote_form', uiAction: 'overlay' },
      ],
    },
    'contact.call': {
      level: 'required',
      synthesize: [
        { pageRole: 'home', section: 'hero', slot: 'secondary-cta', label: 'Call Now',
          intent: 'external.open', targetRef: 'tel:$businessInfo.phone', uiAction: 'navigate' },
        { pageRole: 'home', section: 'navbar', slot: 'phone-link', label: '$businessInfo.phone',
          intent: 'external.open', targetRef: 'tel:$businessInfo.phone', uiAction: 'navigate' },
        FOOTER_CONTACT_CALL,
      ],
    },
    'contact.submit': {
      level: 'required',
      synthesize: [
        { pageRole: 'contact', section: 'contact', slot: 'form-submit', ifPageExists: true,
          label: 'Send Message', intent: 'form.open', targetRef: 'contact_form', uiAction: 'state' },
      ],
    },
    'contact.sms':        { level: 'secondary', synthesize: [
      { pageRole: 'home', section: 'footer', slot: 'phone-link', label: 'Text Us',
        intent: 'external.open', targetRef: 'sms:$businessInfo.phone', uiAction: 'navigate' },
    ] },
    'location.directions':{ level: 'secondary', synthesize: [FOOTER_DIRECTIONS] },
    'newsletter.subscribe':{ level: 'optional', synthesize: [FOOTER_NEWSLETTER] },
    'booking.create':     { level: 'optional' },
    'cart.add':           { level: 'forbidden' },
    'cart.checkout':      { level: 'forbidden' },
    'donation.start':     { level: 'forbidden' },
  }),

  // contractor = alias of local-service intent model
  contractor: profileFromMap('contractor', {
    'nav.goto': { level: 'required' },
    'quote.request': {
      level: 'required',
      synthesize: [
        { pageRole: 'home', section: 'hero', slot: 'primary-cta', label: 'Get Free Estimate',
          intent: 'form.open', targetRef: 'quote_form', uiAction: 'overlay' },
        { pageRole: 'home', section: 'navbar', slot: 'primary-cta', label: 'Get Quote',
          intent: 'form.open', targetRef: 'quote_form', uiAction: 'overlay' },
      ],
    },
    'contact.call': {
      level: 'required',
      synthesize: [
        { pageRole: 'home', section: 'hero', slot: 'secondary-cta', label: 'Call Now',
          intent: 'external.open', targetRef: 'tel:$businessInfo.phone', uiAction: 'navigate' },
        FOOTER_CONTACT_CALL,
      ],
    },
    'contact.submit':     { level: 'required', synthesize: [
      { pageRole: 'contact', section: 'contact', slot: 'form-submit', ifPageExists: true,
        label: 'Send Message', intent: 'form.open', targetRef: 'contact_form', uiAction: 'state' },
    ] },
    'contact.sms':        { level: 'secondary' },
    'location.directions':{ level: 'secondary', synthesize: [FOOTER_DIRECTIONS] },
    'newsletter.subscribe':{ level: 'optional', synthesize: [FOOTER_NEWSLETTER] },
    'booking.create':     { level: 'optional' },
    'cart.add':           { level: 'forbidden' },
    'cart.checkout':      { level: 'forbidden' },
    'donation.start':     { level: 'forbidden' },
  }),

  // ─────────────── Coaching / Consulting ───────────────
  coaching: profileFromMap('coaching', {
    'nav.goto': { level: 'required' },
    'booking.create': {
      level: 'required',
      synthesize: [
        { pageRole: 'home', section: 'hero', slot: 'primary-cta', label: 'Book Discovery Call',
          intent: 'calendar.open', targetRef: 'discovery_call', uiAction: 'overlay' },
        { pageRole: 'home', section: 'navbar', slot: 'primary-cta', label: 'Book a Call',
          intent: 'calendar.open', targetRef: 'discovery_call', uiAction: 'overlay' },
        { pageRole: 'services', section: 'services', slot: 'card-cta', ifPageExists: true,
          label: 'Apply Now', intent: 'calendar.open', targetRef: 'discovery_call',
          uiAction: 'overlay', payloadTemplate: { 'data-program': '$service.slug' } },
        { pageRole: 'pricing', section: 'pricing', slot: 'card-cta', ifPageExists: true,
          label: 'Enroll', intent: 'calendar.open', targetRef: 'discovery_call', uiAction: 'overlay' },
      ],
    },
    'lead.capture': {
      level: 'required',
      synthesize: [
        { pageRole: 'home', section: 'hero', slot: 'secondary-cta', label: 'Free Resource',
          intent: 'form.open', targetRef: 'lead_magnet_form', uiAction: 'overlay' },
        { pageRole: 'home', section: 'cta', slot: 'primary-cta', label: 'Get the Free Guide',
          intent: 'form.open', targetRef: 'lead_magnet_form', uiAction: 'overlay' },
      ],
    },
    'contact.submit':     { level: 'required', synthesize: [
      { pageRole: 'contact', section: 'contact', slot: 'form-submit', ifPageExists: true,
        label: 'Send Message', intent: 'form.open', targetRef: 'contact_form', uiAction: 'state' },
    ] },
    'content.download':   { level: 'secondary' },
    'newsletter.subscribe':{ level: 'secondary', synthesize: [FOOTER_NEWSLETTER] },
    'contact.email':      { level: 'optional', synthesize: [FOOTER_CONTACT_EMAIL] },
    'cart.add':           { level: 'forbidden' },
    'quote.request':      { level: 'forbidden' },
    'donation.start':     { level: 'forbidden' },
  }),

  // ─────────────── Restaurant ───────────────
  restaurant: profileFromMap('restaurant', {
    'nav.goto': { level: 'required' },
    'booking.create': {
      level: 'required',
      synthesize: [
        { pageRole: 'home', section: 'hero', slot: 'primary-cta', label: 'Reserve a Table',
          intent: 'calendar.open', targetRef: 'reservations', uiAction: 'overlay' },
        { pageRole: 'home', section: 'navbar', slot: 'primary-cta', label: 'Reservations',
          intent: 'calendar.open', targetRef: 'reservations', uiAction: 'overlay' },
        { pageRole: 'home', section: 'cta', slot: 'primary-cta', label: 'Book a Table',
          intent: 'calendar.open', targetRef: 'reservations', uiAction: 'overlay' },
      ],
    },
    'contact.call': {
      level: 'required',
      synthesize: [
        { pageRole: 'home', section: 'hero', slot: 'secondary-cta', label: 'Call to Order',
          intent: 'external.open', targetRef: 'tel:$businessInfo.phone', uiAction: 'navigate' },
        FOOTER_CONTACT_CALL,
      ],
    },
    'location.directions': {
      level: 'required',
      synthesize: [
        FOOTER_DIRECTIONS,
        { pageRole: 'contact', section: 'contact', slot: 'address-link', ifPageExists: true,
          label: 'Get Directions', intent: 'external.open',
          targetRef: 'maps:$businessInfo.address', uiAction: 'navigate' },
      ],
    },
    'menu.view':          { level: 'secondary' },
    'newsletter.subscribe':{ level: 'secondary', synthesize: [FOOTER_NEWSLETTER] },
    'coupon.claim':       { level: 'optional' },
    'pay.checkout':       { level: 'optional' },
    'quote.request':      { level: 'forbidden' },
    'cart.add':           { level: 'optional' },
    'donation.start':     { level: 'forbidden' },
  }),

  // ─────────────── E-commerce ───────────────
  ecommerce: profileFromMap('ecommerce', {
    'nav.goto': { level: 'required' },
    'cart.add': {
      level: 'required',
      synthesize: [
        { pageRole: 'shop', section: 'shop-grid', slot: 'card-cta', ifPageExists: true,
          label: 'Add to Cart', intent: 'checkout.start', targetRef: '$product.id',
          uiAction: 'state', payloadTemplate: { 'data-product': '$product.id' } },
        { pageRole: 'home', section: 'services', slot: 'card-cta',
          label: 'Add to Cart', intent: 'checkout.start', targetRef: '$product.id',
          uiAction: 'state', payloadTemplate: { 'data-product': '$product.id' } },
      ],
    },
    'cart.view': {
      level: 'required',
      synthesize: [
        { pageRole: 'home', section: 'navbar', slot: 'cart-trigger', label: 'Cart',
          intent: 'popup.open', targetRef: 'cart_drawer', uiAction: 'overlay' },
      ],
    },
    'cart.checkout': {
      level: 'required',
      synthesize: [
        { pageRole: 'checkout', section: 'cart', slot: 'checkout-cta', ifPageExists: true,
          label: 'Checkout', intent: 'nav.goto_page', targetRef: 'checkout', uiAction: 'navigate' },
      ],
    },
    'product.view':       { level: 'primary' },
    'search.open':        { level: 'secondary', synthesize: [
      { pageRole: 'home', section: 'navbar', slot: 'icon-search', label: 'Search',
        intent: 'popup.open', targetRef: 'search_overlay', uiAction: 'overlay' },
    ] },
    'filter.open':        { level: 'secondary' },
    'favorite.toggle':    { level: 'secondary', synthesize: [
      { pageRole: 'shop', section: 'shop-grid', slot: 'icon-favorite', ifPageExists: true,
        label: 'Save', intent: 'popup.open', targetRef: 'favorite',
        payloadTemplate: { 'data-product': '$product.id' } },
    ] },
    'newsletter.subscribe':{ level: 'secondary', synthesize: [FOOTER_NEWSLETTER] },
    'auth.login':         { level: 'optional', synthesize: [
      { pageRole: 'home', section: 'navbar', slot: 'icon-user', label: 'Account',
        intent: 'nav.goto_page', targetRef: 'account', uiAction: 'navigate' },
    ] },
    'auth.register':      { level: 'optional' },
    'account.open':       { level: 'optional' },
    'booking.create':     { level: 'forbidden' },
    'quote.request':      { level: 'forbidden' },
    'donation.start':     { level: 'forbidden' },
  }),

  // ─────────────── Agency / B2B ───────────────
  agency: profileFromMap('agency', {
    'nav.goto': { level: 'required' },
    'lead.capture': {
      level: 'required',
      synthesize: [
        { pageRole: 'home', section: 'hero', slot: 'primary-cta', label: 'Get a Free Consultation',
          intent: 'form.open', targetRef: 'lead_form', uiAction: 'overlay' },
        { pageRole: 'home', section: 'navbar', slot: 'primary-cta', label: 'Get Started',
          intent: 'form.open', targetRef: 'lead_form', uiAction: 'overlay' },
        { pageRole: 'home', section: 'cta', slot: 'primary-cta', label: 'Book a Strategy Call',
          intent: 'form.open', targetRef: 'lead_form', uiAction: 'overlay' },
      ],
    },
    'quote.request': {
      level: 'required',
      synthesize: [
        { pageRole: 'services', section: 'services', slot: 'card-cta', ifPageExists: true,
          label: 'Request Proposal', intent: 'form.open', targetRef: 'proposal_form',
          uiAction: 'overlay', payloadTemplate: { 'data-service': '$service.slug' } },
      ],
    },
    'contact.submit':     { level: 'required', synthesize: [
      { pageRole: 'contact', section: 'contact', slot: 'form-submit', ifPageExists: true,
        label: 'Send Message', intent: 'form.open', targetRef: 'contact_form', uiAction: 'state' },
    ] },
    'booking.create':     { level: 'secondary' },
    'content.download':   { level: 'secondary' },
    'newsletter.subscribe':{ level: 'secondary', synthesize: [FOOTER_NEWSLETTER] },
    'demo.request':       { level: 'optional' },
    'proposal.request':   { level: 'optional' },
    'contact.email':      { level: 'optional', synthesize: [FOOTER_CONTACT_EMAIL] },
    'cart.add':           { level: 'forbidden' },
    'cart.checkout':      { level: 'forbidden' },
    'donation.start':     { level: 'forbidden' },
  }),

  // ─────────────── Nonprofit ───────────────
  nonprofit: profileFromMap('nonprofit', {
    'nav.goto': { level: 'required' },
    'donation.start': {
      level: 'required',
      synthesize: [
        { pageRole: 'home', section: 'hero', slot: 'primary-cta', label: 'Donate Now',
          intent: 'nav.goto_page', targetRef: 'donate', uiAction: 'navigate' },
        { pageRole: 'home', section: 'navbar', slot: 'primary-cta', label: 'Donate',
          intent: 'nav.goto_page', targetRef: 'donate', uiAction: 'navigate' },
        { pageRole: 'home', section: 'cta', slot: 'primary-cta', label: 'Give Today',
          intent: 'nav.goto_page', targetRef: 'donate', uiAction: 'navigate' },
      ],
    },
    'volunteer.signup': {
      level: 'required',
      synthesize: [
        { pageRole: 'home', section: 'hero', slot: 'secondary-cta', label: 'Volunteer',
          intent: 'form.open', targetRef: 'volunteer_form', uiAction: 'overlay' },
        { pageRole: 'home', section: 'cta', slot: 'secondary-cta', label: 'Get Involved',
          intent: 'form.open', targetRef: 'volunteer_form', uiAction: 'overlay' },
      ],
    },
    'contact.submit':     { level: 'required', synthesize: [
      { pageRole: 'contact', section: 'contact', slot: 'form-submit', ifPageExists: true,
        label: 'Contact Us', intent: 'form.open', targetRef: 'contact_form', uiAction: 'state' },
    ] },
    'newsletter.subscribe':{ level: 'secondary', synthesize: [FOOTER_NEWSLETTER] },
    'contact.call':       { level: 'secondary', synthesize: [FOOTER_CONTACT_CALL] },
    'pay.checkout':       { level: 'optional' },
    'cart.add':           { level: 'forbidden' },
    'booking.create':     { level: 'forbidden' },
    'quote.request':      { level: 'forbidden' },
  }),

  // ─────────────── Portfolio / Creative ───────────────
  portfolio: profileFromMap('portfolio', {
    'nav.goto': { level: 'required' },
    'contact.submit': {
      level: 'required',
      synthesize: [
        { pageRole: 'home', section: 'hero', slot: 'primary-cta', label: 'Start a Project',
          intent: 'form.open', targetRef: 'inquiry_form', uiAction: 'overlay' },
        { pageRole: 'home', section: 'cta', slot: 'primary-cta', label: "Let's Work Together",
          intent: 'form.open', targetRef: 'inquiry_form', uiAction: 'overlay' },
        { pageRole: 'contact', section: 'contact', slot: 'form-submit', ifPageExists: true,
          label: 'Send Inquiry', intent: 'form.open', targetRef: 'inquiry_form', uiAction: 'state' },
      ],
    },
    'lead.capture':       { level: 'primary' },
    'content.download':   { level: 'secondary' },
    'newsletter.subscribe':{ level: 'secondary', synthesize: [FOOTER_NEWSLETTER] },
    'contact.email':      { level: 'secondary', synthesize: [FOOTER_CONTACT_EMAIL] },
    'booking.create':     { level: 'optional' },
    'share.open':         { level: 'optional' },
    'cart.add':           { level: 'forbidden' },
    'cart.checkout':      { level: 'forbidden' },
    'quote.request':      { level: 'forbidden' },
    'donation.start':     { level: 'forbidden' },
  }),

  // ─────────────── Real Estate ───────────────
  'real-estate': profileFromMap('real-estate', {
    'nav.goto': { level: 'required' },
    'contact.submit': {
      level: 'required',
      synthesize: [
        { pageRole: 'home', section: 'hero', slot: 'primary-cta', label: 'Contact an Agent',
          intent: 'form.open', targetRef: 'agent_contact_form', uiAction: 'overlay' },
        { pageRole: 'contact', section: 'contact', slot: 'form-submit', ifPageExists: true,
          label: 'Send Message', intent: 'form.open', targetRef: 'agent_contact_form', uiAction: 'state' },
      ],
    },
    'booking.create': {
      level: 'required',
      synthesize: [
        { pageRole: 'home', section: 'hero', slot: 'secondary-cta', label: 'Schedule a Showing',
          intent: 'calendar.open', targetRef: 'showing_calendar', uiAction: 'overlay' },
        { pageRole: 'gallery', section: 'gallery', slot: 'card-cta', ifPageExists: true,
          label: 'Schedule Showing', intent: 'calendar.open', targetRef: 'showing_calendar',
          uiAction: 'overlay', payloadTemplate: { 'data-listing': '$listing.id' } },
      ],
    },
    'lead.capture': {
      level: 'required',
      synthesize: [
        { pageRole: 'home', section: 'cta', slot: 'primary-cta', label: 'Get a Free Home Valuation',
          intent: 'form.open', targetRef: 'valuation_form', uiAction: 'overlay' },
      ],
    },
    'contact.call':       { level: 'secondary', synthesize: [FOOTER_CONTACT_CALL] },
    'location.directions':{ level: 'secondary', synthesize: [FOOTER_DIRECTIONS] },
    'newsletter.subscribe':{ level: 'secondary', synthesize: [FOOTER_NEWSLETTER] },
    'cart.add':           { level: 'forbidden' },
    'donation.start':     { level: 'forbidden' },
    'quote.request':      { level: 'forbidden' },
  }),
};

export function getIndustryIntentProfile(industry: string): IndustryIntentProfile | undefined {
  return INDUSTRY_INTENT_PROFILES[normalizeIndustryKey(industry)];
}

export function isIntentForbiddenForIndustry(industry: string, intent: CoreIntent): boolean {
  return getIndustryIntentProfile(industry)?.forbidden.includes(intent) ?? false;
}

// ============================================================================
// Synthesis pass
// ============================================================================

export interface SynthesisResult {
  /** Existing bindings with any forbidden intents removed */
  kept: PlaygroundBindingSpecV2[];
  /** New bindings synthesized to cover missing required/primary/secondary intents */
  synthesized: PlaygroundBindingSpecV2[];
  /** Required intents that could NOT be satisfied (publish-blocker signal) */
  unsatisfiedRequired: string[];
  /** Forbidden bindings that were stripped */
  strippedForbidden: PlaygroundBindingSpecV2[];
}

/**
 * Synthesizes missing industry-required intent bindings onto canonical slot
 * coordinates and strips any forbidden intents. Idempotent — running twice
 * yields the same result.
 */
export function synthesizeIndustryBindings(
  profile: IndustryIntentProfile | undefined,
  existing: PlaygroundBindingSpecV2[],
  ctx: { availablePageRoles: Set<PlaygroundPageRole> },
): SynthesisResult {
  if (!profile) {
    return { kept: existing, synthesized: [], unsatisfiedRequired: [], strippedForbidden: [] };
  }

  // 1) Strip forbidden
  const forbiddenSet = new Set(profile.forbidden);
  const kept: PlaygroundBindingSpecV2[] = [];
  const strippedForbidden: PlaygroundBindingSpecV2[] = [];
  for (const b of existing) {
    if (forbiddenSet.has(b.coreIntent)) strippedForbidden.push(b);
    else kept.push(b);
  }

  // 2) Synthesize missing slots from intents map
  const synthesized: PlaygroundBindingSpecV2[] = [];
  const unsatisfiedRequired: string[] = [];
  const slotOccupied = (pageRole: PlaygroundPageRole, section: BindingSectionType, slot: BindingSlotRole) =>
    kept.some(b => b.sourcePageRole === pageRole && b.sourceSection === section && b.sourceSlot === slot) ||
    synthesized.some(b => b.sourcePageRole === pageRole && b.sourceSection === section && b.sourceSlot === slot);

  for (const [intentName, spec] of Object.entries(profile.intents ?? {})) {
    if (!spec || spec.level === 'forbidden' || spec.level === 'optional') continue;
    if (!spec.synthesize?.length) continue;

    const alreadyBound = kept.some(b => b.coreIntent === intentName);
    let satisfiedAtLeastOnce = alreadyBound;

    for (const slot of spec.synthesize) {
      if (slot.ifPageExists && !ctx.availablePageRoles.has(slot.pageRole)) continue;
      if (slotOccupied(slot.pageRole, slot.section, slot.slot)) continue;

      synthesized.push({
        sourcePageRole: slot.pageRole,
        sourceSection: slot.section,
        sourceSlot: slot.slot,
        label: slot.label,
        coreIntent: intentName,
        intent: slot.intent ?? 'form.open',
        targetRef: slot.targetRef ?? intentName,
        uiAction: slot.uiAction,
        payloadTemplate: slot.payloadTemplate,
      });
      satisfiedAtLeastOnce = true;
    }

    if (spec.level === 'required' && !satisfiedAtLeastOnce) {
      unsatisfiedRequired.push(intentName);
    }
  }

  return { kept, synthesized, unsatisfiedRequired, strippedForbidden };
}
