import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts'
import { checkRateLimit, getClientIp, rateLimitHeaders } from '../_shared/rateLimit.ts'
import { secureJsonResponse, errorResponse } from '../_shared/response.ts'
import { isValidUUID, safeParseBody, sanitizeString } from '../_shared/validate.ts'
import { verifyAuth, verifyBusinessAccess, authError } from '../_shared/auth.ts'

const INTENT_PATTERN = /^[a-zA-Z0-9._-]+$/
const RATE_LIMIT_CONFIG = { maxRequests: 60, windowSeconds: 60 }

interface EventPayload {
  businessId: string
  pluginInstanceId?: string
  intent: string
  payload: Record<string, unknown>
  dedupeKey?: string
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  const preflight = handleCorsPreflightRequest(req, corsHeaders)
  if (preflight) {
    return preflight
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders)
  }

  const limiter = checkRateLimit(
    'plugin-event-ingest',
    getClientIp(req),
    RATE_LIMIT_CONFIG,
  )
  const rateHeaders = rateLimitHeaders(limiter, RATE_LIMIT_CONFIG)

  if (!limiter.allowed) {
    return secureJsonResponse(
      {
        success: false,
        error: 'Too many requests. Please try again later.',
        retryAfterSeconds: limiter.retryAfterSeconds,
      },
      429,
      corsHeaders,
      rateHeaders,
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[plugin-event-ingest] Missing Supabase configuration')
      return secureJsonResponse(
        { success: false, error: 'Service temporarily unavailable' },
        503,
        corsHeaders,
        rateHeaders,
      )
    }
    
    // Use service role for event ingestion (RLS requires service_role for inserts)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { data: body, error: bodyError } = await safeParseBody<EventPayload>(req, 65_536)
    if (!body || bodyError) {
      return errorResponse(bodyError || 'Invalid request body', 400, corsHeaders)
    }
    
    // Validate required fields
    if (!isValidUUID(body.businessId)) {
      console.error('[plugin-event-ingest] Missing businessId')
      return errorResponse('businessId must be a valid UUID', 400, corsHeaders)
    }

    const intent = sanitizeString(body.intent || '', 120)
    if (!intent || !INTENT_PATTERN.test(intent)) {
      console.error('[plugin-event-ingest] Missing or empty intent')
      return errorResponse(
        'intent is required and may only include letters, numbers, dots, dashes, and underscores',
        400,
        corsHeaders,
      )
    }

    if (body.pluginInstanceId && !isValidUUID(body.pluginInstanceId)) {
      return errorResponse('pluginInstanceId must be a valid UUID', 400, corsHeaders)
    }

    if (body.payload && (typeof body.payload !== 'object' || Array.isArray(body.payload))) {
      return errorResponse('payload must be an object', 400, corsHeaders)
    }

    // Only a signed-in member of the business may queue events for it.
    const auth = await verifyAuth(req)
    if (!auth.user) return authError(auth.error || 'Unauthorized', auth.status, corsHeaders)
    const access = await verifyBusinessAccess(auth.user.id, body.businessId)
    if (!access.allowed) return authError(access.error || 'Access denied', 403, corsHeaders)

    // Verify business exists
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', body.businessId)
      .single()

    if (businessError || !business) {
      console.error('[plugin-event-ingest] Business not found:', body.businessId)
      return errorResponse('Business not found', 404, corsHeaders)
    }

    // If pluginInstanceId provided, verify it exists and is enabled
    if (body.pluginInstanceId) {
      const { data: instance, error: instanceError } = await supabase
        .from('ai_plugin_instances')
        .select('id, is_enabled')
        .eq('id', body.pluginInstanceId)
        .eq('business_id', body.businessId)
        .single()

      if (instanceError || !instance) {
        console.error('[plugin-event-ingest] Plugin instance not found:', body.pluginInstanceId)
        return errorResponse('Plugin instance not found', 404, corsHeaders)
      }

      if (!instance.is_enabled) {
        console.log('[plugin-event-ingest] Plugin instance disabled, skipping:', body.pluginInstanceId)
        return secureJsonResponse(
          { status: 'skipped', reason: 'Plugin instance is disabled' },
          200,
          corsHeaders,
          rateHeaders,
        )
      }
    }

    // Dedupe check: if dedupeKey provided, check for recent duplicate
    if (body.dedupeKey) {
      const dedupeWindowMinutes = 60 // Default 1 hour window
      const dedupeThreshold = new Date(Date.now() - dedupeWindowMinutes * 60 * 1000).toISOString()

      const { data: existingEvent } = await supabase
        .from('ai_events')
        .select('id')
        .eq('business_id', body.businessId)
        .eq('dedupe_key', body.dedupeKey)
        .gte('created_at', dedupeThreshold)
        .limit(1)
        .single()

      if (existingEvent) {
        console.log('[plugin-event-ingest] Duplicate event detected, skipping:', body.dedupeKey)
        return secureJsonResponse(
          { 
            status: 'skipped', 
            reason: 'Duplicate event within dedupe window',
            existingEventId: existingEvent.id 
          },
          200,
          corsHeaders,
          rateHeaders,
        )
      }
    }

    // Insert the event
    const { data: event, error: insertError } = await supabase
      .from('ai_events')
      .insert({
        business_id: body.businessId,
        plugin_instance_id: body.pluginInstanceId || null,
        intent,
        payload: body.payload || {},
        dedupe_key: body.dedupeKey || null,
        status: 'pending',
      })
      .select('id, created_at')
      .single()

    if (insertError) {
      console.error('[plugin-event-ingest] Failed to insert event:', insertError)
      return errorResponse('Failed to create event', 500, corsHeaders)
    }

    console.log('[plugin-event-ingest] Event created:', {
      eventId: event.id,
      businessId: body.businessId,
      intent,
      pluginInstanceId: body.pluginInstanceId,
    })

    return secureJsonResponse(
      { 
        status: 'queued',
        eventId: event.id,
        createdAt: event.created_at,
      },
      201,
      corsHeaders,
      rateHeaders,
    )

  } catch (error) {
    console.error('[plugin-event-ingest] Unexpected error:', error)
    return errorResponse('Internal server error', 500, corsHeaders)
  }
})
