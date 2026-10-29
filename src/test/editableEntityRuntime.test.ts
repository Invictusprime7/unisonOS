import { describe, expect, it } from 'vitest';
import { compileCatalogToolCalls } from '@/services/catalogToolExecutor';
import { buildSystemGraph } from '@/services/agent-runtime/systemGraph';
import { resolveEditableEntity } from '@/services/agent-runtime/editableOwnershipResolver';
import { verifyEditableEntityChange } from '@/services/agent-runtime/semanticVerification';
import { refreshDataOperationResources } from '@/services/dataOperationRefresh';

describe('canonical editable entity runtime', () => {
  it('compiles catalog tools into a data proposal without executing it', () => {
    const proposal = compileCatalogToolCalls([{
      id: 'call-1', name: 'updateCatalogRow',
      arguments: { surfaceId: 'products', rowId: 'product-1', patch: { price: 42 } },
    }]);
    expect(proposal.rejected).toEqual([]);
    expect(proposal.dataOps).toEqual([{
      type: 'updateRow', operationId: 'call-1', surfaceId: 'products', rowId: 'product-1', patch: { price: 42 },
    }]);
  });

  it('resolves a stamped catalog property before source ownership', () => {
    const graph = buildSystemGraph({ '/src/pages/Home.tsx': 'export default function Home(){ return <main /> }' });
    const entity = resolveEditableEntity({
      graph,
      selectedElement: { sourceTable: 'products', rowId: 'product-1', field: 'price', componentPath: '/src/pages/Home.tsx' },
    });
    expect(entity.resource).toMatchObject({
      resourceKey: 'products', kind: 'catalog', catalogKind: 'product', recordId: 'product-1', field: 'price',
    });
    expect(entity.owners.price).toMatchObject({ kind: 'catalog-row', table: 'products', rowId: 'product-1' });
    expect(entity.owners.source).toBeUndefined();
    expect(entity.kind).toBe('catalog');
    expect(entity.allowedMutationLanes).toEqual(['dataOps']);
  });

  it.each([
    ['booking', 'services', 'service-1', 'price_cents', 'services'],
    ['restaurant', 'menu_items', 'menu-1', 'name', 'menu'],
    ['commerce', 'products', 'product-1', 'price', 'products'],
    ['contractor', 'services', 'quote-1', 'description', 'services'],
    ['portfolio', 'portfolio_projects', 'project-1', 'title', 'portfolio'],
  ])('resolves the %s catalog target through its registered owner', (_industry, sourceTable, rowId, field, surfaceId) => {
    const graph = buildSystemGraph({ '/src/pages/Home.tsx': 'export default function Home(){ return <main /> }' });
    const entity = resolveEditableEntity({ graph, selectedElement: { sourceTable, rowId, field } });
    expect(entity).toMatchObject({
      kind: 'catalog',
      provenance: { catalogSurface: surfaceId },
      owners: { [field]: { kind: 'catalog-row', table: sourceTable, rowId } },
    });
    expect(entity.allowedMutationLanes).toEqual(['dataOps']);
  });

  it('refuses an unregistered catalog table instead of exposing a raw database lane', () => {
    const graph = buildSystemGraph({ '/src/pages/Home.tsx': 'export default function Home(){ return <main /> }' });
    expect(() => resolveEditableEntity({ graph, selectedElement: { sourceTable: 'profiles', rowId: 'user-1' } }))
      .toThrow('is not registered for editable data operations');
  });

  it('classifies topology, behavior, presentation, and content selections into their permitted lanes', () => {
    const graph = buildSystemGraph({ '/src/pages/Home.tsx': 'export default function Home(){ return <main /> }' });
    expect(resolveEditableEntity({ graph, selectedElement: { clickedTag: 'a', targetPath: '/', pagePath: '/src/pages/Home.tsx' } }).kind).toBe('topology');
    expect(resolveEditableEntity({ graph, selectedElement: { primaryIntent: 'booking.create', pagePath: '/src/pages/Home.tsx' } }).allowedMutationLanes).toEqual(['bindingOps']);
    expect(resolveEditableEntity({ graph, selectedElement: { clickedTag: 'img', pagePath: '/src/pages/Home.tsx', selector: 'img' } }).allowedMutationLanes).toEqual(['presentationOps', 'fileOps']);
    expect(resolveEditableEntity({ graph, selectedElement: { clickedTag: 'h1', pagePath: '/src/pages/Home.tsx', selector: 'h1' } }).kind).toBe('content');
  });

  it('creates canonical IDs and resolves component and registry aliases', () => {
    const graph = buildSystemGraph({ '/src/pages/Contact.tsx': 'export default function Contact(){ return <main /> }' });
    const entity = resolveEditableEntity({
      graph,
      selectedElement: {
        pagePath: '/src/pages/Contact.tsx',
        sectionId: 'contact-form',
        componentType: 'intent-contact-form',
        componentInstanceId: 'contact-1',
        registryKey: 'ContactForm',
      },
    });
    expect(entity.id).toBe('entity:component:%2Fsrc%2Fpages%2FContact.tsx:contact-form:contact-1');
    expect(entity.componentType).toBe('contact-form');
    expect(entity.artifactId).toBe('contact');
    expect(entity.provenance.registryKey).toBe('ContactForm');
  });

  it('does not create an entity with a fabricated unknown ID', () => {
    const graph = buildSystemGraph({ '/src/pages/Home.tsx': 'export default function Home(){ return <main /> }' });
    expect(() => resolveEditableEntity({ graph, selectedElement: { clickedTag: 'h1' } }))
      .toThrow('has no canonical identity');
  });

  it('rejects a stale selected entity rather than targeting a newer revision', () => {
    const graph = buildSystemGraph({ files: { '/src/pages/Home.tsx': 'export default function Home(){ return <main /> }' }, revisionId: 'revision-new' });
    expect(() => resolveEditableEntity({ graph, selectedElement: { revisionId: 'revision-old' } }))
      .toThrow('Selected entity is stale');
  });

  it('projects provenance entities into ownership graph relationships', () => {
    const graph = buildSystemGraph({
      '/src/pages/Home.tsx': '<section data-ut-section-id="featured"><div data-ut-entity-id="product-card" data-ut-source-table="products" data-ut-row-id="p-1" data-ut-field="name" /></section>',
    });
    expect(graph.entities).toHaveLength(1);
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'product-card', to: 'table:products', kind: 'data_from' }),
      expect.objectContaining({ from: 'product-card', to: 'column:products.name', kind: 'field_from' }),
    ]));
  });

  it('derives stable graph entity IDs for legacy markup without explicit IDs', () => {
    const first = buildSystemGraph({
      '/src/pages/Home.tsx': '<button data-ut-intent="booking.create" data-ut-role="primary-action">Book</button>',
    });
    const shifted = buildSystemGraph({
      '/src/pages/Home.tsx': '<!-- layout change -->\n<button data-ut-intent="booking.create" data-ut-role="primary-action">Book</button>',
    });
    expect(first.entities[0].id).toBe(shifted.entities[0].id);
    expect(first.entities[0].id).not.toContain('unknown');
  });

  it('projects component, registry, navigation, and intent ownership for a rendered action', () => {
    const graph = buildSystemGraph({
      '/src/pages/Home.tsx': `<section data-ut-section-id="hero"><a data-ut-entity-id="hero-cta" data-ut-component-type="HeroCTA" data-ut-component-id="hero-1" data-ut-registry-key="cta:editorial" data-ut-role="primary-action" data-ut-intent="booking.create" href="/booking">Book now</a></section>`,
    });
    expect(graph.entities[0]).toMatchObject({
      id: 'hero-cta', componentType: 'HeroCTA', componentInstanceId: 'hero-1',
      registryKey: 'cta:editorial', elementRole: 'primary-action', intent: 'booking.create', targetPath: '/booking',
    });
    expect(graph.edges).toEqual(expect.arrayContaining([
      { from: 'hero-cta', to: 'component:HeroCTA', kind: 'instance_of' },
      { from: 'hero-cta', to: 'registry:cta:editorial', kind: 'implements' },
      { from: 'hero-cta', to: 'intent:booking.create', kind: 'emits' },
      { from: 'hero-cta', to: 'route:/booking', kind: 'navigates_to' },
    ]));
  });

  it('requires the requested property value after a change', () => {
    const entity = { id: 'entity:product-1', kind: 'catalog' as const, revisionId: 'r1', intents: [], owners: {}, permissions: { readable: true, writable: true }, allowedMutationLanes: ['dataOps' as const], provenance: {} };
    expect(verifyEditableEntityChange({
      beforeEntity: entity, afterEntity: entity,
      expectedChanges: { price: 42 }, actualValues: { price: 42 },
    }).ok).toBe(true);
  });

  it('emits one typed resource invalidation only for applied data operations', () => {
    let received: any = null;
    const listener = (event: Event) => { received = (event as CustomEvent).detail; };
    window.addEventListener('unison:catalog-data-changed', listener);
    const refreshed = refreshDataOperationResources({
      projectId: 'project-1',
      results: [{
        operationId: 'op-1', type: 'updateRow', status: 'applied', message: 'ok',
        surfaceId: 'products', sourceTable: 'products', rowId: 'product-1', bindingId: 'binding-1',
      }],
    });
    window.removeEventListener('unison:catalog-data-changed', listener);
    expect(refreshed).toBe(true);
    expect(received).toMatchObject({
      type: 'RESOURCE_INVALIDATED', projectId: 'project-1', resourceType: 'catalog', operationIds: ['op-1'],
      surfaceIds: ['products'], sourceTables: ['products'], rowIds: ['product-1'], bindingIds: ['binding-1'],
    });
  });
});
