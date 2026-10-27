import { describe, expect, it } from 'vitest';
import { selectedSourceFinder, mutateSelectedStructure } from '@/components/creatives/web-builder/selectedSourceMutation';
import { mutateJSXStyles, mutateJSXText } from '@/utils/jsxElementMutation';

const source = 'export default () => <main>\n<section data-component="intent-newsletter">First</section>\n<section data-component="intent-newsletter">Second</section>\n</main>;';
const selector = '[data-component="intent-newsletter"]';
const selection = { tagName: 'section', descriptor: { sourceLocator: '/src/components/News.tsx:3:1' } };

describe('selected source edits', () => {
  it('deletes the exact clicked imported section instead of the first matching selector', () => {
    const result = mutateSelectedStructure(source, selector, 'delete', selectedSourceFinder(selection));
    expect(result).toContain('First');
    expect(result).not.toContain('Second');
  });
  it('updates text and styles on the located second section', () => {
    const finder = selectedSourceFinder(selection);
    expect(mutateJSXText(source, selector, 'Changed', finder)).toContain('>First</section>\n<section data-component="intent-newsletter">Changed</section>');
    expect(mutateJSXStyles(source, selector, { display: 'none' }, finder)).toContain('>First</section>\n<section data-component="intent-newsletter" style=');
  });
  it('moves adjacent JSX siblings without swallowing earlier siblings', () => {
    const moved = mutateSelectedStructure(source, selector, 'up', selectedSourceFinder(selection));
    expect(moved).toContain('>Second</section>\n<section data-component="intent-newsletter">First</section>');
  });
  it('does not fall back to a matching selector for a stale or protected locator', () => {
    for (const locator of ['/src/components/News.tsx:3:2', 'bad', '/src/unison/News.tsx:3:1']) {
      expect(mutateSelectedStructure(source, selector, 'delete', selectedSourceFinder({ ...selection, descriptor: { sourceLocator: locator } }))).toBeNull();
    }
  });
  it('allows container styling with dynamic children but refuses literal text replacement', () => {
    const dynamic = 'export default () => <main><section>{title}</section></main>;';
    const finder = selectedSourceFinder({ tagName: 'section', descriptor: { sourceLocator: '/src/pages/Home.tsx:1:28' } });
    expect(mutateJSXStyles(dynamic, 'section', { display: 'none' }, finder)).toContain("display: 'none'");
    expect(mutateJSXText(dynamic, 'section', 'Changed', finder)).toBeNull();
  });
});