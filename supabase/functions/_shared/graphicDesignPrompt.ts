/**
 * Affinity Graphics prompt contract. Builds the request for one whole graphic
 * document (create or edit) and extracts the returned JSON. The browser's
 * `normalizeGraphicDocument` remains the acceptance point; this module only
 * guarantees the reply has the document shape before it is returned.
 */

export type GraphicDesignMode = "create" | "edit";
export type GraphicReferenceRole = "logo" | "photo" | "inspiration";

export interface GraphicFormatSpec {
  id: string;
  label: string;
  category: string;
  sizeLabel: string;
  print: boolean;
  canvasWidth: number;
  canvasHeight: number;
  bleed: number;
  safeArea: { x: number; y: number; width: number; height: number };
  pageNames: string[];
}

export interface GraphicDesignRequest {
  mode: GraphicDesignMode;
  prompt: string;
  format: GraphicFormatSpec;
  document: unknown | null;
  selectedLayerId: string | null;
  references: Array<{ id: string; name: string; role: GraphicReferenceRole; dataUrl: string }>;
  allowGeneratedPhotos: boolean;
  fonts: string[];
}

export const MAX_GRAPHIC_REFERENCES = 4;
const MAX_REFERENCE_BYTES = 1_400_000;
const MAX_DOCUMENT_CHARS = 120_000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const clean = (value: unknown, max: number) => typeof value === "string"
  // deno-lint-ignore no-control-regex
  ? value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, max)
  : "";
const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
};

export function parseGraphicDesignRequest(body: unknown): { ok: true; request: GraphicDesignRequest } | { ok: false; error: string } {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  const mode: GraphicDesignMode = body.mode === "edit" ? "edit" : "create";
  const prompt = clean(body.prompt, 4_000);
  if (!prompt) return { ok: false, error: "Describe what you'd like Affinity to design." };

  const f = isRecord(body.format) ? body.format : null;
  if (!f || !clean(f.id, 60)) return { ok: false, error: "A graphic format is required." };
  const canvasWidth = clamp(f.canvasWidth, 100, 10_000, 816);
  const canvasHeight = clamp(f.canvasHeight, 100, 10_000, 1056);
  const safe = isRecord(f.safeArea) ? f.safeArea : {};
  const format: GraphicFormatSpec = {
    id: clean(f.id, 60),
    label: clean(f.label, 80) || "Graphic",
    category: clean(f.category, 40) || "flyer",
    sizeLabel: clean(f.sizeLabel, 40),
    print: f.print === true,
    canvasWidth,
    canvasHeight,
    bleed: clamp(f.bleed, 0, 400, 0),
    safeArea: {
      x: clamp(safe.x, 0, canvasWidth, 0),
      y: clamp(safe.y, 0, canvasHeight, 0),
      width: clamp(safe.width, 1, canvasWidth, canvasWidth),
      height: clamp(safe.height, 1, canvasHeight, canvasHeight),
    },
    pageNames: (Array.isArray(f.pageNames) ? f.pageNames : ["Page 1"]).map((n) => clean(n, 30)).filter(Boolean).slice(0, 2),
  };
  if (format.pageNames.length === 0) format.pageNames = ["Page 1"];

  let document: unknown | null = null;
  if (mode === "edit") {
    if (!isRecord(body.document)) return { ok: false, error: "There is no design to edit yet." };
    if (JSON.stringify(body.document).length > MAX_DOCUMENT_CHARS) return { ok: false, error: "This design is too large to edit in one request." };
    document = body.document;
  }

  const references = (Array.isArray(body.references) ? body.references : [])
    .filter(isRecord)
    .slice(0, MAX_GRAPHIC_REFERENCES)
    .map((ref, index) => ({
      id: clean(ref.id, 40) || `ref-${index + 1}`,
      name: clean(ref.name, 80) || `Reference ${index + 1}`,
      role: (ref.role === "logo" || ref.role === "photo" ? ref.role : "inspiration") as GraphicReferenceRole,
      dataUrl: typeof ref.dataUrl === "string" ? ref.dataUrl : "",
    }))
    .filter((ref) => /^data:image\/(png|jpe?g|webp);base64,/i.test(ref.dataUrl) && ref.dataUrl.length <= MAX_REFERENCE_BYTES);

  const fonts = (Array.isArray(body.fonts) ? body.fonts : []).map((font) => clean(font, 40)).filter(Boolean).slice(0, 24);

  return {
    ok: true,
    request: {
      mode,
      prompt,
      format,
      document,
      selectedLayerId: clean(body.selectedLayerId, 60) || null,
      references,
      allowGeneratedPhotos: body.allowGeneratedPhotos !== false,
      fonts,
    },
  };
}

const DOCUMENT_SCHEMA = `{
  "title": string,
  "palette": ["#rrggbb", ...],            // 2-3 main colours plus neutrals
  "pages": [{
    "id": string, "name": string, "background": "#rrggbb",
    "layers": [                            // bottom-most first; later layers draw on top
      { "type": "text", "id": string, "role": "headline|subheadline|body|cta|detail|name|title|contact|label",
        "text": string, "x": n, "y": n, "width": n, "fontFamily": string, "fontSize": n, "fontWeight": 400-900,
        "italic": bool, "color": "#rrggbb", "align": "left|center|right", "lineHeight": n, "letterSpacing": n (1/1000 em), "uppercase": bool },
      { "type": "shape", "id": string, "shape": "rect|ellipse|line", "x": n, "y": n, "width": n, "height": n,
        "fill": "#rrggbb", "stroke": "#rrggbb"|null, "strokeWidth": n, "radius": n, "opacity": 0-1 },
      { "type": "image", "id": string, "x": n, "y": n, "width": n, "height": n, "fit": "cover|contain", "radius": n, "alt": string,
        "referenceId": string|null, "src": "asset:<id>"|null, "generate": { "prompt": string }|null }
    ]
  }]
}`;

const DESIGN_PRINCIPLES = [
  "Stick to 2-3 colours (plus white/black/greys). Too many colours look messy.",
  "One dominant headline: big, bold, readable at a glance. Clear hierarchy: headline > supporting line > details.",
  "Leave white space. Do not fill every inch; group related information.",
  "Align everything to a few shared edges or a centre line; use consistent margins.",
  "Text must have strong contrast with what is behind it (WCAG 4.5:1 for small text, 3:1 for large).",
  "Use at most two typefaces.",
  "Avoid generic clip-art compositions, gratuitous gradients and decoration without purpose.",
];

/** System + user messages for one Affinity Graphics request. */
export function buildGraphicDesignMessages(request: GraphicDesignRequest): Array<{ role: string; content: unknown }> {
  const { format } = request;
  const pages = format.pageNames.length;
  const printRules = format.print
    ? `This is a PRINT design. The canvas includes a ${format.bleed}px bleed on every side (trim edge starts at ${format.bleed}px). Background colours/shapes/photos meant to reach the edge must extend to the canvas edge. ALL text must stay inside the safe area.`
    : "This is a SCREEN design shown at exactly the canvas size. Keep text inside the safe area.";

  const system = [
    "You are Affinity, Unison's senior graphic designer. You design professional print and marketing graphics for owners with no design experience.",
    "Reply with ONE JSON object only: { \"summary\": string, \"document\": <document> }. No markdown, no code fences.",
    "\"summary\" is one or two plain sentences for the owner describing what you designed or changed (no jargon, no coordinates).",
    `Document schema:\n${DOCUMENT_SCHEMA}`,
    `Coordinates are pixels on a ${format.canvasWidth}×${format.canvasHeight} canvas (96 px = 1 inch), origin top-left, x/y is each layer's top-left corner. Text layers wrap inside their width.`,
    printRules,
    `Safe area: x=${format.safeArea.x}, y=${format.safeArea.y}, width=${format.safeArea.width}, height=${format.safeArea.height}.`,
    `Format: ${format.label} (${format.sizeLabel}), category ${format.category}. Produce exactly ${pages} page(s) named ${format.pageNames.map((n) => `"${n}"`).join(", ")}.`,
    format.category === "business-card"
      ? "Business cards: the front carries the name, role and business; the back carries contact details or the logo. Keep text at least 7 pt (≈9.5 px)."
      : format.category === "letterhead"
        ? "Letterheads: brand header and a slim contact footer; keep the large writing area in the middle empty."
        : "Printed text should be at least 8 pt (≈10.7 px); flyers and posters need a clear call to action.",
    `Allowed fontFamily values: ${request.fonts.join(", ")}.`,
    `Design principles:\n- ${DESIGN_PRINCIPLES.join("\n- ")}`,
    "Use only the owner's facts. Never invent phone numbers, emails, addresses, prices or dates; when one is needed but unknown, use an obvious placeholder in square brackets such as [Phone] so the owner can replace it.",
    request.references.length
      ? "Reference images are attached. role=logo or role=photo: place it with an image layer whose referenceId is that reference id (logos usually fit=contain). role=inspiration: borrow its mood, colour and layout ideas only; never place it or copy its text."
      : "No reference images are attached.",
    request.allowGeneratedPhotos
      ? "You may ask for at most ONE new photo per page with an image layer {\"generate\": {\"prompt\": \"detailed photo description, no text in the image\"}} when a photo clearly helps; otherwise design with type, colour and shapes."
      : "Do not request new photos (generate must be null).",
    request.mode === "edit"
      ? "EDIT MODE: return the COMPLETE updated document. Change only what the owner asked; keep every other layer's id, text and position. Image layers whose src is \"asset:<id>\" must keep that exact src unless the owner asks to replace or remove the image."
      : "CREATE MODE: design a complete, finished piece from the owner's description.",
  ].join("\n\n");

  const parts: unknown[] = [];
  const intro = request.mode === "edit"
    ? `Current design:\n${JSON.stringify(request.document)}\n\n${request.selectedLayerId ? `The owner has selected the layer with id "${request.selectedLayerId}"; words like "this" refer to it.\n\n` : ""}Change request: ${request.prompt}`
    : `Design request: ${request.prompt}`;
  parts.push({ type: "text", text: intro });
  for (const ref of request.references) {
    parts.push({ type: "text", text: `Reference id=${ref.id} role=${ref.role} name="${ref.name}"` });
    parts.push({ type: "image_url", image_url: { url: ref.dataUrl } });
  }

  return [
    { role: "system", content: system },
    { role: "user", content: request.references.length ? parts : intro },
  ];
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : "")).join("");
  }
  return "";
}

const trimTrailingComma = (out: string) => out.replace(/,\s*$/, "");

/**
 * Structural repair for long model JSON. Gemini occasionally drops or
 * misplaces a closing bracket (or a comma between array items) in otherwise
 * complete multi-page documents. This closes missing brackets, drops stray
 * ones, removes trailing commas and inserts a missing comma between adjacent
 * values. String contents are never altered.
 */
export function repairJsonStructure(text: string): string {
  let out = "";
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let last = ""; // last significant character outside strings
  for (const ch of text) {
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === "\"") { inString = false; last = "\""; }
      continue;
    }
    if (/\s/.test(ch)) { out += ch; continue; }
    if ((ch === "{" || ch === "[" || ch === "\"") && (last === "}" || last === "]" || (last === "\"" && stack[stack.length - 1] === "]"))) {
      out += ",";
    }
    if (ch === "\"") { inString = true; out += ch; continue; }
    if (ch === "{" || ch === "[") {
      stack.push(ch === "{" ? "}" : "]");
      out += ch;
      last = ch;
      continue;
    }
    if (ch === "}" || ch === "]") {
      const index = stack.lastIndexOf(ch);
      if (index < 0) continue; // stray closer
      while (stack.length - 1 > index) out = trimTrailingComma(out) + stack.pop();
      out = trimTrailingComma(out) + stack.pop();
      last = ch;
      continue;
    }
    out += ch;
    last = ch;
  }
  if (inString) out += "\"";
  while (stack.length) out = trimTrailingComma(out) + stack.pop();
  return out;
}

function parseJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  if (start < 0) return null;
  const end = text.lastIndexOf("}");
  if (end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      // fall through to structural repair
    }
  }
  try {
    return JSON.parse(repairJsonStructure(text.slice(start)));
  } catch {
    return null;
  }
}

/** Pull `{ summary, document }` out of a provider reply; null when unusable. */
export function extractGraphicDesignResult(content: unknown): { summary: string; document: Record<string, unknown> } | null {
  const text = messageText(content).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = parseJsonObject(text);
  if (!isRecord(parsed)) return null;
  const document = isRecord(parsed.document) ? parsed.document : Array.isArray(parsed.pages) ? parsed : null;
  if (!document || !Array.isArray(document.pages) || document.pages.length === 0) return null;
  const summary = clean(parsed.summary, 400) || "Here's your design.";
  return { summary, document };
}
