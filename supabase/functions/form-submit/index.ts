import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { publicCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { secureJsonResponse, errorResponse } from "../_shared/response.ts";
import { safeParseBody } from "../_shared/validate.ts";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "../_shared/rateLimit.ts";
import { createCrmActivity, createCrmLead } from "../_shared/canonicalCrm.ts";

const RATE_LIMIT_CONFIG = { maxRequests: 20, windowSeconds: 300 };

const FORM_INTENTS = [
  "contact.submit",
  "quote.request",
  "booking.request",
  "newsletter.subscribe",
  "application.submit",
] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

async function validateTenantContext(
  supabase: any,
  context: { businessId: string; projectId: string; siteId: string },
): Promise<boolean> {
  const [projectResult, siteResult] = await Promise.all([
    supabase.from("projects").select("id,business_id").eq("id", context.projectId).maybeSingle(),
    supabase.from("sites").select("id,business_id").eq("id", context.siteId).maybeSingle(),
  ]);
  return (
    !projectResult.error &&
    !siteResult.error &&
    projectResult.data?.business_id === context.businessId &&
    siteResult.data?.business_id === context.businessId
  );
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req, publicCorsHeaders);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, publicCorsHeaders);
  }

  const limiter = checkRateLimit("form-submit", getClientIp(req), RATE_LIMIT_CONFIG);
  const rateHeaders = rateLimitHeaders(limiter, RATE_LIMIT_CONFIG);
  if (!limiter.allowed) {
    return secureJsonResponse(
      { success: false, error: "Too many form submissions. Please try again later." },
      429,
      publicCorsHeaders,
      rateHeaders,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const workflowProcessorSecret = Deno.env.get("WORKFLOW_PROCESSOR_SECRET");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const bodySchema = z.object({
      businessId: z.string().trim(),
      projectId: z.string().trim(),
      siteId: z.string().trim(),
      snapshotId: z.string().trim().max(200).optional(),
      formId: z.string().trim().min(1).max(200),
      formName: z.string().trim().max(200).optional(),
      intent: z.enum(FORM_INTENTS),
      pageId: z.string().trim().max(200).optional(),
      componentId: z.string().trim().max(200).optional(),
      sourceUrl: z.string().trim().max(2048).optional(),
      referrer: z.string().trim().max(2048).optional(),
      utmSource: z.string().trim().max(200).optional(),
      utmMedium: z.string().trim().max(200).optional(),
      utmCampaign: z.string().trim().max(200).optional(),
      consentMetadata: z.record(z.string(), z.unknown()).default({}),
      idempotencyKey: z.string().trim().min(16).max(200),
      honeypot: z.string().max(200).optional(),
      data: z.record(z.string(), z.unknown()).default({}),
    });

    const { data: rawBody } = await safeParseBody<Record<string, unknown>>(req, 65_536);
    const parsed = bodySchema.safeParse(rawBody ?? null);
    if (!parsed.success) {
      return errorResponse("Invalid request body", 400, publicCorsHeaders);
    }

    const {
      businessId,
      projectId,
      siteId,
      snapshotId,
      formId,
      formName,
      intent,
      pageId,
      componentId,
      sourceUrl,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      consentMetadata,
      idempotencyKey,
      honeypot,
      data: rawData,
    } = parsed.data;

    if (![businessId, projectId, siteId].every(isUuid)) {
      return errorResponse("Invalid form runtime context", 400, publicCorsHeaders);
    }
    if (!(await validateTenantContext(supabase, { businessId, projectId, siteId }))) {
      return errorResponse("Form runtime context does not match an active tenant", 403, publicCorsHeaders);
    }
    if (honeypot?.trim()) {
      return secureJsonResponse({ success: true, message: "Form submitted successfully" }, 200, publicCorsHeaders);
    }

    const { data: existingSubmission } = await supabase
      .from("crm_form_submissions")
      .select("id,contact_id,lead_id")
      .eq("business_id", businessId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existingSubmission) {
      return secureJsonResponse(
        {
          success: true,
          duplicate: true,
          submissionId: existingSubmission.id,
          contactId: existingSubmission.contact_id,
          leadId: existingSubmission.lead_id,
          message: "Form submitted successfully",
        },
        200,
        publicCorsHeaders,
        rateHeaders,
      );
    }

    const sanitizeString = (v: string) =>
      v
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
        .slice(0, 5000);

    const sanitizeRecord = (obj: Record<string, unknown>) => {
      const out: Record<string, unknown> = {};
      const entries = Object.entries(obj).slice(0, 50);
      for (const [k, v] of entries) {
        const key = String(k).slice(0, 100);
        if (typeof v === "string") out[key] = sanitizeString(v);
        else if (typeof v === "number" || typeof v === "boolean" || v === null) out[key] = v;
        else if (Array.isArray(v)) out[key] = v.slice(0, 20);
        else out[key] = "[unsupported]";
      }
      return out;
    };

    const data = sanitizeRecord(rawData);

    const { data: definition, error: definitionError } = await supabase
      .from("form_definitions")
      .select("intent,fields")
      .eq("business_id", businessId)
      .eq("project_id", projectId)
      .eq("site_id", siteId)
      .eq("external_id", formId)
      .eq("is_active", true)
      .maybeSingle();
    if (definitionError) {
      throw new Error("Could not resolve the approved form definition");
    }
    // Legacy compatibility: sites launched before form_definitions existed (and
    // Builder-added forms with generated ids) have no definition row. The tenant
    // context and the intent enum are already validated above, so accept the
    // submission instead of silently dropping the owner's leads.
    if (definition && definition.intent !== intent) {
      return errorResponse("Form intent does not match its approved definition", 400, publicCorsHeaders);
    }
    if (Array.isArray(definition?.fields)) {
      const missingRequired = definition.fields.some((field: unknown) => {
        if (!field || typeof field !== "object") return false;
        const record = field as { name?: unknown; required?: unknown };
        return record.required === true &&
          (typeof record.name !== "string" || !String(data[record.name] ?? "").trim());
      });
      if (missingRequired) {
        return errorResponse("Missing required form fields", 400, publicCorsHeaders);
      }
    }

    console.log("Form submission received:", { businessId, projectId, siteId, formId, intent, keys: Object.keys(data).length });

    // Get client info
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Store the form submission
    const { data: submission, error: submitError } = await supabase
      .from("crm_form_submissions")
      .insert({
        business_id: businessId,
        project_id: projectId,
        site_id: siteId,
        snapshot_id: snapshotId ?? null,
        form_id: formId,
        form_name: formName,
        intent,
        page_id: pageId ?? null,
        component_id: componentId ?? null,
        data,
        source_url: sourceUrl,
        referrer: referrer ?? null,
        utm_source: utmSource ?? null,
        utm_medium: utmMedium ?? null,
        utm_campaign: utmCampaign ?? null,
        consent_metadata: consentMetadata,
        idempotency_key: idempotencyKey,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (submitError) {
      console.error("Error storing submission:", submitError);
      throw new Error("Failed to store form submission");
    }

    console.log("Form submission stored:", submission.id);

    // Persist the contact and lead through the shared CRM command path.
    let contactId = null;
    let leadId = null;
    const email = (data as any).email || (data as any).Email || (data as any).EMAIL;
    
    const getStr = (key: string): string | undefined => {
      const v = (data as any)[key];
      return typeof v === "string" ? v : undefined;
    };
    const nameFromFull = (full?: string) => {
      const parts = (full || "").trim().split(/\s+/).filter(Boolean);
      return { first: parts[0], last: parts.slice(1).join(" ") };
    };

    if (typeof email === "string" && email.length > 0) {
      const fallbackName = nameFromFull(getStr("name"));
      const result = await createCrmLead(supabase, { businessId, projectId }, {
        title: (getStr("name")?.trim() || String(formName || formId)).slice(0, 240),
        email: String(email),
        name: getStr("name") || null,
        phone: getStr("phone") || getStr("Phone") || null,
        source: `form:${formId}`,
        intent,
        notes: getStr("message")?.slice(0, 2_000) || null,
        metadata: { form_submission_id: submission.id, original_data: data },
        contact: {
          email: String(email),
          firstName: (getStr("firstName") || getStr("first_name") || fallbackName.first || "").slice(0, 120) || null,
          lastName: (getStr("lastName") || getStr("last_name") || fallbackName.last || "").slice(0, 120) || null,
          phone: (getStr("phone") || getStr("Phone") || "").slice(0, 40) || null,
          company: (getStr("company") || getStr("Company") || "").slice(0, 120) || null,
          source: `form:${formId}`,
          customFields: { form_submission_id: submission.id, original_data: data },
        },
      });
      contactId = result.contactId;
      leadId = result.leadId;
    }

    await supabase
      .from("crm_form_submissions")
      .update({ contact_id: contactId, lead_id: leadId })
      .eq("id", submission.id);

    // Check for workflows triggered by this form
    const { data: workflows } = await supabase
      .from("crm_workflows")
      .select("*")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .eq("trigger_type", "form_submit");

    let triggeredWorkflows: string[] = [];

    for (const workflow of workflows || []) {
      const config = workflow.trigger_config || {};
      
      // Check if workflow should trigger for this form
      if (config.formId && config.formId !== formId) continue;
      if (config.formIds && !config.formIds.includes(formId)) continue;

      console.log(`Triggering workflow: ${workflow.name} (${workflow.id})`);

      // Create workflow run
      const { data: workflowRun, error: runError } = await supabase
        .from("crm_workflow_runs")
        .insert({
          workflow_id: workflow.id,
          status: "running",
          trigger_data: {
            form_id: formId,
            form_name: formName,
            submission_id: submission.id,
            contact_id: contactId,
            lead_id: leadId,
            business_id: businessId,
            project_id: projectId,
            site_id: siteId,
            intent,
             form_data: data,
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
        
        // Inject form data into action config
        const actionConfig = {
          ...step.config,
           _formData: data,
          _contactId: contactId,
          _submissionId: submission.id,
        };

        await supabase.from("crm_workflow_jobs").insert({
          workflow_run_id: workflowRun.id,
          step_index: i,
          action_type: step.action_type,
          action_config: actionConfig,
          status: "queued",
          scheduled_at: new Date().toISOString(),
        });
      }

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

    // Update submission to mark workflow triggered
    if (triggeredWorkflows.length > 0) {
      await supabase
        .from("crm_form_submissions")
        .update({ workflow_triggered: true })
        .eq("id", submission.id);
    }

    // Check for automations triggered by form submission
    const { data: automations } = await supabase
      .from("crm_automations")
      .select("*")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .eq("trigger_event", "form_submitted");

    for (const automation of automations || []) {
      console.log(`Running automation: ${automation.name}`);
      // Process automation actions (simplified)
      for (const action of automation.actions || []) {
        if (action.type === "create_activity" && contactId) {
          await createCrmActivity(supabase, { businessId, projectId }, {
            type: "note",
            title: `Form submission: ${formName || formId}`,
            description: `Contact submitted form with data keys: ${Object.keys(data).join(",")}`,
            contactId,
            leadId,
          });
        }
      }
    }

    return secureJsonResponse(
      {
        success: true,
        submissionId: submission.id,
        contactId,
        leadId,
        triggeredWorkflows,
        message: "Form submitted successfully",
      },
      200,
      publicCorsHeaders,
    );
  } catch (error: unknown) {
    console.error("Error in form-submit:", error);
    return errorResponse("Form submission failed", 500, publicCorsHeaders);
  }
});
