import { describe, it, expect, vi } from 'vitest';
import { PlaygroundSyncController } from '../PlaygroundSyncController';

vi.mock('@/services/playgroundHydrator', () => ({
  hydratePlaygroundFromVFS: vi.fn(() => ({
    pageRegistry: { pages: {}, funnels: {}, homePageId: null, version: 1 } as any,
    creatorData: {} as any,
    funnelAutoWired: false,
    stats: {
      pagesDetected: 0,
      productsExtracted: 0,
      servicesExtracted: 0,
      testimonialsExtracted: 0,
      faqsExtracted: 0,
      componentsExtracted: 0,
      funnelSteps: 0,
    },
  })),
  mergeHydrationResult: vi.fn((existing) => existing),
}));

describe('PlaygroundSyncController', () => {
  it('starts with no cached hydration', () => {
    const c = new PlaygroundSyncController();
    expect(c.getLastHydration()).toBeNull();
    expect(c.label).toBe('playground-sync');
  });

  it('caches hydration result and notifies subscribers', () => {
    const c = new PlaygroundSyncController();
    const listener = vi.fn();
    c.subscribe(listener);
    const result = c.hydrateFromVFS([], { '/src/App.tsx': '' });
    expect(result.stats.pagesDetected).toBe(0);
    expect(c.getLastHydration()).toBe(result);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('cannot compile stale projections back into accepted source', () => {
    const c = new PlaygroundSyncController();
    const files = { '/src/pages/Home.tsx': 'export default function Home() { return <h1>Accepted AI edit</h1>; }' };
    c.hydrateFromVFS([], files);
    expect('compile' in c).toBe(false);
    expect(files['/src/pages/Home.tsx']).toContain('Accepted AI edit');
  });

  it('subscribe returns an unsubscribe function', () => {
    const c = new PlaygroundSyncController();
    const listener = vi.fn();
    const unsubscribe = c.subscribe(listener);
    unsubscribe();
    c.hydrateFromVFS([], {});
    expect(listener).not.toHaveBeenCalled();
  });
});
