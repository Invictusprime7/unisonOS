import { describe, expect, it } from 'vitest';
import { resolveReleaseCoverImage } from '@/marketplace/releaseCoverImage';

describe('published static cover selection', () => {
  it('uses the packaged buyer-supplied placeholder without requesting private original media', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    expect(resolveReleaseCoverImage({
      '/src/Home.tsx': '<img src="/assets/marketplace-placeholder.svg" />',
      '/assets/marketplace-placeholder.svg': svg,
    })).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  });
  it('selects a static published image without executing page source', () => {
    expect(resolveReleaseCoverImage({ '/src/Home.tsx': 'throw new Error(); const cover="https://example.org/cover.webp";' })).toBe('https://example.org/cover.webp');
  });
  it('does not request unresolved local files or unsafe protocols', () => {
    expect(resolveReleaseCoverImage({ '/src/Home.tsx': '<img src="/assets/missing.png"/><img src="javascript:alert(1)"/>' })).toBeUndefined();
  });
});