// supabase/functions/ai-code-assistant/taskClassifier.ts
// Classifies incoming requests into task types for routing and optimization.

export type AssistantTaskType =
  | "theme_edit"
  | "wizard_seed_generation"
  | "wizard_canonical_enrichment"
  | "wizard_interaction_enrichment"
  | "wizard_content_enrichment"
  | "wizard_composition"
  | "site_discovery"
  | "site_page_author"
  | "site_page_repair"
  | "builder_source_edit"
  | "nav_page_generation"
  | "template_json_generation"
  | "template_html_generation"
  | "template_react_edit"
  | "surgical_edit"
  | "behavioral_edit"
  | "multi_file_edit"
  | "single_file_edit"
  | "debug_fix"
  | "general_code_assist"
  | "launch_desk";

export interface ClassifiedTask {
  type: AssistantTaskType;
  /** True for low-context tasks that skip learned patterns and user history. */
  fastPath: boolean;
  /** Whether to inject session memory context */
  shouldUseMemory: boolean;
  /** Whether to compact VFS / conversation context */
  shouldUseCompactContext: boolean;
  /** Whether to prefer JSON output format */
  prefersJsonOutput: boolean;
  /** Whether to skip web research */
  skipResearch: boolean;
  /** Whether to skip thinking tags */
  skipThinking: boolean;
  /** Semantic edit class derived from the authoritative BuilderRequestEnvelope. */
  editClassification?: BuilderEditClassification | null;
}

export type BuilderEditClassification =
  | 'content_relocation'
  | 'section_structure'
  | 'page_and_route'
  | 'copy_edit'
  | 'visual_edit'
  | 'asset_edit'
  | 'resource_edit'
  | 'binding_edit'
  | 'behavior_edit'
  | 'compound_edit'
  | 'general_edit';

export function classifyBuilderEditTask(envelope: unknown): BuilderEditClassification | null {
  if (!envelope || typeof envelope !== 'object') return null;
  const value = envelope as { editorOperations?: unknown; scope?: { relation?: unknown }; complexity?: unknown };
  const operations = new Set(Array.isArray(value.editorOperations)
    ? value.editorOperations.filter((item): item is string => typeof item === 'string')
    : []);
  if (operations.size === 0) return null;

  if (value.scope?.relation === 'source_destination' || operations.has('copy.move')) return 'content_relocation';
  if (operations.has('page.create') || operations.has('page.rename') || operations.has('page.remove')
    || operations.has('route.bind') || operations.has('navigation.update')) return 'page_and_route';
  if (operations.has('section.create') || operations.has('section.remove')
    || operations.has('section.move') || operations.has('section.reorder')) return 'section_structure';
  if (operations.has('resource.update')) return 'resource_edit';
  if (operations.has('binding.update') || operations.has('intent.bind')) return 'binding_edit';
  if (operations.has('behavior.update')) return 'behavior_edit';
  if (operations.has('asset.replace')) return 'asset_edit';
  if (operations.has('style.update') || operations.has('theme.update')) return 'visual_edit';
  if (operations.has('copy.rewrite') || operations.has('copy.reorder')) return 'copy_edit';
  if (operations.size > 1 || value.complexity === 'compound' || value.complexity === 'program') return 'compound_edit';
  return 'general_edit';
}

export function builderEditClassificationDirective(classification: BuilderEditClassification): string {
  const directives: Record<BuilderEditClassification, string> = {
    content_relocation: 'Resolve both source and destination before editing. Move the content exactly once; do not duplicate it. Preserve the destination section and all unrelated content.',
    section_structure: 'Plan the requested section creation, removal, or order explicitly. Preserve stable section identities, page chrome, and unrelated sections.',
    page_and_route: 'Treat page creation and navigation updates as one coordinated change. Use canonical route operations; never author or replace compiler-owned /src/App.tsx.',
    copy_edit: 'Edit the requested copy only. Preserve markup, links, bindings, and layout unless the request explicitly includes them.',
    visual_edit: 'Keep the change presentation-owned. Use existing theme tokens and registered variants; do not change copy, routes, or data bindings unless requested.',
    asset_edit: 'Change only the requested asset reference through the existing asset owner. Preserve surrounding markup and durable asset identity.',
    resource_edit: 'Change live data through the registered ResourceRuntime resource, not generated source. Preserve server-authoritative values and ownership.',
    binding_edit: 'Use canonical binding/intent operations. Preserve capability contracts and destinations unless the request explicitly changes them.',
    behavior_edit: 'Trace the existing interaction and implement the requested behavior through its owning controller and capability contract.',
    compound_edit: 'Decompose the request into explicit ordered operations, preserve dependencies between them, and validate the complete result before returning it.',
    general_edit: 'Identify the smallest correct owner and target before editing; preserve all unrelated behavior and structure.',
  };
  return `[EDIT TASK CLASS: ${classification}]\n${directives[classification]}`;
}

/**
 * Classify an AI assistant request based on mode flags.
 * This is the extracted version of the inline detection logic from index.ts.
 */
export function classifyTask(opts: {
  mode?: string;
  systemsBuildContext?: unknown;
  currentCode?: string;
  editMode: boolean;
  templateAction?: string;
  navPageGen: boolean;
  surgicalEdit: boolean;
  behavioralEdit: boolean;
  debugMode: boolean;
  vfsFiles?: Record<string, string>;
  launchBrief?: unknown;
  wizardSeed?: unknown;
}): ClassifiedTask {
  const {
    mode,
    systemsBuildContext,
    currentCode,
    editMode,
    templateAction,
    navPageGen,
    surgicalEdit,
    behavioralEdit,
    debugMode,
    vfsFiles,
    launchBrief,
    wizardSeed,
  } = opts;

  // AI Composer (milestone §31): structured candidate file ops, page scope.
  if (mode === 'site-page-author' || mode === 'site-page-repair' || mode === 'builder-source-edit') {
    const type = mode === 'site-page-author' ? 'site_page_author' : mode === 'site-page-repair' ? 'site_page_repair' : 'builder_source_edit';
    return { type, fastPath: true, shouldUseMemory: false, shouldUseCompactContext: false, prefersJsonOutput: true, skipResearch: true, skipThinking: true };
  }
  if (mode === "site-discovery") {
    return {
      type: "site_discovery",
      fastPath: true,
      shouldUseMemory: false,
      shouldUseCompactContext: false,
      prefersJsonOutput: false,
      skipResearch: true,
      skipThinking: true,
    };
  }
  if (mode === 'theme-edit') return { type: 'theme_edit', fastPath: true, shouldUseMemory: false, shouldUseCompactContext: true, prefersJsonOutput: true, skipResearch: true, skipThinking: true };

  // ── Legacy wizard-seed compatibility route. The deterministic Launcher no
  //    longer calls this mode; Stage 4b owns launch page authorship. Keep this
  //    bounded while external-client usage is audited before removal.
  if (mode === "wizard-seed") {
    return {
      type: "wizard_seed_generation",
      fastPath: true,
      shouldUseMemory: false,
      shouldUseCompactContext: true,
      prefersJsonOutput: true,
      skipResearch: true,
      skipThinking: true,
    };
  }

  // ── Wizard Canonical Enrichment ───────────────────────────────────────
  // Rewrite canonical page bodies with visual richness. AI receives the
  // deterministic snapshot and current page sources, proposes enhanced
  // candidate TSX, validates against contracts, then passes to canonical
  // merge and commit pipeline.
  if (mode === "wizard-canonical-enrichment") {
    return {
      type: "wizard_canonical_enrichment",
      fastPath: true,
      shouldUseMemory: false,
      shouldUseCompactContext: true,
      prefersJsonOutput: true,
      skipResearch: true,
      skipThinking: false,
    };
  }

  if (mode === "wizard-interactions") {
    return {
      type: "wizard_interaction_enrichment",
      fastPath: false,
      shouldUseMemory: false,
      shouldUseCompactContext: true,
      prefersJsonOutput: true,
      skipResearch: true,
      skipThinking: true,
    };
  }

  if (mode === 'wizard-composition') {
    return { type: 'wizard_composition', fastPath: true, shouldUseMemory: false,
      shouldUseCompactContext: true, prefersJsonOutput: true, skipResearch: true, skipThinking: true };
  }

  if (mode === "wizard-content") {
    return {
      type: "wizard_content_enrichment",
      fastPath: true,
      shouldUseMemory: false,
      shouldUseCompactContext: true,
      prefersJsonOutput: true,
      skipResearch: true,
      skipThinking: true,
    };
  }

  // Builders may attach `wizardSeed` for continuity on follow-up edits without
  // forcing a full-site regeneration; presence alone does NOT reclassify the
  // task — it is injected as context inside Lane B (see orchestrator).
  void wizardSeed;

  // ── Launch Desk ───────────────────────────────────────────────────────
  if (mode === "launch-desk" || Boolean(launchBrief)) {
    return {
      type: "launch_desk",
      fastPath: false,
      shouldUseMemory: false,
      shouldUseCompactContext: false,
      prefersJsonOutput: true,
      skipResearch: true,
      skipThinking: false,
    };
  }

  // ── Nav page generation ───────────────────────────────────────────────
  if (navPageGen) {
    return {
      type: "nav_page_generation",
      fastPath: true,
      shouldUseMemory: false,
      shouldUseCompactContext: true,
      prefersJsonOutput: true,
      skipResearch: false, // nav pages do targeted industry research
      skipThinking: true,
    };
  }

  // ── Template generation modes ─────────────────────────────────────────
  if (mode === "template-json") {
    return {
      type: "template_json_generation",
      fastPath: false,
      shouldUseMemory: false,
      shouldUseCompactContext: true,
      prefersJsonOutput: true,
      skipResearch: false,
      skipThinking: false,
    };
  }

  if (mode === "template-html") {
    return {
      type: "template_html_generation",
      fastPath: false,
      shouldUseMemory: false,
      shouldUseCompactContext: true,
      prefersJsonOutput: false,
      skipResearch: false,
      skipThinking: false,
    };
  }

  // The Builder intentionally uses template-react for all React projects.
  // Explicit edit modes must take precedence over that transport mode so
  // surgical and behavioral work receives its VFS-focused prompt and review.
  if (surgicalEdit) {
    return { type: "surgical_edit", fastPath: false, shouldUseMemory: true, shouldUseCompactContext: true, prefersJsonOutput: true, skipResearch: true, skipThinking: false };
  }
  if (behavioralEdit) {
    return { type: "behavioral_edit", fastPath: false, shouldUseMemory: true, shouldUseCompactContext: true, prefersJsonOutput: true, skipResearch: true, skipThinking: false };
  }

  if (mode === "template-react") {
    return {
      type: "template_react_edit",
      fastPath: false,
      shouldUseMemory: true,
      shouldUseCompactContext: true,
      prefersJsonOutput: true,
      skipResearch: false,
      skipThinking: false,
    };
  }

  // ── Surgical edit ─────────────────────────────────────────────────────
  // ── Behavioral edit (functional changes: hooks, state, handlers) ──────
  // ── Debug mode ────────────────────────────────────────────────────────
  if (debugMode) {
    return {
      type: "debug_fix",
      fastPath: false,
      shouldUseMemory: true,
      shouldUseCompactContext: true,
      prefersJsonOutput: true,
      skipResearch: true,
      skipThinking: false,
    };
  }

  // ── Multi-file edit ───────────────────────────────────────────────────
  if (editMode && vfsFiles && Object.keys(vfsFiles).length > 1) {
    return {
      type: "multi_file_edit",
      fastPath: false,
      shouldUseMemory: true,
      shouldUseCompactContext: true,
      prefersJsonOutput: true,
      skipResearch: true,
      skipThinking: false,
    };
  }

  // ── Single file edit ──────────────────────────────────────────────────
  if (editMode) {
    return {
      type: "single_file_edit",
      fastPath: false,
      shouldUseMemory: true,
      shouldUseCompactContext: false,
      prefersJsonOutput: true,
      skipResearch: true,
      skipThinking: false,
    };
  }

  // ── General code assist (default) ─────────────────────────────────────
  return {
    type: "general_code_assist",
    fastPath: false,
    shouldUseMemory: true,
    shouldUseCompactContext: true,
    prefersJsonOutput: false,
    skipResearch: false,
    skipThinking: false,
  };
}
