import { describe, expect, it } from 'vitest';
import { resolveBusinessLaunchPlan, resolveUniversalCreationCapabilities } from '@/services/launch/launchCapabilities';
import { resolveCapabilities } from '@/services/wizardCapabilityResolver';
import { buildBusinessRuntimeContract } from '@/platform/core/businessRuntimeContract';
import type { UniversalCreationInput } from '@/platform/core/universalCreation';

const creation: UniversalCreationInput = {
  mode: 'open-ended',
  originalPrompt: 'A CMS with booking and an online store',
  sitePurpose: 'General publication and commerce site',
  subject: 'A publication and store',
  pages: [
    { route: '/', title: 'Home', purpose: 'Introduce the site', suggestedRole: 'home' },
    { route: '/journal', title: 'Journal', purpose: 'Publish articles', suggestedRole: 'blog' },
  ],
  visualRequirements: [],
  requestedCapabilities: ['booking', 'commerce', 'content-management', 'lead-capture', 'authentication'],
};

describe('Universal Creation capability resolution', () => {
  it('resolves requested operations into real packs, intents, and Resource Runtime keys', () => {
    const plan = resolveBusinessLaunchPlan({
      industry: 'general',
      openEnded: true,
      selectedPages: [],
      requestedCapabilities: creation.requestedCapabilities,
    });

    expect(plan.operationalCapabilities).toEqual(expect.arrayContaining(['booking', 'commerce', 'contact', 'lead-capture']));
    expect(plan.businessCapabilities).toEqual(expect.arrayContaining([
      'booking.appointments', 'catalog.services', 'catalog.products', 'commerce.cart',
      'commerce.checkout', 'crm.leads', 'forms.contact', 'cms.content',
    ]));
    expect(plan.requestedIntents).toEqual(expect.arrayContaining(['booking.create', 'cart.add', 'cart.checkout', 'contact.submit']));
    expect(plan.requestedResources).toEqual(expect.arrayContaining(['services', 'availability_slots', 'products', 'content:articles']));
    expect(plan.blockedRequests).toContain('capability:authentication:unsupported');
  });

  it('materializes the operational routes, forms, and calendar for open-ended requests', () => {
    const pack = resolveCapabilities({
      businessName: 'Northstar',
      businessModel: 'general',
      industryOverlay: 'general',
      primaryGoal: '',
      secondaryGoals: [],
      universalCreation: creation,
      needsBooking: true,
      sellsProducts: true,
      wantsLeadCapture: true,
    });

    expect(pack.requiredPages).toEqual(expect.arrayContaining(['booking', 'booking_confirmation', 'shop', 'checkout', 'contact']));
    expect(pack.requiredFunnels).toEqual(expect.arrayContaining(['booking', 'purchase', 'lead_capture']));
    expect(pack.requiredForms).toEqual(expect.arrayContaining(['booking_intake', 'contact']));
    expect(pack.requiredCalendars).toContain('main_booking');
  });

  it('persists CMS Resource Runtime keys in the business capability manifest', () => {
    const plan = resolveBusinessLaunchPlan({
      industry: 'general',
      openEnded: true,
      requestedCapabilities: ['content-management'],
    });
    const runtime = buildBusinessRuntimeContract({
      businessId: 'business-id',
      projectId: 'project-id',
      siteId: 'site-id',
      requestedCapabilities: plan.businessCapabilities,
      requestedResources: plan.requestedResources,
      profile: {
        businessId: 'business-id',
        ownerId: 'owner-id',
        name: 'Northstar Journal',
        timezone: 'UTC',
        address: {},
        hours: [],
        socialLinks: {},
        settings: {},
      },
      snapshotId: 'snapshot-id',
      expectedBindingCount: 0,
    });

    expect(runtime.capabilityManifest.requestedResources).toEqual(['content:articles']);
    expect(runtime.capabilityManifest.packs).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'cms.content', provides: ['cms.content'] }),
    ]));
    expect(runtime.capabilityManifest.unsupportedCapabilities).toEqual([]);
  });

  it('does not silently activate unsupported capability requests', () => {
    const resolution = resolveUniversalCreationCapabilities(['authentication', 'mystery-system']);
    expect(resolution.operationalCapabilities).toEqual([]);
    expect(resolution.businessCapabilities).toEqual([]);
    expect(resolution.blockedRequests).toEqual([
      'capability:authentication:unsupported',
      'capability:mystery-system:unsupported',
    ]);
  });
});