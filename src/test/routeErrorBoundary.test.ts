import { describe, expect, it, vi } from 'vitest';
import { isDynamicImportFailure, RouteErrorBoundary } from '@/components/RouteErrorBoundary';

vi.mock('@/services/auditLogger', () => ({ auditLogger: { logSecurityEvent: vi.fn() } }));

describe('route dynamic import recovery', () => {
  it('reports chunk failure rather than silently reloading', () => {
    const onError = vi.fn();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boundary = new RouteErrorBoundary({ children: null, onError });
    const error = new TypeError('Failed to fetch dynamically imported module');
    boundary.componentDidCatch(error, { componentStack: '' });
    expect(onError).toHaveBeenCalledWith(error, { componentStack: '' });
    log.mockRestore();
  });
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