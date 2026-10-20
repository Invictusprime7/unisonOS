/**
 * builderTransactionState — P0.5 of the canonical closure plan.
 *
 * "Applied" must be a transaction state, not AI prose. The model may describe
 * what it intended to change, but it may never assert that the change landed:
 * only the client transaction layer — after commit + mirror + preview
 * verification — is allowed to emit an authoritative success verdict.
 *
 * This module owns two things and nothing else:
 *   1. the canonical stage vocabulary of a builder mutation transaction;
 *   2. the neutralization of authoritative success language in model prose,
 *      plus the single place where the real verdict line is produced.
 *
 * It adds no writer, no store, and no mutation path.
 */

/** Ordered stages a builder mutation passes through. */
export const BUILDER_TRANSACTION_STAGES = [
  'interpreting',
  'planning',
  'candidate_generated',
  'validating',
  'preview_checking',
  'committing',
  'hydrating_preview',
  'verified',
  'failed',
  'held_for_review',
] as const;

export type BuilderTransactionStage = (typeof BUILDER_TRANSACTION_STAGES)[number];

/** Terminal stages — the only stages that may carry a user-facing verdict. */
export type BuilderTransactionVerdict = 'verified' | 'failed' | 'held-for-review';

/** Neutral wording used before a transaction reaches a terminal stage. */
export const CANDIDATE_GENERATED_NOTICE = 'Generated a candidate patch.';
export const CANDIDATE_STYLESHEET_NOTICE = 'Generated a candidate theme stylesheet.';
export const CANDIDATE_COMPONENT_NOTICE = 'Generated a candidate component.';
export const CANDIDATE_PAGE_NOTICE = 'Generated a candidate page from the model output.';

/** The only authoritative success string in the Builder. */
export const APPLIED_VERDICT_LINE = '✓ Changes applied';
export const FAILED_VERDICT_LINE = '✗ Changes were not applied';
export const HELD_VERDICT_LINE = '⏸ Changes held for review — not applied';

/**
 * Phrases the model likes to emit that claim the edit already landed.
 * They are removed (not rewritten) so the model's real description survives.
 */
const SUCCESS_CLAIM_PATTERNS: RegExp[] = [
  /^[\s>*_-]*(?:\u2705|\u2714\uFE0F?|\u2713|\u{1F389})\s*/gmu,
  /\bsuccessfully\s+applied\b/gi,
  /\bapplied\s+successfully\b/gi,
  /\b(?:and\s+)?applied\s+to\s+(?:your\s+)?(?:project|preview|vfs|site)\b/gi,
  /\bchanges?\s+(?:have\s+been|has\s+been|were|was)\s+applied\b/gi,
  /\b(?:generated|created|updated)\s+and\s+applied\b/gi,
  /\bnow\s+live\s+in\s+(?:your\s+)?preview\b/gi,
];

/**
 * Strip authoritative success claims from model prose. Returns the remaining
 * description, or an empty string when nothing substantive is left — callers
 * then fall back to a neutral candidate notice.
 */
export function neutralizeModelSuccessClaim(text: string | null | undefined): string {
  if (!text) return '';
  let out = text;
  for (const pattern of SUCCESS_CLAIM_PATTERNS) {
    out = out.replace(pattern, ' ');
  }
  out = out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[\s.·•-]+/, '')
    .trim();
  // Nothing meaningful survived (e.g. the whole message was a success badge).
  if (out.replace(/[^A-Za-z0-9]/g, '').length < 3) return '';
  return out;
}

/**
 * Used when the commit already landed as a checkpoint but the preview has
 * not confirmed it. Never say "not applied" here — the save is real.
 */
export const SAVED_UNCONFIRMED_VERDICT_LINE = '◐ Saved as a checkpoint — the preview has not confirmed it yet';

export function savedUnconfirmedVerdictLine(reason?: string): string {
  return reason ? `${SAVED_UNCONFIRMED_VERDICT_LINE} (${reason})` : SAVED_UNCONFIRMED_VERDICT_LINE;
}

/** The authoritative verdict line for a terminal transaction state. */
export function transactionVerdictLine(verdict: BuilderTransactionVerdict, reason?: string): string {
  if (verdict === 'verified') return APPLIED_VERDICT_LINE;
  const base = verdict === 'failed' ? FAILED_VERDICT_LINE : HELD_VERDICT_LINE;
  return reason ? `${base} — ${reason}` : base;
}

/** Append the verdict to a message body without ever duplicating it. */
export function withTransactionVerdict(
  body: string,
  verdict: BuilderTransactionVerdict,
  reason?: string,
): string {
  const line = transactionVerdictLine(verdict, reason);
  if (body.includes(line)) return body;
  const clean = neutralizeModelSuccessClaim(body) || CANDIDATE_GENERATED_NOTICE;
  return `${clean}\n\n${line}`;
}
