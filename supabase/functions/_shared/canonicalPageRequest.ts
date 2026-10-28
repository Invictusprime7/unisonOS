import { aiComposerRequestSchema } from './aiComposerContract.ts';

/** Restrict the generate-page adapter to the existing page author/repair protocol. */
export function isCanonicalPageRequest(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const input = body as { mode?: unknown; messages?: unknown };
  if (!Array.isArray(input.messages) || input.messages.length !== 1) return false;
  const message = input.messages[0];
  if (!message || message.role !== 'user' || typeof message.content !== 'string') return false;
  try {
    const parsed = aiComposerRequestSchema.safeParse(JSON.parse(message.content));
    if (!parsed.success) return false;
    return (parsed.data.task === 'site_page_author' && input.mode === 'site-page-author')
      || (parsed.data.task === 'site_page_repair' && input.mode === 'site-page-repair');
  } catch { return false; }
}
