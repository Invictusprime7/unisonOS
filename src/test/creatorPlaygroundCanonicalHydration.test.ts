import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCreatorPlayground } from '@/hooks/useCreatorPlayground';
import { createEmptyCreatorData } from '@/types/creatorData';
import { createBuilderPage, createEmptyPageRegistry, createFunnelGraph } from '@/types/pageRegistry';

describe('canonical Playground VFS hydration', () => {
  it('replaces inferred state with exact persisted identities without dirtying or appending funnels', () => {
    const pageRegistry = createEmptyPageRegistry();
    pageRegistry.pages['durable-home'] = createBuilderPage('durable-home', 'Studio', '/', 'home');
    pageRegistry.homePageId = 'durable-home';
    pageRegistry.funnels['durable-funnel'] = createFunnelGraph('durable-funnel', 'Booking', []);
    const creatorData = createEmptyCreatorData();
    creatorData.businessInfo.businessName = 'Persisted Studio';
    const runtimeFiles = { '/src/pages/Home.tsx': 'export default function Home() { return <h1>Inferred name</h1>; }' };
    const snapshot = {
      pageRegistry, creatorData, vfsFiles: runtimeFiles,
      meta: {
        themePresetId: 'editorial',
        themeInjection: { version: '1.0', stage: '4b', presetId: 'editorial', cssPath: '/src/index.css' },
        seal: { version: '1.0', sealedAt: '2026-09-08T00:00:00Z', sealedBy: 'wizard-launch', compileArtifactId: 'compile-test', fileCount: 1 },
      },
    };
    const files = { ...runtimeFiles, '/.unison/site-bundle-snapshot.json': JSON.stringify(snapshot) };
    const { result } = renderHook(() => useCreatorPlayground());
    act(() => { result.current.hydrateFromVFS([], runtimeFiles); });
    expect(result.current.isDirty).toBe(false);
    act(() => { result.current.hydrateFromVFS([], files); });
    act(() => { result.current.hydrateFromVFS([], files); });

    expect(result.current.pageRegistry).toEqual(pageRegistry);
    expect(result.current.creatorData).toEqual(creatorData);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.lastHydration?.funnelAutoWired).toBe(false);
    expect(result.current.lastHydration?.stats.pagesDetected).toBe(1);
    expect(JSON.parse(files['/.unison/site-bundle-snapshot.json'])).toEqual(snapshot);
  });

  it('retains inferred hydration for legacy files without a snapshot', () => {
    const { result } = renderHook(() => useCreatorPlayground());
    act(() => { result.current.hydrateFromVFS([], {
      '/src/pages/Home.tsx': 'export default function Home() { return <h1>Legacy</h1>; }',
    }); });
    expect(Object.keys(result.current.pageRegistry.pages)).toEqual(['page_home']);
    expect(result.current.isDirty).toBe(false);
  });
  it('does not erase pending explicit topology edits during compatibility hydration', () => {
    const { result } = renderHook(() => useCreatorPlayground());
    act(() => { result.current.addPage('Requested page', '/requested', 'custom'); });
    expect(result.current.isDirty).toBe(true);
    act(() => { result.current.hydrateFromVFS([], {
      '/src/pages/Home.tsx': 'export default function Home() { return <h1>Legacy</h1>; }',
    }); });
    expect(result.current.isDirty).toBe(true);
    expect(Object.values(result.current.pageRegistry.pages).some((page) => page.path === '/requested')).toBe(true);
  });
});