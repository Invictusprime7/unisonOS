/** Read-only fallback file/CSS extraction. Authoring and acceptance belong to Composer/App Builder. */

export interface ExtractedMultiFileOutput {
  files: Record<string, string>;
  /** Files the model explicitly asks the VFS transaction to remove. */
  deletions?: string[];
  explanation?: string;
}

function parseMultiFileCandidate(candidate: string): ExtractedMultiFileOutput | null {
  try {
    const parsed = JSON.parse(candidate) as { files?: unknown; deletions?: unknown; deletedFiles?: unknown; explanation?: unknown };
    if ((!parsed.files || typeof parsed.files !== 'object' || Array.isArray(parsed.files))
      && !Array.isArray(parsed.deletions)
      && !Array.isArray(parsed.deletedFiles)) return null;

    const files: Record<string, string> = {};
    for (const [path, value] of Object.entries(parsed.files ?? {})) {
      const content = typeof value === 'string'
        ? value
        : value && typeof value === 'object' && 'content' in value && typeof value.content === 'string'
          ? value.content
          : null;
      if (content === null) return null;
      files[path] = content;
    }
    const deletionSource: unknown[] = Array.isArray(parsed.deletions)
      ? parsed.deletions
      : Array.isArray(parsed.deletedFiles)
        ? parsed.deletedFiles
        : [];
    const deletions = [...new Set((deletionSource ?? []).filter((path): path is string => typeof path === 'string' && isGeneratedFilePath(path)))];
    if (Object.keys(files).length === 0 && deletions.length === 0) return null;

    return {
      files,
      ...(deletions.length ? { deletions } : {}),
      ...(typeof parsed.explanation === 'string' ? { explanation: parsed.explanation } : {}),
    };
  } catch {
    return null;
  }
}

function decodeJsonStringContent(value: string): string {
  return value.replace(/\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})/g, (escape) => {
    if (escape[1] === 'u') {
      return String.fromCharCode(Number.parseInt(escape.slice(2), 16));
    }
    const replacements: Record<string, string> = {
      '\\"': '"',
      '\\\\': '\\',
      '\\/': '/',
      '\\b': '\b',
      '\\f': '\f',
      '\\n': '\n',
      '\\r': '\r',
      '\\t': '\t',
    };
    return replacements[escape] ?? escape;
  });
}

function readQuotedJsonToken(input: string, start: number): { value: string; end: number } | null {
  if (input[start] !== '"') return null;
  for (let index = start + 1; index < input.length; index += 1) {
    if (input[index] !== '"') continue;
    let slashCount = 0;
    for (let cursor = index - 1; cursor > start && input[cursor] === '\\'; cursor -= 1) {
      slashCount += 1;
    }
    if (slashCount % 2 === 1) continue;
    try {
      return { value: JSON.parse(input.slice(start, index + 1)), end: index + 1 };
    } catch {
      return null;
    }
  }
  return null;
}

function isGeneratedFilePath(path: string): boolean {
  return /^(?:\.?\.?\/|\/)?(?:[\w@.-]+\/)*[\w@.-]+\.[a-z0-9]+$/i.test(path);
}

function findMalformedFileValueEnd(input: string, start: number): number {
  for (let index = start; index < input.length; index += 1) {
    if (input[index] !== '"') continue;
    let slashCount = 0;
    for (let cursor = index - 1; cursor >= start && input[cursor] === '\\'; cursor -= 1) {
      slashCount += 1;
    }
    if (slashCount % 2 === 1) continue;

    let cursor = index + 1;
    while (/\s/.test(input[cursor] ?? '')) cursor += 1;
    if (input[cursor] === ',') {
      cursor += 1;
      while (/\s/.test(input[cursor] ?? '')) cursor += 1;
      const nextKey = readQuotedJsonToken(input, cursor);
      if (!nextKey || !isGeneratedFilePath(nextKey.value)) continue;
      cursor = nextKey.end;
      while (/\s/.test(input[cursor] ?? '')) cursor += 1;
      if (input[cursor] === ':') return index;
      continue;
    }

    if (input[cursor] !== '}') continue;
    cursor += 1;
    while (/\s/.test(input[cursor] ?? '')) cursor += 1;
    if (input[cursor] === '}') return index;
    if (input[cursor] !== ',') continue;
    cursor += 1;
    while (/\s/.test(input[cursor] ?? '')) cursor += 1;
    const outerKey = readQuotedJsonToken(input, cursor);
    if (outerKey?.value === 'explanation') return index;
  }
  return -1;
}

/** Recover the known file-map contract when JSX quotes were not JSON-escaped. */
function parseMalformedMultiFileCandidate(candidate: string): ExtractedMultiFileOutput | null {
  const filesKey = candidate.match(/"files"\s*:\s*\{/);
  if (!filesKey || filesKey.index === undefined) return null;

  const files: Record<string, string> = {};
  let cursor = filesKey.index + filesKey[0].length;
  while (cursor < candidate.length) {
    while (/\s|,/.test(candidate[cursor] ?? '')) cursor += 1;
    if (candidate[cursor] === '}') break;

    const key = readQuotedJsonToken(candidate, cursor);
    if (!key || !isGeneratedFilePath(key.value)) return null;
    cursor = key.end;
    while (/\s/.test(candidate[cursor] ?? '')) cursor += 1;
    if (candidate[cursor] !== ':') return null;
    cursor += 1;
    while (/\s/.test(candidate[cursor] ?? '')) cursor += 1;
    if (candidate[cursor] !== '"') return null;

    const valueStart = cursor + 1;
    const valueEnd = findMalformedFileValueEnd(candidate, valueStart);
    if (valueEnd < 0) return null;
    files[key.value] = decodeJsonStringContent(candidate.slice(valueStart, valueEnd));
    cursor = valueEnd + 1;
  }

  return Object.keys(files).length > 0 ? { files } : null;
}

function findBalancedJsonObjects(input: string): string[] {
  const objects: string[] = [];
  for (let start = 0; start < input.length; start += 1) {
    if (input[start] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < input.length; index += 1) {
      const char = input[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          objects.push(input.slice(start, index + 1));
          start = index;
          break;
        }
      }
    }
  }
  return objects;
}

/** Extract the structured file contract even when the model wraps JSON in prose. */
export function extractMultiFileOutput(input: string): ExtractedMultiFileOutput | null {
  const trimmed = input.trim();
  const direct = parseMultiFileCandidate(trimmed);
  if (direct) return direct;

  const fencedJson = /```(?:json)?\s*\r?\n([\s\S]*?)```/gi;
  let fence: RegExpExecArray | null;
  while ((fence = fencedJson.exec(input)) !== null) {
    const parsed = parseMultiFileCandidate(fence[1].trim());
    if (parsed) return parsed;
    const recovered = parseMalformedMultiFileCandidate(fence[1].trim());
    if (recovered) return recovered;
  }

  for (const candidate of findBalancedJsonObjects(input)) {
    if (!candidate.includes('"files"') && !candidate.includes('"deletions"') && !candidate.includes('"deletedFiles"')) continue;
    const parsed = parseMultiFileCandidate(candidate);
    if (parsed) return parsed;
  }
  if (trimmed.includes('"files"')) return parseMalformedMultiFileCandidate(trimmed);
  return null;
}

const CSS_DOCUMENT_PATTERN = /^\s*(?::root|body|html|\*|@import|@font-face|@media|\/\*)/;

/** Return CSS-only model output as a canonical stylesheet patch. */
export function extractStylesheetOutput(input: string): Record<string, string> | null {
  const trimmed = input.trim();
  if (CSS_DOCUMENT_PATTERN.test(trimmed) && !/\b(?:import|export)\s/.test(trimmed)) {
    return { '/src/index.css': trimmed };
  }

  const fences = /```([\w-]*)\s*\r?\n([\s\S]*?)```/g;
  let fence: RegExpExecArray | null;
  while ((fence = fences.exec(input)) !== null) {
    const language = fence[1].toLowerCase();
    const content = fence[2].trim();
    if ((language === 'css' || CSS_DOCUMENT_PATTERN.test(content)) && !/\b(?:import|export)\s/.test(content)) {
      return { '/src/index.css': content };
    }
  }
  return null;
}

