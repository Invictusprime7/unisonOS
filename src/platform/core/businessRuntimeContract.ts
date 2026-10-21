import {
  scoreProfileCompleteness,
  type BusinessProfileDTO,
} from '@/types/businessProfile';
import { resolveCapabilityPacks, type BusinessCapability } from './capabilityPacks';

export const BUSINESS_RUNTIME_CONTRACT_VERSION = '1.1' as const;
export const BUSINESS_CAPABILITY_MANIFEST_VERSION = '1.0' as const;

export interface ScopedBusinessIdentity {
  businessId: string;
  projectId: string;
  siteId: string;
  locationId: string | null;
}

export interface RuntimeCapabilityDeclaration {
  id: BusinessCapability;
  status: 'declared';
  provides: BusinessCapability[];
  requiredPermissions: string[];
  requiredTables: string[];
  readinessAssertions: string[];
}

export interface BusinessRuntimeContract {
  version: typeof BUSINESS_RUNTIME_CONTRACT_VERSION;
  businessId: string;
  identity: ScopedBusinessIdentity;
  capabilityManifest: {
    version: typeof BUSINESS_CAPABILITY_MANIFEST_VERSION;
    source: 'capability_pack_registry';
    requestedCapabilities: BusinessCapability[];
    packs: RuntimeCapabilityDeclaration[];
    unsupportedCapabilities: BusinessCapability[];
  };
  profile: {
    source: 'businesses';
    version: string;
    completenessPercent: number;
    publishReady: boolean;
    missingRequiredFields: string[];
  };
  dataBindings: {
    source: 'site_data_bindings';
    snapshotId: string;
    expectedCount: number;
    status: 'pending' | 'ready';
  };
  generatedAt: string;
}

export function buildBusinessRuntimeContract({
  businessId,
  projectId,
  siteId,
  locationId = null,
  requestedCapabilities = [],
  profile,
  snapshotId,
  expectedBindingCount,
  bindingsReady = false,
  generatedAt = new Date().toISOString(),
}: {
  businessId: string;
  projectId: string;
  siteId: string;
  locationId?: string | null;
  requestedCapabilities?: readonly BusinessCapability[];
  profile: BusinessProfileDTO;
  snapshotId: string;
  expectedBindingCount: number;
  bindingsReady?: boolean;
  generatedAt?: string;
}): BusinessRuntimeContract {
  if (profile.businessId !== businessId) {
    throw new Error('Business runtime profile must match the launch business.');
  }
  if (!businessId.trim() || !projectId.trim() || !siteId.trim()) {
    throw new Error('Business runtime identity requires business, project, and site IDs.');
  }

  const requested = Array.from(new Set<BusinessCapability>([
    'business_profile',
    ...requestedCapabilities,
  ]));
  const resolution = resolveCapabilityPacks(requested);
  const capabilityPacks = resolution.order.map((pack) => ({
      id: pack.id,
      status: 'declared' as const,
      provides: [...new Set(pack.provides)],
      requiredPermissions: [...new Set(pack.backend.permissions)],
      requiredTables: [...new Set(pack.database.tables.map((table) => table.table))],
      readinessAssertions: [...new Set(pack.readiness.assertions.map((assertion) => assertion.id))],
    }));

  const completeness = scoreProfileCompleteness(profile);
  const missingRequiredFields = completeness.missingRequired
    .filter((field) => field.blocksPublish)
    .map((field) => field.key);

  return {
    version: BUSINESS_RUNTIME_CONTRACT_VERSION,
    businessId,
    identity: { businessId, projectId, siteId, locationId },
    capabilityManifest: {
      version: BUSINESS_CAPABILITY_MANIFEST_VERSION,
      source: 'capability_pack_registry',
      requestedCapabilities: requested,
      packs: capabilityPacks,
      unsupportedCapabilities: resolution.unsupported,
    },
    profile: {
      source: 'businesses',
      version: profile.updatedAt || 'unversioned',
      completenessPercent: completeness.percent,
      publishReady: missingRequiredFields.length === 0,
      missingRequiredFields,
    },
    dataBindings: {
      source: 'site_data_bindings',
      snapshotId,
      expectedCount: Math.max(0, expectedBindingCount),
      status: bindingsReady || expectedBindingCount === 0 ? 'ready' : 'pending',
    },
    generatedAt,
  };
}