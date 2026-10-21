import { describe, expect, it } from 'vitest';
import { buildBusinessRuntimeContract } from '@/platform/core/businessRuntimeContract';
import type { BusinessProfileDTO } from '@/types/businessProfile';

const profile: BusinessProfileDTO = {
  businessId: 'business-1',
  ownerId: 'owner-1',
  name: 'Northstar Studio',
  industry: 'agency',
  notificationEmail: 'owner@northstar.test',
  timezone: 'America/New_York',
  address: {},
  hours: [],
  socialLinks: {},
  settings: {},
  updatedAt: '2026-07-28T12:00:00.000Z',
};

describe('buildBusinessRuntimeContract', () => {
  it('describes live profile and binding sources without copying mutable profile data', () => {
    const contract = buildBusinessRuntimeContract({
      businessId: profile.businessId,
      projectId: 'project-1',
      siteId: 'site-1',
      requestedCapabilities: ['booking.appointments', 'crm.leads'],
      profile,
      snapshotId: 'snapshot-1',
      expectedBindingCount: 2,
      bindingsReady: true,
      generatedAt: '2026-07-28T13:00:00.000Z',
    });

    expect(contract).toMatchObject({
      version: '1.1',
      businessId: 'business-1',
      identity: {
        businessId: 'business-1',
        projectId: 'project-1',
        siteId: 'site-1',
        locationId: null,
      },
      capabilityManifest: {
        version: '1.0',
        source: 'capability_pack_registry',
        requestedCapabilities: expect.arrayContaining(['booking.appointments', 'crm.leads', 'business_profile']),
        packs: expect.arrayContaining([
          expect.objectContaining({ id: 'booking.appointments', status: 'declared' }),
          expect.objectContaining({
            id: 'crm.leads',
            status: 'declared',
            requiredPermissions: expect.arrayContaining(['visitor.lead.create']),
          }),
        ]),
        unsupportedCapabilities: [],
      },
      profile: {
        source: 'businesses',
        version: profile.updatedAt,
        publishReady: true,
      },
      dataBindings: {
        source: 'site_data_bindings',
        snapshotId: 'snapshot-1',
        expectedCount: 2,
        status: 'ready',
      },
    });
    expect(contract).not.toHaveProperty('profile.notificationEmail');
  });

  it('keeps incomplete local profiles launchable while recording publish blockers', () => {
    const contract = buildBusinessRuntimeContract({
      businessId: profile.businessId,
      projectId: 'project-1',
      siteId: 'site-1',
      profile: {
        ...profile,
        industry: 'local-service',
        notificationEmail: null,
      },
      snapshotId: 'snapshot-1',
      expectedBindingCount: 1,
    });

    expect(contract.profile.publishReady).toBe(false);
    expect(contract.profile.missingRequiredFields).toEqual(
      expect.arrayContaining(['notificationEmail', 'phone', 'address.line1']),
    );
    expect(contract.dataBindings.status).toBe('pending');
  });

  it('rejects a profile from another tenant', () => {
    expect(() => buildBusinessRuntimeContract({
      businessId: 'business-2',
      projectId: 'project-2',
      siteId: 'site-2',
      profile,
      snapshotId: 'snapshot-1',
      expectedBindingCount: 0,
    })).toThrow('must match the launch business');
  });

  it('keeps multiple sites of one business distinct from another business', () => {
    const build = (businessId: string, projectId: string, siteId: string) => buildBusinessRuntimeContract({
      businessId,
      projectId,
      siteId,
      requestedCapabilities: ['crm.contacts'],
      profile: { ...profile, businessId },
      snapshotId: `${siteId}-snapshot`,
      expectedBindingCount: 0,
    });

    const firstSite = build('business-1', 'project-1', 'site-1');
    const secondSite = build('business-1', 'project-2', 'site-2');
    const otherBusiness = build('business-2', 'project-3', 'site-3');

    expect(firstSite.identity).toMatchObject({ businessId: 'business-1', projectId: 'project-1', siteId: 'site-1' });
    expect(secondSite.identity).toMatchObject({ businessId: 'business-1', projectId: 'project-2', siteId: 'site-2' });
    expect(otherBusiness.identity).toMatchObject({ businessId: 'business-2', projectId: 'project-3', siteId: 'site-3' });
    expect(firstSite.capabilityManifest.packs).toEqual(secondSite.capabilityManifest.packs);
    expect(firstSite.identity).not.toEqual(secondSite.identity);
    expect(firstSite.identity).not.toEqual(otherBusiness.identity);
  });

  it('requires canonical project and site identity', () => {
    expect(() => buildBusinessRuntimeContract({
      businessId: profile.businessId,
      projectId: ' ',
      siteId: 'site-1',
      profile,
      snapshotId: 'snapshot-1',
      expectedBindingCount: 0,
    })).toThrow('requires business, project, and site IDs');
  });
});