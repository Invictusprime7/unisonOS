import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts'
import { secureJsonResponse, errorResponse } from '../_shared/response.ts'
import { verifyAuth, verifyBusinessAccess, authError } from '../_shared/auth.ts'
import { safeParseBody, isValidUUID, sanitizeString } from '../_shared/validate.ts'
import { createChatCompletion } from '../_shared/ai/providerClient.ts'
import { DEFAULT_GEMINI_GATEWAY_MODEL } from '../_shared/geminiModel.ts'
import { createCanonicalBooking } from '../_shared/canonicalBooking.ts'
import { createCrmLead, updateCrmLead } from '../_shared/canonicalCrm.ts'

// =============================================================================
// Types
// =============================================================================

// deno-lint-ignore no-explicit-any
type ToolHandler = (payload: Record<string, unknown>, context: ToolContext) => Promise<Record<string, unknown>>

interface ToolContext {
  // deno-lint-ignore no-explicit-any
  supabase: any
  businessId: string
  pluginInstanceId: string | null
  eventId: string
  siteId: string | null
}

interface ToolResult {
  tool: string
  success: boolean
  result?: Record<string, unknown>
  error?: string
}

interface AgentRunnerRequest {
  eventId?: string
  businessId?: string
}

// =============================================================================
// Tool Handlers
// =============================================================================

// --- CRM Tools ---

const crmLeadCreate: ToolHandler = async (payload, context) => {
  const result = await createCrmLead(context.supabase, { businessId: context.businessId }, {
    title: `Lead: ${payload.name || payload.email}`,
    name: typeof payload.name === 'string' ? payload.name : null,
    email: typeof payload.email === 'string' ? payload.email : null,
    stage: 'new',
    metadata: { score: payload.score, source: 'ai_agent' },
    intent: (payload.intent as string) || 'contact.submit',
    source: 'ai_agent',
    contact: {
      email: typeof payload.email === 'string' ? payload.email : null,
      firstName: typeof payload.name === 'string' ? payload.name : null,
      source: 'ai_agent',
    },
  })
  console.log('[agent-runner] crm.lead.create:', result.leadId)
  return { leadId: result.leadId, success: true }
}

const pipelineStageSet: ToolHandler = async (payload, context) => {
  if (!payload.leadId) {
    throw new Error('leadId is required for pipeline.stage.set')
  }

  await updateCrmLead(context.supabase, { businessId: context.businessId }, String(payload.leadId), { stage: String(payload.stage) })
  console.log('[agent-runner] pipeline.stage.set:', payload.leadId, '->', payload.stage)
  return { updated: true, stage: payload.stage }
}

// --- Notification Tools ---

const notifyTeam: ToolHandler = async (payload, context) => {
  const { data: business } = await context.supabase
    .from('businesses')
    .select('notification_email, owner_id')
    .eq('id', context.businessId)
    .single()

  const notifyEmail = business?.notification_email

  console.log('[agent-runner] notify.team:', {
    to: notifyEmail || 'owner',
    message: payload.message,
    priority: payload.priority || 'normal',
  })

  // TODO: Integrate with Resend for actual email delivery
  return { notified: true, channel: 'email' }
}

// --- State Tools ---

const statePatch: ToolHandler = async (payload, context) => {
  if (!context.pluginInstanceId) {
    console.log('[agent-runner] state.patch skipped - no plugin instance')
    return { patched: false, reason: 'no_plugin_instance' }
  }

  const stateKey = (payload.key as string) || 'agent_state'
  const patch = payload.patch as Record<string, unknown>

  const { data: existing } = await context.supabase
    .from('ai_plugin_state')
    .select('state')
    .eq('plugin_instance_id', context.pluginInstanceId)
    .eq('state_key', stateKey)
    .single()

  const currentState = existing?.state || {}
  const newState = { ...currentState, ...patch, _lastPatchedAt: new Date().toISOString() }

  const { error } = await context.supabase
    .from('ai_plugin_state')
    .upsert(
      {
        plugin_instance_id: context.pluginInstanceId,
        state_key: stateKey,
        state: newState,
      },
      { onConflict: 'plugin_instance_id,state_key' }
    )

  if (error) throw new Error(`Failed to patch state: ${error.message}`)
  console.log('[agent-runner] state.patch:', stateKey, Object.keys(patch))
  return { patched: true, stateKey }
}

// --- Calendar Tools (Phase 2 - Booking Agent) ---

const calendarCheck: ToolHandler = async (payload, context) => {
  const { date, service_id, duration_minutes } = payload
  
  const requestedDate = new Date(date as string)
  const startOfDay = new Date(requestedDate)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(requestedDate)
  endOfDay.setHours(23, 59, 59, 999)

  let query = context.supabase
    .from('availability_slots')
    .select('id, starts_at, ends_at, service_id, is_booked')
    .eq('business_id', context.businessId)
    .eq('is_booked', false)
    .gte('starts_at', startOfDay.toISOString())
    .lte('starts_at', endOfDay.toISOString())
    .order('starts_at', { ascending: true })

  if (service_id) {
    query = query.eq('service_id', service_id)
  }

  const { data: slots, error } = await query

  if (error) throw new Error(`Failed to check calendar: ${error.message}`)

  const requestedDuration = (duration_minutes as number) || 30
  // deno-lint-ignore no-explicit-any
  const availableSlots = (slots || []).filter((slot: any) => {
    const slotStart = new Date(slot.starts_at)
    const slotEnd = new Date(slot.ends_at)
    const slotDuration = (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60)
    return Boolean(slot.service_id) && slotDuration >= requestedDuration
  })

  // deno-lint-ignore no-explicit-any
  const formattedSlots = availableSlots.map((slot: any) => {
    const start = new Date(slot.starts_at)
    return {
      id: slot.id,
      service_id: slot.service_id,
      time: start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
    }
  })

  console.log('[agent-runner] calendar.check:', { date, slotsFound: formattedSlots.length })

  return {
    available: formattedSlots.length > 0,
    slots: formattedSlots,
    date: date as string,
    message: formattedSlots.length > 0 
      ? `Found ${formattedSlots.length} available slots`
      : 'No available slots for this date',
  }
}

async function resolveAgentBookingSite(context: ToolContext): Promise<string> {
  if (!context.siteId) {
    throw new Error('calendar.book requires a provisioned canonical site')
  }
  return context.siteId
}

async function loadGeneratedAgentAuthorization(
  supabase: ToolContext['supabase'],
  businessId: string,
  pluginInstanceId: string | null,
  intent: string,
): Promise<{ agentSlug: string; allowedTools: string[]; siteId: string }> {
  if (!pluginInstanceId) throw new Error('Generated agent event requires a plugin instance')
  const { data: instance, error: instanceError } = await supabase
    .from('ai_plugin_instances')
    .select('project_id,agent_id,is_enabled')
    .eq('id', pluginInstanceId)
    .eq('business_id', businessId)
    .single()
  if (instanceError || !instance?.is_enabled || !instance.project_id) {
    throw new Error('Generated agent plugin is unavailable')
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('site_id')
    .eq('id', instance.project_id)
    .eq('business_id', businessId)
    .single()
  if (projectError || !project?.site_id) throw new Error('Generated agent site is unavailable')

  const { data: runtime, error: runtimeError } = await supabase
    .from('site_runtime_configs')
    .select('public_runtime_enabled,settings')
    .eq('site_id', project.site_id)
    .single()
  const manifest = runtime?.settings?.generatedSiteRuntimeManifest
  if (runtimeError || !runtime?.public_runtime_enabled || manifest?.readiness?.status !== 'ready') {
    throw new Error('Generated agent runtime is not ready')
  }
  if (manifest.siteId !== project.site_id || !Array.isArray(manifest.agents)) {
    throw new Error('Generated agent runtime identity is invalid')
  }

  const binding = manifest.agents.find((candidate: Record<string, unknown>) =>
    Array.isArray(candidate.intents) && candidate.intents.includes(intent)
  )
  if (
    !binding ||
    typeof binding.agentSlug !== 'string' ||
    !Array.isArray(binding.allowedTools) ||
    !binding.allowedTools.every((tool: unknown) => typeof tool === 'string') ||
    !Array.isArray(binding.requiredCapabilities) ||
    !binding.requiredCapabilities.every((capability: unknown) =>
      Array.isArray(manifest.enabledCapabilities) && manifest.enabledCapabilities.includes(capability)
    )
  ) {
    throw new Error(`Generated agent intent ${intent} is not authorized`)
  }
  const { data: registryAgent, error: registryError } = await supabase
    .from('ai_agent_registry')
    .select('id')
    .eq('slug', binding.agentSlug)
    .eq('is_active', true)
    .single()
  if (registryError || !registryAgent?.id || registryAgent.id !== instance.agent_id) {
    throw new Error('Generated agent plugin does not match the runtime manifest')
  }
  return {
    agentSlug: binding.agentSlug,
    allowedTools: binding.allowedTools,
    siteId: project.site_id,
  }
}

async function resolveAgentBookingSelection(
  payload: Record<string, unknown>,
  context: ToolContext,
): Promise<{ slotId: string; serviceId: string }> {
  const suppliedSlotId = typeof payload.slot_id === 'string' ? payload.slot_id : ''
  const suppliedServiceId = typeof payload.service_id === 'string' ? payload.service_id : ''
  if (isValidUUID(suppliedSlotId) && isValidUUID(suppliedServiceId)) {
    return { slotId: suppliedSlotId, serviceId: suppliedServiceId }
  }

  let serviceId = isValidUUID(suppliedServiceId) ? suppliedServiceId : ''
  const serviceName = sanitizeString(payload.service_name as string || '', 160).trim()
  if (!serviceId && serviceName) {
    const { data: service } = await context.supabase
      .from('services')
      .select('id')
      .eq('business_id', context.businessId)
      .eq('name', serviceName)
      .eq('is_active', true)
      .maybeSingle()
    serviceId = service?.id || ''
  }
  if (!serviceId) {
    const { data: services } = await context.supabase
      .from('services')
      .select('id')
      .eq('business_id', context.businessId)
      .eq('is_active', true)
      .limit(2)
    if (services?.length === 1) serviceId = services[0].id
  }

  const startsAtInput = typeof payload.starts_at === 'string'
    ? payload.starts_at
    : typeof payload.date === 'string' && typeof payload.time === 'string'
      ? `${payload.date}T${payload.time}`
      : ''
  const startsAt = new Date(startsAtInput)
  if (!isValidUUID(serviceId) || !startsAtInput || Number.isNaN(startsAt.getTime())) {
    throw new Error('calendar.book requires a service and an existing availability slot')
  }

  const { data: slot, error: slotError } = await context.supabase
    .from('availability_slots')
    .select('id,service_id')
    .eq('business_id', context.businessId)
    .eq('service_id', serviceId)
    .eq('starts_at', startsAt.toISOString())
    .eq('is_booked', false)
    .maybeSingle()
  if (slotError || !slot?.id) {
    throw new Error('calendar.book could not resolve the requested time to an available slot')
  }
  return { slotId: slot.id, serviceId: slot.service_id }
}

const calendarBook: ToolHandler = async (payload, context) => {
  const { slotId, serviceId } = await resolveAgentBookingSelection(payload, context)
  const customerName = sanitizeString(payload.customer_name as string || '', 120).trim()
  const customerEmail = sanitizeString(payload.customer_email as string || '', 255).trim().toLowerCase()
  const customerPhone = sanitizeString(payload.customer_phone as string || '', 40).trim() || null
  const notes = sanitizeString(payload.notes as string || '', 2_000).trim() || null

  if (customerName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    throw new Error('calendar.book requires a valid customer name and email')
  }

  const siteId = await resolveAgentBookingSite(context)
  const state = await createCanonicalBooking({
    businessId: context.businessId,
    siteId,
    serviceId,
    slotId,
    sessionId: `agent:${context.pluginInstanceId}`,
    idempotencyKey: `agent:${context.eventId}`,
    customerName,
    customerEmail,
    customerPhone,
    notes,
    source: 'agent-runner/calendar.book',
  })
  const startsAt = new Date(state.booking.startsAt)
  const endsAt = new Date(state.booking.endsAt)

  console.log('[agent-runner] calendar.book:', {
    bookingId: state.booking.id,
    siteId,
    slotId,
    duplicate: state.duplicate,
  })
  return {
    success: true,
    bookingId: state.booking.id,
    duplicate: state.duplicate,
    confirmation: {
      date: startsAt.toISOString().slice(0, 10),
      time: startsAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      duration: Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000),
      customer: customerName,
      service: state.booking.serviceName,
    },
  }
}

// --- Agent Routing Tools (Orchestrator) ---

const agentRoute: ToolHandler = async (payload, _context) => {
  console.log('[agent-runner] agent.route:', payload.targetAgent)
  return {
    routed: true,
    targetAgent: payload.targetAgent,
    priority: payload.priority || 'normal',
  }
}

const agentInvoke: ToolHandler = async (payload, context) => {
  const { data, error } = await context.supabase
    .from('ai_events')
    .insert({
      business_id: context.businessId,
      plugin_instance_id: context.pluginInstanceId,
      intent: payload.intent as string,
      payload: payload.eventPayload || {},
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to invoke agent: ${error.message}`)
  
  console.log('[agent-runner] agent.invoke:', { eventId: data.id, intent: payload.intent })

  return {
    invoked: true,
    eventId: data.id,
    intent: payload.intent,
  }
}

// =============================================================================
// Tool Registry
// =============================================================================

const toolHandlers: Record<string, ToolHandler> = {
  // CRM
  'crm.lead.create': crmLeadCreate,
  'pipeline.stage.set': pipelineStageSet,
  
  // Notifications
  'notify.team': notifyTeam,
  
  // State
  'state.patch': statePatch,
  
  // Calendar (Phase 2)
  'calendar.check': calendarCheck,
  'calendar.book': calendarBook,
  
  // Agent routing (Orchestrator)
  'agent.route': agentRoute,
  'agent.invoke': agentInvoke,
}

async function executeTool(
  toolId: string,
  payload: Record<string, unknown>,
  context: ToolContext
): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
  const handler = toolHandlers[toolId]
  if (!handler) {
    console.warn('[agent-runner] Unknown tool:', toolId)
    return { success: false, error: `Unknown tool: ${toolId}` }
  }

  try {
    const result = await handler(payload, context)
    return { success: true, result }
  } catch (err) {
    const error = err as Error
    console.error('[agent-runner] Tool execution failed:', toolId, error)
    return { success: false, error: error.message }
  }
}

// =============================================================================
// LLM Integration
// =============================================================================

async function callLLM(
  systemPrompt: string,
  userPayload: Record<string, unknown>
): Promise<{ 
  score?: number
  tags?: string[]
  stage?: string
  outcome?: string
  notes?: string
  action?: string
  proposedToolCalls?: Array<{ tool: string; payload: Record<string, unknown> }>
  // deno-lint-ignore no-explicit-any
  [key: string]: any 
}> {
  const response = await createChatCompletion({
    model: DEFAULT_GEMINI_GATEWAY_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userPayload, null, 2) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[agent-runner] AI provider call failed:', response.status, errorText)
    throw new Error(`LLM call failed: ${response.status}`)
  }

  const result = await response.json()
  const content = result.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('No content in LLM response')
  }

  try {
    return JSON.parse(content)
  } catch {
    console.error('[agent-runner] Failed to parse LLM response as JSON:', content)
    throw new Error('Invalid JSON response from LLM')
  }
}

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  const preflight = handleCorsPreflightRequest(req, corsHeaders)
  if (preflight) {
    return preflight
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders)
  }

  const startTime = Date.now()
  
  try {
    const auth = await verifyAuth(req)
    if (!auth.user) {
      return authError(auth.error || 'Unauthorized', auth.status, corsHeaders)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: body, error: parseError } = await safeParseBody<AgentRunnerRequest>(req, 8_192)
    if (parseError || !body) {
      const status = parseError?.includes('exceeds') ? 413 : 400
      return errorResponse(parseError || 'Invalid request body', status, corsHeaders)
    }

    const targetEventId = typeof body.eventId === 'string' ? sanitizeString(body.eventId, 100) : ''
    const businessId = typeof body.businessId === 'string' ? sanitizeString(body.businessId, 100) : ''

    if (targetEventId && !isValidUUID(targetEventId)) {
      return errorResponse('eventId must be a valid UUID', 400, corsHeaders)
    }

    if (!businessId || !isValidUUID(businessId)) {
      return errorResponse('businessId must be a valid UUID', 400, corsHeaders)
    }

    const access = await verifyBusinessAccess(auth.user.id, businessId)
    if (!access.allowed) {
      return authError(access.error || 'Access denied', 403, corsHeaders)
    }

    // Claim a pending event (with lease timeout recovery)
    const leaseTimeoutMinutes = 5
    const leaseThreshold = new Date(Date.now() - leaseTimeoutMinutes * 60 * 1000).toISOString()

    let eventQuery = supabase
      .from('ai_events')
      .select('*')
      .or(`status.eq.pending,and(status.eq.processing,locked_at.lt.${leaseThreshold})`)
      .eq('business_id', businessId)
      .order('created_at', { ascending: true })
      .limit(1)

    if (targetEventId) {
      eventQuery = supabase
        .from('ai_events')
        .select('*')
        .eq('id', targetEventId)
        .eq('business_id', businessId)
        .limit(1)
    }

    const { data: events, error: fetchError } = await eventQuery

    if (fetchError) {
      console.error('[agent-runner] Failed to fetch events:', fetchError)
      return errorResponse('Failed to fetch events', 500, corsHeaders)
    }

    if (!events || events.length === 0) {
      console.log('[agent-runner] No pending events')
      return secureJsonResponse({ status: 'idle', message: 'No pending events' }, 200, corsHeaders)
    }

    const event = events[0]
    const runnerId = `runner-${crypto.randomUUID().slice(0, 8)}`

    console.log('[agent-runner] Processing event:', {
      eventId: event.id,
      intent: event.intent,
      businessId: event.business_id,
      runnerId,
    })

    // Lock the event
    const { error: lockError } = await supabase
      .from('ai_events')
      .update({
        status: 'processing',
        locked_at: new Date().toISOString(),
        locked_by: runnerId,
      })
      .eq('id', event.id)

    if (lockError) {
      console.error('[agent-runner] Failed to lock event:', lockError)
      return errorResponse('Failed to lock event', 500, corsHeaders)
    }

    // Create run record
    const { data: run, error: runError } = await supabase
      .from('ai_runs')
      .insert({
        event_id: event.id,
        plugin_instance_id: event.plugin_instance_id,
        business_id: event.business_id,
        status: 'processing',
        input_payload: event.payload,
      })
      .select('id')
      .single()

    if (runError) {
      console.error('[agent-runner] Failed to create run record:', runError)
    }

    // Link event to run
    if (run) {
      await supabase
        .from('ai_events')
        .update({ claimed_run_id: run.id })
        .eq('id', event.id)
    }

    // Get agent configuration - route based on intent
    let systemPrompt: string
    let allowedTools: string[] = []
    let agentSlug: string = 'lead_qualifier'
    let generatedAgentSiteId: string | null = null

    // Check orchestrator config for routing
    const { data: orchestrator } = await supabase
      .from('ai_agent_registry')
      .select('default_config')
      .eq('slug', 'unison_ai')
      .eq('is_active', true)
      .single()

    if (orchestrator?.default_config?.routing) {
      const routing = orchestrator.default_config.routing as Record<string, string>
      if (routing[event.intent]) {
        agentSlug = routing[event.intent]
        console.log('[agent-runner] Routed to agent:', agentSlug, 'for intent:', event.intent)
      }
    }

    if (event.intent === 'booking.create') {
      try {
        const authorization = await loadGeneratedAgentAuthorization(
          supabase,
          event.business_id,
          event.plugin_instance_id,
          event.intent,
        )
        agentSlug = authorization.agentSlug
        allowedTools = authorization.allowedTools
        generatedAgentSiteId = authorization.siteId
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generated agent authorization failed'
        await supabase
          .from('ai_events')
          .update({ status: 'failed', processed_at: new Date().toISOString() })
          .eq('id', event.id)
        if (run) {
          await supabase
            .from('ai_runs')
            .update({ status: 'failed', error_message: message, completed_at: new Date().toISOString() })
            .eq('id', run.id)
        }
        return secureJsonResponse({ status: 'failed', eventId: event.id, error: message }, 409, corsHeaders)
      }
    }

    // Get the target agent
    const { data: agent } = await supabase
      .from('ai_agent_registry')
      .select('system_prompt, allowed_tools, slug, is_active')
      .eq('slug', agentSlug)
      .eq('is_active', true)
      .single()

    if (agent) {
      systemPrompt = agent.system_prompt
      const registryTools = agent.allowed_tools || []
      allowedTools = generatedAgentSiteId
        ? allowedTools.filter((tool) => registryTools.includes(tool))
        : registryTools
      console.log('[agent-runner] Using agent:', agent.slug, 'with', allowedTools.length, 'tools')
    } else {
      // Fallback to default lead qualifier
      const { data: defaultAgent } = await supabase
        .from('ai_agent_registry')
        .select('system_prompt, allowed_tools')
        .eq('slug', 'lead_qualifier')
        .single()

      systemPrompt = defaultAgent?.system_prompt || 'You are a helpful assistant. Respond with JSON.'
      allowedTools = defaultAgent?.allowed_tools || []
      console.log('[agent-runner] Fallback to lead_qualifier')
    }

    // Call LLM
    let llmResult: Awaited<ReturnType<typeof callLLM>>
    const tokensUsed = 0

    try {
      llmResult = await callLLM(systemPrompt, {
        intent: event.intent,
        ...event.payload,
      })
      console.log('[agent-runner] LLM response:', llmResult)
    } catch (err) {
      const error = err as Error
      console.error('[agent-runner] LLM call failed:', error)

      await supabase
        .from('ai_events')
        .update({ status: 'failed', processed_at: new Date().toISOString() })
        .eq('id', event.id)

      if (run) {
        await supabase
          .from('ai_runs')
          .update({
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString(),
            latency_ms: Date.now() - startTime,
          })
          .eq('id', run.id)
      }

      return errorResponse(error.message, 500, corsHeaders, { status: 'failed' })
    }

    // Execute proposed tool calls
    const toolCallResults: ToolResult[] = []
    const toolContext: ToolContext = {
      supabase,
      businessId: event.business_id,
      pluginInstanceId: event.plugin_instance_id,
      eventId: event.id,
      siteId: generatedAgentSiteId,
    }

    const proposedToolCalls = [...(llmResult.proposedToolCalls || [])]
    if (
      event.intent === 'booking.create' &&
      !proposedToolCalls.some((toolCall) => toolCall.tool === 'calendar.book')
    ) {
      proposedToolCalls.push({ tool: 'calendar.book', payload: event.payload || {} })
    }

    for (const toolCall of proposedToolCalls) {
      // Verify tool is allowed
      if (!allowedTools.includes(toolCall.tool)) {
        console.warn('[agent-runner] Tool not allowed:', toolCall.tool)
        toolCallResults.push({
          tool: toolCall.tool,
          success: false,
          error: 'Tool not authorized for this agent',
        })
        continue
      }

      const toolPayload = toolCall.tool === 'calendar.book'
        ? { ...(event.payload || {}), ...toolCall.payload }
        : toolCall.payload
      const result = await executeTool(toolCall.tool, toolPayload, toolContext)
      toolCallResults.push({
        tool: toolCall.tool,
        ...result,
      })
    }

    const failedBooking = toolCallResults.find((result) => result.tool === 'calendar.book' && !result.success)
    if (failedBooking) {
      const latencyMs = Date.now() - startTime
      await supabase
        .from('ai_events')
        .update({ status: 'failed', processed_at: new Date().toISOString() })
        .eq('id', event.id)
      if (run) {
        await supabase
          .from('ai_runs')
          .update({
            status: 'failed',
            error_message: failedBooking.error || 'Canonical booking failed',
            output_payload: llmResult,
            tool_calls: toolCallResults,
            tokens_used: tokensUsed,
            latency_ms: latencyMs,
            completed_at: new Date().toISOString(),
          })
          .eq('id', run.id)
      }
      return secureJsonResponse({
        status: 'failed',
        eventId: event.id,
        runId: run?.id,
        error: failedBooking.error || 'Canonical booking failed',
        toolCalls: toolCallResults,
      }, 409, corsHeaders)
    }

    // Update plugin state if instance exists
    if (event.plugin_instance_id) {
      await supabase
        .from('ai_plugin_state')
        .upsert({
          plugin_instance_id: event.plugin_instance_id,
          state_key: 'latest_analysis',
          state: {
            score: llmResult.score,
            tags: llmResult.tags,
            stage: llmResult.stage,
            outcome: llmResult.outcome,
            action: llmResult.action,
            notes: llmResult.notes,
            lastProcessedAt: new Date().toISOString(),
            lastEventId: event.id,
          },
        }, {
          onConflict: 'plugin_instance_id,state_key',
        })
    }

    // Mark event as completed
    await supabase
      .from('ai_events')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', event.id)

    // Update run record
    const latencyMs = Date.now() - startTime
    if (run) {
      await supabase
        .from('ai_runs')
        .update({
          status: 'completed',
          output_payload: llmResult,
          tool_calls: toolCallResults,
          tokens_used: tokensUsed,
          latency_ms: latencyMs,
          completed_at: new Date().toISOString(),
        })
        .eq('id', run.id)
    }

    console.log('[agent-runner] Event processed successfully:', {
      eventId: event.id,
      runId: run?.id,
      agentUsed: agentSlug,
      latencyMs,
      toolCallsExecuted: toolCallResults.length,
    })

    return secureJsonResponse(
      {
        status: 'completed',
        eventId: event.id,
        runId: run?.id,
        agent: agentSlug,
        result: {
          score: llmResult.score,
          stage: llmResult.stage,
          outcome: llmResult.outcome,
          action: llmResult.action,
          tags: llmResult.tags,
        },
        toolCalls: toolCallResults,
        latencyMs,
      },
      200,
      corsHeaders,
    )

  } catch (error) {
    console.error('[agent-runner] Unexpected error:', error)
    return errorResponse('Internal server error', 500, corsHeaders)
  }
})
