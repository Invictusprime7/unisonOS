import * as Babel from '@babel/standalone';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findElementBoundsInJSX, findUniqueSourceMutation, countImageLiteral, replaceImageLiteral } from '@/components/creatives/web-builder/jsxSourceUtils';
import { mutateJSXText } from '@/utils/jsxElementMutation';

const read = (path: string) => readFileSync(path, 'utf8');

describe('preview selection provenance bridge', () => {
  it('stamps catalog, component, behavior, and revision identity into Sandpack selections', () => {
    const bridge = read('src/utils/sandpackFilePrep.ts');
    for (const attribute of [
      'data-ut-source-table', 'data-ut-row-id', 'data-ut-field',
      'data-ut-component-id', 'data-ut-component-instance-id', 'data-ut-source-ast',
      'data-ut-source-hash', 'data-ut-source-revision',
      'data-ut-registry-key', 'data-ut-role', 'data-ut-entity', 'data-ut-source-locator',
    ]) {
      expect(bridge).toContain(attribute);
    }
    expect(bridge).toContain("sourceLocator = cur.getAttribute('data-ut-source-locator')");
    expect(bridge).toContain('revisionId,');
    expect(bridge).toContain("revisionId = typeof data.revisionId === 'string' ? data.revisionId : null;");
  });

  it('edits selected plain text in the preview surface instead of the floating toolbar', () => {
    const bridge = read('src/utils/sandpackFilePrep.ts');
    const preview = read('src/components/VFSPreview.tsx');
    const toolbar = read('src/components/creatives/web-builder/ElementFloatingToolbar.tsx');

    expect(bridge).toContain("element.setAttribute('contenteditable', 'true')");
    expect(bridge).toContain("type: 'INLINE_TEXT_EDIT_COMMIT'");
    expect(bridge).toContain("finishInlineTextEdit(false)");
    expect(preview).toContain("type: 'INLINE_TEXT_EDIT_RESULT'");
    expect(preview).toContain('onInlineTextCommit');
    expect(toolbar).not.toContain('Edit Text');
    expect(toolbar).not.toContain('onUpdateText');
  });

  it('carries stable site identity into the selected scope and only offers site scope when known', () => {
    const bridge = read('src/utils/sandpackFilePrep.ts');
    const preview = read('src/components/VFSPreview.tsx');
    const toolbar = read('src/components/creatives/web-builder/ElementFloatingToolbar.tsx');
    const panel = read('src/components/creatives/web-builder/AIBuilderPanel.tsx');

    expect(preview).toContain('revisionId, siteId },');
    expect(bridge).toContain('activeSiteId = typeof data.siteId === \'string\' ? data.siteId : null;');
    expect(bridge).toContain('siteId,');
    expect(toolbar).toContain("...(ancestors.siteId ? ['site' as const] : [])");
    expect(toolbar).toContain("selection: scopeOverride ? 'explicit' : 'auto'");
    expect(panel).toContain('selectedEditScope: selectedTarget?.editScope ?? null');
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
    expect(preview).toContain("revisionId, siteId }, '*'");
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

  it('narrows an ambiguous image match by the current image link, then by the page import graph', () => {
    const img = (src: string) => `<section><img src="${src}" alt="x" /></section>`;
    const mutate = (code: string) => code.includes('<img') ? code.replace(/src="[^"]+"/, 'src="https://new.png"') : null;
    const files = {
      '/src/pages/Home.tsx': "import Hero from '../components/Hero';\nexport default () => <Hero />;",
      '/src/components/Hero.tsx': img('https://hero.png'),
      '/src/pages/Shop.tsx': img('https://shop.png'),
      '/src/components/Testimonials.tsx': img('https://shop.png'),
    };
    expect(findUniqueSourceMutation(files, '/src/pages/Home.tsx', mutate, { evidence: ['https://hero.png'] }))
      .toMatchObject({ kind: 'match', path: '/src/components/Hero.tsx' });
    expect(findUniqueSourceMutation(files, '/src/pages/Home.tsx', mutate, { pagePath: '/src/pages/Home.tsx' }))
      .toMatchObject({ kind: 'match', path: '/src/components/Hero.tsx' });
    expect(findUniqueSourceMutation(files, '/src/pages/Home.tsx', mutate, { evidence: ['https://shop.png'] }))
      .toEqual({ kind: 'ambiguous', paths: ['/src/components/Testimonials.tsx', '/src/pages/Shop.tsx'] });
  });

  it('swaps an image by its exact link only when that link appears once in the site', () => {
    const hero = 'https://cdn.example.com/hero-photo.png';
    const files = {
      '/src/pages/Home.tsx': `<img src="${hero}" alt="hero" />`,
      '/src/pages/Shop.tsx': '<img src={product.image} alt={product.name} />',
      '/src/components/TestimonialsCarousel.tsx': '<img src={current.avatar} />',
    };
    expect(countImageLiteral(files, hero)).toBe(1);
    expect(replaceImageLiteral(files['/src/pages/Home.tsx'], hero, 'https://new.png')).toBe('<img src="https://new.png" alt="hero" />');
    expect(countImageLiteral({ ...files, '/src/pages/About.tsx': `<img src="${hero}" />` }, hero)).toBe(2);
  });

  it('uses unique-source resolution for the toolbar VFS fallback', () => {
    const builder = read('src/components/creatives/WebBuilder.tsx');
    expect(builder).toContain('findUniqueSourceMutation(ownerFiles, activePath, mutate,');
    expect(builder).toContain("match.kind === 'ambiguous'");
    expect(builder).not.toContain('for (const [path, code] of Object.entries(allFiles))');
  });
});
