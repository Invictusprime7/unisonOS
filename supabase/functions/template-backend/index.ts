// Template Backend Handler - Handles redirects, scheduling, authentication, and payment for templates
// Deploy with: supabase functions deploy template-backend

import { serve } from 'serve';
import { createClient } from '@supabase/supabase-js';
import { publicCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyAuth, authError } from "../_shared/auth.ts";
import { errorResponse, secureJsonResponse } from "../_shared/response.ts";
import { safeParseBody, sanitizeString, isValidUUID } from "../_shared/validate.ts";

interface TemplateRedirect {
  id: string;
  path: string;
  destination: string;
  statusCode: 301 | 302 | 307 | 308;
  enabled: boolean;
}

interface TemplateScheduling {
  publishAt?: string;
  unpublishAt?: string;
  timezone?: string;
  recurring?: {
    enabled: boolean;
    cron?: string;
    action: 'publish' | 'unpublish' | 'toggle';
  };
}

interface TemplatePayment {
  enabled: boolean;
  provider?: 'stripe' | 'paypal' | 'custom';
  priceId?: string;
  amount?: number;
  currency?: string;
  mode?: 'payment' | 'subscription';
  successUrl?: string;
  cancelUrl?: string;
  webhookSecret?: string;
}

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req, publicCorsHeaders);
  if (preflight) {
    return preflight;
  }

  if (!["GET", "POST", "PUT"].includes(req.method)) {
    return errorResponse("Method not allowed", 405, publicCorsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = sanitizeString(url.searchParams.get('action') || '', 80);
    const templateIdParam = url.searchParams.get('templateId');
    const templateId = isValidUUID(templateIdParam) ? templateIdParam : null;

    // Parse request body if present
    let body: Record<string, unknown> | null = null;
    if (req.method === 'POST' || req.method === 'PUT') {
      const parsedBody = await safeParseBody<Record<string, unknown>>(req, 65_536);
      if (parsedBody.error) {
        const status = parsedBody.error.includes("exceeds") ? 413 : 400;
        return errorResponse(parsedBody.error, status, publicCorsHeaders);
      }
      body = parsedBody.data;
    }

    switch (action) {
      case 'check-redirect': {
        // Check if a path matches any template redirect
        const path = sanitizeString(url.searchParams.get('path') || '', 500);
        if (!path) {
          return errorResponse('Path is required', 400, publicCorsHeaders);
        }

        const { data: templates, error } = await supabase
          .from('templates')
          .select('id, redirects')
          .not('redirects', 'is', null);

        if (error) throw error;

        for (const template of templates || []) {
          const redirects = template.redirects as TemplateRedirect[] || [];
          const match = redirects.find(r => r.enabled && r.path === path);
          if (match) {
            return secureJsonResponse({
              redirect: true,
              destination: match.destination,
              statusCode: match.statusCode,
              templateId: template.id,
            }, 200, publicCorsHeaders);
          }
        }

        return secureJsonResponse({ redirect: false }, 200, publicCorsHeaders);
      }

      case 'check-access': {
        // Check if user has access to a template (authentication check)
        if (!templateId) {
          return errorResponse('Template ID is required', 400, publicCorsHeaders);
        }

        const authHeader = req.headers.get('Authorization');
        let userId: string | null = null;

        if (authHeader) {
          const token = authHeader.replace('Bearer ', '');
          const { data: { user } } = await supabase.auth.getUser(token);
          userId = user?.id || null;
        }

        const { data: template, error } = await supabase
          .from('templates')
          .select('id, requires_auth, owner_id, visibility')
          .eq('id', templateId)
          .single();

        if (error) throw error;

        if (!template) {
          return secureJsonResponse({ access: false, reason: 'Template not found' }, 404, publicCorsHeaders);
        }

        // Public templates - always accessible
        if (template.visibility === 'public' && !template.requires_auth) {
          return secureJsonResponse({ access: true }, 200, publicCorsHeaders);
        }

        // Requires authentication
        if (template.requires_auth && !userId) {
          return secureJsonResponse({ access: false, reason: 'Authentication required' }, 401, publicCorsHeaders);
        }

        // Owner always has access
        if (userId === template.owner_id) {
          return secureJsonResponse({ access: true }, 200, publicCorsHeaders);
        }

        // Private templates - only owner
        if (template.visibility === 'private') {
          return secureJsonResponse({ access: false, reason: 'Private template' }, 403, publicCorsHeaders);
        }

        return secureJsonResponse({ access: true }, 200, publicCorsHeaders);
      }

      case 'process-scheduling': {
        const auth = await verifyAuth(req);
        if (!auth.user) {
          return authError(auth.error || "Unauthorized", auth.status, publicCorsHeaders);
        }

        // Process scheduled publish/unpublish actions
        const now = new Date().toISOString();

        // Find templates that should be published
        const { data: toPublish, error: publishError } = await supabase
          .from('templates')
          .select('id, scheduling')
          .eq('status', 'draft')
          .not('scheduling', 'is', null);

        if (publishError) throw publishError;

        const publishResults: string[] = [];
        for (const template of toPublish || []) {
          const scheduling = template.scheduling as TemplateScheduling;
          if (scheduling?.publishAt && new Date(scheduling.publishAt) <= new Date(now)) {
            await supabase
              .from('templates')
              .update({ status: 'published', scheduling: { ...scheduling, publishAt: null } })
              .eq('id', template.id);
            publishResults.push(template.id);
          }
        }

        // Find templates that should be unpublished
        const { data: toUnpublish, error: unpublishError } = await supabase
          .from('templates')
          .select('id, scheduling')
          .eq('status', 'published')
          .not('scheduling', 'is', null);

        if (unpublishError) throw unpublishError;

        const unpublishResults: string[] = [];
        for (const template of toUnpublish || []) {
          const scheduling = template.scheduling as TemplateScheduling;
          if (scheduling?.unpublishAt && new Date(scheduling.unpublishAt) <= new Date(now)) {
            await supabase
              .from('templates')
              .update({ status: 'archived', scheduling: { ...scheduling, unpublishAt: null } })
              .eq('id', template.id);
            unpublishResults.push(template.id);
          }
        }

        return secureJsonResponse({
          processed: true,
          published: publishResults,
          unpublished: unpublishResults,
        }, 200, publicCorsHeaders);
      }

      case 'create-payment-session': {
        // Create a payment session for a template
        if (!templateId) {
          return errorResponse('Template ID is required', 400, publicCorsHeaders);
        }

        const { data: template, error } = await supabase
          .from('templates')
          .select('id, payment, name')
          .eq('id', templateId)
          .single();

        if (error) throw error;

        const payment = template.payment as TemplatePayment;
        if (!payment?.enabled) {
          return errorResponse('Payment not enabled for this template', 400, publicCorsHeaders);
        }

        // Stripe integration
        if (payment.provider === 'stripe') {
          const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
          if (!stripeSecretKey) {
            return errorResponse('Stripe not configured', 500, publicCorsHeaders);
          }

          const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${stripeSecretKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              'mode': payment.mode || 'payment',
              'line_items[0][price]': payment.priceId || '',
              'line_items[0][quantity]': '1',
              'success_url': payment.successUrl || `${url.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
              'cancel_url': payment.cancelUrl || `${url.origin}/cancel`,
              'metadata[template_id]': templateId,
            }),
          });

          const session = await stripeResponse.json();
          return secureJsonResponse({
            sessionId: session.id,
            url: session.url,
          }, 200, publicCorsHeaders);
        }

        return errorResponse('Unsupported payment provider', 400, publicCorsHeaders);
      }

      case 'verify-payment': {
        // Verify a payment session
        const sessionId = sanitizeString(url.searchParams.get('sessionId') || '', 200);
        if (!sessionId) {
          return errorResponse('Session ID is required', 400, publicCorsHeaders);
        }
        if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) {
          return errorResponse('Invalid session ID', 400, publicCorsHeaders);
        }

        const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
        if (!stripeSecretKey) {
          return errorResponse('Stripe not configured', 500, publicCorsHeaders);
        }

        const stripeResponse = await fetch(
          `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
          {
            headers: {
              'Authorization': `Bearer ${stripeSecretKey}`,
            },
          }
        );

        const session = await stripeResponse.json();
        // Customer details are never returned to an unauthenticated caller.
        return secureJsonResponse({
          verified: session.payment_status === 'paid',
          templateId: session.metadata?.template_id,
        }, 200, publicCorsHeaders);
      }

      default:
        return errorResponse('Invalid action', 400, publicCorsHeaders);
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Template backend error:', error);
    return errorResponse(errMsg, 500, publicCorsHeaders);
  }
});
