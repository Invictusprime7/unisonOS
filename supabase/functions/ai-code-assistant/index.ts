/**
 * ai-code-assistant - Thin entry point.
 *
 * Responsibilities: validate -> classify -> orchestrate -> respond.
 * All logic lives in orchestrator.ts and its dependencies.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { AIRequestSchema } from "../_shared/requestSchema.ts";
import { classifyBuilderEditTask, classifyTask } from "../_shared/taskClassifier.ts";
import { runAssistantOrchestrator } from "./orchestrator.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyAuth, authError } from "../_shared/auth.ts";
import { errorResponse } from "../_shared/response.ts";
import { safeParseBody } from "../_shared/validate.ts";
import { handleImageGenerate } from "./imageExtension.ts";

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req, corsHeaders);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  try {
    const startMs = Date.now();

    const auth = await verifyAuth(req);
    if (!auth.user) {
      return authError(auth.error || "Unauthorized", auth.status, corsHeaders);
    }

    const { data: rawBody, error: parseError } = await safeParseBody(req, 4_194_304);
    if (parseError || !rawBody) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      console.error("[ai-code-assistant] body parse failed", { parseError, status });
      return errorResponse(parseError || "Invalid request body", status, corsHeaders);
    }

    // Image extension: site-aware image generation for the clicked element.
    if ((rawBody as { mode?: unknown }).mode === "image-generate") {
      return await handleImageGenerate(rawBody, req, auth.user.id, corsHeaders);
    }

    const parsed = AIRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return errorResponse("Invalid request body", 400, corsHeaders, {
        details: parsed.error.issues.slice(0, 10).map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      });
    }

    const envelope = (parsed.data as { requestEnvelope?: Record<string, unknown> }).requestEnvelope;
    const clientSkipResearch = (parsed.data as { skipResearch?: boolean }).skipResearch;

    const baseTask = classifyTask({
      mode: parsed.data.mode ?? undefined,
      systemsBuildContext: parsed.data.systemsBuildContext,
      currentCode: parsed.data.currentCode ?? undefined,
      editMode: parsed.data.editMode ?? false,
      templateAction: parsed.data.templateAction ?? undefined,
      navPageGen: parsed.data.navPageGen ?? false,
      surgicalEdit: parsed.data.surgicalEdit ?? false,
      behavioralEdit: parsed.data.behavioralEdit ?? false,
      debugMode: parsed.data.debugMode ?? false,
      vfsFiles: parsed.data.vfsFiles,
      launchBrief: parsed.data.launchBrief,
      wizardSeed: (parsed.data as { wizardSeed?: unknown }).wizardSeed,
    });

    // The interpreter envelope refines (never widens) the deterministic task:
    // it may turn research off, and turns it on when it says research is needed.
    const needsResearch = envelope?.needsExternalResearch === true;
    const task = {
      ...baseTask,
      editClassification: classifyBuilderEditTask(envelope),
      skipResearch: needsResearch ? false : (clientSkipResearch ?? baseTask.skipResearch),
    };

    console.log(
      `[ai-code-assistant] task=${task.type} editClass=${task.editClassification ?? 'none'} fastPath=${task.fastPath} skipResearch=${task.skipResearch} envelopeKinds=${
        JSON.stringify((envelope?.requestKinds as string[] | undefined) ?? [])
      } elapsed-classify=${Date.now() - startMs}ms`,
    );

    const response = await runAssistantOrchestrator(parsed.data, task, corsHeaders, auth.user.id, req.signal);
    console.log(`[ai-code-assistant] completed task=${task.type} total=${Date.now() - startMs}ms`);
    return response;
  } catch (error) {
    console.error("Error in ai-code-assistant:", error);

    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      return errorResponse(
        "Request timed out. The AI service is taking too long. Please try again.",
        504,
        corsHeaders,
        { errorType: "timeout" },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    let userMessage = message;
    let errorType = "unknown";

    if (message.includes("All AI providers failed") || message.includes("All AI models failed")) {
      const configuredNone = message.includes("Configured providers: none");
      const hasAuthFailure = /401|403|invalid[_\s-]?api[_\s-]?key|unauthorized|authentication/i.test(message);
      const detailsMatch = message.match(/Last errors:\s*(.+)$/i);
      const details = detailsMatch?.[1]?.slice(0, 220);

      if (configuredNone) {
        userMessage = "AI providers are not configured on the backend. Please verify the managed AI gateway secret is available.";
        errorType = "provider_not_configured";
      } else if (hasAuthFailure) {
        userMessage = "Managed AI gateway authentication failed. The backend key is unavailable or stale; rotate the managed gateway key and redeploy the AI functions.";
        errorType = "provider_auth";
      } else {
        userMessage = details
          ? `AI providers failed to produce a response. ${details}`
          : "AI providers failed to produce a response. Please retry in a moment.";
        errorType = "ai_unavailable";
      }
    } else if (message.includes("network") || message.includes("fetch")) {
      userMessage = "Network error connecting to AI service. Please check your connection and try again.";
      errorType = "network";
    } else if (message.includes("JSON") || message.includes("parse")) {
      userMessage = "Received invalid response from AI service. Please try again.";
      errorType = "parse_error";
    }

    return errorResponse(userMessage, 500, corsHeaders, {
      errorType,
      details: message !== userMessage ? message : undefined,
    });
  }
});
