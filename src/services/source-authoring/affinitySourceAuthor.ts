/**
 * Affinity source authorship — the one way Unison creates a website.
 *
 *   owner prompt → foundation turn → one turn per page → static checks
 *   → preview build check → (targeted repair) → source-project save
 *
 * Affinity writes a complete, standalone React + Vite project. Its bytes are
 * saved unchanged through the canonical writer (`commitMutation`, source
 * project profile), shown by the same source builder that runs imported
 * projects, and edited in place by AI Builder. Industry knowledge and photos
 * are advice in the brief; nothing here gates or rewrites a design.
 */
import { AI_COMPOSER_MODES, conformComposerRequest, type AIComposerRequest, type AIComposerResponse } from '@/contracts/aiComposerContract';
import { decodeComposerResponse, type ComposerInvoke } from '@/services/builder/aiRepairLoop';
import { runBuilderTurn } from '@/services/builderBrainClient';
import { findUnresolvedImports } from '@/services/import/importedSourceAcceptance';
import { applyVendorResult, libraryBriefBlock, vendorLibrarySections } from './unisonLibrary';

export const SOURCE_TURN_TIMEOUT_MS = 150_000;
const MAX_REPAIR_ROUNDS = 2;
const MAX_MODULE_TURNS = 48;
const TIMEOUT_PATTERN = /timed? ?out|timeout|deadline|took too long/i;
const FOUNDATION_DIRECTIVE = 'FOUNDATION TURN: write only /package.json, /index.html, /vite.config.ts, /src/main.tsx, /src/index.css and /src/App.tsx, plus ROUTE_OPS for every page. App.tsx imports the shared header, navigation, footer and layout from /src/components/ files, but do not write those files now: each one, and every page, is written in its own later turn.';
const LEAN_FOUNDATION_DIRECTIVE = 'The previous attempt ran out of time. Write a lean foundation: only /package.json, /index.html, /vite.config.ts, /src/main.tsx, /src/index.css (the @theme tokens and a few base rules) and /src/App.tsx, plus ROUTE_OPS. App.tsx wraps its routes in one /src/components/Layout.tsx that you do not write now.';

/**
 * Finished work per site request, so "Try again" continues from the last
 * completed turn instead of paying for the whole site again. Cleared on success.
 */
const checkpoints = new Map<string, { files: Record<string, string>; pages: AuthoredPage[]; summary: string }>();

/** Clears a saved checkpoint (tests, or when the owner changes the brief). */
export function clearSourceAuthoringCheckpoint(resumeKey?: string): void {
  if (resumeKey === undefined) checkpoints.clear(); else checkpoints.delete(resumeKey);
}
const BARE_IMPORT = /(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\s+from\s+)?["']([^"'./][^"']*)["']|import\(\s*["']([^"'./][^"']*)["']\s*\)/g;

export interface AuthoredPage {
  pageId: string;
  title: string;
  route: string;
}

export interface SourceBuildCheck {
  ok: boolean;
  /** Error messages, each naming its file when known. */
  errors: Array<{ message: string; path?: string }>;
}

export interface AuthorSourceProjectInput {
  /** The owner's confirmed words; always the creative authority. */
  prompt: string;
  projectName: string;
  /** Advisory context (industry knowledge, owner facts, photos). Never a gate. */
  advice?: string;
  photos?: string[];
  signal?: AbortSignal;
  onStatus?: (status: string) => void;
  /** Test seam; defaults to the Affinity backend. */
  invoke?: ComposerInvoke;
  /** Builds the files the way the preview will; returns its errors. */
  buildCheck?: (files: Record<string, string>) => Promise<SourceBuildCheck>;
  /** Optional Unison library advice; defaults to the library catalog. Pass '' to omit. */
  libraryBrief?: string;
  /** Same key on "Try again" resumes from the last finished turn. */
  resumeKey?: string;
}

export interface AuthoredSourceProject {
  /** Root-relative VFS paths (leading slash) → exact bytes Affinity wrote. */
  files: Record<string, string>;
  pages: AuthoredPage[];
  summary: string;
  turns: number;
  repairs: number;
}

export class SourceAuthoringError extends Error {
  constructor(message: string, readonly detail: string[] = [], readonly options: { timedOut?: boolean; resumable?: boolean } = {}) {
    super(message);
    this.name = 'SourceAuthoringError';
  }
}

/** Owner prompt plus a turn directive, within the request's instruction limit. */
function withDirective(prompt: string, directive: string): string {
  return `${prompt.slice(0, Math.max(0, 3990 - directive.length))}\n\n${directive}`.slice(0, 4000);
}

function baseName(path: string): string {
  return path.split('/').pop()!.replace(/\.[^.]+$/, '');
}

function brief(input: AuthorSourceProjectInput, pages: AuthoredPage[], library: string): string {
  return [
    `OWNER PROMPT (creative authority):\n${input.prompt.trim()}`,
    `PROJECT NAME: ${input.projectName}`,
    pages.length ? `SITE PLAN (from the foundation turn):\n${pages.map((page) => `- ${page.title} → ${page.route} (/src/pages/${page.pageId}.tsx)`).join('\n')}` : '',
    input.photos?.length ? `PHOTOS (verified URLs you may use; never invent others):\n${input.photos.join('\n')}` : 'PHOTOS: none supplied. Design without photographs unless the owner gave image URLs.',
    input.advice?.trim() ? `ADVICE (optional; the owner's prompt wins wherever they differ):\n${input.advice.trim()}` : '',
    library,
  ].filter(Boolean).join('\n\n');
}

/** Missing local modules referenced by authored source → the file each should be. */
export function missingModules(files: Record<string, string>): Array<{ path: string; from: string }> {
  const unresolved = findUnresolvedImports({ files, binaryPaths: new Set(), checkPaths: Object.keys(files), aliases: { '@/*': 'src/*' } });
  const out = new Map<string, string>();
  for (const { file, specifier } of unresolved) {
    const dir = file.slice(0, file.lastIndexOf('/'));
    let base: string;
    if (specifier.startsWith('@/')) base = `/src/${specifier.slice(2)}`;
    else if (specifier.startsWith('/')) base = specifier;
    else {
      const stack = dir.split('/');
      for (const seg of specifier.split('/')) {
        if (seg === '.' || seg === '') continue;
        if (seg === '..') stack.pop(); else stack.push(seg);
      }
      base = stack.join('/');
    }
    const path = /\.(?:tsx?|jsx?|css)$/.test(base) ? base : `${base}.tsx`;
    if (!out.has(path)) out.set(path, file);
  }
  return [...out].map(([path, from]) => ({ path, from }));
}

function declaredPackages(files: Record<string, string>): Set<string> | null {
  try {
    const pkg = JSON.parse(files['/package.json'] ?? '') as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
  } catch {
    return null;
  }
}

/** Problems the preview build would hit: unparseable source, missing modules, undeclared packages. */
export async function staticSourceProblems(files: Record<string, string>): Promise<Array<{ path: string; message: string }>> {
  const problems: Array<{ path: string; message: string }> = [];
  const packages = declaredPackages(files);
  if (!packages) problems.push({ path: '/package.json', message: 'package.json is missing or is not valid JSON.' });
  if (!files['/index.html']) problems.push({ path: '/index.html', message: 'index.html is missing.' });
  const ts = (await import('typescript')).default;
  for (const [path, source] of Object.entries(files)) {
    if (!/\.[jt]sx?$/.test(path)) continue;
    const out = ts.transpileModule(source, {
      fileName: path,
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
    });
    const first = out.diagnostics?.[0];
    if (first) problems.push({ path, message: `Syntax error: ${ts.flattenDiagnosticMessageText(first.messageText, '\n')}` });
    if (packages) {
      for (const match of source.matchAll(BARE_IMPORT)) {
        const spec = match[1] ?? match[2];
        if (!spec || spec.startsWith('@/') || /^[a-z]+:/.test(spec)) continue;
        const root = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        if (!packages.has(root)) problems.push({ path, message: `Imports "${root}", which is not listed in package.json.` });
      }
    }
  }
  for (const { path, from } of missingModules(files)) problems.push({ path: from, message: `Imports ${path}, which does not exist.` });
  return problems;
}

function pageFor(path: string, pages: AuthoredPage[]): AuthoredPage {
  const base = path.split('/').pop()!.replace(/\.[^.]+$/, '');
  return pages.find((page) => page.pageId === base)
    ?? { pageId: base, title: base.replace(/([a-z])([A-Z])/g, '$1 $2'), route: base.toLowerCase() === 'home' ? '/' : `/${base.toLowerCase()}` };
}

export async function authorSourceProject(input: AuthorSourceProjectInput): Promise<AuthoredSourceProject> {
  const invoke = input.invoke ?? runBuilderTurn;
  const status = input.onStatus ?? (() => undefined);
  const saved = input.resumeKey ? checkpoints.get(input.resumeKey) : undefined;
  const files: Record<string, string> = { ...(saved?.files ?? {}) };
  let pages: AuthoredPage[] = [...(saved?.pages ?? [])];
  let summary = saved?.summary ?? '';
  const checkpoint = () => {
    if (input.resumeKey) checkpoints.set(input.resumeKey, { files: { ...files }, pages: [...pages], summary });
  };
  let turns = 0;
  let repairs = 0;
  const library = input.libraryBrief ?? await libraryBriefBlock().catch(() => '');
  let unknownSections: string[] = [];

  /**
   * One composer turn. A provider timeout is not retried as-is (the same
   * request would time out again): the retry asks for a smaller unit of work,
   * and whatever it leaves out is written by later turns.
   */
  const turn = async (
    request: AIComposerRequest,
    label: string,
    smaller: (request: AIComposerRequest) => AIComposerRequest,
  ): Promise<AIComposerResponse> => {
    if (input.signal?.aborted) throw new DOMException('Cancelled.', 'AbortError');
    status(label);
    let current = request;
    let lastError = 'Affinity did not return any files.';
    let timedOut = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      turns++;
      const { data, error } = await invoke({
        mode: AI_COMPOSER_MODES[current.task],
        messages: [{ role: 'user', content: JSON.stringify(conformComposerRequest(current).request) }],
        gatewayOptions: { timeoutMs: SOURCE_TURN_TIMEOUT_MS - 10_000, reasoningEffort: 'low' },
      }, { timeoutMs: SOURCE_TURN_TIMEOUT_MS, signal: input.signal, functionName: 'ai-code-assistant' });
      const response = error ? null : decodeComposerResponse(data);
      if (response) return response;
      const code = (error as { status?: number; context?: { status?: number } } | null)?.status
        ?? (error as { context?: { status?: number } } | null)?.context?.status;
      lastError = (error as { message?: string } | null)?.message
        || (data as { error?: string } | null)?.error
        || lastError;
      // Billing, permission and cancellation are final; only transport/format problems retry once.
      if (input.signal?.aborted || code === 401 || code === 402 || code === 403 || code === 429) break;
      if (TIMEOUT_PATTERN.test(lastError) || code === 504 || code === 546) {
        timedOut = true;
        current = smaller(current);
        status(`${label} (in smaller parts)`);
      }
    }
    const resumable = Boolean(input.resumeKey) && Object.keys(files).length > 0;
    if (timedOut) {
      throw new SourceAuthoringError(
        `Affinity ran out of time while ${label.charAt(0).toLowerCase()}${label.slice(1)}.`,
        [lastError.slice(0, 400)],
        { timedOut: true, resumable },
      );
    }
    throw new SourceAuthoringError(lastError, [], { resumable });
  };
  const apply = async (response: AIComposerResponse) => {
    for (const op of response.fileOps) {
      if (op.type === 'delete') continue;
      files[op.path] = op.content;
    }
    // Library sections the source imports are copied in unchanged; nothing else is touched.
    const vendored = await vendorLibrarySections(files);
    unknownSections = vendored.unknown;
    Object.assign(files, applyVendorResult(files, vendored));
    checkpoint();
  };
  const request = (task: Partial<AIComposerRequest> & Pick<AIComposerRequest, 'page'>): AIComposerRequest => ({
    task: 'source_project_author',
    brief: brief(input, pages, library),
    instruction: input.prompt.slice(0, 4000),
    files: { ...files },
    routes: pages.map((page) => ({ title: page.title, route: page.route })),
    ...task,
  });

  // 1. Foundation: build files, router and tokens. Shared chrome and pages
  //    are separate modules, so no single turn has to write the whole site.
  if (!files['/src/App.tsx']) {
    const foundation = await turn(request({
      page: { role: 'project', title: input.projectName.slice(0, 120), route: '/', filePath: '/src/App.tsx' },
      instruction: withDirective(input.prompt, FOUNDATION_DIRECTIVE),
    }), 'Designing the site foundation', (r) => ({ ...r, instruction: withDirective(input.prompt, LEAN_FOUNDATION_DIRECTIVE) }));
    summary = foundation.summary;
    pages = (foundation.routeOps ?? []).flatMap((op) => op.type === 'add_page' ? [{ pageId: op.pageId, title: op.title, route: op.route }] : []);
    await apply(foundation);
    if (!files['/src/App.tsx']) throw new SourceAuthoringError('Affinity did not write the site router (src/App.tsx).');
  } else {
    status('Continuing from what Affinity already wrote');
  }

  // 2. One turn per page and per module the written source references.
  const written = new Set<string>();
  for (let guard = 0; guard < MAX_MODULE_TURNS; guard++) {
    const next = missingModules(files).find((entry) => !written.has(entry.path));
    if (!next) break;
    written.add(next.path);
    const isPage = next.path.startsWith('/src/pages/');
    const owner = isPage ? pageFor(next.path, pages) : next.from.startsWith('/src/pages/') ? pageFor(next.from, pages) : undefined;
    const name = baseName(next.path);
    const pageRef = isPage
      ? { role: owner!.pageId.toLowerCase().slice(0, 60), title: owner!.title, route: owner!.route, filePath: next.path }
      : { role: 'component', title: name.slice(0, 120), route: owner?.route ?? '/', filePath: next.path };
    const directive = isPage
      ? `Write ${next.path} now (imported by ${next.from}).`
      : `Write ${next.path} now. ${next.from} imports it: match the exports and props it uses there.`;
    const folder = `/src/components/${name.charAt(0).toLowerCase()}${name.slice(1)}/`;
    const response = await turn(request({
      page: pageRef,
      sourceTargets: [next.path],
      instruction: withDirective(input.prompt.slice(0, 3200), directive),
    }), isPage ? `Writing the ${owner!.title} page` : `Writing ${next.path.split('/').pop()}`, (r) => ({
      ...r,
      instruction: withDirective(input.prompt.slice(0, 2800), `${directive}\nThe previous attempt ran out of time. Keep ${next.path} short: compose it from 3-6 section components in ${folder} that it imports by relative path, and do not write those now; each is written in its own later turn.`),
    }));
    await apply(response);
  }

  // 3. Static and build checks with targeted repairs.
  for (let round = 0; round <= MAX_REPAIR_ROUNDS; round++) {
    const problems = await staticSourceProblems(files);
    for (const name of unknownSections) {
      const path = Object.keys(files).find((p) => !p.startsWith('/src/unison-ui/') && files[p].includes(name)) ?? '/src/App.tsx';
      problems.push({ path, message: `Imports "${name}" from unison-ui, which is not a Unison library section. Use a listed section or write the component yourself.` });
    }
    if (problems.length === 0 && input.buildCheck) {
      status('Checking the site builds');
      const built = await input.buildCheck({ ...files });
      if (!built.ok) problems.push(...built.errors.map((error) => ({ path: error.path ?? '/src/App.tsx', message: error.message })));
    }
    if (problems.length === 0) {
      if (input.resumeKey) checkpoints.delete(input.resumeKey);
      return { files, pages, summary, turns, repairs };
    }
    if (round === MAX_REPAIR_ROUNDS) {
      throw new SourceAuthoringError('Affinity could not finish a site that builds cleanly.', problems.slice(0, 12).map((p) => `${p.path}: ${p.message}`), { resumable: Boolean(input.resumeKey) });
    }
    const missing = missingModules(files).map((entry) => entry.path);
    const needsManifest = problems.some((p) => /package\.json/.test(p.message) || p.path === '/package.json');
    const targets = [...new Set([...problems.map((p) => p.path), ...missing, ...(needsManifest ? ['/package.json'] : [])])]
      .filter((path) => path.startsWith('/'))
      .slice(0, 12);
    repairs++;
    const response = await turn(request({
      page: { role: 'repair', title: 'Repair', route: '/', filePath: targets.find((path) => /\.[jt]sx?$/.test(path)) ?? '/src/App.tsx' },
      sourceTargets: targets,
      diagnostics: problems.slice(0, 30).map((p) => `${p.path}: ${p.message}`.slice(0, 1000)),
    }), 'Fixing what the build check found', (r) => ({
      ...r,
      sourceTargets: r.sourceTargets?.slice(0, 3),
      diagnostics: r.diagnostics?.filter((d) => r.sourceTargets?.slice(0, 3).some((t) => d.startsWith(`${t}:`))).slice(0, 10),
    }));
    await apply(response);
  }
  return { files, pages, summary, turns, repairs };
}
