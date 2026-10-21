import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyAuth, verifyBusinessAccess, authError } from "../_shared/auth.ts";
import { secureJsonResponse, errorResponse } from "../_shared/response.ts";
import { safeParseBody, sanitizeString, isValidUUID } from "../_shared/validate.ts";

interface WorkflowTriggerRequest {
  workflowId?: string;
  triggerData?: Record<string, unknown>;
  webhookSecret?: string;
}

export default async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req, corsHeaders);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const workflowProcessorSecret = Deno.env.get("WORKFLOW_PROCESSOR_SECRET");

    const auth = await verifyAuth(req);
    if (!auth.user) {
      console.warn("Workflow trigger rejected: invalid JWT", auth.error);
      return authError(auth.error || "Unauthorized", auth.status, corsHeaders);
    }

    const userId = auth.user.id;
    console.log("Workflow trigger authenticated for user:", userId);

    // Use service role for internal operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: payload, error: parseError } = await safeParseBody<WorkflowTriggerRequest>(req);
    if (parseError || !payload) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid request body", status, corsHeaders);
    }

    const workflowId = typeof payload.workflowId === "string" ? sanitizeString(payload.workflowId, 100) : "";
    const triggerData = payload.triggerData && typeof payload.triggerData === "object" ? payload.triggerData : {};
    const webhookSecret = typeof payload.webhookSecret === "string"
      ? sanitizeString(payload.webhookSecret, 500)
      : undefined;

    if (!workflowId || !isValidUUID(workflowId)) {
      return errorResponse("Invalid workflowId format", 400, corsHeaders);
    }

    console.log("Workflow trigger received:", { workflowId, userId });

    // Fetch the workflow
    const { data: workflow, error: workflowError } = await supabase
      .from("crm_workflows")
      .select("id, name, trigger_type, trigger_config, steps, user_id, business_id, project_id")
      .eq("id", workflowId)
      .eq("is_active", true)
      .maybeSingle();

    if (workflowError) {
      console.error("Error fetching workflow:", workflowError);
      return errorResponse("Unable to process request", 500, corsHeaders);
    }

    if (!workflow) {
      return errorResponse("Workflow not found or inactive", 404, corsHeaders);
    }

    // Verify webhook secret if configured on the workflow
    if (workflow.trigger_config?.webhookSecret &&
        workflow.trigger_config.webhookSecret !== webhookSecret) {
      console.warn("Workflow trigger rejected: invalid webhook secret", { workflowId, userId });
      return errorResponse("Invalid webhook secret", 403, corsHeaders);
    }

    if (workflow.business_id) {
      const access = await verifyBusinessAccess(userId, workflow.business_id);
      if (!access.allowed) {
        console.warn("Workflow trigger rejected: business access denied", { workflowId, userId, businessId: workflow.business_id });
        return errorResponse(access.error || "Forbidden", 403, corsHeaders);
      }
    } else if (workflow.user_id && workflow.user_id !== userId) {
      console.warn("Workflow trigger rejected: user does not own workflow", { workflowId, userId, workflowOwner: workflow.user_id });
      return errorResponse("Forbidden", 403, corsHeaders);
    }

    // Log the trigger event type for debugging
    const eventType = triggerData?.event || workflow.trigger_type;
    console.log("Processing workflow for event:", eventType);

    // Create workflow run with event context
    const { data: workflowRun, error: runError } = await supabase
      .from("crm_workflow_runs")
      .insert({
        workflow_id: workflowId,
        status: "running",
        trigger_data: {
          ...triggerData,
          business_id: workflow.business_id,
          project_id: workflow.project_id,
          event_type: eventType,
          workflow_name: workflow.name,
          triggered_by: userId,
          triggered_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (runError) {
      console.error("Error creating workflow run:", runError);
      return errorResponse("Unable to process request", 500, corsHeaders);
    }

    console.log("Workflow run created:", workflowRun.id);

    // Queue jobs for each step
    const steps = workflow.steps || [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // Merge trigger data into action config for variable substitution
      const actionConfig = {
        ...step.config,
        _triggerData: triggerData,
      };

      const { error: jobError } = await supabase
        .from("crm_workflow_jobs")
        .insert({
          workflow_run_id: workflowRun.id,
          step_index: i,
          action_type: step.action_type,
          action_config: actionConfig,
          status: "queued",
          scheduled_at: new Date().toISOString(),
        });

      if (jobError) {
        console.error("Error creating job:", jobError);
      }
    }

    // Trigger job processor
    const processorResponse = await supabase.functions.invoke("workflow-job-processor", {
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        ...(workflowProcessorSecret ? { "x-workflow-processor-secret": workflowProcessorSecret } : {}),
      },
      body: { workflowRunId: workflowRun.id },
    });

    console.log("Job processor triggered:", processorResponse);

    return secureJsonResponse(
      {
        success: true,
        workflowRunId: workflowRun.id,
        eventType,
        message: "Workflow triggered successfully",
      },
      200,
      corsHeaders,
    );
  } catch (error: unknown) {
    console.error("Error in workflow-trigger:", error);
    return errorResponse("Unable to process request. Please try again.", 500, getCorsHeaders(req));
  }
};
