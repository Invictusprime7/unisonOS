import { AI_COMPOSER_MODES, composerProposalViolations, type AIComposerRequest, type AIComposerResponse } from '@/contracts/aiComposerContract';
import { decodeComposerResponse, type ComposerInvoke } from '@/services/builder/aiRepairLoop';
import { runBuilderTurn } from '@/services/builderBrainClient';

/** Partition work, not content: repeated families and their original order survive. */
export function partitionPageSections(sectionOrder: readonly string[]): string[][] {
  const body = sectionOrder.filter(family => family !== 'navbar' && family !== 'footer');
  const chunks: string[][] = [];
  for (let index = 0; index < body.length; index += 2) chunks.push(body.slice(index, index + 2));
  return chunks;
}

/** Partial drafts remain invocation-local; only the assembled response reaches candidate gates. */
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
    const files = { ...request.files };
    const operations = new Map<string, AIComposerResponse['fileOps'][number]>();
    const responses: AIComposerResponse[] = [];
    let lastData: Record<string, unknown> = {};
    for (const [index, families] of chunks.entries()) {
      if (options.signal?.aborted) return { data: null, error: new DOMException('Cancelled.', 'AbortError') };
      const remaining = deadline - Date.now();
      if (remaining <= 5_000) return { data: null, error: new DOMException('Page section time budget reached.', 'TimeoutError') };
      onChunk?.(index, chunks.length);
      const scope = [
        `BOUNDED PAGE WORK ${index + 1}/${chunks.length}: author ONLY these next body sections, in order: ${families.join(', ')}.`,
        index === 0
          ? 'Create the page shell using the existing shared site nav and footer. Replace baseline body content with only this batch; later batches add the remaining sections.'
          : 'Continue the paid draft in FILES. Preserve every completed section, shared chrome, literal section ID, image, item and binding. Add only this batch immediately before the shared footer. Prefer SEARCH/REPLACE hunks; never re-author completed sections.',
        'The full design brief is reference for the completed page, NOT a request to write other batches now. Partial section counts are intentional; final page checks run after all batches. Do not change routes or other pages. Preserve all planned content quantities; do not shorten lists to fit.',
      ].join('\n');
      const chunkRequest: AIComposerRequest = {
        ...request,
        files,
        brief: request.brief,
        instruction: `${scope}\n${request.instruction ?? ''}`,
      };
      const timeoutMs = Math.min(60_000, remaining - 5_000);
      const result = await invoke({
        ...input,
        messages: [{ role: 'user', content: JSON.stringify(chunkRequest) }],
        gatewayOptions: { ...(input.gatewayOptions as Record<string, unknown> | undefined), timeoutMs },
      }, { ...options, timeoutMs: timeoutMs + 5_000 });
      // Unknown outcomes are not replayed: stop instead of billing another whole page.
      if (result.error || !result.data) return result;
      const response = decodeComposerResponse(result.data);
      if (!response) return { data: null, error: { status: 400, message: 'AI returned an invalid page-section response.' } };
      const violations = composerProposalViolations(chunkRequest, response);
      for (const op of response.fileOps) {
        if (op.type === 'delete' || (op.path.startsWith('/src/pages/') && op.path !== request.page.filePath)) {
          violations.push(`${op.path}: section work cannot delete source or change another page`);
        }
      }
      if (response.routeOps?.length) violations.push('Section work cannot change routes.');
      if (violations.length) return { data: null, error: { status: 400, message: violations.join('; ') } };
      for (const op of response.fileOps) {
        if (op.type === 'delete') continue;
        files[op.path] = op.content;
        operations.set(op.path, { ...op, type: request.files[op.path] === undefined ? 'create' : 'replace' });
      }
      responses.push(response);
      if (typeof result.data === 'object') lastData = { ...result.data };
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