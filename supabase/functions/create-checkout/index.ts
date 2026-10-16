import { serve } from "serve";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyAuth, authError } from "../_shared/auth.ts";
import { secureJsonResponse, errorResponse } from "../_shared/response.ts";
import { safeParseBody, sanitizeString, isValidUrl, isTrustedReturnUrl } from "../_shared/validate.ts";

// Price IDs for each plan — must be set via Stripe dashboard env vars.
// If unset the checkout will fail with a clear 400 (not a silent Stripe rejection).
const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  pro: Deno.env.get("STRIPE_PRO_PRICE_ID"),
  business: Deno.env.get("STRIPE_BUSINESS_PRICE_ID"),
  pro_yearly: Deno.env.get("STRIPE_PRO_YEARLY_PRICE_ID"),
  business_yearly: Deno.env.get("STRIPE_BUSINESS_YEARLY_PRICE_ID"),
};

interface CreateCheckoutRequest {
  plan?: string;
  priceId?: string;
  successUrl?: string;
  cancelUrl?: string;
  billingCycle?: "monthly" | "yearly";
}

function getBaseAppUrl(req: Request): string {
  const configured = Deno.env.get("APP_URL") || Deno.env.get("SITE_URL");
  if (configured) {
    return configured;
  }

  const origin = req.headers.get("origin");
  if (origin && isValidUrl(origin)) {
    return origin;
  }

  return "https://unisontasks.com";
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req, corsHeaders);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return errorResponse("Billing service not configured", 503, corsHeaders);
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const auth = await verifyAuth(req);
    if (!auth.user) {
      return authError(auth.error || "Unauthorized", auth.status, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const user = auth.user;

    const { data: payload, error: parseError } = await safeParseBody<CreateCheckoutRequest>(req);
    if (parseError || !payload) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid request body", status, corsHeaders);
    }

    const {
      plan,
      priceId,
      successUrl,
      cancelUrl,
      billingCycle = "monthly",
    } = payload;

    if (billingCycle !== "monthly" && billingCycle !== "yearly") {
      return errorResponse("Invalid billing cycle", 400, corsHeaders);
    }

    const sanitizedPlan = typeof plan === "string" ? sanitizeString(plan, 50) : undefined;
    const sanitizedPriceId = typeof priceId === "string" ? sanitizeString(priceId, 200) : undefined;
    const baseUrl = getBaseAppUrl(req);
    const resolvedSuccessUrl = isTrustedReturnUrl(successUrl, req, [baseUrl])
      ? successUrl
      : `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const resolvedCancelUrl = isTrustedReturnUrl(cancelUrl, req, [baseUrl])
      ? cancelUrl
      : `${baseUrl}/checkout/cancel`;

    // Determine the price ID to use
    let stripePriceId = sanitizedPriceId;
    if (!stripePriceId && sanitizedPlan) {
      const planKey = billingCycle === "yearly" ? `${sanitizedPlan}_yearly` : sanitizedPlan;
      stripePriceId = PLAN_PRICE_IDS[planKey];
    }

    if (!stripePriceId) {
      return errorResponse("Invalid plan or price ID", 400, corsHeaders);
    }

    // Get or create customer
    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to subscription record
      await supabase
        .from("user_subscriptions")
        .upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
        }, { 
          onConflict: "user_id" 
        });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      success_url: resolvedSuccessUrl,
      cancel_url: resolvedCancelUrl,
      metadata: {
        supabase_user_id: user.id,
        plan: sanitizedPlan || "unknown",
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan: sanitizedPlan || "unknown",
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
    });

    return secureJsonResponse(
      { 
        sessionId: session.id, 
        url: session.url 
      },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error("Checkout error:", error);
    return errorResponse("Checkout failed", 400, getCorsHeaders(req));
  }
});
