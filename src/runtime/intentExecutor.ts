/**
 * Unified Intent Executor runtime
 * 
 * Every intent execution flows through this SINGLE entry point.
 * 
 * Features:
 * 1) Alias normalization - translates legacy intents to CORE_INTENTS
 * 2) UI directives - standardized results that control UI instantly
 * 3) Context hydration - auto-creates missing entities instead of failing
 * 4) Event emission - consistent events for automations
 * 5) Inngest integration - triggers durable workflows for automation intents
 * 6) Execution logging - records all intent executions for analytics
 * 
 * This replaces scattered handlers with ONE unified flow.
 */

import type { CoreIntent } from '@/platform/core/coreIntents';
import { emitIntentFailure } from './intentFailureBus';
import { 
  isNavIntent, 
  isPayIntent, 
  isActionIntent, 
  isAutomationIntent,
  isCoreIntent 
} from '@/platform/core/coreIntents';
import { normalizeIntent } from './intentAliases';
import { classifyIntent } from './intentClassifier';
import { logIntentExecution, createLogEntryFromResult } from '@/services/intentExecutionLogger';
import { lookupIntentBinding, recordBindingTriggered } from '@/services/intentBindingService';
import { extractGhlDirective, executeGhlDirective } from '@/services/ghlIntentBridge';
import { dispatchAutomation } from '@/services/automationOrchestrator';
import { logProjectGraphEvents } from '@/services/componentGraphPersistence';
import { resolveDeterministicOverlayId } from './deterministicIntentUi';

// ============ TYPES ============

/**
 * UI directive types for instant UI feedback
 */
export interface UIDirective {
  openModal?: string;
  openModalPayload?: Record<string, unknown>;
  closeModal?: string;
  navigate?: string;
  scrollTo?: string;
  setState?: Record<string, unknown>;
  addClass?: { selector: string; className: string };
  removeClass?: { selector: string; className: string };
  focus?: string;
}

/**
 * Toast notification directive
 */
export interface ToastDirective {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

/**
 * Missing fields directive - how we avoid configuration screens
 */
export interface MissingFieldsDirective {
  fields: string[];
  prompt: string;
  autoResolve?: boolean; // If true, runtime can auto-create defaults
}

/**
 * Event emission for automations
 */
export interface EmittedEvent {
  name: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

/**
 * Standardized result from EVERY intent handler
 * This is the key to instant UI response.
 */
export interface IntentResult {
  ok: boolean;
  data?: unknown;
  toast?: ToastDirective;
  ui?: UIDirective;
  missing?: MissingFieldsDirective;
  events?: EmittedEvent[];
  error?: { code: string; message: string };
  // For debugging
  _normalized?: string;
  _source?: string;
}

/**
 * Context passed to every intent handler
 */
export interface IntentContext {
  // Payload from the button/component
  payload?: Record<string, unknown>;
  
  // Business context (auto-hydrated if missing)
  businessId?: string;
  siteId?: string;
  userId?: string;
  sessionId?: string;
  
  // Communication defaults
  phone?: string;
  email?: string;
  
  // Runtime managers (injected by host)
  managers?: IntentManagers;
  
  // Source element (for extracting data attributes)
  element?: HTMLElement;
}

/**
 * Manager interfaces injected by the host application
 */
export interface IntentManagers {
  navigation?: {
    goto: (path: string, payload?: Record<string, unknown>) => void | Promise<void>;
    external: (url: string) => void;
    back: () => void;
    scrollTo: (anchor: string) => void;
  };
  overlay?: {
    open: (id: string, payload?: Record<string, unknown>) => void | Promise<void>;
    close: (id?: string) => void;
    isOpen: (id: string) => boolean;
  };
  toast?: {
    show: (toast: ToastDirective) => void;
  };
  cart?: {
    add: (item: CartItem) => Promise<{ cartId: string; itemCount: number }>;
    get: () => Promise<Cart | null>;
    update: (productId: string, quantity: number) => Promise<{ cartId: string; itemCount: number }>;
    remove: (productId: string) => Promise<{ cartId: string; itemCount: number }>;
    clear: () => Promise<{ cartId: string; itemCount: number }>;
    checkout: () => Promise<{ checkoutUrl: string }>;
  };
  auth?: {
    isAuthenticated: () => boolean;
    getCurrentUser: () => { id: string; email: string } | null;
    showLogin: () => void;
    showRegister: () => void;
  };
  crm?: {
    submitLead: (data: LeadData) => Promise<{ leadId: string; pipelineId: string }>;
    getPipeline: (id?: string) => Promise<Pipeline | null>;
    createDefaultPipeline: () => Promise<Pipeline>;
  };
  booking?: {
    createBooking: (data: BookingData) => Promise<{ bookingId: string }>;
    getServices: () => Promise<Service[]>;
    createDefaultService: () => Promise<Service>;
  };
  newsletter?: {
    subscribe: (email: string, lists?: string[]) => Promise<{ subscriptionId: string }>;
  };
  payments?: {
    createCheckout: (items: CartItem[], options?: CheckoutOptions) => Promise<{ url: string }>;
    isConfigured: () => boolean;
    showSetup: () => void;
  };
  events?: {
    emit: (event: EmittedEvent) => void;
    subscribe: (eventName: string, handler: (event: EmittedEvent) => void) => () => void;
  };
}

// Support types
export interface CartItem {
  productId: string;
  name?: string;
  price?: number;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

export interface Cart {
  id: string;
  items: CartItem[];
  total: number;
}

export interface LeadData {
  name?: string;
  email: string;
  phone?: string;
  message?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: { id: string; name: string }[];
}

export interface BookingData {
  serviceId?: string;
  datetime?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
}

export interface Service {
  id: string;
  name: string;
  duration: number;
  price?: number;
}

export interface CheckoutOptions {
  successUrl?: string;
  cancelUrl?: string;
  mode?: 'payment' | 'subscription';
  priceId?: string;
  plan?: string;
  billingCycle?: 'monthly' | 'yearly';
}

// ============ HANDLER REGISTRY ============

type IntentHandler = (ctx: IntentContext) => Promise<IntentResult> | IntentResult;

async function ensureCrmPipeline(managers?: IntentManagers) {
  let pipeline = await managers?.crm?.getPipeline();
  if (!pipeline) {
    pipeline = await managers?.crm?.createDefaultPipeline();
  }
  return pipeline;
}

const INTENT_HANDLERS: Record<CoreIntent, IntentHandler> = {
  // ============ NAVIGATION ============
  'nav.goto': async (ctx) => {
    const path = (ctx.payload?.path as string) || '/';
    ctx.managers?.navigation?.goto(path, ctx.payload);
    return {
      ok: true,
      ui: { navigate: path },
    };
  },

  'nav.external': async (ctx) => {
    const url = (ctx.payload?.url as string) || '';
    if (!url) {
      return { ok: false, error: { code: 'MISSING_URL', message: 'No URL provided' } };
    }
    ctx.managers?.navigation?.external(url);
    return { ok: true };
  },

  'nav.anchor': async (ctx) => {
    const anchor = (ctx.payload?.anchor as string) || '#';
    ctx.managers?.navigation?.scrollTo(anchor);
    return { ok: true, ui: { scrollTo: anchor } };
  },

  // ============ PREVIEW-SAFE UI BEHAVIOR ============
  'menu.open': async (ctx) => ({
    ok: true,
    ui: { openModal: 'mobile-menu', openModalPayload: ctx.payload as Record<string, unknown> },
    events: [{ name: 'menu.opened', payload: ctx.payload || {}, timestamp: Date.now() }],
  }),

  'search.open': async (ctx) => ({
    ok: true,
    ui: { openModal: 'search', openModalPayload: ctx.payload as Record<string, unknown> },
    events: [{ name: 'search.opened', payload: ctx.payload || {}, timestamp: Date.now() }],
  }),

  'filter.open': async (ctx) => ({
    ok: true,
    ui: { openModal: 'filter', openModalPayload: ctx.payload as Record<string, unknown> },
    events: [{ name: 'filter.opened', payload: ctx.payload || {}, timestamp: Date.now() }],
  }),

  'sort.open': async (ctx) => ({
    ok: true,
    ui: { openModal: 'sort', openModalPayload: ctx.payload as Record<string, unknown> },
    events: [{ name: 'sort.opened', payload: ctx.payload || {}, timestamp: Date.now() }],
  }),

  'share.open': async (ctx) => {
    const sharePayload = {
      title: ctx.payload?.title as string | undefined,
      text: ctx.payload?.text as string | undefined,
      url: (ctx.payload?.url as string | undefined) || (typeof window !== 'undefined' ? window.location.href : undefined),
    };
    if (typeof navigator !== 'undefined' && navigator.share && sharePayload.url) {
      await navigator.share(sharePayload).catch(() => undefined);
    }
    return {
      ok: true,
      ui: { openModal: 'share', openModalPayload: sharePayload },
      events: [{ name: 'share.opened', payload: sharePayload, timestamp: Date.now() }],
    };
  },

  'favorite.toggle': async (ctx) => ({
    ok: true,
    data: { productId: ctx.payload?.productId, favorite: true },
    toast: { type: 'success', message: 'Saved' },
    events: [{ name: 'favorite.toggled', payload: ctx.payload || {}, timestamp: Date.now() }],
  }),

  'chat.open': async (ctx) => ({
    ok: true,
    ui: { openModal: 'chat', openModalPayload: ctx.payload as Record<string, unknown> },
    events: [{ name: 'chat.opened', payload: ctx.payload || {}, timestamp: Date.now() }],
  }),

  'contact.call': async (ctx) => {
    const phone = (ctx.payload?.phone as string) || (ctx.payload?.phoneNumber as string) || '';
    if (phone && typeof window !== 'undefined') window.location.href = `tel:${phone}`;
    return { ok: true, events: [{ name: 'contact.call', payload: { phone }, timestamp: Date.now() }] };
  },

  'contact.email': async (ctx) => {
    const email = (ctx.payload?.email as string) || '';
    if (email && typeof window !== 'undefined') window.location.href = `mailto:${email}`;
    return { ok: true, events: [{ name: 'contact.email', payload: { email }, timestamp: Date.now() }] };
  },

  'contact.sms': async (ctx) => {
    const phone = (ctx.payload?.phone as string) || (ctx.payload?.phoneNumber as string) || '';
    if (phone && typeof window !== 'undefined') window.location.href = `sms:${phone}`;
    return { ok: true, events: [{ name: 'contact.sms', payload: { phone }, timestamp: Date.now() }] };
  },

  'location.directions': async (ctx) => {
    const address = (ctx.payload?.address as string) || (ctx.payload?.location as string) || '';
    const url = (ctx.payload?.url as string) || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '');
    if (url && typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
    return { ok: true, events: [{ name: 'location.directions', payload: { address, url }, timestamp: Date.now() }] };
  },

  // ============ PAYMENT ============
  'pay.checkout': async (ctx) => {
    const managers = ctx.managers;
    
    // Context hydration: check if payments configured
    if (!managers?.payments?.isConfigured()) {
      // Auto-show setup instead of failing
      managers?.payments?.showSetup();
      return {
        ok: false,
        missing: {
          fields: ['stripeKey'],
          prompt: 'Connect your payment processor to accept payments',
          autoResolve: false,
        },
        ui: { openModal: 'payments-setup' },
        toast: { type: 'info', message: 'Let\'s connect your payment processor' },
      };
    }

    // Get cart items if not provided
    let items = ctx.payload?.items as CartItem[] | undefined;
    if (!items) {
      const cart = await managers?.cart?.get();
      items = cart?.items;
    }

    const explicitCheckoutTarget =
      typeof ctx.payload?.priceId === 'string' ||
      typeof ctx.payload?.plan === 'string';

    if ((!items || items.length === 0) && !explicitCheckoutTarget) {
      return {
        ok: false,
        error: { code: 'EMPTY_CART', message: 'Cart is empty' },
        toast: { type: 'error', message: 'Your cart is empty' },
      };
    }

    const result = await managers.payments.createCheckout(items || [], {
      successUrl: ctx.payload?.successUrl as string,
      cancelUrl: ctx.payload?.cancelUrl as string,
      priceId: ctx.payload?.priceId as string | undefined,
      plan: ctx.payload?.plan as string | undefined,
      billingCycle: ctx.payload?.billingCycle as 'monthly' | 'yearly' | undefined,
    });

    return {
      ok: true,
      data: result,
      ui: { navigate: result.url },
      events: [{ name: 'checkout.started', payload: { items: items?.length ?? 0 }, timestamp: Date.now() }],
    };
  },

  'pay.success': async (ctx) => {
    return {
      ok: true,
      toast: { type: 'success', message: 'Payment successful!' },
      events: [{ name: 'order.created', payload: ctx.payload || {}, timestamp: Date.now() }],
      ui: { openModal: 'order-confirmation' },
    };
  },

  'pay.cancel': async (ctx) => {
    return {
      ok: true,
      toast: { type: 'info', message: 'Payment cancelled' },
      ui: { navigate: '/cart' },
    };
  },

  // ============ CONTACT/LEAD ============
  'contact.submit': async (ctx) => {
    const managers = ctx.managers;
    const payload = ctx.payload || {};
    
    // Validate required fields
    const email = payload.email as string;
    if (!email) {
      const overlayId = resolveDeterministicOverlayId('contact.submit') || 'contact';
      return {
        ok: true,
        ui: {
          openModal: overlayId,
          openModalPayload: {
            source: payload.source || 'website',
            headline: payload.headline,
          },
        },
      };
    }

    // Context hydration: ensure pipeline exists
    const pipeline = await ensureCrmPipeline(managers);

    const result = await managers?.crm?.submitLead({
      name: payload.name as string,
      email,
      phone: payload.phone as string,
      message: payload.message as string,
      source: payload.source as string || 'website',
      metadata: { pipelineId: pipeline?.id },
    });

    return {
      ok: true,
      data: result,
      toast: { type: 'success', message: 'Message sent successfully!' },
      ui: { closeModal: 'contact' },
      events: [{ name: 'lead.submitted', payload: { leadId: result?.leadId, pipelineId: pipeline?.id }, timestamp: Date.now() }],
    };
  },

  'newsletter.subscribe': async (ctx) => {
    const email = ctx.payload?.email as string;
    if (!email) {
      const overlayId = resolveDeterministicOverlayId('newsletter.subscribe') || 'newsletter';
      return {
        ok: true,
        ui: {
          openModal: overlayId,
          openModalPayload: {
            source: ctx.payload?.source || 'newsletter',
            lists: ctx.payload?.lists,
          },
        },
      };
    }

    const result = await ctx.managers?.newsletter?.subscribe(email, ctx.payload?.lists as string[]);
    
    return {
      ok: true,
      data: result,
      toast: { type: 'success', message: 'You\'re subscribed!' },
      events: [{ name: 'newsletter.subscribed', payload: { email }, timestamp: Date.now() }],
    };
  },

  'booking.create': async (ctx) => {
    const managers = ctx.managers;
    const payload = ctx.payload || {};

    // Context hydration: ensure services exist
    let services = await managers?.booking?.getServices();
    if (!services || services.length === 0) {
      console.log('[IntentExecutor] No services found, creating default...');
      const defaultService = await managers?.booking?.createDefaultService();
      services = defaultService ? [defaultService] : [];
    }

    // If no service selected, open booking modal with service selection
    if (!payload.serviceId && services.length > 0) {
      const overlayId = resolveDeterministicOverlayId('booking.create') || 'booking';
      return {
        ok: true,
        ui: { openModal: overlayId },
        data: { services, step: 'select-service' },
      };
    }

    // Create the booking
    const result = await managers?.booking?.createBooking({
      serviceId: payload.serviceId as string || services[0]?.id,
      datetime: payload.datetime as string,
      customerName: payload.customerName as string,
      customerEmail: payload.customerEmail as string,
      customerPhone: payload.customerPhone as string,
      notes: payload.notes as string,
    });

    return {
      ok: true,
      data: result,
      toast: { type: 'success', message: 'Booking confirmed!' },
      ui: {
        closeModal: resolveDeterministicOverlayId('booking.create') || 'booking',
        openModal: 'booking-confirmation',
      },
      events: [{ name: 'booking.requested', payload: { bookingId: result?.bookingId }, timestamp: Date.now() }],
    };
  },

  'quote.request': async (ctx) => {
    const payload = ctx.payload || {};
    const email = payload.email as string | undefined;
    const name = payload.name as string | undefined;

    if (!email || !name) {
      const overlayId = resolveDeterministicOverlayId('quote.request') || 'quote';
      return {
        ok: true,
        ui: {
          openModal: overlayId,
          openModalPayload: {
            service: payload.service,
            source: payload.source || 'quote_request',
          },
        },
      };
    }

    const pipeline = await ensureCrmPipeline(ctx.managers);
    const result = await ctx.managers?.crm?.submitLead({
      name,
      email,
      phone: payload.phone as string | undefined,
      message: (payload.message as string) || (payload.description as string) || (payload.details as string),
      source: (payload.source as string) || 'quote_request',
      metadata: {
        pipelineId: pipeline?.id,
        service: payload.service,
        budget: payload.budget,
        timeline: payload.timeline,
      },
    });

    return {
      ok: true,
      data: result,
      toast: { type: 'success', message: 'Quote request submitted!' },
      ui: { closeModal: resolveDeterministicOverlayId('quote.request') || 'quote' },
      events: [{
        name: 'quote.requested',
        payload: { leadId: result?.leadId, pipelineId: pipeline?.id },
        timestamp: Date.now(),
      }],
    };
  },

  'lead.capture': async (ctx) => {
    // Alias to contact.submit with lead-specific metadata
    const result = await INTENT_HANDLERS['contact.submit']({
      ...ctx,
      payload: { ...ctx.payload, source: 'lead_capture' },
    });
    return {
      ...result,
      events: [{ name: 'lead.captured', payload: ctx.payload || {}, timestamp: Date.now() }],
    };
  },

  'demo.request': async (ctx) => INTENT_HANDLERS['lead.capture']({
    ...ctx,
    payload: { ...ctx.payload, source: 'demo_request' },
  }),

  'consultation.request': async (ctx) => INTENT_HANDLERS['lead.capture']({
    ...ctx,
    payload: { ...ctx.payload, source: 'consultation_request' },
  }),

  'proposal.request': async (ctx) => INTENT_HANDLERS['quote.request']({
    ...ctx,
    payload: { ...ctx.payload, source: 'proposal_request' },
  }),

  'coupon.claim': async (ctx) => INTENT_HANDLERS['newsletter.subscribe']({
    ...ctx,
    payload: { ...ctx.payload, source: 'coupon_claim' },
  }),

  'content.download': async (ctx) => {
    const payload = ctx.payload ?? {};
    const url = String(payload.url || payload.downloadUrl || ctx.element?.getAttribute('href') || '').trim();
    if (!url) {
      return {
        ok: false,
        missing: { fields: ['url'], prompt: 'Attach a document before enabling this download.' },
        error: { code: 'MISSING_DOWNLOAD_URL', message: 'No downloadable document is attached.' },
      };
    }
    const isRelative = url.startsWith('/') && !url.startsWith('//');
    let allowed = isRelative;
    if (!allowed) {
      try {
        allowed = ['https:', 'http:', 'blob:'].includes(new URL(url, typeof window !== 'undefined' ? window.location.href : undefined).protocol);
      } catch {
        allowed = false;
      }
    }
    if (!allowed) {
      return { ok: false, error: { code: 'INVALID_DOWNLOAD_URL', message: 'The document URL is not allowed.' } };
    }
    const rawName = String(payload.filename || payload.fileName || ctx.element?.getAttribute('download') || 'download');
    const filename = rawName.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'download';
    if (typeof document !== 'undefined') {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    return {
      ok: true,
      data: { url, filename, mimeType: payload.mimeType || null },
      events: [{ name: 'content.downloaded', payload: { ...payload, url, filename }, timestamp: Date.now() }],
    };
  },

  'volunteer.signup': async (ctx) => INTENT_HANDLERS['lead.capture']({
    ...ctx,
    payload: { ...ctx.payload, source: 'volunteer_signup' },
  }),

  // ============ CART ============
  'product.view': async (ctx) => {
    const productId = (ctx.payload?.productId as string) || ctx.element?.dataset.productId;
    const path = (ctx.payload?.path as string) || (productId ? `/product/${productId}` : '/shop');
    ctx.managers?.navigation?.goto(path, ctx.payload);
    return { ok: true, ui: { navigate: path } };
  },

  'cart.add': async (ctx) => {
    const managers = ctx.managers;
    const payload = ctx.payload || {};
    const element = ctx.element;

    // Extract product data from payload or element
    const productId = (payload.productId as string) || element?.dataset.productId;
    const productName = (payload.productName as string) || element?.dataset.productName;
    const price = (payload.price as number) || parseFloat(element?.dataset.price || '0');
    const quantity = (payload.quantity as number) || 1;

    if (!productId) {
      return {
        ok: false,
        missing: { fields: ['productId'], prompt: 'Product not found' },
        toast: { type: 'error', message: 'Unable to add item to cart' },
      };
    }

    const result = await managers?.cart?.add({
      productId,
      name: productName,
      price,
      quantity,
    });

    return {
      ok: true,
      data: result,
      toast: { type: 'success', message: `${productName || 'Item'} added to cart` },
      ui: {
        openModal: 'cart',
        openModalPayload: {
          cart: await managers?.cart?.get(),
          step: 'cart',
          lastAddedProductId: productId,
        },
      },
      events: [{ name: 'cart.item_added', payload: { productId, quantity }, timestamp: Date.now() }],
    };
  },

  'cart.view': async (ctx) => {
    const cart = await ctx.managers?.cart?.get();

    return {
      ok: true,
      data: cart,
      ui: {
        openModal: 'cart',
        openModalPayload: {
          cart,
          step: (ctx.payload?.step as string) || 'cart',
        },
      },
    };
  },

  'cart.update': async (ctx) => {
    const productId = (ctx.payload?.productId as string) || ctx.element?.dataset.productId;
    const quantity = Number(ctx.payload?.quantity ?? ctx.element?.dataset.quantity ?? 1);
    if (!productId) {
      return { ok: false, error: { code: 'MISSING_PRODUCT', message: 'Product not found' } };
    }
    const result = await ctx.managers?.cart?.update(productId, quantity);
    return {
      ok: true,
      data: result,
      events: [{ name: 'cart.item_updated', payload: { productId, quantity }, timestamp: Date.now() }],
    };
  },

  'cart.remove': async (ctx) => {
    const productId = (ctx.payload?.productId as string) || ctx.element?.dataset.productId;
    if (!productId) {
      return { ok: false, error: { code: 'MISSING_PRODUCT', message: 'Product not found' } };
    }
    const result = await ctx.managers?.cart?.remove(productId);
    return {
      ok: true,
      data: result,
      toast: { type: 'info', message: 'Item removed' },
      events: [{ name: 'cart.item_removed', payload: { productId }, timestamp: Date.now() }],
    };
  },

  'cart.checkout': async (ctx) => {
    // Redirect to checkout flow
    const cart = await ctx.managers?.cart?.get();
    
    if (!cart || cart.items.length === 0) {
      return {
        ok: false,
        toast: { type: 'error', message: 'Your cart is empty' },
      };
    }

    // Trigger the payment checkout
    return INTENT_HANDLERS['pay.checkout'](ctx);
  },

  'donation.start': async (ctx) => INTENT_HANDLERS['pay.checkout']({
    ...ctx,
    payload: { ...ctx.payload, donationType: ctx.payload?.donationType || 'one-time' },
  }),

  'cart.abandoned': async (ctx) => {
    // Emits event for automation
    return {
      ok: true,
      events: [{ name: 'cart.abandoned', payload: ctx.payload || {}, timestamp: Date.now() }],
    };
  },

  // ============ AUTH ============
  'auth.login': async (ctx) => {
    const managers = ctx.managers;
    
    if (managers?.auth?.isAuthenticated()) {
      return {
        ok: true,
        toast: { type: 'info', message: 'You\'re already signed in' },
      };
    }

    managers?.auth?.showLogin();
    const overlayId = resolveDeterministicOverlayId('auth.login') || 'auth-login';
    return {
      ok: true,
      ui: { openModal: overlayId },
    };
  },

  'auth.register': async (ctx) => {
    const managers = ctx.managers;
    
    if (managers?.auth?.isAuthenticated()) {
      return {
        ok: true,
        toast: { type: 'info', message: 'You\'re already signed in' },
      };
    }

    managers?.auth?.showRegister();
    const overlayId = resolveDeterministicOverlayId('auth.register') || 'auth-register';
    return {
      ok: true,
      ui: { openModal: overlayId },
    };
  },

  'auth.logout': async () => ({
    ok: true,
    toast: { type: 'info', message: 'Signed out' },
    events: [{ name: 'auth.logout', payload: {}, timestamp: Date.now() }],
  }),

  'account.open': async (ctx) => {
    if (ctx.managers?.auth?.isAuthenticated()) {
      return {
        ok: true,
        ui: { openModal: 'account-menu' },
      };
    }
    return INTENT_HANDLERS['auth.login'](ctx);
  },

  // ============ GENERIC BUTTON/FORM ============
  'button.click': async (ctx) => {
    // Generic button handler - checks for special data attributes
    const element = ctx.element;
    const payload = ctx.payload || {};

    // Handle tel: links
    const href = element?.getAttribute('href');
    if (href?.startsWith('tel:')) {
      window.location.href = href;
      return { ok: true };
    }

    // Handle mailto: links
    if (href?.startsWith('mailto:')) {
      window.location.href = href;
      return { ok: true };
    }

    // Emit generic event
    return {
      ok: true,
      events: [{ name: 'button.clicked', payload, timestamp: Date.now() }],
    };
  },

  'form.submit': async (ctx) => {
    // Generic form submit - route based on form type
    const formType = ctx.payload?.formType || ctx.element?.closest('form')?.dataset.formType;
    
    if (formType === 'contact' || formType === 'lead') {
      return INTENT_HANDLERS['contact.submit'](ctx);
    }
    if (formType === 'booking') {
      return INTENT_HANDLERS['booking.create'](ctx);
    }
    if (formType === 'newsletter') {
      return INTENT_HANDLERS['newsletter.subscribe'](ctx);
    }
    if (formType === 'quote') {
      return INTENT_HANDLERS['quote.request'](ctx);
    }

    // Default: treat as lead capture
    return INTENT_HANDLERS['contact.submit'](ctx);
  },

  // ============ AUTOMATION EVENTS ============
  // These are primarily event emitters for the automation system

  'booking.confirmed': async (ctx) => ({
    ok: true,
    events: [{ name: 'booking.confirmed', payload: ctx.payload || {}, timestamp: Date.now() }],
  }),

  'booking.reminder': async (ctx) => ({
    ok: true,
    events: [{ name: 'booking.reminder', payload: ctx.payload || {}, timestamp: Date.now() }],
  }),

  'booking.cancelled': async (ctx) => ({
    ok: true,
    events: [{ name: 'booking.cancelled', payload: ctx.payload || {}, timestamp: Date.now() }],
  }),

  'booking.noshow': async (ctx) => ({
    ok: true,
    events: [{ name: 'booking.noshow', payload: ctx.payload || {}, timestamp: Date.now() }],
  }),

  'order.created': async (ctx) => ({
    ok: true,
    events: [{ name: 'order.created', payload: ctx.payload || {}, timestamp: Date.now() }],
  }),

  'order.shipped': async (ctx) => ({
    ok: true,
    events: [{ name: 'order.shipped', payload: ctx.payload || {}, timestamp: Date.now() }],
  }),

  'order.delivered': async (ctx) => ({
    ok: true,
    events: [{ name: 'order.delivered', payload: ctx.payload || {}, timestamp: Date.now() }],
  }),

  'deal.won': async (ctx) => ({
    ok: true,
    events: [{ name: 'deal.won', payload: ctx.payload || {}, timestamp: Date.now() }],
  }),

  'deal.lost': async (ctx) => ({
    ok: true,
    events: [{ name: 'deal.lost', payload: ctx.payload || {}, timestamp: Date.now() }],
  }),

  'proposal.sent': async (ctx) => ({
    ok: true,
    events: [{ name: 'proposal.sent', payload: ctx.payload || {}, timestamp: Date.now() }],
  }),

  'job.completed': async (ctx) => ({
    ok: true,
    events: [{ name: 'job.completed', payload: ctx.payload || {}, timestamp: Date.now() }],
  }),
};

// ============ MAIN EXECUTOR ============

// Global managers (configured by host)
let globalManagers: IntentManagers = {};

/**
 * Configure global managers for the executor
 */
export function configureIntentExecutor(managers: IntentManagers): void {
  globalManagers = { ...globalManagers, ...managers };
}

/**
 * Execute an intent with full normalization, hydration, and UI directives
 * 
 * This is THE entry point for all intent execution.
 * Now includes:
 * - Inngest workflow triggering for automation intents
 * - Execution logging for analytics and debugging
 * - Intent binding lookup for project-specific workflows
 */
export async function executeIntent(
  rawIntent: string,
  ctx: IntentContext = {}
): Promise<IntentResult> {
  const startTime = Date.now();
  const workflowsTriggered: string[] = [];
  const recipesTriggered: string[] = [];

  // Step 1: Normalize intent via aliases
  const normalized = normalizeIntent(rawIntent);
  console.log(`[IntentExecutor] Executing: "${rawIntent}" → "${normalized}"`);

  // Step 2: Merge managers
  const mergedCtx: IntentContext = {
    ...ctx,
    managers: { ...globalManagers, ...ctx.managers },
  };

  // Step 3: Look up intent binding if we have project context
  let bindingId: string | undefined;
  let bindingPayloadSchema: Record<string, unknown> | undefined;
  if (ctx.siteId && ctx.payload?.elementKey) {
    try {
      const bindingResult = await lookupIntentBinding(
        ctx.siteId,
        (ctx.payload?.pagePath as string) || '/',
        ctx.payload.elementKey as string
      );
      if (bindingResult.binding) {
        bindingId = bindingResult.binding.id;
        bindingPayloadSchema = bindingResult.binding.payloadSchema;
        if (bindingResult.workflow) {
          workflowsTriggered.push(bindingResult.workflow.id);
        }
        if (bindingResult.recipes.length > 0) {
          recipesTriggered.push(...bindingResult.recipes.map(r => r.id));
        }
      }
    } catch (err) {
      console.warn('[IntentExecutor] Binding lookup failed:', err);
    }
  }

  // Step 4: Find handler
  const handler = INTENT_HANDLERS[normalized as CoreIntent];
  
  if (!handler) {
    console.warn(`[IntentExecutor] No handler for: ${normalized}`);
    const error = { code: 'UNKNOWN_INTENT', message: `Unknown intent: ${normalized}` };
    emitIntentFailure({
      intent: rawIntent,
      normalizedIntent: normalized,
      error,
      payload: (ctx.payload ?? {}) as Record<string, unknown>,
      source: 'executor',
    });

    // Log failed execution
    if (ctx.businessId) {
      logIntentExecution({
        businessId: ctx.businessId,
        projectId: ctx.siteId,
        bindingId,
        intent: normalized,
        payload: (ctx.payload ?? {}) as Record<string, unknown>,
        source: 'direct',
        resultStatus: 'error',
        errorMessage: error.message,
        executionTimeMs: Date.now() - startTime,
      }).catch(() => {});
    }

    return {
      ok: false,
      error,
      _normalized: normalized,
      _source: 'executor',
    };
  }

  // Step 5: Execute with error handling
  try {
    const result = await handler(mergedCtx);
    
    // Step 6: Process UI directives
    if (result.ui && mergedCtx.managers) {
      processUIDirectives(result.ui, mergedCtx.managers);
    }

    // Step 7: Show toast
    if (result.toast && mergedCtx.managers?.toast) {
      mergedCtx.managers.toast.show(result.toast);
    }

    // Step 8: Emit events locally
    if (result.events && mergedCtx.managers?.events) {
      for (const event of result.events) {
        mergedCtx.managers.events.emit(event);
      }
    }

    if (result.events?.length && ctx.siteId) {
      logProjectGraphEvents({
        projectId: ctx.siteId,
        events: result.events.map((event) => ({ name: event.name, payload: event.payload })),
        payload: (ctx.payload ?? {}) as Record<string, unknown>,
        componentInstanceId:
          typeof ctx.payload?.componentInstanceId === 'string'
            ? ctx.payload.componentInstanceId
            : null,
        pageId:
          typeof ctx.payload?.pagePath === 'string'
            ? ctx.payload.pagePath
            : null,
        source: ctx.businessId ? 'runtime' : 'preview',
      }).catch(() => {});
    }

    // Step 9: Dispatch automation via orchestrator (recipe matching + Inngest)
    // ONLY for 'automatable' lane — backend intents (auth, pay, cart.checkout)
    // must NEVER enter the automation pipeline.
    const { lane } = classifyIntent(normalized);
    if (result.ok && ctx.businessId && lane === 'automatable') {
      const dispatch = await dispatchAutomation(normalized, ctx, result);
      if (dispatch.dispatched) {
        console.log(`[IntentExecutor] Automation dispatched: ${dispatch.eventName}, ${dispatch.recipesMatched} recipes matched`);
      }
    }

    // Step 10: Record binding trigger
    if (bindingId) {
      recordBindingTriggered(bindingId).catch(() => {});

      // Step 10b: GHL bridge — fire any GoHighLevel directive declared on the binding.
      // Non-blocking: failures are logged but never fail the intent.
      if (result.ok && bindingPayloadSchema) {
        const directive = extractGhlDirective(
          bindingPayloadSchema,
          (ctx.payload ?? {}) as Record<string, unknown>,
        );
        if (directive) {
          executeGhlDirective(directive)
            .then((r) => {
              if (r.ok) {
                console.log(`[IntentExecutor] GHL ${r.action} fired for binding ${bindingId}`);
                workflowsTriggered.push(`ghl:${r.action}`);
              } else {
                console.warn(`[IntentExecutor] GHL ${r.action} failed:`, r.error);
              }
            })
            .catch(() => {});
        }
      }
    }

    // Step 11: Log execution
    if (ctx.businessId) {
      logIntentExecution(createLogEntryFromResult(normalized, result, {
        businessId: ctx.businessId,
        projectId: ctx.siteId,
        bindingId,
        payload: (ctx.payload ?? {}) as Record<string, unknown>,
        source: 'direct',
        startTime,
        workflowsTriggered,
        recipesTriggered,
      })).catch(() => {});
    }

    return {
      ...result,
      _normalized: normalized,
      _source: 'executor',
    };
  } catch (error) {
    console.error(`[IntentExecutor] Error executing ${normalized}:`, error);
    const errObj = { code: 'EXECUTION_ERROR', message: (error as Error).message };
    emitIntentFailure({
      intent: rawIntent,
      normalizedIntent: normalized,
      error: errObj,
      payload: (ctx.payload ?? {}) as Record<string, unknown>,
      source: 'executor',
    });

    // Log failed execution
    if (ctx.businessId) {
      logIntentExecution({
        businessId: ctx.businessId,
        projectId: ctx.siteId,
        bindingId,
        intent: normalized,
        payload: (ctx.payload ?? {}) as Record<string, unknown>,
        source: 'direct',
        resultStatus: 'error',
        errorMessage: errObj.message,
        executionTimeMs: Date.now() - startTime,
      }).catch(() => {});
    }

    return {
      ok: false,
      error: errObj,
      toast: { type: 'error', message: 'Something went wrong. Please try again.' },
      _normalized: normalized,
      _source: 'executor',
    };
  }
}

/**
 * Process UI directives using managers
 */
function processUIDirectives(ui: UIDirective, managers: IntentManagers): void {
  if (ui.openModal && managers.overlay) {
    managers.overlay.open(ui.openModal, ui.openModalPayload);
  }
  if (ui.closeModal && managers.overlay) {
    managers.overlay.close(ui.closeModal);
  }
  if (ui.navigate && managers.navigation) {
    managers.navigation.goto(ui.navigate);
  }
  if (ui.scrollTo && managers.navigation) {
    managers.navigation.scrollTo(ui.scrollTo);
  }
  if (ui.focus) {
    const el = document.querySelector(ui.focus) as HTMLElement;
    el?.focus();
  }
}

/**
 * Check if we have a handler for an intent (after normalization)
 */
export function canHandleIntent(rawIntent: string): boolean {
  const normalized = normalizeIntent(rawIntent);
  return normalized in INTENT_HANDLERS;
}

/**
 * Get all supported intents
 */
export function getSupportedIntents(): string[] {
  return Object.keys(INTENT_HANDLERS);
}

// ============ INNGEST INTEGRATION ============
// Automation dispatch is now handled by automationOrchestrator.ts
// which provides: unified event mapping, recipe matching, and Inngest dispatch.
// See: src/services/automationOrchestrator.ts
