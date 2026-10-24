import { describe, expect, it } from 'vitest';
import { parse } from '@babel/parser';
import { createBuilderPage, createEmptyPageRegistry } from '@/types/pageRegistry';
import { generateCanonicalRouter } from '@/utils/topologyRouterGenerator';

describe('marketplace canonical router identifiers', () => {
  it('parses hyphenated page filenames without dropping basename collisions', () => {
    const registry = createEmptyPageRegistry();
    for (const [index, path] of ['/src/pages/shop-products.tsx', '/src/pages/other/shop-products.tsx', '/src/pages/2026-offers.tsx'].entries()) {
      const id = `page-${index}`;
      registry.pages[id] = createBuilderPage(id, id, index ? `/page-${index}` : '/', 'custom', { filePath: path, isHome: index === 0, navOrder: index });
    }
    const source = generateCanonicalRouter(registry);
    expect(() => parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] })).not.toThrow();
    expect(source).toContain('path="/page-1"');
    expect(source).toContain('path="/page-2"');
    expect(source).toContain('import UnisonPage2');
  });
});