import * as Babel from '@babel/standalone';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findElementBoundsInJSX, findUniqueSourceMutation } from '@/components/creatives/web-builder/jsxSourceUtils';
import { mutateJSXText } from '@/utils/jsxElementMutation';

const read = (path: string) => readFileSync(path, 'utf8');

describe('preview selection provenance bridge', () => {
  it('stamps catalog, component, behavior, and revision identity into Sandpack selections', () => {
    const bridge = read('src/utils/sandpackFilePrep.ts');
    for (const attribute of [
      'data-ut-source-table', 'data-ut-row-id', 'data-ut-field',
      'data-ut-component-id', 'data-ut-component-instance-id',
      'data-ut-registry-key', 'data-ut-role', 'data-ut-entity', 'data-ut-source-locator',
    ]) {
      expect(bridge).toContain(attribute);
    }
    expect(bridge).toContain("sourceLocator = cur.getAttribute('data-ut-source-locator')");
    expect(bridge).toContain('revisionId,');
    expect(bridge).toContain("revisionId = typeof data.revisionId === 'string' ? data.revisionId : null;");
  });

  it('keeps newlines escaped inside the generated Preview asset scan script', () => {
    const bridge = read('src/utils/sandpackFilePrep.ts');
    expect(bridge).toContain(".filter(Boolean).join('\\\\n') : '';");
    const bodyLine = bridge.split('\n').find((line) => line.includes('var body = paras.length'));
    expect(bodyLine).toBeDefined();
    const emittedBodyLine = bodyLine!.replace('\\\\n', '\\n');
    expect(() => Babel.transform(emittedBodyLine, { configFile: false, babelrc: false })).not.toThrow();
  });

  it('rejects a stale iframe selection before forwarding it to Builder AI', () => {
    const preview = read('src/components/VFSPreview.tsx');
    const builder = read('src/components/creatives/WebBuilder.tsx');
    const panel = read('src/components/creatives/web-builder/AIBuilderPanel.tsx');
    expect(preview).toContain("data.element.revisionId !== revisionId");
    expect(preview).toContain("revisionId }, '*'");
    expect(builder).toContain('revisionId: el.revisionId');
    expect(panel).toContain('revisionId: selectedTarget.revisionId');
  });

  it('retains the M1 editable-object descriptor through floating toolbar targeting', () => {
    const builder = read('src/components/creatives/WebBuilder.tsx');
    const toolbar = read('src/components/creatives/web-builder/ElementFloatingToolbar.tsx');
    expect(builder).toContain('const descriptor = describeSelection({');
    expect(builder).toMatch(/scopeAncestors: el\.scopeAncestors,\s+descriptor,/);
    expect(toolbar).toContain('descriptorToTarget(element.descriptor)');
  });

  it('routes Playground resource reveal through the validated Preview selection bridge', () => {
    const bridge = read('src/utils/sandpackFilePrep.ts');
    const playground = read('src/components/creatives/web-builder/CreatorPlaygroundModal.tsx');
    const builder = read('src/components/creatives/WebBuilder.tsx');
    expect(bridge).toContain('__unisonPreviewSelectElement');
    expect(bridge).toContain('selectPreviewElement(el)');
    expect(bridge).toContain("type: 'ELEMENT_SELECTED'");
    expect(bridge).toContain('activationKey,');
    expect(playground).toContain('onEditPreview?.()');
    expect(builder).toContain("setBuilderMode('select')");
  });

  it('maps a CSS-escaped slot selector back to its source-owned JSX text', () => {
    const source = '<h1 data-ut-slot="hero.headline">Defining Vision.</h1>';
    const selector = '[data-ut-slot="hero\\.headline"]';

    const updated = mutateJSXText(source, selector, 'Temporary source edit', findElementBoundsInJSX);

    expect(updated).toContain('Temporary source edit');
  });

  it('refuses a selector that matches multiple candidate source files', () => {
    const source = '<h1 data-ut-slot="hero.headline">Original</h1>';
    const result = findUniqueSourceMutation({
      '/src/components/Hero.tsx': source,
      '/src/components/AlternateHero.tsx': source,
    }, '/src/pages/Home.tsx', (code) => mutateJSXText(code, '[data-ut-slot="hero.headline"]', 'Changed', findElementBoundsInJSX));

    expect(result).toEqual({
      kind: 'ambiguous',
      paths: ['/src/components/AlternateHero.tsx', '/src/components/Hero.tsx'],
    });
  });

  it('returns the only matching source file and excludes the active page from fallback search', () => {
    const result = findUniqueSourceMutation({
      '/src/pages/Home.tsx': '<h1 data-ut-slot="hero.headline">Active</h1>',
      '/src/components/Hero.tsx': '<h1 data-ut-slot="hero.headline">Imported</h1>',
    }, '/src/pages/Home.tsx', (code) => mutateJSXText(code, '[data-ut-slot="hero.headline"]', 'Changed', findElementBoundsInJSX));

    expect(result).toMatchObject({ kind: 'match', path: '/src/components/Hero.tsx', before: expect.stringContaining('Imported'), after: expect.stringContaining('Changed') });
  });

  it('uses unique-source resolution for the toolbar VFS fallback', () => {
    const builder = read('src/components/creatives/WebBuilder.tsx');
    expect(builder).toContain('findUniqueSourceMutation(allFiles, activePath, mutate)');
    expect(builder).toContain("match.kind === 'ambiguous'");
    expect(builder).not.toContain('for (const [path, code] of Object.entries(allFiles))');
  });
});
