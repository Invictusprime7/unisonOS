import { afterEach, describe, expect, it, vi } from 'vitest';
import { createExternalPreviewSession } from '@/services/externalPreviewSession';

describe('external preview sessions', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stores bootstrap metadata and streams files when the VFS exceeds localStorage quota', () => {
    const stored = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      get length() { return stored.size; },
      key: (index: number) => [...stored.keys()][index] ?? null,
      removeItem: (key: string) => stored.delete(key),
      setItem: (key: string, value: string) => {
        if (Object.keys(JSON.parse(value).files).length > 0) {
          throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
        }
        stored.set(key, value);
      },
    });
    vi.stubGlobal('BroadcastChannel', class {});

    const previewKey = createExternalPreviewSession({ '/src/App.tsx': 'large site source' }, 'Preview');
    const serialized = stored.get(`unison:external-preview:${previewKey}`);

    expect(serialized).toBeTruthy();
    expect(JSON.parse(serialized!).files).toEqual({});
  });

  it('still creates a live preview session when browser storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => { throw new DOMException('Storage access denied', 'SecurityError'); },
    });
    vi.stubGlobal('BroadcastChannel', class {});

    expect(createExternalPreviewSession({ '/src/App.tsx': 'site source' }, 'Preview')).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });
});