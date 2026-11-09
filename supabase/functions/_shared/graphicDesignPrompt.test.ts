import { buildGraphicDesignMessages, extractGraphicDesignResult, parseGraphicDesignRequest } from './graphicDesignPrompt.ts';

const format = {
  id: 'flyer-us-letter', label: 'Flyer', category: 'flyer', sizeLabel: '8.5 × 11 in', print: true,
  canvasWidth: 840, canvasHeight: 1080, bleed: 12, safeArea: { x: 36, y: 36, width: 768, height: 1008 }, pageNames: ['Page 1'],
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('a request needs a description and a format', () => {
  assert(!parseGraphicDesignRequest({ format }).ok, 'empty prompt accepted');
  assert(!parseGraphicDesignRequest({ prompt: 'A flyer' }).ok, 'missing format accepted');
  assert(parseGraphicDesignRequest({ prompt: 'A flyer', format }).ok, 'valid request refused');
});

Deno.test('an edit needs the current design', () => {
  assert(!parseGraphicDesignRequest({ mode: 'edit', prompt: 'Bigger', format }).ok, 'edit without document accepted');
});

Deno.test('only image references are forwarded, at most four', () => {
  const ref = { id: 'r', role: 'logo', dataUrl: 'data:image/png;base64,AAAA' };
  const parsed = parseGraphicDesignRequest({
    prompt: 'A flyer', format,
    references: [ref, ref, { ...ref, dataUrl: 'https://evil.example/x.png' }, ref, ref, ref],
  });
  assert(parsed.ok && parsed.request.references.length === 3, 'reference filtering failed');
});

Deno.test('references are attached as images and print rules mention the bleed', () => {
  const parsed = parseGraphicDesignRequest({ prompt: 'A flyer', format, references: [{ id: 'ref-1', role: 'logo', name: 'logo.png', dataUrl: 'data:image/png;base64,AAAA' }] });
  assert(parsed.ok, 'request refused');
  const [system, user] = buildGraphicDesignMessages(parsed.request);
  assert(String(system.content).includes('12px bleed'), 'bleed missing from instructions');
  assert(Array.isArray(user.content) && user.content.some((part: { type?: string }) => part.type === 'image_url'), 'image not attached');
});

Deno.test('extracts the design from fenced JSON and rejects replies without pages', () => {
  const reply = '```json\n{"summary":"Done.","document":{"pages":[{"layers":[]}]}}\n```';
  const result = extractGraphicDesignResult(reply);
  assert(result?.summary === 'Done.' && Array.isArray(result.document.pages), 'fenced reply not parsed');
  assert(extractGraphicDesignResult('{"summary":"x","document":{"pages":[]}}') === null, 'empty pages accepted');
  assert(extractGraphicDesignResult('not json') === null, 'non-JSON accepted');
});

const layer = (id: string) => `{"type":"text","id":"${id}","text":"Say \\"hi\\" {not} [json]","x":1,"y":2}`;
const reply = (pagesJson: string) => `{"summary":"Done.","document":{"title":"T","palette":["#000000"],"pages":${pagesJson}}`;

Deno.test("graphic reply missing its final closing brace is repaired", () => {
  const text = reply(`[{"id":"p1","layers":[${layer("a")},${layer("b")}]}]`); // outer } dropped
  const result = extractGraphicDesignResult(text);
  if (!result) throw new Error("expected repaired document");
  const layers = (result.document.pages as Array<{ layers: Array<{ text: string }> }>)[0].layers;
  if (layers.length !== 2 || layers[1].text !== 'Say "hi" {not} [json]') throw new Error("string content must be untouched");
});

Deno.test("graphic reply with a misplaced closer, stray closer, missing comma and trailing comma is repaired", () => {
  const text = reply(`[{"id":"p1","layers":[${layer("a")} ${layer("b")},]}}]}}]`);
  const result = extractGraphicDesignResult(text);
  if (!result) throw new Error("expected repaired document");
  const layers = (result.document.pages as Array<{ layers: unknown[] }>)[0].layers;
  if (layers.length !== 2) throw new Error(`expected 2 layers, got ${layers.length}`);
});

Deno.test("graphic reply that is not a design still fails", () => {
  if (extractGraphicDesignResult("Sorry, I can't help with that.")) throw new Error("prose is not a design");
  if (extractGraphicDesignResult(`{"summary":"x","document":{"pages":[]}}`)) throw new Error("empty pages are not a design");
});
