import { serve } from "serve";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { publicCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { secureJsonResponse, errorResponse } from "../_shared/response.ts";
import {
  safeParseBody,
  sanitizeString,
  isValidEmail,
  isValidUrl,
  isTrustedReturnUrl,
  isValidUUID,
  isNonEmptyString,
} from "../_shared/validate.ts";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "../_shared/rateLimit.ts";

/**
 * create-order-checkout — Guest-friendly ecommerce checkout.
 * 
 * Unlike create-checkout (subscription-based, auth required), this function
 * supports guest/session-based checkout for product orders.
 * 
 * Accepts:
 *   - businessId (required)
 *   - sessionId (required — anonymous cart identifier)
 *   - userId (optional — if authenticated)
 *   - items[] (required — { productId, name, price, quantity })
 *   - customerEmail (optional — pre-fill Stripe)
 *   - successUrl / cancelUrl
 * 
 * Flow:
 *   1. Validate items against products table
 *   2. Create Stripe Checkout Session in payment mode
 *   3. Create pending order snapshot
 *   4. Return checkout URL
 */
interface CheckoutItem {
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  description?: string;
}

interface CreateOrderCheckoutRequest {
  businessId?: string;
  sessionId?: string;
  userId?: string;
  items?: CheckoutItem[];
  customerEmail?: string;
  successUrl?: string;
  cancelUrl?: string;
}

const RATE_LIMIT_CONFIG = { maxRequests: 15, windowSeconds: 300 };

function getBaseStoreUrl(req: Request): string {
  const configured = Deno.env.get("APP_URL") || Deno.env.get("SITE_URL");
  if (configured && isValidUrl(configured)) {
    return configured;
  }

  const origin = req.headers.get("origin");
  if (origin && isValidUrl(origin)) {
    return origin;
  }

  return "https://unisontasks.com";
}

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req, publicCorsHeaders);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, publicCorsHeaders);
  }

  const limiter = checkRateLimit("create-order-checkout", getClientIp(req), RATE_LIMIT_CONFIG);
  const rateHeaders = rateLimitHeaders(limiter, RATE_LIMIT_CONFIG);
  if (!limiter.allowed) {
    return secureJsonResponse(
      { success: false, error: "Too many checkout attempts. Please try again later." },
      429,
      publicCorsHeaders,
      rateHeaders,
    );
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return errorResponse("Billing service not configured", 503, publicCorsHeaders);
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: payload, error: parseError } = await safeParseBody<CreateOrderCheckoutRequest>(req);
    if (parseError || !payload) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid request body", status, publicCorsHeaders);
    }

    const {
      businessId,
      sessionId,
      userId,
      items,
      customerEmail,
      successUrl,
      cancelUrl,
    } = payload;

    const normalizedBusinessId = typeof businessId === "string" ? sanitizeString(businessId, 100) : "";
    const normalizedSessionId = typeof sessionId === "string" ? sanitizeString(sessionId, 200) : "";
    const normalizedUserId = typeof userId === "string" ? sanitizeString(userId, 100) : undefined;
    const normalizedCustomerEmail = typeof customerEmail === "string"
      ? sanitizeString(customerEmail, 255).toLowerCase()
      : undefined;
    const baseUrl = getBaseStoreUrl(req);
    const resolvedSuccessUrl = isTrustedReturnUrl(successUrl, req)
      ? successUrl
      : `${baseUrl}/thank-you?order_id={ORDER_ID}&session_id={CHECKOUT_SESSION_ID}`;
    const resolvedCancelUrl = isTrustedReturnUrl(cancelUrl, req)
      ? cancelUrl
      : `${baseUrl}/shop`;

    // ── Validate required fields ────────────────────────────────────────
    if (!normalizedBusinessId || !isValidUUID(normalizedBusinessId)) {
      return errorResponse("Invalid businessId format", 400, publicCorsHeaders);
    }
    if (!normalizedSessionId) {
      return errorResponse("sessionId is required", 400, publicCorsHeaders);
    }
    if (normalizedUserId && !isValidUUID(normalizedUserId)) {
      return errorResponse("Invalid userId format", 400, publicCorsHeaders);
    }
    if (normalizedCustomerEmail && !isValidEmail(normalizedCustomerEmail)) {
      return errorResponse("Invalid customerEmail format", 400, publicCorsHeaders);
    }
    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse("items[] is required and must not be empty", 400, publicCorsHeaders);
    }

    // ── Validate item structure; prices come from the server only ───────
    if (items.length > 50) {
      return errorResponse("Too many items", 400, publicCorsHeaders);
    }
    const requested = items.map((item) => ({
      productId: typeof item?.productId === "string" ? sanitizeString(item.productId, 100) : "",
      quantity: typeof item?.quantity === "number" ? item.quantity : NaN,
    }));
    for (const item of requested) {
      if (!item.productId || !isValidUUID(item.productId)) {
        return errorResponse("Every item needs a valid productId", 400, publicCorsHeaders);
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100) {
        return errorResponse("Item quantity must be between 1 and 100", 400, publicCorsHeaders);
      }
    }

    const productIds = [...new Set(requested.map((i) => i.productId))];
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, description, price, is_active, business_id")
      .in("id", productIds)
      .eq("business_id", normalizedBusinessId)
      .eq("is_active", true);
    if (productsError) {
      console.error("Product lookup error:", productsError);
      return errorResponse("Could not load products", 500, publicCorsHeaders);
    }
    const byId = new Map((products ?? []).map((p) => [p.id as string, p]));

    const sanitizedItems: Array<{ productId: string; name: string; description?: string; price: number; quantity: number }> = [];
    for (const item of requested) {
      const product = byId.get(item.productId);
      const price = product ? Number(product.price) : NaN;
      if (!product || !Number.isFinite(price) || price <= 0) {
        return errorResponse("One or more products are unavailable", 400, publicCorsHeaders);
      }
      sanitizedItems.push({
        productId: item.productId,
        name: sanitizeString(String(product.name ?? "Item"), 200),
        description: product.description ? sanitizeString(String(product.description), 500) : undefined,
        price,
        quantity: item.quantity,
      });
    }

    // ── Build Stripe line items ─────────────────────────────────────────
    const lineItems = sanitizedItems.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
          ...(item.description ? { description: item.description } : {}),
        },
        unit_amount: Math.round(item.price * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    // ── Calculate order total ───────────────────────────────────────────
    const subtotal = sanitizedItems.reduce(
      (sum: number, item) => sum + item.price * item.quantity,
      0,
    );

    // ── Create pending order ────────────────────────────────────────────
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        business_id: normalizedBusinessId,
        session_id: normalizedSessionId,
        user_id: normalizedUserId || null,
        customer_email: normalizedCustomerEmail || "pending@checkout.com",
        items: JSON.stringify(sanitizedItems),
        subtotal,
        total: subtotal,
        status: "pending",
        payment_method: "stripe",
      })
      .select("id")
      .single();

    if (orderError) {
      console.error("Order creation error:", orderError);
      throw new Error("Failed to create order record");
    }

    // ── Create Stripe Checkout Session ──────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      ...(normalizedCustomerEmail ? { customer_email: normalizedCustomerEmail } : {}),
      success_url:
        resolvedSuccessUrl.replace("{ORDER_ID}", order.id),
      cancel_url:
        resolvedCancelUrl,
      metadata: {
        order_id: order.id,
        business_id: normalizedBusinessId,
        session_id: normalizedSessionId,
        ...(normalizedUserId ? { user_id: normalizedUserId } : {}),
      },
      billing_address_collection: "auto",
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU"],
      },
    });

    // ── Update order with payment intent ────────────────────────────────
    await supabase
      .from("orders")
      .update({
        payment_intent_id: session.payment_intent as string,
      })
      .eq("id", order.id);

    return secureJsonResponse(
      {
        sessionId: session.id,
        url: session.url,
        orderId: order.id,
      },
      200,
      publicCorsHeaders,
    );
  } catch (error) {
    console.error("Order checkout error:", error);
    return errorResponse("Order checkout failed", 400, publicCorsHeaders);
  }
});
