import { describe, expect, it } from 'vitest';
import {
  resolveBusinessLaunchPlan,
  resolveLaunchBusinessCapabilities,
} from '@/services/launch/launchCapabilities';

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

describe('prompt-first capability resolution', () => {
  it('resolves explicitly requested booking without an industry profile', () => {
    const plan = resolveBusinessLaunchPlan({
      industry: 'general',
      openEnded: true,
      requestedCapabilities: ['booking'],
      capabilityEvidence: [{
        capabilityId: 'booking',
        origin: 'explicit',
        reason: 'Prompt phrase: appointment booking',
      }],
    });

    expect(plan.operationalCapabilities).toContain('booking');
    expect(plan.requestedIntents).toContain('booking.create');
    expect(plan.requestedResources).toContain('services');
    expect(plan.blockedRequests).not.toContain('capability:booking:confirmation-required');
  });

  it('keeps inferred commerce visible but unprovisioned until explicit confirmation', () => {
    const plan = resolveBusinessLaunchPlan({
      industry: 'general',
      openEnded: true,
      requestedCapabilities: ['commerce'],
      capabilityEvidence: [{
        capabilityId: 'commerce',
        origin: 'inferred',
        reason: 'The prompt mentions selling products.',
      }],
    });

    expect(plan.capabilityEvidence).toContainEqual(expect.objectContaining({ origin: 'inferred', capabilityId: 'commerce' }));
    expect(plan.blockedRequests).toContain('capability:commerce:confirmation-required');
    expect(plan.operationalCapabilities).not.toContain('commerce');
    expect(plan.requestedIntents).not.toContain('cart.checkout');
    expect(plan.requestedResources).not.toContain('products');
  });

  it('keeps a static prompt-first site free of business operations', () => {
    const plan = resolveBusinessLaunchPlan({ industry: 'general', openEnded: true });

    expect(plan.operationalCapabilities).toEqual([]);
    expect(plan.requestedResources).toEqual([]);
    expect(plan.requestedIntents).toEqual(['nav.goto']);
  });

  it('projects an explicit CMS request into the existing content resource contract', () => {
    const plan = resolveBusinessLaunchPlan({
      industry: 'general',
      openEnded: true,
      requestedCapabilities: ['content-management'],
      capabilityEvidence: [{
        capabilityId: 'content-management',
        origin: 'explicit',
        reason: 'Prompt phrase: article editor',
      }],
    });

    expect(plan.businessCapabilities).toContain('cms.content');
    expect(plan.requestedResources).toContain('content:articles');
    expect(plan.operationalCapabilities).toEqual([]);
    expect(plan.blockedRequests).toEqual([]);
  });

  it('resolves explicitly requested SaaS authentication without Wizard industry defaults', () => {
    const plan = resolveBusinessLaunchPlan({
      industry: 'general',
      openEnded: true,
      requestedCapabilities: ['authentication'],
      capabilityEvidence: [{
        capabilityId: 'authentication',
        origin: 'explicit',
        reason: 'Prompt phrase: user accounts',
      }],
    });

    expect(plan.operationalCapabilities).toContain('auth');
    expect(plan.businessCapabilities).toContain('auth.customer');
    expect(plan.requestedIntents).toEqual(expect.arrayContaining(['auth.login', 'auth.register']));
    expect(plan.canonicalIndustryId).toBeNull();
  });
});