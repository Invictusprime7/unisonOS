/**
 * The site name is only ever what the owner called the site in conversation.
 * Nothing here invents, guesses or derives a name from the prompt's subject:
 * when the owner has not named the site, the answer is `null` and the
 * creation panel asks for one.
 */

const MAX_NAME_LENGTH = 64;
const MAX_NAME_WORDS = 8;

const TRAILING_STOP = /\s+(?:for|with|that|which|where|who|to|and|so|because|in|at|on|about)\b[\s\S]*$/i;
const QUOTES = /^["“”'‘’`]+|["“”'‘’`]+$/g;
const NOT_A_NAME = /^(?:a|an|the|my|our|it|this|that|website|site|web ?site|business|company|brand|store|shop|app|page|something|anything|none|no|n\/a|tbd|not sure|idk|i don'?t know|unsure|whatever|you (?:choose|pick|decide))$/i;

function tidy(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.replace(/\s+/g, ' ').trim();
  const quoted = value.match(/^["“'‘`]([^"”'’`]{1,64})["”'’`]/);
  if (quoted) value = quoted[1];
  value = value.replace(TRAILING_STOP, '').replace(/[.,;:!?)\]]+$/, '').replace(QUOTES, '').trim();
  if (!value || value.length > MAX_NAME_LENGTH) return null;
  if (value.split(' ').length > MAX_NAME_WORDS) return null;
  if (NOT_A_NAME.test(value)) return null;
  return value;
}

const EXPLICIT_NAME_PATTERNS: RegExp[] = [
  /\b(?:site|website|business|brand|company|studio|shop|store|project)(?:'s)? name\s*(?:is|:|=|should be|will be|would be)\s*([^\n.!?;]{1,80})/i,
  /\b(?:call|name)\s+(?:it|the site|the website|my site|my website|the business|my business)\s+([^\n.!?;]{1,80})/i,
  /\b(?:called|named|branded as|known as)\s+([^\n.!?;]{1,80})/i,
];

/** A name the owner stated inside a sentence ("a gym called Iron Haven"). */
export function extractOwnerSiteName(text: string | null | undefined): string | null {
  const source = String(text ?? '');
  let found: string | null = null;
  for (const line of source.split('\n')) {
    for (const pattern of EXPLICIT_NAME_PATTERNS) {
      const name = tidy(line.match(pattern)?.[1]);
      if (name) { found = name; break; }
    }
  }
  return found;
}

const ANSWER_PREFIX = /^(?:(?:it'?s|it is|its|we'?re|we are|i'?m|our (?:site|business|brand) is)\s+)?(?:(?:called|named)\s+)?|^(?:call it|name it|the name is|its name is|our name is|name:|site name:)\s*/i;

/** A direct answer to "What should the site be called?" ("Iron Haven", "It's called Iron Haven"). */
export function siteNameFromAnswer(answer: string | null | undefined): string | null {
  const text = String(answer ?? '').trim();
  if (!text) return null;
  const explicit = extractOwnerSiteName(text);
  if (explicit) return explicit;
  const firstLine = text.split('\n')[0].replace(ANSWER_PREFIX, '');
  return tidy(firstLine);
}

/** Whether an assistant message asks the owner what the site is called. */
export function asksForSiteName(content: string | null | undefined): boolean {
  return /\b(?:what|how)\b[^?]{0,120}\b(?:called|call it|name(?:d)?)\b[^?]{0,80}\?/i.test(String(content ?? ''))
    && !/\bpage names?\b/i.test(String(content ?? ''));
}

export const SITE_NAME_BRIEF_LABEL = 'Site name:';

/** The owner's site name recorded at the top of a confirmed brief, if any. */
export function siteNameFromBrief(brief: string | null | undefined): string | null {
  const line = String(brief ?? '').match(/^Site name:[ \t]*([^\n]+)/i)?.[1];
  return line?.trim() ? line.trim().slice(0, MAX_NAME_LENGTH) : null;
}
