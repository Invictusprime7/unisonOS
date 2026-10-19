/**
 * ai-code-assistant - Thin entry point.
 *
 * Responsibilities: validate -> classify -> orchestrate -> respond.
 * All logic lives in orchestrator.ts and its dependencies.
 */

import { AIRequestSchema } from "../_shared/requestSchema.ts";
import { aiComposerRequestSchema } from "../_shared/aiComposerContract.ts";
import { classifyBuilderEditTask, classifyTask } from "../_shared/taskClassifier.ts";
import { runAssistantOrchestrator } from "./orchestrator.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { getServiceRoleClient, verifyAuth, authError } from "../_shared/auth.ts";
import { errorResponse } from "../_shared/response.ts";
import { safeParseBody } from "../_shared/validate.ts";
import { handleImageGenerate } from "./imageExtension.ts";
import { classifyGuestDemoError, createGuestDemoUsageMeter, executeGuestDemoAction, releaseGuestDemoAction, validateGuestDemoRequest, type GuestDemoRpcClient, type GuestDemoUsageMeter } from "../_shared/guestDemo.ts";

async function addGuestOperationId(response: Response, operationId: string): Promise<Response> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  try {
    const body = await response.clone().json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return response;
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(JSON.stringify({ ...body, guestDemoOperationId: operationId }), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}

export async function handleAssistant(req: Request, pageGenerationOnly = false): Promise<Response> {
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

    const allowGuestDemo = Deno.env.get("GUEST_DEMO_ENABLED") === "true";
    const auth = await verifyAuth(req, { allowAnonymous: allowGuestDemo });
    if (!auth.user) {
      return authError(auth.error || "Unauthorized", auth.status, corsHeaders);
    }

    const { data: rawBody, error: parseError } = await safeParseBody(req, 4_194_304);
    if (parseError || !rawBody) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      console.error("[ai-code-assistant] body parse failed", { parseError, status });
      return errorResponse(parseError || "Invalid request body", status, corsHeaders);
    }

    if (pageGenerationOnly) {
      const body = rawBody as { mode?: unknown; messages?: Array<{ role?: unknown; content?: unknown }> };
      const message = body.messages?.length === 1 ? body.messages[0] : undefined;
      let composer: unknown;
      try { composer = typeof message?.content === 'string' ? JSON.parse(message.content) : null; } catch { composer = null; }
      const request = aiComposerRequestSchema.safeParse(composer);
      if (!request.success || message?.role !== 'user'
        || !['site_page_author', 'site_page_repair'].includes(request.data.task)
        || body.mode !== (request.data.task === 'site_page_author' ? 'site-page-author' : 'site-page-repair')) {
        return errorResponse('Page generation requires a canonical page authoring or repair request.', 400, corsHeaders);
      }
    }

    const guestAction = rawBody as { guestDemoAction?: unknown; operationId?: unknown; reason?: unknown };
    if (guestAction.guestDemoAction === "release") {
      if (!allowGuestDemo || !auth.user.isAnonymous) {
        return errorResponse("Guest demo release is not available", 403, corsHeaders, {
          errorType: "guest_capability_denied",
        });
      }
      if (typeof guestAction.operationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(guestAction.operationId)) {
        return errorResponse("A valid guest demo operation ID is required", 400, corsHeaders, {
          errorType: "invalid_operation_id",
        });
      }
      await releaseGuestDemoAction(
        getServiceRoleClient() as unknown as GuestDemoRpcClient,
        auth.user.id,
        guestAction.operationId,
        typeof guestAction.reason === "string" ? guestAction.reason : "client-release",
      );
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    // Image extension: site-aware image generation for the clicked element.
    if ((rawBody as { mode?: unknown }).mode === "image-generate") {
      if (auth.user.isAnonymous) {
        return errorResponse("Image generation is unavailable in the free demo", 403, corsHeaders, {
          errorType: "guest_capability_denied",
        });
      }
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

    const runAssistant = async (request: typeof parsed.data, guestUsageMeter?: GuestDemoUsageMeter) => {
      const envelope = request.requestEnvelope as Record<string, unknown> | undefined;
      const clientSkipResearch = request.skipResearch;
      const baseTask = classifyTask({
        mode: request.mode ?? undefined,
        systemsBuildContext: request.systemsBuildContext,
        currentCode: request.currentCode ?? undefined,
        editMode: request.editMode ?? false,
        templateAction: request.templateAction ?? undefined,
        navPageGen: request.navPageGen ?? false,
        surgicalEdit: request.surgicalEdit ?? false,
        behavioralEdit: request.behavioralEdit ?? false,
        debugMode: request.debugMode ?? false,
        vfsFiles: request.vfsFiles,
        launchBrief: request.launchBrief,
        wizardSeed: request.wizardSeed,
      });

      const needsResearch = !auth.user!.isAnonymous && envelope?.needsExternalResearch === true;
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

      const response = await runAssistantOrchestrator(request, task, corsHeaders, auth.user!.id, req.signal, guestUsageMeter);
      console.log(`[ai-code-assistant] completed task=${task.type} total=${Date.now() - startMs}ms`);
      return response;
    };

    if (!auth.user.isAnonymous) return await runAssistant(parsed.data);

    const operationId = parsed.data.runContext?.operationId;
    const encodedRequestBytes = new TextEncoder().encode(JSON.stringify(parsed.data)).byteLength;
    const requestedCapabilities = parsed.data.requestEnvelope?.requestedCapabilities?.length
      || parsed.data.requestEnvelope?.requestedBusinessCapabilities?.length
      || parsed.data.requestEnvelope?.requiresBackend === true;
    const requestIssue = validateGuestDemoRequest({
      mode: parsed.data.mode,
      operationId,
      encodedRequestBytes,
      maxInputTokens: Number.MAX_SAFE_INTEGER,
      hasAttachments: Boolean(parsed.data.attachments?.length)
        || parsed.data.generateImage === true
        || parsed.data.navPageGen === true
        || parsed.data.messages.some((message) => Array.isArray(message.content)),
      requestsBusinessCapabilities: Boolean(requestedCapabilities),
    });
    if (requestIssue) {
      return errorResponse(requestIssue, 403, corsHeaders, { errorType: "guest_capability_denied" });
    }

    const guestClient = getServiceRoleClient() as unknown as GuestDemoRpcClient;
    return await executeGuestDemoAction(
      guestClient,
      { guestUserId: auth.user.id, operationId: operationId! },
      async (reservation) => {
        const boundedIssue = validateGuestDemoRequest({
          mode: parsed.data.mode,
          operationId,
          encodedRequestBytes,
          maxInputTokens: reservation.max_input_tokens_per_request,
          hasAttachments: false,
          requestsBusinessCapabilities: false,
        });
        if (boundedIssue) {
          return errorResponse(boundedIssue, 413, corsHeaders, { errorType: "guest_request_too_large" });
        }

        const requestedMaxTokens = parsed.data.gatewayOptions?.maxTokens ?? reservation.max_output_tokens_per_request;
        const request = {
          ...parsed.data,
          skipResearch: true,
          systemsBuildContext: undefined,
          wizardSeed: undefined,
          launchBrief: undefined,
          templateAction: undefined,
          attachments: undefined,
          runContext: {
            draftId: reservation.draft_id,
            projectId: reservation.project_id,
            businessId: null,
            prompt: parsed.data.runContext?.prompt,
            operationId,
          },
          gatewayOptions: {
            ...parsed.data.gatewayOptions,
            maxTokens: Math.min(requestedMaxTokens, reservation.max_output_tokens_per_request),
            timeoutMs: Math.min(parsed.data.gatewayOptions?.timeoutMs ?? 60_000, 60_000),
          },
        };
        const guestUsageMeter = createGuestDemoUsageMeter(guestClient, {
          guestUserId: auth.user!.id,
          operationId: operationId!,
          reservation,
        });
        const response = await runAssistant(request, guestUsageMeter);
        return response.ok ? await addGuestOperationId(response, operationId!) : response;
      },
      (response) => !response.ok,
    );
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
    const guestDemoFailure = classifyGuestDemoError(error);
    if (guestDemoFailure) {
      return errorResponse(guestDemoFailure.message, guestDemoFailure.status, corsHeaders, {
        errorType: guestDemoFailure.errorType,
      });
    }
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
}
