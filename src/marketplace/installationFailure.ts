export interface InstallationFailure {
  stopReason: string;
  candidate: { diagnostics?: readonly string[] };
  outcomes?: ReadonlyArray<{ status: string; reason?: string; errors: readonly string[] }>;
}

/** Keep failed authoring separate from validation of unfinished reference pages. */
export function installationFailureMessage(result: InstallationFailure): string {
  const terminal = result.outcomes?.filter(outcome => outcome.status !== 'authored'
    && ['credits', 'denied', 'provider', 'rate_limited', 'invalid_response', 'aborted'].includes(outcome.reason ?? '')) ?? [];
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
    if (/gemini[^\n]*?timeout|gemini[^\n]*?timed out/i.test(evidence)) issues.push('Gemini did not finish before the request timed out.');
    if (!issues.length && /Configured providers: none/i.test(evidence)) issues.push('No AI key is available on the backend for this request.');
    if (/No managed AI gateway fallback is configured|managed AI gateway secret/i.test(evidence)) issues.push('The built-in AI backup is not set up on the backend, so it could not take over.');
    return `The AI request failed before the template could be installed. Nothing was saved. ${issues.length ? issues.join(' ') : details.join(' ') || 'The AI service did not return a usable response.'}`;
  }
  return `App Builder could not prepare this template: ${details.join(' ') || result.stopReason}`;
}