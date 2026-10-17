/**
 * Intent invariant: a UI edit may restyle, move or reword a button, but a
 * button that keeps its intent must keep its destination. Pure check over
 * source text — run before every AI commit.
 */

const TAG_RE = /<[A-Za-z][^<>]*?data-ut-intent=["']([^"']+)["'][^<>]*?>/g;
const TARGET_RE = /data-ut-(?:target-page-id|path|target)=["']([^"']+)["']|\bhref=["']([^"']+)["']|\bto=["']([^"']+)["']/;

export type IntentTargets = Map<string, Set<string>>;

/** intent → set of literal destinations, across all source files. */
export function collectIntentTargets(files: Record<string, string>): IntentTargets {
  const out: IntentTargets = new Map();
  for (const [path, src] of Object.entries(files)) {
    if (!/\.(t|j)sx?$/.test(path) || typeof src !== 'string') continue;
    for (const m of src.matchAll(TAG_RE)) {
      const t = TARGET_RE.exec(m[0]);
      const target = t ? (t[1] ?? t[2] ?? t[3]) : '';
      if (!target) continue;
      const set = out.get(m[1]) ?? new Set<string>();
      set.add(target);
      out.set(m[1], set);
    }
  }
  return out;
}

export interface IntentViolation {
  intent: string;
  before: string[];
  after: string[];
}

/**
 * Flags intents whose destinations were all replaced. Removing a button
 * entirely, or adding new destinations, is allowed.
 */
export function findIntentRetargets(
  before: Record<string, string>,
  after: Record<string, string>,
): IntentViolation[] {
  const a = collectIntentTargets(before);
  const b = collectIntentTargets(after);
  const violations: IntentViolation[] = [];
  a.forEach((targets, intent) => {
    const next = b.get(intent);
    if (!next || next.size === 0) return;
    const kept = [...targets].some((t) => next.has(t));
    if (!kept) violations.push({ intent, before: [...targets], after: [...next] });
  });
  return violations;
}

/**
 * Edit policy: a destination change the user asked for is intended. True when
 * the request talks about links/destinations, or names one of the new targets.
 */
export function isRequestedRetarget(prompt: string | undefined | null, violation: IntentViolation): boolean {
  const text = (prompt ?? '').toLowerCase();
  if (!text) return false;
  if (/\b(link|links|point|points|go(?:es)? to|navigate|redirect|destination|href|send (?:people|visitors|users) to|open(?:s)? the)\b/.test(text)) return true;
  return violation.after.some((target) => {
    const slug = target.replace(/^[#/]+/, '').split(/[/?#]/)[0].toLowerCase();
    return slug.length > 2 && text.includes(slug);
  });
}
