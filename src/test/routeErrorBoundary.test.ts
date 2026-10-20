import { describe, expect, it } from 'vitest';
import { isDynamicImportFailure } from '@/components/RouteErrorBoundary';

describe('route dynamic import recovery', () => {
  it('identifies Vite dynamic-module fetch failures', () => {
    expect(isDynamicImportFailure(
      new TypeError('Failed to fetch dynamically imported module: http://localhost:8080/src/pages/Index.tsx?t=1'),
    )).toBe(true);
    expect(isDynamicImportFailure('Loading chunk 42 failed.')).toBe(true);
  });

  it('leaves ordinary route errors to the diagnostic boundary', () => {
    expect(isDynamicImportFailure(new Error('Cannot read properties of undefined'))).toBe(false);
  });
});