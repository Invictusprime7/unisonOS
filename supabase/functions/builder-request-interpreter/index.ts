// deno-lint-ignore-file no-import-prefix
/**
 * builder-request-interpreter
 *
 * Milestone 1 of the Builder Intelligence Pipeline.
 * Sole responsibility: UNDERSTAND a builder request and return a structured
 * BuilderRequestEnvelope as JSON. It never generates code, never patches files.
 *
 * The frontend may pass deterministic regex `hints`; they are advisory only.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildUnisonDesignArchitectureDirective } from "../_shared/canonicalPipelinePrompt.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyAuth, authError } from "../_shared/auth.ts";
import { errorResponse, secureJsonResponse } from "../_shared/response.ts";
import { safeParseBody } from "../_shared/validate.ts";
import { createChatCompletion, isTextGenerationConfigured } from "../_shared/ai/providerClient.ts";
import { DEFAULT_GEMINI_GATEWAY_MODEL } from "../_shared/geminiModel.ts";
import {
  BUSINESS_CAPABILITY_IDS,
  filterBusinessCapabilityIds,
} from "../_shared/businessCapabilityVocabulary.ts";

const AI_MODEL = DEFAULT_GEMINI_GATEWAY_MODEL;
const MAX_PROMPT_CHARS = 24_000;

const ABSTRACT_GOAL_ONTOLOGY = `
- trustworthy (established, credible, professional) -> designTraits: trustworthy; consistent-typography; restrained-palette; clear-hierarchy
- premium (luxury, high-end, elevated) -> designTraits: premium; editorial-spacing; restrained-accent; strong-typography
- modern (sleek, clean, contemporary) -> designTraits: modern; generous-whitespace; subtle-motion; consistent-radii
- easier_to_buy -> businessGoals: easier_to_buy | requestedBusinessCapabilities: catalog.products; commerce.cart; commerce.checkout
- easier_to_book -> businessGoals: easier_to_book | requestedBusinessCapabilities: catalog.services; booking.appointments; crm.contacts; notifications.email
- shopify_like -> businessGoals: shopify_like | requestedBusinessCapabilities: catalog.products; commerce.cart; commerce.checkout; crm.contacts; notifications.email
- real_business_system -> businessGoals: real_business_system | requestedBusinessCapabilities: catalog.services; crm.leads; crm.contacts; booking.appointments; automation.follow_up; notifications.email
- lead_generation -> businessGoals: lead_generation | requestedBusinessCapabilities: forms.contact; crm.leads; automation.follow_up; notifications.email
`.trim();

/** The ONLY values allowed in requestedBusinessCapabilities. */
const CAPABILITY_VOCABULARY = BUSINESS_CAPABILITY_IDS.join(" | ");
const EDITOR_OPERATION_VOCABULARY = [
  "copy.rewrite", "copy.move", "copy.reorder", "section.create", "section.remove", "section.move", "section.reorder",
  "page.create", "page.rename", "page.remove", "route.bind", "navigation.update", "style.update", "theme.update",
  "asset.replace", "resource.update", "binding.update", "intent.bind", "behavior.update", "backend.configure", "debug.fix",
] as const;

const SYSTEM_PROMPT = `You are the Request Interpreter for Unison's AI Builder — an AI business system builder (website + catalog + CRM + bookings + automations as one connected system).

Your ONLY job is to understand the user's request and emit a structured JSON envelope. You NEVER write code, never propose file contents, never answer the request.

Rules:
1. MULTI-LABEL. A request usually has several requestKinds and several domains. Never collapse to one.
2. READ THE WHOLE PROMPT. Requirements stated at the very end matter as much as the first sentence. Every distinct requirement becomes a goal entry.
3. Preserve constraints verbatim-ish ("keep the existing colors", "don't touch the nav").
4. TYPED REQUEST DOMAINS — never mix them:
   - designTraits: presentation language (modern, premium, spacing, typography, palette). NEVER a backend capability.
   - experienceFeatures: motion/immersive features (motion.marquee, parallax, 3d scene). NEVER a backend capability.
   - businessGoals: outcome language (easier_to_book, more leads). NEVER a capability id.
   - editorOperations: deterministic editor operations implied by the request (set-slot-text, set-variant, set-theme-token, set-intent).
   - requestedBusinessCapabilities: ONLY values from this closed vocabulary: ${CAPABILITY_VOCABULARY}. Emit nothing else here; if a need does not map to one of these, express it as a businessGoal.
   Ground abstract outcome language using this ontology:
${ABSTRACT_GOAL_ONTOLOGY}
5. needsExternalResearch is TRUE only when the answer genuinely depends on current external information (competitor/product research, live pricing, third-party API docs). Editing, debugging, local backend wiring, and architecture questions are FALSE.
6. needsApproval is TRUE for backend/database/destructive/deployment changes.
7. EDIT OPERATION VOCABULARY — classify requested mutations separately from broad domains. Use only: ${EDITOR_OPERATION_VOCABULARY.join(' | ')}. A request may require several operations.
8. TARGET RELATIONSHIP — scope.relation is single_target, source_destination, multi_target, or site_wide. For copy.move / section.move / section.reorder, identify sourceTarget and destinationTarget separately; never treat the destination as an extra source edit. For footer links pointing to a new page, classify page.create + navigation.update + route.bind and use multi_target. Do not fabricate selectors or page IDs; if the target cannot be resolved from context, add an ambiguity and a goal to resolve it.
9. SELECTED AI EDIT SCOPE — when PROJECT CONTEXT includes selectedEditScope.selection=explicit, treat that scope as a hard bound. If the requested operation requires a wider target, list the scope conflict as an ambiguity and ask for confirmation; do not silently widen it. If selection=auto, you may widen only to the minimum scope required by the operation plan and state that scope.
10. Preserve canonical ownership: page/route changes are topology-owned, saved-record changes are resource-owned, intent changes are binding-owned, and visual changes are presentation-owned. Never turn source copy into a business capability.
11. complexity: simple = one coherent change; compound = multiple related changes; program = multi-phase work across site + backend.
12. executionMode: answer_only (no code), direct_patch, planned_patch, tool_actions, mixed.
13. confidence is your own 0..1 estimate. If the request is ambiguous, list ambiguities instead of guessing silently.

Return ONLY minified JSON matching:
{"summary":string,"requestKinds":string[],"domains":string[],"scope":{"level":string,"targets":string[],"relation":"single_target"|"source_destination"|"multi_target"|"site_wide","sourceTarget"?:string,"destinationTarget"?:string},"goals":[{"id":string,"description":string,"priority":"required"|"preferred"|"optional"}],"constraints":string[],"assumptions":string[],"dependencies":string[],"ambiguities":string[],"complexity":string,"executionMode":string,"needsExternalResearch":boolean,"needsApproval":boolean,"confidence":number,"businessGoals":string[],"designTraits":string[],"experienceFeatures":string[],"editorOperations":string[],"requestedBusinessCapabilities":string[]}
requestKinds ⊂ create|edit|debug|review|explain|plan|data_binding|backend_configuration|deployment
domains ⊂ layout|visual_design|copy|navigation|catalog|crm|booking|auth|commerce|forms|automation|database|runtime|content_structure|pages|assets|typography|accessibility
scope.level ∈ element|block|section|page|site|backend|workspace
scope.relation ∈ single_target|source_destination|multi_target|site_wide
editorOperations ⊂ ${EDITOR_OPERATION_VOCABULARY.join(" | ")}`;

interface InterpretRequestBody {
  prompt?: string;
  hints?: Record<string, unknown>;
  context?: {
    projectMode?: string;
    runtimeEngine?: string;
    vertical?: string;
    capabilities?: string[];
    currentPageId?: string;
    currentPagePath?: string;
    pageTargets?: Array<{ pageId?: string; title?: string; route?: string; filePath?: string; isHome?: boolean }>;
    selectedEditScope?: { scopeType?: string; targetId?: string; selection?: 'explicit' | 'auto' } | null;
    selectedElement?: {
      selector?: string;
      text?: string;
      tagName?: string;
      pageId?: string | null;
      pagePath?: string | null;
      sectionId?: string | null;
      sectionType?: string | null;
      blockId?: string | null;
      slotId?: string | null;
      sourceLocator?: string | null;
      resourceMark?: string | null;
      targetPath?: string | null;
      intent?: string | null;
    } | null;
    filePaths?: string[];
    recentTurns?: Array<{ role: string; content: string }>;
    objective?: string;
    durableDecisions?: string[];
  };
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function buildContextBlock(ctx: InterpretRequestBody["context"]): string {
  if (!ctx) return "";
  const lines: string[] = [];
  if (ctx.projectMode) lines.push(`projectMode: ${ctx.projectMode}`);
  if (ctx.runtimeEngine) lines.push(`runtimeEngine: ${ctx.runtimeEngine}`);
  if (ctx.vertical) lines.push(`vertical: ${ctx.vertical}`);
  if (ctx.capabilities?.length) lines.push(`installedCapabilities: ${ctx.capabilities.slice(0, 40).join(", ")}`);
  if (ctx.currentPageId) lines.push(`currentPage: ${ctx.currentPageId}`);
  if (ctx.currentPagePath) lines.push(`currentRoute: ${ctx.currentPagePath}`);
  if (ctx.selectedEditScope) {
    lines.push(`selectedEditScope: ${ctx.selectedEditScope.scopeType || 'unknown'} target=${ctx.selectedEditScope.targetId || 'unknown'} selection=${ctx.selectedEditScope.selection || 'auto'}`);
  }
  if (ctx.pageTargets?.length) {
    const pages = ctx.pageTargets.slice(0, 40).map((page) =>
      `- ${page.title || 'Untitled'} | route=${page.route || 'unknown'} | file=${page.filePath || 'unknown'}${page.pageId ? ` | id=${page.pageId}` : ''}${page.isHome ? ' | home' : ''}`
    );
    lines.push(`pageManifest:\n${pages.join('\n')}`);
  }
  if (ctx.selectedElement) {
    lines.push(
      `selectedElement: ${[
        ctx.selectedElement.tagName,
        ctx.selectedElement.text?.slice(0, 160),
        ctx.selectedElement.selector,
        ctx.selectedElement.pageId,
        ctx.selectedElement.pagePath,
        ctx.selectedElement.sectionId,
        ctx.selectedElement.sectionType,
        ctx.selectedElement.blockId,
        ctx.selectedElement.slotId,
        ctx.selectedElement.sourceLocator,
        ctx.selectedElement.resourceMark,
        ctx.selectedElement.targetPath,
        ctx.selectedElement.intent,
      ]
        .filter(Boolean)
        .join(" | ")}`,
    );
  }
  if (ctx.filePaths?.length) lines.push(`fileManifest: ${ctx.filePaths.slice(0, 120).join(", ")}`);
  if (ctx.objective) lines.push(`currentObjective: ${ctx.objective}`);
  if (ctx.durableDecisions?.length) {
    lines.push(`durableDecisions:\n- ${ctx.durableDecisions.slice(0, 20).join("\n- ")}`);
  }
  if (ctx.recentTurns?.length) {
    const turns = ctx.recentTurns
      .slice(-8)
      .map((t) => `${t.role}: ${String(t.content ?? "").slice(0, 400)}`)
      .join("\n");
    lines.push(`recentConversation:\n${turns}`);
  }
  return lines.length ? `\n\nPROJECT CONTEXT\n${lines.join("\n")}` : "";
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req, corsHeaders);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  try {
    const auth = await verifyAuth(req);
    if (!auth.user) {
      return authError(auth.error || "Unauthorized", auth.status, corsHeaders);
    }

    const { data: body, error: parseError } = await safeParseBody(req, 1_048_576);
    if (parseError || !body) {
      return errorResponse(parseError || "Invalid request body", 400, corsHeaders);
    }

    const payload = body as InterpretRequestBody;
    const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
    if (!prompt) {
      return errorResponse("prompt is required", 400, corsHeaders);
    }

    if (!isTextGenerationConfigured()) {
      return secureJsonResponse(
        { envelope: null, degraded: true, reason: "ai_not_configured" },
        200,
        corsHeaders,
      );
    }

    const truncated = prompt.length > MAX_PROMPT_CHARS;
    const promptForModel = truncated
      ? `${prompt.slice(0, MAX_PROMPT_CHARS / 2)}\n\n[...middle elided...]\n\n${prompt.slice(-MAX_PROMPT_CHARS / 2)}`
      : prompt;

    const hintsBlock = payload.hints
      ? `\n\nDETERMINISTIC HINTS (advisory only — override them freely):\n${JSON.stringify(payload.hints).slice(0, 2000)}`
      : "";

    const response = await createChatCompletion({
      model: AI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT + buildUnisonDesignArchitectureDirective("brief") },
        {
          role: "user",
          content: `USER REQUEST:\n"""\n${promptForModel}\n"""${buildContextBlock(payload.context)}${hintsBlock}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[builder-request-interpreter] provider error", response.status, detail.slice(0, 400));
      return secureJsonResponse(
        { envelope: null, degraded: true, reason: "provider_error", status: response.status },
        200,
        corsHeaders,
      );
    }

    const json = await response.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    const envelope = extractJson(text);

    if (!envelope) {
      console.warn("[builder-request-interpreter] unparseable model output");
      return secureJsonResponse(
        { envelope: null, degraded: true, reason: "unparseable" },
        200,
        corsHeaders,
      );
    }

    // Typed-domain enforcement: an unknown capability id is a schema problem,
    // never a backend-provisioning request. Drop it here so it can never reach
    // capability-pack verification.
    const typedEnvelope = envelope && typeof envelope === "object"
      ? {
        ...(envelope as Record<string, unknown>),
        requestedBusinessCapabilities: filterBusinessCapabilityIds(
          (envelope as Record<string, unknown>).requestedBusinessCapabilities ??
            (envelope as Record<string, unknown>).requestedCapabilities,
        ),
      }
      : envelope;

    return secureJsonResponse(
      { envelope: typedEnvelope, degraded: false, truncated },
      200,
      corsHeaders,
    );
  } catch (error) {
    console.error("[builder-request-interpreter] error", error);
    return secureJsonResponse(
      { envelope: null, degraded: true, reason: "exception" },
      200,
      corsHeaders,
    );
  }
});
