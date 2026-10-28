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
  if (result.stopReason === 'provider-error') {
    const evidence = details.join(' ');
    const issues: string[] = [];
    if (/gemini[^\n]*?timeout|gemini[^\n]*?timed out/i.test(evidence)) issues.push('Gemini did not finish before the request timed out.');
    if (/no credits remaining|insufficient[_\s-]*(?:quota|credits)|credit balance/i.test(evidence)) issues.push('A configured backup reported insufficient credits.');
    if (/No managed AI gateway fallback is configured/i.test(evidence)) issues.push('The managed AI backup is not configured for this request.');
    return `The AI request failed before the template could be installed. Nothing was saved. ${issues.length ? issues.join(' ') : details.join(' ') || 'The AI service did not return a usable response.'}`;
  }
  return `App Builder could not prepare this template: ${details.join(' ') || result.stopReason}`;
}