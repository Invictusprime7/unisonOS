import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { secureJsonResponse, errorResponse } from "../_shared/response.ts";
import { safeParseBody, sanitizeString, isValidUUID } from "../_shared/validate.ts";
import {
  normalizeWebhookMethod,
  sanitizeWebhookHeaders,
  validateOutboundWebhookUrl,
} from "../_shared/outbound.ts";
import { createCrmActivity, createCrmContact, createCrmLead, updateCrmContact, updateCrmLead, type CrmScope } from "../_shared/canonicalCrm.ts";

interface WorkflowJobProcessorRequest {
  workflowRunId?: string;
}

function isAuthorizedInternalRequest(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const sharedSecret = req.headers.get("x-workflow-processor-secret");
  const configuredSecret = Deno.env.get("WORKFLOW_PROCESSOR_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("CRON_SECRET");

  return Boolean(
    (configuredSecret && sharedSecret === configuredSecret) ||
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
    console.warn("[workflow-job-processor] Unauthorized invocation attempt");
    return errorResponse("Unauthorized", 401, corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: payload, error: parseError } = await safeParseBody<WorkflowJobProcessorRequest>(req);
    if (parseError || !payload) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid request body", status, corsHeaders);
    }

    const workflowRunId = typeof payload.workflowRunId === "string"
      ? sanitizeString(payload.workflowRunId, 100)
      : "";

    if (!workflowRunId || !isValidUUID(workflowRunId)) {
      return errorResponse("Invalid workflowRunId format", 400, corsHeaders);
    }

    console.log("Processing jobs for workflow run:", workflowRunId);

    const { data: workflowRun, error: workflowRunError } = await supabase
      .from("crm_workflow_runs")
      .select("id, status, trigger_data")
      .eq("id", workflowRunId)
      .maybeSingle();

    if (workflowRunError) {
      console.error("Error loading workflow run:", workflowRunError);
      return errorResponse("Failed to load workflow run", 500, corsHeaders);
    }

    if (!workflowRun) {
      return errorResponse("Workflow run not found", 404, corsHeaders);
    }

    // Fetch pending jobs for this run
    const { data: jobs, error: jobsError } = await supabase
      .from("crm_workflow_jobs")
      .select("*")
      .eq("workflow_run_id", workflowRunId)
      .eq("status", "queued")
      .order("step_index", { ascending: true });

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      throw new Error("Failed to fetch jobs");
    }

    console.log(`Found ${jobs?.length || 0} pending jobs`);

    const results: any[] = [];
    const triggerData = workflowRun.trigger_data || {};
    const crmScope: CrmScope = {
      businessId: triggerData.business_id || triggerData.businessId || null,
      projectId: triggerData.project_id || triggerData.projectId || null,
    };

    for (const job of jobs || []) {
      console.log(`Processing job ${job.id}: ${job.action_type}`);

      // Update job status to processing
      await supabase
        .from("crm_workflow_jobs")
        .update({ status: "processing" })
        .eq("id", job.id);

      try {
        const result = await processJob(supabase, job, crmScope);
        
        // Update job as completed
        await supabase
          .from("crm_workflow_jobs")
          .update({
            status: "completed",
            result,
            processed_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        results.push({ jobId: job.id, status: "completed", result });
      } catch (error: unknown) {
        console.error(`Job ${job.id} failed:`, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        const retryCount = (job.retry_count || 0) + 1;
        const maxRetries = 3;

        if (retryCount < maxRetries) {
          // Queue for retry
          await supabase
            .from("crm_workflow_jobs")
            .update({
              status: "queued",
              retry_count: retryCount,
              error_message: errorMessage,
              scheduled_at: new Date(Date.now() + retryCount * 60000).toISOString(), // Exponential backoff
            })
            .eq("id", job.id);
        } else {
          // Mark as failed
          await supabase
            .from("crm_workflow_jobs")
            .update({
              status: "failed",
              error_message: errorMessage,
              processed_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        }

        results.push({ jobId: job.id, status: "failed", error: errorMessage });
      }
    }

    // Check if all jobs are completed/failed and update workflow run
    const { data: remainingJobs } = await supabase
      .from("crm_workflow_jobs")
      .select("id, status")
      .eq("workflow_run_id", workflowRunId)
      .in("status", ["queued", "processing"]);

    if (!remainingJobs?.length) {
      // All jobs done, update workflow run status
      const { data: allJobs } = await supabase
        .from("crm_workflow_jobs")
        .select("status")
        .eq("workflow_run_id", workflowRunId);

      const hasFailed = allJobs?.some(j => j.status === "failed");
      
      await supabase
        .from("crm_workflow_runs")
        .update({
          status: hasFailed ? "failed" : "completed",
          completed_at: new Date().toISOString(),
          result: { jobs: results },
        })
        .eq("id", workflowRunId);
    }

    return secureJsonResponse(
      { success: true, processed: results.length, results },
      200,
      corsHeaders,
    );
  } catch (error: unknown) {
    console.error("Error in workflow-job-processor:", error);
    return errorResponse("Workflow job processing failed", 500, getCorsHeaders(req));
  }
});

async function processJob(supabase: any, job: any, crmScope: CrmScope): Promise<any> {
  const { action_type, action_config } = job;

  switch (action_type) {
    case "create_contact":
      return await createContact(supabase, action_config, crmScope);
    
    case "update_contact":
      return await updateContact(supabase, action_config, crmScope);
    
    case "create_lead":
      return await createLead(supabase, action_config, crmScope);
    
    case "update_lead_status":
      return await updateLeadStatus(supabase, action_config, crmScope);
    
    case "create_activity":
      return await createActivity(supabase, action_config, crmScope);
    
    case "send_email":
      return await sendEmail(action_config);
    
    case "webhook":
      return await callWebhook(action_config);
    
    case "delay":
      return await delay(action_config);
    
    case "condition":
      return await evaluateCondition(supabase, action_config);
    
    default:
      console.log(`Unknown action type: ${action_type}`);
      return { skipped: true, reason: `Unknown action type: ${action_type}` };
  }
}

async function createContact(supabase: any, config: any, scope: CrmScope) {
  const { contactId } = await createCrmContact(supabase, scope, {
    email: config.email,
    firstName: config.firstName,
    lastName: config.lastName,
    phone: config.phone,
    company: config.company,
    source: config.source || "workflow",
    tags: config.tags || [],
    customFields: config.customFields || {},
  });
  return { contactId, action: "created" };
}

async function updateContact(supabase: any, config: any, scope: CrmScope) {
  await updateCrmContact(supabase, scope, config.contactId, {
    firstName: config.firstName,
    lastName: config.lastName,
    phone: config.phone,
    company: config.company,
    tags: config.tags,
    customFields: config.customFields,
  });
  return { contactId: config.contactId, action: "updated" };
}

async function createLead(supabase: any, config: any, scope: CrmScope) {
  const result = await createCrmLead(supabase, scope, {
    title: config.title,
    stage: config.status || config.stage || "new",
    email: config.email,
    name: config.name,
    phone: config.phone,
    source: config.source,
    notes: config.notes,
    value: config.value,
    contactId: config.contactId,
    metadata: config.metadata,
  });
  return { leadId: result.leadId, action: "created" };
}

async function updateLeadStatus(supabase: any, config: any, scope: CrmScope) {
  const stage = config.status || config.stage;
  await updateCrmLead(supabase, scope, config.leadId, { stage });
  return { leadId: config.leadId, status: stage, action: "status_updated" };
}

async function createActivity(supabase: any, config: any, scope: CrmScope) {
  const result = await createCrmActivity(supabase, scope, {
    type: config.activityType || config.type || 'note',
    title: config.title,
    description: config.description,
    contactId: config.contactId,
    leadId: config.leadId,
    metadata: config.metadata,
  });
  return { activityId: result.activityId, action: "created" };
}

async function sendEmail(config: any) {
  // Placeholder for email sending - integrate with Resend or other email service
  console.log("Email action:", config);
  return { 
    action: "email_queued", 
    to: config.to, 
    subject: config.subject,
    note: "Email sending requires Resend integration"
  };
}

async function callWebhook(config: any) {
  const rawUrl = typeof config?.url === "string" ? config.url : "";
  const validatedUrl = validateOutboundWebhookUrl(rawUrl);
  if (!validatedUrl.ok) {
    throw new Error(validatedUrl.error);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const response = await (async () => {
    try {
      return await fetch(validatedUrl.url.toString(), {
        method: normalizeWebhookMethod(config?.method),
        headers: {
          "Content-Type": "application/json",
          ...sanitizeWebhookHeaders(config?.headers),
        },
        body: JSON.stringify(config.payload || {}),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  })();

  return {
    action: "webhook_called",
    url: validatedUrl.url.toString(),
    status: response.status,
    success: response.ok,
  };
}

async function delay(config: any) {
  const delayMs = (config.minutes || 1) * 60 * 1000;
  await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 10000))); // Max 10s for edge function
  return { action: "delayed", minutes: config.minutes };
}

async function evaluateCondition(supabase: any, config: any) {
  // Simple condition evaluation
  const { field, operator, value, entityType, entityId } = config;
  
  let data;
  if (entityType === "contact") {
    const result = await supabase.from("crm_contacts").select("*").eq("id", entityId).single();
    data = result.data;
  } else if (entityType === "lead") {
    const result = await supabase.from("crm_leads").select("*").eq("id", entityId).single();
    data = result.data;
  }

  if (!data) return { conditionMet: false, reason: "Entity not found" };

  const fieldValue = data[field];
  let conditionMet = false;

  switch (operator) {
    case "equals":
      conditionMet = fieldValue === value;
      break;
    case "not_equals":
      conditionMet = fieldValue !== value;
      break;
    case "contains":
      conditionMet = String(fieldValue).includes(value);
      break;
    case "greater_than":
      conditionMet = Number(fieldValue) > Number(value);
      break;
    case "less_than":
      conditionMet = Number(fieldValue) < Number(value);
      break;
  }

  return { conditionMet, field, operator, value, actualValue: fieldValue };
}
