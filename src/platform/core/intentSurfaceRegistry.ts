/**
 * intentSurfaceRegistry — canonical home for the Unison intent registry.
 *
 * Single source of truth for every intent the platform recognizes.
 * Every guard (CoreIntent surface, TemplateIntentButton, deterministicIntentUi,
 * aiBindingTool, publish gate) reads from this file.
 *
 * Adding a new intent: append an IntentDef here, optionally extend an alias.
 * Do NOT add to any other guard — they all read this map.
 */
import type { CapabilityId } from './capabilityRegistry';

export type IntentNamespace =
  | 'nav'
  | 'ui'
  | 'contact'
  | 'location'
  | 'commerce'
  | 'booking'
  | 'auth'
  | 'account'
  | 'lead'
  | 'content'
  | 'nonprofit'
  | 'utility'
  | 'automation';

export type IntentSurface = 'inline' | 'overlay' | 'redirect' | 'client';

export type IntentHandler =
  | 'client'              // Pure client-side (nav, scroll, open drawer)
  | 'site-runtime'        // Versioned generated-site runtime gateway
  | 'intent-exec'         // Generic backend executor edge fn
  | 'workflow-trigger'    // Triggers a configured automation workflow
  | 'stripe-checkout'     // Creates checkout session, redirects
  | 'auth-overlay'        // Opens local auth overlay
  | 'webhook';            // User-defined webhook (custom integrations)

export type IntentStatus = 'stable' | 'preview' | 'deprecated';
export type IntentTriggerType = 'user-action' | 'system-event' | 'workflow-event';

export type IntentRowAssertion = 'non-empty' | { min: number };
export type IntentHandlerBinding = 'native' | 'workflow' | 'external';

export interface IntentReadinessFixture {
  /** Short human description of what's required (surfaced in publish gate). */
  description: string;
  /** Optional in-app path users can open to satisfy the fixture (e.g. /settings/calendar). */
  fixPath?: string;
}

export interface IntentDef {
  /** Canonical name, dot-namespaced (e.g. "commerce.cart.add") */
  name: string;
  namespace: IntentNamespace;
  /** Where the user sees the result */
  surface: IntentSurface;
  /** Optional overlay component id when surface === 'overlay' */
  overlayId?:
    | 'auth-login'
    | 'auth-register'
    | 'booking'
    | 'contact'
    | 'quote'
    | 'newsletter'
    | 'checkout';
  handler: IntentHandler;
  /** Capabilities that must be enabled for this intent to be publish-ready */
  requiredCapabilities?: CapabilityId[];
  /** Whether this is safe for direct UI binding or only emitted by systems/workflows */
  triggerType: IntentTriggerType;
  status: IntentStatus;
  /** Legacy intent names that resolve to this one */
  aliases?: string[];
  /** Human-readable summary surfaced in the binding inspector */
  description: string;

  // ── Move B: per-element capability contract ─────────────────────────────
  /** Backend table that must contain at least one (or N) rows for this intent to be publish-ready. */
  backingTable?: string;
  /** Row count requirement on `backingTable`. */
  rowAssertion?: IntentRowAssertion;
  /** How the intent is fulfilled at runtime — drives "unbound" detection at preview. */
  handlerBinding?: IntentHandlerBinding;
  /** Human-readable fixture description + optional in-app fix path. */
  readinessFixture?: IntentReadinessFixture;
}


// ============================================================================
// Registry — every recognized intent
// ============================================================================

export const INTENT_REGISTRY: Record<string, IntentDef> = {
  // ── Navigation (universal, client-only) ────────────────────────────────
  'nav.goto': {
    name: 'nav.goto',
    namespace: 'nav',
    surface: 'client',
    handler: 'client',
    status: 'stable',
    triggerType: 'user-action',
    aliases: [
      'nav.goto_page',
      'portfolio.view',
      'case.study',
      'menu.view',
      'services.view',
      'pricing.view',
    ],
    description: 'Navigate to an internal route via HashRouter.',
  },
  'nav.external': {
    name: 'nav.external',
    namespace: 'nav',
    surface: 'client',
    handler: 'client',
    status: 'stable',
    triggerType: 'user-action',
    aliases: ['external.open'],
    description: 'Open an external URL in a new tab.',
  },
  'nav.anchor': {
    name: 'nav.anchor',
    namespace: 'nav',
    surface: 'client',
    handler: 'client',
    status: 'stable',
    triggerType: 'user-action',
    description: 'Smooth-scroll to an in-page anchor.',
  },

  // ── UI behavior (preview-safe, client-only) ───────────────────────────────
  'menu.open': {
    name: 'menu.open',
    namespace: 'ui',
    surface: 'client',
    handler: 'client',
    status: 'stable',
    aliases: ['mobile-menu.open', 'drawer.menu.open'],
    triggerType: 'user-action',
    description: 'Open the mobile/navigation menu drawer.',
  },
  'search.open': {
    name: 'search.open',
    namespace: 'ui',
    surface: 'client',
    handler: 'client',
    status: 'stable',
    triggerType: 'user-action',
    description: 'Open or focus a search UI.',
  },
  'filter.open': {
    name: 'filter.open',
    namespace: 'ui',
    surface: 'client',
    handler: 'client',
    status: 'stable',
    triggerType: 'user-action',
    description: 'Open a filter panel.',
  },
  'sort.open': {
    name: 'sort.open',
    namespace: 'ui',
    surface: 'client',
    handler: 'client',
    status: 'stable',
    triggerType: 'user-action',
    description: 'Open a sort menu.',
  },
  'share.open': {
    name: 'share.open',
    namespace: 'ui',
    surface: 'client',
    handler: 'client',
    status: 'stable',
    aliases: ['share.page', 'social.share'],
    triggerType: 'user-action',
    description: 'Open a native/custom share sheet.',
  },
  'favorite.toggle': {
    name: 'favorite.toggle',
    namespace: 'ui',
    surface: 'client',
    handler: 'client',
    requiredCapabilities: ['commerce'],
    status: 'stable',
    aliases: ['wishlist.add', 'product.favorite'],
    triggerType: 'user-action',
    description: 'Toggle favorite/wishlist state for an item.',
  },
  'chat.open': {
    name: 'chat.open',
    namespace: 'ui',
    surface: 'client',
    handler: 'client',
    status: 'stable',
    triggerType: 'user-action',
    description: 'Open a chat widget.',
  },

  // ── Auth ───────────────────────────────────────────────────────────────
  'auth.login': {
    name: 'auth.login',
    namespace: 'auth',
    surface: 'overlay',
    overlayId: 'auth-login',
    handler: 'auth-overlay',
    requiredCapabilities: ['auth'],
    status: 'stable',
    aliases: ['auth.signin', 'auth.sign_in', 'login'],
    triggerType: 'user-action',
    description: 'Open the sign-in overlay.',
  },
  'auth.register': {
    name: 'auth.register',
    namespace: 'auth',
    surface: 'overlay',
    overlayId: 'auth-register',
    handler: 'auth-overlay',
    requiredCapabilities: ['auth'],
    status: 'stable',
    aliases: ['auth.signup', 'auth.sign_up', 'signup', 'register'],
    triggerType: 'user-action',
    description: 'Open the registration overlay.',
  },
  'auth.logout': {
    name: 'auth.logout',
    namespace: 'auth',
    surface: 'client',
    handler: 'auth-overlay',
    requiredCapabilities: ['auth'],
    status: 'stable',
    aliases: ['auth.sign_out', 'logout'],
    triggerType: 'user-action',
    description: 'Sign out the current user.',
  },
  'account.open': {
    name: 'account.open',
    namespace: 'account',
    surface: 'client',
    handler: 'client',
    requiredCapabilities: ['auth'],
    status: 'stable',
    aliases: ['user.account', 'user.menu'],
    triggerType: 'user-action',
    description: 'Open the account menu/profile entry point.',
  },

  // ── Commerce (store) ───────────────────────────────────────────────────
  'cart.add': {
    name: 'cart.add',
    namespace: 'commerce',
    surface: 'inline',
    handler: 'client',
    requiredCapabilities: ['commerce'],
    status: 'stable',
    triggerType: 'user-action',
    description: 'Add a product to the cart.',
    backingTable: 'products',
    rowAssertion: 'non-empty',
    handlerBinding: 'native',
    readinessFixture: {
      description: 'Add at least one product before publishing the storefront.',
      fixPath: '/settings/products',
    },
  },

  'cart.view': {
    name: 'cart.view',
    namespace: 'commerce',
    surface: 'overlay',
    handler: 'client',
    requiredCapabilities: ['commerce'],
    status: 'stable',
    triggerType: 'user-action',
    description: 'Open the cart drawer.',
  },
  'cart.checkout': {
    name: 'cart.checkout',
    namespace: 'commerce',
    surface: 'redirect',
    handler: 'stripe-checkout',
    requiredCapabilities: ['commerce'],
    status: 'stable',
    aliases: ['checkout.start'],
    triggerType: 'user-action',
    description: 'Begin checkout from the current cart.',
    backingTable: 'products',
    rowAssertion: 'non-empty',
    handlerBinding: 'external',
    readinessFixture: {
      description: 'Connect Stripe and publish at least one product before enabling checkout.',
      fixPath: '/settings/payments',
    },
  },

  'cart.update': {
    name: 'cart.update',
    namespace: 'commerce',
    surface: 'inline',
    handler: 'client',
    requiredCapabilities: ['commerce'],
    status: 'stable',
    triggerType: 'user-action',
    description: 'Update cart item quantity or options.',
  },
  'cart.remove': {
    name: 'cart.remove',
    namespace: 'commerce',
    surface: 'inline',
    handler: 'client',
    requiredCapabilities: ['commerce'],
    status: 'stable',
    triggerType: 'user-action',
    description: 'Remove an item from the cart.',
  },
  'cart.abandoned': {
    name: 'cart.abandoned',
    namespace: 'commerce',
    surface: 'client',
    handler: 'workflow-trigger',
    requiredCapabilities: ['commerce'],
    status: 'preview',
    triggerType: 'system-event',
    description: 'Timer-based cart abandonment automation trigger.',
  },
  'pay.checkout': {
    name: 'pay.checkout',
    namespace: 'commerce',
    surface: 'redirect',
    overlayId: 'checkout',
    handler: 'stripe-checkout',
    requiredCapabilities: ['commerce'],
    status: 'stable',
    triggerType: 'user-action',
    description: 'Start a payment / subscription checkout.',
    handlerBinding: 'external',
    readinessFixture: {
      description: 'Connect Stripe before enabling checkout buttons.',
      fixPath: '/settings/payments',
    },
  },

  'pay.success': {
    name: 'pay.success',
    namespace: 'commerce',
    surface: 'client',
    handler: 'client',
    requiredCapabilities: ['commerce'],
    status: 'stable',
    triggerType: 'system-event',
    description: 'Post-checkout success handler.',
  },
  'pay.cancel': {
    name: 'pay.cancel',
    namespace: 'commerce',
    surface: 'client',
    handler: 'client',
    requiredCapabilities: ['commerce'],
    status: 'stable',
    triggerType: 'system-event',
    description: 'Post-checkout cancellation handler.',
  },
  'product.view': {
    name: 'product.view',
    namespace: 'commerce',
    surface: 'client',
    handler: 'client',
    requiredCapabilities: ['commerce'],
    status: 'preview',
    triggerType: 'user-action',
    description: 'Open a product detail view.',
  },
  'order.created': {
    name: 'order.created',
    namespace: 'commerce',
    surface: 'client',
    handler: 'workflow-trigger',
    requiredCapabilities: ['commerce'],
    status: 'preview',
    triggerType: 'system-event',
    description: 'Order placed automation trigger.',
  },
  'order.shipped': {
    name: 'order.shipped',
    namespace: 'commerce',
    surface: 'client',
    handler: 'workflow-trigger',
    requiredCapabilities: ['commerce'],
    status: 'preview',
    triggerType: 'system-event',
    description: 'Order shipped automation trigger.',
  },
  'order.delivered': {
    name: 'order.delivered',
    namespace: 'commerce',
    surface: 'client',
    handler: 'workflow-trigger',
    requiredCapabilities: ['commerce'],
    status: 'preview',
    triggerType: 'system-event',
    description: 'Order delivered automation trigger.',
  },

  // ── Booking ────────────────────────────────────────────────────────────
  'booking.create': {
    name: 'booking.create',
    namespace: 'booking',
    surface: 'overlay',
    overlayId: 'booking',
    handler: 'site-runtime',
    requiredCapabilities: ['booking'],
    status: 'stable',
    aliases: ['calendar.open', 'reservation.submit', 'booking.book', 'booking.start'],
    triggerType: 'user-action',
    description: 'Open the booking flow.',
    backingTable: 'availability_slots',
    rowAssertion: 'non-empty',
    handlerBinding: 'native',
    readinessFixture: {
      description: 'Add at least one bookable service and an availability slot before publishing.',
      fixPath: '/settings/calendar',
    },
  },

  'booking.reschedule': {
    name: 'booking.reschedule',
    namespace: 'booking',
    surface: 'overlay',
    overlayId: 'booking',
    handler: 'intent-exec',
    requiredCapabilities: ['booking'],
    status: 'stable',
    triggerType: 'user-action',
    description: 'Open the booking reschedule flow.',
  },
  'booking.cancel': {
    name: 'booking.cancel',
    namespace: 'booking',
    surface: 'overlay',
    overlayId: 'booking',
    handler: 'intent-exec',
    requiredCapabilities: ['booking'],
    status: 'stable',
    aliases: ['booking.cancelled.request'],
    triggerType: 'user-action',
    description: 'Open the booking cancellation flow.',
  },
  'booking.confirmed': {
    name: 'booking.confirmed',
    namespace: 'booking',
    surface: 'client',
    handler: 'workflow-trigger',
    requiredCapabilities: ['booking'],
    status: 'preview',
    triggerType: 'system-event',
    description: 'Booking confirmation automation trigger.',
  },
  'booking.reminder': {
    name: 'booking.reminder',
    namespace: 'booking',
    surface: 'client',
    handler: 'workflow-trigger',
    requiredCapabilities: ['booking'],
    status: 'preview',
    triggerType: 'system-event',
    description: 'Reminder automation trigger.',
  },
  'booking.cancelled': {
    name: 'booking.cancelled',
    namespace: 'booking',
    surface: 'client',
    handler: 'workflow-trigger',
    requiredCapabilities: ['booking'],
    status: 'preview',
    triggerType: 'system-event',
    description: 'Booking cancellation automation trigger.',
  },
  'booking.noshow': {
    name: 'booking.noshow',
    namespace: 'booking',
    surface: 'client',
    handler: 'workflow-trigger',
    requiredCapabilities: ['booking'],
    status: 'preview',
    triggerType: 'system-event',
    description: 'No-show automation trigger.',
  },

  // ── Lead (agency / portfolio / contact-driven flows) ───────────────────
  'lead.capture': {
    name: 'lead.capture',
    namespace: 'lead',
    surface: 'overlay',
    overlayId: 'contact',
    handler: 'intent-exec',
    requiredCapabilities: ['lead-capture'],
    status: 'stable',
    triggerType: 'user-action',
    description: 'Capture a lead via overlay form.',
  },
  'contact.submit': {
    name: 'contact.submit',
    namespace: 'lead',
    surface: 'overlay',
    overlayId: 'contact',
    handler: 'intent-exec',
    requiredCapabilities: ['contact'],
    status: 'stable',
    triggerType: 'user-action',
    aliases: ['form.open'],
    description: 'Submit the contact form.',
  },
  'contact.call': {
    name: 'contact.call',
    namespace: 'contact',
    surface: 'client',
    handler: 'client',
    requiredCapabilities: ['contact'],
    status: 'stable',
    aliases: ['call.now', 'phone.call'],
    triggerType: 'user-action',
    description: 'Start a phone call CTA.',
  },
  'contact.email': {
    name: 'contact.email',
    namespace: 'contact',
    surface: 'client',
    handler: 'client',
    requiredCapabilities: ['contact'],
    status: 'stable',
    aliases: ['email.now', 'email.open'],
    triggerType: 'user-action',
    description: 'Open an email compose CTA.',
  },
  'contact.sms': {
    name: 'contact.sms',
    namespace: 'contact',
    surface: 'client',
    handler: 'client',
    requiredCapabilities: ['contact'],
    status: 'stable',
    aliases: ['sms.send', 'text.us'],
    triggerType: 'user-action',
    description: 'Start an SMS/text CTA.',
  },
  'location.directions': {
    name: 'location.directions',
    namespace: 'location',
    surface: 'client',
    handler: 'client',
    requiredCapabilities: ['contact'],
    status: 'stable',
    aliases: ['directions.open', 'map.open'],
    triggerType: 'user-action',
    description: 'Open map/directions for the business location.',
  },
  'quote.request': {
    name: 'quote.request',
    namespace: 'lead',
    surface: 'overlay',
    overlayId: 'quote',
    handler: 'intent-exec',
    requiredCapabilities: ['quoting'],
    status: 'stable',
    triggerType: 'user-action',
    description: 'Request a quote / estimate.',
  },
  'demo.request': {
    name: 'demo.request',
    namespace: 'lead',
    surface: 'overlay',
    overlayId: 'contact',
    handler: 'intent-exec',
    requiredCapabilities: ['lead-capture'],
    status: 'stable',
    triggerType: 'user-action',
    description: 'Request a product or sales demo.',
  },
  'consultation.request': {
    name: 'consultation.request',
    namespace: 'lead',
    surface: 'overlay',
    overlayId: 'contact',
    handler: 'intent-exec',
    requiredCapabilities: ['lead-capture'],
    status: 'stable',
    aliases: ['consultation.book'],
    triggerType: 'user-action',
    description: 'Request a consultation.',
  },
  'proposal.request': {
    name: 'proposal.request',
    namespace: 'lead',
    surface: 'overlay',
    overlayId: 'quote',
    handler: 'intent-exec',
    requiredCapabilities: ['quoting'],
    status: 'stable',
    triggerType: 'user-action',
    description: 'Request a proposal.',
  },
  'deal.won': {
    name: 'deal.won',
    namespace: 'lead',
    surface: 'client',
    handler: 'workflow-trigger',
    requiredCapabilities: ['lead-capture'],
    status: 'preview',
    triggerType: 'system-event',
    description: 'Deal-won automation trigger.',
  },
  'deal.lost': {
    name: 'deal.lost',
    namespace: 'lead',
    surface: 'client',
    handler: 'workflow-trigger',
    requiredCapabilities: ['lead-capture'],
    status: 'preview',
    triggerType: 'system-event',
    description: 'Deal-lost automation trigger.',
  },
  'proposal.sent': {
    name: 'proposal.sent',
    namespace: 'lead',
    surface: 'client',
    handler: 'workflow-trigger',
    requiredCapabilities: ['quoting'],
    status: 'preview',
    triggerType: 'system-event',
    description: 'Proposal-sent automation trigger.',
  },
  'job.completed': {
    name: 'job.completed',
    namespace: 'lead',
    surface: 'client',
    handler: 'workflow-trigger',
    requiredCapabilities: ['lead-capture'],
    status: 'preview',
    triggerType: 'system-event',
    description: 'Job-completed automation trigger.',
  },

  // ── Content (universal) ────────────────────────────────────────────────
  'newsletter.subscribe': {
    name: 'newsletter.subscribe',
    namespace: 'content',
    surface: 'overlay',
    overlayId: 'newsletter',
    handler: 'intent-exec',
    requiredCapabilities: ['newsletter'],
    status: 'stable',
    aliases: ['waitlist.join'],
    triggerType: 'user-action',
    description: 'Subscribe to a newsletter / waitlist.',
  },
  'content.download': {
    name: 'content.download',
    namespace: 'content',
    surface: 'client',
    handler: 'client',
    status: 'stable',
    aliases: [
      'lead-magnet.download',
      'document.download',
      'resume.download',
      'brochure.download',
      'menu.download',
      'report.download',
      'media-kit.download',
    ],
    triggerType: 'user-action',
    description: 'Download gated or ungated content.',
  },
  'coupon.claim': {
    name: 'coupon.claim',
    namespace: 'content',
    surface: 'overlay',
    overlayId: 'newsletter',
    handler: 'intent-exec',
    requiredCapabilities: ['newsletter'],
    status: 'stable',
    triggerType: 'user-action',
    description: 'Claim a promotional coupon or offer.',
  },

  // ── Nonprofit ─────────────────────────────────────────────────────────────
  'donation.start': {
    name: 'donation.start',
    namespace: 'nonprofit',
    surface: 'redirect',
    overlayId: 'checkout',
    handler: 'stripe-checkout',
    requiredCapabilities: ['donation'],
    status: 'stable',
    aliases: ['donate.start', 'donate.now'],
    triggerType: 'user-action',
    description: 'Start a donation checkout flow.',
    handlerBinding: 'external',
    readinessFixture: {
      description: 'Connect Stripe before enabling donations.',
      fixPath: '/settings/payments',
    },
  },

  'volunteer.signup': {
    name: 'volunteer.signup',
    namespace: 'nonprofit',
    surface: 'overlay',
    overlayId: 'contact',
    handler: 'intent-exec',
    requiredCapabilities: ['lead-capture'],
    status: 'stable',
    triggerType: 'user-action',
    description: 'Open a volunteer signup form.',
  },

  // ── Utility automation triggers (generic) ──────────────────────────────
  'button.click': {
    name: 'button.click',
    namespace: 'utility',
    surface: 'client',
    handler: 'workflow-trigger',
    status: 'stable',
    triggerType: 'workflow-event',
    description: 'Generic button click automation trigger.',
  },
  'form.submit': {
    name: 'form.submit',
    namespace: 'utility',
    surface: 'client',
    handler: 'workflow-trigger',
    status: 'stable',
    triggerType: 'workflow-event',
    description: 'Generic form submit automation trigger.',
  },
  'workflow.trigger': {
    name: 'workflow.trigger',
    namespace: 'utility',
    surface: 'client',
    handler: 'workflow-trigger',
    status: 'preview',
    triggerType: 'workflow-event',
    description: 'Generic workflow trigger.',
  },
};

// ============================================================================
// Alias lookup — flatten every alias into a single resolver map
// ============================================================================

const ALIAS_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const def of Object.values(INTENT_REGISTRY)) {
    map[def.name.toLowerCase()] = def.name;
    for (const alias of def.aliases ?? []) {
      map[alias.toLowerCase()] = def.name;
    }
  }
  return map;
})();

/** Resolve any intent string (canonical or legacy alias) to its canonical name, or null. */
export function resolveIntentName(input: string): string | null {
  if (!input) return null;
  return ALIAS_MAP[input.toLowerCase()] ?? null;
}

/** True when input maps to any registered intent (alias-aware, case-insensitive). */
export function isRegisteredIntent(input: string): boolean {
  return resolveIntentName(input) !== null;
}

/** Look up the canonical IntentDef by name or alias. */
export function getIntentDef(input: string): IntentDef | null {
  const canonical = resolveIntentName(input);
  return canonical ? INTENT_REGISTRY[canonical] : null;
}

/** Required capability ids for a canonical intent or alias. */
export function getIntentRequiredCapabilities(input: string): CapabilityId[] {
  return getIntentDef(input)?.requiredCapabilities ?? [];
}

/** All canonical intent names in registry order. */
export function allIntentNames(): string[] {
  return Object.keys(INTENT_REGISTRY);
}

/** Names that should appear in the CoreIntent enum (status !== deprecated). */
export function activeIntentNames(): string[] {
  return Object.values(INTENT_REGISTRY)
    .filter((d) => d.status !== 'deprecated')
    .map((d) => d.name);
}

/** Intent names filtered by namespace. */
export function intentsByNamespace(ns: IntentNamespace): IntentDef[] {
  return Object.values(INTENT_REGISTRY).filter((d) => d.namespace === ns);
}

// Convenience alias — lets consumers spell the import as the namespace name.
export { INTENT_REGISTRY as intentSurfaceRegistry };
