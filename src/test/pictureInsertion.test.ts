import { describe, it, expect } from 'vitest';
import { insertImageIntoElement, coverBackgroundStyles, openingTagEnd } from '@/components/creatives/web-builder/pictureInsertion';

const bounds = (src: string) => { const s = src.indexOf('<article'); return s < 0 ? null : { start: s, end: src.indexOf('</article>') + 10 }; };

describe('pictureInsertion', () => {
  it('inserts an image as the first child', () => {
    const src = `<div>\n  <article className={cn("a", x > 1 && "b")} data-k="1">\n    <h3>Card</h3>\n  </article>\n</div>`;
    const out = insertImageIntoElement(src, 'article', 'https://x/y.png', 'Card "one"', bounds)!;
    expect(out).toContain('data-k="1">\n    <img src="https://x/y.png" alt="Card &quot;one&quot;"');
    expect(out).toContain('<h3>Card</h3>');
  });
  it('refuses self-closing elements', () => {
    expect(openingTagEnd('<article />', 0)).toBe(-1);
  });
  it('adds a shade only when asked', () => {
    expect(coverBackgroundStyles('u', true).backgroundImage).toMatch(/^linear-gradient/);
    expect(coverBackgroundStyles('u', false).backgroundImage).toBe('url("u")');
  });
});
