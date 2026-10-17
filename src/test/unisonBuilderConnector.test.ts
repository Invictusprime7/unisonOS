import { describe, expect, it } from 'vitest';
import { createUnisonBuilderContext, renderUnisonBuilderDirective } from '@/services/unisonBuilderConnector';
import type { BuilderRegistryContext } from '@/services/builderRegistryContext';

describe('enforced Builder context', () => {
  const files = { '/src/pages/Home.tsx': 'export default function Home() { return <main />; }' };

  it('refuses an element from another project before authoring', () => {
    expect(() => createUnisonBuilderContext({ projectId: 'site-a', selection: { projectId: 'site-b' } }))
      .toThrow('another project');
  });

  it('refuses stale selected-element revisions', () => {
    expect(() => createUnisonBuilderContext({ revisionId: 'revision-2', selection: { revisionId: 'revision-1' } }))
      .toThrow('older revision');
  });

  it('names saved-record ownership without rewriting source', () => {
    const context = createUnisonBuilderContext({ files, selection: { resourceMark: 'services#service-1.price' } });
    expect(context.element?.ownerKind).toBe('resource');
    expect(context.element?.resourceMark).toBe('services#service-1.price');
    expect(context.catalog.authority).toBe('agentOperations/ResourceRuntime');
    expect(files['/src/pages/Home.tsx']).toBe('export default function Home() { return <main />; }');
  });

  it('rejects nonexistent existing-file targets and path traversal', () => {
    expect(() => createUnisonBuilderContext({ files, sourceTargets: ['/src/pages/New.tsx'] })).toThrow('missing');
    expect(() => createUnisonBuilderContext({ sourceTargets: ['/src/../private.ts'] })).toThrow('Invalid');
  });

  it('retains hunk-only editing and deterministic router authority', () => {
    const context = createUnisonBuilderContext({ files, sourceTargets: ['/src/pages/Home.tsx', '/src/pages/Home.tsx'] });
    expect(context.sourceTargets).toEqual(['/src/pages/Home.tsx']);
    expect(context.designSystem.existingFiles).toBe('explicit-hunks');
    expect(context.designSystem.newFiles).toBe('complete-source');
    expect(context.designSystem.routerAuthority).toBe('PageRegistry');
    expect(renderUnisonBuilderDirective(context)).toContain('PageRegistry alone authors /src/App.tsx');
  });

  it('fails closed on uncertified registry implementations', () => {
    const registry = { implementations: [{ id: 'hero:experimental', certification: 'experimental' }] } as BuilderRegistryContext;
    expect(() => createUnisonBuilderContext({ registryContext: registry })).toThrow('uncertified');
  });

  it('reports missing context instead of claiming readiness', () => {
    const context = createUnisonBuilderContext({});
    expect(context.unavailable).toEqual(['element', 'catalog', 'registry']);
    expect(context.registry.allowedImplementationIds).toEqual([]);
    expect(context.designSystem.preserveSealedArtDirection).toBe(true);
  });
});