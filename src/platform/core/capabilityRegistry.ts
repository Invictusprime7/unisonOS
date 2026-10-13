/**
 * Capability Registry — Canonical capability definitions
 * 
 * Each business capability defines:
 * - Allowed intents (from coreIntents.ts ONLY)
 * - Required database tables
 * - Required workflows
 * - Required overlays/forms
 * - Provisioning hooks
 * 
 * Templates attach to capabilities, not random handlers.
 * This is the single source of truth for "what a business system can do."
 */

import type { CoreIntent, ActionIntent } from './coreIntents';
import type { CapabilityPack } from './playground';
import { normalizeIndustryKey } from './industryMatrix';

// ============================================================================
// Capability Definition
// ============================================================================

/**
 * Business-facing capabilities understood by the request planner. These stay
 * more precise than the operational packs below, which preserves the existing
 * compiler and runtime contracts while giving the AI a safe vocabulary.
 */
export type BusinessCapability =
  | 'business_profile'
  | 'catalog.services'
  | 'catalog.products'
  | 'catalog.menu'
  | 'crm.leads'
  | 'crm.contacts'
  | 'booking.appointments'
  | 'commerce.cart'
  | 'commerce.checkout'
  | 'forms.contact'
  | 'forms.quote'
  | 'auth.customer'
  | 'portal.customer'
  | 'automation.follow_up'
  | 'notifications.email';

export interface CapabilityApprovalRecord {
  approvedBy: string;
  approvedAt: string;
}

export type CapabilityId =
  | 'booking'
  | 'quoting'
  | 'contact'
  | 'newsletter'
  | 'commerce'
  | 'auth'
  | 'lead-capture'
  | 'donation';

export interface InstalledCapability {
  id: CapabilityId;
  provides: BusinessCapability[];
  status: 'approved' | 'provisioned' | 'failed';
  approval: CapabilityApprovalRecord;
}

export interface BusinessSystemState {
  version: '1.0';
  requestedCapabilities: BusinessCapability[];
  capabilities: InstalledCapability[];
}

export interface CapabilityDefinition {
  id: CapabilityId;
  name: string;
  description: string;

  /** Business-facing capabilities this operational pack provides. */
  provides: BusinessCapability[];
  /** Other operational packs that must be installed first. */
  dependencies: CapabilityId[];

  /** Canonical intents this capability exposes (from coreIntents.ts) */
  primaryIntent: CoreIntent;
  /** Additional intents that support this capability */
  supportingIntents: CoreIntent[];

  /** Database tables required for this capability */
  requiredTables: string[];

  database: {
    migrations: string[];
    requiredTables: string[];
    requiredColumns: string[];
    rlsPolicies: string[];
  };

  backend: {
    functions: string[];
    events: string[];
    permissions: string[];
  };

  frontend: {
    components: string[];
    dataSources: string[];
    supportedSlots: string[];
  };

  intents: {
    provided: CoreIntent[];
    required: CoreIntent[];
  };

  settings: {
    accountFields: string[];
    projectFields: string[];
  };

  readiness: {
    assertions: string[];
    fixtures: string[];
  };

  /** Workflows that should be provisioned */
  requiredWorkflows: WorkflowSpec[];

  /** Overlay/form types this capability needs in the UI */
  requiredOverlays: string[];

  /** Industries where this capability is relevant */
  supportedIndustries: string[];

  /** CRM pipeline stage to enter when this capability fires */
  crmEntryStage?: string;

  /** Whether this capability requires authentication */
  requiresAuth: boolean;

  /** Minimum plan tier required */
  minPlan: 'free' | 'starter' | 'pro' | 'agency' | 'enterprise';
}

export interface WorkflowSpec {
  id: string;
  name: string;
  triggerIntent: CoreIntent;
  steps: string[];
  description: string;
}

// ============================================================================
// Registry
// ============================================================================

export const CAPABILITY_REGISTRY: Record<CapabilityId, CapabilityDefinition> = {
  booking: {
    id: 'booking',
    name: 'Booking & Scheduling',
    description: 'Online appointment booking with confirmation and reminders',
    provides: ['business_profile', 'catalog.services', 'crm.contacts', 'booking.appointments', 'notifications.email'],
    dependencies: ['contact'],
    primaryIntent: 'booking.create',
    supportingIntents: ['booking.reschedule', 'booking.cancel', 'contact.submit'],
    requiredTables: ['services', 'availability_slots', 'bookings'],
    database: {
      migrations: ['businesses', 'services', 'staff', 'availability_slots', 'bookings', 'crm_contacts'],
      requiredTables: ['services', 'staff', 'availability_slots', 'bookings', 'crm_contacts'],
      requiredColumns: ['services.duration_minutes', 'services.price_cents', 'availability_slots.starts_at', 'availability_slots.ends_at', 'bookings.site_id', 'bookings.session_id', 'bookings.availability_slot_id', 'bookings.idempotency_key'],
      rlsPolicies: ['services_read_public', 'booking_owner_access', 'booking_customer_access'],
    },
    backend: {
      functions: ['site-runtime', 'automation-event'],
      events: ['booking.created', 'booking.confirmed'],
      permissions: ['business.booking.manage', 'customer.booking.create'],
    },
    frontend: {
      components: ['ServiceGrid', 'BookingButton', 'BookingForm', 'BookingConfirmation'],
      dataSources: ['catalog.services', 'booking.availability'],
      supportedSlots: ['service-card.primary-action', 'hero.primary-cta', 'navbar.primary-action'],
    },
    intents: { provided: ['booking.create', 'booking.reschedule', 'booking.cancel'], required: ['contact.submit'] },
    settings: { accountFields: ['business.timezone', 'business.notificationEmail'], projectFields: ['booking.minimumNotice', 'booking.staffSelection'] },
    readiness: { assertions: ['active-service-exists', 'availability-exists', 'booking-handler-installed', 'booking-rls-verified'], fixtures: ['service', 'staff-member', 'availability-window', 'customer'] },
    requiredWorkflows: [
      {
        id: 'booking-confirmation',
        name: 'Booking Confirmation',
        triggerIntent: 'booking.create',
        steps: ['validate_slot', 'create_booking', 'send_confirmation_email', 'create_crm_activity'],
        description: 'Confirms booking and notifies both parties',
      },
      {
        id: 'booking-reminder',
        name: 'Booking Reminder',
        triggerIntent: 'booking.confirmed',
        steps: ['check_upcoming', 'send_reminder_email'],
        description: 'Sends reminder 24h before appointment',
      },
    ],
    requiredOverlays: ['booking-form', 'booking-confirmation'],
    supportedIndustries: ['saas', 'salon', 'restaurant', 'local-service', 'coaching', 'real-estate', 'ecommerce', 'portfolio', 'nonprofit', 'agency'],
    crmEntryStage: 'New Booking',
    requiresAuth: false,
    minPlan: 'starter',
  },

  quoting: {
    id: 'quoting',
    name: 'Quote Requests',
    description: 'Structured quote/estimate request forms with pipeline tracking',
    provides: ['forms.quote', 'crm.leads', 'notifications.email'],
    dependencies: ['contact'],
    primaryIntent: 'quote.request',
    supportingIntents: ['contact.submit', 'lead.capture', 'proposal.request'],
    requiredTables: ['leads', 'crm_leads'],
    database: { migrations: ['leads', 'crm_leads'], requiredTables: ['leads', 'crm_leads'], requiredColumns: ['leads.email', 'crm_leads.stage'], rlsPolicies: ['leads_insert_public', 'crm_leads_owner_access'] },
    backend: { functions: ['create-lead', 'automation-event'], events: ['quote.requested'], permissions: ['business.crm.manage', 'visitor.quote.create'] },
    frontend: { components: ['QuoteForm'], dataSources: ['crm.leads'], supportedSlots: ['hero.primary-cta', 'service-card.primary-action'] },
    intents: { provided: ['quote.request'], required: ['contact.submit'] },
    settings: { accountFields: ['business.notificationEmail'], projectFields: ['crm.defaultPipeline'] },
    readiness: { assertions: ['quote-handler-installed', 'crm-stage-exists'], fixtures: ['lead'] },
    requiredWorkflows: [
      {
        id: 'quote-notification',
        name: 'Quote Request Notification',
        triggerIntent: 'quote.request',
        steps: ['create_lead', 'send_notification_email', 'create_crm_activity'],
        description: 'Notifies business owner of new quote request',
      },
    ],
    requiredOverlays: ['quote-form'],
    supportedIndustries: ['local-service', 'agency', 'real-estate'],
    crmEntryStage: 'Quote Requested',
    requiresAuth: false,
    minPlan: 'starter',
  },

  contact: {
    id: 'contact',
    name: 'Contact Forms',
    description: 'General contact/inquiry forms with CRM integration',
    provides: ['forms.contact', 'crm.leads', 'crm.contacts', 'notifications.email'],
    dependencies: [],
    primaryIntent: 'contact.submit',
    supportingIntents: ['contact.call', 'contact.email', 'contact.sms', 'location.directions', 'lead.capture'],
    requiredTables: ['leads'],
    database: { migrations: ['leads', 'crm_contacts'], requiredTables: ['leads', 'crm_contacts'], requiredColumns: ['leads.email', 'crm_contacts.email'], rlsPolicies: ['leads_insert_public', 'crm_contacts_owner_access'] },
    backend: { functions: ['create-lead', 'intent-exec'], events: ['contact.submitted'], permissions: ['business.crm.manage', 'visitor.contact.create'] },
    frontend: { components: ['ContactForm'], dataSources: ['business.profile'], supportedSlots: ['hero.primary-cta', 'contact-form.submit'] },
    intents: { provided: ['contact.submit', 'lead.capture'], required: [] },
    settings: { accountFields: ['business.notificationEmail'], projectFields: ['crm.defaultPipeline'] },
    readiness: { assertions: ['contact-handler-installed', 'crm-contact-create-enabled'], fixtures: ['lead', 'contact'] },
    requiredWorkflows: [
      {
        id: 'contact-notification',
        name: 'New Contact Notification',
        triggerIntent: 'contact.submit',
        steps: ['create_lead', 'send_notification_email'],
        description: 'Notifies business of new contact inquiry',
      },
    ],
    requiredOverlays: ['contact-form'],
    supportedIndustries: [
      'saas', 'salon', 'restaurant', 'local-service', 'coaching',
      'real-estate', 'portfolio', 'nonprofit', 'ecommerce', 'agency',
    ],
    crmEntryStage: 'New Inquiry',
    requiresAuth: false,
    minPlan: 'free',
  },

  newsletter: {
    id: 'newsletter',
    name: 'Newsletter & Waitlist',
    description: 'Email collection for newsletters, waitlists, and updates',
    provides: ['notifications.email', 'automation.follow_up'],
    dependencies: ['contact'],
    primaryIntent: 'newsletter.subscribe',
    supportingIntents: ['coupon.claim'],
    requiredTables: ['leads'],
    database: { migrations: ['leads'], requiredTables: ['leads'], requiredColumns: ['leads.email'], rlsPolicies: ['leads_insert_public'] },
    backend: { functions: ['create-lead', 'automation-event'], events: ['newsletter.subscribed'], permissions: ['visitor.newsletter.subscribe'] },
    frontend: { components: ['NewsletterForm'], dataSources: [], supportedSlots: ['footer.newsletter'] },
    intents: { provided: ['newsletter.subscribe'], required: [] },
    settings: { accountFields: ['business.notificationEmail'], projectFields: ['newsletter.senderName'] },
    readiness: { assertions: ['newsletter-handler-installed'], fixtures: ['subscriber'] },
    requiredWorkflows: [
      {
        id: 'newsletter-welcome',
        name: 'Newsletter Welcome',
        triggerIntent: 'newsletter.subscribe',
        steps: ['create_subscriber', 'send_welcome_email'],
        description: 'Sends welcome email to new subscribers',
      },
    ],
    requiredOverlays: [],
    supportedIndustries: [
      'saas', 'salon', 'restaurant', 'local-service', 'coaching',
      'real-estate', 'portfolio', 'nonprofit', 'ecommerce', 'agency',
    ],
    requiresAuth: false,
    minPlan: 'free',
  },

  commerce: {
    id: 'commerce',
    name: 'E-Commerce',
    description: 'Product catalog, cart, and checkout',
    provides: ['catalog.products', 'commerce.cart', 'commerce.checkout', 'crm.contacts', 'notifications.email'],
    dependencies: ['contact'],
    primaryIntent: 'cart.add',
    supportingIntents: [
      'product.view',
      'cart.view',
      'cart.update',
      'cart.remove',
      'cart.checkout',
      'pay.checkout',
      'favorite.toggle',
      'contact.submit',
    ],
    requiredTables: ['products', 'cart_items', 'orders'],
    database: { migrations: ['products', 'cart_items', 'orders'], requiredTables: ['products', 'cart_items', 'orders'], requiredColumns: ['products.price_cents', 'orders.customer_id'], rlsPolicies: ['products_read_public', 'orders_customer_access', 'orders_business_access'] },
    backend: { functions: ['create-checkout', 'intent-exec', 'automation-event'], events: ['order.created', 'cart.abandoned'], permissions: ['business.orders.manage', 'visitor.checkout.create'] },
    frontend: { components: ['ProductGrid', 'CartButton', 'CheckoutForm'], dataSources: ['catalog.products', 'commerce.cart'], supportedSlots: ['product-card.primary-action', 'navbar.cart-action'] },
    intents: { provided: ['cart.add', 'cart.checkout', 'pay.checkout'], required: ['contact.submit'] },
    settings: { accountFields: ['business.notificationEmail'], projectFields: ['commerce.currency', 'commerce.paymentProvider'] },
    readiness: { assertions: ['product-exists', 'checkout-handler-installed', 'order-rls-verified'], fixtures: ['product', 'customer'] },
    requiredWorkflows: [
      {
        id: 'order-confirmation',
        name: 'Order Confirmation',
        triggerIntent: 'order.created',
        steps: ['send_confirmation_email', 'create_crm_activity'],
        description: 'Confirms order and sends receipt',
      },
      {
        id: 'cart-abandonment',
        name: 'Cart Abandonment',
        triggerIntent: 'cart.abandoned',
        steps: ['wait_1h', 'send_recovery_email'],
        description: 'Follows up on abandoned carts',
      },
    ],
    requiredOverlays: ['cart-overlay', 'checkout-form'],
    supportedIndustries: ['saas', 'salon', 'restaurant', 'local-service', 'coaching', 'portfolio', 'nonprofit', 'ecommerce', 'agency'],
    crmEntryStage: 'New Customer',
    requiresAuth: false,
    minPlan: 'starter',
  },

  auth: {
    id: 'auth',
    name: 'Authentication',
    description: 'User signup and login',
    provides: ['auth.customer', 'portal.customer'],
    dependencies: [],
    primaryIntent: 'auth.register',
    supportingIntents: ['auth.login', 'auth.logout', 'account.open'],
    requiredTables: ['profiles'],
    database: { migrations: ['profiles'], requiredTables: ['profiles'], requiredColumns: ['profiles.user_id'], rlsPolicies: ['profiles_owner_access'] },
    backend: { functions: ['intent-exec'], events: ['customer.registered'], permissions: ['customer.portal.access'] },
    frontend: { components: ['AuthModal', 'CustomerPortal'], dataSources: ['auth.customer'], supportedSlots: ['navbar.account-action'] },
    intents: { provided: ['auth.login', 'auth.register', 'auth.logout'], required: [] },
    settings: { accountFields: [], projectFields: ['auth.allowCustomerSignup'] },
    readiness: { assertions: ['auth-provider-configured'], fixtures: ['customer'] },
    requiredWorkflows: [],
    requiredOverlays: ['auth-modal'],
    supportedIndustries: [
      'salon', 'restaurant', 'local-service', 'coaching',
      'real-estate', 'portfolio', 'nonprofit', 'ecommerce', 'agency',
    ],
    requiresAuth: false,
    minPlan: 'free',
  },

  'lead-capture': {
    id: 'lead-capture',
    name: 'Lead Capture',
    description: 'Structured lead capture with pipeline integration',
    provides: ['crm.leads', 'crm.contacts', 'automation.follow_up', 'notifications.email'],
    dependencies: ['contact'],
    primaryIntent: 'lead.capture',
    supportingIntents: [
      'contact.submit',
      'demo.request',
      'consultation.request',
      'content.download',
      'volunteer.signup',
    ],
    requiredTables: ['leads', 'crm_leads', 'crm_contacts'],
    database: { migrations: ['leads', 'crm_leads', 'crm_contacts'], requiredTables: ['leads', 'crm_leads', 'crm_contacts'], requiredColumns: ['leads.email', 'crm_leads.stage', 'crm_contacts.email'], rlsPolicies: ['leads_insert_public', 'crm_owner_access'] },
    backend: { functions: ['create-lead', 'automation-event'], events: ['lead.captured'], permissions: ['business.crm.manage', 'visitor.lead.create'] },
    frontend: { components: ['LeadForm'], dataSources: ['crm.leads'], supportedSlots: ['hero.primary-cta', 'cta-banner.primary-action'] },
    intents: { provided: ['lead.capture'], required: ['contact.submit'] },
    settings: { accountFields: ['business.notificationEmail'], projectFields: ['crm.defaultPipeline', 'automation.followUpEnabled'] },
    readiness: { assertions: ['lead-handler-installed', 'crm-stage-exists'], fixtures: ['lead', 'contact'] },
    requiredWorkflows: [
      {
        id: 'lead-qualification',
        name: 'Lead Qualification',
        triggerIntent: 'lead.capture',
        steps: ['create_lead', 'qualify_lead', 'assign_pipeline_stage'],
        description: 'Qualifies and routes new leads',
      },
    ],
    requiredOverlays: ['lead-form'],
    supportedIndustries: ['saas', 'salon', 'restaurant', 'local-service', 'coaching', 'real-estate', 'portfolio', 'nonprofit', 'ecommerce', 'agency'],
    crmEntryStage: 'New Lead',
    requiresAuth: false,
    minPlan: 'starter',
  },

  donation: {
    id: 'donation',
    name: 'Donations',
    description: 'Accept donations with acknowledgment workflows',
    provides: ['commerce.checkout', 'crm.contacts', 'notifications.email'],
    dependencies: ['contact'],
    primaryIntent: 'donation.start',
    supportingIntents: ['pay.checkout', 'contact.submit', 'newsletter.subscribe'],
    requiredTables: ['orders'],
    database: { migrations: ['orders'], requiredTables: ['orders'], requiredColumns: ['orders.customer_id', 'orders.total_cents'], rlsPolicies: ['orders_customer_access', 'orders_business_access'] },
    backend: { functions: ['create-checkout', 'automation-event'], events: ['donation.created'], permissions: ['visitor.donation.create', 'business.donations.manage'] },
    frontend: { components: ['DonationForm'], dataSources: ['commerce.checkout'], supportedSlots: ['hero.primary-cta', 'cta-banner.primary-action'] },
    intents: { provided: ['donation.start', 'pay.checkout'], required: [] },
    settings: { accountFields: ['business.notificationEmail'], projectFields: ['donation.currency'] },
    readiness: { assertions: ['checkout-handler-installed'], fixtures: ['donation'] },
    requiredWorkflows: [
      {
        id: 'donation-thanks',
        name: 'Donation Thank You',
        triggerIntent: 'pay.success',
        steps: ['send_thank_you_email', 'create_crm_activity'],
        description: 'Sends thank you after donation',
      },
    ],
    requiredOverlays: ['donation-form'],
    supportedIndustries: ['nonprofit'],
    crmEntryStage: 'Donor',
    requiresAuth: false,
    minPlan: 'starter',
  },
};

// ============================================================================
// Lookup Helpers
// ============================================================================

export function getCapability(id: CapabilityId): CapabilityDefinition {
  return CAPABILITY_REGISTRY[id];
}

export function getCapabilitiesForIndustry(industry: string): CapabilityDefinition[] {
  const canonicalIndustry = normalizeIndustryKey(industry);
  return Object.values(CAPABILITY_REGISTRY)
    .filter(cap => cap.supportedIndustries.some(
      supportedIndustry => normalizeIndustryKey(supportedIndustry) === canonicalIndustry,
    ));
}

export function isCapabilitySupportedForIndustry(capability: CapabilityId, industry: string): boolean {
  return getCapability(capability).supportedIndustries.some(
    supportedIndustry => normalizeIndustryKey(supportedIndustry) === normalizeIndustryKey(industry),
  );
}

export function getCapabilitiesForIntent(intent: string): CapabilityDefinition[] {
  return Object.values(CAPABILITY_REGISTRY)
    .filter(cap =>
      cap.primaryIntent === intent ||
      cap.supportingIntents.includes(intent as CoreIntent)
    );
}

/**
 * Convert the deterministic Wizard capability plan into the operational
 * capability IDs consumed by generated-site runtime authorization.
 */
export function resolveOperationalCapabilities(
  pack: Pick<CapabilityPack, 'requiredFunnels' | 'requiredForms' | 'requiredCalendars' | 'requiredProducts'>,
  baseline: readonly CapabilityId[] = [],
): CapabilityId[] {
  const capabilities = new Set<CapabilityId>(baseline);

  for (const funnel of pack.requiredFunnels) {
    if (funnel === 'booking') capabilities.add('booking');
    if (funnel === 'purchase') capabilities.add('commerce');
    if (funnel === 'lead_capture') capabilities.add('lead-capture');
    if (funnel === 'quote_request') capabilities.add('quoting');
  }

  for (const form of pack.requiredForms) {
    if (form === 'contact') capabilities.add('contact');
    if (form.includes('quote')) capabilities.add('quoting');
    if (form.includes('booking') || form.includes('reservation')) capabilities.add('booking');
    if (form.includes('newsletter')) capabilities.add('newsletter');
  }

  if (pack.requiredCalendars.length > 0) capabilities.add('booking');
  if (pack.requiredProducts.length > 0) capabilities.add('commerce');

  return Array.from(capabilities).sort();
}

/** Get all canonical intents allowed for a set of capabilities */
export function getAllowedIntents(capabilities: CapabilityId[]): CoreIntent[] {
  const intents = new Set<CoreIntent>();
  for (const capId of capabilities) {
    const cap = CAPABILITY_REGISTRY[capId];
    if (cap) {
      intents.add(cap.primaryIntent);
      cap.supportingIntents.forEach(i => intents.add(i));
    }
  }
  return Array.from(intents);
}

/** Get all required tables for a set of capabilities */
export function getRequiredTables(capabilities: CapabilityId[]): string[] {
  const tables = new Set<string>();
  for (const capId of capabilities) {
    const cap = CAPABILITY_REGISTRY[capId];
    if (cap) {
      cap.requiredTables.forEach(t => tables.add(t));
    }
  }
  return Array.from(tables);
}

/** Get all required workflows for a set of capabilities */
export function getRequiredWorkflows(capabilities: CapabilityId[]): WorkflowSpec[] {
  const seen = new Set<string>();
  const workflows: WorkflowSpec[] = [];
  for (const capId of capabilities) {
    const cap = CAPABILITY_REGISTRY[capId];
    if (cap) {
      for (const wf of cap.requiredWorkflows) {
        if (!seen.has(wf.id)) {
          seen.add(wf.id);
          workflows.push(wf);
        }
      }
    }
  }
  return workflows;
}
