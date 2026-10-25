import { describe, expect, it } from 'vitest';
import { AUTHORED_MARKETPLACE_TEMPLATES } from '@/marketplace/authoredTemplatePreviews';
import { buildConceptDraftSource, marketplaceDraftIndustry } from '@/marketplace/conceptDraftSource';
import { parse } from '@babel/parser';
describe('marketplace concepts are editable draft sources', () => {
  for (const template of AUTHORED_MARKETPLACE_TEMPLATES) it(`preserves ${template.id} authored source and every page`, () => {
    const artifact = buildConceptDraftSource(template);
    expect(artifact.files['/src/marketplace/selectedPreview.tsx']).toContain('export default');
    expect(() => parse(artifact.files['/src/App.tsx'], { sourceType: 'module', plugins: ['typescript', 'jsx'] })).not.toThrow();
    for (const page of [{ id: 'home' }, ...template.pages]) expect(artifact.files[`/src/pages/${page.id.replace(/[^a-zA-Z0-9]/g, '_')}.tsx`]).toContain('export default function Page');
    expect(Object.values(artifact.files).some(source => source.includes('https://images.unsplash.com'))).toBe(false);
  });

  it('does not classify boutique lodging as a restaurant', () => {
    expect(marketplaceDraftIndustry('Boutique Lodging')).toBe('agency');
  });
});