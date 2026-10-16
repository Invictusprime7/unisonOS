import { serve } from "serve";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyAuth, authError } from "../_shared/auth.ts";
import { secureJsonResponse, errorResponse } from "../_shared/response.ts";
import { safeParseBody, sanitizeString, isValidUrl, isTrustedReturnUrl } from "../_shared/validate.ts";

interface ManageSubscriptionRequest {
  action: "cancel" | "reactivate" | "update-payment" | "get-invoices";
  immediately?: boolean;
  returnUrl?: string;
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

    const { data: payload, error: parseError } = await safeParseBody<ManageSubscriptionRequest>(req);
    if (parseError || !payload) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid request body", status, corsHeaders);
    }

    const action = typeof payload.action === "string"
      ? sanitizeString(payload.action, 50) as ManageSubscriptionRequest["action"]
      : undefined;
    const immediately = payload.immediately === true;
    const returnUrl = isTrustedReturnUrl(payload.returnUrl, req)
      ? payload.returnUrl
      : `${getBaseAppUrl(req)}/settings`;

    if (!action) {
      return errorResponse("Action is required", 400, corsHeaders);
    }

    // Get user's subscription
    const { data: subscription, error: subError } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (subError || !subscription) {
      return errorResponse("No subscription found", 404, corsHeaders);
    }

    switch (action) {
      case "cancel": {
        if (!subscription.stripe_subscription_id) {
          return errorResponse("No active subscription to cancel", 400, corsHeaders);
        }

        if (immediately) {
          // Cancel immediately
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
          
          // Update database
          await supabase
            .from("user_subscriptions")
            .update({
              plan: "free",
              status: "canceled",
              stripe_subscription_id: null,
              current_period_start: null,
              current_period_end: null,
              cancel_at_period_end: false,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id);
        } else {
          // Cancel at period end
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: true,
          });

          await supabase
            .from("user_subscriptions")
            .update({
              cancel_at_period_end: true,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id);
        }

        return secureJsonResponse({ success: true }, 200, corsHeaders);
      }

      case "reactivate": {
        if (!subscription.stripe_subscription_id) {
          return errorResponse("No subscription to reactivate", 400, corsHeaders);
        }

        // Remove cancel_at_period_end
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          cancel_at_period_end: false,
        });

        await supabase
          .from("user_subscriptions")
          .update({
            cancel_at_period_end: false,
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        return secureJsonResponse({ success: true }, 200, corsHeaders);
      }

      case "update-payment": {
        if (!subscription.stripe_customer_id) {
          return errorResponse("No customer found", 400, corsHeaders);
        }

        // Create a billing portal session
        const session = await stripe.billingPortal.sessions.create({
          customer: subscription.stripe_customer_id,
          return_url: returnUrl,
        });

        return secureJsonResponse({ url: session.url }, 200, corsHeaders);
      }

      case "get-invoices": {
        if (!subscription.stripe_customer_id) {
          return secureJsonResponse({ invoices: [] }, 200, corsHeaders);
        }

        const invoices = await stripe.invoices.list({
          customer: subscription.stripe_customer_id,
          limit: 12,
        });

        const formattedInvoices = invoices.data.map((inv: Stripe.Invoice) => ({
          id: inv.id,
          amount: (inv.amount_paid || 0) / 100,
          currency: inv.currency,
          status: inv.status,
          date: new Date(inv.created * 1000).toISOString(),
          invoice_pdf: inv.invoice_pdf,
          hosted_invoice_url: inv.hosted_invoice_url,
        }));

        return secureJsonResponse({ invoices: formattedInvoices }, 200, corsHeaders);
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400, corsHeaders);
    }
  } catch (error) {
    console.error("Manage subscription error:", error);
    return errorResponse("Subscription management failed", 400, getCorsHeaders(req));
  }
});
