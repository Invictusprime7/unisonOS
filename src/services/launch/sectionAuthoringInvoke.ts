import { AI_COMPOSER_MODES, composerProposalViolations, type AIComposerRequest, type AIComposerResponse } from '@/contracts/aiComposerContract';
import { decodeComposerResponse, type ComposerInvoke } from '@/services/builder/aiRepairLoop';
import { runBuilderTurn } from '@/services/builderBrainClient';
import { parse } from '@babel/parser';

export const SECTION_PROVIDER_TIMEOUT_MS = 60_000;
const SECTION_TRANSPORT_RESERVE_MS = 5_000;
const checkpoints = new Map<string, { files: Record<string, string>; responses: AIComposerResponse[]; lastData: Record<string, unknown>; savedAt: number }>();
const MAX_CHECKPOINT_BYTES = 8_000_000;
export function clearSectionAuthoringCheckpoints(): void { checkpoints.clear(); }

/** Timing only: each batch gets a provider window, and final gates retain one repair window. */
export function sectionPageBudgetMs(sectionOrder: readonly string[]): number {
  return Math.max(150_000, partitionPageSections(sectionOrder).length * (SECTION_PROVIDER_TIMEOUT_MS + SECTION_TRANSPORT_RESERVE_MS) + 60_000);
}

export function sectionSiteBudgetMs(orders: readonly (readonly string[])[], concurrency = 4): number {
  const windows = orders.map(sectionPageBudgetMs);
  let total = (windows[0] ?? 0) + 75_000;
  const workers = Math.max(1, Math.floor(concurrency));
  for (let index = 1; index < windows.length; index += workers) total += Math.max(...windows.slice(index, index + workers));
  return Math.max(280_000, total);
}

function sourceSections(source: string): string[] {
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  const sections: string[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const value = node as Record<string, unknown>;
    const opening = value.openingElement as { name?: { name?: string } } | undefined;
    if (value.type === 'JSXElement' && opening?.name?.name === 'section') {
      if (typeof value.start === 'number' && typeof value.end === 'number') sections.push(source.slice(value.start, value.end));
      return;
    }
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(visit); else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(ast.program);
  return sections;
}

/** Composer has already applied EDIT hunks server-side; fileOps are complete source, never patches. */
function batchSourceViolations(request: AIComposerRequest, response: AIComposerResponse, continuing: boolean): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  if (!response.fileOps.some(op => op.path === request.page.filePath && op.type !== 'delete')) errors.push('Batch must return the complete target page source.');
  for (const op of response.fileOps) {
    if (seen.has(op.path)) errors.push(`${op.path}: duplicate file operation`);
    seen.add(op.path);
    if (op.type === 'delete') continue;
    const prior = request.files[op.path];
    if (op.type === 'create' && prior !== undefined) errors.push(`${op.path}: create cannot overwrite supplied source`);
    if (op.type === 'replace' && prior === undefined) errors.push(`${op.path}: replace requires supplied source`);
    try {
      if (/<<<(?:EDIT|FILE)|<<<<<<< SEARCH|>>>>>>> REPLACE/.test(op.content)) throw new Error('unapplied patch markers');
      if (/\.[jt]sx?$/.test(op.path)) {
        const ast = parse(op.content, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
        if (!ast.program.body.some(node => node.type === 'ExportDefaultDeclaration' || node.type === 'ExportNamedDeclaration')) throw new Error('complete module export missing');
        if (op.path === request.page.filePath && !ast.program.body.some(node => node.type === 'ExportDefaultDeclaration')) throw new Error('default page export missing');
        if (continuing && prior) {
          const next = sourceSections(op.content);
          let cursor = 0;
          for (const section of sourceSections(prior)) {
            const at = next.indexOf(section, cursor);
            if (at < 0) throw new Error('completed section content or order changed');
            cursor = at + 1;
          }
        }
      } else if (/\.json$/.test(op.path)) JSON.parse(op.content);
    } catch (error) { errors.push(`${op.path}: ${error instanceof Error ? error.message : 'invalid complete source'}`); }
  }
  return errors;
}

/** Partition work, not content: repeated families and their original order survive. */
export function partitionPageSections(sectionOrder: readonly string[]): string[][] {
  const body = sectionOrder.filter(family => family !== 'navbar' && family !== 'footer');
  const chunks: string[][] = [];
  for (let index = 0; index < body.length; index += 2) chunks.push(body.slice(index, index + 2));
  return chunks;
}

/** Bounded tab-memory checkpoints are provisional; only the assembled response reaches candidate gates. */
export function createSectionAuthoringInvoke(
  invoke: ComposerInvoke = runBuilderTurn,
  sectionOrder: readonly string[],
  onChunk?: (index: number, total: number) => void,
): ComposerInvoke {
  const chunks = partitionPageSections(sectionOrder);
  return async (input, options = {}) => {
    const content = input.messages[0]?.content;
    if (input.mode !== AI_COMPOSER_MODES.site_page_author || typeof content !== 'string' || chunks.length < 2) {
      return invoke(input, options);
    }
    const request: AIComposerRequest = JSON.parse(content);
    const deadline = Date.now() + (options.timeoutMs ?? 145_000);
    // Exact request/plan/settings identity prevents cross-job, stale-source or hash-collision reuse.
    const key = JSON.stringify([request, chunks, input.gatewayOptions, input.runContext]);
    for (const [id, checkpoint] of checkpoints) if (Date.now() - checkpoint.savedAt > 15 * 60_000) checkpoints.delete(id);
    const saved = checkpoints.get(key);
    const files = { ...(saved?.files ?? request.files) };
    const operations = new Map<string, AIComposerResponse['fileOps'][number]>();
    const responses: AIComposerResponse[] = [...(saved?.responses ?? [])];
    let lastData: Record<string, unknown> = { ...(saved?.lastData ?? {}) };
    for (const [path, source] of Object.entries(files)) if (request.files[path] !== source) operations.set(path, { type: request.files[path] === undefined ? 'create' : 'replace', path, content: source });
    for (let index = responses.length; index < chunks.length; index++) {
      const families = chunks[index];
      if (options.signal?.aborted) return { data: null, error: new DOMException('Cancelled.', 'AbortError') };
      const remaining = deadline - Date.now();
      if (remaining <= 5_000) return { data: null, error: new DOMException('Page section time budget reached.', 'TimeoutError') };
      onChunk?.(index, chunks.length);
      const scope = [
        `BOUNDED PAGE WORK ${index + 1}/${chunks.length}: author ONLY these next body sections, in order: ${families.join(', ')}.`,
        index === 0
          ? 'Create the page shell using the existing shared site nav and footer. Replace baseline body content with only this batch; later batches add the remaining sections.'
          : 'Continue the paid draft in FILES. Preserve every completed section, shared chrome, literal section ID, image, item and binding. Add only this batch immediately before the shared footer. Prefer SEARCH/REPLACE hunks; never re-author completed sections.',
        'FILE create/replace blocks must contain COMPLETE exported modules, not fragments or patch text. EDIT blocks are structured SEARCH/REPLACE instructions applied by Composer before fileOps are returned; never put unapplied patches in fileOps.content.',
        'The full design brief is reference for the completed page, NOT a request to write other batches now. Partial section counts are intentional; final page checks run after all batches. Do not change routes or other pages. Preserve all planned content quantities; do not shorten lists to fit.',
      ].join('\n');
      let instruction = `${scope}\n${request.instruction ?? ''}`;
      let accepted: AIComposerResponse | null = null;
      let violations: string[] = [];
      // One corrective retry per batch: a rejected draft is feedback, not a lost page.
      for (let attempt = 0; attempt < 2 && !accepted; attempt++) {
        const chunkRequest: AIComposerRequest = { ...request, files, brief: request.brief, instruction };
        const configuredTimeout = (input.gatewayOptions as { timeoutMs?: number } | undefined)?.timeoutMs;
        const timeoutMs = Math.min(SECTION_PROVIDER_TIMEOUT_MS, configuredTimeout ?? SECTION_PROVIDER_TIMEOUT_MS, deadline - Date.now() - SECTION_TRANSPORT_RESERVE_MS);
        const result = await invoke({
          ...input,
          messages: [{ role: 'user', content: JSON.stringify(chunkRequest) }],
          gatewayOptions: { ...(input.gatewayOptions as Record<string, unknown> | undefined), timeoutMs },
        }, { ...options, timeoutMs: timeoutMs + 5_000 });
        // Unknown outcomes are not replayed: stop instead of billing another whole page.
        if (result.error || !result.data) return result;
        const decoded = decodeComposerResponse(result.data);
        if (!decoded) return { data: null, error: { status: 400, message: 'AI returned an invalid page-section response.' } };
        // The create/replace label is bookkeeping against supplied source; the complete-source
        // and section-preservation checks below are what protect paid work.
        decoded.fileOps = decoded.fileOps.map(op => op.type === 'delete' ? op
          : chunkRequest.files[op.path] === undefined
            ? { ...op, type: 'create' as const }
            : { ...op, type: 'replace' as const });
        violations = [...composerProposalViolations(chunkRequest, decoded), ...batchSourceViolations(chunkRequest, decoded, index > 0)];
        for (const op of decoded.fileOps) {
          if (op.type === 'delete' || (op.path.startsWith('/src/pages/') && op.path !== request.page.filePath)) {
            violations.push(`${op.path}: section work cannot delete source or change another page`);
          }
        }
        if (decoded.routeOps?.length) violations.push('Section work cannot change routes.');
        if (!violations.length) {
          accepted = decoded;
          if (typeof result.data === 'object') lastData = { ...result.data };
          break;
        }
        if (attempt === 0) {
          if (deadline - Date.now() <= SECTION_PROVIDER_TIMEOUT_MS + SECTION_TRANSPORT_RESERVE_MS) break;
          instruction = `CORRECTION: the previous batch was rejected: ${violations.join('; ')}. Return complete corrected source for the same sections only.\n${instruction}`;
        }
      }
      if (!accepted) return { data: null, error: { status: 400, message: violations.join('; ') } };
      for (const op of accepted.fileOps) {
        if (op.type === 'delete') continue;
        files[op.path] = op.content;
        operations.set(op.path, { ...op, type: request.files[op.path] === undefined ? 'create' : 'replace' });
      }
      responses.push(accepted);
      // Publish a checkpoint only after the entire batch passes; failed batches cannot poison paid source.
      const checkpoint = { files: { ...files }, responses: [...responses], lastData: { ...lastData }, savedAt: Date.now() };
      checkpoints.set(key, checkpoint);
      let bytes = 0;
      for (const [id, value] of [...checkpoints].reverse()) {
        bytes += id.length + JSON.stringify(value).length;
        if (bytes > MAX_CHECKPOINT_BYTES) checkpoints.delete(id);
      }
    }
    const merged: AIComposerResponse = {
      summary: responses.map(response => response.summary).join('\n').slice(0, 2000),
      fileOps: [...operations.values()],
      requestedDependencies: [...new Set(responses.flatMap(response => response.requestedDependencies ?? []))],
      intentsUsed: [...new Set(responses.flatMap(response => response.intentsUsed ?? []))],
      componentDecisions: responses.flatMap(response => response.componentDecisions ?? []).slice(0, 24),
    };
    return { data: { ...lastData, content: JSON.stringify(merged) }, error: null };
  };
}