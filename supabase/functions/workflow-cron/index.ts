import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { secureJsonResponse, errorResponse } from "../_shared/response.ts";
import { updateCrmWorkflow } from "../_shared/canonicalCrm.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req, corsHeaders);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  // Verify this is an authorized cron invocation
  // Supabase cron jobs pass the service role key in the Authorization header
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const isAuthorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (serviceKey && authHeader === `Bearer ${serviceKey}`);

  if (!isAuthorized) {
    console.warn("[workflow-cron] Unauthorized invocation attempt");
    return errorResponse("Unauthorized", 401, corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const workflowProcessorSecret = Deno.env.get("WORKFLOW_PROCESSOR_SECRET");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const automationRuntimeHeaders = {
      Authorization: `Bearer ${supabaseServiceKey}`,
    };

    console.log("Workflow cron job started at:", new Date().toISOString());

    // Fetch all scheduled workflows that are due
    const { data: workflows, error: workflowError } = await supabase
      .from("crm_workflows")
      .select("*")
      .eq("is_active", true)
      .eq("trigger_type", "schedule");

    if (workflowError) {
      console.error("Error fetching workflows:", workflowError);
      throw new Error("Failed to fetch scheduled workflows");
    }

    console.log(`Found ${workflows?.length || 0} scheduled workflows`);

    const triggeredWorkflows: string[] = [];
    const now = new Date();

    for (const workflow of workflows || []) {
      const config = workflow.trigger_config || {};
      const cronExpression = config.cron;
      const lastRun = config.lastRun ? new Date(config.lastRun) : null;

      // Simple cron check (for production, use a proper cron parser)
      const shouldRun = shouldRunCron(cronExpression, lastRun, now);

      if (shouldRun) {
        console.log(`Triggering workflow: ${workflow.name} (${workflow.id})`);

        // Create workflow run
        const { data: workflowRun, error: runError } = await supabase
          .from("crm_workflow_runs")
          .insert({
            workflow_id: workflow.id,
            status: "running",
            trigger_data: {
              triggered_by: "cron",
              scheduled_time: now.toISOString(),
              business_id: workflow.business_id,
              project_id: workflow.project_id,
            },
          })
          .select()
          .single();

        if (runError) {
          console.error(`Error creating run for workflow ${workflow.id}:`, runError);
          continue;
        }

        // Queue jobs for each step
        const steps = workflow.steps || [];
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          await supabase.from("crm_workflow_jobs").insert({
            workflow_run_id: workflowRun.id,
            step_index: i,
            action_type: step.action_type,
            action_config: step.config || {},
            status: "queued",
            scheduled_at: now.toISOString(),
          });
        }

        // Update last run time
        await updateCrmWorkflow(supabase, {
          businessId: workflow.business_id,
          projectId: workflow.project_id,
        }, workflow.id, { triggerConfig: { ...config, lastRun: now.toISOString() } });

        // Trigger job processor
        await supabase.functions.invoke("workflow-job-processor", {
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            ...(workflowProcessorSecret ? { "x-workflow-processor-secret": workflowProcessorSecret } : {}),
          },
          body: { workflowRunId: workflowRun.id },
        });

        triggeredWorkflows.push(workflow.id);
      }
    }

    // Also process any pending jobs that may have failed
    const { data: pendingJobs, error: pendingError } = await supabase
      .from("crm_workflow_jobs")
      .select("workflow_run_id")
      .eq("status", "queued")
      .lt("scheduled_at", now.toISOString())
      .limit(100);

    if (!pendingError && pendingJobs?.length) {
      const uniqueRunIds = [...new Set(pendingJobs.map(j => j.workflow_run_id))];
      console.log(`Found ${uniqueRunIds.length} workflow runs with pending jobs`);
      
      for (const runId of uniqueRunIds) {
        await supabase.functions.invoke("workflow-job-processor", {
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            ...(workflowProcessorSecret ? { "x-workflow-processor-secret": workflowProcessorSecret } : {}),
          },
          body: { workflowRunId: runId },
        });
      }
    }

    // =========================================================================
    // Process new automation system jobs (automation_jobs table)
    // =========================================================================
    const { data: automationJobs, error: autoJobError } = await supabase
      .from("automation_jobs")
      .select("id, run_id, node_id")
      .eq("status", "queued")
      .lte("execute_at", now.toISOString())
      .limit(100);

    if (!autoJobError && automationJobs?.length) {
      console.log(`Found ${automationJobs.length} automation jobs to process`);
      
      // Group by run_id
      const runIds = [...new Set(automationJobs.map(j => j.run_id))];
      
      for (const runId of runIds) {
        const job = automationJobs.find(j => j.run_id === runId);
        if (job) {
          console.log(`Resuming automation run: ${runId} from node: ${job.node_id}`);
          
          // Mark job as processing
          await supabase
            .from("automation_jobs")
            .update({ status: "processing" })
            .eq("id", job.id);
          
          // Resume the automation run
          await supabase.functions.invoke("automation-runtime", {
            headers: automationRuntimeHeaders,
            body: { runId, resumeFromNodeId: job.node_id },
          });
          
          // Mark job as completed
          await supabase
            .from("automation_jobs")
            .update({ status: "completed", processed_at: now.toISOString() })
            .eq("id", job.id);
        }
      }
    }

    // =========================================================================
    // Resume paused automation runs that are due
    // =========================================================================
    const { data: pausedRuns, error: pausedError } = await supabase
      .from("automation_runs")
      .select("id, current_node_id")
      .eq("status", "paused")
      .lte("paused_until", now.toISOString())
      .limit(50);

    if (!pausedError && pausedRuns?.length) {
      console.log(`Found ${pausedRuns.length} paused automation runs to resume`);
      
      for (const run of pausedRuns) {
        console.log(`Resuming paused run: ${run.id}`);
        await supabase.functions.invoke("automation-runtime", {
          headers: automationRuntimeHeaders,
          body: { runId: run.id, resumeFromNodeId: run.current_node_id },
        });
      }
    }

    return secureJsonResponse(
      {
        success: true,
        triggeredWorkflows,
        timestamp: now.toISOString(),
      },
      200,
      corsHeaders
    );
  } catch (error: unknown) {
    console.error("Error in workflow-cron:", error);
    return errorResponse("Workflow cron failed", 500, corsHeaders);
  }
});

function shouldRunCron(cronExpression: string | undefined, lastRun: Date | null, now: Date): boolean {
  if (!cronExpression) return false;

  // Simple interval-based check (for production use a proper cron parser like cron-parser)
  // Supports: @hourly, @daily, @weekly, or interval in minutes like "*/5" for every 5 minutes
  
  if (!lastRun) return true; // Never run before

  const diffMinutes = (now.getTime() - lastRun.getTime()) / (1000 * 60);

  switch (cronExpression) {
    case "@hourly":
      return diffMinutes >= 60;
    case "@daily":
      return diffMinutes >= 1440;
    case "@weekly":
      return diffMinutes >= 10080;
    default:
      // Check for */N pattern (every N minutes)
      const match = cronExpression.match(/^\*\/(\d+)$/);
      if (match) {
        const interval = parseInt(match[1], 10);
        return diffMinutes >= interval;
      }
      // Default to running if cron expression is not recognized
      return diffMinutes >= 60;
  }
}
