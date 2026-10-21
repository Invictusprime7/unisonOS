import { TRUSTED_PREVIEW_ORIGIN_SOURCE } from '@/utils/trustedPreviewOrigin';
import { agentOperations } from '@/services/agent-runtime/operations';
/**
 * TemplateRuntimeProvider - Pre-wired template runtime context
 * 
 * Wraps VFSPreview with:
 * 1. Business context (businessId, siteId)
 * 2. Auth session (Supabase Auth)
 * 3. Fully-wired intent managers
 * 4. Event bridge to Inngest automations
 * 
 * This enables zero-config behavior where:
 * - "Sign In" buttons work immediately with real auth
 * - "Subscribe" buttons open real Stripe Checkout
 * - Lead forms persist to CRM automatically
 * - Booking buttons create real appointments
 */

/* eslint-disable react-refresh/only-export-components */

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { IntentManagers, IntentResult, IntentContext } from './intentExecutor';
import { executeIntent, configureIntentExecutor } from './intentExecutor';
import { createCheckoutSession, resolveCheckoutSessionBody } from './checkoutClient';
import { setupEventBridge, createInngestEventsManager } from '@/lib/inngest-event-bridge';
import type { InteractiveIconProps } from '@/components/ui/InteractiveIcon';
import { BROWSER_CART_EVENT, readBrowserCart } from './browserCartManager';

// ============ TYPES ============

export interface TemplateRuntimeConfig {
  /** Business ID for CRM/booking/payment operations */
  businessId: string;
  /** Site/Project ID being previewed */
  siteId?: string;
  /** Custom success URL for checkout */
  checkoutSuccessUrl?: string;
  /** Custom cancel URL for checkout */
  checkoutCancelUrl?: string;
  /** Stripe price IDs for subscription buttons */
  subscriptionPrices?: {
    free?: string;
    starter?: string;
    pro?: string;
    enterprise?: string;
  };
  /** Enable debug logging */
  debug?: boolean;
}

export interface TemplateRuntimeContextValue {
  // Configuration
  config: TemplateRuntimeConfig;
  
  // Auth state
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  
  // Auth actions
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  showAuthModal: (mode: 'login' | 'register') => void;
  
  // Intent execution (pre-wired)
  executeIntent: (intent: string, context?: IntentContext) => Promise<IntentResult>;
  
  // Managers access
  managers: IntentManagers | null;
  
  // Cart state (for UI binding)
  cartItemCount: number;
  cartTotal: number;
  refreshCart: () => Promise<void>;
  
  // Icon runtime props — pre-wired for InteractiveIcon components
  getIconProps: (iconKey: string) => Partial<InteractiveIconProps>;
}

const TemplateRuntimeContext = createContext<TemplateRuntimeContextValue | null>(null);

// ============ CART MANAGER WITH SUPABASE ============

interface CartState {
  items: Array<{
    id: string;
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  total: number;
}

async function getCart(sessionId: string, userId?: string): Promise<CartState> {
  if (!supabase) {
    return { items: [], total: 0 };
  }

  try {
    // Get cart items from Supabase
    let query = supabase
      .from('cart_items')
      .select('*');
    
    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.eq('session_id', sessionId);
    }

    const { data: items, error } = await query;

    if (error || !items) {
      console.error('[Cart] Failed to fetch:', error);
      return { items: [], total: 0 };
    }

    const total = items.reduce((sum, item) => sum + ((item as any).price || 0) * (item.quantity || 1), 0);
    
    return {
      items: items.map(item => ({
        id: item.id,
        productId: item.product_id,
        name: (item as any).name || 'Unknown',
        price: (item as any).price || 0,
        quantity: item.quantity || 1,
      })),
      total,
    };
  } catch (err) {
    console.error('[Cart] Error:', err);
    return { items: [], total: 0 };
  }
}

// ============ AUTH MANAGER ============

function createAuthManager(
  user: User | null,
  showAuthModalFn: (mode: 'login' | 'register') => void
): IntentManagers['auth'] {
  return {
    isAuthenticated: () => !!user,
    getCurrentUser: () => user ? {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
    } : null,
    showLogin: () => showAuthModalFn('login'),
    showRegister: () => showAuthModalFn('register'),
  };
}

// ============ WIRED CART MANAGER ============

function createWiredCartManager(
  businessId: string,
  sessionId: string,
  userId?: string
): IntentManagers['cart'] {
  return {
    add: async (item) => {
      if (!supabase) {
        console.warn('[Cart] Supabase not configured');
        return { cartId: sessionId, itemCount: 0 };
      }

      // Check if item already in cart
      const { data: existing } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq(userId ? 'user_id' : 'session_id', userId || sessionId)
        .eq('product_id', item.productId)
        .single();

      if (existing) {
        // Update quantity
        await supabase
          .from('cart_items')
          .update({ quantity: (existing.quantity || 1) + (item.quantity || 1) })
          .eq('id', existing.id);
      } else {
        // Insert new item
        await supabase.from('cart_items').insert({
          business_id: businessId,
          session_id: sessionId,
          user_id: userId,
          product_id: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
        });
      }

      // Get updated cart
      const { count } = await supabase
        .from('cart_items')
        .select('*', { count: 'exact', head: true })
        .eq(userId ? 'user_id' : 'session_id', userId || sessionId);

      return { cartId: sessionId, itemCount: count || 0 };
    },

    get: async () => {
      const cart = await getCart(sessionId, userId);
      return {
        id: sessionId,
        items: cart.items,
        total: cart.total,
      };
    },

    update: async (productId, quantity) => {
      if (!supabase) {
        return { cartId: sessionId, itemCount: 0 };
      }

      const query = supabase
        .from('cart_items')
        .select('id')
        .eq('product_id', productId)
        .eq(userId ? 'user_id' : 'session_id', userId || sessionId);
      const { data: existing } = await query.single();

      if (existing?.id) {
        if (quantity <= 0) {
          await supabase.from('cart_items').delete().eq('id', existing.id);
        } else {
          await supabase.from('cart_items').update({ quantity }).eq('id', existing.id);
        }
      }

      const { count } = await supabase
        .from('cart_items')
        .select('*', { count: 'exact', head: true })
        .eq(userId ? 'user_id' : 'session_id', userId || sessionId);

      return { cartId: sessionId, itemCount: count || 0 };
    },

    remove: async (productId) => {
      if (!supabase) {
        return { cartId: sessionId, itemCount: 0 };
      }

      await supabase
        .from('cart_items')
        .delete()
        .eq('product_id', productId)
        .eq(userId ? 'user_id' : 'session_id', userId || sessionId);

      const { count } = await supabase
        .from('cart_items')
        .select('*', { count: 'exact', head: true })
        .eq(userId ? 'user_id' : 'session_id', userId || sessionId);

      return { cartId: sessionId, itemCount: count || 0 };
    },

    clear: async () => {
      if (!supabase) {
        return { cartId: sessionId, itemCount: 0 };
      }

      await supabase
        .from('cart_items')
        .delete()
        .eq(userId ? 'user_id' : 'session_id', userId || sessionId);

      return { cartId: sessionId, itemCount: 0 };
    },

    checkout: async () => {
      if (!supabase) {
        return { checkoutUrl: '/checkout' };
      }

      const cart = await getCart(sessionId, userId);
      const checkoutBody = resolveCheckoutSessionBody({
        items: cart.items,
      });

      if (!checkoutBody) {
        throw new Error('Cart checkout requires a Stripe price mapping');
      }

      const data = await createCheckoutSession(checkoutBody);
      return { checkoutUrl: data.url };
    },
  };
}

// ============ WIRED PAYMENT MANAGER ============

function createWiredPaymentManager(
  businessId: string,
  config: TemplateRuntimeConfig
): IntentManagers['payments'] {
  return {
    createCheckout: async (items, options) => {
      if (!supabase) {
        console.warn('[Payments] Supabase not configured');
        return { url: '/checkout/demo' };
      }

      const checkoutBody = resolveCheckoutSessionBody({
        items,
        priceId: options?.priceId,
        plan: options?.plan,
        billingCycle: options?.billingCycle,
        successUrl: options?.successUrl || config.checkoutSuccessUrl,
        cancelUrl: options?.cancelUrl || config.checkoutCancelUrl,
      });

      if (!checkoutBody) {
        throw new Error('Checkout requires a plan or Stripe price ID');
      }

      const data = await createCheckoutSession(checkoutBody);
      return { url: data.url };
    },

    isConfigured: () => {
      return !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    },

    showSetup: () => {
      window.postMessage({ type: 'OVERLAY_OPEN', overlayId: 'payments-setup' }, '*');
    },
  };
}

// ============ PROVIDER COMPONENT ============

interface TemplateRuntimeProviderProps {
  config: TemplateRuntimeConfig;
  children: React.ReactNode;
}

export function TemplateRuntimeProvider({ config, children }: TemplateRuntimeProviderProps) {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authModalState, setAuthModalState] = useState<{ open: boolean; mode: 'login' | 'register' }>({
    open: false,
    mode: 'login',
  });

  // Cart state
  const [cartItemCount, setCartItemCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);

  // Session ID for guest carts
  const sessionId = useMemo(() => {
    if (typeof window !== 'undefined') {
      let id = sessionStorage.getItem('cart_session_id');
      if (!id) {
        id = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem('cart_session_id', id);
      }
      return id;
    }
    return `sess_${Date.now()}`;
  }, []);

  // Initialize auth state
  useEffect(() => {
    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setIsAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      // Migrate cart on login
      if (newSession?.user && !session?.user) {
        migrateGuestCart(sessionId, newSession.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [sessionId, session?.user]);

  // Hydrate pre-baked intent surfaces (written by the Wizard Launcher into
  // /.unison/intent-surfaces.json). Stashed on window so deterministic UI
  // helpers + the AI Builder Readiness card share one source of truth.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as { __UNISON_INTENT_SURFACES__?: unknown };
    if (w.__UNISON_INTENT_SURFACES__) return;
    let cancelled = false;
    fetch('/.unison/intent-surfaces.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        w.__UNISON_INTENT_SURFACES__ = data;
        if (config.debug) {
          console.log('[Runtime] Loaded pre-baked intent surfaces:', Object.keys(data.byIntent || {}));
        }
      })
      .catch(() => {/* file is optional */});
    return () => { cancelled = true; };
  }, [config.debug]);

  // Migrate guest cart to authenticated user
  const migrateGuestCart = async (guestSessionId: string, userId: string) => {
    if (!supabase) return;

    try {
      // Get guest cart items
      const { data: guestItems } = await supabase
        .from('cart_items')
        .select('*')
        .eq('session_id', guestSessionId)
        .is('user_id', null);

      if (guestItems && guestItems.length > 0) {
        // Update to user
        await supabase
          .from('cart_items')
          .update({ user_id: userId })
          .eq('session_id', guestSessionId)
          .is('user_id', null);

        if (config.debug) {
          console.log('[Runtime] Migrated', guestItems.length, 'cart items to user');
        }
      }
    } catch (err) {
      console.error('[Runtime] Cart migration failed:', err);
    }
  };

  // Refresh cart state — merges Supabase-backed cart with in-preview browser cart
  // so the shopping-cart icon badge stays in sync across every industry template
  // regardless of which cart manager handled the cart.add intent.
  const refreshCart = useCallback(async () => {
    const remote = await getCart(sessionId, user?.id);
    const local = readBrowserCart({
      businessId: config.businessId,
      siteId: config.siteId,
      sessionId,
    });

    const sumQty = (items: Array<{ quantity?: number }>) =>
      items.reduce((sum, it) => sum + (it.quantity || 1), 0);

    const remoteCount = sumQty(remote.items);
    const localCount = sumQty(local.items);
    const remoteTotal = remote.total || 0;
    const localTotal = local.total || 0;

    // Prefer whichever cart has items — in Wizard/Builder preview, browser cart is
    // authoritative; on published sites, Supabase cart is authoritative.
    const useLocal = localCount > 0 && remoteCount === 0;
    setCartItemCount(useLocal ? localCount : remoteCount || localCount);
    setCartTotal(useLocal ? localTotal : remoteTotal || localTotal);
  }, [sessionId, user?.id, config.businessId, config.siteId]);

  // Initial cart load
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  // Live cart badge — every industry template's shopping-cart icon reflects
  // add-to-bag / add-to-cart / remove / clear intents the instant they fire.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { items?: Array<{ quantity?: number; price?: number }>; total?: number }
        | undefined;
      if (detail?.items) {
        const count = detail.items.reduce((sum, it) => sum + (it.quantity || 1), 0);
        setCartItemCount(count);
        setCartTotal(detail.total ?? 0);
      } else {
        // Fallback: re-read from source of truth
        refreshCart();
      }
    };
    window.addEventListener(BROWSER_CART_EVENT, handler as EventListener);
    return () => window.removeEventListener(BROWSER_CART_EVENT, handler as EventListener);
  }, [refreshCart]);

  // Auth actions
  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { ok: false, error: 'Auth not configured' };
    }

    // Use site-scoped auth when siteId is available
    if (config.siteId) {
      const { data, error } = await supabase.functions.invoke('site-auth', {
        body: { 
          action: 'login', 
          siteId: config.siteId, 
          email, 
          password 
        },
      });
      
      if (error || !data?.success) {
        return { ok: false, error: data?.error || error?.message || 'Login failed' };
      }
      
      // Store site session in localStorage
      localStorage.setItem(`site_session:${config.siteId}`, JSON.stringify(data.session));
      
      return { ok: true };
    }

    // Fall back to global Supabase auth
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  };

  const signUp = async (email: string, password: string, metadata?: Record<string, unknown>) => {
    if (!supabase) {
      return { ok: false, error: 'Auth not configured' };
    }

    // Use site-scoped auth when siteId is available
    if (config.siteId) {
      const { data, error } = await supabase.functions.invoke('site-auth', {
        body: { 
          action: 'register', 
          siteId: config.siteId, 
          businessId: config.businessId,
          email, 
          password,
          name: metadata?.full_name || metadata?.name,
          metadata,
        },
      });
      
      if (error || !data?.success) {
        return { ok: false, error: data?.error || error?.message || 'Registration failed' };
      }
      
      // Store site session in localStorage
      localStorage.setItem(`site_session:${config.siteId}`, JSON.stringify(data.session));
      
      return { ok: true };
    }

    // Fall back to global Supabase auth
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  };

  const signOut = async () => {
    if (!supabase) return;
    
    // Clear site session if exists
    if (config.siteId) {
      localStorage.removeItem(`site_session:${config.siteId}`);
    }
    
    await supabase.auth.signOut();
  };

  const showAuthModal = (mode: 'login' | 'register') => {
    setAuthModalState({ open: true, mode });
    // Also trigger overlay message for iframe communication
    window.postMessage({ 
      type: 'OVERLAY_OPEN', 
      overlayId: mode === 'login' ? 'auth-login' : 'auth-register' 
    }, '*');
  };

  // Create managers
  const managers = useMemo<IntentManagers>(() => ({
    crm: createCRMManagerWired({
      businessId: config.businessId,
      siteId: config.siteId,
      userId: user?.id,
      sessionId,
    }),
    booking: createBookingManagerWired({
      businessId: config.businessId,
      siteId: config.siteId,
      userId: user?.id,
      sessionId,
    }),
    cart: createWiredCartManager(config.businessId, sessionId, user?.id),
    payments: createWiredPaymentManager(config.businessId, config),
    newsletter: createNewsletterManagerWired({
      businessId: config.businessId,
      siteId: config.siteId,
      userId: user?.id,
      sessionId,
    }),
    navigation: createNavigationManager(),
    overlay: createOverlayManager(),
    toast: createToastManager(),
    auth: createAuthManager(user, showAuthModal),
    events: createInngestEventsManager({
      businessId: config.businessId,
      siteId: config.siteId,
      userId: user?.id,
      sessionId,
    }),
  }), [config.businessId, config.siteId, sessionId, user?.id, config]);

  // Configure global executor with managers
  useEffect(() => {
    configureIntentExecutor(managers);
    
    // Setup event bridge for automations
    setupEventBridge({
      businessId: config.businessId,
      siteId: config.siteId,
      userId: user?.id,
      sessionId,
    });

    if (config.debug) {
      console.log('[Runtime] Configured with managers:', Object.keys(managers));
    }
  }, [managers, config, sessionId, user?.id]);

  // Wrapped intent execution with context
  const executeIntentWithContext = useCallback(async (intent: string, context?: IntentContext): Promise<IntentResult> => {
    const fullContext: IntentContext = {
      ...context,
      businessId: config.businessId,
      siteId: config.siteId,
      userId: user?.id,
      sessionId,
    };

    const result = await executeIntent(intent, fullContext);

    // Handle UI directives
    if (result.ui?.navigate) {
      // Handle checkout redirect
      if (result.ui.navigate.startsWith('http')) {
        window.location.href = result.ui.navigate;
      } else {
        window.postMessage({ type: 'NAV_PAGE_GENERATE', pageName: result.ui.navigate }, '*');
      }
    }

    // Refresh cart if cart action
    if (intent.startsWith('cart.')) {
      await refreshCart();
    }

    return result;
  }, [config, user?.id, sessionId, managers, refreshCart]);

  // Pre-wired icon props factory
  const getIconProps = useCallback((iconKey: string): Partial<InteractiveIconProps> => {
    const baseProps: Partial<InteractiveIconProps> = {
      user: user ? { name: user.user_metadata?.name || user.email?.split('@')[0], email: user.email || '' } : null,
      onAuthAction: (action) => {
        if (action === 'login') showAuthModal('login');
        else if (action === 'signup') showAuthModal('register');
        else if (action === 'logout') signOut();
      },
      onSearch: (query) => {
        window.dispatchEvent(new CustomEvent('intent:search', { detail: { query } }));
      },
    };

    if (iconKey === 'cart') {
      baseProps.badgeCount = cartItemCount;
    }

    return baseProps;
  }, [user, cartItemCount, signOut]);

  const contextValue: TemplateRuntimeContextValue = {
    config,
    user,
    session,
    isAuthenticated: !!user,
    isAuthLoading,
    signIn,
    signUp,
    signOut,
    showAuthModal,
    executeIntent: executeIntentWithContext,
    managers,
    cartItemCount,
    cartTotal,
    refreshCart,
    getIconProps,
  };

  return (
    <TemplateRuntimeContext.Provider value={contextValue}>
      {children}
      {/* Auth Modal handled by parent app */}
    </TemplateRuntimeContext.Provider>
  );
}

// ============ HOOK ============

export function useTemplateRuntime(): TemplateRuntimeContextValue {
  const context = useContext(TemplateRuntimeContext);
  if (!context) {
    throw new Error('useTemplateRuntime must be used within TemplateRuntimeProvider');
  }
  return context;
}

// ============ HELPER MANAGERS (imported from crm-managers pattern) ============

interface RuntimeIntentManagerConfig {
  businessId: string;
  siteId?: string;
  userId?: string;
  sessionId?: string;
}

interface RuntimeIntentExecResponse {
  ok: boolean;
  result?: unknown;
  error?: {
    code?: string;
    message?: string;
  };
}

function isRuntimeUuid(value?: string): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getRuntimePageId(): string {
  if (typeof window === 'undefined') return '/';
  const pageId = window.location.pathname?.trim();
  return pageId || '/';
}

async function invokeRuntimeCanonicalIntent(
  config: RuntimeIntentManagerConfig,
  intentId: string,
  params: Record<string, unknown>,
): Promise<RuntimeIntentExecResponse | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.functions.invoke('intent-exec', {
      body: {
        siteId: isRuntimeUuid(config.siteId) ? config.siteId : undefined,
        businessId: config.businessId,
        intentId,
        pageId: getRuntimePageId(),
        params,
        context: {
          userId: config.userId,
          sessionId: config.sessionId,
        },
      },
    });

    if (error) {
      console.error(`[Runtime] intent-exec ${intentId} failed:`, error);
      return null;
    }

    if (data && typeof data === 'object' && 'ok' in data) {
      return data as RuntimeIntentExecResponse;
    }
  } catch (error) {
    console.error(`[Runtime] intent-exec ${intentId} exception:`, error);
  }

  return null;
}

function createCRMManagerWired(config: RuntimeIntentManagerConfig): IntentManagers['crm'] {
  return {
    submitLead: async (data) => {
      if (!supabase) {
        return { leadId: `lead_${Date.now()}`, pipelineId: 'default' };
      }

      const canonical = await invokeRuntimeCanonicalIntent(config, 'contact.submit', {
        ...data,
        email: data.email,
        name: data.name,
        phone: data.phone,
        message: data.message,
      });

      if (canonical?.ok) {
        const result = (canonical.result ?? {}) as { leadId?: string; contactId?: string; pipelineId?: string };
        const leadId = result.leadId || result.contactId;
        if (!leadId) throw new Error('Canonical CRM command returned no lead or contact ID.');
        return { leadId, pipelineId: result.pipelineId || '' };
      }

      const canonicalError = canonical?.error;
      throw new Error(
        typeof canonicalError === 'string'
          ? canonicalError
          : canonicalError?.message || 'Canonical CRM command is unavailable.',
      );
    },

    getPipeline: async (id) => {
      if (!supabase) return null;

      const query = supabase
        .from('crm_pipelines')
        .select('*, stages:crm_stages(*)')
        .eq('business_id', config.businessId);

      if (id) query.eq('id', id);

      const { data: pipelines } = await query.limit(1);
      if (!pipelines?.length) return null;

      const p = pipelines[0];
      return {
        id: p.id,
        name: p.name,
        stages: (p.stages as Array<{ id: string; name: string }> || []).map(s => ({ id: s.id, name: s.name })),
      };
    },

    createDefaultPipeline: async () => {
      const defaultPipeline = {
        id: `pipeline_${Date.now()}`,
        name: 'Default Pipeline',
        stages: [
          { id: 'new', name: 'New' },
          { id: 'contacted', name: 'Contacted' },
          { id: 'qualified', name: 'Qualified' },
          { id: 'proposal', name: 'Proposal' },
          { id: 'closed', name: 'Closed' },
        ],
      };

      if (!supabase) return defaultPipeline;

      const { data: pipeline } = await supabase
        .from('crm_pipelines')
        .insert({ workspace_id: config.businessId, name: defaultPipeline.name, stages: JSON.stringify(defaultPipeline.stages) } as any)
        .select()
        .single();

      return pipeline ? { ...defaultPipeline, id: pipeline.id } : defaultPipeline;
    },
  };
}

function createBookingManagerWired(config: RuntimeIntentManagerConfig): IntentManagers['booking'] {
  return {
    createBooking: async () => {
      throw new Error('Booking writes require the generated site-runtime adapter.');
    },

    getServices: async () => {
      if (!supabase) return [];

      const { data: services } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', config.businessId)
        .eq('is_active', true);

      return (services || []).map(s => ({
        id: s.id,
        name: s.name,
        duration: s.duration_minutes || 60,
        price: s.price_cents ? s.price_cents / 100 : 0,
      }));
    },

    createDefaultService: async () => {
      const defaultService = {
        id: `service_${Date.now()}`,
        name: 'General Appointment',
        duration: 60,
        price: 0,
      };

      try {
        const item = await agentOperations.create_catalog_item({ files: {}, businessId: config.businessId }, 'services', {
          name: defaultService.name, price: 0, active: true, duration_minutes: 60,
        });
        return { ...defaultService, id: item.id };
      } catch {
        return defaultService;
      }
    },
  };
}

function createNewsletterManagerWired(config: RuntimeIntentManagerConfig): IntentManagers['newsletter'] {
  return {
    subscribe: async (email, lists) => {
      if (!supabase) {
        return { subscriptionId: `sub_${Date.now()}` };
      }

      const canonical = await invokeRuntimeCanonicalIntent(config, 'newsletter.subscribe', {
        email,
        lists,
        source: 'newsletter',
      });

      if (canonical?.ok) {
        const result = (canonical.result ?? {}) as { subscriberId?: string; subscriptionId?: string };
        return {
          subscriptionId: result.subscriptionId || result.subscriberId || `sub_${Date.now()}`,
        };
      }

      if (canonical && !canonical.ok) {
        console.error('[Newsletter] Canonical subscribe failed:', canonical.error);
      }

      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .upsert({
          business_id: config.businessId,
          email,
          lists: lists || ['default'],
          subscribed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[Newsletter] Failed:', error);
        return { subscriptionId: 'unknown' };
      }

      return { subscriptionId: data.id };
    },
  };
}

function createNavigationManager(): IntentManagers['navigation'] {
  return {
    goto: (path, payload) => {
      window.postMessage({ type: 'NAV_PAGE_GENERATE', pageName: path.replace(/^\/|\.html$/g, ''), payload }, '*');
    },
    external: (url) => {
      // Never open new tabs — route as in-page navigation
      const pageName = url.replace(/^https?:\/\/[^/]+\/?/, '').replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'external';
      window.postMessage({ type: 'NAV_PAGE_GENERATE', pageName, payload: { url } }, '*');
    },
    back: () => {
      window.history.back();
    },
    scrollTo: (anchor) => {
      const el = document.querySelector(anchor);
      el?.scrollIntoView({ behavior: 'smooth' });
    },
  };
}

function createOverlayManager(): IntentManagers['overlay'] {
  return {
    open: (id, payload) => {
      window.postMessage({ type: 'OVERLAY_OPEN', overlayId: id, payload }, '*');
    },
    close: (id) => {
      window.postMessage({ type: 'OVERLAY_CLOSE', overlayId: id }, '*');
    },
    isOpen: () => false,
  };
}

function createToastManager(): IntentManagers['toast'] {
  return {
    show: (toast) => {
      window.postMessage({ type: 'TOAST_SHOW', toast }, '*');
    },
  };
}

// ============ INJECTION SCRIPT FOR TEMPLATES ============

/**
 * Generate the runtime initialization script to inject into templates.
 * This script sets up the message listener and intent execution.
 */
export function generateRuntimeInjectionScript(config: TemplateRuntimeConfig): string {
  return `
<!-- Template Runtime Injection -->
<script>
(function() {
  'use strict';
  
  window.__TEMPLATE_RUNTIME__ = {
    businessId: '${config.businessId}',
    siteId: '${config.siteId || ''}',
    debug: ${config.debug || false},
  };

  // Intent patterns for auto-binding
  const INTENT_PATTERNS = {
    // Auth
    'sign in|login|log in': 'auth.login',
    'sign up|register|create account|get started': 'auth.register',
    'sign out|logout|log out': 'auth.logout',
    
    // Payments
    'subscribe|upgrade|pro|premium|buy now|purchase|checkout|add to cart': 'pay.checkout',
    'pricing|plans': 'nav.goto_pricing',
    
    // Booking
    'book|schedule|appointment|reserve': 'booking.create',
    
    // Contact
    'contact|get in touch|reach out': 'contact.submit',
    'demo|request demo': 'contact.demo',
    
    // Newsletter
    'subscribe newsletter|join list|get updates': 'newsletter.subscribe',
    
    // Navigation
    'learn more|read more|see more': 'nav.anchor',
    'back|go back': 'nav.back',
  };

  function inferIntent(text) {
    const lowerText = (text || '').toLowerCase().trim();
    for (const [pattern, intent] of Object.entries(INTENT_PATTERNS)) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(lowerText)) {
        return intent;
      }
    }
    return null;
  }

  // Handle click events
  document.addEventListener('click', function(e) {
    const target = e.target.closest('button, a, [data-intent], [role="button"]');
    if (!target) return;

    // Check for explicit intent
    let intent = target.dataset?.intent || target.getAttribute('data-intent');
    
    // Infer from text if not explicit
    if (!intent) {
      const text = target.textContent || target.innerText || target.getAttribute('aria-label') || '';
      intent = inferIntent(text);
    }

    if (intent) {
      e.preventDefault();
      e.stopPropagation();

      // Get payload from data attributes
      const payload = {};
      for (const [key, value] of Object.entries(target.dataset || {})) {
        if (key !== 'intent' && key.startsWith('payload')) {
          const payloadKey = key.replace('payload', '').toLowerCase();
          payload[payloadKey] = value;
        }
      }

      // Send to parent
      window.parent.postMessage({
        type: 'INTENT_EXECUTE',
        intent: intent,
        payload: payload,
        elementText: target.textContent?.trim(),
        timestamp: Date.now(),
      }, '*');

      if (window.__TEMPLATE_RUNTIME__.debug) {
        console.log('[Runtime] Intent:', intent, payload);
      }
    }
  }, true);

  // Handle form submissions
  document.addEventListener('submit', function(e) {
    const form = e.target;
    if (!form || form.tagName !== 'FORM') return;

    const intent = form.dataset?.intent || form.getAttribute('data-intent');
    if (!intent) return;

    e.preventDefault();

    // Collect form data
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    window.parent.postMessage({
      type: 'INTENT_EXECUTE',
      intent: intent,
      payload: payload,
      timestamp: Date.now(),
    }, '*');
  }, true);

  // Listen for messages from parent
  window.addEventListener('message', function(e) {
    // Only the hosting page may send results; others are ignored.
    if ((e.source !== window.parent || window.parent === window) || !(${TRUSTED_PREVIEW_ORIGIN_SOURCE})(e.origin)) return;
    const data = e.data;
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'INTENT_RESULT':
        // Handle intent result (show toast, redirect, etc.)
        if (data.result?.toast) {
          showToast(data.result.toast);
        }
        if (data.result?.ui?.navigate) {
          if (data.result.ui.navigate.startsWith('http')) {
            window.location.href = data.result.ui.navigate;
          }
        }
        break;

      case 'AUTH_STATE_CHANGED':
        // Update UI based on auth state
        document.body.classList.toggle('authenticated', data.isAuthenticated);
        break;
    }
  });

  function showToast(toast) {
    // Simple toast implementation
    const div = document.createElement('div');
    div.className = 'template-toast template-toast-' + toast.type;
    div.textContent = toast.message;
    div.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 20px;border-radius:8px;color:white;z-index:9999;animation:fadeIn 0.3s;';
    div.style.backgroundColor = toast.type === 'success' ? '#10B981' : toast.type === 'error' ? '#EF4444' : '#3B82F6';
    document.body.appendChild(div);
    setTimeout(function() {
      div.style.animation = 'fadeOut 0.3s';
      setTimeout(function() { div.remove(); }, 300);
    }, toast.duration || 3000);
  }

  console.log('[Runtime] Template runtime initialized for business:', window.__TEMPLATE_RUNTIME__.businessId);
})();
</script>
<style>
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
</style>
`;
}
