import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBrowserCartStorageKey, createBrowserCartManager, readBrowserCart } from '@/runtime/browserCartManager';

describe('browserCartManager', () => {
  const context = {
    businessId: 'biz_test',
    siteId: 'site_test',
    sessionId: 'session_test',
  };

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('adds items and merges duplicate products', async () => {
    const cart = createBrowserCartManager(context);

    await cart.add({ productId: 'prod_1', name: 'Starter Kit', price: 29, quantity: 1 });
    await cart.add({ productId: 'prod_1', name: 'Starter Kit', price: 29, quantity: 2 });

    const stored = await cart.get();
    expect(stored?.items).toHaveLength(1);
    expect(stored?.items[0].quantity).toBe(3);
    expect(stored?.total).toBe(87);
  });

  it('updates and removes items by product id', async () => {
    const cart = createBrowserCartManager(context);

    await cart.add({ productId: 'prod_1', name: 'Starter Kit', price: 29, quantity: 1 });
    await cart.add({ productId: 'prod_2', name: 'Pro Kit', price: 59, quantity: 1 });
    await cart.update('prod_1', 4);
    await cart.remove('prod_2');

    const stored = readBrowserCart(context);
    expect(stored.items).toHaveLength(1);
    expect(stored.items[0].productId).toBe('prod_1');
    expect(stored.items[0].quantity).toBe(4);
    expect(stored.total).toBe(116);
  });
  it('returns the quantity count used by the live bag badge', async () => {
    const cart = createBrowserCartManager(context);
    expect((await cart.add({ productId: 'prod_1', price: 29, quantity: 2 })).itemCount).toBe(2);
    expect((await cart.add({ productId: 'prod_1', price: 29, quantity: 1 })).itemCount).toBe(3);
    expect((await cart.update('prod_1', 4)).itemCount).toBe(4);
    expect((await cart.remove('prod_1')).itemCount).toBe(0);
  });
  it('retains the guest cart after a new tab session and isolates sites', async () => {
    const site = { businessId: 'biz_test', siteId: 'site_test' };
    await createBrowserCartManager(site).add({ productId: 'prod_1', price: 29, quantity: 2 });
    window.sessionStorage.clear();
    expect((await createBrowserCartManager(site).get())?.items[0].quantity).toBe(2);
    expect((await createBrowserCartManager({ ...site, siteId: 'other_site' }).get())?.items).toEqual([]);
  });

  it('uses a stable in-memory session id when local storage is full', () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });

    try {
      expect(buildBrowserCartStorageKey()).toBe(buildBrowserCartStorageKey());
    } finally {
      setItem.mockRestore();
    }
  });
});
