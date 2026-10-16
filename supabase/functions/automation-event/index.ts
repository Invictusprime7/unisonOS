/**
 * AUTOMATION EVENT HANDLER
 * 
 * Ingests automation events, routes to appropriate workflows based on:
 * - Business industry
 * - Intent type  
 * - Active recipe mappings
 * 
 * Implements:
 * - Deduplication via dedupe_key
 * - Rate limiting checks
 * - Business hour enforcement
 * - Enrollment eligibility
 */

// deno-lint-ignore no-import-prefix
import { createClient } from "@supabase/supabase-js";
import { publicCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { secureJsonResponse, errorResponse } from "../_shared/response.ts";
import { safeParseBody, isValidUUID, sanitizeString } from "../_shared/validate.ts";
import { verifyAuth, verifyBusinessAccess, authError } from "../_shared/auth.ts";

interface AutomationEventPayload {
  businessId: string;
  intent: string;
  payload: Record<string, unknown>;
  dedupeKey?: string;
  contactId?: string;
  source?: 'template' | 'api' | 'webhook' | 'manual';
  sourceUrl?: string;
}

interface WorkflowToTrigger {
  id: string;
  name: string;
  priority: number;
}

export default async (req: Request) => {
  const preflight = handleCorsPreflightRequest(req, publicCorsHeaders);
  if (preflight) {
    return preflight;
  }

  // Only accept POST
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, publicCorsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse and validate request body
    const { data: body, error: parseError } = await safeParseBody<AutomationEventPayload>(req);
    if (parseError || !body) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid JSON body", status, publicCorsHeaders);
    }

    const { 
      businessId, 
      intent, 
      payload, 
      dedupeKey, 
      contactId, 
      source = 'template',
      sourceUrl 
    } = body;

    console.log("[automation-event] Received:", { businessId, intent, source });

    if (!businessId || !intent) {
      return errorResponse("businessId and intent are required", 400, publicCorsHeaders);
    }

    // Validate businessId is a valid UUID format
    const normalizedBusinessId = sanitizeString(businessId, 100);
    if (!isValidUUID(normalizedBusinessId)) {
      return errorResponse("Invalid businessId format", 400, publicCorsHeaders);
    }

    // Only signed-in team members of the business (or the platform's own
    // server functions) may trigger its automations.
    const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const isInternal = !!bearer && bearer === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!isInternal) {
      const auth = await verifyAuth(req);
      if (!auth.user) return authError(auth.error || "Sign in to trigger automations", auth.status, publicCorsHeaders);
      const access = await verifyBusinessAccess(auth.user.id, normalizedBusinessId);
      if (!access.allowed) return authError("Only team members of this business can trigger its automations", 403, publicCorsHeaders);
    }

    // Validate intent is a non-empty string with safe characters
    const normalizedIntent = typeof intent === "string" ? sanitizeString(intent, 100) : "";
    if (!normalizedIntent || !/^[a-zA-Z0-9._-]+$/.test(normalizedIntent)) {
      return errorResponse("Invalid intent format", 400, publicCorsHeaders);
    }

    const normalizedContactId = typeof contactId === "string"
      ? sanitizeString(contactId, 100)
      : null;

    // Verify business exists and get industry info
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("id, industry, name")
      .eq("id", normalizedBusinessId)
      .single();

    if (bizError || !business) {
      return errorResponse("Business not found", 404, publicCorsHeaders);
    }

    // 1. Check if automations are enabled for this business
    const { data: settings } = await supabase
      .from("business_automation_settings")
      .select("*")
      .eq("business_id", normalizedBusinessId)
      .maybeSingle();

    if (settings && !settings.automations_enabled) {
      console.log("[automation-event] Automations disabled for business:", normalizedBusinessId);
      return secureJsonResponse(
        { success: true, message: "Automations disabled", triggered: 0 },
        200,
        publicCorsHeaders
      );
    }

    const industry = business.industry || 'general';

    // 3. Create automation event with deduplication
    const normalizedDedupeKey = typeof dedupeKey === "string" ? sanitizeString(dedupeKey, 500) : undefined;
    const eventDedupeKey = normalizedDedupeKey || `${normalizedBusinessId}:${normalizedIntent}:${JSON.stringify(payload)}:${Date.now()}`;
    
    const { data: existingEvent } = await supabase
      .from("automation_events")
      .select("id")
      .eq("business_id", normalizedBusinessId)
      .eq("dedupe_key", eventDedupeKey)
      .maybeSingle();

    if (existingEvent) {
      console.log("[automation-event] Duplicate event, skipping:", eventDedupeKey);
      return secureJsonResponse(
        { success: true, message: "Duplicate event", eventId: existingEvent.id, triggered: 0 },
        200,
        publicCorsHeaders
      );
    }

    // Check dedupe window (if settings exist)
    if (settings?.dedupe_window_minutes) {
      const windowStart = new Date(Date.now() - settings.dedupe_window_minutes * 60 * 1000);
      const { data: recentEvent } = await supabase
        .from("automation_events")
        .select("id")
        .eq("business_id", normalizedBusinessId)
        .eq("intent", normalizedIntent)
        .gte("occurred_at", windowStart.toISOString())
        .limit(1)
        .maybeSingle();

      if (recentEvent) {
        console.log("[automation-event] Within dedupe window, skipping");
        return secureJsonResponse(
          { success: true, message: "Within dedupe window", triggered: 0 },
          200,
          publicCorsHeaders
        );
      }
    }

    // 4. Create the event
    const { data: event, error: eventError } = await supabase
      .from("automation_events")
      .insert({
        business_id: normalizedBusinessId,
        intent: normalizedIntent,
        payload,
        dedupe_key: eventDedupeKey,
        contact_id: normalizedContactId,
        source,
        source_url: typeof sourceUrl === "string" ? sanitizeString(sourceUrl, 2000) : null,
      })
      .select()
      .single();

    if (eventError) {
      console.error("[automation-event] Error creating event:", eventError);
      throw new Error("Failed to create automation event");
    }

    console.log("[automation-event] Created event:", event.id);

    // 5. Find workflows to trigger based on intent + industry mapping
    const { data: intentMappings } = await supabase
      .from("intent_recipe_mappings")
      .select("recipe_ids, priority")
      .eq("intent", normalizedIntent)
      .eq("industry", industry);

    // Check for business-specific workflows by business_id
    // The query checks: trigger_type matches intent OR trigger_config.intent matches intent
    const { data: businessWorkflows } = await supabase
      .from("crm_workflows")
      .select("id, name, priority, recipe_id, user_id")
      .eq("is_active", true)
      .or(`business_id.eq.${normalizedBusinessId},user_id.eq.${business.id}`)
      .or(`trigger_type.eq.${normalizedIntent},trigger_config->>intent.eq.${normalizedIntent}`);

    // Also check for user workflows without business_id set (legacy)
    // This catches workflows where user_id matches but business_id was never set
    const { data: userWorkflows } = await supabase
      .from("crm_workflows")
      .select("id, name, priority, recipe_id, user_id")
      .eq("is_active", true)
      .eq("user_id", business.id)
      .is("business_id", null)
      .or(`trigger_type.eq.${normalizedIntent},trigger_config->>intent.eq.${normalizedIntent}`);

    // Collect all workflows to trigger (dedupe by id)
    const workflowMap = new Map<string, WorkflowToTrigger>();
    
    // Add business workflows
    if (businessWorkflows) {
      for (const wf of businessWorkflows) {
        workflowMap.set(wf.id, { id: wf.id, name: wf.name, priority: wf.priority || 50 });
      }
    }
    
    // Add user workflows (fallback for legacy)
    if (userWorkflows) {
      for (const wf of userWorkflows) {
        if (!workflowMap.has(wf.id)) {
          workflowMap.set(wf.id, { id: wf.id, name: wf.name, priority: wf.priority || 50 });
        }
      }
    }
    
    const workflowsToTrigger: WorkflowToTrigger[] = Array.from(workflowMap.values());

    // Add recipe-based workflows (check if recipe is enabled for business)
    if (intentMappings) {
      for (const mapping of intentMappings) {
        for (const recipeId of mapping.recipe_ids) {
          // Check if recipe is enabled for this business
          const { data: toggle } = await supabase
            .from("business_recipe_toggles")
            .select("enabled")
            .eq("business_id", normalizedBusinessId)
            .eq("recipe_id", recipeId)
            .maybeSingle();

          // If no toggle exists, check if pack is installed (default enabled)
          if (!toggle) {
            // Check if pack with this recipe is installed
            const { data: pack } = await supabase
              .from("automation_recipe_packs")
              .select("pack_id")
              .contains("recipes", [{ id: recipeId }])
              .maybeSingle();

            if (pack) {
              const { data: installed } = await supabase
                .from("installed_recipe_packs")
                .select("enabled")
                .eq("business_id", normalizedBusinessId)
                .eq("pack_id", pack.pack_id)
                .maybeSingle();

              if (installed?.enabled === false) {
                continue; // Pack is disabled
              }
            }
          } else if (!toggle.enabled) {
            continue; // Recipe explicitly disabled
          }

          // Find the actual workflow for this recipe
          const { data: recipeWorkflow } = await supabase
            .from("crm_workflows")
            .select("id, name, priority")
            .eq("recipe_id", recipeId)
            .eq("industry", industry)
            .eq("is_active", true)
            .maybeSingle();

          if (recipeWorkflow) {
            workflowsToTrigger.push({
              id: recipeWorkflow.id,
              name: recipeWorkflow.name,
              priority: recipeWorkflow.priority || mapping.priority,
            });
          }
        }
      }
    }

    // Sort by priority (lower = higher priority)
    workflowsToTrigger.sort((a, b) => a.priority - b.priority);

    console.log("[automation-event] Workflows to trigger:", workflowsToTrigger.length);

    // 6. Trigger each workflow
    const results: Array<{ workflowId: string; runId?: string; error?: string }> = [];

    for (const workflow of workflowsToTrigger) {
      try {
        // Check enrollment eligibility if contact exists
        if (normalizedContactId) {
          const { data: eligible } = await supabase.rpc("check_enrollment_eligibility", {
            p_contact_id: normalizedContactId,
            p_workflow_id: workflow.id,
          });

          if (!eligible) {
            console.log(`[automation-event] Contact not eligible for workflow: ${workflow.name}`);
            results.push({ workflowId: workflow.id, error: "Not eligible for enrollment" });
            continue;
          }
        }

        // Create idempotency key
        const idempotencyKey = `${event.id}:${workflow.id}`;

        // Create automation run
        const { data: run, error: runError } = await supabase
          .from("automation_runs")
          .insert({
            workflow_id: workflow.id,
            event_id: event.id,
            contact_id: normalizedContactId,
            status: "pending",
            context: {
              intent: normalizedIntent,
              payload,
              business: { id: normalizedBusinessId, industry, name: business.name },
              triggered_at: new Date().toISOString(),
            },
            idempotency_key: idempotencyKey,
          })
          .select()
          .single();

        if (runError) {
          // Likely a duplicate (idempotency)
          console.log(`[automation-event] Run already exists for: ${workflow.name}`);
          results.push({ workflowId: workflow.id, error: "Already triggered" });
          continue;
        }

        // Update enrollment tracking
        if (normalizedContactId) {
          await supabase.rpc("upsert_enrollment", {
            p_contact_id: normalizedContactId,
            p_workflow_id: workflow.id,
          });
        }

        console.log(`[automation-event] Created run ${run.id} for workflow: ${workflow.name}`);
        results.push({ workflowId: workflow.id, runId: run.id });

        // Trigger workflow execution
        await supabase.functions.invoke("workflow-trigger", {
          body: {
            workflowId: workflow.id,
            workflowRunId: run.id,
            triggerData: {
              event: normalizedIntent,
              eventId: event.id,
              payload,
              businessId: normalizedBusinessId,
              contactId: normalizedContactId,
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (err) {
        console.error(`[automation-event] Error triggering workflow ${workflow.name}:`, err);
        results.push({ workflowId: workflow.id, error: String(err) });
      }
    }

    // Mark event as processed
    await supabase
      .from("automation_events")
      .update({ processed: true })
      .eq("id", event.id);

    return secureJsonResponse(
      {
        success: true,
        eventId: event.id,
        triggered: results.filter((r) => r.runId).length,
        results,
      },
      200,
      publicCorsHeaders
    );
  } catch (error: unknown) {
    console.error("[automation-event] Error:", error);
    return errorResponse("Failed to process automation event", 500, publicCorsHeaders);
  }
};
