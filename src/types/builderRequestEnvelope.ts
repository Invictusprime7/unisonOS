/**
 * BuilderRequestEnvelope — canonical structured interpretation of a user's
 * AI Builder request.
 *
 * This is the authoritative classification contract. Frontend regexes may
 * produce *hints* (see `buildEnvelopeHints`), but they are never the router.
 * The `builder-request-interpreter` edge function returns a full envelope;
 * `normalizeEnvelope` guarantees the shape regardless of model output.
 */

import {
  classifyBuilderRequestTerm,
  normalizeBusinessCapability,
} from '@/platform/core/businessCapabilityVocabulary';
import type { BusinessCapability } from '@/platform/core/capabilityRegistry';

export type BuilderRequestKind =
  | 'create'
  | 'edit'
  | 'debug'
  | 'review'
  | 'explain'
  | 'plan'
  | 'data_binding'
  | 'backend_configuration'
  | 'deployment';

export type BuilderEditorOperation =
  | 'copy.rewrite'
  | 'copy.move'
  | 'copy.reorder'
  | 'section.create'
  | 'section.remove'
  | 'section.move'
  | 'section.reorder'
  | 'page.create'
  | 'page.rename'
  | 'page.remove'
  | 'route.bind'
  | 'navigation.update'
  | 'style.update'
  | 'theme.update'
  | 'asset.replace'
  | 'resource.update'
  | 'binding.update'
  | 'intent.bind'
  | 'behavior.update'
  | 'backend.configure'
  | 'debug.fix';

export const BUILDER_EDITOR_OPERATIONS: readonly BuilderEditorOperation[] = [
  'copy.rewrite', 'copy.move', 'copy.reorder',
  'section.create', 'section.remove', 'section.move', 'section.reorder',
  'page.create', 'page.rename', 'page.remove', 'route.bind', 'navigation.update',
  'style.update', 'theme.update', 'asset.replace', 'resource.update',
  'binding.update', 'intent.bind', 'behavior.update', 'backend.configure', 'debug.fix',
];

export type BuilderScopeRelation = 'single_target' | 'source_destination' | 'multi_target' | 'site_wide';

export type BuilderDomain =
  | 'layout'
  | 'visual_design'
  | 'copy'
  | 'navigation'
  | 'catalog'
  | 'crm'
  | 'booking'
  | 'auth'
  | 'commerce'
  | 'forms'
  | 'automation'
  | 'database'
  | 'runtime'
  | 'content_structure'
  | 'pages'
  | 'assets'
  | 'typography'
  | 'accessibility';

export type BuilderScopeLevel =
  | 'element'
  | 'block'
  | 'section'
  | 'page'
  | 'site'
  | 'backend'
  | 'workspace';

export type BuilderComplexity = 'simple' | 'compound' | 'program';

export type BuilderExecutionMode =
  | 'answer_only'
  | 'direct_patch'
  | 'planned_patch'
  | 'tool_actions'
  | 'mixed';

export interface BuilderGoal {
  id: string;
  description: string;
  priority: 'required' | 'preferred' | 'optional';
}

export interface BuilderRequestEnvelope {
  summary: string;
  requestKinds: BuilderRequestKind[];
  domains: BuilderDomain[];
  scope: {
    level: BuilderScopeLevel;
    targets: string[];
    relation?: BuilderScopeRelation;
    sourceTarget?: string;
    destinationTarget?: string;
  };
  goals: BuilderGoal[];
  constraints: string[];
  assumptions: string[];
  dependencies: string[];
  ambiguities: string[];
  complexity: BuilderComplexity;
  executionMode: BuilderExecutionMode;
  needsExternalResearch: boolean;
  needsApproval: boolean;
  confidence: number;
  /** Outcome language ("easier to book", "more leads"). Never provisioned. */
  businessGoals: string[];
  /** Presentation language ("premium", "modern"). Never provisioned. */
  designTraits: string[];
  /** Motion / immersive features ("motion.marquee"). Never provisioned. */
  experienceFeatures: string[];
  /** Deterministic editor operations implied by the request. */
  editorOperations: BuilderEditorOperation[];
  /**
   * The ONLY projection allowed to reach backend capability verification.
   * Every value is a canonical business capability id.
   */
  requestedBusinessCapabilities: BusinessCapability[];
  /**
   * @deprecated Legacy mirror of `requestedBusinessCapabilities`, kept for one
   * migration window. It never carries design/goal/experience language.
   */
  requestedCapabilities: string[];
  /** How this envelope was produced. */
  source: 'model' | 'heuristic' | 'hybrid';
}

const REQUEST_KINDS: BuilderRequestKind[] = [
  'create', 'edit', 'debug', 'review', 'explain', 'plan',
  'data_binding', 'backend_configuration', 'deployment',
];

const DOMAINS: BuilderDomain[] = [
  'layout', 'visual_design', 'copy', 'navigation', 'catalog', 'crm', 'booking',
  'auth', 'commerce', 'forms', 'automation', 'database', 'runtime',
  'content_structure', 'pages', 'assets', 'typography', 'accessibility',
];

const SCOPE_LEVELS: BuilderScopeLevel[] = [
  'element', 'block', 'section', 'page', 'site', 'backend', 'workspace',
];
const SCOPE_RELATIONS: BuilderScopeRelation[] = [
  'single_target', 'source_destination', 'multi_target', 'site_wide',
];
const EDITOR_OPERATIONS = BUILDER_EDITOR_OPERATIONS;

const COMPLEXITIES: BuilderComplexity[] = ['simple', 'compound', 'program'];

const EXECUTION_MODES: BuilderExecutionMode[] = [
  'answer_only', 'direct_patch', 'planned_patch', 'tool_actions', 'mixed',
];

function pickAll<T extends string>(value: unknown, allowed: T[]): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const raw of value) {
    const v = String(raw).trim().toLowerCase() as T;
    if (allowed.includes(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

function pickOne<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  const v = String(value ?? '').trim().toLowerCase() as T;
  return allowed.includes(v) ? v : fallback;
}

function strings(value: unknown, max = 24): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Typed request-domain projection.
 *
 * Design traits, business goals and experience features are separate domains
 * from business capabilities. Only `requestedBusinessCapabilities` may reach
 * backend provisioning / capability-pack verification, so a word like
 * "modern" can never be reported as a missing backend pack.
 *
 * Legacy `requestedCapabilities` arrays (one migration window) are split into
 * the typed projections instead of being forwarded verbatim.
 */
function splitRequestDomains(
  o: Record<string, unknown>,
  hints?: Partial<BuilderRequestEnvelope>,
): Pick<
  BuilderRequestEnvelope,
  | 'businessGoals'
  | 'designTraits'
  | 'experienceFeatures'
  | 'editorOperations'
  | 'ambiguities'
  | 'requestedBusinessCapabilities'
  | 'requestedCapabilities'
> {
  const businessGoals = new Set<string>([
    ...strings(o.businessGoals),
    ...(hints?.businessGoals ?? []),
  ]);
  const designTraits = new Set<string>([
    ...strings(o.designTraits),
    ...(hints?.designTraits ?? []),
  ]);
  const experienceFeatures = new Set<string>([
    ...strings(o.experienceFeatures),
    ...(hints?.experienceFeatures ?? []),
  ]);
  const editorOperationInputs = [
    ...strings(o.editorOperations),
    ...(hints?.editorOperations ?? []),
  ];
  const editorOperations = new Set<BuilderEditorOperation>();
  const ambiguities = new Set<string>([
    ...strings(o.ambiguities),
    ...(hints?.ambiguities ?? []),
  ]);
  for (const operation of editorOperationInputs) {
    if (EDITOR_OPERATIONS.includes(operation as BuilderEditorOperation)) {
      editorOperations.add(operation as BuilderEditorOperation);
    } else {
      ambiguities.add(`Unclassified editor operation: ${operation}`);
    }
  }
  const capabilities = new Set<BusinessCapability>();

  const declared = [
    ...strings(o.requestedBusinessCapabilities),
    ...(hints?.requestedBusinessCapabilities ?? []),
  ];
  for (const raw of declared) {
    const capability = normalizeBusinessCapability(raw);
    if (capability) capabilities.add(capability);
  }

  // Legacy/untyped values get classified rather than trusted.
  const legacy = [
    ...strings(o.requestedCapabilities),
    ...(hints?.requestedCapabilities ?? []),
  ];
  for (const raw of legacy) {
    const { domain, value } = classifyBuilderRequestTerm(raw);
    if (domain === 'capability') capabilities.add(value as BusinessCapability);
    else if (domain === 'design') designTraits.add(value);
    else if (domain === 'experience') experienceFeatures.add(value);
    else businessGoals.add(value);
  }

  const requestedBusinessCapabilities = [...capabilities];
  return {
    businessGoals: [...businessGoals].slice(0, 24),
    designTraits: [...designTraits].slice(0, 24),
    experienceFeatures: [...experienceFeatures].slice(0, 24),
    editorOperations: [...editorOperations].slice(0, 24),
    ambiguities: [...ambiguities].slice(0, 24),
    requestedBusinessCapabilities,
    requestedCapabilities: [...requestedBusinessCapabilities],
  };
}

/**
 * Coerce arbitrary (model) output into a valid envelope. Never throws.
 * `hints` fills gaps so a degraded model response still routes correctly.
 */
export function normalizeEnvelope(
  raw: unknown,
  hints?: Partial<BuilderRequestEnvelope>,
): BuilderRequestEnvelope {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const scopeRaw = (o.scope && typeof o.scope === 'object' ? o.scope : {}) as Record<string, unknown>;

  const requestKinds = pickAll(o.requestKinds, REQUEST_KINDS);
  const domains = pickAll(o.domains, DOMAINS);

  const goals: BuilderGoal[] = Array.isArray(o.goals)
    ? (o.goals as unknown[])
        .map((g, i) => {
          const go = (g && typeof g === 'object' ? g : {}) as Record<string, unknown>;
          const description = typeof go.description === 'string' ? go.description.trim() : '';
          if (!description) return null;
          const priority = pickOne(go.priority, ['required', 'preferred', 'optional'] as const, 'required');
          return {
            id: typeof go.id === 'string' && go.id.trim() ? go.id.trim() : `goal-${i + 1}`,
            description,
            priority,
          } satisfies BuilderGoal;
        })
        .filter((g): g is BuilderGoal => Boolean(g))
        .slice(0, 32)
    : [];

  const confidenceRaw = Number(o.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.min(1, Math.max(0, confidenceRaw))
    : (hints?.confidence ?? 0.4);

  return {
    summary:
      (typeof o.summary === 'string' && o.summary.trim()) ||
      hints?.summary ||
      '',
    requestKinds: requestKinds.length ? requestKinds : (hints?.requestKinds ?? ['edit']),
    domains: domains.length ? domains : (hints?.domains ?? []),
    scope: {
      level: pickOne(scopeRaw.level, SCOPE_LEVELS, hints?.scope?.level ?? 'page'),
      targets: strings(scopeRaw.targets).length ? strings(scopeRaw.targets) : (hints?.scope?.targets ?? []),
      relation: pickOne(scopeRaw.relation, SCOPE_RELATIONS, hints?.scope?.relation ?? 'single_target'),
      sourceTarget: typeof scopeRaw.sourceTarget === 'string' ? scopeRaw.sourceTarget : hints?.scope?.sourceTarget,
      destinationTarget: typeof scopeRaw.destinationTarget === 'string' ? scopeRaw.destinationTarget : hints?.scope?.destinationTarget,
    },
    goals: goals.length ? goals : (hints?.goals ?? []),
    constraints: strings(o.constraints).length ? strings(o.constraints) : (hints?.constraints ?? []),
    assumptions: strings(o.assumptions),
    dependencies: strings(o.dependencies),
    ambiguities: strings(o.ambiguities),
    complexity: pickOne(o.complexity, COMPLEXITIES, hints?.complexity ?? 'simple'),
    executionMode: pickOne(o.executionMode, EXECUTION_MODES, hints?.executionMode ?? 'direct_patch'),
    needsExternalResearch:
      typeof o.needsExternalResearch === 'boolean'
        ? o.needsExternalResearch
        : (hints?.needsExternalResearch ?? false),
    needsApproval:
      typeof o.needsApproval === 'boolean' ? o.needsApproval : (hints?.needsApproval ?? false),
    confidence,
    ...splitRequestDomains(o, hints),
    source: 'model',
  };
}

// ============================================================================
// Heuristic hints — advisory only, never authoritative
// ============================================================================

const DOMAIN_HINTS: Array<[BuilderDomain, RegExp]> = [
  ['visual_design', /\b(style|theme|color|colour|palette|font|typography|look|feel|premium|modern|redesign|restyle|aesthetic)\b/i],
  ['layout', /\b(layout|grid|spacing|align|column|stack|responsive|move|reorder|position)\b/i],
  ['copy', /\b(copy|text|wording|headline|heading|paragraph|content)\b/i],
  ['navigation', /\b(nav|navigation|menu|route|routing|link|redirect)\b/i],
  ['catalog', /\b(catalog|catalogue|services?|products?|menu items?|offerings?|pricing table)\b/i],
  ['crm', /\b(crm|leads?|contacts?|pipeline|deals?)\b/i],
  ['booking', /\b(book(ing)?|appointment|schedul|availability|calendar|reserv)\b/i],
  ['auth', /\b(auth|login|log in|sign\s*in|sign\s*up|register|logout|sign\s*out|account)\b/i],
  ['commerce', /\b(cart|checkout|e-?commerce|shop|store|buy|purchase|payment|stripe|subscription)\b/i],
  ['forms', /\b(form|contact form|quote|inquiry|newsletter|waitlist|submit)\b/i],
  ['automation', /\b(automation|automate|workflow|follow[- ]?up|trigger|recipe)\b/i],
  ['database', /\b(database|supabase|table|schema|migration|rls|query|row)\b/i],
  ['runtime', /\b(preview|runtime|sandpack|vfs|compile|build error|crash|render)\b/i],
  ['content_structure', /\b(section|block|move|reorder|order|before|after|above|below)\b/i],
  ['pages', /\b(page|route|footer link|navigation link)\b/i],
  ['assets', /\b(image|photo|picture|asset|logo|icon)\b/i],
  ['typography', /\b(font|typeface|font size|weight|line height|typography)\b/i],
  ['accessibility', /\b(accessibility|accessible|aria|contrast|screen reader|keyboard)\b/i],
];

function inferEditorOperations(text: string): BuilderEditorOperation[] {
  const operations = new Set<BuilderEditorOperation>();
  const has = (pattern: RegExp) => pattern.test(text);
  const moving = has(/\b(move|relocate|transfer|place)\b/i);
  const copy = has(/\b(text|copy|headline|heading|paragraph|sentence|label|caption|description)\b/i);
  const section = has(/\b(section|block|content region)\b/i);
  const page = has(/\b(page|route)\b/i);
  const links = has(/\b(links?|footer|navigation|nav|menu)\b/i);

  if (moving && copy && has(/\b(to|into|above|below|before|after)\b/i)) operations.add('copy.move');
  if (moving && section && has(/\b(above|below|before|after|reorder|order)\b/i)) {
    operations.add('section.reorder');
  } else if (moving && section) operations.add('section.move');
  if (has(/\b(rewrite|reword|change|replace|update|improve)\b/i) && copy) operations.add('copy.rewrite');
  if (has(/\b(add|create|insert|new)\b/i) && section) operations.add('section.create');
  if (has(/\b(remove|delete|hide)\b/i) && section) operations.add('section.remove');

  if (has(/\b(add|create|make|new)\b[\s\S]{0,50}\bpage\b/i)) operations.add('page.create');
  if (page && links && has(/\b(route|link|point|navigate|go to)\b/i)) {
    operations.add('navigation.update');
    operations.add('route.bind');
  }
  if (has(/\b(route|redirect|link)\b/i) && page) operations.add('route.bind');
  if (has(/\b(style|color|colour|font|spacing|align|theme|typography|layout)\b/i)) operations.add('style.update');
  if (has(/\b(theme token|design token|global token)\b/i)) operations.add('theme.update');
  if (has(/\b(image|photo|picture|logo|icon|asset)\b/i) && has(/\b(change|replace|swap|update|move)\b/i)) operations.add('asset.replace');
  if (has(/\b(price|product|service|menu item|catalog|availability)\b/i) && has(/\b(change|update|edit|set|fix)\b/i)) operations.add('resource.update');
  if (has(/\b(bind|wire|connect)\b/i) && has(/\b(button|link|intent|action|workflow|form)\b/i)) operations.add('intent.bind');
  if (has(/\b(make|change|update|add|remove)\b/i) && has(/\b(button|form|cart|checkout|booking|interaction|behavior|behaviour)\b/i)) operations.add('behavior.update');
  if (has(/\b(debug|fix|broken|error|crash|not working)\b/i)) operations.add('debug.fix');

  return [...operations];
}

const KIND_HINTS: Array<[BuilderRequestKind, RegExp]> = [
  ['debug', /\b(fix|broken|error|bug|crash|not working|doesn'?t work|fails?|blank|white screen)\b/i],
  ['explain', /\b(explain|what does|how does|why does|walk me through|tell me about)\b/i],
  ['review', /\b(review|audit|check|assess|evaluate|critique)\b/i],
  ['plan', /\b(plan|roadmap|strategy|approach|milestones?|sequence)\b/i],
  ['create', /\b(create|build|add|generate|make|new)\b/i],
  ['edit', /\b(edit|change|update|modify|adjust|tweak|improve|remove|delete|restyle|redesign)\b/i],
  ['data_binding', /\b(connect|bind|wire|hook up|link)\b.*\b(data|catalog|services?|products?|supabase|real|live|database)\b/i],
  ['backend_configuration', /\b(install|set ?up|enable|configure|provision)\b.*\b(pack|backend|booking|crm|auth|payments?|checkout|system)\b/i],
  ['deployment', /\b(deploy|publish|go live|ship it|custom domain)\b/i],
];

/**
 * Deterministic, advisory hints derived from the raw prompt.
 * These seed the interpreter and act as a safety net when it is unavailable.
 */
export function buildEnvelopeHints(
  prompt: string,
  ctx?: {
    hasExistingTemplate?: boolean;
    hasSelectedElement?: boolean;
    selectedScope?: BuilderScopeLevel;
    selectedScopeExplicit?: boolean;
  },
): Partial<BuilderRequestEnvelope> {
  const text = prompt || '';
  const domains: BuilderDomain[] = [];
  for (const [domain, re] of DOMAIN_HINTS) if (re.test(text)) domains.push(domain);

  const requestKinds: BuilderRequestKind[] = [];
  for (const [kind, re] of KIND_HINTS) if (re.test(text)) requestKinds.push(kind);
  if (!requestKinds.length) requestKinds.push(ctx?.hasExistingTemplate ? 'edit' : 'create');

  const editorOperations = inferEditorOperations(text);
  const sourceDestination = editorOperations.some((operation) =>
    ['copy.move', 'section.move', 'section.reorder'].includes(operation))
    && /\b(to|into|above|below|before|after)\b/i.test(text);
  const multiTarget = !sourceDestination && editorOperations.includes('navigation.update')
    && /\b(these|all|each|both|links)\b/i.test(text);
  const siteWide = /\b(whole site|entire site|every page|site[- ]wide|all pages)\b/i.test(text);
  const relation: BuilderScopeRelation = siteWide ? 'site_wide'
    : sourceDestination ? 'source_destination'
    : multiTarget ? 'multi_target'
    : 'single_target';

  const backendish = requestKinds.includes('backend_configuration')
    || domains.some((domain) => ['database', 'crm', 'booking', 'commerce', 'automation', 'auth'].includes(domain));
  const explicitUiSurface = /\b(page|component|screen|view|section)\b/i.test(text);
  const crossesSectionBoundary = relation === 'source_destination'
    && editorOperations.some((operation) => ['section.move', 'section.reorder'].includes(operation));
  const createsPageAcrossTargets = relation === 'multi_target'
    && (editorOperations.includes('page.create') || domains.includes('pages'));
  const inferredScope: BuilderScopeLevel = siteWide
    ? 'site'
    : createsPageAcrossTargets
      ? 'page'
      : crossesSectionBoundary
        ? 'section'
        : ctx?.selectedScope ?? (ctx?.hasSelectedElement
          ? 'element'
          : explicitUiSurface
            ? (/\bsection\b/i.test(text) ? 'section' : 'page')
            : backendish && !domains.some((domain) => ['layout', 'visual_design', 'copy', 'content_structure'].includes(domain))
              ? 'backend'
              : /\bsection\b/i.test(text) ? 'section' : 'page');
  const level: BuilderScopeLevel = ctx?.selectedScopeExplicit && ctx.selectedScope
    ? ctx.selectedScope
    : inferredScope;

  const complexitySignals = new Set([...domains, ...requestKinds, ...editorOperations]).size;
  const complexity: BuilderComplexity = text.length > 4000 || complexitySignals >= 9
    ? 'program'
    : complexitySignals >= 5 || text.length > 900 ? 'compound' : 'simple';
  const executionMode: BuilderExecutionMode = requestKinds.length === 1
    && (requestKinds[0] === 'explain' || requestKinds[0] === 'review')
    ? 'answer_only'
    : backendish && complexity !== 'simple'
      ? 'mixed'
      : relation !== 'single_target' || complexity !== 'simple' ? 'planned_patch' : 'direct_patch';

  return {
    summary: text.slice(0, 200),
    requestKinds,
    domains,
    scope: { level, targets: [], relation },
    complexity,
    executionMode,
    needsExternalResearch: false,
    needsApproval: backendish,
    confidence: 0.35,
    businessGoals: [],
    designTraits: [],
    experienceFeatures: [],
    editorOperations,
    requestedBusinessCapabilities: [],
    requestedCapabilities: [],
    source: 'heuristic',
  };
}
export function heuristicEnvelope(
  prompt: string,
  ctx?: {
    hasExistingTemplate?: boolean;
    hasSelectedElement?: boolean;
    selectedScope?: BuilderScopeLevel;
    selectedScopeExplicit?: boolean;
  },
): BuilderRequestEnvelope {
  const hints = buildEnvelopeHints(prompt, ctx);
  return { ...normalizeEnvelope({}, hints), source: 'heuristic' };
}

/**
 * A request can require both a visible UI change and approval-gated backend
 * provisioning. The UI portion must still reach the Builder's VFS pipeline;
 * this predicate never authorizes the backend portion.
 */
export function requiresRenderableUiPatch(
  envelope: BuilderRequestEnvelope,
  prompt = '',
): boolean {
  // Wiring an existing control is source work even when the interpreter
  // describes the requested capability as backend scope.
  if (/\b(?:wire|connect|hook\s+up)\b[\s\S]{0,120}\b(?:cart|bag|checkout|buttons?|forms?|booking)\b/i.test(prompt)) {
    return true;
  }
  if (!envelope.requestKinds.some((kind) => kind === 'create' || kind === 'edit')) {
    return false;
  }

  if (['element', 'block', 'section', 'page', 'site'].includes(envelope.scope.level)) {
    return true;
  }

  // A degraded or over-conservative interpreter can classify a checkout or
  // booking page as backend scope. Preserve its backend approval requirement,
  // while still honoring the explicit request for a renderable surface.
  return /\b(create|build|add|generate|make|new|edit|update|modify)\b[\s\S]{0,80}\b(page|component|screen|view|section)\b/i.test(prompt);
}
