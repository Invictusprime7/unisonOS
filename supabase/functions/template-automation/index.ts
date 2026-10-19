import { serve } from "serve";
import { createClient } from "@supabase/supabase-js";
import { publicCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { errorResponse, secureJsonResponse } from "../_shared/response.ts";
import { safeParseBody, sanitizeString, isValidEmail } from "../_shared/validate.ts";

// Cart sessions are bearer secrets: only unguessable random UUIDs are accepted.
const UUID_SESSION = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req, publicCorsHeaders);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, publicCorsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: body, error: parseError } = await safeParseBody<{ action?: string; data?: Record<string, unknown> }>(req, 65_536);
    if (parseError || !body) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid request body", status, publicCorsHeaders);
    }

    const action = sanitizeString(body.action || '', 80);
    const data = body.data && typeof body.data === "object" ? body.data : {};
    console.log(`Template automation action: ${action}`, data);

    switch (action) {
      // CART OPERATIONS
      case 'addToCart': {
        const sessionId = typeof data.sessionId === "string" && UUID_SESSION.test(data.sessionId) ? data.sessionId : "";
        const productId = typeof data.productId === "string" ? sanitizeString(data.productId, 120) : "";
        const quantity = typeof data.quantity === "number" ? Math.max(1, Math.min(100, Math.trunc(data.quantity))) : 1;
        if (!sessionId || !productId) {
          return errorResponse("sessionId and productId are required", 400, publicCorsHeaders);
        }
        
        // Check if item already in cart
        const { data: existing } = await supabase
          .from('cart_items')
          .select('*')
          .eq('session_id', sessionId)
          .eq('product_id', productId)
          .maybeSingle();

        if (existing) {
          const { data: updated, error } = await supabase
            .from('cart_items')
            .update({ quantity: existing.quantity + quantity })
            .eq('id', existing.id)
            .select()
            .single();
          if (error) throw error;
          return secureJsonResponse({ success: true, item: updated }, 200, publicCorsHeaders);
        }

        const { data: newItem, error } = await supabase
          .from('cart_items')
          .insert({ session_id: sessionId, product_id: productId, quantity })
          .select()
          .single();
        if (error) throw error;
        return secureJsonResponse({ success: true, item: newItem }, 200, publicCorsHeaders);
      }

      case 'getCart': {
        const sessionId = typeof data.sessionId === "string" && UUID_SESSION.test(data.sessionId) ? data.sessionId : "";
        if (!sessionId) {
          return errorResponse("sessionId is required", 400, publicCorsHeaders);
        }
        const { data: items, error } = await supabase
          .from('cart_items')
          .select(`
            *,
            product:products(*)
          `)
          .eq('session_id', sessionId);
        if (error) throw error;
        
        const subtotal = items?.reduce((sum, item) => 
          sum + (item.product?.price || 0) * item.quantity, 0) || 0;
        
        return secureJsonResponse({ 
          success: true, 
          items: items || [], 
          subtotal,
          itemCount: items?.reduce((sum, item) => sum + item.quantity, 0) || 0
        }, 200, publicCorsHeaders);
      }

      case 'updateCartItem': {
        const sessionId = typeof data.sessionId === "string" && UUID_SESSION.test(data.sessionId) ? data.sessionId : "";
        const itemId = typeof data.itemId === "string" ? sanitizeString(data.itemId, 120) : "";
        const quantity = typeof data.quantity === "number" ? Math.max(0, Math.min(100, Math.trunc(data.quantity))) : 0;
        if (!itemId || !sessionId) {
          return errorResponse("sessionId and itemId are required", 400, publicCorsHeaders);
        }
        // Cart rows can only be changed by the visitor session that owns them.
        if (quantity <= 0) {
          const { error } = await supabase.from('cart_items').delete().eq('id', itemId).eq('session_id', sessionId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('cart_items')
            .update({ quantity })
            .eq('id', itemId)
            .eq('session_id', sessionId);
          if (error) throw error;
        }
        return secureJsonResponse({ success: true }, 200, publicCorsHeaders);
      }

      case 'removeFromCart': {
        const sessionId = typeof data.sessionId === "string" && UUID_SESSION.test(data.sessionId) ? data.sessionId : "";
        const itemId = typeof data.itemId === "string" ? sanitizeString(data.itemId, 120) : "";
        if (!itemId || !sessionId) {
          return errorResponse("sessionId and itemId are required", 400, publicCorsHeaders);
        }
        const { error } = await supabase.from('cart_items').delete().eq('id', itemId).eq('session_id', sessionId);
        if (error) throw error;
        return secureJsonResponse({ success: true }, 200, publicCorsHeaders);
      }

      case 'clearCart': {
        const sessionId = typeof data.sessionId === "string" && UUID_SESSION.test(data.sessionId) ? data.sessionId : "";
        // The session id is the visitor's private cart key; short or guessable
        // values are refused so one visitor cannot empty another's cart.
        if (!sessionId || sessionId.length < 16) {
          return errorResponse("A valid sessionId is required", 400, publicCorsHeaders);
        }
        const { error } = await supabase.from('cart_items').delete().eq('session_id', sessionId);
        if (error) throw error;
        return secureJsonResponse({ success: true }, 200, publicCorsHeaders);
      }

      // ORDER/CHECKOUT OPERATIONS
      case 'createOrder': {
        const sessionId = typeof data.sessionId === "string" && UUID_SESSION.test(data.sessionId) ? data.sessionId : "";
        const customerEmail = typeof data.customerEmail === "string" ? sanitizeString(data.customerEmail, 254) : "";
        const customerName = typeof data.customerName === "string" ? sanitizeString(data.customerName, 160) : "";
        const shippingAddress = data.shippingAddress ?? null;
        const paymentMethod = typeof data.paymentMethod === "string" ? sanitizeString(data.paymentMethod, 40) : 'card';
        const items = Array.isArray(data.items) ? data.items.slice(0, 100) : [];

        if (!sessionId || !isValidEmail(customerEmail) || !customerName || items.length === 0) {
          return errorResponse("Missing or invalid order fields", 400, publicCorsHeaders);
        }

        const subtotal = items.reduce((sum: number, item: any) => 
          sum + (item.price * item.quantity), 0);
        const tax = subtotal * 0.1; // 10% tax
        const total = subtotal + tax;

        const { data: order, error } = await supabase
          .from('orders')
          .insert({
            session_id: sessionId,
            customer_email: customerEmail,
            customer_name: customerName,
            items,
            subtotal,
            tax,
            total,
            shipping_address: shippingAddress,
            payment_method: paymentMethod,
            status: 'pending'
          })
          .select()
          .single();

        if (error) throw error;

        // Clear cart after order
        await supabase.from('cart_items').delete().eq('session_id', sessionId);

        return secureJsonResponse({ success: true, order }, 200, publicCorsHeaders);
      }

      case 'getOrder': {
        const sessionId = typeof data.sessionId === "string" && UUID_SESSION.test(data.sessionId) ? data.sessionId : "";
        const orderId = typeof data.orderId === "string" ? sanitizeString(data.orderId, 120) : "";
        if (!orderId || !sessionId) {
          return errorResponse("sessionId and orderId are required", 400, publicCorsHeaders);
        }
        // Only the visitor session that placed the order can read it back.
        const { data: order, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .eq('session_id', sessionId)
          .maybeSingle();
        if (error) throw error;
        if (!order) return errorResponse("Order not found", 404, publicCorsHeaders);
        return secureJsonResponse({ success: true, order }, 200, publicCorsHeaders);
      }

      // PRODUCT OPERATIONS
      case 'getProducts': {
        const category = typeof data.category === "string" ? sanitizeString(data.category, 80) : undefined;
        const requestedLimit = typeof data.limit === "number" ? Math.trunc(data.limit) : 50;
        const limit = Math.max(1, Math.min(100, requestedLimit));
        let query = supabase.from('products').select('*').eq('is_active', true);
        if (category) query = query.eq('category', category);
        const { data: products, error } = await query.limit(limit);
        if (error) throw error;
        return secureJsonResponse({ success: true, products: products || [] }, 200, publicCorsHeaders);
      }

      default:
        return errorResponse('Unknown action', 400, publicCorsHeaders);
    }
  } catch (error) {
    console.error('Template automation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500, publicCorsHeaders);
  }
});
