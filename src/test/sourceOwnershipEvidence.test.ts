import { describe, it, expect } from 'vitest';
import { findUniqueSourceMutation, selectionEvidence } from '@/components/creatives/web-builder/jsxSourceUtils';

const files = {
  '/src/pages/Shop.tsx': `export default () => <section className="py-24 bg-muted"><div className="card"><h3>Shop the drop</h3></div></section>;`,
  '/src/components/TestimonialsCarousel.tsx': `export default () => <section className="py-24 bg-card"><div className="card"><h3>What clients say</h3><p>Loved the fit</p></div></section>;`,
};
const mutate = (s: string) => s.replace('<div className="card"', '<div className="card" style={{}}');

describe('source ownership for elements without a picture', () => {
  it('is ambiguous without clues', () => {
    expect(findUniqueSourceMutation(files, null, mutate).kind).toBe('ambiguous');
  });
  it('resolves using text runs from the clicked markup', () => {
    const ev = selectionEvidence({ html: '<div class="card"><h3>What clients say</h3><p>Loved the fit</p></div>', textContent: 'What clients sayLoved the fit', attributes: { class: 'card' } });
    const r = findUniqueSourceMutation(files, null, mutate, { evidence: ev });
    expect(r.kind === 'match' && r.path).toBe('/src/components/TestimonialsCarousel.tsx');
  });
});
