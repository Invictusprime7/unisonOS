import { describe, expect, it } from 'vitest';
import { installationFailureMessage } from '@/marketplace/installationFailure';

describe('marketplace installation failure classification', () => {
  it('reports failed authoring rather than validation of unfinished pages', () => {
    const message = installationFailureMessage({
      stopReason: 'provider-error',
      candidate: { diagnostics: ['Gemini timeout', 'home.tsx requires a section model'] },
      outcomes: [{ status: 'failed', reason: 'provider', errors: ['gemini-3.8-flash: timeout | GPT-4.1: You have no credits remaining. No managed AI gateway fallback is configured.'] }],
    });
    expect(message).toContain('Gemini did not finish');
    expect(message).toContain('backup reported insufficient credits');
    expect(message).toContain('backup is not configured');
    expect(message).not.toContain('section model');
  });
  it('does not invent timeout or credit causes without matching evidence', () => {
    const message = installationFailureMessage({ stopReason: 'provider-error', candidate: { diagnostics: ['Service unavailable'] } });
    expect(message).toContain('Service unavailable');
    expect(message).not.toContain('Gemini');
    expect(message).not.toContain('credits');
  });
  it('retains actual validation failures and removes duplicate diagnostics', () => {
    const message = installationFailureMessage({ stopReason: 'validation-failed', candidate: { diagnostics: ['Missing section identity', 'Missing section identity'] } });
    expect(message.split('Missing section identity')).toHaveLength(2);
  });
});