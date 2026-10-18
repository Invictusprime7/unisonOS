import { describe, expect, it } from 'vitest';
import { mayMaterializeSeed } from '@/services/editor/executors/resourceExecutor';
const ref = (resourceKey: string, recordId: string) => ({ resourceKey, kind: 'catalog', recordId } as never);
describe('first-edit record creation guard', () => {
  it('allows a generated seed slug on a collection', () => expect(mayMaterializeSeed(ref('products', 'linen-shirt'))).toBe(true));
  it('refuses an unmatched saved-style UUID', () => expect(mayMaterializeSeed(ref('products', '11111111-2222-3333-4444-555555555555'))).toBe(false));
  it('refuses malformed identities', () => expect(mayMaterializeSeed(ref('products', 'bad id!'))).toBe(false));
  it('refuses unknown resources', () => expect(mayMaterializeSeed(ref('not-a-resource', 'x'))).toBe(false));
  it('refuses the single-record business profile', () => expect(mayMaterializeSeed(ref('business-profile', 'main'))).toBe(false));
});
