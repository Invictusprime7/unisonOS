import { describe, expect, it } from 'vitest';
import { affinityReply, affinityReplyParagraphs } from '@/components/creatives/web-builder/ai-chat/affinityReply';

describe('Affinity public explanation delivery', () => {
  it('preserves the Composer explanation instead of substituting a candidate notice', () => {
    const summary = 'You want a taller hero and blue controls.\n\nThe shared theme and hero source need separate edits.\n\nThe candidate includes both edits.\n\nReview the saved preview next.';
    expect(affinityReply(summary)).toBe(summary);
    expect(affinityReplyParagraphs(affinityReply(summary))).toEqual(summary.split('\n\n'));
  });
  it('does not promote tagged private model thinking into public explanation', () => {
    expect(affinityReply('<thinking>Private deliberation</thinking>\n\nThe candidate updates the hero.')).toBe('The candidate updates the hero.');
  });
  it('preserves non-English public explanations', () => {
    expect(affinityReply('أريد تحديث الصفحة.\n\nيمكن تعديل العنوان.')).toBe('أريد تحديث الصفحة.\n\nيمكن تعديل العنوان.');
  });
  it('keeps the public description without an unverified model success claim', () => {
    expect(affinityReply('Changes have been applied.\n\nThe candidate updates the hero.')).toBe('The candidate updates the hero.');
  });
});
