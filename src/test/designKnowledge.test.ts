import { describe, expect, it } from 'vitest';
import { appendDesignKnowledge, DESIGN_KNOWLEDGE, designKnowledgeManifest, selectDesignKnowledge } from '@/services/knowledge/designKnowledge';

describe('curated design knowledge', () => {
  it('always returns creative authority and preservation even without retrieval matches', () => {
    const result = selectDesignKnowledge('');
    expect(result.entries.map(item => item.id)).toEqual(DESIGN_KNOWLEDGE.filter(item => item.scope === 'core-policy').map(item => item.id));
    expect(result.text).toContain('never a whitelist');
    expect(result.text).toContain('untouched bytes');
  });
  it('retrieves inspected ARIA guidance and excludes the superseded placeholder', () => {
    const first = selectDesignKnowledge('salon booking aria');
    expect(first).toEqual(selectDesignKnowledge('salon booking aria'));
    expect(first.entries.some(item => item.id === 'salon-journey')).toBe(true);
    expect(first.entries.some(item => item.id === 'aria-reference')).toBe(false);
    expect(first.omitted).toContainEqual({ id: 'aria-reference', reason: 'inactive' });
    expect(first.entries.some(item => item.id === 'aria-editorial-composition')).toBe(true);
    expect(first.text).toContain('not a mandatory recipe');
    expect(first.text).toContain('no production certification');
  });
  it('includes optional Unison X Loveable references only when selected', () => {
    expect(selectDesignKnowledge('').entries.some(item => item.id === 'unison-loveable-foundations')).toBe(false);

    const selected = selectDesignKnowledge('', 5000, ['unison-loveable-foundations']);
    expect(selected.entries.map(item => item.id)).toContain('unison-loveable-foundations');
    expect(selected.text).toContain('not automatically materialized into a generated project');
    expect(() => selectDesignKnowledge('', 5000, ['missing-reference'])).toThrow('Unknown design reference');
  });
  it('reports budget omissions and refuses to truncate mandatory policy or project briefs', () => {
    const core = selectDesignKnowledge('');
    expect(selectDesignKnowledge('salon', core.text.length).omitted).toContainEqual({ id: 'salon-journey', reason: 'budget' });
    expect(() => selectDesignKnowledge('', 1)).toThrow('mandatory policy');
    expect(() => selectDesignKnowledge('', Number.NaN)).toThrow('mandatory policy');
    expect(() => appendDesignKnowledge('x'.repeat(12000), '')).toThrow('mandatory policy');
    expect(appendDesignKnowledge('Approved project brief', 'salon')).toMatch(/^Approved project brief/);
  });
  it('identifies exact selected content with stable hashes', async () => {
    const selection = selectDesignKnowledge('salon');
    const first = await designKnowledgeManifest(selection);
    expect(first).toEqual(await designKnowledgeManifest(selection));
    expect(first.entries.every(item => /^[a-f0-9]{64}$/.test(item.contentHash))).toBe(true);
    expect(first.contextHash).not.toBe((await designKnowledgeManifest(selectDesignKnowledge('navigation'))).contextHash);
  });
});
