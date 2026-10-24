import { describe, expect, it } from 'vitest';
import { AUTHORED_MARKETPLACE_TEMPLATES } from '@/marketplace/authoredTemplatePreviews';
import { buildConceptDraftSource } from '@/marketplace/conceptDraftSource';
describe('marketplace concepts are editable draft sources', () => {
  for (const template of AUTHORED_MARKETPLACE_TEMPLATES) it(`preserves ${template.id} authored source and every page`, () => {
    const artifact = buildConceptDraftSource(template);
    expect(artifact.files['/src/marketplace/selectedPreview.tsx']).toContain('export default');
    for (const page of [{ id: 'home' }, ...template.pages]) expect(artifact.files[`/src/pages/${page.id.replace(/[^a-zA-Z0-9]/g, '_')}.tsx`]).toContain('export default function Page');
    expect(Object.values(artifact.files).some(source => source.includes('https://images.unsplash.com'))).toBe(false);
  });
});