import { describe, expect, it } from 'vitest';
import { getCRMNavigationItems, resolveInstalledSiteCapabilities, resolveSystemInstallCapabilityPacks, resolveSystemTypeCapabilityPacks, resolveVisibleCRMView } from '@/services/crmWorkspaceCapabilities';

describe('CRM workspace capability navigation', () => {
  it('keeps only core views when rows are legacy or not installer-stamped', () => {
    const capabilities = resolveInstalledSiteCapabilities([
      { capability_id: 'booking', status: 'enabled', configuration: {} },
      { capability_id: 'booking.appointments', status: 'enabled', configuration: { source: 'legacy', packId: 'booking.appointments' } },
    ]);

    expect(capabilities).toEqual([]);
    expect(getCRMNavigationItems(capabilities).map((item) => item.id)).toEqual([
      'overview', 'contacts', 'activity', 'automations',
    ]);
  });

  it('reveals specialty views only for enabled, matching installer manifests', () => {
    const capabilities = resolveInstalledSiteCapabilities([
      { capability_id: 'booking.appointments', status: 'enabled', configuration: { source: 'capability-migration-apply', manifestVersion: '1.0', packId: 'booking.appointments' } },
      { capability_id: 'crm.leads', status: 'disabled', configuration: { source: 'capability-migration-apply', manifestVersion: '1.0', packId: 'crm.leads' } },
      { capability_id: 'automation.follow_up', status: 'enabled', configuration: { source: 'capability-migration-apply', manifestVersion: '1.0', packId: 'wrong-pack' } },
    ]);

    expect(capabilities).toEqual(['booking.appointments']);
    expect(getCRMNavigationItems(capabilities).map((item) => item.id)).toContain('bookings');
    expect(getCRMNavigationItems(capabilities).map((item) => item.id)).not.toContain('workflows');
  });

  it('exposes leads, forms, pipeline, and workflow views from their installed packs', () => {
    const capabilities = ['crm.leads', 'automation.follow_up'];
    expect(getCRMNavigationItems(capabilities).map((item) => item.id)).toEqual(expect.arrayContaining([
      'overview', 'contacts', 'activity', 'automations', 'leads', 'pipeline', 'workflows', 'recipes', 'forms',
    ]));
  });

  it('composes Salon and ecommerce catalog tabs from installed capabilities', () => {
    const salon = getCRMNavigationItems(['booking.appointments']);
    const ecommerce = getCRMNavigationItems(['commerce.cart']);

    expect(salon.map((item) => item.id)).toContain('services');
    expect(salon.map((item) => item.id)).toContain('bookings');
    expect(ecommerce.map((item) => item.id)).toContain('products');
    expect(ecommerce.map((item) => item.id)).not.toContain('bookings');
    expect(getCRMNavigationItems(['catalog.menu']).map((item) => item.id)).toContain('menu');
  });

  it('resolves backend installation results to canonical, dependency-closed site packs', () => {
    expect(resolveSystemInstallCapabilityPacks(['leads-pack', 'newsletter-pack']).map((pack) => pack.id))
      .toEqual(['business_profile', 'crm.leads']);
    expect(resolveSystemInstallCapabilityPacks(['booking-pack']).map((pack) => pack.id))
      .toEqual(['business_profile', 'catalog.services', 'crm.leads', 'booking.appointments']);
    expect(resolveSystemInstallCapabilityPacks(['ecommerce-pack']).map((pack) => pack.id))
      .toEqual(['business_profile', 'catalog.products', 'commerce.cart', 'crm.leads', 'commerce.checkout']);
  });

  it('resolves existing business system types to canonical site packs without reseeding', () => {
    expect(resolveSystemTypeCapabilityPacks('agency').map((pack) => pack.id))
      .toEqual(['business_profile', 'crm.leads']);
    expect(resolveSystemTypeCapabilityPacks('booking').map((pack) => pack.id))
      .toEqual(['business_profile', 'catalog.services', 'crm.leads', 'booking.appointments']);
    expect(resolveSystemTypeCapabilityPacks('store').map((pack) => pack.id))
      .toEqual(['business_profile', 'catalog.products', 'commerce.cart', 'crm.leads', 'commerce.checkout']);
    expect(resolveSystemTypeCapabilityPacks('unknown')).toEqual([]);
  });

  it('does not infer installed capabilities from absent or unstamped site rows', () => {
    expect(resolveInstalledSiteCapabilities([])).toEqual([]);
    expect(resolveInstalledSiteCapabilities([
      { capability_id: 'crm.leads', status: 'enabled', configuration: { source: 'legacy', packId: 'crm.leads' } },
    ])).toEqual([]);
  });

  it('falls back to Overview when a requested specialty view is not installed', () => {
    expect(resolveVisibleCRMView('bookings', [])).toBe('overview');
    expect(resolveVisibleCRMView('bookings', ['booking.appointments'])).toBe('bookings');
  });
});