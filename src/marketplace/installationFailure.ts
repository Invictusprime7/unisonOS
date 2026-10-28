export interface InstallationFailure {
  stopReason: string;
  candidate: { diagnostics?: readonly string[] };
  outcomes?: ReadonlyArray<{
    status: string;
    reason?: string;
    errors: readonly string[];
    page?: { title?: string };
    draftProduced?: boolean;
  }>;
}

const TERMINAL_REASONS = ['credits', 'denied', 'provider', 'rate_limited', 'invalid_response', 'aborted'];

/** Keep failed authoring separate from validation of unfinished reference pages. */
export function installationFailureMessage(result: InstallationFailure): string {
  const terminal = result.outcomes?.filter(outcome => outcome.status !== 'authored'
    && TERMINAL_REASONS.includes(outcome.reason ?? '')) ?? [];
  const diagnostics = terminal.length
    ? terminal.flatMap(outcome => outcome.errors)
    : result.candidate.diagnostics ?? [];
  const details = [...new Set(diagnostics.map(message => message.trim()).filter(Boolean))].slice(0, 6);
  const terminalReasons = new Set(terminal.map(outcome => outcome.reason));
  if (result.stopReason === 'provider-error' || terminalReasons.has('credits')) {
    const evidence = [...terminal.flatMap(outcome => outcome.errors), ...details].join(' ');
    const issues: string[] = [];
    const geminiCredits = /prepayment credits (?:are )?depleted|ai\.studio|gemini[^|]{0,80}(?:402|out of credit)/i.test(evidence);
    if (geminiCredits) {
      issues.push('Your Gemini key (Google AI Studio) has run out of prepaid credits. Add credits in Google AI Studio, then install again.');
    } else if (terminalReasons.has('credits') || /no credits remaining|insufficient[_\s-]*(?:quota|credits)|credit balance|payment required/i.test(evidence)) {
      issues.push('An AI provider reported insufficient credits. Add credits for that provider, then install again.');
    }
    const timedOut = /timeout|timed out|took too long/i.test(evidence);
    // Gemini answered (and was billed) for these pages; only a follow-up fix round stopped.
    const drafted = terminal.filter(outcome => outcome.draftProduced && outcome.reason !== 'credits');
    const draftedTitles = [...new Set(drafted.map(outcome => outcome.page?.title).filter(Boolean))].slice(0, 4);
    if (drafted.length && !geminiCredits) {
      const where = draftedTitles.length ? ` (${draftedTitles.join(', ')})` : '';
      issues.push(`Gemini did write the pages${where}, but the follow-up round that fixes their layout checks ${timedOut ? 'did not finish in time' : 'did not complete'}, so the install stopped instead of saving an unfinished site. That AI work was used.`);
    } else if (timedOut && /gemini/i.test(evidence)) {
      issues.push('Gemini did not finish before the request timed out.');
    }
    if (!issues.length && /Configured providers: none/i.test(evidence)) issues.push('No AI key is available on the backend for this request.');
    if (/No managed AI gateway fallback is configured|managed AI gateway secret/i.test(evidence)) issues.push('The built-in AI backup is not set up on the backend, so it could not take over.');
    else if (/Managed gateway fallback: 401/i.test(evidence)) issues.push('The built-in AI backup was reached but refused the backend password, so it could not take over. The MANAGED_AI_RELAY_SECRET saved on UNISON must exactly match the one saved on Lovable Cloud.');
    const lead = drafted.length && !geminiCredits
      ? 'The template was not installed. Nothing was saved.'
      : 'The AI request failed before the template could be installed. Nothing was saved.';
    return `${lead} ${issues.length ? issues.join(' ') : details.join(' ') || 'The AI service did not return a usable response.'}`;
  }
  return `App Builder could not prepare this template: ${details.join(' ') || result.stopReason}`;
}
