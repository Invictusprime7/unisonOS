import { describe, expect, it } from 'vitest';
import { pageCompositionCoverage } from '@/services/app-builder/pageCompositionCoverage';

const page = (types: string[]) => ({ filePath: '/src/pages/Blog.tsx', inspection: { sections: types.map(semanticType => ({ semanticType })) } }) as never;
const plan = (order: string[]) => ({ role: 'blog', target: { sectionOrder: order } }) as never;
const orderErrors = (o: string[], a: string[]) => pageCompositionCoverage(plan(o), page(a)).filter(e => e.includes('planned section order'));

describe('composition target is creative guidance', () => {
  it('accepts author-authored sections after a reordered starting composition', () => {
    expect(orderErrors(['blog-preview'], ['blog-preview', 'cta'])).toEqual([]);
    expect(orderErrors(['blog-preview', 'cta'], ['cta', 'blog-preview', 'features'])).toEqual([]);
  });
  it('does not require optional planned families to survive enrichment', () => {
    expect(orderErrors(['blog-preview', 'cta'], ['blog-preview'])).toEqual([]);
  });
});
