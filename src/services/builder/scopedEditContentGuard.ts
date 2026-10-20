const IMPORT_PATTERN = /^\s*import\s[\s\S]*?;?$/gm;
const COMPONENT_DECLARATION_PATTERN = /(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/g;
const JSX_TAG_PATTERN = /<\s*([A-Za-z][A-Za-z0-9_.-]*)\b/g;

const SIDE_EFFECT_TAGS = new Set([
  'form', 'input', 'textarea', 'select', 'option', 'button', 'dialog',
  'nav', 'header', 'footer', 'section', 'article', 'aside', 'table',
  'video', 'audio', 'iframe',
]);

function collectMatches(content: string, pattern: RegExp): Set<string> {
  const matches = new Set<string>();
  for (const match of content.matchAll(pattern)) matches.add(match[1]);
  return matches;
}

function addedValues(before: Set<string>, after: Set<string>): string[] {
  return [...after].filter((value) => !before.has(value));
}

function promptAllows(prompt: string, token: string): boolean {
  const lower = prompt.toLowerCase();
  if (token === 'form' || token === 'input' || token === 'textarea' || token === 'select' || token === 'option') {
    return /\b(form|contact|signup|sign up|register|checkout|booking|appointment|submit|field|input|textarea|select)\b/.test(lower);
  }
  if (token === 'button') return /\b(button|cta|call to action|submit|action|form|contact|signup|checkout|booking)\b/.test(lower);
  if (/^[A-Z]/.test(token)) {
    return /\b(add|create|introduce|new|component|form|widget|section|block)\b/.test(lower);
  }
  return false;
}

/**
 * Detect UI structures introduced by a scoped candidate that the prompt did
 * not request. This is deliberately conservative: copy/style edits must not
 * silently become new forms, controls, sections, or component composition.
 */
export function findUnrequestedScopedSideEffects(
  original: string,
  candidate: string,
  prompt: string,
): string[] {
  const reasons: string[] = [];
  const originalImports = new Set([...original.matchAll(IMPORT_PATTERN)].map((match) => match[0].trim()));
  const candidateImports = new Set([...candidate.matchAll(IMPORT_PATTERN)].map((match) => match[0].trim()));
  const addedImports = addedValues(originalImports, candidateImports);
  if (addedImports.length > 0 && !/\b(add|create|introduce|import|use|icon|motion|animat\w*|3d|parallax|scroll|immersive|webgl|hover|transition|form|button|component)\b/i.test(prompt)) {
    reasons.push(`new imports (${addedImports.length})`);
  }

  const originalTags = collectMatches(original, JSX_TAG_PATTERN);
  const candidateTags = collectMatches(candidate, JSX_TAG_PATTERN);
  for (const tag of addedValues(originalTags, candidateTags)) {
    const normalizedTag = tag.toLowerCase();
    if ((SIDE_EFFECT_TAGS.has(normalizedTag) || /^[A-Z]/.test(tag)) && !promptAllows(prompt, tag)) {
      reasons.push(`new <${tag}> element`);
    }
  }

  const originalDeclarations = collectMatches(original, COMPONENT_DECLARATION_PATTERN);
  const candidateDeclarations = collectMatches(candidate, COMPONENT_DECLARATION_PATTERN);
  for (const name of addedValues(originalDeclarations, candidateDeclarations)) {
    if (!promptAllows(prompt, name)) reasons.push(`new ${name} component`);
  }

  return [...new Set(reasons)];
}

const JSX_TEXT_PATTERN = />\s*([^<>{}]*[A-Za-z][^<>{}]*?)\s*</g;
const COPY_PROP_PATTERN = /\b(?:headline|subheadline|title|subtitle|eyebrow|badge|description|label|caption|quote|body|text|cta|ctaLabel|placeholder|alt)\s*[:=]\s*(?:\{\s*)?(["'`])((?:(?!\1)[^\\]|\\.){2,})\1/g;

const COPY_REQUEST_PATTERN = /\b(text|copy|wording|words|reword|rephrase|rewrite|rename|say|says|read|reads|shorter|longer|shorten|lengthen|concise|tone|formal|casual|friendly|professional|playful|translate|spelling|typo|grammar|replace .* with|change .* to|write)\b/i;

function normalizeCopy(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function collectCopy(source: string): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (raw: string) => {
    const value = normalizeCopy(raw);
    if (value.length < 2 || !/[A-Za-z]/.test(value)) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  };
  for (const match of source.matchAll(JSX_TEXT_PATTERN)) add(match[1]);
  for (const match of source.matchAll(COPY_PROP_PATTERN)) add(match[2]);
  return counts;
}

/** True when the prompt asks for a wording change rather than a visual one. */
export function promptRequestsCopyChange(prompt: string): boolean {
  return COPY_REQUEST_PATTERN.test(prompt);
}

/**
 * Detect visible copy the candidate removed or rewrote that the request did
 * not cover. A style/layout request may not change any copy; a wording request
 * on a clicked element may only change copy that belongs to that element.
 * Returns the removed strings (truncated) — empty means no collateral copy.
 */
export function findUnrequestedCopyChanges(
  original: string,
  candidate: string,
  prompt: string,
  targetText?: string | null,
): string[] {
  const before = collectCopy(original);
  const after = collectCopy(candidate);
  const removed: string[] = [];
  for (const [value, count] of before) {
    if ((after.get(value) ?? 0) < count) removed.push(value);
  }
  if (removed.length === 0) return [];
  const wordingRequest = promptRequestsCopyChange(prompt);
  const target = normalizeCopy(targetText ?? '').toLowerCase();
  const outOfScope = removed.filter((value) => {
    if (!wordingRequest) return true;
    // No clicked element: a wording request may rewrite copy on the target file.
    if (!target) return false;
    const lower = value.toLowerCase();
    return !(target.includes(lower) || lower.includes(target.slice(0, 40)));
  });
  return outOfScope.map((value) => (value.length > 60 ? `${value.slice(0, 57)}…` : value));
}
