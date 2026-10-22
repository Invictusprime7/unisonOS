import { nanoid } from "nanoid";
import type { CreatorComponentInstance } from "@/types/creatorData";
import type { CapabilityId } from "@/platform/core/capabilityRegistry";
import { getCapability } from "@/platform/core/capabilityRegistry";
import type { CatalogSourceTable } from "@/platform/core/catalogSurfaceRegistry";
import type { CoreIntent } from "@/platform/core/coreIntents";
import type { SlotRole } from "@/platform/core/slotBindingPolicy";
import { getIntentDef } from "@/platform/core/intentSurfaceRegistry";

export type CanonicalComponentCategory =
  | "leads"
  | "booking"
  | "commerce"
  | "support"
  | "payments";

export interface CanonicalComponentDefinition {
  slug: string;
  name: string;
  description: string;
  componentType: string;
  category: CanonicalComponentCategory;
  targetType: "form" | "calendar" | "product" | "checkout" | "chat";
  requiredBindingKeys: string[];
  requiredBusinessFields?: string[];
  requiredSetupSteps?: string[];
  outputEvents: string[];
  /** Capabilities that authorize this component's runtime surface. */
  requiredCapabilities: CapabilityId[];
  /** Registry-backed read surfaces rendered by this component. */
  catalogSurfaces?: CatalogSourceTable[];
  /** The only write intent this component may emit, when it owns a write. */
  writeIntent?: CoreIntent;
  /** Declarative interactive slots that must be resolved during compilation. */
  slotBindings: SlotRole[];
  htmlTemplate: string;
}

const registry: CanonicalComponentDefinition[] = [
  {
    slug: "contact-form",
    name: "Contact Form",
    description: "Lead capture form wired to CRM and owner notifications.",
    componentType: "contact-form",
    category: "leads",
    targetType: "form",
    requiredBindingKeys: ["formId"],
    requiredBusinessFields: ["notificationEmail", "crmDestination"],
    outputEvents: ["lead.created", "form.submitted", "contact.submitted"],
    requiredCapabilities: ['contact'],
    writeIntent: 'contact.submit',
    slotBindings: ['form-submit'],
    htmlTemplate: `<section data-component="intent-contact-form" data-ut-component-slug="contact-form" data-ut-component-category="leads" data-intent="contact.submit" data-business-id="{{businessId}}" class="w-full py-12 px-4">
  <div class="max-w-xl mx-auto">
    <div class="text-center mb-8">
      <h2 class="text-3xl font-bold text-foreground mb-2">Get In Touch</h2>
      <p class="text-muted-foreground">We'd love to hear from you.</p>
    </div>
    <form data-intent-form="contact.submit" class="bg-card rounded-2xl p-8 shadow-lg border space-y-6">
      <input type="text" name="name" required placeholder="Your name" class="w-full px-4 py-3 bg-background border rounded-xl" />
      <input type="email" name="email" required placeholder="you@example.com" class="w-full px-4 py-3 bg-background border rounded-xl" />
      <textarea name="message" rows="4" required placeholder="How can we help?" class="w-full px-4 py-3 bg-background border rounded-xl resize-none"></textarea>
      <button type="submit" data-intent-trigger="contact.submit" class="w-full bg-primary text-primary-foreground py-4 px-6 rounded-xl font-semibold">Send Message</button>
    </form>
  </div>
</section>`,
  },
  {
    slug: "request-quote",
    name: "Request Quote",
    description: "Quote request form for service businesses and agencies.",
    componentType: "request-quote",
    category: "leads",
    targetType: "form",
    requiredBindingKeys: ["formId"],
    requiredBusinessFields: ["notificationEmail", "crmDestination"],
    outputEvents: ["quote.requested", "lead.created", "form.submitted"],
    requiredCapabilities: ['quoting'],
    writeIntent: 'quote.request',
    slotBindings: ['form-submit'],
    htmlTemplate: `<section data-component="intent-quote-form" data-ut-component-slug="request-quote" data-ut-component-category="leads" data-intent="quote.request" class="w-full py-12 px-4">
  <div class="max-w-2xl mx-auto rounded-3xl border bg-card p-8 shadow-lg">
    <h2 class="text-3xl font-bold text-foreground mb-2">Request a Quote</h2>
    <p class="text-muted-foreground mb-6">Tell us what you need and we will follow up with pricing.</p>
    <form data-intent-form="quote.request" class="grid gap-4 md:grid-cols-2">
      <input type="text" name="name" required placeholder="Full name" class="px-4 py-3 bg-background border rounded-xl md:col-span-1" />
      <input type="email" name="email" required placeholder="Email" class="px-4 py-3 bg-background border rounded-xl md:col-span-1" />
      <input type="tel" name="phone" placeholder="Phone" class="px-4 py-3 bg-background border rounded-xl md:col-span-1" />
      <input type="text" name="service" placeholder="Service needed" class="px-4 py-3 bg-background border rounded-xl md:col-span-1" />
      <textarea name="message" rows="4" required placeholder="Project details" class="px-4 py-3 bg-background border rounded-xl resize-none md:col-span-2"></textarea>
      <button type="submit" data-intent-trigger="quote.request" class="md:col-span-2 w-full bg-primary text-primary-foreground py-4 px-6 rounded-xl font-semibold">Request Quote</button>
    </form>
  </div>
</section>`,
  },
  {
    slug: "newsletter-signup",
    name: "Newsletter Signup",
    description: "Newsletter capture with a canonical subscription event.",
    componentType: "newsletter-signup",
    category: "leads",
    targetType: "form",
    requiredBindingKeys: ["formId"],
    requiredBusinessFields: ["notificationEmail"],
    outputEvents: ["newsletter.subscribed", "lead.created", "form.submitted"],
    requiredCapabilities: ['newsletter'],
    writeIntent: 'newsletter.subscribe',
    slotBindings: ['newsletter'],
    htmlTemplate: `<section data-component="intent-newsletter" data-ut-component-slug="newsletter-signup" data-ut-component-category="leads" data-intent="newsletter.subscribe" class="w-full py-16 px-4 bg-gradient-to-br from-primary/5 to-primary/10">
  <div class="max-w-2xl mx-auto text-center">
    <h2 class="text-3xl font-bold text-foreground mb-3">Stay Updated</h2>
    <p class="text-muted-foreground mb-8 max-w-md mx-auto">Get product news, offers, and updates delivered to your inbox.</p>
    <form data-intent-form="newsletter.subscribe" class="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
      <input type="email" name="email" required placeholder="Enter your email" class="flex-1 px-5 py-4 bg-background border rounded-xl" />
      <button type="submit" data-intent-trigger="newsletter.subscribe" class="bg-primary text-primary-foreground px-8 py-4 rounded-xl font-semibold whitespace-nowrap">Subscribe</button>
    </form>
  </div>
</section>`,
  },
  {
    slug: "booking-scheduler",
    name: "Book Now Scheduler",
    description: "Service selection and booking intent for appointment flows.",
    componentType: "booking-scheduler",
    category: "booking",
    targetType: "calendar",
    requiredBindingKeys: ["calendarId"],
    requiredBusinessFields: ["notificationEmail", "bookingOwner"],
    requiredSetupSteps: ["booking_calendar"],
    outputEvents: ["booking.requested", "booking.confirmed", "calendar.opened"],
    requiredCapabilities: ['booking'],
    catalogSurfaces: ['services', 'availability_slots'],
    writeIntent: 'booking.create',
    slotBindings: ['form-submit', 'primary-cta', 'card-cta'],
    htmlTemplate: `<section data-component="intent-booking" data-ut-component-slug="booking-scheduler" data-ut-component-category="booking" data-intent="booking.create" class="w-full max-w-lg mx-auto my-8">
  <div class="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-8 shadow-lg border border-primary/20">
    <div class="mb-6">
      <h3 class="text-xl font-bold text-foreground">Book Your Appointment</h3>
      <p class="text-sm text-muted-foreground">Choose a service and time that works for you.</p>
    </div>
    <form data-intent-form="booking.create" class="space-y-4">
      <select name="serviceId" required class="w-full px-4 py-3 bg-background border rounded-xl">
        <option value="">Loading services...</option>
      </select>
      <select name="slotId" required class="w-full px-4 py-3 bg-background border rounded-xl">
        <option value="">Loading availability...</option>
      </select>
      <input type="text" name="customerName" required placeholder="Full name" class="w-full px-4 py-3 bg-background border rounded-xl" />
      <input type="email" name="customerEmail" required placeholder="Email" class="w-full px-4 py-3 bg-background border rounded-xl" />
      <input type="tel" name="customerPhone" placeholder="Phone (optional)" class="w-full px-4 py-3 bg-background border rounded-xl" />
      <textarea name="notes" placeholder="Notes (optional)" class="w-full px-4 py-3 bg-background border rounded-xl"></textarea>
      <button type="submit" data-intent-trigger="booking.create" class="w-full bg-primary text-primary-foreground py-4 px-6 rounded-xl font-semibold">Confirm Booking</button>
    </form>
  </div>
</section>`,
  },
  {
    slug: "checkout-cta",
    name: "Checkout CTA",
    description: "Canonical purchase action wired to payment readiness.",
    componentType: "checkout-cta",
    category: "commerce",
    targetType: "checkout",
    requiredBindingKeys: ["productId"],
    requiredBusinessFields: ["paymentProvider"],
    requiredSetupSteps: ["payments"],
    outputEvents: ["checkout.started", "checkout.completed", "order.created"],
    requiredCapabilities: ['commerce'],
    catalogSurfaces: ['products'],
    writeIntent: 'pay.checkout',
    slotBindings: ['checkout-cta', 'card-cta'],
    htmlTemplate: `<section data-component="checkout-cta" data-ut-component-slug="checkout-cta" data-ut-component-category="commerce" data-intent="pay.checkout" class="w-full max-w-md mx-auto my-8 rounded-3xl border bg-card p-8 shadow-lg">
  <h3 class="text-2xl font-bold text-foreground mb-2">Ready to buy?</h3>
  <p class="text-muted-foreground mb-6">Launch checkout with your canonical product and pricing flow.</p>
  <button data-intent-trigger="pay.checkout" class="w-full bg-primary text-primary-foreground py-4 px-6 rounded-xl font-semibold">Start Checkout</button>
</section>`,
  },
  {
    slug: "chat-widget",
    name: "Chat Widget",
    description: "Persistent customer conversation entry point.",
    componentType: "chat-widget",
    category: "support",
    targetType: "chat",
    requiredBindingKeys: [],
    requiredBusinessFields: ["followUpChannel"],
    outputEvents: ["conversation.started", "message.received", "lead.created"],
    requiredCapabilities: [],
    slotBindings: ['icon-chat'],
    htmlTemplate: `<div data-component="chat-widget" data-ut-component-slug="chat-widget" data-ut-component-category="support" class="fixed bottom-6 right-6 z-50">
  <button class="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl">Chat</button>
</div>`,
  },
];

export const CANONICAL_COMPONENT_DEFINITIONS = registry;

export interface CanonicalComponentRegistryIssue {
  slug: string;
  message: string;
}

export function validateCanonicalComponentDefinition(
  definition: CanonicalComponentDefinition,
): CanonicalComponentRegistryIssue[] {
  const issues: CanonicalComponentRegistryIssue[] = [];
  const add = (message: string) => issues.push({ slug: definition.slug, message });
  const duplicateBindingKeys = definition.requiredBindingKeys.filter(
    (key, index) => definition.requiredBindingKeys.indexOf(key) !== index,
  );
  if (duplicateBindingKeys.length) add(`Duplicate required binding keys: ${duplicateBindingKeys.join(', ')}.`);
  if (!definition.requiredBindingKeys.every((key) => key.trim())) add('Required binding keys must be non-empty.');
  if (!definition.htmlTemplate.includes(`data-ut-component-slug="${definition.slug}"`)) {
    add('Template must declare its registered data-ut-component-slug.');
  }
  for (const capability of definition.requiredCapabilities) {
    try {
      getCapability(capability);
    } catch {
      add(`Unknown required capability: ${capability}.`);
    }
  }

  if (definition.writeIntent) {
    const intent = getIntentDef(definition.writeIntent);
    if (!intent) {
      add(`Unknown write intent: ${definition.writeIntent}.`);
    } else {
      const missingCapabilities = (intent.requiredCapabilities ?? [])
        .filter((capability) => !definition.requiredCapabilities.includes(capability));
      if (missingCapabilities.length) {
        add(`Write intent ${definition.writeIntent} requires capabilities not declared by the component: ${missingCapabilities.join(', ')}.`);
      }
    }
    if (definition.slotBindings.length === 0) add('A write component must declare at least one registered slot binding.');
    if (definition.targetType === 'form' || definition.targetType === 'calendar') {
      if (!new RegExp(`<form\\b[^>]*data-intent-form=["']${definition.writeIntent}["']`).test(definition.htmlTemplate)) {
        add(`Native form template must bind data-intent-form to ${definition.writeIntent}.`);
      }
    } else if (definition.targetType === 'checkout') {
      if (!definition.htmlTemplate.includes(`data-intent-trigger="${definition.writeIntent}"`)) {
        add(`Checkout template must bind data-intent-trigger to ${definition.writeIntent}.`);
      }
    }
  }

  return issues;
}

export function validateCanonicalComponentRegistry(
  definitions: readonly CanonicalComponentDefinition[] = registry,
): CanonicalComponentRegistryIssue[] {
  const issues = definitions.flatMap(validateCanonicalComponentDefinition);
  const seen = new Set<string>();
  for (const definition of definitions) {
    if (seen.has(definition.slug)) {
      issues.push({ slug: definition.slug, message: 'Component slugs must be unique.' });
    }
    seen.add(definition.slug);
  }
  return issues;
}

export function assertCanonicalComponentDefinition(definition: CanonicalComponentDefinition): void {
  const issues = validateCanonicalComponentDefinition(definition);
  if (issues.length) {
    throw new Error(`[canonicalComponentRegistry] Invalid ${definition.slug}: ${issues.map((issue) => issue.message).join(' ')}`);
  }
}

export const CANONICAL_COMPONENT_DEFINITIONS_BY_SLUG = Object.fromEntries(
  registry.map((definition) => [definition.slug, definition]),
) as Record<string, CanonicalComponentDefinition>;

export function getCanonicalComponentDefinition(slug: string) {
  return CANONICAL_COMPONENT_DEFINITIONS_BY_SLUG[slug] || null;
}

export function createCanonicalComponentInstance(
  slug: string,
  options: {
    label?: string;
    usedOnPages?: string[];
    bindings?: Record<string, string>;
    props?: Record<string, unknown>;
  } = {},
): CreatorComponentInstance | null {
  const definition = getCanonicalComponentDefinition(slug);
  if (!definition) return null;

  return {
    instanceId: `cmp_${nanoid(8)}`,
    componentType: definition.componentType,
    componentSlug: definition.slug,
    label: options.label || definition.name,
    category: definition.category,
    targetType: definition.targetType,
    bindings: options.bindings || {},
    props: options.props || {},
    usedOnPages: options.usedOnPages || [],
    requiredCapabilities: [...definition.requiredCapabilities],
    outputEvents: [...definition.outputEvents],
    status: "draft",
  };
}

export function inferCanonicalComponentSlug(rawComponentName: string) {
  const normalized = rawComponentName.trim().toLowerCase();
  const aliasMap: Record<string, string> = {
    "intent-contact-form": "contact-form",
    "contact-form": "contact-form",
    "intent-quote-form": "request-quote",
    "quote-form": "request-quote",
    "request-quote": "request-quote",
    "intent-newsletter": "newsletter-signup",
    "newsletter": "newsletter-signup",
    "intent-booking": "booking-scheduler",
    "booking-widget": "booking-scheduler",
    "booking-scheduler": "booking-scheduler",
    "checkout-cta": "checkout-cta",
    "payment-section": "checkout-cta",
    "shopping-cart": "checkout-cta",
    "chat-widget": "chat-widget",
  };

  return aliasMap[normalized] || null;
}
