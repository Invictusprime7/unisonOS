/**
 * Upload placement: turns files attached in the AI Builder chat into durable,
 * project-owned links and tells the AI exactly how each one may be placed
 * (image source, section background, button/link target, form, document →
 * page). How a linked file opens (new tab, overlay, download) is decided per
 * button context + industry, never hardcoded by the AI.
 */
import { supabase } from '@/integrations/supabase/client';

export type UploadKind = 'image' | 'document' | 'text' | 'other';
export type LinkOpenMode = 'new-tab' | 'overlay' | 'download' | 'same-page';

export interface PlacedUpload {
  name: string;
  kind: UploadKind;
  mimeType: string;
  url: string;
  /** Stable storage location; the link may be re-issued, the path never changes. */
  bucket?: string;
  storagePath?: string;
  /** Plain text extracted client-side (text/markdown/code, PDF and Word files). */
  text?: string;
}

const MAX_EXTRACTED_CHARS = 8000;

/** Extracts readable text from an upload so the AI can build pages/copy from it. */
export async function extractUploadText(file: File): Promise<string | undefined> {
  try {
    const kind = classifyUpload(file.type, file.name);
    if (kind === 'text') {
      return (await file.text()).slice(0, MAX_EXTRACTED_CHARS);
    }
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      const pdfjs = await import('pdfjs-dist');
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const parts: string[] = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        parts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
        if (parts.join('\n').length >= MAX_EXTRACTED_CHARS) break;
      }
      const text = parts.join('\n').replace(/\s{2,}/g, ' ').trim();
      return text ? text.slice(0, MAX_EXTRACTED_CHARS) : undefined;
    }
    if (/\.docx$/i.test(file.name) || file.type.includes('officedocument.wordprocessingml')) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      const text = result.value.trim();
      return text ? text.slice(0, MAX_EXTRACTED_CHARS) : undefined;
    }
  } catch (err) {
    console.warn('[uploadPlacement] text extraction failed for', file.name, err);
  }
  return undefined;
}

const UPLOAD_BUCKET = 'user-files';
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export function classifyUpload(mimeType: string, name: string): UploadKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (/pdf|msword|officedocument|presentation|spreadsheet/.test(mimeType) || /\.(pdf|docx?|pptx?|xlsx?|key|pages)$/i.test(name)) return 'document';
  if (mimeType.startsWith('text/') || /\.(md|txt|csv|json)$/i.test(name)) return 'text';
  return 'other';
}

/** Uploads one file into the signed-in owner's folder and returns a durable link. */
export async function uploadForPlacement(file: File, projectId: string | null | undefined): Promise<PlacedUpload> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to upload files to your site.');
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').toLowerCase() || 'file';
  const path = `${user.id}/site-uploads/${projectId ?? 'unscoped'}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from(UPLOAD_BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(`Couldn't upload ${file.name}.`);
  const { data, error: signErr } = await supabase.storage.from(UPLOAD_BUCKET).createSignedUrl(path, TEN_YEARS);
  if (signErr || !data?.signedUrl) throw new Error(`Couldn't create a link for ${file.name}.`);
  const text = await extractUploadText(file);
  return { name: file.name, kind: classifyUpload(file.type, file.name), mimeType: file.type || 'application/octet-stream', url: data.signedUrl, bucket: UPLOAD_BUCKET, storagePath: path, text };
}

/**
 * Per-industry overrides: which button contexts open in an in-site overlay
 * rather than a new tab. Defaults apply to every industry.
 */
const OVERLAY_CONTEXTS_BY_INDUSTRY: Record<string, string[]> = {
  agency: ['case study', 'portfolio', 'work', 'project'],
  creative: ['portfolio', 'gallery', 'lookbook'],
  photography: ['portfolio', 'gallery', 'album'],
  restaurant: ['menu'],
  salon: ['price list', 'menu', 'lookbook'],
  real_estate: ['floor plan', 'listing', 'brochure'],
  ecommerce: ['size guide', 'lookbook', 'cart'],
  coaching: ['case study', 'workbook'],
  consulting: ['case study', 'report'],
};

const DEFAULT_OVERLAY = ['cart', 'gallery', 'video', 'preview', 'quick view', 'lightbox'];
const DOWNLOAD_WORDS = ['download', 'get the', 'save', 'brochure pdf', 'press kit'];
const NEW_TAB_WORDS = ['view', 'open', 'read', 'see', 'case study', 'portfolio', 'report', 'whitepaper', 'brief', 'deck'];

/** Decides how a linked file should open for a given button label/intent. */
export function resolveLinkOpenMode(input: { label?: string | null; intent?: string | null; industry?: string | null; kind: UploadKind }): LinkOpenMode {
  const label = `${input.label ?? ''} ${input.intent ?? ''}`.toLowerCase();
  if (input.intent === 'content.download' || DOWNLOAD_WORDS.some((w) => label.includes(w))) return 'download';
  const industry = (input.industry ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  const overlay = [...DEFAULT_OVERLAY, ...(OVERLAY_CONTEXTS_BY_INDUSTRY[industry] ?? [])];
  if (input.kind === 'image' && overlay.some((w) => label.includes(w))) return 'overlay';
  if (overlay.some((w) => label.includes(w)) && input.kind !== 'document') return 'overlay';
  if (input.kind === 'document' || NEW_TAB_WORDS.some((w) => label.includes(w))) return 'new-tab';
  return 'same-page';
}

/** Prompt block describing the uploads and the placement contract. */
export function buildUploadPlacementBlock(uploads: PlacedUpload[], industry?: string | null): string {
  if (uploads.length === 0) return '';
  const overlay = [...DEFAULT_OVERLAY, ...(OVERLAY_CONTEXTS_BY_INDUSTRY[(industry ?? '').toLowerCase().replace(/[\s-]+/g, '_')] ?? [])];
  const lines = uploads.map((u, i) => {
    const text = u.text ? `\n   extracted text (use for copy/page body):\n   ${u.text.slice(0, 3000).replace(/\n/g, '\n   ')}` : '';
    return `${i + 1}. ${u.name} (${u.kind}, ${u.mimeType})\n   url: ${u.url}${text}`;
  });
  return `\n\n[UPLOADED FILES — saved to this site; use these exact URLs, never placeholders]
${lines.join('\n')}

Placement rules:
- Put each file where the user said. Images → <img src> (keep or write a meaningful alt) or a section/element background (style backgroundImage / bg-[url()] with the exact URL). Swap only the named target; leave other media alone.
- Documents/briefs/case studies/portfolios → either link a button/link to the URL, or, if the user asks for a page, create a new page from the extracted text using certified Unison components.
- How a linked file opens is decided by the button's context:
  • download / "get the" / content.download intent → <a href=URL download>.
  • overlay contexts (${overlay.join(', ')}) → open inside the site in a dialog/overlay (images in a lightbox, PDFs in an <iframe> inside the overlay) with a visible close button and Escape to close.
  • view / read / open case study, portfolio, report, brief, deck → <a href=URL target="_blank" rel="noopener noreferrer">.
- Forms: when asked, add a file field (<input type="file">) to the named form, or build a form from an uploaded document's fields. Keep the form's existing data-ut-intent.
- Keep every existing data-ut-intent, data-ut-resource and destination unchanged unless the user asked to relink that exact button.`;
}

/** Reminds the AI it may compose any certified Unison component or create pages. */
export const CERTIFIED_VOCABULARY_NOTE = `\n\n[Design vocabulary] You may use any certified (canonical) Unison design-system component or primitive, and you may create new pages when asked (new file under /src/pages plus its route). Never use experimental or quarantined designs.`;
