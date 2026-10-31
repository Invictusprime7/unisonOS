import { describe, expect, it } from 'vitest';
import { compilePortableRecipes, DESIGN_SOURCE_ROOT, variantPropHints } from '@/services/app-builder/design/portableRecipeCompiler';
import type { DesignSourceBundle } from '@/services/app-builder/design/DesignSourceBundle';

const ids = ['hero:prisma-cinematic', 'services:editorial-rows', 'gallery:case-study', 'testimonials:vertical-marquee', 'cta:generic-missing', 'navbar:x'];
const bundle = {
  implementations: ids.map((id) => ({ implementationId: id, sectionType: id.split(':')[0] })),
} as unknown as DesignSourceBundle;

describe('portableRecipeCompiler', () => {
  it('retains required content reads beyond the former 6000 character cutoff', () => {
    const source = `var LongSection = ({section}) => { const decoration = "${'x'.repeat(6500)}"; return section.props.items.map(item => item.title + item.description); };`;
    expect(variantPropHints(source, 'LongSection')).toContain('items[]{title|description}');
  });
  it('includes required arrays from multiline section delegation', () => {
    const source = `var Parent = ({section}) => React.createElement(Child, {\n section: section,\n theme: {}\n});\nvar Child = ({section}) => section.props.items.map(item => item.title);`;
    expect(variantPropHints(source, 'Parent')).toContain('items[]{title}');
  });
  const out = compilePortableRecipes(bundle);
  it('emits wrappers + family bundles under the design-source root', () => {
    expect(out.implementationModules['hero:prisma-cinematic']).toBe(`${DESIGN_SOURCE_ROOT}/Hero.tsx`);
    for (const p of ['Hero', 'Services', 'Gallery', 'Testimonials']) {
      expect(out.files[`${DESIGN_SOURCE_ROOT}/${p}.tsx`]).toContain(`./recipes/${p}`);
      expect(out.files[`${DESIGN_SOURCE_ROOT}/recipes/${p}.ts`]).toContain('REGISTERED_VARIANTS');
    }
    expect(out.files[`${DESIGN_SOURCE_ROOT}/theme.ts`]).toContain('THEME');
    expect(Object.keys(out.files).every((p) => p.startsWith(DESIGN_SOURCE_ROOT))).toBe(true);
  });
  it('exposes each variant as a named export on its wrapper', () => {
    expect(out.exportNames['hero:prisma-cinematic']).toBe('HeroPrismaCinematic');
    expect(out.files[`${DESIGN_SOURCE_ROOT}/Hero.tsx`]).toContain('export const HeroPrismaCinematic');
    expect(out.files[`${DESIGN_SOURCE_ROOT}/Hero.tsx`]).toContain('variantId="hero:prisma-cinematic"');
  });
  it('derives required props, marking arrays, from the variant source', () => {
    expect(out.propHints['services:editorial-rows']).toMatch(/headline/);
    expect(out.propHints['services:editorial-rows']).toContain('items[]{title|description');
  });
  it('reports unknown ids and is deterministic', () => {
    expect(out.unresolved).toEqual(expect.arrayContaining(['cta:generic-missing', 'navbar:x']));
    expect(compilePortableRecipes(bundle)).toEqual(out);
    expect(out.modules.every((m) => /\S/.test(m.hash))).toBe(true);
  });
});

import { applyDesignSources, materializeDesignSources, DESIGN_SOURCE_MANIFEST_PATH } from '@/services/app-builder/design/designSourceMaterializer';
import { collectValidImportPaths } from '@/services/builderRegistryContext';

describe('designSourceMaterializer', () => {
  const m = materializeDesignSources(bundle);
  it('writes a manifest and replaces stale design-source files only', () => {
    expect(JSON.parse(m.files[DESIGN_SOURCE_MANIFEST_PATH]).implementations['hero:prisma-cinematic'].modulePath).toBe(`${DESIGN_SOURCE_ROOT}/Hero.tsx`);
    const next = applyDesignSources({ '/src/pages/Home.tsx': 'x', [`${DESIGN_SOURCE_ROOT}/stale.ts`]: 'old' }, m);
    expect(next['/src/pages/Home.tsx']).toBe('x');
    expect(next[`${DESIGN_SOURCE_ROOT}/stale.ts`]).toBeUndefined();
    expect(next[`${DESIGN_SOURCE_ROOT}/Hero.tsx`]).toBeDefined();
  });
  it('keeps design-source entry modules visible beyond the import-path cap', () => {
    const files: Record<string, string> = { ...m.files };
    for (let i = 0; i < 150; i += 1) files[`/src/a/f${String(i).padStart(3, '0')}.ts`] = '';
    const paths = collectValidImportPaths(files);
    expect(paths).toContain(`${DESIGN_SOURCE_ROOT}/Hero.tsx`);
    expect(paths).toContain('@/unison/design-sources/Hero');
  });
});
