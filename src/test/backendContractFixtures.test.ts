import { beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EditorCommand, EditorCommandResult } from '@/services/editor/editorCommandTypes';
import type { RuntimeContextV2 } from '@/services/project-backend/runtimeProtocol';
import type { ResourceRecord } from '@/services/resources/resourceTypes';

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  callProjectBackend: vi.fn(),
  listCmsRecords: vi.fn(),
}));

vi.mock('@/services/project-backend/projectBackendResolver', () => ({
  projectBackendResolver: { resolve: mocks.resolve, invalidate: vi.fn() },
}));
vi.mock('@/services/project-backend/projectBackendClient', () => ({
  callProjectBackend: mocks.callProjectBackend,
}));
vi.mock('@/services/cmsRecordService', () => ({
  listCmsRecords: mocks.listCmsRecords,
  createCmsRecord: vi.fn(),
  removeCmsRecord: vi.fn(),
  updateCmsRecord: vi.fn(),
  listContentRecords: vi.fn(async () => []),
  getContentRecord: vi.fn(),
  createContentRecord: vi.fn(),
  updateContentRecord: vi.fn(),
}));
vi.mock('@/services/businessProfileService', () => ({
  loadBusinessProfile: vi.fn(),
  saveBusinessProfile: vi.fn(),
}));

import { executeEditorCommand } from '@/services/editor/editorCommandService';
import { executeBackendCommandV2 } from '@/services/project-backend/runtimeProtocol';
import { CAPABILITY_REGISTRY } from '@/platform/core/capabilityRegistry';
import { resolveCapabilityPacks, packFunctions } from '@/platform/core/capabilityPacks';
import { compileGeneratedSiteRuntimeManifest } from '@/services/generatedSiteRuntimeManifest';
import { createCanonicalComponentInstance } from '@/services/canonicalComponentRegistry';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import { getAllIndustries } from '@/platform/core/industryMatrix';
import { getIntentDef } from '@/platform/core/intentSurfaceRegistry';
import { getCapability } from '@/platform/core/capabilityRegistry';
import { getCatalogSurface, projectRowToCardViewModel } from '@/platform/core/catalogSurfaceRegistry';
import { getIndustrySeedDataTargets } from '@/services/app-builder/appBuilderGenerationContext';
import { getResource } from '@/services/resources/resourceRegistry';
import { backendContractFixtures as fixtures } from './fixtures/backendContracts';

const records: Record<string, ResourceRecord[]> = {
  [fixtures.salon.resourceKey]: [fixtures.salon.row],
  [fixtures.restaurant.resourceKey]: [fixtures.restaurant.row],
};

function fakeCatalogRecords(resourceKey: string): ResourceRecord[] {
  const existing = records[resourceKey];
  if (existing) return existing;
  const surface = getCatalogSurface(resourceKey);
  if (!surface) return [];
  const defaults = { ...surface.newRowDefaults };
  const titleField = surface.fields.title;
  if (titleField && !defaults[titleField]) defaults[titleField] = `Fixture ${surface.rowLabel}`;
  return [{ id: `fixture-${resourceKey}`, ...defaults }];
}

function contextForIndustry(industry: string): RuntimeContextV2 {
  return {
    protocolVersion: 2,
    projectId: `project-${industry}`,
    siteId: `site-${industry}`,
    businessId: `business-${industry}`,
    operationId: `fixture-${industry}-read`,
    actorKind: 'studio-user',
  };
}

async function fakeSourceCommit(command: EditorCommand): Promise<EditorCommandResult> {
  return {
    ok: true,
    command: command.type,
    lane: 'source',
    savedTo: command.target.pagePath ?? '/',
    changedFields: ['text'],
    revisionId: 'fake-revision-1',
  };
}

describe('backend contract fixtures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolve.mockImplementation(async (projectId: string) => ({
      bindingId: `binding-${projectId}`,
      projectId,
      siteId: `site-${projectId.replace('project-', '')}`,
      mode: 'shared-legacy',
      provider: 'supabase',
      status: 'ready',
    }));
    mocks.listCmsRecords.mockImplementation(async ({ resource }: { resource: string }) => fakeCatalogRecords(resource));
  });

  it.each([
    ['static portfolio', fixtures.portfolio.titleCommand, 'business-portfolio', 'project-portfolio'],
    ['SaaS workspace', fixtures.saas.titleCommand, fixtures.saas.context.businessId, fixtures.saas.context.projectId],
  ] as const)('%s title edits stay source-owned and never access business data', async (_name, command, businessId, projectId) => {
    const sourceCommit = vi.fn(fakeSourceCommit);
    const result = await executeEditorCommand(command, {
      source: 'toolbar',
      resource: { businessId, projectId, mode: 'builder' },
      executors: { source: sourceCommit },
    });

    expect(result).toMatchObject({ ok: true, lane: 'source', revisionId: 'fake-revision-1' });
    expect(sourceCommit).toHaveBeenCalledOnce();
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.listCmsRecords).not.toHaveBeenCalled();
    expect(mocks.callProjectBackend).not.toHaveBeenCalled();
  });

  it('routes a salon service fixture through the typed catalog facade', async () => {
    const { context, resourceKey, row } = fixtures.salon;
    const result = await executeBackendCommandV2(context, { kind: 'resource.list', resourceKey });

    expect(result).toMatchObject({ ok: true, operationId: context.operationId, data: [row] });
    expect(mocks.resolve).toHaveBeenCalledWith(context.projectId);
    expect(mocks.listCmsRecords).toHaveBeenCalledWith({
      businessId: context.businessId,
      projectId: context.projectId,
      resource: resourceKey,
    });
  });

  it('routes a restaurant menu product fixture through its distinct catalog surface', async () => {
    const { context, resourceKey, row } = fixtures.restaurant;
    const result = await executeBackendCommandV2(context, { kind: 'resource.list', resourceKey });

    expect(result).toMatchObject({ ok: true, operationId: context.operationId, data: [row] });
    expect(mocks.listCmsRecords).toHaveBeenCalledWith({
      businessId: context.businessId,
      projectId: context.projectId,
      resource: resourceKey,
    });
  });

  it('does not invent a generic SaaS table or cross-tenant resource key', async () => {
    const result = await executeBackendCommandV2(fixtures.saas.context, {
      kind: 'resource.list',
      resourceKey: fixtures.saas.unregisteredResourceKey,
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(fixtures.saas.tenantId).not.toBe(fixtures.saas.otherTenantId);
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.listCmsRecords).not.toHaveBeenCalled();
  });

  it('declares the published checkout controller in both commerce capability contracts', () => {
    const component = createCanonicalComponentInstance('checkout-cta', {
      bindings: { productId: 'product-1' },
    });
    expect(component).toBeTruthy();
    const snapshot = {
      snapshotId: 'snapshot-checkout',
      componentInstances: { [component!.instanceId]: component! },
    } as unknown as SiteBundleSnapshot;
    const runtime = compileGeneratedSiteRuntimeManifest({
      siteId: 'site-commerce',
      snapshot,
      enabledCapabilities: ['commerce'],
      generatedAt: '2026-10-15T00:00:00.000Z',
    });
    const checkout = runtime.controllers.find((controller) => controller.intents.includes('pay.checkout'));

    expect(checkout?.functionName).toBe('create-order-checkout');
    expect(CAPABILITY_REGISTRY.commerce.backend.functions).toContain(checkout?.functionName);
    expect(packFunctions(resolveCapabilityPacks(['commerce.checkout']).order)).toContain(checkout?.functionName);
  });

  it.each(getAllIndustries().map((industry) => [industry.industry, industry] as const))(
    '%s keeps static title edits out of every business data backend',
    async (industryName, industry) => {
      const command = industryName === 'portfolio'
        ? fixtures.portfolio.titleCommand
        : industryName === 'saas'
          ? fixtures.saas.titleCommand
          : {
              type: 'set-text' as const,
              text: `${industry.name} heading`,
              target: { pagePath: '/', sourceLocator: '/src/pages/Home.tsx:1:1' },
            };
      const sourceCommit = vi.fn(fakeSourceCommit);
      const result = await executeEditorCommand(command, {
        source: 'toolbar',
        resource: {
          businessId: `business-${industryName}`,
          projectId: `project-${industryName}`,
          mode: 'builder',
        },
        executors: { source: sourceCommit },
      });

      expect(result).toMatchObject({ ok: true, lane: 'source', revisionId: 'fake-revision-1' });
      expect(sourceCommit).toHaveBeenCalledOnce();
      expect(mocks.resolve).not.toHaveBeenCalled();
      expect(mocks.listCmsRecords).not.toHaveBeenCalled();
      expect(mocks.callProjectBackend).not.toHaveBeenCalled();
    },
  );

  it.each(getAllIndustries().map((industry) => [industry.industry, industry] as const))(
    '%s catalog seed targets reach the UI through registered resource contracts',
    async (industryName) => {
      const surfaces = [...new Set(getIndustrySeedDataTargets(industryName)
        .map(({ target }) => target.catalogSurface)
        .filter((surface): surface is string => Boolean(surface)))];
      const context = contextForIndustry(industryName);

      for (const resourceKey of surfaces) {
        const resource = getResource(resourceKey);
        const surface = getCatalogSurface(resourceKey);
        expect(resource?.storage.adapter, `${industryName}.${resourceKey} adapter`).toBe('catalog');
        expect(surface, `${industryName}.${resourceKey} UI surface`).toBeTruthy();

        const result = await executeBackendCommandV2(context, { kind: 'resource.list', resourceKey });
        expect(result.ok, `${industryName}.${resourceKey} runtime read`).toBe(true);
        if (!result.ok) continue;
        const rows = result.data as ResourceRecord[];
        expect(rows).toHaveLength(1);
        const card = projectRowToCardViewModel(surface!, rows[0]);
        expect(card).toMatchObject({
          id: rows[0].id,
          sourceKind: surface!.catalogKind,
          sourceTable: surface!.sourceTable,
        });
        expect(card.title).toBeTruthy();
      }

      expect(mocks.listCmsRecords).toHaveBeenCalledTimes(surfaces.length);
      if (surfaces.length === 0) expect(mocks.resolve).not.toHaveBeenCalled();
    },
  );

  it.each(getAllIndustries().map((industry) => [industry.industry, industry] as const))(
    '%s supported catalog seed targets use dedicated mode without shared fallback',
    async (industryName) => {
      const surfaces = [...new Set(getIndustrySeedDataTargets(industryName)
        .map(({ target }) => target.catalogSurface)
        .filter((surface): surface is string => Boolean(surface)))];
      const context = contextForIndustry(industryName);
      mocks.resolve.mockImplementation(async (projectId: string) => ({
        bindingId: `binding-${projectId}`,
        projectId,
        siteId: `site-${industryName}`,
        mode: 'dedicated',
        provider: 'supabase',
        status: 'ready',
      }));
      mocks.callProjectBackend.mockImplementation(async ({ resource }: { resource: string }) => fakeCatalogRecords(resource));

      for (const resourceKey of surfaces) {
        const result = await executeBackendCommandV2(context, { kind: 'resource.list', resourceKey });
        expect(result.ok, `${industryName}.${resourceKey} dedicated read`).toBe(true);
        expect(mocks.callProjectBackend).toHaveBeenCalledWith({
          projectId: context.projectId,
          action: 'list',
          resource: resourceKey,
        });
      }

      expect(mocks.callProjectBackend).toHaveBeenCalledTimes(surfaces.length);
      expect(mocks.listCmsRecords).not.toHaveBeenCalled();
    },
  );

  it.each(getAllIndustries().map((industry) => [industry.industry, industry] as const))(
    '%s primary intent has a UI contract and available backend functions',
    (industryName, industry) => {
      const intent = getIntentDef(industry.primaryIntent);
      expect(intent, `${industryName}.${industry.primaryIntent} intent`).toBeTruthy();
      expect(intent?.requiredCapabilities?.every((capability) => industry.defaultCapabilities.includes(capability)),
        `${industryName}.${industry.primaryIntent} capabilities`).toBe(true);

      const owner = industry.defaultCapabilities
        .map((capabilityId) => getCapability(capabilityId))
        .find((capability) => capability.intents.provided.includes(industry.primaryIntent));
      expect(owner, `${industryName}.${industry.primaryIntent} owner`).toBeTruthy();
      expect(owner?.frontend.components.length, `${industryName} UI components`).toBeGreaterThan(0);
      expect(owner?.frontend.supportedSlots.length, `${industryName} UI slots`).toBeGreaterThan(0);
      expect(owner?.backend.functions.length, `${industryName} backend handlers`).toBeGreaterThan(0);

      for (const functionName of owner?.backend.functions ?? []) {
        expect(
          existsSync(resolve(process.cwd(), 'supabase', 'functions', functionName, 'index.ts')),
          `${industryName}.${owner?.id} function ${functionName}`,
        ).toBe(true);
      }
    },
  );
});