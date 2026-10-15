import { describe, expect, it } from 'vitest';
import { BUILT_IN_RECIPE_PACKS, resolveBuiltInRecipePack, resolvePersistedRecipePack } from '@/services/recipeManagerService';

describe('resolvePersistedRecipePack', () => {
  const salon = BUILT_IN_RECIPE_PACKS.find((pack) => pack.id === 'salon-starter')!;

  it('maps a built-in pack to its known legacy database key despite duplicate industry rows', () => {
    const resolved = resolvePersistedRecipePack(salon.id, salon, [
      { pack_id: 'salon_basic', name: 'Salon Essentials', industry: 'salon' },
      { pack_id: 'legacy-uuid-row', name: 'Older Salon Pack', industry: 'salon' },
    ]);

    expect(resolved?.pack_id).toBe('salon_basic');
  });

  it('prefers an exact persisted pack id over an industry fallback', () => {
    const resolved = resolvePersistedRecipePack(salon.id, salon, [
      { pack_id: 'salon-starter', name: 'Salon Starter', industry: 'salon' },
      { pack_id: 'salon_basic', name: 'Legacy Salon', industry: 'salon' },
    ]);

    expect(resolved?.pack_id).toBe('salon-starter');
  });

  it('rejects missing or ambiguous industry matches instead of attempting an FK-invalid insert', () => {
    expect(resolvePersistedRecipePack(salon.id, salon, [])).toBeNull();
    const ecommerce = BUILT_IN_RECIPE_PACKS.find((pack) => pack.id === 'ecommerce-starter')!;
    expect(resolvePersistedRecipePack(ecommerce.id, ecommerce, [
      { pack_id: 'shop_basic', name: 'Shop Essentials', industry: 'ecommerce' },
      { pack_id: 'shop_pro', name: 'Shop Pro', industry: 'ecommerce' },
    ])).toBeNull();
  });
});

describe('resolveBuiltInRecipePack', () => {
  it('normalizes only exact and explicit legacy built-in IDs', () => {
    expect(resolveBuiltInRecipePack('salon_basic')?.id).toBe('salon-starter');
    expect(resolveBuiltInRecipePack('custom-salon-pack')).toBeNull();
  });
});