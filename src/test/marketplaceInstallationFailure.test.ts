import { describe, expect, it } from 'vitest';
import { installationFailureMessage } from '@/marketplace/installationFailure';
import { classifyError } from '@/services/builder/aiRepairLoop';

describe('marketplace installation failure classification', () => {
  it('reports failed authoring rather than validation of unfinished pages', () => {
    const message = installationFailureMessage({
      stopReason: 'provider-error',
      candidate: { diagnostics: ['Gemini timeout', 'home.tsx requires a section model'] },
      outcomes: [{ status: 'failed', reason: 'provider', errors: ['gemini-3.8-flash: timeout | GPT-4.1: You have no credits remaining. No managed AI gateway fallback is configured.'] }],
    });
    expect(message).toContain('Gemini did not finish');
    expect(message).toContain('AI provider reported insufficient credits');
    expect(message).toContain('backup is not set up');
    expect(message).not.toContain('section model');
  });
  it('names depleted Google AI Studio prepaid credits on the Gemini key', () => {
    const message = installationFailureMessage({
      stopReason: 'provider-error',
      candidate: { diagnostics: [] },
      outcomes: [{ status: 'kept-baseline', reason: 'credits', errors: ['AI request failed (credits): gemini-3.8-flash: 402 Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects'] }],
    });
    expect(message).toContain('Gemini key (Google AI Studio) has run out of prepaid credits');
  });
  it('treats a 500-wrapped depleted-credit reply as a terminal credits stop', () => {
    expect(classifyError({ context: { status: 500 }, message: 'gemini-3.8-flash: 402 Your prepayment credits are depleted.' })).toBe('credits');
    expect(classifyError({ context: { status: 500 }, message: 'gemini-3.8-flash: timeout' })).toBe('provider');
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