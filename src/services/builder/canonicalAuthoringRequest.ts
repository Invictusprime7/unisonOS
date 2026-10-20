import { SANDPACK_DEPENDENCIES } from '@/utils/sandpackDependencies';
import { aiComposerRouteOpSchema, type AIComposerRequest, type AIComposerTask } from '@/contracts/aiComposerContract';
import type { TopologyChange } from '@/services/pageTopologyOrchestrator';
import {
  designKnowledgeManifest,
  selectDesignKnowledge,
} from '@/services/knowledge/designKnowledge';
import { scopeForInstruction, selectSourceKnowledgeWithReport } from './sourceKnowledgeContext';
import {
  boundRegistryContext,
  collectValidImportPaths,
} from '@/services/builderRegistryContext';
import type { WizardAggregatedRegistryContext } from '@/services/launch/wizardRegistryAggregation';
import { INTENT_REGISTRY } from '@/platform/core/intentSurfaceRegistry';

/** Mirrors `aiComposerRequestSchema.brief.max` on the edge function. */
const COMPOSER_BRIEF_LIMIT = 12000;

export const CANONICAL_AUTHORING_OPERATIONS = [
  'create_source',
  'replace_source',
  'delete_source',
  'add_page',
  'remove_page',
  'rename_page',
  'set_home',
  'toggle_nav',
  'reorder_navigation',
] as const;

export function shouldUseCanonicalComposer(input: {
  isReactProject: boolean;
  isLaunchPlanningRequest: boolean;
  isCatalogMutationRequest: boolean;
  hasVfs: boolean;
  isScopedEdit?: boolean;
}): boolean {
  // Scoped UI and behavioral edits need the same validated source protocol;
  // a selected element changes context, not the authoring lane. Image
  // attachments ride the typed `images` field, so they no longer divert the lane.
  return input.isReactProject
    && !input.isLaunchPlanningRequest
    && !input.isCatalogMutationRequest
    && input.hasVfs;
}

export interface CanonicalAuthorshipEvidence {
  protocolVersion: '1.0';
  baseRevisionId: string | null;
  sourceContextHash: string;
  sourcePaths: string[];
  sourceContextComplete: boolean;
  omittedSourcePaths: string[];
  unresolvedImports: string[];
  registryContextHash: string | null;
  knowledgeContextHash: string;
  knowledgePackageVersion: string;
  knowledgeEntryIds: string[];
  availableOperations: string[];
}

export interface CanonicalAuthoringRequestInput {
  task: AIComposerTask;
  page: AIComposerRequest['page'];
  brief: string;
  knowledgeQuery: string;
  baseFiles: Record<string, string>;
  baseRevisionId?: string | null;
  routes: AIComposerRequest['routes'];
  instruction?: string;
  priorPages?: AIComposerRequest['priorPages'];
  diagnostics?: string[];
  previousResponse?: string;
  registryContext?: unknown;
  runtimeContext?: string;
  /** Uploaded links and extracted document text, kept ahead of optional runtime context. */
  attachmentContext?: string;
  images?: AIComposerRequest['images'];
  sourceTargets?: string[];
  approvedRouteOps?: readonly TopologyChange[];
}

/** Resolve a Builder target against accepted topology without authoring it. */
export function resolveCanonicalAuthoringPage(
  files: Record<string, string>,
  targetFile?: string | null,
  owningPageFile?: string | null,
): AIComposerRequest['page'] {
  let pages: Array<{ pageId: string; title?: string; path?: string; filePath?: string; pageType?: string }> = [];
  try {
    const snapshot = JSON.parse(files['/.unison/site-bundle-snapshot.json'] ?? '{}') as {
      pageRegistry?: { pages?: Record<string, { title?: string; path?: string; filePath?: string; pageType?: string }> };
    };
    pages = Object.entries(snapshot.pageRegistry?.pages ?? {}).map(([pageId, page]) => ({ pageId, ...page }));
  } catch {
    pages = [];
  }
  const normalizedTarget = targetFile ? (targetFile.startsWith('/') ? targetFile : `/${targetFile}`) : null;
  const page = pages.find((item) => item.filePath === normalizedTarget)
    ?? pages.find((item) => item.filePath === owningPageFile)
    ?? pages.find((item) => item.path === '/')
    ?? pages[0];
  const filePath = normalizedTarget
    ?? page?.filePath
    ?? Object.keys(files).find((path) => /^\/src\/pages\/[^/]+\.(?:tsx|jsx)$/.test(path))
    ?? '/src/pages/Home.tsx';
  const fallbackTitle = filePath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Page';
  return {
    role: page?.pageType ?? (page?.path === '/' ? 'home' : 'page'),
    title: page?.title ?? fallbackTitle,
    route: page?.path ?? '/',
    filePath,
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

async function hashText(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return `sha256:${Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')}`;
  }
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a:${hash.toString(16).padStart(8, '0')}`;
}

/**
 * Format component recipes and available sections into actionable brief guidance.
 * Tells the AI which components are available for each section type and how to compose them.
 */
function renderComponentRecipes(registry: unknown, pageRole?: string): string {
  if (!registry || typeof registry !== 'object') return '';

  const reg = registry as Record<string, unknown>;
  const sections = Array.isArray(reg.sections) ? reg.sections : [];

  if (!sections.length) return '';

  const lines = ['AVAILABLE COMPONENT RECIPES (use these to compose sections):'];

  const sectionsByType = new Map<string, Array<{ id: string; name: string; description?: string }>>();
  for (const section of sections) {
    if (!section || typeof section !== 'object') continue;
    const s = section as Record<string, unknown>;
    const type = typeof s.sectionType === 'string' ? s.sectionType : null;
    if (!type) continue;

    const variants = Array.isArray(s.generationVariants) ? s.generationVariants : [];
    if (!variants.length) continue;

    const filtered = variants
      .filter((v: unknown) => v && typeof v === 'object' && typeof (v as Record<string, unknown>).id === 'string')
      .map((v: unknown) => {
        const variant = v as Record<string, unknown>;
        return {
          id: variant.id as string,
          name: typeof variant.name === 'string' ? variant.name : (variant.id as string),
          description: typeof variant.description === 'string' ? variant.description : undefined,
        };
      })
      .slice(0, 6); // Limit to top 6 per type

    if (filtered.length) {
      sectionsByType.set(type, filtered);
    }
  }

  if (sectionsByType.size === 0) return '';

  for (const [type, variants] of sectionsByType) {
    const variantList = variants
      .map((v) => `${v.id}${v.description ? ` (${v.description})` : ''}`)
      .join(', ');
    lines.push(`  ${type}: ${variantList}`);
  }

  // Add composition guidance (portable recipes)
  lines.push('');
  lines.push('COMPOSITION PATTERNS (proven section combinations):');
  lines.push('  Homepage: hero → features/services → testimonials → cta → footer');
  lines.push('  Services/Products: hero → features/gallery → testimonials → cta');
  lines.push('  About/Story: hero → content sections → team/faq → cta');
  lines.push('  Contact/Booking: hero → form/contact → faq → cta');
  lines.push('  Landing: hero → unique-content → social-proof → cta');

  return lines.join('\n');
}

/**
 * The one request assembler for Wizard authoring, initial Builder edits and
 * pre-acceptance repair. It selects complete source files and records the
 * exact knowledge/context identities used; it never treats registry metadata
 * as proof that an export exists.
 */
export async function assembleCanonicalAuthoringRequest(
  input: CanonicalAuthoringRequestInput,
): Promise<{ request: AIComposerRequest; evidence: CanonicalAuthorshipEvidence }> {
  const targets = input.sourceTargets?.length ? input.sourceTargets : [input.page.filePath];
  const scope = input.task === 'builder_source_edit' ? scopeForInstruction(input.instruction) : {};
  // Edit policy: the files being edited must always reach the Composer. Edit
  // requests get a larger transport budget, and if optional context (theme,
  // imports, experience facades) still crowds a target out, retry with a
  // targets-only read rather than rejecting the edit.
  let source = selectSourceKnowledgeWithReport(
    input.baseFiles,
    targets,
    input.task === 'builder_source_edit' ? 240_000 : 140_000,
    scope,
  );
  if (input.task === 'builder_source_edit' && !source.completeTargets) {
    const targetsOnly = selectSourceKnowledgeWithReport(input.baseFiles, targets, 240_000, { scoped: true });
    if (targetsOnly.completeTargets || Object.keys(targetsOnly.files).length > Object.keys(source.files).length) {
      source = targetsOnly;
    }
  }
  const rawRegistry = input.registryContext === undefined
    ? input.baseFiles['/.unison/wizard-registry-context.json']
    : input.registryContext;
  let registryValue: unknown = rawRegistry;
  if (typeof registryValue === 'string') {
    try { registryValue = JSON.parse(registryValue); } catch { registryValue = undefined; }
  }
  if (registryValue && typeof registryValue === 'object'
    && Array.isArray((registryValue as { sections?: unknown }).sections)
    && 'generatedAt' in registryValue) {
    registryValue = boundRegistryContext(registryValue as WizardAggregatedRegistryContext, {
      pageRole: input.page.role,
    });
  }
  if (registryValue && typeof registryValue === 'object') {
    registryValue = {
      ...(registryValue as Record<string, unknown>),
      validImportPaths: collectValidImportPaths(input.baseFiles),
    };
  }
  // Edit policy: an oversized registry is trimmed (longest lists halved), never
  // a reason to refuse the request.
  let boundedRegistry = registryValue === undefined ? undefined : stableJson(registryValue);
  for (let pass = 0; boundedRegistry && boundedRegistry.length > 60000 && pass < 12; pass += 1) {
    const record = { ...(registryValue as Record<string, unknown>) };
    const longest = Object.entries(record)
      .filter(([, value]) => Array.isArray(value) && value.length > 1)
      .sort((a, b) => stableJson(b[1]).length - stableJson(a[1]).length)[0];
    if (!longest) { boundedRegistry = undefined; break; }
    const list = longest[1] as unknown[];
    record[longest[0]] = list.slice(0, Math.ceil(list.length / 2));
    registryValue = record;
    boundedRegistry = stableJson(registryValue);
  }
  if (boundedRegistry && boundedRegistry.length > 60000) boundedRegistry = undefined;
  const componentRecipeBrief = registryValue
    ? renderComponentRecipes(registryValue, input.page.role).slice(0, 2400)
    : '';
  const knowledgeBudget = Math.min(
    5000,
    Math.max(0, COMPOSER_BRIEF_LIMIT - input.brief.length - componentRecipeBrief.length - 120),
  );
  const knowledge = selectDesignKnowledge(input.knowledgeQuery, knowledgeBudget);
  const knowledgeManifest = await designKnowledgeManifest(knowledge);
  const evidence: CanonicalAuthorshipEvidence = {
    protocolVersion: '1.0',
    baseRevisionId: input.baseRevisionId ?? null,
    sourceContextHash: await hashText(stableJson(source.files)),
    sourcePaths: Object.keys(source.files).sort(),
    // Edit policy: only the files being edited must be complete; omitted
    // supporting context and unresolved imports are notes (new broken imports
    // are still caught by the candidate import gate).
    sourceContextComplete: source.completeTargets,
    omittedSourcePaths: source.omitted.map((item) => item.path).sort(),
    unresolvedImports: source.unresolvedImports.map((item) => `${item.path}:${item.specifier}`).sort(),
    registryContextHash: boundedRegistry ? await hashText(boundedRegistry) : null,
    knowledgeContextHash: `sha256:${knowledgeManifest.contextHash}`,
    knowledgePackageVersion: knowledgeManifest.packageVersion,
    knowledgeEntryIds: knowledgeManifest.entries.map((item) => `${item.id}@${item.version}`),
    availableOperations: [...CANONICAL_AUTHORING_OPERATIONS],
  };
  const brief = [
    `${input.brief}`,
    componentRecipeBrief ? `\n${componentRecipeBrief}` : '',
    `\nCURATED DESIGN KNOWLEDGE (guidance; project source remains authoritative):\n${knowledge.text}`,
  ].filter(Boolean).join('').slice(0, COMPOSER_BRIEF_LIMIT);
  let routes = input.routes;
  if (routes.length === 0) {
    try {
      const snapshot = JSON.parse(input.baseFiles['/.unison/site-bundle-snapshot.json'] ?? '{}') as {
        pageRegistry?: { pages?: Record<string, { title?: string; path?: string }> };
      };
      routes = Object.values(snapshot.pageRegistry?.pages ?? {})
        .filter((page) => typeof page.title === 'string' && typeof page.path === 'string')
        .map((page) => ({ title: page.title!, route: page.path! }));
    } catch {
      routes = [];
    }
  }

  return {
    request: {
      task: input.task,
      page: input.page,
      brief,
      instruction: input.instruction,
      files: source.files,
      sourceTargets: input.task === 'builder_source_edit'
        ? [...new Set(input.sourceTargets?.length ? input.sourceTargets : [input.page.filePath])]
        : undefined,
      approvedRouteOps: input.task === 'builder_source_edit' ? (input.approvedRouteOps ?? []).map(op => {
        const { createdBy: _createdBy, ...wireOp } = op;
        return aiComposerRouteOpSchema.parse(wireOp);
      }) : undefined,
      approvedDependencies: input.task === 'builder_source_edit' ? existingDependencies(input.baseFiles) : undefined,
      approvedIntents: input.task === 'builder_source_edit' ? permittedBuilderIntents(registryValue) : undefined,
      routes,
      priorPages: input.priorPages,
      diagnostics: input.diagnostics?.map((item) => item.slice(0, 1000)).slice(0, 30),
      previousResponse: input.previousResponse,
      registryContext: boundedRegistry,
      runtimeContext: [
        input.attachmentContext,
        input.runtimeContext,
        source.omitted.length
          ? `Not included for size (read-only context, do not edit): ${source.omitted.map((item) => item.path).slice(0, 20).join(', ')}`
          : '',
      ].filter(Boolean).join('\n').slice(0, 12000) || undefined,
      images: input.images,
      evidence,
    },
    evidence,
  };
}

/** Canonical authoring vocabulary; capability context does not prove live readiness. */
export function permittedBuilderIntents(registry: unknown): string[] {
  // Capability-gated intents stay tied to installed capabilities so an edit
  // never adds a dead button; unapproved ones are repaired, not refused.
  const requirements = registry && typeof registry === 'object' && 'capabilityRequirements' in registry
    ? registry.capabilityRequirements : undefined;
  const capabilities = new Set(Array.isArray(requirements) ? requirements.flatMap(item =>
    item && typeof item === 'object' && typeof item.id === 'string' ? [item.id] : []) : []);
  return Object.values(INTENT_REGISTRY)
    .filter(intent => intent.status !== 'deprecated' && intent.triggerType === 'user-action'
      && (intent.requiredCapabilities ?? []).every(id => capabilities.has(id)))
    .map(intent => intent.name).sort();
}

/** Existing accepted package inventory only; this does not approve new installs. */
function existingDependencies(files: Record<string, string>): string[] {
  // Packages the preview runtime already ships are installed by definition.
  const base = Object.keys(SANDPACK_DEPENDENCIES)
    .filter((name) => !/^(@babel\/|@types\/|typescript$|esbuild|vite|eslint|postcss|autoprefixer|tailwindcss$)/.test(name));
  return [...new Set([...base, ...projectDependencies(files)])].sort();
}

function projectDependencies(files: Record<string, string>): string[] {
  try {
    const pkg: unknown = JSON.parse(files['/package.json'] ?? '{}');
    if (!pkg || typeof pkg !== 'object' || !('dependencies' in pkg)) return [];
    const dependencies = pkg.dependencies;
    if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) return [];
    return Object.entries(dependencies).filter(([, version]) => typeof version === 'string').map(([name]) => name).sort();
  } catch { return []; }
}
