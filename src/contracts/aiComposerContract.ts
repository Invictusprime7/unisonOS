// AI Composer contract (milestone §31). Byte-mirrored at
// src/contracts/aiComposerContract.ts — edit both together.
import { z } from 'zod';

export const AI_COMPOSER_TASKS = ['site_page_author', 'site_page_repair', 'builder_source_edit'] as const;
export type AIComposerTask = (typeof AI_COMPOSER_TASKS)[number];

export const AI_COMPOSER_MODES: Record<AIComposerTask, string> = {
  site_page_author: 'site-page-author',
  site_page_repair: 'site-page-repair',
  builder_source_edit: 'builder-source-edit',
};

const PROTECTED = [
  /^\/src\/App\.tsx$/,
  /^\/src\/main\.tsx$/,
  /^\/src\/index\.css$/,
  /^\/package\.json$/,
  /^\/\.unison\//,
  /^\/src\/unison\//,
  /^\/src\/integrations\//,
];

export function isProtectedComposerPath(path: string): boolean {
  return PROTECTED.some((re) => re.test(path));
}

// Design-system write scope (workspace rules: never edit managed Unison source).
// Page authoring may write only its own page file and project-local
// components; canonical /src/components/** sections are read-only vocabulary.
export const PROJECT_COMPONENTS_DIR = '/src/project-components/';

// App Builder authorship (site_page_* tasks) may write only here; the candidate
// validator enforces the same list. Builder edits remain freeform.
export const APP_BUILDER_GENERATION_PREFIXES = [
  '/src/pages/',
  PROJECT_COMPONENTS_DIR,
  '/src/components/generated/',
] as const;

export function composerScopeViolations(
  task: AIComposerTask,
  _pageFilePath: string,
  ops: ReadonlyArray<{ type: string; path: string }>,
): string[] {
  const violations: string[] = [];
  for (const op of ops) {
    if (isProtectedComposerPath(op.path)) {
      violations.push(`${op.path}: canonical runtime file`);
    } else if (
      task !== 'builder_source_edit'
      && !APP_BUILDER_GENERATION_PREFIXES.some((prefix) => op.path.startsWith(prefix))
    ) {
      violations.push(`${op.path}: outside the writable scope (${APP_BUILDER_GENERATION_PREFIXES.join(', ')}); put shared UI under ${PROJECT_COMPONENTS_DIR}`);
    }
  }
  return violations;
}
/** Proposal scope only; not proof of ownership or revision freshness. */
export function composerProposalViolations(req: AIComposerRequest, response: AIComposerResponse): string[] {
  const violations = composerScopeViolations(req.task, req.page.filePath, response.fileOps);
  if (req.task !== 'builder_source_edit') return violations;
  const targets = new Set(req.sourceTargets ?? []);
  const approvedIntents = new Set(req.approvedIntents ?? []);
  for (const intent of response.intentsUsed ?? []) {
    if (!approvedIntents.has(intent)) violations.push(`${intent}: intent is not approved for this request`);
  }
  // Omitting INTENTS must not bypass literal DOM binding checks.
  // Preserve legacy bindings during unrelated edits; reject new occurrences.
  for (const op of response.fileOps) {
    if (op.type === 'delete') continue;
    const prior = literalIntentCounts(req.files[op.path] ?? '');
    for (const [intent, count] of literalIntentCounts(op.content)) {
      if (count > (prior.get(intent) ?? 0) && !approvedIntents.has(intent)) {
        violations.push(`${op.path}: ${intent}: new DOM intent is not approved for this request`);
      }
    }
  }
  const approvedDependencies = new Set(req.approvedDependencies ?? []);
  for (const dependency of response.requestedDependencies ?? []) {
    if (!approvedDependencies.has(dependency)) violations.push(`${dependency}: dependency is not approved for this request`);
  }
  const sameRouteOp = (a: z.infer<typeof aiComposerRouteOpSchema>, b: z.infer<typeof aiComposerRouteOpSchema>) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every(key => (a as Record<string, unknown>)[key] === (b as Record<string, unknown>)[key]);
  };
  const routeKeys = new Set<string>();
  for (const op of response.routeOps ?? []) {
    if (!(req.approvedRouteOps ?? []).some(approved => sameRouteOp(op, approved))) {
      violations.push(`${op.type}:${op.pageId}: route operation is not approved for this request`);
    }
    const key = `${op.type}:${op.pageId}`;
    if (routeKeys.has(key)) violations.push(`${key}: duplicate route operation`);
    routeKeys.add(key);
  }
  if (!targets.size) violations.push('Builder source edits require explicit source targets');
  const seen = new Set<string>();
  for (const op of response.fileOps) {
    if (!targets.has(op.path)) violations.push(`${op.path}: outside this request's source targets`);
    if (seen.has(op.path)) violations.push(`${op.path}: duplicate file operation`);
    seen.add(op.path);
    const exists = Object.prototype.hasOwnProperty.call(req.files, op.path);
    if (op.type === 'create' && exists) violations.push(`${op.path}: create cannot overwrite supplied source`);
    if (op.type !== 'create' && !exists) violations.push(`${op.path}: existing source must be supplied before editing or deleting`);
  }
  return violations;
}
export const AI_AUTHORED_MARKER = '// @unison-ai-authored';
/** Literal bindings only; computed values remain runtime-owned. */
function literalIntentCounts(source: string): Map<string, number> {
  const counts = new Map<string, number>();
  const attribute = /\bdata-ut-intent\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)\s*\})/g;
  for (const match of source.matchAll(attribute)) {
    const intent = match.slice(1).find(value => value !== undefined) ?? '';
    counts.set(intent, (counts.get(intent) ?? 0) + 1);
  }
  return counts;
}

const pathSchema = z.string().regex(/^\/(?:src|public)\/[A-Za-z0-9_\-./]+\.(tsx|ts|jsx|js|css|json)$/).refine((p) => !p.includes('..'));

export const aiComposerFileOpSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create'), path: pathSchema, content: z.string().min(1) }).strict(),
  z.object({ type: z.literal('replace'), path: pathSchema, content: z.string().min(1) }).strict(),
  z.object({ type: z.literal('delete'), path: pathSchema }).strict(),
]);

const pageIdSchema = z.string().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/);
const routeSchema = z.string().max(200).regex(/^\/[A-Za-z0-9/_-]*$/);
const pageTypeSchema = z.enum([
  'landing', 'home', 'about', 'contact', 'shop', 'product', 'checkout', 'cart',
  'thankyou', 'booking', 'gallery', 'blog', 'faq', 'pricing', 'immersive', 'legal', 'custom',
]);

export const aiComposerRouteOpSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add_page'), pageId: pageIdSchema, title: z.string().min(1).max(120),
    route: routeSchema, pageType: pageTypeSchema.optional(), showInNav: z.boolean().optional(),
    navOrder: z.number().int().nonnegative().optional(),
  }).strict(),
  z.object({ type: z.literal('remove_page'), pageId: pageIdSchema }).strict(),
  z.object({
    type: z.literal('rename_page'), pageId: pageIdSchema,
    newTitle: z.string().min(1).max(120).optional(), newRoute: routeSchema.optional(),
  }).strict(),
  z.object({ type: z.literal('set_home'), pageId: pageIdSchema }).strict(),
  z.object({ type: z.literal('toggle_nav'), pageId: pageIdSchema, showInNav: z.boolean() }).strict(),
  z.object({ type: z.literal('reorder'), pageId: pageIdSchema, navOrder: z.number().int().nonnegative() }).strict(),
]).superRefine((op, ctx) => {
  if (op.type === 'rename_page' && op.newTitle === undefined && op.newRoute === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'rename_page requires newTitle or newRoute' });
  }
});

export const aiComposerResponseSchema = z.object({
  summary: z.string().max(2000),
  fileOps: z.array(aiComposerFileOpSchema).min(1).max(48),
  routeOps: z.array(aiComposerRouteOpSchema).max(12).optional(),
  requestedDependencies: z.array(z.string().max(80)).max(8).optional(),
  componentDecisions: z.array(z.object({
    family: z.string().max(60).optional(),
    implementationId: z.string().max(120).optional(),
    action: z.enum(['reuse', 'compose', 'invent']),
    reason: z.string().max(400).optional(),
  })).max(24).optional(),
  intentsUsed: z.array(z.string().max(80)).max(40).optional(),
}).strict();
export type AIComposerResponse = z.infer<typeof aiComposerResponseSchema>;

export const aiComposerRequestSchema = z.object({
  task: z.enum(AI_COMPOSER_TASKS),
  page: z.object({ role: z.string().max(60), title: z.string().max(120), route: z.string().max(200), filePath: pathSchema }),
  brief: z.string().max(12000),
  instruction: z.string().max(4000).optional(),
  files: z.record(z.string(), z.string().max(60000)),
  sourceTargets: z.array(pathSchema).min(1).max(80).optional(),
  approvedRouteOps: z.array(aiComposerRouteOpSchema).max(12).optional(),
  approvedDependencies: z.array(z.string().min(1).max(120)).max(300).optional(),
  approvedIntents: z.array(z.string().min(1).max(80)).max(300).optional(),
  routes: z.array(z.object({ title: z.string().max(120), route: z.string().max(200) })).max(40),
  priorPages: z.array(z.object({ role: z.string().max(60), summary: z.string().max(2000) })).max(20).optional(),
  diagnostics: z.array(z.string().max(1000)).max(30).optional(),
  previousResponse: z.string().max(60000).optional(),
  registryContext: z.string().max(60000).optional(),
  runtimeContext: z.string().max(12000).optional(),
  evidence: z.object({
    protocolVersion: z.literal('1.0'),
    baseRevisionId: z.string().nullable(),
    sourceContextHash: z.string().max(100),
    sourcePaths: z.array(z.string().min(1).max(240).regex(/^\//)).max(80),
    sourceContextComplete: z.boolean(),
    omittedSourcePaths: z.array(z.string().max(240)).max(80),
    unresolvedImports: z.array(z.string().max(500)).max(80),
    registryContextHash: z.string().max(100).nullable(),
    knowledgeContextHash: z.string().max(100),
    knowledgePackageVersion: z.string().max(80),
    knowledgeEntryIds: z.array(z.string().max(160)).max(40),
    availableOperations: z.array(z.string().max(80)).max(30),
  }).optional(),
});
export type AIComposerRequest = z.infer<typeof aiComposerRequestSchema>;
