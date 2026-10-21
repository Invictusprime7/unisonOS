import { describe, expect, it } from 'vitest';
import { resolveLaunchBusinessCapabilities } from '@/services/launch/launchCapabilities';

describe('resolveLaunchBusinessCapabilities', () => {
  it('declares only the universal profile when no explicit operational goal is supplied', () => {
    expect(resolveLaunchBusinessCapabilities()).toEqual(['business_profile']);
  });

  it('requires an explicit purchase intent before declaring commerce capabilities', () => {
    const capabilities = resolveLaunchBusinessCapabilities({ customerNeeds: ['buy_offer'] });
    expect(capabilities).toEqual(expect.arrayContaining([
      'catalog.products',
      'commerce.cart',
      'commerce.checkout',
      'crm.contacts',
    ]));
  });

  it('allows browsing services without implicitly enabling booking', () => {
    const capabilities = resolveLaunchBusinessCapabilities({ customerNeeds: ['browse_services'] });
    expect(capabilities).toContain('catalog.services');
    expect(capabilities).not.toContain('booking.appointments');
  });
});