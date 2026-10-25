import type { Cart, CartItem, IntentManagers } from './intentExecutor';
import { generateUUID } from '@/utils/uuid';

export const BROWSER_CART_EVENT = 'unison:cart.updated';

interface BrowserCartContext {
  businessId?: string;
  siteId?: string;
  sessionId?: string;
}

interface StoredBrowserCart extends Cart {
  updatedAt: string;
}

let memoryFallbackSessionId: string | null = null;

function getFallbackSessionId(): string {
  if (typeof window === 'undefined') return 'server-session';

  try {
    const existing = window.localStorage.getItem('unison:cart:session-id');
    if (existing) return existing;
  } catch {
    // Fall back to an in-memory session when browser storage is unavailable.
  }

  const next = memoryFallbackSessionId || generateUUID();
  memoryFallbackSessionId = next;
  try {
    window.localStorage.setItem('unison:cart:session-id', next);
  } catch {
    // A stable in-memory id still lets the preview render without persistence.
  }
  return next;
}

export function buildBrowserCartStorageKey(context: BrowserCartContext = {}): string {
  const sessionId = context.sessionId || getFallbackSessionId();
  return [
    'unison',
    'cart',
    context.businessId || 'preview',
    context.siteId || 'site',
    sessionId,
  ].join(':');
}

function createEmptyCart(context: BrowserCartContext = {}): StoredBrowserCart {
  return {
    id: context.sessionId || getFallbackSessionId(),
    items: [],
    total: 0,
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeCartItem(item: CartItem): CartItem {
  const price =
    typeof item.price === 'number'
      ? item.price
      : Number.parseFloat(String(item.price ?? 0));
  const quantity =
    typeof item.quantity === 'number'
      ? item.quantity
      : Number.parseInt(String(item.quantity ?? 1), 10);

  return {
    productId: item.productId,
    name: item.name || 'Item',
    price: Number.isFinite(price) ? price : 0,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    metadata: item.metadata || undefined,
  };
}

function recalculateCart(cart: StoredBrowserCart): StoredBrowserCart {
  const normalizedItems = cart.items
    .map(sanitizeCartItem)
    .filter((item) => !!item.productId && (item.quantity || 0) > 0);

  const total = normalizedItems.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
    0,
  );

  return {
    ...cart,
    items: normalizedItems,
    total,
    updatedAt: new Date().toISOString(),
  };
}

export function readBrowserCart(context: BrowserCartContext = {}): StoredBrowserCart {
  if (typeof window === 'undefined') {
    return createEmptyCart(context);
  }

  const storageKey = buildBrowserCartStorageKey(context);

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return createEmptyCart(context);

    const parsed = JSON.parse(raw) as Partial<StoredBrowserCart>;
    return recalculateCart({
      id: parsed.id || context.sessionId || getFallbackSessionId(),
      items: Array.isArray(parsed.items) ? parsed.items : [],
      total: typeof parsed.total === 'number' ? parsed.total : 0,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    });
  } catch {
    return createEmptyCart(context);
  }
}

function persistBrowserCart(cart: StoredBrowserCart, context: BrowserCartContext = {}): StoredBrowserCart {
  const nextCart = recalculateCart(cart);

  if (typeof window === 'undefined') {
    return nextCart;
  }

  const storageKey = buildBrowserCartStorageKey(context);
  window.localStorage.setItem(storageKey, JSON.stringify(nextCart));
  window.dispatchEvent(new CustomEvent(BROWSER_CART_EVENT, { detail: { ...nextCart, storageKey } }));
  return nextCart;
}

export function openBrowserCartOverlay(
  context: BrowserCartContext = {},
  payload: Record<string, unknown> = {},
): void {
  if (typeof window === 'undefined') return;

  const cart = readBrowserCart(context);
  window.postMessage(
    {
      type: 'OVERLAY_OPEN',
      overlayId: 'cart',
      payload: {
        cart,
        ...payload,
      },
    },
    '*',
  );
}

export function closeBrowserCartOverlay(): void {
  if (typeof window === 'undefined') return;
  window.postMessage({ type: 'OVERLAY_CLOSE', overlayId: 'cart' }, '*');
}

export function createBrowserCartManager(
  context: BrowserCartContext = {},
): NonNullable<IntentManagers['cart']> {
  return {
    add: async (item) => {
      const cart = readBrowserCart(context);
      const normalizedItem = sanitizeCartItem(item);
      const existingIndex = cart.items.findIndex((entry) => entry.productId === normalizedItem.productId);

      if (existingIndex >= 0) {
        const existing = cart.items[existingIndex];
        cart.items[existingIndex] = sanitizeCartItem({
          ...existing,
          quantity: (existing.quantity || 1) + (normalizedItem.quantity || 1),
          metadata: {
            ...(existing.metadata || {}),
            ...(normalizedItem.metadata || {}),
          },
        });
      } else {
        cart.items.push(normalizedItem);
      }

      const nextCart = persistBrowserCart(cart, context);
      return { cartId: nextCart.id, itemCount: nextCart.items.reduce((sum, item) => sum + (item.quantity ?? 1), 0) };
    },

    get: async () => {
      const cart = readBrowserCart(context);
      return {
        id: cart.id,
        items: cart.items,
        total: cart.total,
      };
    },

    update: async (productId, quantity) => {
      const cart = readBrowserCart(context);

      if (quantity <= 0) {
        cart.items = cart.items.filter((item) => item.productId !== productId);
      } else {
        cart.items = cart.items.map((item) =>
          item.productId === productId
            ? sanitizeCartItem({ ...item, quantity })
            : item,
        );
      }

      const nextCart = persistBrowserCart(cart, context);
      return { cartId: nextCart.id, itemCount: nextCart.items.reduce((sum, item) => sum + (item.quantity ?? 1), 0) };
    },

    remove: async (productId) => {
      const cart = readBrowserCart(context);
      cart.items = cart.items.filter((item) => item.productId !== productId);
      const nextCart = persistBrowserCart(cart, context);
      return { cartId: nextCart.id, itemCount: nextCart.items.reduce((sum, item) => sum + (item.quantity ?? 1), 0) };
    },

    clear: async () => {
      const nextCart = persistBrowserCart(createEmptyCart(context), context);
      return { cartId: nextCart.id, itemCount: nextCart.items.length };
    },

    checkout: async () => ({ checkoutUrl: '/checkout' }),
  };
}
