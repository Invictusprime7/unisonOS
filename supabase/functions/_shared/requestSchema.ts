// supabase/functions/ai-code-assistant/requestSchema.ts
// Extracted Zod validation schema — preserves the exact request contract.

import { z } from "zod";

const messageContentSchema = z.union([
  // Site-wide composer repairs carry up to 140KB of source plus the previous
  // candidate and registry evidence, which exceeds 200KB once JSON-escaped.
  z.string().min(1).max(400_000),
  z.array(z.unknown()).min(1).max(50),
]);

export const AIRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: messageContentSchema,
      })
    )
    .min(1)
    .max(50),
  mode: z.string().max(30).optional(),
  savePattern: z.boolean().optional(),
  generateImage: z.boolean().optional(),
  imagePlacement: z.string().max(40).optional(),
  currentCode: z.string().max(200_000).optional(),
  editMode: z.boolean().optional(),
  debugMode: z.boolean().optional(),
  templateAction: z.string().max(50).optional(),
  /** Milestone 1: authoritative structured interpretation from builder-request-interpreter */
  requestEnvelope: z.object({
    requestKinds: z.array(z.string().max(60)).max(12).optional(),
    domains: z.array(z.string().max(60)).max(12).optional(),
    scope: z.record(z.string(), z.unknown()).optional(),
    goals: z.array(z.record(z.string(), z.unknown())).max(20).optional(),
    complexity: z.string().max(30).optional(),
    constraints: z.array(z.string().max(400)).max(20).optional(),
    requestedCapabilities: z.array(z.string().max(60)).max(20).optional(),
    requestedBusinessCapabilities: z.array(z.string().max(60)).max(20).optional(),
    businessGoals: z.array(z.string().max(120)).max(24).optional(),
    designTraits: z.array(z.string().max(120)).max(24).optional(),
    experienceFeatures: z.array(z.string().max(120)).max(24).optional(),
    editorOperations: z.array(z.string().max(120)).max(24).optional(),
    ambiguities: z.array(z.string().max(400)).max(20).optional(),

    executionMode: z.string().max(40).optional(),
    confidence: z.number().optional(),
    needsExternalResearch: z.boolean().optional(),
    requiresBackend: z.boolean().optional(),
    summary: z.string().max(2_000).optional(),
    source: z.string().max(30).optional(),
  }).passthrough().optional(),
  unisonContext: z.object({
    route: z.string().max(60),
    primaryIntent: z.string().max(200),
    secondaryIntents: z.array(z.string().max(200)).max(12),
    targetScope: z.string().max(40),
    requestedOutcome: z.string().max(2_000),
    constraints: z.array(z.string().max(400)).max(20),
    entities: z.record(z.string(), z.string().max(300).optional()),
    targetFiles: z.array(z.string().max(300)).max(20),
    targetPageIds: z.array(z.string().max(200)).max(20),
    targetSections: z.array(z.string().max(200)).max(20),
    confidence: z.number().min(0).max(1),
    estimatedComplexity: z.number().min(0).max(100),
    requiresClarification: z.boolean(),
    requiresUserConfirmation: z.boolean(),
    steps: z.array(z.object({
      type: z.string().max(60),
      description: z.string().max(500),
      targets: z.array(z.string().max(300)).max(20),
      dependsOn: z.array(z.string().max(100)).max(20),
      complexity: z.number().min(0).max(10),
    })).max(20),
  }).optional(),
  /** Milestone 4: identity for the durable envelope/verification run log */
  runContext: z.object({
    draftId: z.string().max(64).nullish(),
    projectId: z.string().max(64).nullish(),
    businessId: z.string().max(64).nullish(),
    prompt: z.string().max(8_000).nullish(),
  }).optional(),
  skipResearch: z.boolean().optional(),
  templateAnalysis: z.string().max(20_000).optional(),
  systemType: z.string().max(50).nullish(),
  variationSeed: z.string().max(30).nullish(),
  templateName: z.string().max(100).nullish(),
  aesthetic: z.string().max(80).nullish(),
  source: z.string().max(80).nullish(),
  userDesignProfile: z.object({
    projectCount: z.number().optional(),
    dominantStyle: z.enum(["dark", "light", "colorful", "minimal", "mixed"]).optional(),
    industryHints: z.array(z.string()).optional(),
  }).optional(),
  navPageGen: z.boolean().optional(),
  navPageName: z.string().max(100).nullish(),
  navLabel: z.string().max(120).nullish(),
  systemsBuildContext: z.object({
    version: z.string().optional(),
    launcherPolicy: z.record(z.string(), z.unknown()).optional(),
    identity: z.object({
      industry: z.string().max(80).optional(),
      business_model: z.string().max(80).optional(),
      primary_goal: z.string().max(200).optional(),
      locale: z.string().max(20).optional(),
    }).passthrough().optional(),
    brand: z.object({
      business_name: z.string().max(255).optional(),
      tagline: z.string().max(200).optional(),
      tone: z.string().max(80).optional(),
      palette: z.object({
        primary: z.string().optional(),
        secondary: z.string().optional(),
        accent: z.string().optional(),
        background: z.string().optional(),
        foreground: z.string().optional(),
      }).optional(),
      typography: z.object({ heading: z.string().optional(), body: z.string().optional() }).optional(),
      logo: z.object({ mode: z.string().optional(), text_lockup: z.string().optional() }).optional(),
    }).passthrough().optional(),
    design: z.object({
      layout: z.object({
        hero_style: z.string().max(40).optional(),
        section_spacing: z.string().max(20).optional(),
        max_width: z.string().max(20).optional(),
        navigation_style: z.string().max(20).optional(),
      }).optional(),
      effects: z.object({
        animations: z.boolean().optional(),
        scroll_animations: z.boolean().optional(),
        hover_effects: z.boolean().optional(),
        gradient_backgrounds: z.boolean().optional(),
        glassmorphism: z.boolean().optional(),
        shadows: z.string().max(20).optional(),
      }).optional(),
      images: z.object({
        style: z.string().max(20).optional(),
        aspect_ratio: z.string().max(20).optional(),
        overlay_style: z.string().max(20).optional(),
      }).optional(),
      buttons: z.object({
        style: z.string().max(20).optional(),
        size: z.string().max(20).optional(),
        hover_effect: z.string().max(20).optional(),
      }).optional(),
      sections: z.object({
        include_stats: z.boolean().optional(),
        include_testimonials: z.boolean().optional(),
        include_faq: z.boolean().optional(),
        include_cta_banner: z.boolean().optional(),
        include_newsletter: z.boolean().optional(),
        include_social_proof: z.boolean().optional(),
        use_counter_animations: z.boolean().optional(),
      }).optional(),
      content: z.object({
        density: z.string().max(20).optional(),
        use_icons: z.boolean().optional(),
        writing_style: z.string().max(30).optional(),
      }).optional(),
    }).passthrough().optional(),
    theme_tokens: z.record(z.string(), z.unknown()).optional(),
    intents: z.array(z.object({
      intent: z.string().max(60),
      target: z.object({ kind: z.string().optional(), ref: z.string().optional() }).optional(),
    }).passthrough()).max(40).optional(),
    template_sections: z.array(z.string().max(60)).max(20).optional(),
    template_intents: z.array(z.string().max(60)).max(20).optional(),
  }).passthrough().optional(),
  siteElementsLibraryContext: z.string().max(50_000).optional(),
  /** V4 M8: bounded canonical registry projection shared by both AI layers. */
  registryContext: z.object({}).passthrough().optional(),
  surgicalEdit: z.boolean().optional(),
  behavioralEdit: z.boolean().optional(),
  targetFile: z.string().max(300).optional(),
  componentBehaviorContext: z.string().max(15_000).optional(),
  previewDiagnostics: z.string().max(5_000).optional(),
  previewSnapshot: z.string().max(12_000).optional(),
  recentChangedFiles: z.array(z.string().max(200)).max(20).optional(),
  vfsFiles: z.record(z.string(), z.string().max(100_000)).optional(),
  attachments: z.array(z.unknown()).max(10).optional(),
  gatewayOptions: z.object({
    selectedModelId: z.string().max(80).optional(),
    reasoningEffort: z.enum(["none", "low", "medium", "high"]).optional(),
    timeoutMs: z.number().min(5000).max(135000).optional(),
    autoModelSelection: z.boolean().optional(),
    maxTokens: z.number().min(1000).max(128000).optional(),
  }).optional(),
  launchBrief: z.object({
    productBrief: z.string().max(5000).optional(),
    audience: z.string().max(1000).optional(),
    launchDate: z.string().max(100).optional(),
    constraints: z.string().max(2000).optional(),
    availableAssets: z.string().max(2000).optional(),
  }).optional(),
  /**
   * Structured Wizard-launch seed. When present (typically with `mode === "wizard-seed"`)
   * the classifier routes to Lane B `wizard_seed_generation` so wizard launches share
   * the same intelligence (memory, research, VFS context, transactional patches) as
   * the AIBuilderPanel through the single supported launcher generation route.
   */
  wizardSeed: z.object({
    version: z.string().max(40).optional(),
    source: z.string().max(40).optional(),
    business: z.record(z.string(), z.unknown()).optional(),
    template: z.record(z.string(), z.unknown()).optional(),
    theme: z.record(z.string(), z.unknown()).optional(),
    canonical: z.record(z.string(), z.unknown()).optional(),
    generation: z.record(z.string(), z.unknown()).optional(),
    bindingGuide: z.string().max(50_000).optional(),
  }).passthrough().optional(),
  /**
   * Preview floating-toolbar edit scope. When present, the orchestrator locks
   * file mutations to `componentPath`, refuses edits outside `editableRange`,
   * and preserves every `data-ut-intent` listed in `lockedBindings`.
   */
  editScope: z.object({
    scopeType: z.enum(["element", "block", "section", "page"]).optional(),
    targetId: z.string().max(200).optional(),
    owningSectionId: z.string().max(200).optional(),
    pageId: z.string().max(200).optional(),
    componentPath: z.string().max(300).optional(),
    editableRange: z.object({
      startLine: z.number().int().nonnegative().optional(),
      endLine: z.number().int().nonnegative().optional(),
    }).passthrough().optional(),
    lockedBindings: z.array(z.string().max(120)).max(50).optional(),
    riskLevel: z.enum(["low", "medium", "high"]).optional(),
  }).passthrough().optional(),
});

export type AIRequest = z.infer<typeof AIRequestSchema>;
