import { agentOperations } from '@/services/agent-runtime/operations';
/**
 * CRM Managers Implementation
 * 
 * Provides the IntentManagers implementation for CRM operations.
 * Connects the Intent Executor to Supabase for data persistence
 * and Inngest for workflow automation.
 */

import { supabase as supabaseClient } from '@/integrations/supabase/client';
import { applyResourceOp } from '@/services/resources/resourceRuntime';
import type { 
  IntentManagers, 
  LeadData, 
  Pipeline, 
  BookingData, 
  Service,
  CartItem,
  Cart,
  CheckoutOptions
} from '@/runtime/intentExecutor';
import { createCheckoutSession, resolveCheckoutSessionBody } from '@/runtime/checkoutClient';
import { setupEventBridge, type EventBridgeContext } from './inngest-event-bridge';

// ============ SUPABASE CLIENT ============

const supabase = supabaseClient;

// ============ STORAGE ============

// In-memory cart storage (in production, use Supabase or localStorage)
const cartStorage = new Map<string, Cart>();

function getOrCreateCart(sessionId: string): Cart {
  if (!cartStorage.has(sessionId)) {
    cartStorage.set(sessionId, {
      id: `cart_${sessionId}`,
      items: [],
      total: 0,
    });
  }
  return cartStorage.get(sessionId)!;
}

// ============ CRM MANAGER ============

function createCRMManager(businessId: string): IntentManagers['crm'] {
  return {
    submitLead: async (data: LeadData) => {
      console.log('[CRM] Submitting lead:', data);
      if (!supabase) throw new Error('CRM lead storage is unavailable.');
      const lead = await applyResourceOp({
        op: 'create',
        resourceKey: 'crm:leads',
        values: {
          title: data.name || data.email || 'New lead',
          email: data.email,
          phone: data.phone,
          source: data.source || 'website',
          notes: data.message,
        },
      }, { businessId, mode: 'cloud' });
      return { leadId: lead?.id ?? '', pipelineId: '' };
    },

    getPipeline: async (id?: string) => {
      console.log('[CRM] Getting pipeline:', id);
      
      if (supabase) {
        const query = supabase
          .from('crm_pipelines')
          .select('*, stages:crm_stages(*)')
          .eq('business_id', businessId);
        
        if (id) {
          query.eq('id', id);
        }
        
        const { data: pipelines } = await query.limit(1);
        
        if (pipelines && pipelines.length > 0) {
          const p = pipelines[0];
          return {
            id: p.id,
            name: p.name,
            stages: p.stages?.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })) || [],
          };
        }
      }

      return null;
    },

    createDefaultPipeline: async () => {
      console.log('[CRM] Creating default pipeline');
      
      const defaultPipeline: Pipeline = {
        id: `pipeline_${Date.now()}`,
        name: 'Default Pipeline',
        stages: [
          { id: 'new', name: 'New' },
          { id: 'contacted', name: 'Contacted' },
          { id: 'qualified', name: 'Qualified' },
          { id: 'proposal', name: 'Proposal' },
          { id: 'negotiation', name: 'Negotiation' },
          { id: 'closed_won', name: 'Closed Won' },
          { id: 'closed_lost', name: 'Closed Lost' },
        ],
      };

      return defaultPipeline;
    },
  };
}

// ============ BOOKING MANAGER ============

function createBookingManager(businessId: string): IntentManagers['booking'] {
  return {
    createBooking: async (_data: BookingData) => {
      throw new Error('Booking writes require the generated site-runtime adapter.');
    },

    getServices: async () => {
      console.log('[Booking] Getting services');
      
      if (supabase) {
        const { data: services } = await supabase
          .from('services')
          .select('*')
          .eq('business_id', businessId)
          .eq('is_active', true);

        if (services && services.length > 0) {
          return services.map((s) => ({
            id: s.id,
            name: s.name,
            duration: s.duration_minutes || 60,
            price: s.price_cents ? s.price_cents / 100 : 0,
          }));
        }
      }

      return [];
    },

    createDefaultService: async () => {
      console.log('[Booking] Creating default service');
      
      const defaultService: Service = {
        id: `service_${Date.now()}`,
        name: 'General Appointment',
        duration: 60,
        price: 0,
      };

      try {
        const item = await agentOperations.create_catalog_item({ files: {}, businessId }, 'services', {
          name: defaultService.name, price: 0, active: true, duration_minutes: defaultService.duration,
        });
        return { ...defaultService, id: item.id };
      } catch { /* fall back to a local default */ }

      return defaultService;
    },
  };
}

// ============ CART MANAGER ============

function createCartManager(sessionId: string): IntentManagers['cart'] {
  return {
    add: async (item: CartItem) => {
      const cart = getOrCreateCart(sessionId);
      
      // Check if item exists
      const existingIndex = cart.items.findIndex(i => i.productId === item.productId);
      if (existingIndex >= 0) {
        cart.items[existingIndex].quantity = (cart.items[existingIndex].quantity || 1) + (item.quantity || 1);
      } else {
        cart.items.push(item);
      }
      
      // Recalculate total
      cart.total = cart.items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
      
      return { cartId: cart.id, itemCount: cart.items.length };
    },

    get: async () => {
      return cartStorage.get(sessionId) || null;
    },

    update: async (productId, quantity) => {
      const cart = getOrCreateCart(sessionId);
      if (quantity <= 0) {
        cart.items = cart.items.filter((item) => item.productId !== productId);
      } else {
        cart.items = cart.items.map((item) =>
          item.productId === productId
            ? { ...item, quantity }
            : item,
        );
      }
      cart.total = cart.items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
      return { cartId: cart.id, itemCount: cart.items.length };
    },

    remove: async (productId) => {
      const cart = getOrCreateCart(sessionId);
      cart.items = cart.items.filter((item) => item.productId !== productId);
      cart.total = cart.items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
      return { cartId: cart.id, itemCount: cart.items.length };
    },

    clear: async () => {
      const cart = getOrCreateCart(sessionId);
      cart.items = [];
      cart.total = 0;
      return { cartId: cart.id, itemCount: 0 };
    },

    checkout: async () => {
      const cart = getOrCreateCart(sessionId);
      const checkoutBody = resolveCheckoutSessionBody({
        items: cart.items,
      });

      if (!checkoutBody) {
        throw new Error('Cart checkout requires a Stripe price mapping');
      }

      const session = await createCheckoutSession(checkoutBody);
      return { checkoutUrl: session.url };
    },
  };
}

// ============ PAYMENTS MANAGER ============

function createPaymentsManager(businessId: string): IntentManagers['payments'] {
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  
  return {
    createCheckout: async (items: CartItem[], options?: CheckoutOptions) => {
      console.log('[Payments] Creating checkout:', items);
      
      if (supabase) {
        const checkoutBody = resolveCheckoutSessionBody({
          items,
          priceId: options?.priceId,
          plan: options?.plan,
          billingCycle: options?.billingCycle,
          successUrl: options?.successUrl,
          cancelUrl: options?.cancelUrl || `${window.location.origin}/cart`,
        });

        if (!checkoutBody) {
          throw new Error('Checkout requires a plan or Stripe price ID');
        }

        const session = await createCheckoutSession(checkoutBody);
        return { url: session.url };
      }

      // Fallback for development
      return { url: '/checkout/demo' };
    },

    isConfigured: () => {
      return !!stripeKey;
    },

    showSetup: () => {
      console.log('[Payments] Showing setup modal');
      window.postMessage({ type: 'OVERLAY_OPEN', overlayId: 'payments-setup' }, '*');
    },
  };
}

// ============ NEWSLETTER MANAGER ============

function createNewsletterManager(businessId: string): IntentManagers['newsletter'] {
  return {
    subscribe: async (email: string, lists?: string[]) => {
      console.log('[Newsletter] Subscribing:', email, lists);
      
      if (supabase) {
        const { data, error } = await supabase
          .from('newsletter_subscribers')
          .upsert({
            business_id: businessId,
            email,
            lists: lists || ['default'],
            subscribed_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error('[Newsletter] Subscription failed:', error);
          throw error;
        }

        return { subscriptionId: data.id };
      }

      return { subscriptionId: `sub_${Date.now()}` };
    },
  };
}

// ============ MAIN SETUP ============

export interface CRMManagersConfig {
  businessId: string;
  siteId?: string;
  userId?: string;
  sessionId?: string;
}

/**
 * Create fully-configured IntentManagers for CRM operations
 */
export function createCRMManagers(config: CRMManagersConfig): IntentManagers {
  const sessionId = config.sessionId || `session_${Date.now()}`;
  
  return {
    crm: createCRMManager(config.businessId),
    booking: createBookingManager(config.businessId),
    cart: createCartManager(sessionId),
    payments: createPaymentsManager(config.businessId),
    newsletter: createNewsletterManager(config.businessId),
    
    // Navigation manager
    navigation: {
      goto: (path, payload) => {
        console.log('[Nav] Going to:', path);
        window.postMessage({ 
          type: 'NAV_PAGE_GENERATE', 
          pageName: path.replace(/^\/|\.html$/g, ''),
          payload 
        }, '*');
      },
      external: (url) => {
        window.open(url, '_blank', 'noopener,noreferrer');
      },
      back: () => {
        window.history.back();
      },
      scrollTo: (anchor) => {
        const el = document.querySelector(anchor);
        el?.scrollIntoView({ behavior: 'smooth' });
      },
    },

    // Overlay manager
    overlay: {
      open: (id, payload) => {
        console.log('[Overlay] Opening:', id);
        window.postMessage({ type: 'OVERLAY_OPEN', overlayId: id, payload }, '*');
      },
      close: (id) => {
        window.postMessage({ type: 'OVERLAY_CLOSE', overlayId: id }, '*');
      },
      isOpen: () => false,
    },

    // Toast manager
    toast: {
      show: (toast) => {
        console.log('[Toast]', toast.type, toast.message);
        window.postMessage({ type: 'TOAST_SHOW', toast }, '*');
      },
    },

    // Auth manager (placeholder - connect to your auth system)
    auth: {
      isAuthenticated: () => false,
      getCurrentUser: () => null,
      showLogin: () => {
        window.postMessage({ type: 'OVERLAY_OPEN', overlayId: 'auth-login' }, '*');
      },
      showRegister: () => {
        window.postMessage({ type: 'OVERLAY_OPEN', overlayId: 'auth-register' }, '*');
      },
    },
  };
}

/**
 * Initialize the full CRM + Automation system
 * 
 * Call this once at app startup:
 * ```ts
 * import { initializeCRMSystem } from '@/lib/crm-managers';
 * 
 * initializeCRMSystem({
 *   businessId: 'my-business-id',
 *   siteId: 'my-site-id',
 * });
 * ```
 */
export function initializeCRMSystem(config: CRMManagersConfig): void {
  // Create managers
  const managers = createCRMManagers(config);
  
  // Configure the intent executor with managers
  import('@/runtime/intentExecutor').then(({ configureIntentExecutor }) => {
    configureIntentExecutor(managers);
    console.log('[CRM] Intent Executor configured with CRM managers');
  });

  // Setup event bridge to Inngest
  const eventBridgeContext: EventBridgeContext = {
    businessId: config.businessId,
    siteId: config.siteId,
    userId: config.userId,
    sessionId: config.sessionId,
  };
  setupEventBridge(eventBridgeContext);
  
  console.log('[CRM] System initialized for business:', config.businessId);
}
