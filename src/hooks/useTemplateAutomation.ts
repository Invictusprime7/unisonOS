import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Cart and order requests carry a session token signed by the backend, so a
// visitor can only reach their own cart and orders.
const SESSION_TOKEN_KEY = 'template_session_token';

const readSessionToken = (): string | null => {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
};

const startSession = async (): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('template-automation', {
    body: { action: 'startSession', data: {} },
  });
  if (error || typeof data?.sessionToken !== 'string') throw error || new Error('Could not start a cart session');
  try {
    localStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken);
    localStorage.removeItem('template_session_id');
  } catch {
    // Storage may be unavailable; the token still works for this page.
  }
  return data.sessionToken;
};

const sessionIdFromToken = (token: string | null): string => (token ? token.split('.')[0] : '');

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    image_url?: string;
    description?: string;
  };
}

interface Order {
  id: string;
  customer_email: string;
  items: any[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
}

export const useTemplateAutomation = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(() => readSessionToken());
  const sessionId = sessionIdFromToken(sessionToken);

  const callAutomation = async (action: string, data: any) => {
    const send = (token: string) => supabase.functions.invoke('template-automation', {
      body: { action, data: { ...data, sessionToken: token } }
    });
    let token = readSessionToken() || await startSession();
    let { data: result, error } = await send(token);
    const status = (error as { context?: { status?: number } } | null)?.context?.status;
    if (error && status === 401) {
      token = await startSession();
      ({ data: result, error } = await send(token));
    }
    if (token !== sessionToken) setSessionToken(token);
    if (error) throw error;
    return result;
  };

  // CART OPERATIONS
  const fetchCart = useCallback(async () => {
    try {
      const result = await callAutomation('getCart', {});
      setCart(result.items || []);
      setCartTotal(result.subtotal || 0);
      setCartCount(result.itemCount || 0);
    } catch (error) {
      console.error('Error fetching cart:', error);
    }
  }, [sessionId]);

  const addToCart = async (productId: string, quantity = 1) => {
    setLoading(true);
    try {
      await callAutomation('addToCart', { productId, quantity });
      await fetchCart();
      toast.success('Added to cart!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add to cart');
    } finally {
      setLoading(false);
    }
  };

  const updateCartItem = async (itemId: string, quantity: number) => {
    setLoading(true);
    try {
      await callAutomation('updateCartItem', { itemId, quantity });
      await fetchCart();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update cart');
    } finally {
      setLoading(false);
    }
  };

  const removeFromCart = async (itemId: string) => {
    setLoading(true);
    try {
      await callAutomation('removeFromCart', { itemId });
      await fetchCart();
      toast.success('Removed from cart');
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove from cart');
    } finally {
      setLoading(false);
    }
  };

  const clearCart = async () => {
    setLoading(true);
    try {
      await callAutomation('clearCart', {});
      await fetchCart();
    } catch (error: any) {
      toast.error(error.message || 'Failed to clear cart');
    } finally {
      setLoading(false);
    }
  };

  // ORDER OPERATIONS
  const createOrder = async (orderData: {
    customerEmail: string;
    customerName?: string;
    shippingAddress?: any;
    paymentMethod?: string;
  }): Promise<Order | null> => {
    setLoading(true);
    try {
      const items = cart.map(item => ({
        productId: item.product_id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity
      }));
      
      const result = await callAutomation('createOrder', { ...orderData, items });
      toast.success('Order placed successfully!');
      await fetchCart(); // Clear cart state
      return result.order;
    } catch (error: any) {
      toast.error(error.message || 'Failed to create order');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // PRODUCT OPERATIONS
  const getProducts = async (category?: string) => {
    try {
      const result = await callAutomation('getProducts', { category });
      return result.products || [];
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  };

  // Load cart on mount
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  return {
    // Cart
    cart,
    cartTotal,
    cartCount,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    fetchCart,
    // Orders
    createOrder,
    // Products
    getProducts,
    // State
    loading,
    sessionId
  };
};
