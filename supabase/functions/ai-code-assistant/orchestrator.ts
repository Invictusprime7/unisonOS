import { runComposerLane } from './composerLane.ts';
import { runCanonicalEnrichmentLane } from './canonicalEnrichmentLane.ts';
import { runCompositionLane } from '../_shared/compositionLane.ts';
/**
 * Orchestrator — the brain of ai-code-assistant.
 * 
 * Decides which lane to run (A = Wizard, B = Builder),
 * assembles context, calls providers, and normalizes results.
 * 
 * index.ts should only: validate → classify → call orchestrator → return response.
 */

import { createClient } from "@supabase/supabase-js";
import { generateVariation, variationToPromptContext, type TemplateVariation } from "../_shared/industryVariations.ts";
import {
  getIndustryProfile,
  matchPagePattern,
  buildIndustryPageContext,
  getResearchQueries,
} from "../_shared/industryPagePatterns.ts";

import type { ClassifiedTask } from "../_shared/taskClassifier.ts";
import { builderEditClassificationDirective } from "../_shared/taskClassifier.ts";
import type { AIRequest } from "../_shared/requestSchema.ts";
import { buildProviderPlan, isGeminiExclusiveProviderMode } from "../_shared/providerRouter.ts";
import { postProcessContent, buildResponseBody } from "../_shared/responseNormalizer.ts";
import { extractTextContent } from "./utils.ts";
import { performPromptResearch, formatResearchContext, type ResearchResult } from "../_shared/webResearch.ts";
import {
  buildSystemTypeContext,
  buildDesignProfileContext,
  buildSystemsBlueprintContext,
  analyzeTemplateStructure,
  buildElementsLibraryBlock,
  buildRegistryContextBlock,
  buildVfsFilesContext,
  buildUserDBContext,
  buildWizardSeedContext,
  type UserDBContext,
  type WizardSeedShape,
} from "./contextBuilders.ts";
import { buildTemplateActionContext, buildEditModeContext, buildSurgicalEditReinforcement } from "./prompts/editPrompts.ts";
import { buildCodeModePrompt } from "./prompts/codePrompt.ts";
import { buildTemplateJsonPrompt, buildTemplateHtmlPrompt, buildTemplateReactPrompt } from "./prompts/templatePrompts.ts";
import { buildEditAssistantPrompt, buildDebugAssistantPrompt, buildGeneralBuilderPrompt } from "./prompts/builderPrompts.ts";
import { buildDesignDirectorDirective } from "./prompts/designDirector.ts";
import { buildUnisonDesignArchitectureDirective } from "../_shared/canonicalPipelinePrompt.ts";

import { generateImageIfNeeded } from "./imageGeneration.ts";
import { runProviderLoop } from "../_shared/aiProviderLoop.ts";
import { compactMessages, buildThinkingInstruction, buildCompactBuilderContext, detectIssueHint } from "./contextCompactor.ts";
import { buildSessionMemory, formatSessionMemoryBlock } from "./sessionMemory.ts";
import { reviewPatch } from "./reviewPass.ts";
import { checkEditScope } from "./reviewScope.ts";
import { buildApplyState, type ApplyState } from "./applyState.ts";
import { preprocessPrompt } from "../_shared/promptPreprocessor.ts";
import { buildLaunchDeskSystemPrompt, buildLaunchDeskUserMessage } from "./prompts/launchDeskPrompt.ts";
import { CATALOG_CHAT_TOOLS, renderCatalogToolDirective, isPageDesignRequest } from "../_shared/catalogTools.ts";
import { buildEnvelopeDirective, type EnvelopeShape } from "./envelopeContext.ts";
import { verifyAgainstEnvelope, buildRepairInstruction } from "./envelopeVerifier.ts";
import { recordEnvelopeRun, type EnvelopeRunContext } from "./envelopeRunLog.ts";
import {
  buildUnisonContextDirective,
  resolveBuilderInstruction,
  resolveReasoningEffort,
  resolveUnisonComplexity,
} from "./unisonContext.ts";


const BUILDER_EDIT_TASKS = new Set<string>([
  'surgical_edit', 'behavioral_edit', 'single_file_edit', 'multi_file_edit', 'template_react_edit',
]);

// ── Types ───────────────────────────────────────────────────────────────────

interface CodePattern {
  pattern_type: string;
  description: string | null;
  usage_count: number;
  success_rate: number;
  tags: string[] | null;
  code_snippet: string;
}

export interface OrchestratorResult {
  response: Response;
}

function buildWizardSeedBasePrompt(): string {
  return `You are the Lane B first-build generator for the System Launcher.
Generate the initial structured business website from the WizardSeed, canonical route registry, theme, intent contract, memory, research, and VFS context.

OUTPUT RULES:
- Return ONLY raw JSON: {"files":{"/src/pages/Home.tsx":"..."}}
- Do not use markdown fences or prose.
- Do not author /src/App.tsx, /src/main.tsx, config files, or package files.
- Emit complete React/TypeScript page/section files using semantic Tailwind tokens.
- Preserve the canonical routes and data-ut-intent contract from the WizardSeed.

RUNTIME + IMPORT CONTRACT (HARD):
- This project is a Vite + React Router single-page app. It is NOT Next.js, Remix, or Gatsby.
- External imports are limited to "react", "react-dom", and "react-router-dom". Never import from "next", any "next/*" module, "gatsby", "remix", or another application framework.
- Import icons, motion, schemas, forms, styling helpers, and UI controls only through the supplied "@/unison/ui" snapshot facades rather than raw packages.
- Use only "@/unison/ui" and its documented sub-paths for UI primitives: "@/unison/ui/button", "@/unison/ui/card", "@/unison/ui/content", "@/unison/ui/icon", "@/unison/ui/icons", "@/unison/ui/layout", "@/unison/ui/media", "@/unison/ui/motion", "@/unison/ui/animation", "@/unison/ui/backgrounds", "@/unison/ui/navigation", "@/unison/ui/recipes", "@/unison/ui/styles", "@/unison/ui/surface", "@/unison/ui/form-fields", "@/unison/ui/forms", "@/unison/ui/zod", "@/unison/ui/radix".
- COMPOSE FROM THE VOCABULARY. Build every band from the composition primitives instead of raw <div> + arbitrary utility soup — they already encode the sealed art direction's rhythm, measure, surfaces and motion:
  - layout: <Section tone wash flush as>, <Container width>, <Stack gap direction align wrap>, <Grid columns gap>, <Split reverse align>, <Divider />, <Bleed>
  - content: <Eyebrow>, <Heading level size gradient>, <Lead>, <Body>, <Badge>, <Stat value label hint>, <Quote attribution role media>, <CTAGroup>, <SectionHeader eyebrow title lead align>
  - surface: <Panel tone interactive padded>, <MediaFrame src alt ratio loading overlay>, <FeaturePanel title description icon media actions>
- Exactly one <h1> per page (a single <Heading level={1}>). Wrap every band in <Section> with a <Container> inside it.
- Always include the slash in the "@/" alias. Import Input, Textarea, Select, Checkbox, Label, and related form controls from "@/unison/ui/form-fields" or "@/unison/ui"; never from flat input/textarea/select/checkbox/label modules.
- Radix-derived primitives (accordion, alert-dialog, aspect-ratio, avatar, checkbox, collapsible, context-menu, dialog, dropdown-menu, hover-card, label, menubar, navigation-menu, popover, progress, radio-group, scroll-area, select, separator, slider, slot, switch, tabs, toast, toggle, toggle-group, tooltip) live ONLY at "@/unison/ui/radix/<primitive>" — never at the flat "@/unison/ui/<primitive>" path.
- "@/unison/ui/icons" is a FLAT module (it re-exports all of lucide-react): import icon components directly from it, e.g. import { Camera, X } from "@/unison/ui/icons". Never invent a nested path like "@/unison/ui/icons/lucide-react".
- "@/unison/ui/motion" only exports the curated recipes Reveal, RevealGroup, Stagger, StaggerItem, and the MotionRecipe type — nothing else. Raw framer-motion primitives (motion, AnimatePresence, useAnimation, useReducedMotion, useScroll, useInView, etc.) live at "@/unison/ui/animation" instead, e.g. import { motion, AnimatePresence } from "@/unison/ui/animation".
- COMPONENT CATALOG: every remaining installed shadcn component is emitted into the snapshot under "@/unison/ui/catalog" (barrel) and its per-component modules "@/unison/ui/catalog/alert", "@/unison/ui/catalog/breadcrumb", "@/unison/ui/catalog/calendar", "@/unison/ui/catalog/carousel", "@/unison/ui/catalog/chart", "@/unison/ui/catalog/command", "@/unison/ui/catalog/drawer", "@/unison/ui/catalog/input-otp", "@/unison/ui/catalog/pagination", "@/unison/ui/catalog/resizable", "@/unison/ui/catalog/sheet", "@/unison/ui/catalog/skeleton", "@/unison/ui/catalog/table", "@/unison/ui/catalog/sonner". They are token-styled and reduced-motion safe — use them instead of reimplementing a table, carousel, drawer, sheet, chart, calendar or command palette inline, and never import cmdk, vaul, embla-carousel-react, react-day-picker, input-otp, react-resizable-panels, recharts or sonner directly.
- IMMERSIVE / 3D EXPERIENCE LAYER: WebGL is available ONLY through the snapshot-owned experience facades "@/unison/ui/experience" (barrel), "@/unison/ui/experience/canvas", "@/unison/ui/experience/lazy", "@/unison/ui/experience/webgl", "@/unison/ui/experience/tokens", "@/unison/ui/experience/scene", "@/unison/ui/experience/media", "@/unison/ui/experience/stage". They export ExperienceCanvas, LightRig, ImmersiveHero, ParticleField, SceneBackground, FloatingMedia, DepthGallery, ProductStage, ModelViewer, useExperienceMaterial, useExperienceEnabled. Never import "three", "@react-three/fiber", "@react-three/drei" or create a raw WebGL <canvas> yourself; never author files under "/src/unison/ui/experience/".
- Experience budget: at most ONE heavy scene primitive (ImmersiveHero, ProductStage, ModelViewer, DepthGallery) per page band and TWO per page, only when the sealed design intervention lists the matching recipe. Readable copy and intent-bearing CTAs must live in the DOM, never inside the 3D scene.
- Do not import "@/unison/ui/tailwind.css" from a page; it is already applied globally.
- Use plain <img alt="..."> for images, not a framework-specific Image component.
- Every emitted source string must independently parse as TSX. Balance every JSX tag, brace, bracket, parenthesis, quote, and template literal before returning JSON.${buildDesignDirectorDirective()}${buildUnisonDesignArchitectureDirective('full')}`;
}


function buildWizardInteractionBasePrompt(): string {
  return `You are the final interaction planner for a validated System Launcher website.
Return ONLY raw JSON with this exact shape: {"templateId":"provided template id","layoutSignature":"provided template layout signature","interactions":[{"target":{"kind":"template-root|interactive|intent","value":"only for intent"},"effect":"hover-lift|hover-glow|reveal|stagger-reveal|click-feedback"}]}.
Do not return TSX, CSS, imports, files, routes, handlers, selectors outside the target vocabulary, or prose.
You may choose at most 12 interactions. Preserve all template layout, semantic HSL tokens, data-ut-intent attributes, routes, and page topology.`;
}

function buildWizardContentBasePrompt(): string {
  return `You are the content planner for a validated System Launcher page.
Return ONLY raw JSON containing authored content and approved presentation choices. The client compiler owns TSX, routes, imports, theme classes, and behavior.
Do not return files, source code, JSX, CSS, markdown, prose outside JSON, arbitrary keys, or executable expressions.
Follow the exact JSON schema and enum values supplied in the user message. Write specific, polished copy grounded in the supplied business and industry context.`;
}

function buildWizardCanonicalEnrichmentBasePrompt(): string {
  return `You are Unison's senior digital art director and React composition engineer for page-body enrichment.

The canonical compiler has already established:
- page topology and routes
- page identities and required purposes
- required intents and data bindings
- theme tokens and Stage 4b CSS authority
- approved UI imports and component facade

Your responsibility: rewrite the supplied canonical page body into a visually stronger, production-quality React component inspired by modern web benchmarks (Framer, Linear, Lovable, bespoke agency compositions) while preserving all semantic contracts.

INTENT-DRIVEN ARCHITECTURE & SECTION DERIVATION:
- Adaptive Page Posture: Not every page requires a giant marketing hero with oversized photography.
  * Showcase / Narrative pages (Home, About, Portfolio, Services): Feature an evocative Visual Hero with strong typography, badge, split or full media, and marquee trust ribbons.
  * Task / Action pages (Booking, Contact, Quote, Checkout): Never let oversized hero images push action controls down. Use a compact, elegant Task Header (clear title, reassuring subtitle, status pill) followed immediately by a framed interactive action surface (<Panel>).
- Context-Aware Form Fields: Do NOT default to generic name/email/message. Tailor input fields to the industry and conversion intent:
  * Salon / Spa: Service selection, preferred stylist/specialist, date/time preference, hair/skin treatment notes.
  * Contractor / Trades: Project address, scope of work, timeline urgency, budget range, property type.
  * Coaching / Consulting: Focus area, primary goal, current hurdle, preferred meeting format.
  * SaaS / Tech: Work email, team size, primary use case, deployment environment.
  * E-Commerce / Store: Product inquiry, order reference, sizing/variant questions.
  Wrap form fields inside <Panel> cards using <FormGrid columns={2}> and <FormField>, <Input>, <Textarea>, <Select>.
- Modern Typography & Micro-Copy: Generate sophisticated industry-specific terminology and crisp value propositions rather than boilerplate filler.

You may author:
- Asymmetric, expressive composition and grid geometry
- Framer-tier Bento grids (<BentoFeatureGrid>, <FeaturePanel>)
- Oversized editorial typography and visual rhythm (strictly ONE <h1> per page)
- Layered media with motion and hover depth (<HoverDepth>, <MediaFrame>)
- Horizontal rails, marquee bands (<MarqueeBand>), parallax treatments
- Sticky narrative regions and varied section widths
- Free-form but responsive layout within semantic tokens
- Intentional hover and focus behavior using @/unison/ui/motion primitives
- Bounded motion choreography honoring useReducedMotion()

You must NOT:
- Change page topology, routes, or identities
- Replace protected files (App.tsx, index.css, .unison/**, /src/unison/**)
- Override Stage 4b theme tokens or palette
- Invent imports or use paths outside the approved @/unison/ui contract
- Add npm dependencies or mutate package.json
- Lose or hide required intents (data-ut-intent attributes)
- Create duplicate H1 elements
- Use hardcoded CSS values instead of Stage 4b tokens or Tailwind classes

OUTPUT RULES:
- Return ONLY raw JSON: {"version":"1.0","wizardSeedId":"...","snapshotId":"...","designRegistrySignature":"...","fileOps":[{"type":"replace","path":"/src/pages/...","content":"..."}]}
- Do not use markdown fences or prose.
- Emit complete, valid React/TypeScript page source.
- One file per page, path must match the registered page registry.
- Preserve the canonical routes, data-ut-intent contract, and binding semantics.
- Use only @/unison/ui imports (motion, animation, backgrounds, layout, content, surface, form-fields, icons, button, card, navigation, recipes).
- Compose from the vocabulary: Section, Container, Stack, Grid, Split, Heading, Body, Lead, Panel, MediaFrame, CTAGroup, and motion primitives.
- All motion must honor useReducedMotion() for accessibility.`;
}


// ── Main Orchestrator Entry ─────────────────────────────────────────────────

export function runAssistantOrchestrator(
  parsed: AIRequest,
  task: ClassifiedTask,
  corsHeaders: Record<string, string>,
  userId?: string,
  signal?: AbortSignal,
): Promise<Response> {
  if (task.type === 'site_discovery') {
    return runSiteDiscoveryLane(parsed, task, corsHeaders, signal);
  }

  if (task.type === 'wizard_canonical_enrichment') {
    // Repair turns append assistant + instruction messages after the canonical
    // context record, so the context is the LAST message that actually parses
    // as an enrichment request — never blindly the final message.
    const texts = parsed.messages.map(message => extractTextContent(message?.content));
    const isEnrichmentContext = (text: string) => {
      try { const value = JSON.parse(text); return !!value && typeof value === 'object' && Array.isArray((value as { pageRegistry?: unknown }).pageRegistry); } catch { return false; }
    };
    let contextIndex = -1;
    for (let index = texts.length - 1; index >= 0; index--) { if (isEnrichmentContext(texts[index])) { contextIndex = index; break; } }
    const context = contextIndex >= 0 ? texts[contextIndex] : texts[texts.length - 1];
    const followUps = contextIndex >= 0
      ? parsed.messages.slice(contextIndex + 1).map((message, offset) => ({
          role: message?.role === 'assistant' ? 'assistant' : 'user',
          content: texts[contextIndex + 1 + offset],
        })).filter(message => message.content)
      : [];
    const providerPlan = buildProviderPlan(task, true, { timeoutMs: 85000, maxTokens: 16000 }, 'simple', context);
    const enrichmentSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(100000)]);
    return runCanonicalEnrichmentLane(context, corsHeaders, buildWizardCanonicalEnrichmentBasePrompt(), aiMessages => runProviderLoop({ aiMessages, providerPlan, navPageGen: false, reasoningEffort: 'none', signal: enrichmentSignal }), followUps);
  }

  if (task.type === 'site_page_author' || task.type === 'site_page_repair' || task.type === 'builder_source_edit') {
    const context = extractTextContent(parsed.messages[parsed.messages.length - 1]?.content);
    const deadline = Date.now() + Math.min(145_000, parsed.gatewayOptions?.timeoutMs ?? 110_000);
    const providerPlan = buildProviderPlan(task, true, { timeoutMs: 110000, maxTokens: task.type === 'site_page_author' ? 16000 : 48000, ...parsed.gatewayOptions }, 'complex', context);
    return runComposerLane(context, corsHeaders, aiMessages => runProviderLoop({
      aiMessages, providerPlan, navPageGen: false,
      reasoningEffort: parsed.gatewayOptions?.reasoningEffort ?? (task.type === 'site_page_author' ? 'low' : 'medium'), signal,
      totalBudgetMs: Math.max(1, deadline - Date.now()),
    }));
  }

  if (task.type === 'wizard_composition') {
    const context = extractTextContent(parsed.messages[parsed.messages.length - 1]?.content);
    const providerPlan = buildProviderPlan(task, true, { ...parsed.gatewayOptions, maxTokens: 6000, timeoutMs: 35000 }, 'simple', context);
    return runCompositionLane(context, corsHeaders, aiMessages => runProviderLoop({
      aiMessages, providerPlan, navPageGen: false, reasoningEffort: 'none', signal,
    }));
  }
  if (task.type === 'theme_edit') return runThemeEditLane(parsed, task, corsHeaders, signal);
  if (task.type === "launch_desk") {
    return runLaunchDeskLane(parsed, task, corsHeaders, signal);
  }
  // Source-generation and editing tasks use the builder lane.
  return runBuilderLane(parsed, task, corsHeaders, userId, signal);
}

async function runSiteDiscoveryLane(
  parsed: AIRequest,
  task: ClassifiedTask,
  corsHeaders: Record<string, string>,
  signal?: AbortSignal,
): Promise<Response> {
  const confirmationMarker = '<UNISON_SITE_CONFIRMATION>';
  const systemPrompt = `You are Unison's friendly site-planning assistant. Plan the user's website together with the selection controls embedded directly beneath each of your questions. The Wizard is part of this conversation, not a later setup phase.

Have a concise, natural conversation. Use the conversation history and ask at most one useful follow-up question at a time when essential details are missing. Learn the business and audience, main site goal, important visitor actions, pages, and visual direction when known. Do not write code, invent business facts, or claim the site has already been built.

Guide these selection steps in context: industry (business type and audience), goals (main outcome), questions (visitor actions and functionality), pages, aesthetic (visual style and art direction), brand (brand name), then confirm (review and create). Every reply must ask one question for one step and append exactly one marker: <UNISON_WIZARD_STEP:industry>, <UNISON_WIZARD_STEP:goals>, <UNISON_WIZARD_STEP:questions>, <UNISON_WIZARD_STEP:pages>, <UNISON_WIZARD_STEP:aesthetic>, <UNISON_WIZARD_STEP:brand>, or <UNISON_WIZARD_STEP:confirm>. This shows matching selection controls. Ask for a brand name if it is missing. Skip details already supplied, revisit the relevant step for changes, and use confirmed selections from "My selection:" messages as authoritative. Do not defer any selection to a Wizard at the end. Users can choose controls or answer in their own words.

Once there is enough information, summarize the proposed site direction in plain language and ask whether it is right. Only when you explicitly ask the user to confirm a complete site direction, append this exact marker on its own final line: ${confirmationMarker}

Use the marker only for a clear confirmation request. If the user suggests changes, revise the plan and ask for confirmation again without treating the change request as approval.`;
  const conversation = compactMessages(
    parsed.messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({
        role: message.role,
        content: extractTextContent(message.content),
      })),
    12,
    3000,
  );
  const latestUserMessage = [...conversation].reverse().find((message) => message.role === 'user');
  const latestUserText = typeof latestUserMessage?.content === 'string'
    ? latestUserMessage.content
    : '';
  const providerPlan = buildProviderPlan(
    task,
    true,
    { ...parsed.gatewayOptions, timeoutMs: 45000, maxTokens: 1200 },
    'simple',
    latestUserText,
  );
  const providerResult = await runProviderLoop({
    aiMessages: [{ role: 'system', content: systemPrompt }, ...conversation],
    providerPlan,
    navPageGen: false,
    reasoningEffort: 'none',
    signal,
  });

  if (providerResult.earlyError) {
    return new Response(JSON.stringify({ error: providerResult.earlyError.error }), {
      status: providerResult.earlyError.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...(providerResult.earlyError.status === 429 ? { 'Retry-After': '1' } : {}),
      },
    });
  }

  return new Response(JSON.stringify({
    choices: [{ message: { content: providerResult.content } }],
    content: providerResult.content,
    mode: 'site-discovery',
    wizardStep: providerResult.content.match(/<UNISON_WIZARD_STEP:(industry|goals|questions|pages|aesthetic|brand|confirm)>/)?.[1],
    modelUsed: providerResult.modelUsed,
    providerUsed: providerResult.providerUsed,
  }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(providerResult.providerUsed ? { 'X-Unison-AI-Provider': providerResult.providerUsed } : {}),
    },
  });
}

// ============================================================================
// LANE B — Builder Orchestration (memory, compaction, research, rich response)
// ============================================================================
//
// In-Builder AI edits may carry the durable WizardSeed for project context.


// ============================================================================
// LANE C — Launch Desk (structured JSON plan, no memory, no research)
// ============================================================================

async function runLaunchDeskLane(
  parsed: AIRequest,
  task: ClassifiedTask,
  corsHeaders: Record<string, string>,
  signal?: AbortSignal,
): Promise<Response> {
  console.log('[orchestrator] LANE C: launch_desk');

  const { messages, launchBrief } = parsed;

  let systemPrompt = buildLaunchDeskSystemPrompt();
  systemPrompt += buildEnvelopeDirective(parsed.requestEnvelope as EnvelopeShape | undefined);
  systemPrompt += buildUnisonContextDirective(parsed.unisonContext);

  // Build the user turn — synthesise the brief from launchBrief fields,
  // falling back to the last user message if no launchBrief was supplied.
  let userContent: string;
  if (launchBrief) {
    userContent = buildLaunchDeskUserMessage(launchBrief);
  } else {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    userContent = typeof lastUser?.content === 'string' ? lastUser.content : 'No brief provided.';
  }

  const aiMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  const launchComplexity = resolveUnisonComplexity('moderate', parsed.unisonContext);
  const launchReasoningEffort = resolveReasoningEffort(
    parsed.gatewayOptions?.reasoningEffort,
    launchComplexity,
  );
  const geminiExclusive = isGeminiExclusiveProviderMode();
  const providerPlan = buildProviderPlan(task, Boolean(
    Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('UNISONGEMINI_API_KEY') ||
    (!geminiExclusive && (Deno.env.get('OPENAI_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY'))),
  ), parsed.gatewayOptions, launchComplexity, userContent);
  const providerResult = await runProviderLoop({
    aiMessages,
    providerPlan,
    navPageGen: false,
    reasoningEffort: launchReasoningEffort,
    signal,
  });

  if (providerResult.earlyError) {
    return new Response(
      JSON.stringify({ error: providerResult.earlyError.error }),
      {
        status: providerResult.earlyError.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          ...(providerResult.earlyError.status === 429 ? { 'Retry-After': '1' } : {}),
        },
      },
    );
  }

  // Attempt to parse as structured JSON plan; fall back to raw text.
  const rawContent = providerResult.content;
  let plan: unknown = null;
  try {
    const stripped = rawContent.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    plan = JSON.parse(stripped);
  } catch {
    // Model returned prose — wrap it so the frontend can still display something.
    plan = { summary: rawContent, tasks: [], riskRegister: [], ownerChecklist: {}, launchCopy: {}, followUpQuestions: [] };
  }

  return new Response(
    JSON.stringify({
      content: JSON.stringify(plan),
      plan,
      modelUsed: providerResult.modelUsed,
      providerUsed: providerResult.providerUsed,
      mode: 'launch-desk',
    }),
    {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...(providerResult.providerUsed ? { 'X-Unison-AI-Provider': providerResult.providerUsed } : {}),
      },
    },
  );
}

async function runBuilderLane(
  parsed: AIRequest,
  task: ClassifiedTask,
  corsHeaders: Record<string, string>,
  userId?: string,
  signal?: AbortSignal,
): Promise<Response> {
  console.log(`[orchestrator] LANE B: ${task.type} (sub-behavior: ${
    task.type === 'debug_fix' ? 'builder_debug' :
    task.type === 'wizard_seed_generation' ? 'wizard_seed_generation' :
    task.type === 'wizard_canonical_enrichment' ? 'wizard_canonical_enrichment' :
    ['surgical_edit', 'behavioral_edit', 'single_file_edit', 'multi_file_edit', 'template_react_edit'].includes(task.type) ? 'builder_edit' :
    'builder_generate'
  })`);

  // Only funded providers count toward the full model plan. Gemini-only is the
  // safe default until AI_PROVIDER_MODE is explicitly switched to "hybrid".
  const geminiExclusive = isGeminiExclusiveProviderMode();
  const hasConfiguredProvider = Boolean(
    Deno.env.get('GEMINI_API_KEY') ||
    Deno.env.get('GOOGLE_API_KEY') ||
    Deno.env.get('UNISONGEMINI_API_KEY') ||
    (!geminiExclusive && (Deno.env.get('OPENAI_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY')))
  );
  const {
    messages, mode, savePattern = true, generateImage = false, imagePlacement,
    currentCode, editMode = false, debugMode: _debugMode = false,
    templateAction, systemType, variationSeed, templateName, aesthetic, source,
    userDesignProfile, systemsBuildContext, navPageGen = false, navPageName, navLabel,
    siteElementsLibraryContext, registryContext, surgicalEdit = false,
    componentBehaviorContext, vfsFiles, gatewayOptions,
    previewDiagnostics, previewSnapshot, recentChangedFiles, targetFile,
  } = parsed;
  const editScope = (parsed as { editScope?: import("./reviewScope.ts").EditScopeInput }).editScope;
  const wizardSeed = (parsed as { wizardSeed?: WizardSeedShape }).wizardSeed;

  // ── 0. Prompt preprocessing (typo fix, intent extraction, keyword distillation)
  const rawUserPromptText = resolveBuilderInstruction(
    extractTextContent(messages[messages.length - 1]?.content),
    parsed.runContext?.prompt,
  );
  const preprocessed = preprocessPrompt(rawUserPromptText);
  const userPromptText = preprocessed.normalized;
  if (preprocessed.wasNormalized) {
    console.log(`[orchestrator] Prompt normalized: ${preprocessed.intents.length} intents, ${preprocessed.searchKeywords.length} keywords`);
  }

  // ── 1. Session memory (Lane B only) ────────────────────────────────────
  const memory = task.shouldUseMemory
    ? buildSessionMemory({
        userPromptText,
        systemType: systemType ?? undefined,
        source: source ?? undefined,
        templateName: templateName ?? undefined,
        aesthetic: aesthetic ?? undefined,
        vfsFiles,
        currentCode: currentCode ?? undefined,
        debugMode: _debugMode,
        previewDiagnostics: previewDiagnostics ?? undefined,
        recentChangedFiles: recentChangedFiles ?? undefined,
        messageCount: messages.length,
      })
    : undefined;
  const memoryBlock = formatSessionMemoryBlock(memory);

  // ── 2. Learned patterns (skip only for fast tasks) ─────────────────────
  let learnedPatterns = 'No patterns loaded.';
  if (!task.fastPath) {
    learnedPatterns = await fetchLearnedPatterns();
  }

  // ── 3. Context blocks ─────────────────────────────────────────────────
  const systemTypeContext = buildSystemTypeContext(systemType ?? undefined);
  const designProfileContext = buildDesignProfileContext(userDesignProfile);
  const systemsBuildContextText = buildSystemsBlueprintContext(systemsBuildContext);
  const templateStructure = currentCode ? analyzeTemplateStructure(currentCode) : '';
  const templateActionCtx = buildTemplateActionContext(templateAction ?? undefined);
  const editModeContext = buildEditModeContext(editMode, currentCode ?? undefined, templateStructure, templateActionCtx);

  // ── 3a. User DB context (history + drafts) ─────────────────────────────
  const userDBCtx = userId && !task.fastPath
    ? await fetchUserContext(userId).catch(() => null)
    : null;
  const userDBContextBlock = buildUserDBContext(userDBCtx);

  // ── 4. Base system prompt ──────────────────────────────────────────────
  let basePrompt: string;
  if (task.type === 'wizard_seed_generation') {
    basePrompt = buildWizardSeedBasePrompt();
  } else if (task.type === 'wizard_canonical_enrichment') {
    basePrompt = buildWizardCanonicalEnrichmentBasePrompt();
  } else if (task.type === 'wizard_interaction_enrichment') {
    basePrompt = buildWizardInteractionBasePrompt();
  } else if (task.type === 'wizard_content_enrichment') {
    basePrompt = buildWizardContentBasePrompt();
  } else if (mode === 'template-json' || mode === 'template-html' || mode === 'template-react') {
    const templatePromptText = templateName
      ? `${templateName} ${aesthetic || ''} ${source || ''}`
      : userPromptText;
    const variation = generateVariation(templatePromptText, variationSeed ?? undefined);
    const variationContext = variationToPromptContext(variation);

    // Detect if user intent overrides default design tokens
    const userOverrideDirective = detectUserDesignOverride(userPromptText, variation);

    if (mode === 'template-json') {
      basePrompt = buildTemplateJsonPrompt(variation, variationContext + userOverrideDirective);
    } else if (mode === 'template-html') {
      basePrompt = buildTemplateHtmlPrompt(variation, variationContext + userOverrideDirective);
    } else {
      basePrompt = buildTemplateReactPrompt(variation, variationContext + userOverrideDirective, currentCode ?? undefined, templateAction ?? undefined);
    }
  } else {
    basePrompt = buildCodeModePrompt({ editModeContext, learnedPatterns });
  }

  // ── 5. Parallel work: research + nav research + image ──────────────────
  const researchPromise = task.skipResearch
    ? Promise.resolve({ snippets: [], trends: [], keyPhrases: [], queriesUsed: [] } as ResearchResult)
    : performPromptResearch(userPromptText, preprocessed.searchKeywords);

  const navResearchPromise: Promise<string> = (navPageGen && systemType)
    ? runNavResearch(systemType, navPageName ?? undefined, navLabel ?? undefined)
    : Promise.resolve('');

  const imagePromise = generateImageIfNeeded({
    userPrompt: userPromptText.toLowerCase(),
    generateImage,
    imagePlacement: imagePlacement ?? undefined,
    fastTemplateReact: false,
  });

  const [research, industryPageContext, imageResult] = await Promise.all([
    researchPromise, navResearchPromise, imagePromise,
  ]);

  const researchContext = formatResearchContext(research);

  // ── 6. Compact messages + builder context ──────────────────────────────
  const effectiveComplexity = resolveUnisonComplexity(
    preprocessed.complexity.tier,
    parsed.unisonContext,
  );
  const complexContext = effectiveComplexity === 'complex' || effectiveComplexity === 'advanced';
  const processedMessages = compactMessages(messages.filter(m => m.content !== undefined), complexContext ? 10 : 6, complexContext ? 30000 : 15000);

  // Builder-priority VFS compaction (issue-aware)
  const issueHint = detectIssueHint(previewDiagnostics ?? undefined, memory?.goalCategory);
  const builderContext = task.shouldUseCompactContext
    ? buildCompactBuilderContext({
        vfsFiles,
        changedFiles: [...(parsed.unisonContext?.targetFiles ?? []), ...(memory?.recentChangedFiles ?? [])],
        maxChars: complexContext ? 140_000 : 80_000,
        currentCode: currentCode ?? undefined,
        previewDiagnostics: previewDiagnostics ?? undefined,
        issueHint,
        goalCategory: memory?.goalCategory,
      })
    : { compactedFiles: '', fileCount: 0, excludedFiles: [] };

  // ── 7. Assemble final prompt by task type ──────────────────────────────
  const thinkingInstruction = task.type === 'wizard_seed_generation' || task.type === 'wizard_canonical_enrichment' || task.type === 'wizard_interaction_enrichment'
    ? ''
    : buildThinkingInstruction(task.skipThinking);
  const elementsLibraryBlock = buildElementsLibraryBlock(siteElementsLibraryContext, surgicalEdit);
  // V4 M8: identical canonical registry projection for the in-Builder lane.
  const registryContextBlock = buildRegistryContextBlock(registryContext);

  // For surgical edits, use old-style VFS context (byte-for-byte preservation)
  // For ALL edit tasks, provide VFS context for structure preservation (not just surgical)
  const isEditTask = ['surgical_edit', 'behavioral_edit', 'single_file_edit', 'multi_file_edit', 'template_react_edit'].includes(task.type);
  const vfsFilesContext = buildVfsFilesContext(surgicalEdit || isEditTask, vfsFiles, targetFile);
  const surgicalEditReinforcement = buildSurgicalEditReinforcement(surgicalEdit || isEditTask, vfsFilesContext);

  const imageContext = imageResult.generatedImageUrl
    ? `\n\n**IMPORTANT: An AI-generated image has been created for this request. Include this image HTML in your response at the appropriate location:**\n${imageResult.imageHtml}\n\nThe image is already styled for the "${imagePlacement || 'top-left'}" position. Make sure to include it in a relative-positioned container.`
    : '';

  // Use the non-surgical compacted files for non-surgical edits
  const compactedFilesBlock = task.type === 'wizard_seed_generation' || task.type === 'wizard_canonical_enrichment'
    ? ''
    : (surgicalEdit ? '' : builderContext.compactedFiles);

  let finalSystemPrompt: string;

  switch (task.type) {
    case "debug_fix":
      finalSystemPrompt = buildDebugAssistantPrompt({
        basePrompt,
        memoryBlock,
        compactedFilesBlock,
        thinkingInstruction,
      });
      break;

    case "behavioral_edit":
      finalSystemPrompt = buildEditAssistantPrompt({
        basePrompt,
        memoryBlock,
        compactedFilesBlock,
        surgicalReinforcement: surgicalEditReinforcement,
        researchContext,
        designContext: systemTypeContext + designProfileContext + registryContextBlock,
        blueprintContext: systemsBuildContextText,
        elementsLibrary: elementsLibraryBlock,
        thinkingInstruction,
        behavioralContext: componentBehaviorContext,
      });
      break;

    case "surgical_edit":
    case "single_file_edit":
    case "multi_file_edit":
    case "template_react_edit":
      finalSystemPrompt = buildEditAssistantPrompt({
        basePrompt,
        memoryBlock,
        compactedFilesBlock,
        surgicalReinforcement: surgicalEditReinforcement,
        researchContext,
        designContext: systemTypeContext + designProfileContext + registryContextBlock,
        blueprintContext: systemsBuildContextText,
        elementsLibrary: elementsLibraryBlock,
        thinkingInstruction,
      });
      break;

    default:
      // general_code_assist, nav_page_generation, template_json/html, wizard_seed_generation
      finalSystemPrompt = buildGeneralBuilderPrompt({
        basePrompt,
        memoryBlock,
        compactedFilesBlock,
        researchContext,
        industryPageContext,
        designContext: systemTypeContext + designProfileContext + registryContextBlock,
        blueprintContext: systemsBuildContextText,
        elementsLibrary: elementsLibraryBlock,
        thinkingInstruction,
        imageContext,
      });
      break;
  }

  if (task.type === 'wizard_seed_generation') {
    finalSystemPrompt += `\n\n[WIZARD SEED GENERATION — HARD OUTPUT REQUIREMENTS]\nThis is a first-launch website generation, not an explanation and not a patch review.\nReturn ONLY raw JSON in this exact shape: {"files": {"/src/pages/Home.tsx": "..."}}.\nDo NOT return prose, markdown, summaries, skeletons, placeholders, or a minimal fallback.\nDo NOT author /src/App.tsx, /src/main.tsx, package/config files, root files, or standalone SiteNavbar/SiteFooter modules.\nThe deterministic App router renders routes ONLY — it injects no navbar and no footer. Each page authors its own navigation and footer inline, sized and styled to fit that page, with links matching the registered routes. Never render two competing primary nav bars or two footers on one page.\nThe Home page must be a complete production landing page with at least 5 body content regions, real industry-specific copy, and working data-ut-intent attributes.\nEvery secondary page must contain at least 4 purpose-specific body regions and 1200+ characters of authored TSX, matching the launcher quality gate exactly.\nSilently self-check every requested file for parseable TSX, snapshot-approved imports, accessible image alt text, and canonical data-ut-intent wiring before returning JSON.\n`;
  }

  if (task.type === 'wizard_interaction_enrichment') {
    finalSystemPrompt += '\n\n[WIZARD INTERACTION ENRICHMENT — PLAN ONLY]\nReturn the interaction JSON object only. The client compiler owns all implementation and will reject any unsupported value.';
  }

  if (task.type === 'wizard_content_enrichment') {
    finalSystemPrompt += '\n\n[WIZARD CONTENT ENRICHMENT — DATA ONLY]\nReturn the requested content JSON object only. Never return a files envelope or executable source. The client compiler validates every field and owns implementation.';
  }

  // Inject parsed intent summary into system prompt for better understanding
  if (preprocessed.intentSummary) {
    finalSystemPrompt += preprocessed.intentSummary;
  }

  // Milestone 2: goal-aware generation. The interpreter envelope is authoritative
  // for WHAT must be built, not just how the request was routed.
  const envelopeDirective = buildEnvelopeDirective(
    (parsed as { requestEnvelope?: EnvelopeShape }).requestEnvelope,
  );
  if (envelopeDirective) {
    finalSystemPrompt += envelopeDirective;
    const env = (parsed as { requestEnvelope?: EnvelopeShape }).requestEnvelope;
    console.log('[orchestrator] envelope directive injected', {
      kinds: env?.requestKinds ?? [],
      domains: env?.domains ?? [],
      goals: (env?.goals ?? []).length,
      scope: env?.scope?.level,
    });
  }

  if (task.editClassification) {
    finalSystemPrompt += `\n\n${builderEditClassificationDirective(task.editClassification)}`;
  }

  const unisonDirective = buildUnisonContextDirective(parsed.unisonContext);
  if (unisonDirective) {
    finalSystemPrompt += unisonDirective;
  }


  // Inject live preview DOM snapshot for context awareness
  if (previewSnapshot) {
    finalSystemPrompt += `\n\n${previewSnapshot}\nUse this to understand what the user currently sees across every page of the site — sections, headings, menu, actions and theme — and target edits precisely.`;
  }

  // Inject component behavior context for all edit types
  if (componentBehaviorContext) {
    finalSystemPrompt += `\n\n[🧠 Component Behavior Map]\n${componentBehaviorContext}\nUse this to identify interactive elements, their current handlers, state, and wiring when making edits.`;
  }

  // Inject user history + draft context from Supabase
  if (userDBContextBlock) {
    finalSystemPrompt += `\n\n${userDBContextBlock}`;
  }

  // Inject Wizard Launch seed (multi-page contract, theme tokens, intents).
  // When present, this turn is the visitor's first generation after completing
  // the System Launcher — same brain as the AIBuilderPanel, seeded with the
  // 4 wizard selections.
  if (wizardSeed) {
    const seedBlock = buildWizardSeedContext(wizardSeed);
    if (seedBlock) {
      finalSystemPrompt += `\n\n${seedBlock}`;
      console.log('[orchestrator] wizard-seed context injected', {
        pages: (wizardSeed.canonical?.pages || []).length,
        capabilities: (wizardSeed.canonical?.capabilities || []).length,
        intents: (wizardSeed.canonical?.intents || []).length,
        hasBindingGuide: !!wizardSeed.bindingGuide,
      });
    }
  }

  const aiMessages = [
    { role: 'system', content: finalSystemPrompt },
    ...processedMessages,
  ];

  // ── 8. Call AI providers (complexity-aware model selection) ─────────────
  const effectiveReasoningEffort = resolveReasoningEffort(
    gatewayOptions?.reasoningEffort,
    effectiveComplexity,
  );
  console.log(`[orchestrator] Prompt complexity: ${effectiveComplexity} (server=${preprocessed.complexity.tier}, score=${preprocessed.complexity.score}, unison=${parsed.unisonContext?.estimatedComplexity ?? 'n/a'}, factors=[${preprocessed.complexity.factors.join(',')}])`);
  const providerRoutingKey = `${userId || 'anonymous'}:${userPromptText}`;
  const providerPlan = buildProviderPlan(
    task,
    hasConfiguredProvider,
    gatewayOptions,
    effectiveComplexity,
    providerRoutingKey,
  );
  console.log(`[orchestrator] provider primary=${providerPlan.primaryProvider || 'unavailable'} models=${providerPlan.gatewayModels.map((model) => model.id).join(',')}`);
  const pageDesignRequest = isPageDesignRequest(rawUserPromptText);
  const enableCatalogTools = BUILDER_EDIT_TASKS.has(task.type) && !pageDesignRequest;
  if (pageDesignRequest) {
    // These requests can include several page bodies even when their wording is short.
    providerPlan.perModelTimeoutMs = Math.max(providerPlan.perModelTimeoutMs, 90_000);
    providerPlan.fallbackReserveMs = 40_000;
  }
  if (enableCatalogTools) {
    finalSystemPrompt += renderCatalogToolDirective();
  }
  const aiMessagesForCall = enableCatalogTools
    ? [{ role: 'system', content: finalSystemPrompt }, ...processedMessages]
    : aiMessages;
  const providerResult = await runProviderLoop({
    aiMessages: aiMessagesForCall,
    providerPlan,
    navPageGen,
    reasoningEffort: effectiveReasoningEffort,
    allowDirectFallbacks: true,
    tools: enableCatalogTools ? CATALOG_CHAT_TOOLS : undefined,
    toolChoice: enableCatalogTools ? 'auto' : undefined,
    signal,
  });

  if (providerResult.earlyError) {
    return new Response(
      JSON.stringify({ error: providerResult.earlyError.error }),
      {
        status: providerResult.earlyError.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          ...(providerResult.earlyError.status === 429 ? { 'Retry-After': '1' } : {}),
        },
      }
    );
  }

  // ── 9. Post-process + review pass + envelope verification + response ─────
  let content = postProcessContent(providerResult.content);

  const requestEnvelope = (parsed as { requestEnvelope?: EnvelopeShape }).requestEnvelope;
  const existingFiles = vfsFiles ? Object.keys(vfsFiles) : [];

  type ReviewOutcome = {
    reviewResult: ReturnType<typeof reviewPatch>;
    files: Record<string, string>;
    targetFile: string | null;
  };

  const runReviewPass = (raw: string): ReviewOutcome | undefined => {
    try {
      const jsonStr = raw.trim().replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      const payload = JSON.parse(jsonStr);
      if (!payload.files || typeof payload.files !== "object") return undefined;

      const reviewResult = reviewPatch({
        files: payload.files,
        existingFiles,
        taskType: task.type,
        goalCategory: memory?.goalCategory,
      });
      console.log(
        `[orchestrator] Review: ${reviewResult.approved ? 'APPROVED' : 'FLAGGED'}, ${reviewResult.warnings.length} warnings, ${reviewResult.removedFiles.length} blocked`,
      );

      // ── Scope enforcement for scoped edits ──────────────────────────
      const scopeResult = checkEditScope({
        patchFiles: reviewResult.cleanedFiles,
        targetFile: targetFile ?? payload.targetFile ?? editScope?.componentPath ?? null,
        taskType: task.type,
        existingFiles,
        editScope: editScope ?? null,
        originalFiles: vfsFiles ?? {},
        userPrompt: userPromptText,
      });
      if (!scopeResult.inScope) {
        console.warn(`[orchestrator] SCOPE VIOLATION: ${scopeResult.reason}`);
        reviewResult.warnings.push({ severity: "error", message: `Scope violation: ${scopeResult.reason}` });
        reviewResult.requiresApproval = true;
      }
      if (scopeResult.blockAutoApply) {
        reviewResult.requiresApproval = true;
      }
      for (const advisory of scopeResult.advisories ?? []) {
        reviewResult.warnings.push({ severity: "info", message: advisory });
      }

      return {
        reviewResult,
        files: reviewResult.cleanedFiles as Record<string, string>,
        targetFile: payload.targetFile ?? null,
      };
    } catch {
      // Not JSON multi-file output — skip review
      return undefined;
    }
  };

  let repairAttempted = false;
  let repairAccepted = false;
  let outcome = runReviewPass(content);

  // A syntactically valid `{ "files": {} }` response (or a response whose
  // files were all removed by review) still violates the WizardSeed contract.
  // Treat it exactly like non-JSON/raw output so the same provider turn gets
  // the existing exact-path contract repair instead of returning an empty
  // payload that the launcher can only diagnose as an omitted page.
  if (
    task.type === 'wizard_seed_generation' &&
    outcome &&
    Object.keys(outcome.files).length === 0
  ) {
    console.warn('[orchestrator] wizard output contained no approved files — running contract repair');
    outcome = undefined;
  }

  // A provider can occasionally follow the visual brief but ignore the
  // WizardSeed transport contract and emit one raw TSX/HTML document. The
  // generic envelope repair below only runs after JSON parsing succeeds, so
  // repair this specific contract miss before verification.
  if (task.type === 'wizard_seed_generation' && !outcome && content.trim()) {
    repairAttempted = true;
    console.warn('[orchestrator] wizard output was not multi-file JSON — running contract repair');
    try {
      const contractRepairResult = await runProviderLoop({
        aiMessages: [
          ...aiMessagesForCall,
          { role: 'assistant', content },
          {
            role: 'user',
            content: [
              'Your previous response violated the WizardSeed output contract.',
              'Convert it into the complete required multi-page payload now.',
              'Return ONLY raw JSON shaped as {"files":{"/src/pages/Home.tsx":"..."}}.',
              'Include one body-only TSX file for every canonical WizardSeed page.',
              'Do not return markdown, prose, HTML documents, /src/App.tsx, or standalone SiteNavbar/SiteFooter modules.',
            ].join('\n'),
          },
        ],
        providerPlan,
        navPageGen,
        reasoningEffort: effectiveReasoningEffort,
        allowDirectFallbacks: true,
        signal,
      });
      if (!contractRepairResult.earlyError && contractRepairResult.content) {
        const repairedContent = postProcessContent(contractRepairResult.content);
        const repairedOutcome = runReviewPass(repairedContent);
        if (repairedOutcome && Object.keys(repairedOutcome.files).length > 0) {
          content = repairedContent;
          outcome = repairedOutcome;
          repairAccepted = true;
          console.log('[orchestrator] wizard contract repair accepted', {
            files: Object.keys(repairedOutcome.files).length,
          });
        }
      }
    } catch (error) {
      console.warn('[orchestrator] wizard contract repair failed:', error);
    }
  }

  let verification = verifyAgainstEnvelope({
    envelope: requestEnvelope,
    files: outcome?.files ?? {},
    existingFiles,
  });

  // ── Milestone 3: one targeted repair turn keyed to unmet goals ───────────
  if (outcome && verification.checked && !verification.passed) {
    repairAttempted = true;
    const allowedTargets = Array.isArray(requestEnvelope?.scope?.targets)
      ? (requestEnvelope!.scope!.targets as string[]).filter((t) => typeof t === 'string')
      : [];
    console.warn('[orchestrator] envelope verification failed — running targeted repair', {
      unmet: verification.unmetCriteria.length,
      outOfScope: verification.outOfScopeFiles.length,
    });

    try {
      const repairResult = await runProviderLoop({
        aiMessages: [
          ...aiMessagesForCall,
          { role: 'assistant', content: JSON.stringify({ files: outcome.files }) },
          { role: 'user', content: buildRepairInstruction(verification, allowedTargets) },
        ],
        providerPlan,
        navPageGen,
        reasoningEffort: effectiveReasoningEffort,
        allowDirectFallbacks: true,
        signal,
      });

      if (!repairResult.earlyError && repairResult.content) {
        const repairedContent = postProcessContent(repairResult.content);
        const repairedOutcome = runReviewPass(repairedContent);
        if (repairedOutcome) {
          const repairedVerification = verifyAgainstEnvelope({
            envelope: requestEnvelope,
            files: repairedOutcome.files,
            existingFiles,
          });
          // Only accept the repair when it is strictly better.
          const before = verification.unmetCriteria.length + verification.outOfScopeFiles.length;
          const after = repairedVerification.unmetCriteria.length + repairedVerification.outOfScopeFiles.length;
          if (after < before) {
            content = repairedContent;
            outcome = repairedOutcome;
            verification = repairedVerification;
            repairAccepted = true;
            console.log('[orchestrator] targeted repair accepted', { before, after });
          } else {
            console.log('[orchestrator] targeted repair rejected (no improvement)', { before, after });
          }
        }
      }
    } catch (e) {
      console.warn('[orchestrator] targeted repair failed:', e);
    }
  }

  const reviewResult = outcome?.reviewResult;

  if (reviewResult && verification.checked && !verification.passed) {
    if (verification.outOfScopeFiles.length > 0) {
      // Edit policy: extra files are reported, never held for approval.
      reviewResult.warnings.push({
        severity: "warning",
        message: `Also changed: ${verification.outOfScopeFiles.join(', ')}`,
      });
    }
    for (const miss of verification.unmetCriteria.slice(0, 8)) {
      reviewResult.warnings.push({ severity: "warning", message: `Unmet goal: ${miss}` });
    }
    // `must`-priority misses and scope violations can never auto-apply.
    if (verification.blockingMisses.length > 0) {
      reviewResult.requiresApproval = true;
    }
  }

  const applyState: ApplyState | undefined = reviewResult
    ? buildApplyState({
        actionType: reviewResult.removedFiles.length > 0 ? 'multi_patch' : 'patch',
        touchedFiles: Object.keys(reviewResult.cleanedFiles),
        applyStatus: 'proposed',
        requiredApproval: reviewResult.requiresApproval,
        reviewWarnings: reviewResult.warnings.map(w => w.message),
      })
    : undefined;

  if (verification.checked) {
    console.log('[orchestrator] envelope verification', {
      passed: verification.passed,
      summary: verification.summary,
      blocking: verification.blockingMisses.length,
    });
  }

  if (savePattern) saveLearningSession(parsed, content, userId);

  // ── Milestone 4: durable envelope + verdict log (learning / replay) ───────
  const envelopeRunId = await recordEnvelopeRun({
    userId,
    runContext: (parsed as { runContext?: EnvelopeRunContext }).runContext ?? null,
    envelope: requestEnvelope as Record<string, unknown> | undefined,
    verification: {
      checked: verification.checked,
      passed: verification.passed,
      summary: verification.summary,
      unmetCriteria: verification.unmetCriteria,
      outOfScopeFiles: verification.outOfScopeFiles,
      blockingMisses: verification.blockingMisses,
    },
    repairAttempted,
    repairAccepted,
    touchedFiles: reviewResult ? Object.keys(reviewResult.cleanedFiles) : Object.keys(outcome?.files ?? {}),
    modelUsed: providerResult.modelUsed,
    providerUsed: providerResult.providerUsed,
    mode: mode ?? null,
  });

  const responseBody = buildResponseBody({
    content: reviewResult ? JSON.stringify({ files: reviewResult.cleanedFiles }) : content,
    reasoning: providerResult.reasoning,
    generatedImageUrl: imageResult.generatedImageUrl,
    imagePlacement: imagePlacement ?? undefined,
    debugMode: _debugMode,
    mode: mode ?? undefined,
    modelUsed: providerResult.modelUsed,
    providerUsed: providerResult.providerUsed,
    reviewWarnings: reviewResult?.warnings,
    requiresApproval: reviewResult?.requiresApproval,
    removedFiles: reviewResult?.removedFiles,
    reviewSummary: reviewResult?.reviewSummary,
    applyState: applyState as Record<string, unknown> | undefined,
    toolCalls: providerResult.toolCalls as unknown[] | undefined,
    envelopeVerification: verification.checked
      ? {
          passed: verification.passed,
          summary: verification.summary,
          unmetCriteria: verification.unmetCriteria,
          outOfScopeFiles: verification.outOfScopeFiles,
          blockingMisses: verification.blockingMisses,
        }
      : undefined,
  });

  if (envelopeRunId) {
    (responseBody as Record<string, unknown>).envelopeRunId = envelopeRunId;
  }

  return new Response(
    JSON.stringify(responseBody),
    {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...(providerResult.providerUsed ? { 'X-Unison-AI-Provider': providerResult.providerUsed } : {}),
      },
    },
  );
}

// ── User Design Override Detection ──────────────────────────────────────────

const DESIGN_OVERRIDE_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\b(earthy|warm|cool|pastel|neon|muted|soft|vibrant|dark|light|bright)\s*(tone|color|palette|scheme|theme)/i, category: 'palette' },
  { pattern: /\b(change|make|use|switch|set)\s+(the\s+)?(color|colours|palette|scheme|theme)\s+(to|as|like)/i, category: 'palette' },
  { pattern: /\b(serif|sans.?serif|monospace|handwritten|script)\s*(font|typography)/i, category: 'typography' },
  { pattern: /\b(change|make|use|switch|set)\s+(the\s+)?(font|typography|typeface)/i, category: 'typography' },
  { pattern: /\b(minimalist|brutalist|glassmorphism|neumorphism|retro|vintage|modern|elegant|playful)/i, category: 'style' },
  { pattern: /#[0-9a-f]{3,8}\b/i, category: 'palette' },
  { pattern: /\brgb[a]?\s*\(/i, category: 'palette' },
  { pattern: /\bhsl[a]?\s*\(/i, category: 'palette' },
];

function detectUserDesignOverride(userPrompt: string, variation: TemplateVariation): string {
  const matches = DESIGN_OVERRIDE_PATTERNS.filter(p => p.pattern.test(userPrompt));
  if (matches.length === 0) return '';

  const categories = [...new Set(matches.map(m => m.category))];
  const overrideBlock = `

## ⚡ USER DESIGN OVERRIDE DETECTED
The user's request explicitly asks for design changes. **Their request takes absolute priority** over the default "${variation.colorScheme.name}" palette above.
Override categories: ${categories.join(', ')}

**Rules for this override:**
${categories.includes('palette') ? '- REPLACE the default color palette with colors that match the user\'s description.\n' : ''}${categories.includes('typography') ? '- REPLACE the default fonts with typography that matches the user\'s description.\n' : ''}${categories.includes('style') ? '- ADAPT the visual style (effects, layout density, decorative elements) to match the user\'s description.\n' : ''}- Keep the industry context (${variation.industry.name}) — do NOT change the subject matter, copy, or business logic.
- Update the brandKit in your response to reflect the new design tokens.
`;
  console.log(`[orchestrator] Design override detected: ${categories.join(', ')}`);
  return overrideBlock;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fetches recent AI sessions and draft metadata for a user to enrich prompts.
 */
async function fetchUserContext(userId: string): Promise<UserDBContext> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const [sessionsResult, draftsResult] = await Promise.all([
    supabase
      .from('ai_learning_sessions')
      .select('session_type, user_prompt, technologies_used')
      .eq('user_id', userId)
      .eq('was_successful', true)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('builder_drafts')
      .select('template_id, metadata, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(3),
  ]);

  return {
    recentSessions: (sessionsResult.data ?? []) as UserDBContext['recentSessions'],
    recentDraftsMeta: (draftsResult.data ?? []) as UserDBContext['recentDraftsMeta'],
  };
}

async function fetchLearnedPatterns(): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: patterns } = await supabase
      .from('ai_code_patterns')
      .select('*')
      .order('usage_count', { ascending: false })
      .order('success_rate', { ascending: false })
      .limit(12);

    if (patterns && patterns.length > 0) {
      return (patterns as CodePattern[]).map((p) => `
📐 **${p.pattern_type.toUpperCase()}** — ${p.description || 'N/A'}
Tags: ${(p.tags || []).join(', ')} | Used ${p.usage_count}× | ${p.success_rate}% success
\`\`\`tsx
${p.code_snippet.substring(0, 600)}${p.code_snippet.length > 600 ? '...' : ''}
\`\`\`
`).join('\n');
    }
  } catch (e) {
    console.warn('[orchestrator] Failed to fetch patterns:', e);
  }
  return 'No learned patterns yet.';
}

function saveLearningSession(parsed: AIRequest, content: string, userId?: string): void {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const originalUserPrompt = extractTextContent(parsed.messages[parsed.messages.length - 1]?.content);
    if (originalUserPrompt) {
      supabase.from('ai_learning_sessions').insert({
        session_type: parsed.mode === 'code' ? 'code_generation' : parsed.mode === 'design' ? 'design_review' : 'code_review',
        user_prompt: originalUserPrompt.substring(0, 500),
        ai_response: content.substring(0, 500),
        was_successful: true,
        technologies_used: ['React', 'TypeScript', 'Tailwind CSS'],
        user_id: userId ?? null,
      }).then(() => console.log('Learning session saved'));
    }
  } catch {
    // Fire-and-forget
  }
}

async function runNavResearch(
  systemType: string,
  navPageName?: string,
  navLabel?: string,
): Promise<string> {
  try {
    const profile = getIndustryProfile(systemType);
    const pattern = matchPagePattern(profile, navPageName ?? '', navLabel ?? '');
    const staticCtx = buildIndustryPageContext(profile, pattern);
    const queries = getResearchQueries(pattern);
    const liveResults = await Promise.allSettled(
      queries.map(q => performPromptResearch(q))
    );
    const liveSnippets = liveResults
      .filter((r): r is PromiseFulfilledResult<ResearchResult> => r.status === 'fulfilled')
      .flatMap(r => r.value.snippets.slice(0, 3));
    const liveCtx = liveSnippets.length > 0
      ? `\n\n📡 LIVE WEB RESEARCH (industry page patterns):\n${liveSnippets.map(s => `  • ${s}`).join('\n')}`
      : '';
    return staticCtx + liveCtx;
  } catch (e) {
    console.warn('[orchestrator] Nav research failed:', e);
    return '';
  }
}

async function runThemeEditLane(parsed: AIRequest, task: ClassifiedTask, corsHeaders: Record<string, string>, signal?: AbortSignal): Promise<Response> {
  const context = extractTextContent(parsed.messages[parsed.messages.length - 1]?.content);
  const providerPlan = buildProviderPlan(task, true, { ...parsed.gatewayOptions, maxTokens: 2500, timeoutMs: 45000 }, 'simple', context);
  const result = await runProviderLoop({ providerPlan, navPageGen: false, reasoningEffort: 'none', signal, aiMessages: [
    { role: 'system', content: 'You restyle an existing site without changing content or composition. Return ONLY JSON: {"version":"1.0","snapshotId":"exact input snapshotId","revisionId":"exact input revisionId or null","presetId":"optional preset ID","set":{},"reset":[]}. Do not include files, code, layout, text, media or backend changes. Use presetId only for an explicitly requested preset switch (modern, editorial, futuristic, minimalist, bold, organic); that clears old overrides. Otherwise omit it. set maps editable token names from the supplied contract.tokenNames to values; reset lists token names. Palette values are HSL channels such as "220 50% 12%", never hex or hsl(). Typography weights are 100..900 in steps of 100; size values use px/rem/em; durations use ms/s (0..2000ms); use no CSS declarations, URLs, selectors, expressions or arbitrary token names. Preserve contrast when changing backgrounds or accents by also setting the corresponding foreground token. Base incremental changes on effectiveValues. Preserve snapshotId and revisionId exactly.' },
    { role: 'user', content: context },
  ] });
  return new Response(JSON.stringify(result.earlyError ? { error: result.earlyError.error } : { content: result.content }), { status: result.earlyError ? 502 : 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
