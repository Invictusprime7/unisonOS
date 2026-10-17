/**
 * Replays one small source edit onto a newer copy of the same file.
 *
 * An edit is reduced to the single span that differs between `before` and
 * `after` (common prefix/suffix trimmed). The span is replayed onto `latest`
 * only when the original text, with a little surrounding context, appears
 * exactly once there — so a held text edit lands on top of another writer's
 * changes without guessing. Anything ambiguous is reported as a conflict.
 */
export type TextEditRebaseResult =
  | { status: 'unchanged'; code: string }
  | { status: 'applied'; code: string }
  | { status: 'conflict'; reason: 'span-missing' | 'span-ambiguous' };

const CONTEXT_CHARS = 24;

export interface TextEditSpan {
  start: number;
  removed: string;
  inserted: string;
}

export function diffSpan(before: string, after: string): TextEditSpan | null {
  if (before === after) return null;
  let start = 0;
  const max = Math.min(before.length, after.length);
  while (start < max && before[start] === after[start]) start += 1;
  let endBefore = before.length;
  let endAfter = after.length;
  while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) {
    endBefore -= 1;
    endAfter -= 1;
  }
  return { start, removed: before.slice(start, endBefore), inserted: after.slice(start, endAfter) };
}

function occurrences(haystack: string, needle: string): number[] {
  const found: number[] = [];
  if (!needle) return found;
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    found.push(at);
    at = haystack.indexOf(needle, at + 1);
  }
  return found;
}

export function rebaseTextEdit(before: string, after: string, latest: string): TextEditRebaseResult {
  if (latest === before) return { status: 'applied', code: after };
  if (latest === after) return { status: 'unchanged', code: latest };
  const span = diffSpan(before, after);
  if (!span) return { status: 'unchanged', code: latest };

  const leading = before.slice(Math.max(0, span.start - CONTEXT_CHARS), span.start);
  const trailing = before.slice(span.start + span.removed.length, span.start + span.removed.length + CONTEXT_CHARS);
  const needle = `${leading}${span.removed}${trailing}`;
  const hits = occurrences(latest, needle);
  if (hits.length === 0) return { status: 'conflict', reason: 'span-missing' };
  if (hits.length > 1) return { status: 'conflict', reason: 'span-ambiguous' };
  const at = hits[0] + leading.length;
  return {
    status: 'applied',
    code: `${latest.slice(0, at)}${span.inserted}${latest.slice(at + span.removed.length)}`,
  };
}
