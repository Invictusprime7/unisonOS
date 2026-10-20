import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const resourceRuntime = vi.hoisted(() => ({
  applyResourceOp: vi.fn(),
  parseResourceProvenance: vi.fn(),
  queryResource: vi.fn(),
}));

vi.mock('@/services/resources/resourceRuntime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/resources/resourceRuntime')>();
  return { ...actual, ...resourceRuntime };
});

import { getCatalogSurface } from '@/platform/core/catalogSurfaceRegistry';
import { buildScannedCatalogValues, persistScannedCatalogItem } from '@/services/resources/previewAssetScan';

describe('preview asset scan bridge source', () => {
  it('emits a parseable body extraction line from the scanner template', () => {
    const source = readFileSync('src/utils/sandpackFilePrep.ts', 'utf8');
    const prefix = 'const PREVIEW_NAV_BRIDGE = `';
    const start = source.indexOf(prefix);
    const end = source.indexOf('`;', start + prefix.length);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const template = source.slice(start + prefix.length, end);
    expect(template).not.toContain('${');
    const emittedBridge = new Function(`return \`${template}\`;`)() as string;
    const scannerLine = emittedBridge.split('\n').find((line) => line.includes('var body = paras.length'));

    expect(scannerLine).toBeDefined();
    expect(() => new Function(scannerLine!)).not.toThrow();
  });
});

describe('preview asset scan persistence mapping', () => {
  it('adopts a generated pricing slug by its saved identity rather than updating the slug', async () => {
    resourceRuntime.parseResourceProvenance.mockReturnValue({ resourceKey: 'pricing', kind: 'catalog', recordId: 'studio-plan' });
    resourceRuntime.queryResource.mockResolvedValue([{ id: 'saved-plan', name: 'Studio Plan' }]);
    resourceRuntime.applyResourceOp.mockResolvedValue({ id: 'saved-plan' });
    await persistScannedCatalogItem({ kind: 'pricing', businessId: 'business-1', projectId: 'project-1', index: 0, item: { name: 'Studio Plan', description: '', price: '95', image: null, resourceMark: 'pricing#studio-plan' } });
    expect(resourceRuntime.applyResourceOp).toHaveBeenLastCalledWith(expect.objectContaining({ op: 'update', ref: expect.objectContaining({ resourceKey: 'pricing', recordId: 'saved-plan' }), values: expect.objectContaining({ price_cents: 9500 }) }), { businessId: 'business-1', projectId: 'project-1', mode: 'builder' });
  });
  it('persists the full scanned menu schema through Resource Runtime', async () => {
    resourceRuntime.queryResource.mockResolvedValue([]);
    resourceRuntime.parseResourceProvenance.mockReturnValue(null);
    resourceRuntime.applyResourceOp.mockResolvedValue({ id: 'menu-1' });

    await persistScannedCatalogItem({
      kind: 'menu',
      businessId: 'business-1',
      projectId: 'project-1',
      index: 3,
      item: {
        name: 'Ceviche',
        description: 'Fresh fish with lime.',
        price: '$21',
        image: 'https://cdn.example.com/ceviche.jpg',
        fields: { category: 'Mains', dietary_tags: 'pescatarian, dairy-free', featured: true },
      },
    });

    expect(resourceRuntime.applyResourceOp).toHaveBeenCalledWith(
      expect.objectContaining({
        op: 'create',
        resourceKey: 'menu',
        values: expect.objectContaining({
          name: 'Ceviche',
          description: 'Fresh fish with lime.',
          image_url: 'https://cdn.example.com/ceviche.jpg',
          category: 'Mains',
          price_cents: 2100,
          dietary_tags: ['pescatarian', 'dairy-free'],
          featured: true,
          sort_order: 3,
        }),
      }),
      { businessId: 'business-1', projectId: 'project-1', mode: 'builder' },
    );
  });

  it('preserves every schema-supported menu field and converts displayed dollars to cents', () => {
    const surface = getCatalogSurface('menu');
    if (!surface) throw new Error('Menu catalog surface is not registered.');

    const values = buildScannedCatalogValues(surface, {
      name: 'Empanadas de Pipitón',
      description: 'Crispy corn dough with potato.',
      price: '$16',
      image: 'https://cdn.example.com/empanadas.jpg',
      fields: { category: 'Starters', currency: 'usd', dietary_tags: 'gluten-free, vegetarian', sort_order: 9, available: true, featured: true },
    }, 4);

    expect(values).toMatchObject({
      name: 'Empanadas de Pipitón',
      description: 'Crispy corn dough with potato.',
      image_url: 'https://cdn.example.com/empanadas.jpg',
      category: 'Starters',
      dietary_tags: ['gluten-free', 'vegetarian'],
      price_cents: 1600,
      currency: 'usd',
      sort_order: 9,
      available: true,
      featured: true,
    });
    expect(new Set(Object.keys(values))).toEqual(new Set(surface.editableFields.map((field) => field.key)));
    expect(Object.keys(values).every((key) => surface.editableFields.some((field) => field.key === key))).toBe(true);
  });

  it('keeps explicit menu cents values in cents instead of multiplying them again', () => {
    const surface = getCatalogSurface('menu');
    if (!surface) throw new Error('Menu catalog surface is not registered.');
    const values = buildScannedCatalogValues(surface, {
      name: 'Ceviche', description: '', price: '$16', image: null,
      fields: { price_cents: '1600', dietary_tags: ['pescatarian', 'dairy-free'] },
    }, 0);

    expect(values.price_cents).toBe(1600);
    expect(values.dietary_tags).toEqual(['pescatarian', 'dairy-free']);
  });

  it('preserves explicit schema fields while applying safe defaults for omitted values', () => {
    const surface = getCatalogSurface('products');
    if (!surface) throw new Error('Products catalog surface is not registered.');

    const values = buildScannedCatalogValues(surface, {
      name: 'Canvas tote', description: '', price: '$24.50', image: null,
      fields: { inventory_count: 7, is_active: false },
    }, 2);

    expect(values).toMatchObject({ name: 'Canvas tote', price: 24.5, inventory_count: 7, is_active: false, sort_order: 2 });
    expect(values).not.toHaveProperty('unknown_field');
  });
});