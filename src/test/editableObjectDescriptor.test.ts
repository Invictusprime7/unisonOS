import { describe, it, expect } from 'vitest';
import { getResource } from '@/services/resources/resourceRegistry';
import { describeSelection, reacquireSelection, descriptorToTarget } from '@/services/editor/editableObjectDescriptor';

const key = ['services', 'catalog:services', 'products'].find((k) => getResource(k)) ?? 'services';

describe('EditableObjectDescriptor (M1)', () => {
  it('identifies repeated resource cards by record, surviving reorder', () => {
    const cards = ['a1', 'b2', 'c3'].map((id, i) => ({ pagePath: '/', sourceLocator: '/src/pages/Home.tsx:40:8', instanceIndex: i, resourceMark: `${key}#${id}.name` }));
    const picked = describeSelection(cards[1]);
    expect(picked.ownerKind).toBe('resource');
    const reordered = [cards[2], cards[0], cards[1]].map((c, i) => ({ ...c, instanceIndex: i }));
    expect(reacquireSelection(picked, reordered)?.descriptor.recordId).toBe('b2');
  });
  it('identifies static repeats by source locator + instance index', () => {
    const items = [0, 1, 2].map((i) => ({ pagePath: '/', sourceLocator: '/src/pages/Home.tsx:60:4', instanceIndex: i }));
    const picked = describeSelection(items[1]);
    expect(picked.ownerKind).toBe('source');
    expect(reacquireSelection(picked, items)?.snapshot.instanceIndex).toBe(1);
    expect(descriptorToTarget(picked).instanceId).toBe(1);
  });
  it('never guesses for unbound or vanished objects', () => {
    const u = describeSelection({ pagePath: '/', tag: 'h2' });
    expect(u.ownerKind).toBe('unbound');
    expect(reacquireSelection(u, [{ pagePath: '/', tag: 'h2' }])).toBeNull();
    const s = describeSelection({ pagePath: '/', sourceLocator: 'x:1:1', instanceIndex: 5 });
    expect(reacquireSelection(s, [{ pagePath: '/', sourceLocator: 'x:1:1', instanceIndex: 0 }])).toBeNull();
  });
});
