// AI Composer contract (milestone §31). Byte-mirrored at
// src/contracts/aiComposerContract.ts — edit both together.
import { z } from 'zod';
import { parse } from '@babel/parser';

export const AI_COMPOSER_TASKS = ['site_page_author', 'site_page_repair', 'builder_source_edit', 'source_project_author'] as const;
export type AIComposerTask = (typeof AI_COMPOSER_TASKS)[number];

export const AI_COMPOSER_MODES: Record<AIComposerTask, string> = {
  site_page_author: 'site-page-author',
  site_page_repair: 'site-page-repair',
  builder_source_edit: 'builder-source-edit',
  source_project_author: 'source-project-author',
};

const PROTECTED = [
  /^\/src\/App\.tsx$/,
  /^\/src\/main\.tsx$/,
  /^\/src\/index\.css$/,
  /^\/package\.json$/,
  /^\/\.unison\//,
  /^\/src\/unison\//,
  /^\/src\/integrations\//,
  /^\/.unison-import\//,
];

export function isProtectedComposerPath(path: string): boolean {
  return PROTECTED.some((re) => re.test(path));
}

const STANDARD_COMPOSER_PATH = /^\/(?:src|public)\/[A-Za-z0-9_./$@+()[\]~-]+\.(?:tsx?|jsx?|mjs|cjs|css|scss|json|html?)$/;
const IMPORTED_SOURCE_ROOT = /^\/(?:src|public|app|pages|routes|components|lib|utils|hooks|features|server|client|api|styles|scripts|assets)\//;

export function isImportedSourceComposerPath(path: string): boolean {
  return IMPORTED_SOURCE_ROOT.test(path)
    && /\.(?:tsx?|jsx?|mjs|cjs|css|scss|html?)$/.test(path)
    && !path.split('/').some((segment) => segment.startsWith('.') || segment === 'node_modules');
}

// Source projects (Affinity-written or imported) also own their root build files.
// Root-level entry/app/style modules cover projects without a src/ folder (e.g. converted older sites).
// Any root-level code/config file the project owns (vite/tailwind/eslint configs,
// plugins, entry modules); never lockfiles or dotfiles.
const SOURCE_PROJECT_ROOT_FILE = /^\/(?!\.)(?!(?:package-lock|npm-shrinkwrap)\.json$)[A-Za-z0-9_.$@+-]+\.(?:tsx?|jsx?|mjs|cjs|css|scss|json|html?)$/;
// Source folders also hold data and asset pointer files (e.g. `*.asset.json`).
const SOURCE_PROJECT_FOLDER_DATA = /\.json$/;

/** Writable path inside a source project: its own source folders, data/asset pointers and root build files, never records or dot-folders. */
export function isSourceProjectComposerPath(path: string): boolean {
  if (isImportedSourceComposerPath(path) || SOURCE_PROJECT_ROOT_FILE.test(path)) return true;
  return IMPORTED_SOURCE_ROOT.test(path)
    && SOURCE_PROJECT_FOLDER_DATA.test(path)
    && !path.split('/').some((segment) => segment.startsWith('.') || segment === 'node_modules');
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
  importedSource = false,
  sourceProject = false,
): string[] {
  const violations: string[] = [];
  for (const op of ops) {
    if (task === 'source_project_author' || sourceProject) {
      if (!isSourceProjectComposerPath(op.path)) violations.push(`${op.path}: outside the project's own source folders`);
    } else if (isProtectedComposerPath(op.path) && !(importedSource && isImportedSourceComposerPath(op.path))) {
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
  const violations = composerScopeViolations(req.task, req.page.filePath, response.fileOps, req.importedSource, req.sourceProject);
  if (req.task === 'source_project_author') return violations.concat(sourceProjectAuthorViolations(req, response));
  if (req.importedSource && !req.sourceProject) {
    if (req.task !== 'builder_source_edit') violations.push('Imported source repairs must use builder_source_edit');
    if ((response.routeOps ?? []).length > 0) violations.push('Imported source repairs cannot change routes');
    const targets = new Set(req.sourceTargets ?? []);
    for (const op of response.fileOps) {
      if (!isImportedSourceComposerPath(op.path) || !targets.has(op.path)) {
        violations.push(`${op.path}: outside the imported source repair targets`);
      } else if (op.type !== 'replace' || typeof req.files[op.path] !== 'string') {
        violations.push(`${op.path}: imported source repair may only replace an existing source file`);
      }
    }
  }
  for (const op of response.fileOps) {
    if (op.type === 'delete' || !/\.[jt]sx?$/.test(op.path)) continue;
    try {
      const prior = bindingOwnershipIssues(req.files[op.path] ?? '');
      const next = bindingOwnershipIssues(op.content);
      for (const [issue, count] of next) {
        if (count > (prior.get(issue) ?? 0)) violations.push(`${op.path}: ${issue}`);
      }
    } catch { /* Source parsing is enforced by the candidate/import gates. */ }
  }
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
  for (const op of response.fileOps) {
    if (op.type === 'delete' || !/\.[jt]sx?$/.test(op.path)) continue;
    let imports: Map<string, number>;
    try { imports = moduleImportCounts(op.content); } catch {
      violations.push(`${op.path}: imports cannot be verified because source is not parseable`);
      continue;
    }
    let prior = new Map<string, number>();
    try { prior = moduleImportCounts(req.files[op.path] ?? ''); } catch { /* No unverifiable grandfathering. */ }
    for (const [specifier, count] of imports) {
      if (count <= (prior.get(specifier) ?? 0)) continue;
      const root = importedPackageRoot(specifier);
      if (root === '<computed-module>' || specifier.startsWith('//') || /^[A-Za-z][\w+.-]*:/.test(specifier)) {
        violations.push(`${op.path}: ${specifier}: computed or protocol imports are not approved because they cannot be resolved as site npm dependencies`);
      }
    }
  }
  const sameRouteOp = (a: z.infer<typeof aiComposerRouteOpSchema>, b: z.infer<typeof aiComposerRouteOpSchema>) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every(key => (a as Record<string, unknown>)[key] === (b as Record<string, unknown>)[key]);
  };
  const routeKeys = new Set<string>();
  // Explicit additions are plans for App Builder, not permission to rewrite
  // existing pages. The facade validates route collisions before generation.
  const createsPages = /\b(create|add|make|build|generate|scaffold)\b[^.\n]{0,80}\bpages?\b/i.test(req.instruction ?? '');
  for (const op of response.routeOps ?? []) {
    if (!(req.approvedRouteOps ?? []).some(approved => sameRouteOp(op, approved))
      && !(createsPages && op.type === 'add_page')) {
      violations.push(`${op.type}:${op.pageId}: route operation is not approved for this request`);
    }
    const key = `${op.type}:${op.pageId}`;
    if (routeKeys.has(key)) violations.push(`${key}: duplicate route operation`);
    routeKeys.add(key);
  }
  if (!targets.size) violations.push('Builder source edits require explicit source targets');
  const seen = new Set<string>();
  for (const op of response.fileOps) {
    const newPage = createsPages && op.type === 'create'
      && /^\/src\/pages\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.tsx?$/.test(op.path)
      && (response.routeOps ?? []).some(op => op.type === 'add_page');
    // Source projects own their structure: new modules (pages, components) are part of an edit.
    const newSourceModule = req.sourceProject === true && op.type === 'create' && isSourceProjectComposerPath(op.path);
    if (!targets.has(op.path) && !newPage && !newSourceModule) violations.push(`${op.path}: outside this request's source targets`);
    if (seen.has(op.path)) violations.push(`${op.path}: duplicate file operation`);
    seen.add(op.path);
    const exists = Object.prototype.hasOwnProperty.call(req.files, op.path);
    if (op.type === 'create' && exists) violations.push(`${op.path}: create cannot overwrite supplied source`);
    if (op.type !== 'create' && !exists) violations.push(`${op.path}: existing source must be supplied before editing or deleting`);
  }
  return violations;
}
/**
 * Whole-project authorship. Without targets every op creates a new file; with
 * targets the turn writes exactly those files (create or replace) plus new
 * modules. Only declarative page announcements (add_page) are accepted.
 */
function sourceProjectAuthorViolations(req: AIComposerRequest, response: AIComposerResponse): string[] {
  const violations: string[] = [];
  const targets = new Set(req.sourceTargets ?? []);
  const seen = new Set<string>();
  for (const op of response.fileOps) {
    if (seen.has(op.path)) violations.push(`${op.path}: duplicate file operation`);
    seen.add(op.path);
    const exists = Object.prototype.hasOwnProperty.call(req.files, op.path);
    if (op.type === 'delete') violations.push(`${op.path}: whole-project authorship never deletes files`);
    else if (op.type === 'replace' && !(exists && targets.has(op.path))) violations.push(`${op.path}: only listed targets may be replaced`);
    else if (op.type === 'create' && exists) violations.push(`${op.path}: create cannot overwrite supplied source`);
  }
  for (const op of response.routeOps ?? []) {
    if (op.type !== 'add_page') violations.push(`${op.type}:${op.pageId}: only add_page announcements are accepted`);
  }
  return violations;
}
export const AI_AUTHORED_MARKER = '// @unison-ai-authored';
/** Local controls and auth submit forms cannot borrow click/overlay bindings. */
function bindingOwnershipIssues(source: string): Map<string, number> {
  const ast = parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'] });
  const issues = new Map<string, number>();
  const add = (issue: string) => issues.set(issue, (issues.get(issue) ?? 0) + 1);
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXOpeningElement') {
      const attributes = new Map<string, string>();
      for (const attribute of node.attributes ?? []) {
        const value = attribute.value?.type === 'JSXExpressionContainer' ? attribute.value.expression : attribute.value;
        if (attribute.type === 'JSXAttribute' && value?.type === 'StringLiteral') attributes.set(attribute.name.name, value.value);
      }
      const intent = attributes.get('data-ut-intent');
      if (intent === 'ui.toggle') add('local toggles must own component state, not ui.toggle bindings');
      if ((intent === 'auth.login' || intent === 'auth.register')
        && (node.name?.name === 'form' || (node.name?.name === 'button' && attributes.get('type') !== 'button') || (node.name?.name === 'input' && attributes.get('type') === 'submit'))) {
        add('auth submit must use data-intent-form, not an overlay click binding');
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(ast.program);
  return issues;
}
/** Syntax-backed module reads; comments and ordinary strings are not imports. */
function moduleImportCounts(source: string): Map<string, number> {
  const ast = parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'], createImportExpressions: true });
  const counts = new Map<string, number>();
  const add = (node: any) => {
    const value = node?.type === 'StringLiteral' ? node.value
      : node?.type === 'TemplateLiteral' && node.expressions.length === 0 ? node.quasis[0]?.value.cooked
      : '<computed-module>';
    const specifier = typeof value === 'string' ? value : '<computed-module>';
    counts.set(specifier, (counts.get(specifier) ?? 0) + 1);
  };
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration'
      || (node.type === 'ExportNamedDeclaration' && node.source)) add(node.source);
    if (node.type === 'ImportExpression') add(node.source);
    if (node.type === 'CallExpression' && (node.callee?.type === 'Import'
      || (node.callee?.type === 'Identifier' && node.callee.name === 'require'))) add(node.arguments[0]);
    if (node.type === 'TSImportEqualsDeclaration' && node.moduleReference?.type === 'TSExternalModuleReference') add(node.moduleReference.expression);
    if (node.type === 'TSImportType') add(node.argument);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(ast.program);
  return counts;
}

/** Local resolution remains candidate-owned. Protocols/computed loads never match an npm approval. */
function importedPackageRoot(specifier: string): string | null {
  if (specifier.startsWith('//') || /^[A-Za-z][\w+.-]*:/.test(specifier) || specifier === '<computed-module>') return specifier;
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('@/') || specifier.startsWith('~/')) return null;
  return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
}
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

// Framework route conventions use `$param`, `[slug]`, `(group)`, `@slot` and `+page` names.
const COMPOSER_PATH = /^\/[A-Za-z0-9_./$@+()[\]~-]+\.(?:tsx?|jsx?|mjs|cjs|css|scss|json|html?)$/;
const pathSchema = z.string()
  .regex(COMPOSER_PATH)
  .refine((p) => !p.split('/').some((segment) => segment === '.' || segment === '..'));

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
  requestedDependencies: z.array(z.string().min(1).max(214)).max(300).optional(),
  componentDecisions: z.array(z.object({
    family: z.string().max(60).optional(),
    implementationId: z.string().max(120).optional(),
    action: z.enum(['reuse', 'compose', 'invent']),
    reason: z.string().max(400).optional(),
  })).max(24).optional(),
  intentsUsed: z.array(z.string().max(80)).max(40).optional(),
}).strict();
export type AIComposerResponse = z.infer<typeof aiComposerResponseSchema>;

/** Vision references only; durable placement URLs remain in runtimeContext. */
export const aiComposerImageSchema = z.object({
  name: z.string().min(1).max(240),
  data: z.string().max(8_000_000).regex(/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/),
}).strict();

export const AI_COMPOSER_BRIEF_LIMIT = 100_000;
export const AI_COMPOSER_RUNTIME_CONTEXT_LIMIT = 20_000;
/** Largest single source file a request may carry (whole-page modules of big imported sites). */
export const AI_COMPOSER_FILE_LIMIT = 200_000;

export const aiComposerRequestSchema = z.object({
  task: z.enum(AI_COMPOSER_TASKS),
  importedSource: z.boolean().optional(),
  /** The project is a source project (Affinity-written or imported): edits may change any of its own source. */
  sourceProject: z.boolean().optional(),
  page: z.object({ role: z.string().max(60), title: z.string().max(120), route: z.string().max(200), filePath: pathSchema }),
  brief: z.string().max(AI_COMPOSER_BRIEF_LIMIT),
  instruction: z.string().max(4000).optional(),
  files: z.record(z.string(), z.string().max(AI_COMPOSER_FILE_LIMIT)),
  availableRuntimeDependencies: z.array(z.string().min(1).max(214)).max(300).optional(),
  sourceTargets: z.array(pathSchema).min(1).max(80).optional(),
  approvedRouteOps: z.array(aiComposerRouteOpSchema).max(12).optional(),
  approvedIntents: z.array(z.string().min(1).max(80)).max(300).optional(),
  routes: z.array(z.object({ title: z.string().max(120), route: z.string().max(200) })).max(100),
  priorPages: z.array(z.object({ role: z.string().max(60), summary: z.string().max(2000) })).max(20).optional(),
  diagnostics: z.array(z.string().max(1000)).max(30).optional(),
  previousResponse: z.string().max(60000).optional(),
  registryContext: z.string().max(60000).optional(),
  runtimeContext: z.string().max(AI_COMPOSER_RUNTIME_CONTEXT_LIMIT).optional(),
  images: z.array(aiComposerImageSchema).min(1).max(10).optional(),
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
}).superRefine((request, ctx) => {
  const paths = [request.page.filePath, ...(request.sourceTargets ?? [])];
  const allowed = request.sourceProject || request.task === 'source_project_author'
    ? isSourceProjectComposerPath
    : request.importedSource
      ? isImportedSourceComposerPath
      : (path: string) => STANDARD_COMPOSER_PATH.test(path);
  if (request.sourceProject && request.task !== 'builder_source_edit' && request.task !== 'source_project_author') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceProject'], message: 'Source project edits require builder_source_edit.' });
  }
  if (request.importedSource && request.task !== 'builder_source_edit') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['importedSource'], message: 'Imported source repairs require builder_source_edit.' });
  }
  for (const path of paths) {
    if (!allowed(path)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceTargets'], message: `${path}: outside this request's source scope.` });
    }
  }
});
export type AIComposerRequest = z.infer<typeof aiComposerRequestSchema>;

function composerTargetAllowed(request: { task?: unknown; sourceProject?: unknown; importedSource?: unknown }): (path: string) => boolean {
  if (request.sourceProject === true || request.task === 'source_project_author') return isSourceProjectComposerPath;
  if (request.importedSource === true) return isImportedSourceComposerPath;
  return (path: string) => STANDARD_COMPOSER_PATH.test(path);
}

const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : value);
const clipList = (value: unknown, count: number, keep: (item: unknown) => boolean = () => true) =>
  (Array.isArray(value) ? value.filter(keep).slice(0, count) : value);

/**
 * Bounds a composer request to this contract before it is sent (client) or
 * parsed (edge): over-long text is clipped, unwritable or malformed optional
 * targets and oversized supporting files are dropped with a note. The page and
 * the files being edited are never dropped, so a real scope problem still fails
 * validation. Edit policy: optional context never refuses an edit.
 */
export function conformComposerRequest(raw: unknown): { request: unknown; notes: string[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { request: raw, notes: [] };
  const notes: string[] = [];
  const req: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  const page = req.page && typeof req.page === 'object' ? { ...(req.page as Record<string, unknown>) } : null;
  if (page) {
    page.role = clip(page.role, 60);
    page.title = clip(page.title, 120);
    page.route = clip(page.route, 200);
    req.page = page;
  }
  const pagePath = typeof page?.filePath === 'string' ? page.filePath : null;
  const allowed = composerTargetAllowed(req);
  if (Array.isArray(req.sourceTargets)) {
    const kept: string[] = [];
    for (const target of req.sourceTargets) {
      if (typeof target !== 'string' || kept.includes(target)) continue;
      if (target !== pagePath && !(pathSchema.safeParse(target).success && allowed(target))) {
        notes.push(`${target}: not writable in this request; kept as read-only context`);
        continue;
      }
      kept.push(target);
    }
    req.sourceTargets = kept.length ? kept.slice(0, 80) : pagePath ? [pagePath] : kept;
  }
  const targets = new Set<string>([...(pagePath ? [pagePath] : []), ...((req.sourceTargets as string[] | undefined) ?? [])]);
  if (req.files && typeof req.files === 'object' && !Array.isArray(req.files)) {
    const files: Record<string, string> = {};
    for (const [path, content] of Object.entries(req.files as Record<string, unknown>)) {
      if (typeof content !== 'string') continue;
      if (content.length > AI_COMPOSER_FILE_LIMIT && !targets.has(path)) {
        notes.push(`${path}: too large to include; treated as read-only`);
        continue;
      }
      files[path] = content;
    }
    req.files = files;
  }
  req.brief = clip(req.brief, AI_COMPOSER_BRIEF_LIMIT);
  req.instruction = clip(req.instruction, 4000);
  req.previousResponse = clip(req.previousResponse, 60000);
  req.registryContext = clip(req.registryContext, 60000);
  req.runtimeContext = clip(req.runtimeContext, AI_COMPOSER_RUNTIME_CONTEXT_LIMIT);
  if (Array.isArray(req.diagnostics)) req.diagnostics = req.diagnostics.filter((d) => typeof d === 'string').map((d) => (d as string).slice(0, 1000)).slice(0, 30);
  req.availableRuntimeDependencies = clipList(req.availableRuntimeDependencies, 300, (d) => typeof d === 'string' && d.length > 0 && d.length <= 214);
  req.approvedIntents = clipList(req.approvedIntents, 300, (d) => typeof d === 'string' && d.length > 0 && d.length <= 80);
  if (Array.isArray(req.routes)) {
    req.routes = req.routes
      .filter((r) => r && typeof r === 'object' && typeof (r as { title?: unknown }).title === 'string' && typeof (r as { route?: unknown }).route === 'string')
      .map((r) => ({ title: (r as { title: string }).title.slice(0, 120), route: (r as { route: string }).route.slice(0, 200) }))
      .slice(0, 100);
  }
  if (Array.isArray(req.priorPages)) {
    req.priorPages = req.priorPages
      .filter((p) => p && typeof p === 'object')
      .map((p) => ({ role: String((p as { role?: unknown }).role ?? '').slice(0, 60), summary: String((p as { summary?: unknown }).summary ?? '').slice(0, 2000) }))
      .slice(0, 20);
  }
  // Attached images are owner input: unsupported ones still fail validation, only an empty list is dropped.
  if (Array.isArray(req.images) && req.images.length === 0) req.images = undefined;
  if (req.evidence && typeof req.evidence === 'object') {
    const evidence = { ...(req.evidence as Record<string, unknown>) };
    evidence.sourcePaths = clipList(evidence.sourcePaths, 80, (p) => typeof p === 'string' && p.startsWith('/') && p.length <= 240);
    evidence.omittedSourcePaths = clipList(evidence.omittedSourcePaths, 80, (p) => typeof p === 'string' && p.length <= 240);
    evidence.unresolvedImports = Array.isArray(evidence.unresolvedImports)
      ? evidence.unresolvedImports.filter((p) => typeof p === 'string').map((p) => (p as string).slice(0, 500)).slice(0, 80)
      : evidence.unresolvedImports;
    evidence.knowledgeEntryIds = clipList(evidence.knowledgeEntryIds, 40, (p) => typeof p === 'string' && p.length <= 160);
    evidence.availableOperations = clipList(evidence.availableOperations, 30, (p) => typeof p === 'string' && p.length <= 80);
    req.evidence = evidence;
  }
  return { request: req, notes };
}

/** Human-readable schema failure (field path + reason) for the owner and logs. */
export function describeComposerRequestIssues(error: z.ZodError): string {
  return error.issues.slice(0, 6).map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`).join('; ');
}
