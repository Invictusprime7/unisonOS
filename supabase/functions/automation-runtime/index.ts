/**
 * AUTOMATION RUNTIME ENGINE
 * 
 * Executes workflow runs step-by-step with:
 * - DAG-based node traversal
 * - Wait/delay step scheduling
 * - Business hours enforcement
 * - Loop prevention (max steps)
 * - Goal-based early termination
 */

// deno-lint-ignore no-import-prefix
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { secureJsonResponse, errorResponse } from "../_shared/response.ts";
import { safeParseBody, sanitizeString, isValidUUID } from "../_shared/validate.ts";
import {
  normalizeWebhookMethod,
  sanitizeWebhookHeaders,
  validateOutboundWebhookUrl,
} from "../_shared/outbound.ts";

interface BusinessSettings {
  business_hours_enabled?: boolean;
  business_hours_start?: string;
  business_hours_end?: string;
  business_days?: number[];
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  default_sender_name?: string;
  default_sender_email?: string;
  rate_limit_per_contact_per_day?: number;
}

interface AutomationEdge {
  id: string;
  workflow_id: string;
  from_node_id: string;
  to_node_id: string;
  condition_key?: string;
}

interface RunContext {
  intent: string;
  payload: Record<string, unknown>;
  business: { id: string; industry: string; name: string };
  contact?: { id: string; email?: string; name?: string; phone?: string };
  triggered_at: string;
  [key: string]: unknown;
}

interface AutomationNode {
  id: string;
  workflow_id: string;
  node_type: 'trigger' | 'action' | 'condition' | 'wait' | 'goal';
  action_type: string | null;
  label: string | null;
  config: Record<string, unknown>;
  execution_order: number;
}

interface AutomationRun {
  id: string;
  workflow_id: string;
  event_id: string | null;
  contact_id: string | null;
  status: string;
  current_node_id: string | null;
  context: RunContext;
  steps_completed: number;
  max_steps: number;
}

const MAX_STEPS_DEFAULT = 100;
const MAX_RUNTIME_MINUTES = 30; // Max 30 minutes per run

interface AutomationRuntimeRequest {
  runId?: string;
  resumeFromNodeId?: string | null;
}

function isAuthorizedInternalRequest(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("CRON_SECRET");

  return Boolean(
    (serviceKey && authHeader === `Bearer ${serviceKey}`) ||
    (cronSecret && authHeader === `Bearer ${cronSecret}`)
  );
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req, corsHeaders);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  if (!isAuthorizedInternalRequest(req)) {
    console.warn("[automation-runtime] Unauthorized invocation attempt");
    return errorResponse("Unauthorized", 401, corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: body, error: parseError } = await safeParseBody<AutomationRuntimeRequest>(req, 16_384);
    if (parseError || !body) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid request body", status, corsHeaders);
    }

    const runId = typeof body.runId === "string" ? sanitizeString(body.runId, 100) : "";
    const resumeFromNodeId = typeof body.resumeFromNodeId === "string"
      ? sanitizeString(body.resumeFromNodeId, 100)
      : null;

    if (!runId || !isValidUUID(runId)) {
      return errorResponse("runId must be a valid UUID", 400, corsHeaders);
    }

    if (resumeFromNodeId && !isValidUUID(resumeFromNodeId)) {
      return errorResponse("resumeFromNodeId must be a valid UUID", 400, corsHeaders);
    }

    console.log("[automation-runtime] Starting run:", runId);

    // Fetch the run
    const { data: run, error: runError } = await supabase
      .from("automation_runs")
      .select("*")
      .eq("id", runId)
      .single();

    if (runError || !run) {
      console.error("[automation-runtime] Run not found:", runId);
      return errorResponse("Run not found", 404, corsHeaders);
    }

    // Check if run is already completed or cancelled
    if (run.status === "completed" || run.status === "cancelled" || run.status === "failed") {
      console.log("[automation-runtime] Run already finished:", run.status);
      return secureJsonResponse(
        { success: true, status: run.status, message: "Run already finished" },
        200,
        corsHeaders,
      );
    }

    // Loop prevention: check max steps
    if (run.steps_completed >= (run.max_steps || MAX_STEPS_DEFAULT)) {
      console.error("[automation-runtime] Max steps exceeded for run:", runId);
      await updateRunStatus(supabase, runId, "failed", "Max steps exceeded - possible infinite loop");
      return errorResponse("Max steps exceeded", 400, corsHeaders, { runId });
    }

    // Check runtime limit
    const startTime = new Date(run.started_at);
    const runtimeMinutes = (Date.now() - startTime.getTime()) / 60000;
    if (runtimeMinutes > MAX_RUNTIME_MINUTES) {
      console.error("[automation-runtime] Max runtime exceeded for run:", runId);
      await updateRunStatus(supabase, runId, "failed", "Max runtime exceeded");
      return errorResponse("Max runtime exceeded", 400, corsHeaders, { runId });
    }

    // Update run status to running
    await supabase
      .from("automation_runs")
      .update({ status: "running" })
      .eq("id", runId);

    // Fetch workflow nodes
    const { data: nodes } = await supabase
      .from("automation_nodes")
      .select("*")
      .eq("workflow_id", run.workflow_id)
      .order("execution_order", { ascending: true });

    if (!nodes || nodes.length === 0) {
      console.log("[automation-runtime] No nodes found, completing run");
      await updateRunStatus(supabase, runId, "completed");
      return secureJsonResponse(
        { success: true, status: "completed", message: "No nodes to execute" },
        200,
        corsHeaders,
      );
    }

    // Fetch edges for branching logic
    const { data: edgesData } = await supabase
      .from("automation_edges")
      .select("*")
      .eq("workflow_id", run.workflow_id);
    const edges: AutomationEdge[] = edgesData ?? [];

    // Determine starting node
    let currentNodeId = resumeFromNodeId || run.current_node_id;
    if (!currentNodeId) {
      // Start from first node (trigger node or first action)
      const triggerNode = nodes.find((n: AutomationNode) => n.node_type === "trigger");
      currentNodeId = triggerNode?.id || nodes[0]?.id;
    }

    // Get business automation settings
    const businessId = run.context?.business?.id;
    const { data: settings } = await supabase
      .from("business_automation_settings")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    // Process nodes
    let stepsProcessed = 0;
    let context = { ...(run.context || {}) };
    let status: "completed" | "paused" | "failed" = "completed";
    let lastNodeId = currentNodeId;

    while (currentNodeId && stepsProcessed < 10) { // Max 10 nodes per invocation
      const node = nodes.find((n: AutomationNode) => n.id === currentNodeId);
      if (!node) break;

      console.log(`[automation-runtime] Processing node: ${node.label || node.action_type} (${node.node_type})`);

      // Log the step
      await logStep(supabase, runId, node.id, "info", `Executing: ${node.label || node.action_type}`);

      try {
        // Check business hours for messaging actions
        if (shouldCheckBusinessHours(node) && settings?.business_hours_enabled) {
          const isBusinessHours = await checkBusinessHours(supabase, businessId);
          if (!isBusinessHours) {
            // Schedule for next business hours
            const nextBusinessHours = calculateNextBusinessHours(settings);
            await scheduleJob(supabase, runId, node.id, nextBusinessHours);
            await supabase
              .from("automation_runs")
              .update({
                status: "paused",
                paused_at: new Date().toISOString(),
                paused_until: nextBusinessHours.toISOString(),
                current_node_id: node.id,
              })
              .eq("id", runId);
            
            status = "paused";
            break;
          }
        }

        // Check quiet hours for SMS
        if (node.action_type === "send_sms" && settings?.quiet_hours_enabled) {
          const isQuietHours = await checkQuietHours(supabase, businessId);
          if (isQuietHours) {
            // Schedule for after quiet hours
            const afterQuietHours = calculateAfterQuietHours(settings);
            await scheduleJob(supabase, runId, node.id, afterQuietHours);
            await supabase
              .from("automation_runs")
              .update({
                status: "paused",
                paused_at: new Date().toISOString(),
                paused_until: afterQuietHours.toISOString(),
                current_node_id: node.id,
              })
              .eq("id", runId);
            
            status = "paused";
            break;
          }
        }

        // Execute the node
        const result = await executeNode(supabase, node, context, settings);
        
        // Update context with result
        context = { ...context, [`step_${node.id}`]: result };

        // Handle special node types
        if (node.node_type === "wait") {
          // Calculate delay
          const delayMs = parseDelay(node.config);
          const executeAt = new Date(Date.now() + delayMs);
          
          await scheduleJob(supabase, runId, node.id, executeAt);
          await supabase
            .from("automation_runs")
            .update({
              status: "paused",
              paused_at: new Date().toISOString(),
              paused_until: executeAt.toISOString(),
              current_node_id: node.id,
              context,
              steps_completed: run.steps_completed + stepsProcessed + 1,
            })
            .eq("id", runId);
          
          // Find next node for when we resume
          const nextNodeId = findNextNode(node.id, edges, result);
          if (nextNodeId) {
            await supabase
              .from("automation_jobs")
              .update({ node_id: nextNodeId })
              .eq("run_id", runId)
              .eq("node_id", node.id);
          }
          
          status = "paused";
          break;
        }

        if (node.node_type === "goal") {
          // Goal achieved - complete the run
          await logStep(supabase, runId, node.id, "info", `Goal achieved: ${node.label}`);
          status = "completed";
          break;
        }

        if (node.node_type === "condition") {
          // Condition evaluation - determine next path
          const conditionMet = result?.conditionMet === true;
          const conditionKey = conditionMet ? "yes" : "no";
          currentNodeId = findNextNode(node.id, edges, { branchKey: conditionKey });
          lastNodeId = node.id;
          stepsProcessed++;
          continue;
        }

        // Find next node
        lastNodeId = node.id;
        currentNodeId = findNextNode(node.id, edges, result);
        stepsProcessed++;

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[automation-runtime] Node execution failed: ${errorMessage}`);
        await logStep(supabase, runId, node.id, "error", errorMessage);
        
        // Mark run as failed
        await updateRunStatus(supabase, runId, "failed", errorMessage);
        status = "failed";
        break;
      }
    }

    // Update run if completed or still running
    if (status === "completed") {
      await supabase
        .from("automation_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          context,
          steps_completed: run.steps_completed + stepsProcessed,
          current_node_id: lastNodeId,
        })
        .eq("id", runId);
    } else if (status !== "paused" && status !== "failed") {
      // Still more nodes to process - schedule continuation
      await supabase
        .from("automation_runs")
        .update({
          context,
          steps_completed: run.steps_completed + stepsProcessed,
          current_node_id: currentNodeId,
        })
        .eq("id", runId);

      // Trigger next batch
      if (currentNodeId) {
        await supabase.functions.invoke("automation-runtime", {
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: { runId, resumeFromNodeId: currentNodeId },
        });
      }
    }

    return secureJsonResponse(
      {
        success: true,
        runId,
        status,
        stepsProcessed,
      },
      200,
      corsHeaders,
    );
  } catch (error: unknown) {
    console.error("[automation-runtime] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(message, 500, corsHeaders);
  }
});

// Helper functions

async function updateRunStatus(supabase: SupabaseClient, runId: string, status: string, error?: string) {
  await supabase
    .from("automation_runs")
    .update({
      status,
      error_message: error || null,
      ...(status === "completed" || status === "failed" ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", runId);
}

async function logStep(supabase: SupabaseClient, runId: string, nodeId: string | null, level: string, message: string, data?: Record<string, unknown>) {
  await supabase.from("automation_logs").insert({
    run_id: runId,
    node_id: nodeId,
    level,
    message,
    data: data || {},
  });
}

async function scheduleJob(supabase: SupabaseClient, runId: string, nodeId: string, executeAt: Date) {
  await supabase.from("automation_jobs").insert({
    run_id: runId,
    node_id: nodeId,
    status: "queued",
    execute_at: executeAt.toISOString(),
  });
}

function findNextNode(currentNodeId: string, edges: AutomationEdge[], result?: Record<string, unknown>): string | null {
  if (!edges) return null;
  
  // Find outgoing edges from current node
  const outgoingEdges = edges.filter((e) => e.from_node_id === currentNodeId);
  
  if (outgoingEdges.length === 0) return null;
  if (outgoingEdges.length === 1) return outgoingEdges[0].to_node_id;
  
  // Multiple edges - use branch key from result
  const branchKey = result?.branchKey as string || "default";
  const matchingEdge = outgoingEdges.find((e) => e.condition_key === branchKey);
  return matchingEdge?.to_node_id || outgoingEdges[0].to_node_id;
}

function shouldCheckBusinessHours(node: AutomationNode): boolean {
  const messagingActions = ["send_email", "send_sms", "make_call"];
  return messagingActions.includes(node.action_type || "");
}

async function checkBusinessHours(supabase: SupabaseClient, businessId: string): Promise<boolean> {
  const { data } = await supabase.rpc("check_business_hours", { p_business_id: businessId });
  return data === true;
}

async function checkQuietHours(supabase: SupabaseClient, businessId: string): Promise<boolean> {
  const { data } = await supabase.rpc("check_quiet_hours", { p_business_id: businessId });
  return data === true;
}

function calculateNextBusinessHours(settings: BusinessSettings): Date {
  const now = new Date();
  const startHour = parseInt(settings.business_hours_start?.split(":")[0] || "9");
  const next = new Date(now);
  
  // Set to next business hour start
  next.setHours(startHour, 0, 0, 0);
  
  // If already past today's start, move to tomorrow
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  
  // Skip non-business days
  const businessDays = settings.business_days || [1, 2, 3, 4, 5];
  while (!businessDays.includes(next.getDay())) {
    next.setDate(next.getDate() + 1);
  }
  
  return next;
}

function calculateAfterQuietHours(settings: BusinessSettings): Date {
  const now = new Date();
  const endHour = parseInt(settings.quiet_hours_end?.split(":")[0] || "8");
  const next = new Date(now);
  
  next.setHours(endHour, 0, 0, 0);
  
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  
  return next;
}

function parseDelay(config: Record<string, unknown>): number {
  // Parse ISO 8601 duration or simple values
  const duration = config.duration as string || config.delay as string;
  
  if (!duration) {
    // Default: 5 minutes
    return 5 * 60 * 1000;
  }
  
  // Handle ISO 8601 durations like P1D, PT5M, PT1H
  if (duration.startsWith("P")) {
    const match = duration.match(/P(\d+D)?T?(\d+H)?(\d+M)?(\d+S)?/);
    if (match) {
      const days = parseInt(match[1] || "0");
      const hours = parseInt(match[2] || "0");
      const minutes = parseInt(match[3] || "0");
      const seconds = parseInt(match[4] || "0");
      return ((days * 24 + hours) * 60 + minutes) * 60 * 1000 + seconds * 1000;
    }
  }
  
  // Handle simple values: "5m", "1h", "1d"
  const simpleMatch = duration.match(/^(\d+)(s|m|h|d)$/);
  if (simpleMatch) {
    const value = parseInt(simpleMatch[1]);
    const unit = simpleMatch[2];
    switch (unit) {
      case "s": return value * 1000;
      case "m": return value * 60 * 1000;
      case "h": return value * 60 * 60 * 1000;
      case "d": return value * 24 * 60 * 60 * 1000;
    }
  }
  
  // Try parsing as minutes
  const minutes = parseInt(duration);
  if (!isNaN(minutes)) {
    return minutes * 60 * 1000;
  }
  
  return 5 * 60 * 1000; // Default 5 minutes
}

async function executeNode(
  supabase: SupabaseClient,
  node: AutomationNode,
  context: RunContext,
  settings: BusinessSettings | null
): Promise<Record<string, unknown>> {
  const config = node.config || {};
  
  switch (node.action_type) {
    case "send_email":
      return await sendEmail(config, context, settings);
    
    case "send_sms":
      return await sendSMS(config, context, settings);
    
    case "create_task":
      return await createTask(supabase, config, context);
    
    case "create_lead":
      return await createLead(supabase, config, context);
    
    case "update_contact":
      return await updateContact(supabase, config, context);
    
    case "move_pipeline_stage":
      return await movePipelineStage(supabase, config, context);
    
    case "add_tag":
      return await addTag(supabase, config, context);
    
    case "remove_tag":
      return await removeTag(supabase, config, context);
    
    case "webhook":
      return await callWebhook(config, context);
    
    case "condition":
      return await evaluateCondition(supabase, config, context);

    case "ghl_create_contact":
      return await ghlCreateContact(supabase, config, context);

    case "ghl_update_contact":
      return await ghlUpdateContact(config, context);

    case "ghl_sync":
      return await ghlSync(config, context);
    
    default:
      console.log(`[automation-runtime] Unknown action type: ${node.action_type}`);
      return { skipped: true, reason: `Unknown action: ${node.action_type}` };
  }
}

// Action implementations

async function sendEmail(config: Record<string, unknown>, context: RunContext, settings: BusinessSettings | null): Promise<Record<string, unknown>> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return { sent: false, reason: "Email not configured" };
  }
  
  // Interpolate template variables
  const to = interpolate(config.to as string || context.contact?.email || context.payload?.email as string, context);
  const subject = interpolate(config.subject as string || "Message from {{business.name}}", context);
  const body = interpolate(config.body as string || config.html as string || "", context, true);
  
  if (!to) {
    return { sent: false, reason: "No recipient email" };
  }
  
  const fromName = settings?.default_sender_name || context.business.name || "Notification";
  const fromEmail = settings?.default_sender_email || (Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev");
  
  try {
    const response = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY") ?? ""}`, "X-Connection-Api-Key": resendApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html: body,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      return { sent: false, reason: error };
    }
    
    const result = await response.json();
    return { sent: true, emailId: result.id, to, subject };
  } catch (error) {
    return { sent: false, reason: String(error) };
  }
}

function sendSMS(config: Record<string, unknown>, context: RunContext, _settings: BusinessSettings | null): Record<string, unknown> {
  // Placeholder - integrate with Twilio or other SMS provider
  const to = interpolate(config.to as string || context.contact?.phone || context.payload?.phone as string, context);
  const message = interpolate(config.message as string || "", context);
  
  console.log("[automation-runtime] SMS action (placeholder):", { to, message });
  return { sent: false, reason: "SMS not configured", to, message };
}

async function createTask(supabase: SupabaseClient, config: Record<string, unknown>, context: RunContext): Promise<Record<string, unknown>> {
  const title = interpolate(config.title as string || "Follow up", context);
  const description = interpolate(config.description as string || "", context);
  
  const { data, error } = await supabase.from("tasks").insert({
    title,
    description,
    status: "todo",
    project_id: context.payload?.projectId || null,
    created_at: new Date().toISOString(),
  }).select().single();
  
  if (error) throw error;
  return { taskId: data.id, title };
}

async function createLead(supabase: SupabaseClient, _config: Record<string, unknown>, context: RunContext): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.from("leads").insert({
    business_id: context.business.id,
    email: context.payload?.email || context.contact?.email || null,
    name: context.payload?.name || context.contact?.name || null,
    phone: context.payload?.phone || null,
    source: "automation",
    metadata: { automationContext: context },
  }).select().single();
  
  if (error) throw error;
  return { leadId: data.id };
}

async function updateContact(supabase: SupabaseClient, config: Record<string, unknown>, context: RunContext): Promise<Record<string, unknown>> {
  const contactId = context.contact?.id || config.contactId as string;
  if (!contactId) {
    return { updated: false, reason: "No contact ID" };
  }
  
  const updates: Record<string, unknown> = {};
  if (config.firstName) updates.first_name = interpolate(config.firstName as string, context);
  if (config.lastName) updates.last_name = interpolate(config.lastName as string, context);
  if (config.phone) updates.phone = interpolate(config.phone as string, context);
  if (config.tags) updates.tags = config.tags;
  updates.updated_at = new Date().toISOString();
  
  const { error } = await supabase
    .from("crm_contacts")
    .update(updates)
    .eq("id", contactId);
  
  if (error) throw error;
  return { updated: true, contactId };
}

async function movePipelineStage(supabase: SupabaseClient, config: Record<string, unknown>, context: RunContext): Promise<Record<string, unknown>> {
  const leadId = config.leadId as string || context.payload?.leadId as string;
  const stage = config.stage as string;
  
  if (!leadId || !stage) {
    return { moved: false, reason: "Missing leadId or stage" };
  }
  
  const { error } = await supabase
    .from("crm_leads")
    .update({ status: stage, updated_at: new Date().toISOString() })
    .eq("id", leadId);
  
  if (error) throw error;
  return { moved: true, leadId, stage };
}

async function addTag(supabase: SupabaseClient, config: Record<string, unknown>, context: RunContext): Promise<Record<string, unknown>> {
  const contactId = context.contact?.id || config.contactId as string;
  const tag = config.tag as string;
  
  if (!contactId || !tag) {
    return { added: false, reason: "Missing contactId or tag" };
  }
  
  const { data: contact } = await supabase
    .from("crm_contacts")
    .select("tags")
    .eq("id", contactId)
    .single();
  
  const currentTags = contact?.tags || [];
  if (!currentTags.includes(tag)) {
    currentTags.push(tag);
    await supabase
      .from("crm_contacts")
      .update({ tags: currentTags, updated_at: new Date().toISOString() })
      .eq("id", contactId);
  }
  
  return { added: true, contactId, tag };
}

async function removeTag(supabase: SupabaseClient, config: Record<string, unknown>, context: RunContext): Promise<Record<string, unknown>> {
  const contactId = context.contact?.id || config.contactId as string;
  const tag = config.tag as string;
  
  if (!contactId || !tag) {
    return { removed: false, reason: "Missing contactId or tag" };
  }
  
  const { data: contact } = await supabase
    .from("crm_contacts")
    .select("tags")
    .eq("id", contactId)
    .single();
  
  const currentTags = (contact?.tags || []).filter((t: string) => t !== tag);
  await supabase
    .from("crm_contacts")
    .update({ tags: currentTags, updated_at: new Date().toISOString() })
    .eq("id", contactId);
  
  return { removed: true, contactId, tag };
}

async function callWebhook(config: Record<string, unknown>, context: RunContext): Promise<Record<string, unknown>> {
  const rawUrl = typeof config.url === "string" ? config.url : "";
  if (!rawUrl) {
    return { called: false, reason: "No URL configured" };
  }

  const validatedUrl = validateOutboundWebhookUrl(rawUrl);
  if (!validatedUrl.ok) {
    return { called: false, reason: validatedUrl.error };
  }
  
  const payload = {
    ...config.payload as Record<string, unknown>,
    context,
    timestamp: new Date().toISOString(),
  };
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(validatedUrl.url.toString(), {
        method: normalizeWebhookMethod(config.method),
        headers: {
          "Content-Type": "application/json",
          ...sanitizeWebhookHeaders(config.headers),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    
      return {
        called: true,
        url: validatedUrl.url.toString(),
        status: response.status,
        success: response.ok,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return { called: false, reason: String(error) };
  }
}

function evaluateCondition(_supabase: SupabaseClient, config: Record<string, unknown>, context: RunContext): Record<string, unknown> {
  const field = config.field as string;
  const operator = config.operator as string;
  const value = config.value;
  
  // Get the value to compare from context
  let actualValue: unknown;
  
  if (field.startsWith("payload.")) {
    const key = field.replace("payload.", "");
    actualValue = context.payload?.[key];
  } else if (field.startsWith("contact.")) {
    const key = field.replace("contact.", "");
    actualValue = (context.contact as Record<string, unknown>)?.[key];
  } else {
    actualValue = context[field];
  }
  
  let conditionMet = false;
  
  switch (operator) {
    case "equals":
    case "eq":
      conditionMet = actualValue === value;
      break;
    case "not_equals":
    case "neq":
      conditionMet = actualValue !== value;
      break;
    case "contains":
      conditionMet = String(actualValue).includes(String(value));
      break;
    case "not_contains":
      conditionMet = !String(actualValue).includes(String(value));
      break;
    case "greater_than":
    case "gt":
      conditionMet = Number(actualValue) > Number(value);
      break;
    case "less_than":
    case "lt":
      conditionMet = Number(actualValue) < Number(value);
      break;
    case "exists":
      conditionMet = actualValue !== null && actualValue !== undefined;
      break;
    case "not_exists":
      conditionMet = actualValue === null || actualValue === undefined;
      break;
    default:
      conditionMet = false;
  }
  
  return {
    conditionMet,
    branchKey: conditionMet ? "yes" : "no",
    field,
    operator,
    value,
    actualValue,
  };
}

// ============================================================================
// GoHighLevel CRM Actions
// ============================================================================

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

function getGhlHeaders(): Record<string, string> {
  const apiKey = Deno.env.get('GOHIGHLEVEL_API_KEY');
  if (!apiKey) throw new Error('GOHIGHLEVEL_API_KEY not configured');
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
  };
}

async function ghlCreateContact(
  supabase: SupabaseClient,
  config: Record<string, unknown>,
  context: RunContext
): Promise<Record<string, unknown>> {
  const locationId = config.locationId as string;
  if (!locationId) return { created: false, reason: 'No GHL locationId configured' };

  const contact = context.contact ?? {} as NonNullable<RunContext['contact']>;
  const payload = context.payload ?? {};

  const body: Record<string, unknown> = {
    locationId,
    firstName: contact.name?.split(' ')[0] || (payload.name as string) || '',
    lastName: contact.name?.split(' ').slice(1).join(' ') || '',
    email: contact.email || (payload.email as string) || '',
    phone: contact.phone || (payload.phone as string) || '',
    source: `Unison:${context.intent}`,
    ...(config.customFields ? { customFields: config.customFields } : {}),
  };

  try {
    const res = await fetch(`${GHL_API_BASE}/contacts/`, {
      method: 'POST',
      headers: getGhlHeaders(),
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[automation-runtime] GHL create contact failed:', res.status, data);
      return { created: false, status: res.status, error: data };
    }

    // Sync GHL contact ID back to local CRM
    const ghlContactId = data.contact?.id;
    if (ghlContactId && context.contact?.id) {
      await supabase
        .from('crm_contacts')
        .update({ ghl_contact_id: ghlContactId } as Record<string, unknown>)
        .eq('id', context.contact.id);
    }

    console.log('[automation-runtime] GHL contact created:', ghlContactId);
    return { created: true, ghlContactId, data: data.contact };
  } catch (err) {
    return { created: false, reason: String(err) };
  }
}

async function ghlUpdateContact(
  config: Record<string, unknown>,
  context: RunContext
): Promise<Record<string, unknown>> {
  const ghlContactId = config.ghlContactId as string || (context.contact as Record<string, unknown>)?.ghl_contact_id as string;
  if (!ghlContactId) return { updated: false, reason: 'No GHL contact ID' };

  const updates: Record<string, unknown> = {};
  if (config.tags) updates.tags = config.tags;
  if (config.customFields) updates.customFields = config.customFields;
  if (config.dnd !== undefined) updates.dnd = config.dnd;
  if (config.assignedTo) updates.assignedTo = config.assignedTo;

  // Allow dynamic field mapping from context
  const fieldMap = config.fieldMap as Record<string, string> | undefined;
  if (fieldMap) {
    for (const [ghlField, contextPath] of Object.entries(fieldMap)) {
      const keys = contextPath.split('.');
      let val: unknown = context;
      for (const k of keys) {
        val = (val as Record<string, unknown>)?.[k];
      }
      if (val !== undefined) updates[ghlField] = val;
    }
  }

  try {
    const res = await fetch(`${GHL_API_BASE}/contacts/${ghlContactId}`, {
      method: 'PUT',
      headers: getGhlHeaders(),
      body: JSON.stringify(updates),
    });

    const data = await res.json();
    if (!res.ok) {
      return { updated: false, status: res.status, error: data };
    }

    console.log('[automation-runtime] GHL contact updated:', ghlContactId);
    return { updated: true, ghlContactId, data: data.contact };
  } catch (err) {
    return { updated: false, reason: String(err) };
  }
}

async function ghlSync(
  config: Record<string, unknown>,
  context: RunContext
): Promise<Record<string, unknown>> {
  // Generic GHL API proxy action for workflows
  const action = config.action as string;
  if (!action) return { synced: false, reason: 'No GHL action specified' };

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase.functions.invoke('gohighlevel-crm', {
      body: {
        action,
        contactId: config.contactId || context.contact?.id,
        locationId: config.locationId,
        ...config.params as Record<string, unknown>,
      },
    });

    if (error) {
      return { synced: false, error: error.message };
    }

    console.log(`[automation-runtime] GHL sync (${action}) complete`);
    return { synced: true, action, data };
  } catch (err) {
    return { synced: false, reason: String(err) };
  }
}

// Template interpolation
function interpolate(template: string, context: RunContext, html = false): string {
  if (!template) return template;
  
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const keys = path.trim().split(".");
    let value: unknown = context;
    
    for (const key of keys) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[key];
      } else {
        value = undefined;
        break;
      }
    }
    
    if (value === undefined || value === null) return match;
    // Values come from visitor submissions; inside HTML bodies they are text, never markup.
    return html ? escapeHtml(value) : String(value);
  });
}
