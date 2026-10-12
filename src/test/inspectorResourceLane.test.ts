import { describe, it, expect } from 'vitest';
import { planInspectorExecution } from '@/services/builder/inspectorPatchExecution';
import { listResources } from '@/services/resources/resourceRegistry';

describe('inspector resource lane (M2)', () => {
  const key = listResources().find((d) => d.kind === 'catalog')!.key;
  const plan = (type: 'set-slot-text' | 'set-slot-asset', value: string) => ({
    ok: true as const, pagePath: '/', description: 'Update title',
    op: { type, sectionId: 's', selector: 'x', slotId: 'title', value },
  });
  it('routes marked text to the saved record', () => {
    const e = planInspectorExecution(plan('set-slot-text', 'New'), { files: {}, resourceMark: `${key}#r1.name` });
    expect(e).toMatchObject({ kind: 'resource', ref: { recordId: 'r1', field: 'name' }, values: { name: 'New' } });
  });
  it('routes marked media to the image field by default', () => {
    const e = planInspectorExecution(plan('set-slot-asset', 'https://x/y.png'), { files: {}, resourceMark: `${key}#r1` });
    expect(e).toMatchObject({ kind: 'resource', values: { image: 'https://x/y.png' } });
  });
  it('unmarked selections keep the source lane', () => {
    const e = planInspectorExecution(plan('set-slot-text', 'New'), { files: {} });
    expect(e.kind).not.toBe('resource');
  });
});
