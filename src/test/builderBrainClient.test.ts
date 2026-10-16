import { describe, expect, it } from 'vitest';
import {
  MAX_BUILDER_GATEWAY_TIMEOUT_MS,
  clampBuilderGatewayTimeout,
  builderEdgeErrorMessage,
  getShortRateLimitRetryMs,
  isProviderTimeoutError,
  isRateLimitError,
  isTransportError,
  isBuilderProviderUnavailable,
  shouldOfferBuilderProviderRetry,
} from '@/services/builderBrainClient';

describe('builder brain rate-limit retry', () => {
  it('retains the edge provider trail when a provider chain fails', () => {
    expect(builderEdgeErrorMessage({
      error: 'AI providers failed to produce a response.',
      details: 'All AI providers failed. Last errors: Gemini composer: timeout.',
    }, 500)).toContain('Gemini composer: timeout');
  });

  it('does not append duplicate edge error detail', () => {
    expect(builderEdgeErrorMessage({ error: 'AI request failed.', details: 'AI request failed.' }, 500))
      .toBe('AI request failed.');
  });

  it('recognizes provider exhaustion without confusing missing configuration for transient outage', () => {
    expect(isBuilderProviderUnavailable('All AI providers failed. Last errors: Gemini timeout.')).toBe(true);
    expect(isBuilderProviderUnavailable('AI service unavailable — all models are busy.')).toBe(true);
    expect(isBuilderProviderUnavailable('AI service not configured. Set project secrets.')).toBe(false);
  });

  it('offers retry only when the original request payload can be reconstructed', () => {
    const unavailable = 'AI service unavailable — all models are busy.';
    expect(shouldOfferBuilderProviderRetry(unavailable, 0)).toBe(true);
    expect(shouldOfferBuilderProviderRetry(unavailable, 1)).toBe(false);
    expect(shouldOfferBuilderProviderRetry('AI service not configured.', 0)).toBe(false);
  });

  it('uses a short default delay when Lane B does not provide Retry-After', () => {
    expect(getShortRateLimitRetryMs(null)).toBe(750);
  });

  it('honors a short Retry-After value and refuses long delays', () => {
    expect(getShortRateLimitRetryMs('1')).toBe(1_000);
    expect(getShortRateLimitRetryMs('3')).toBeNull();
  });

  it('parses a short Retry-After HTTP date', () => {
    const now = Date.parse('2026-07-20T00:00:00.000Z');
    expect(getShortRateLimitRetryMs('Mon, 20 Jul 2026 00:00:02 GMT', now)).toBe(2_000);
  });

  it('keeps provider-chain rate limits distinct from retryable transport failures', () => {
    const rateLimit = Object.assign(new Error('Rate limit exceeded'), { context: { status: 429 } });
    expect(isRateLimitError(rateLimit)).toBe(true);
    expect(isTransportError(rateLimit)).toBe(false);
  });

  it('recognizes a provider timeout as batch-recoverable without treating it as transport', () => {
    const providerTimeout = Object.assign(
      new Error('AI providers failed to produce a response.'),
      { context: { status: 500, body: 'Gemini 2.5 Flash: Provider attempt timed out' } },
    );

    expect(isProviderTimeoutError(providerTimeout)).toBe(true);
    expect(isTransportError(providerTimeout)).toBe(false);
  });

  it('recognizes the Builder client deadline as batch-recoverable', () => {
    expect(isProviderTimeoutError(
      new DOMException('Builder turn deadline exceeded', 'TimeoutError'),
    )).toBe(true);
  });
});

describe('builder brain gateway timeout contract', () => {
  it('preserves the Wizard provider window below the Edge request-schema maximum', () => {
    expect(MAX_BUILDER_GATEWAY_TIMEOUT_MS).toBe(135_000);
    expect(clampBuilderGatewayTimeout(140_000, 150_000)).toBe(MAX_BUILDER_GATEWAY_TIMEOUT_MS);
    expect(clampBuilderGatewayTimeout(132_000, 140_000)).toBe(132_000);
  });

  it('leaves a five-second client abort buffer without dropping below the schema minimum', () => {
    expect(clampBuilderGatewayTimeout(60_000, 50_000)).toBe(45_000);
    expect(clampBuilderGatewayTimeout(1_000, 4_000)).toBe(5_000);
  });
});
