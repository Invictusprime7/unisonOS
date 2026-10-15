import type { EditorCommand } from '@/services/editor/editorCommandTypes';
import type { RuntimeContextV2 } from '@/services/project-backend/runtimeProtocol';
import type { ResourceRecord } from '@/services/resources/resourceTypes';

const sourceTitle = (text: string): EditorCommand => ({
  type: 'set-text',
  text,
  target: { pagePath: '/', sourceLocator: '/src/pages/Home.tsx:1:1' },
});

export const backendContractFixtures = {
  portfolio: {
    titleCommand: sourceTitle('Selected work'),
  },
  salon: {
    context: {
      protocolVersion: 2,
      projectId: 'project-salon',
      siteId: 'site-salon',
      businessId: 'business-salon',
      operationId: 'fixture-salon-list',
      actorKind: 'studio-user',
    } satisfies RuntimeContextV2,
    resourceKey: 'services',
    row: {
      id: 'service-cut',
      name: 'Signature cut',
      duration_minutes: 45,
      price_cents: 6800,
      is_active: true,
    } satisfies ResourceRecord,
  },
  restaurant: {
    context: {
      protocolVersion: 2,
      projectId: 'project-restaurant',
      siteId: 'site-restaurant',
      businessId: 'business-restaurant',
      operationId: 'fixture-restaurant-list',
      actorKind: 'studio-user',
    } satisfies RuntimeContextV2,
    resourceKey: 'menu',
    row: {
      id: 'menu-soup',
      name: 'Roasted tomato soup',
      price_cents: 1250,
      dietary_tags: ['vegetarian'],
      available: true,
    } satisfies ResourceRecord,
  },
  saas: {
    titleCommand: sourceTitle('Workspace overview'),
    context: {
      protocolVersion: 2,
      projectId: 'project-saas',
      siteId: 'site-saas',
      businessId: 'business-saas',
      operationId: 'fixture-saas-list',
      actorKind: 'studio-user',
    } satisfies RuntimeContextV2,
    tenantId: 'tenant-a',
    otherTenantId: 'tenant-b',
    unregisteredResourceKey: 'saas:records',
  },
} as const;