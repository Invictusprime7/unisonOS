/**
 * Wizard Playground Materializer — Creates full PlaygroundState from
 * wizard selections + capability pack + topology plan.
 * 
 * V2: Now emits stable elementKey, sourceSection, sourceSlot, and
 * canonical coreIntent on each binding. Resolution uses slot identity
 * instead of label matching.
 */

import { nanoid } from 'nanoid';
import type {
  WizardSelections,
  CapabilityPack,
  PlaygroundState,
  PlaygroundMaterializationResult,
  PlaygroundBinding,
  PlaygroundCalendar,
  PlaygroundPopup,
  PlaygroundPageRole,
  PlaygroundBindingIntent,
  PlaygroundBindingSpecV2,
} from '@/types/playground';
import type { PageRegistry } from '@/types/pageRegistry';
import { inferPageRoleFromType } from '@/types/pageRegistry';
import type { CreatorFormField, CreatorService } from '@/types/creatorData';
import { createEmptyCreatorData } from '@/types/creatorData';
import {
  planSiteTopology,
  populateRegistryFromTopology,
  resolvePageSpecsForRoles,
  type GeneratedSitePlan,
} from '@/platform/core/siteTopologyPlanner';
import { normalizePlaygroundIntent, inferUIAction } from '@/platform/core/intentNormalizer';
import {
  createCanonicalComponentInstance,
} from '@/services/canonicalComponentRegistry';

// ============================================================================
// Industry → Industry Key mapping
// ============================================================================

const OVERLAY_TO_INDUSTRY: Record<string, string> = {
  salon: 'salon', barber: 'salon', medspa: 'salon', wellness: 'salon',
  dental: 'local-service', healthcare: 'local-service', 'local-service': 'local-service', contractor: 'contractor',
  hvac: 'local-service', cleaning: 'local-service', landscaping: 'local-service',
  auto_detailing: 'local-service', moving: 'local-service', legal: 'agency',
  real_estate: 'real-estate', realestate: 'real-estate', 'real-estate': 'real-estate',
  restaurant: 'restaurant', cafe: 'restaurant', bakery: 'restaurant',
  ecommerce: 'ecommerce', store: 'ecommerce', fitness: 'coaching',
  portfolio: 'portfolio', photographer: 'portfolio', photography: 'portfolio', creator: 'portfolio', creative: 'portfolio',
  coaching: 'coaching', agency: 'agency', nonprofit: 'nonprofit', saas: 'saas',
};

// ============================================================================
// Form Templates
// ============================================================================

interface FormTemplate {
  name: string;
  fields: Omit<CreatorFormField, 'fieldId'>[];
  submitLabel: string;
  successMessage: string;
}

export const WIZARD_FORM_TARGET_ALIASES = {
  booking_form: 'booking_intake',
  booking: 'booking_intake',
  contact_form: 'contact',
  newsletter_form: 'newsletter',
  newsletter_signup: 'newsletter',
  quote_form: 'quote_request',
} as const;

function normalizeWizardFormTarget(targetRef: string): string {
  return WIZARD_FORM_TARGET_ALIASES[targetRef as keyof typeof WIZARD_FORM_TARGET_ALIASES] ?? targetRef;
}

const FORM_TEMPLATES: Record<string, FormTemplate> = {
  contact: {
    name: 'Contact Form',
    fields: [
      { label: 'Name', type: 'text', required: true, sortOrder: 0 },
      { label: 'Email', type: 'email', required: true, sortOrder: 1 },
      { label: 'Phone', type: 'phone', required: false, sortOrder: 2 },
      { label: 'Message', type: 'textarea', required: true, sortOrder: 3 },
    ],
    submitLabel: 'Send Message',
    successMessage: 'Thank you! We\'ll get back to you soon.',
  },
  booking_intake: {
    name: 'Booking Intake',
    fields: [
      { label: 'Name', type: 'text', required: true, sortOrder: 0 },
      { label: 'Email', type: 'email', required: true, sortOrder: 1 },
      { label: 'Phone', type: 'phone', required: true, sortOrder: 2 },
      { label: 'Preferred Date', type: 'date', required: true, sortOrder: 3 },
      { label: 'Notes', type: 'textarea', required: false, sortOrder: 4 },
    ],
    submitLabel: 'Book Now',
    successMessage: 'Your booking has been submitted! We\'ll confirm shortly.',
  },
  newsletter: {
    name: 'Newsletter Subscription',
    fields: [
      { label: 'Email', type: 'email', required: true, sortOrder: 0 },
    ],
    submitLabel: 'Subscribe',
    successMessage: 'Thank you for subscribing!',
  },
  quote_request: {
    name: 'Quote Request',
    fields: [
      { label: 'Name', type: 'text', required: true, sortOrder: 0 },
      { label: 'Email', type: 'email', required: true, sortOrder: 1 },
      { label: 'Phone', type: 'phone', required: true, sortOrder: 2 },
      { label: 'Service Needed', type: 'select', required: true, options: ['General', 'Repair', 'Installation', 'Consultation'], sortOrder: 3 },
      { label: 'Description', type: 'textarea', required: true, sortOrder: 4 },
    ],
    submitLabel: 'Request Quote',
    successMessage: 'Thank you! We\'ll send your quote within 24 hours.',
  },
  reservation: {
    name: 'Reservation Form',
    fields: [
      { label: 'Name', type: 'text', required: true, sortOrder: 0 },
      { label: 'Email', type: 'email', required: true, sortOrder: 1 },
      { label: 'Phone', type: 'phone', required: true, sortOrder: 2 },
      { label: 'Date', type: 'date', required: true, sortOrder: 3 },
      { label: 'Party Size', type: 'number', required: true, sortOrder: 4 },
      { label: 'Special Requests', type: 'textarea', required: false, sortOrder: 5 },
    ],
    submitLabel: 'Reserve',
    successMessage: 'Your reservation has been confirmed!',
  },
  demo_request: {
    name: 'Demo Request',
    fields: [
      { label: 'Name', type: 'text', required: true, sortOrder: 0 },
      { label: 'Email', type: 'email', required: true, sortOrder: 1 },
      { label: 'Company', type: 'text', required: false, sortOrder: 2 },
      { label: 'Message', type: 'textarea', required: false, sortOrder: 3 },
    ],
    submitLabel: 'Request Demo',
    successMessage: 'We\'ll reach out to schedule your demo!',
  },
  project_inquiry: {
    name: 'Project Inquiry',
    fields: [
      { label: 'Name', type: 'text', required: true, sortOrder: 0 },
      { label: 'Email', type: 'email', required: true, sortOrder: 1 },
      { label: 'Project Type', type: 'select', required: true, options: ['Portrait', 'Event', 'Commercial', 'Other'], sortOrder: 2 },
      { label: 'Details', type: 'textarea', required: true, sortOrder: 3 },
    ],
    submitLabel: 'Submit Inquiry',
    successMessage: 'Thank you for your inquiry! We\'ll be in touch.',
  },
  consultation_intake: {
    name: 'Consultation Intake',
    fields: [
      { label: 'Name', type: 'text', required: true, sortOrder: 0 },
      { label: 'Email', type: 'email', required: true, sortOrder: 1 },
      { label: 'Phone', type: 'phone', required: true, sortOrder: 2 },
      { label: 'Area of Interest', type: 'select', required: true, options: ['General', 'Anti-Aging', 'Skin Care', 'Body Contouring'], sortOrder: 3 },
      { label: 'Notes', type: 'textarea', required: false, sortOrder: 4 },
    ],
    submitLabel: 'Book Consultation',
    successMessage: 'Your consultation request has been submitted!',
  },
  volunteer: {
    name: 'Volunteer Sign-up',
    fields: [
      { label: 'Name', type: 'text', required: true, sortOrder: 0 },
      { label: 'Email', type: 'email', required: true, sortOrder: 1 },
      { label: 'Phone', type: 'phone', required: false, sortOrder: 2 },
      { label: 'Availability', type: 'textarea', required: false, sortOrder: 3 },
    ],
    submitLabel: 'Sign Up',
    successMessage: 'Thank you for volunteering!',
  },
  patient_intake: {
    name: 'Patient Intake',
    fields: [
      { label: 'Full Name', type: 'text', required: true, sortOrder: 0 },
      { label: 'Email', type: 'email', required: true, sortOrder: 1 },
      { label: 'Phone', type: 'phone', required: true, sortOrder: 2 },
      { label: 'Date of Birth', type: 'date', required: true, sortOrder: 3 },
      { label: 'Insurance Provider', type: 'text', required: false, sortOrder: 4 },
      { label: 'Reason for Visit', type: 'textarea', required: true, sortOrder: 5 },
    ],
    submitLabel: 'Submit',
    successMessage: 'Your intake form has been received.',
  },
  property_inquiry: {
    name: 'Property Inquiry',
    fields: [
      { label: 'Name', type: 'text', required: true, sortOrder: 0 },
      { label: 'Email', type: 'email', required: true, sortOrder: 1 },
      { label: 'Phone', type: 'phone', required: true, sortOrder: 2 },
      { label: 'Budget Range', type: 'select', required: false, options: ['Under $200K', '$200K-$400K', '$400K-$600K', '$600K+'], sortOrder: 3 },
      { label: 'Message', type: 'textarea', required: false, sortOrder: 4 },
    ],
    submitLabel: 'Send Inquiry',
    successMessage: 'An agent will contact you shortly!',
  },
};

// ============================================================================
// Calendar Templates
// ============================================================================

const CALENDAR_TEMPLATES: Record<string, Omit<PlaygroundCalendar, 'calendarId' | 'sortOrder' | 'attachedPageIds'>> = {
  main_booking: { name: 'Main Booking', bookingType: 'appointment', defaultDuration: 60 },
  consultation_booking: { name: 'Consultation', bookingType: 'consultation', defaultDuration: 30 },
  session_booking: { name: 'Session Booking', bookingType: 'appointment', defaultDuration: 60 },
  appointment_booking: { name: 'Appointment', bookingType: 'appointment', defaultDuration: 45 },
  class_booking: { name: 'Class Booking', bookingType: 'class', defaultDuration: 60 },
  discovery_call: { name: 'Discovery Call', bookingType: 'consultation', defaultDuration: 30 },
  reservation: { name: 'Reservation', bookingType: 'reservation', defaultDuration: 90 },
};

// ============================================================================
// Popup Templates
// ============================================================================

const POPUP_TEMPLATES: Record<string, Omit<PlaygroundPopup, 'popupId' | 'sortOrder' | 'activeOnPageIds'>> = {
  new_client_offer: { name: 'New Client Offer', trigger: 'timer', triggerConfig: { delayMs: 5000 }, contentType: 'offer', showOncePerSession: true },
  first_visit_discount: { name: 'First Visit Discount', trigger: 'timer', triggerConfig: { delayMs: 8000 }, contentType: 'offer', showOncePerSession: true },
  free_consultation_offer: { name: 'Free Consultation', trigger: 'exit_intent', contentType: 'form', showOncePerSession: true },
  free_estimate_popup: { name: 'Free Estimate', trigger: 'scroll', triggerConfig: { scrollPercent: 50 }, contentType: 'form', showOncePerSession: true },
  seasonal_offer: { name: 'Seasonal Offer', trigger: 'timer', triggerConfig: { delayMs: 10000 }, contentType: 'offer', showOncePerSession: true },
  first_clean_discount: { name: 'First Clean Discount', trigger: 'exit_intent', contentType: 'offer', showOncePerSession: true },
  free_session_offer: { name: 'Free Session Offer', trigger: 'timer', triggerConfig: { delayMs: 8000 }, contentType: 'form', showOncePerSession: true },
};

const PRODUCT_TEMPLATES: Record<string, { name: string; description: string; price: number; category: string }> = {
  starter_offer: {
    name: 'Starter Offer',
    description: 'Core starter package for new customers.',
    price: 99,
    category: 'Starter',
  },
  signature_offer: {
    name: 'Signature Offer',
    description: 'Primary flagship offer for your business.',
    price: 199,
    category: 'Signature',
  },
  ecommerce_primary: {
    name: 'Featured Product',
    description: 'Primary shoppable product wired into checkout.',
    price: 49,
    category: 'Shop',
  },
};


// ============================================================================
// Native Publish Defaults
// ============================================================================

const DEFAULT_NATIVE_HOURS = [
  { day: 'Monday', open: '09:00', close: '17:00' },
  { day: 'Tuesday', open: '09:00', close: '17:00' },
  { day: 'Wednesday', open: '09:00', close: '17:00' },
  { day: 'Thursday', open: '09:00', close: '17:00' },
  { day: 'Friday', open: '09:00', close: '17:00' },
  { day: 'Saturday', open: '10:00', close: '14:00' },
  { day: 'Sunday', open: '', close: '', closed: true },
];

const SALON_NATIVE_SERVICES: Array<Omit<CreatorService, 'serviceId' | 'sortOrder'>> = [
  {
    name: 'Signature Styling Appointment',
    slug: 'signature-styling-appointment',
    description: 'A polished salon appointment for cuts, styling, and client consultation.',
    price: 8500,
    duration: 60,
    currency: 'USD',
    category: 'Hair Services',
    availabilitySummary: 'Available during standard salon hours',
    ctaLabel: 'Book Appointment',
    featured: true,
    visibility: 'featured',
    bookable: true,
  },
  {
    name: 'Color Consultation',
    slug: 'color-consultation',
    description: 'A focused consultation to plan color, treatment, and follow-up care.',
    price: 3500,
    duration: 30,
    currency: 'USD',
    category: 'Consultation',
    availabilitySummary: 'Weekdays and select Saturdays',
    ctaLabel: 'Book Consultation',
    featured: true,
    visibility: 'public',
    bookable: true,
  },
  {
    name: 'Treatment & Blowout',
    slug: 'treatment-blowout',
    description: 'A conditioning treatment finished with a professional blowout.',
    price: 12000,
    duration: 90,
    currency: 'USD',
    category: 'Treatments',
    availabilitySummary: 'Available by appointment',
    ctaLabel: 'Reserve Time',
    featured: false,
    visibility: 'public',
    bookable: true,
  },
];

function normalizeOwnerEmail(value?: string): string | undefined {
  const trimmed = (value || '').trim();
  return trimmed.includes('@') ? trimmed : undefined;
}

function seedNativeSalonServices(creatorData: PlaygroundState['creatorData']) {
  if (Object.keys(creatorData.services).length > 0) return;

  SALON_NATIVE_SERVICES.forEach((service, index) => {
    const serviceId = `svc_${nanoid(8)}`;
    creatorData.services[serviceId] = {
      ...service,
      serviceId,
      sortOrder: index,
    };
  });

  const collectionId = `col_${nanoid(8)}`;
  creatorData.collections[collectionId] = {
    collectionId,
    name: 'Bookable Salon Services',
    type: 'services',
    itemIds: Object.keys(creatorData.services),
    sortOrder: Object.keys(creatorData.collections).length,
  };
}

function applyNativePublishDefaults(
  playground: PlaygroundState,
  selections: WizardSelections,
): void {
  const parameters = selections.businessParameters;
  const ownerEmail = normalizeOwnerEmail(selections.ownerEmail);
  const businessInfo = playground.creatorData.businessInfo;
  businessInfo.tagline = parameters?.tagline?.trim() || businessInfo.tagline;
  businessInfo.description = parameters?.description?.trim() || businessInfo.description;
  businessInfo.website = parameters?.website?.trim() || businessInfo.website;
  businessInfo.logoUrl = parameters?.logoUrl?.trim() || businessInfo.logoUrl;
  businessInfo.brandColor = parameters?.brandColor?.trim() || businessInfo.brandColor;
  businessInfo.timezone = parameters?.timezone?.trim() || businessInfo.timezone;
  businessInfo.email = parameters?.publicEmail?.trim() || businessInfo.email || ownerEmail;
  businessInfo.phone = parameters?.phone?.trim() || businessInfo.phone;
  businessInfo.notificationEmail = parameters?.notificationEmail?.trim() || businessInfo.notificationEmail || ownerEmail;
  businessInfo.notificationPhone = parameters?.notificationPhone?.trim() || businessInfo.notificationPhone;
  businessInfo.bookingOwner = parameters?.bookingOwner?.trim() || parameters?.ownerEmail?.trim() || businessInfo.bookingOwner || ownerEmail;
  businessInfo.crmDestination = parameters?.crmDestination?.trim() || businessInfo.crmDestination || 'unison_crm';
  businessInfo.paymentProvider = parameters?.paymentProvider?.trim() || businessInfo.paymentProvider;
  businessInfo.followUpChannel = parameters?.followUpChannel?.trim() || businessInfo.followUpChannel || 'email';
  businessInfo.socialLinks = { ...(parameters?.socialLinks || {}), ...(businessInfo.socialLinks || {}) };
  const address = parameters?.address;
  if (address) {
    const formattedAddress = [address.line1, address.city, address.region, address.postalCode, address.country]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(', ');
    businessInfo.address = formattedAddress || businessInfo.address;
  }
  businessInfo.hours = parameters?.hours?.length ? parameters.hours : businessInfo.hours;
  businessInfo.customValues = {
    ...(businessInfo.customValues || {}),
    ...(parameters?.industry || {}),
    ...(selections.nativePublishReady ? {
      publishMode: selections.publishMode || 'native-first-party',
      nativeLeadDestination: 'unison_crm',
      nativeBookingProvider: 'unison_booking_requests',
    } : {}),
  };
  if (!selections.nativePublishReady) return;

  businessInfo.hours = businessInfo.hours?.length ? businessInfo.hours : DEFAULT_NATIVE_HOURS;

  if (selections.industryOverlay === 'salon' || selections.businessModel === 'appointment_service') {
    seedNativeSalonServices(playground.creatorData);
  }

  for (const form of Object.values(playground.creatorData.forms)) {
    const lowerName = form.name.toLowerCase();
    form.destinationType = 'crm';
    form.destinationLabel = 'Unison CRM + owner email';
    form.submitIntentId = lowerName.includes('booking') || lowerName.includes('reservation')
      ? 'booking.create'
      : lowerName.includes('quote')
        ? 'quote.request'
        : 'contact.submit';
  }

  for (const binding of Object.values(playground.bindings)) {
    if (!binding.isValid) continue;
    binding.previewStatus = 'ready';
    binding.publishStatus = ownerEmail ? 'ready' : 'blocked';
    binding.readiness = ownerEmail ? 'publish-ready' : 'blocked';
    binding.missingDependencies = ownerEmail ? [] : ['Owner notification email'];
    binding.fixHints = ownerEmail ? [] : ['Sign in with an email address or set a notification email before publish.'];
  }

  for (const component of Object.values(playground.creatorData.componentInstances)) {
    if (component.status !== 'stubbed') {
      component.status = 'ready';
    }
  }
}

// ============================================================================
// Element Key Generator
// ============================================================================

/**
 * Generate a stable element key from page role, section, and slot.
 * Format: pageRole.sectionType.slotRole
 * 
 * Examples:
 *   home.hero.primary-cta
 *   shop.shop-grid.card-cta
 *   pricing.pricing.card-cta
 *   navbar.primary-cta (section-less for navbar)
 */
function generateElementKey(
  pageRole: PlaygroundPageRole,
  section: string,
  slot: string,
): string {
  return `${pageRole}.${section}.${slot}`;
}

function toTitleCase(rawValue: string) {
  return rawValue
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function getPrimaryPageId(
  roleToPageId: Record<string, string>,
  ...roles: PlaygroundPageRole[]
) {
  return roles.map((role) => roleToPageId[role]).find(Boolean) || '';
}

function inferComponentSlugForForm(formName: string) {
  const normalized = formName.toLowerCase();
  if (normalized.includes('booking') || normalized.includes('reservation')) return null;
  if (normalized.includes('quote')) return 'request-quote';
  if (normalized.includes('newsletter')) return 'newsletter-signup';
  return 'contact-form';
}

// ============================================================================
// Core Materializer
// ============================================================================

export function materializePlayground(
  selections: WizardSelections,
  capabilities: CapabilityPack,
): PlaygroundMaterializationResult {
  const warnings: string[] = [];
  const industryKey = OVERLAY_TO_INDUSTRY[selections.industryOverlay];
  if (!industryKey) {
    throw new Error(
      `[WizardMaterializer] Unsupported industry overlay "${selections.industryOverlay}". ` +
      'Refusing to use a generic/minimal launch path.',
    );
  }

  // Wizard-selected pages are authoritative. `capability-full` is deprecated
  // for runtime wizard launches because it reintroduces unselected industry
  // defaults into PageRegistry/router/VFS. Keep the variable only so older
  // payloads normalize to selected-pages instead of expanding routes.
  const scaffoldMode = 'selected-pages';

  const selectedPageRoles = new Set<string>(selections.requestedPages ?? []);
  const additionalPages = resolvePageSpecsForRoles(selections.requestedPages ?? [], industryKey);

  // 1. Generate site topology plan → PageRegistry
  const sitePlan = planSiteTopology(industryKey, selections.businessName, {
    additionalPages,
    primaryIntent: selections.primaryIntent,
    selectedTemplateId: selections.templateId,
    selectedThemePresetId: selections.themePresetId || selections.themeId,
    restrictToAdditionalPages: true,
  });
  const pageRegistry = populateRegistryFromTopology(sitePlan);

  // 2. Never back-add capability/model pages the user did not select. Only
  //    selected pages may enter the registry/router/VFS; capability objects can
  //    still exist, but their bindings degrade to overlays or warnings unless
  //    their target page was explicitly checked in the wizard.
  ensureRequiredPages(
    pageRegistry,
    sitePlan,
    capabilities.requiredPages.filter((role) => selectedPageRoles.has(role)),
    selections.businessName,
  );

  // 3. Create empty creator data
  const creatorData = createEmptyCreatorData(selections.businessName);

  // 4. Build a pageRole → pageId lookup from the registry (with alias support)
  const roleToPageId = buildRoleToPageIdMap(pageRegistry, sitePlan);

  // 5. Materialize forms
  const formIdMap: Record<string, string> = {};
  const requiredFormKeys = new Set(capabilities.requiredForms);
  if (capabilities.recommendedBindingsV2.some(
    (binding) => binding.coreIntent === 'newsletter.subscribe'
      || normalizeWizardFormTarget(binding.targetRef) === 'newsletter',
  )) {
    requiredFormKeys.add('newsletter');
  }
  for (const formKey of requiredFormKeys) {
    const template = FORM_TEMPLATES[formKey];
    if (!template) {
      warnings.push(`No form template for "${formKey}"`);
      continue;
    }
    const formId = `form_${nanoid(8)}`;
    formIdMap[formKey] = formId;
    creatorData.forms[formId] = {
      formId,
      name: template.name,
      fields: template.fields.map(f => ({ ...f, fieldId: `field_${nanoid(6)}` })),
      submitLabel: template.submitLabel,
      successMessage: template.successMessage,
      sortOrder: Object.keys(creatorData.forms).length,
    };
  }

  // 6. Materialize calendars
  const calendarIdMap: Record<string, string> = {};
  const calendars: Record<string, PlaygroundCalendar> = {};
  for (const calKey of capabilities.requiredCalendars) {
    const template = CALENDAR_TEMPLATES[calKey];
    if (!template) {
      warnings.push(`No calendar template for "${calKey}"`);
      continue;
    }
    const calendarId = `cal_${nanoid(8)}`;
    calendarIdMap[calKey] = calendarId;

    const intakeFormKey = calKey === 'main_booking' ? 'booking_intake'
      : calKey === 'consultation_booking' ? 'consultation_intake'
      : calKey === 'appointment_booking' ? 'patient_intake'
      : calKey === 'reservation' ? 'reservation'
      : undefined;

    const bookingPageId = roleToPageId['booking'] || '';
    const confirmPageId = roleToPageId['booking_confirmation'] || roleToPageId['thankyou'] || '';

    calendars[calendarId] = {
      ...template,
      calendarId,
      intakeFormId: intakeFormKey ? formIdMap[intakeFormKey] : undefined,
      successPageId: confirmPageId || undefined,
      attachedPageIds: bookingPageId ? [bookingPageId] : [],
      sortOrder: Object.keys(calendars).length,
    };
  }

  // 6b. Materialize products
  for (const productKey of capabilities.requiredProducts) {
    const template = PRODUCT_TEMPLATES[productKey] || {
      name: toTitleCase(productKey),
      description: `Canonical ${toTitleCase(productKey).toLowerCase()} product.`,
      price: 99,
      category: 'General',
    };

    const productId = `prod_${nanoid(8)}`;
    creatorData.products[productId] = {
      productId,
      name: template.name,
      description: template.description,
      price: template.price,
      currency: 'USD',
      category: template.category,
      status: 'active',
      sortOrder: Object.keys(creatorData.products).length,
    };
  }

  // 7. Materialize popups
  const popups: Record<string, PlaygroundPopup> = {};
  for (const popupKey of capabilities.recommendedPopups) {
    const template = POPUP_TEMPLATES[popupKey];
    if (!template) {
      warnings.push(`No popup template for "${popupKey}"`);
      continue;
    }
    const popupId = `popup_${nanoid(8)}`;
    const homePageId = roleToPageId['home'] || '';

    let contentRefId: string | undefined;
    if (template.contentType === 'form') {
      contentRefId = formIdMap['contact'] || Object.values(formIdMap)[0];
    }

    popups[popupId] = {
      ...template,
      popupId,
      contentRefId,
      activeOnPageIds: homePageId ? [homePageId] : [],
      sortOrder: Object.keys(popups).length,
    };
  }

  // 8. Materialize bindings — prefer V2 slot-bound specs, fallback to legacy
  const bindings: Record<string, PlaygroundBinding> = {};
  const useV2 = capabilities.recommendedBindingsV2 && capabilities.recommendedBindingsV2.length > 0;

  if (useV2) {
    // V2 path: slot-bound resolution
    for (const spec of capabilities.recommendedBindingsV2) {
      const sourcePageId = roleToPageId[spec.sourcePageRole];
      if (!sourcePageId) {
        warnings.push(`Binding source page role "${spec.sourcePageRole}" not found in registry`);
        continue;
      }

      // Validate source page actually exists in registry
      if (!pageRegistry.pages[sourcePageId]) {
        warnings.push(`Binding source page ID "${sourcePageId}" for role "${spec.sourcePageRole}" not in registry`);
        continue;
      }

      const { targetId, targetType } = resolveBindingTarget(
        spec.intent,
        spec.targetRef,
        roleToPageId,
        formIdMap,
        calendarIdMap,
      );

      // Skip bindings with unresolvable targets (prevents invalid entries)
      if (!targetId) {
        warnings.push(`Binding target "${spec.targetRef}" could not be resolved for ${spec.sourcePageRole}.${spec.sourceSection}.${spec.sourceSlot}`);
        continue;
      }

      const elementKey = spec.sourceElementKey || generateElementKey(
        spec.sourcePageRole,
        spec.sourceSection,
        spec.sourceSlot,
      );

      const coreIntent = spec.coreIntent || normalizePlaygroundIntent(spec.intent, spec.targetRef);
      const uiAction = spec.uiAction || inferUIAction(spec.intent);

      const bindingId = `bind_${nanoid(8)}`;
      bindings[bindingId] = {
        bindingId,
        sourcePageId,
        sourceLabel: spec.label || '',
        intent: spec.intent,
        targetId,
        targetType,
        confidence: 0.95, // Higher confidence for slot-bound
        source: 'wizard',
        isValid: true,
        // V2 fields
        elementKey,
        sourceSection: spec.sourceSection,
        sourceSlot: spec.sourceSlot,
        coreIntent,
        uiAction,
        payloadTemplate: spec.payloadTemplate,
        readiness: 'preview-ready',
      };
    }
  } else {
    // Legacy path: label-bound resolution (backward compat)
    for (const spec of capabilities.recommendedBindings) {
      const sourcePageId = roleToPageId[spec.sourcePageRole];
      if (!sourcePageId) {
        warnings.push(`Binding source page role "${spec.sourcePageRole}" not found in registry`);
        continue;
      }

      if (!pageRegistry.pages[sourcePageId]) {
        warnings.push(`Binding source page ID "${sourcePageId}" for role "${spec.sourcePageRole}" not in registry`);
        continue;
      }

      const { targetId, targetType } = resolveBindingTarget(
        spec.intent,
        spec.targetRef,
        roleToPageId,
        formIdMap,
        calendarIdMap,
      );

      if (!targetId) {
        warnings.push(`Binding target "${spec.targetRef}" could not be resolved`);
        continue;
      }

      const bindingId = `bind_${nanoid(8)}`;
      bindings[bindingId] = {
        bindingId,
        sourcePageId,
        sourceLabel: spec.sourceLabel,
        intent: spec.intent,
        targetId,
        targetType,
        confidence: 0.9,
        source: 'wizard',
        isValid: true,
        // Generate V2 fields even from legacy specs
        coreIntent: normalizePlaygroundIntent(spec.intent, spec.targetRef),
        readiness: 'preview-ready',
      };
    }
  }

  // 8b. Materialize canonical component instances
  const homePageId = getPrimaryPageId(roleToPageId, 'home');
  const contactPageId = getPrimaryPageId(roleToPageId, 'contact', 'home');
  const bookingPageId = getPrimaryPageId(roleToPageId, 'booking', 'home');
  const shopPageId = getPrimaryPageId(roleToPageId, 'shop', 'pricing', 'home');

  for (const form of Object.values(creatorData.forms)) {
    const slug = inferComponentSlugForForm(form.name);
    if (!slug) continue;
    const component = createCanonicalComponentInstance(slug, {
      label: form.name,
      usedOnPages: [slug === 'newsletter-signup' ? homePageId : contactPageId].filter(Boolean),
      bindings: { formId: form.formId },
    });

    if (component) {
      component.status = 'ready';
      creatorData.componentInstances[component.instanceId] = component;
    }
  }

  for (const calendar of Object.values(calendars)) {
    const component = createCanonicalComponentInstance('booking-scheduler', {
      label: `${calendar.name} Scheduler`,
      usedOnPages: [...new Set([...calendar.attachedPageIds, bookingPageId])].filter(Boolean),
      bindings: {
        calendarId: calendar.calendarId,
        ...(calendar.intakeFormId ? { formId: calendar.intakeFormId } : {}),
      },
    });

    if (component) {
      component.status = 'ready';
      creatorData.componentInstances[component.instanceId] = component;
    }
  }

  const firstProduct = Object.values(creatorData.products).sort((a, b) => a.sortOrder - b.sortOrder)[0];
  if (firstProduct) {
    const checkoutComponent = createCanonicalComponentInstance('checkout-cta', {
      label: `${firstProduct.name} Checkout`,
      usedOnPages: [shopPageId || homePageId].filter(Boolean),
      bindings: { productId: firstProduct.productId },
    });

    if (checkoutComponent) {
      checkoutComponent.status = 'ready';
      creatorData.componentInstances[checkoutComponent.instanceId] = checkoutComponent;
    }
  }

  // 9. Assemble state
  const playground: PlaygroundState = {
    creatorData,
    pageRegistry,
    bindings,
    calendars,
    popups,
  };

  applyNativePublishDefaults(playground, selections);

  return { playground, sitePlan, warnings };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Role alias map: PlaygroundPageRole → topology PageRole
 * The capability resolver uses PlaygroundPageRole (e.g., 'thankyou', 'booking_confirmation')
 * while the topology planner uses PageRole (e.g., 'thank_you').
 * This map normalizes both directions for reliable lookups.
 */
const ROLE_ALIASES: Record<string, string[]> = {
  thankyou: ['thank_you'],
  thank_you: ['thankyou'],
  booking_confirmation: ['thank_you', 'thankyou'],
};

function buildRoleToPageIdMap(
  registry: PageRegistry,
  sitePlan: GeneratedSitePlan,
): Record<string, string> {
  const map: Record<string, string> = {};

  // Map from topology plan roles
  for (const node of sitePlan.pages) {
    map[node.role] = node.id;
  }

  // Map from registry pages (covers dynamically added pages)
  for (const page of Object.values(registry.pages)) {
    if (page.isHome) map['home'] = page.pageId;

    // Also map by pageType (which corresponds to PlaygroundPageRole in many cases)
    if (page.pageType && !map[page.pageType]) {
      map[page.pageType] = page.pageId;
    }
  }

  // Apply aliases: ensure both naming conventions resolve
  for (const [alias, targets] of Object.entries(ROLE_ALIASES)) {
    if (!map[alias]) {
      for (const target of targets) {
        if (map[target]) {
          map[alias] = map[target];
          break;
        }
      }
    }
  }

  return map;
}

/**
 * Ensure all capability-required pages exist in the registry.
 * The topology planner uses industry matrix defaults which may omit
 * pages the capability pack requires (e.g., checkout, thankyou for ecommerce).
 */
function ensureRequiredPages(
  registry: PageRegistry,
  sitePlan: GeneratedSitePlan,
  requiredPages: PlaygroundPageRole[],
  businessName: string,
): void {
  // Build set of existing roles from both topology plan and registry
  const existingRoles = new Set<string>();
  for (const node of sitePlan.pages) {
    existingRoles.add(node.role);
  }
  for (const page of Object.values(registry.pages)) {
    if (page.pageType) existingRoles.add(page.pageType);
  }

  // Also consider aliases
  for (const role of existingRoles) {
    const aliases = ROLE_ALIASES[role];
    if (aliases) aliases.forEach(a => existingRoles.add(a));
  }

  // Page role → route/title/filePath defaults
  const PAGE_DEFAULTS: Record<string, { title: string; route: string; filePath: string; pageType: string; showInNav: boolean }> = {
    shop:                  { title: 'Shop',         route: '/shop',         filePath: '/src/pages/Shop.tsx',        pageType: 'shop',      showInNav: true },
    checkout:              { title: 'Checkout',     route: '/checkout',     filePath: '/src/pages/Checkout.tsx',    pageType: 'checkout',  showInNav: false },
    thankyou:              { title: 'Thank You',    route: '/thank-you',    filePath: '/src/pages/ThankYou.tsx',    pageType: 'thankyou',  showInNav: false },
    booking:               { title: 'Booking',      route: '/booking',      filePath: '/src/pages/Booking.tsx',     pageType: 'booking',   showInNav: true },
    booking_confirmation:  { title: 'Confirmation', route: '/confirmation', filePath: '/src/pages/Confirmation.tsx',pageType: 'thankyou',  showInNav: false },
    about:                 { title: 'About',        route: '/about',        filePath: '/src/pages/About.tsx',       pageType: 'about',     showInNav: true },
    contact:               { title: 'Contact',      route: '/contact',      filePath: '/src/pages/Contact.tsx',     pageType: 'contact',   showInNav: true },
    services:              { title: 'Services',     route: '/services',     filePath: '/src/pages/Services.tsx',    pageType: 'landing',   showInNav: true },
    pricing:               { title: 'Pricing',      route: '/pricing',      filePath: '/src/pages/Pricing.tsx',     pageType: 'pricing',   showInNav: true },
    gallery:               { title: 'Gallery',      route: '/gallery',      filePath: '/src/pages/Gallery.tsx',     pageType: 'gallery',   showInNav: true },
    faq:                   { title: 'FAQ',           route: '/faq',          filePath: '/src/pages/Faq.tsx',         pageType: 'faq',       showInNav: true },
    blog:                  { title: 'Blog',          route: '/blog',         filePath: '/src/pages/Blog.tsx',        pageType: 'blog',      showInNav: true },
    immersive:             { title: 'Experience',    route: '/experience',   filePath: '/src/pages/Experience.tsx',  pageType: 'immersive', showInNav: true },
  };

  const navOrder = Object.keys(registry.pages).length * 10;
  let addedCount = 0;

  for (const role of requiredPages) {
    if (role === 'home' || role === 'custom') continue; // home always exists
    if (existingRoles.has(role)) continue;

    const defaults = PAGE_DEFAULTS[role];
    if (!defaults) continue;

    const pageId = `page_${nanoid(8)}`;

    // Inline page creation (avoids needing createBuilderPage import overhead)
    registry.pages[pageId] = {
      pageId,
      title: defaults.title,
      path: defaults.route,
      pageType: defaults.pageType as any,
      pageRole: role === 'services' ? 'service' : role === 'thankyou' || role === 'booking_confirmation' ? 'thank_you' : inferPageRoleFromType(defaults.pageType as any),
      routeState: 'generated',
      publishedStatus: 'unpublished',
      setupStatus: 'not_started',
      readinessSummary: {
        preview: 'unknown',
        publish: 'unknown',
      },
      filePath: defaults.filePath,
      source: { kind: 'react_tsx', content: '', contentHash: '' },
      output: {},
      showInNav: defaults.showInNav,
      navOrder: navOrder + (addedCount * 10),
      isHome: false,
      funnelIds: [],
      createdBy: 'template' as const,
      seo: {
        title: `${defaults.title} | ${businessName}`,
        description: `${defaults.title} page for ${businessName}`,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Track for alias resolution
    existingRoles.add(role);
    const aliases = ROLE_ALIASES[role];
    if (aliases) aliases.forEach(a => existingRoles.add(a));

    // Also add to sitePlan.pages so buildRoleToPageIdMap can find it
    sitePlan.pages.push({
      id: pageId,
      name: defaults.title,
      title: defaults.title,
      route: defaults.route,
      role: (role === 'thankyou' ? 'thank_you' : role === 'booking_confirmation' ? 'thank_you' : role) as any,
      filePath: defaults.filePath,
      visibleInNav: defaults.showInNav,
      isHome: false,
      generatedBy: 'wizard',
      seo: { title: `${defaults.title} | ${businessName}` },
    });

    addedCount++;
  }
}

function resolveBindingTarget(
  intent: PlaygroundBindingIntent,
  targetRef: string,
  roleToPageId: Record<string, string>,
  formIdMap: Record<string, string>,
  calendarIdMap: Record<string, string>,
): { targetId: string; targetType: PlaygroundBinding['targetType'] } {
  const uiAnchorTargetMap: Record<string, string> = {
    search: '#search',
    auth: '#auth',
    'mobile-nav': '#mobile-nav',
    filter: '#filter',
    sort: '#sort',
    favorites: '#favorites',
  };

  switch (intent) {
    case 'nav.goto_page':
    case 'funnel.goto_step': {
      // targetRef can be a page role or a route like '/checkout'
      const pageId = roleToPageId[targetRef] || resolveByRoute(targetRef, roleToPageId);
      if (!pageId && uiAnchorTargetMap[targetRef]) {
        return { targetId: uiAnchorTargetMap[targetRef], targetType: 'url' };
      }
      return { targetId: pageId || '', targetType: 'page' };
    }
    case 'form.open': {
      const formId = formIdMap[normalizeWizardFormTarget(targetRef)];
      return { targetId: formId || '', targetType: 'form' };
    }
    case 'calendar.open': {
      const calId = calendarIdMap[targetRef];
      return { targetId: calId || '', targetType: 'calendar' };
    }
    case 'popup.open':
      return { targetId: targetRef, targetType: 'popup' };
    case 'checkout.start': {
      // Checkout intent can target:
      //  - a page role/route (e.g., 'checkout', '/checkout') → resolve as page
      //  - a UI state target (e.g., 'cart', 'cart-overlay') → resolve as funnel_step
      //  - a product reference → resolve as product
      if (targetRef === 'cart' || targetRef === 'cart-overlay') {
        return { targetId: targetRef, targetType: 'funnel_step' };
      }
      // Try page role first
      const checkoutPageId = roleToPageId[targetRef] || resolveByRoute(targetRef, roleToPageId);
      if (checkoutPageId) {
        return { targetId: checkoutPageId, targetType: 'page' };
      }
      return { targetId: targetRef, targetType: 'product' };
    }
    case 'product.view':
      return { targetId: targetRef, targetType: 'product' };
    case 'external.open':
      return { targetId: targetRef, targetType: 'url' };
    default:
      return { targetId: targetRef, targetType: 'page' };
  }
}

/**
 * Resolve a route string (e.g., '/checkout') to a page ID by matching
 * against known page roles derived from routes.
 */
function resolveByRoute(
  targetRef: string,
  roleToPageId: Record<string, string>,
): string {
  if (!targetRef.startsWith('/')) return '';
  // Strip leading slash and try as role
  const slug = targetRef.replace(/^\//, '').replace(/-/g, '_');
  return roleToPageId[slug] || '';
}
