import { describe, expect, it } from 'vitest';
import { pageCompositionCoverage } from '@/services/app-builder/pageCompositionCoverage';

const page = (types: string[]) => ({ filePath: '/src/pages/Blog.tsx', inspection: { sections: types.map(semanticType => ({ semanticType })) } }) as never;
const plan = (order: string[]) => ({ role: 'blog', target: { sectionOrder: order } }) as never;
const orderErrors = (o: string[], a: string[]) => pageCompositionCoverage(plan(o), page(a)).filter(e => e.includes('planned section order'));

describe('page section order', () => {
  it('accepts a distinct extra closing section after the planned ones', () => {
    expect(orderErrors(['blog-preview'], ['blog-preview', 'cta'])).toEqual([]);
  });
  it('rejects a repeated section family', () => {
    expect(orderErrors(['blog-preview'], ['blog-preview', 'blog-preview'])).toHaveLength(1);
  });
  it('rejects a missing or reordered planned section', () => {
    expect(orderErrors(['blog-preview', 'cta'], ['cta', 'blog-preview'])).toHaveLength(1);
    expect(orderErrors(['blog-preview', 'cta'], ['blog-preview'])).toHaveLength(1);
  });
});
