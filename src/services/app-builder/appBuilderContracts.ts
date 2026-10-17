/**
 * Derived contracts for the Unison App Builder boundary.
 *
 * AppBuildContract is an ephemeral projection of canonical launch objects. It
 * is safe to serialize for a provider request, but it is never persisted as a
 * second source of truth. SiteBundleSnapshot remains the accepted state.
 */

import type { GeneratedSitePlan } from '@/platform/core/siteTopologyPlanner';
import type { SiteBundleSnapshotMeta } from '@/platform/core/canonicalPipeline';
import type { ResolvedArtDirection } from '@/sections/variants/resolvedArtDirection';
import type { ThemeTokens } from '@/sections/types';
import { planSiteComposition, type SiteCompositionPlan } from '@/services/composition';
import type { ResolvedSiteDesignContext } from '@/services/launch/resolvedSiteDesignContext';
import type { WizardAggregatedRegistryContext } from '@/services/launch/wizardRegistryAggregation';
import type { BuilderPageType, PageRegistry } from '@/types/pageRegistry';
import type { AICandidateChangeSet } from '@/services/builder/aiCandidateChangeSet';
import type { TopologyChange } from '@/services/pageTopologyOrchestrator';
import { getArtifact } from '@/platform/core/artifactRegistry';

export const APP_BUILDER_PROTOCOL_VERSION = 'unison-app-builder/2' as const;

export interface AppBuilderLogoContract {
  version: '1.0';
  brandMark: {
    source: { kind: 'business-profile'; field: 'logoUrl' };
    placements: Array<{ artifactId: string; slotId: string }>;
    image: { objectFit: 'contain'; preserveAspectRatio: true; maxWidthPx: 180; maxHeightPx: 48 };
    accessibleName: string;
    missingAssetFallback: { kind: 'text-wordmark'; text: string };
  };
  logoCloud: {
    artifactId: 'logo-cloud';
    source: 'owner-authored';
    minimumItems: number;
    emptyBehavior: 'hide_section' | 'empty_state' | 'show_placeholder';
    generatedEntriesAllowed: false;
  };
}

function deriveAppBuilderLogoContract(businessName: string): AppBuilderLogoContract {
  const placements = (['navbar', 'footer'] as const).map((artifactId) => {
    const artifact = getArtifact(artifactId);
    const slotId = `${artifactId}.brand`;
    if (!artifact || artifact.dataSource.kind !== 'business-profile'
      || !artifact.dataSource.profileFields?.includes('logoUrl')
      || !artifact.supportedSlots.includes(slotId)) {
      throw new Error(`AppBuildContract requires the registered ${artifactId} logo binding.`);
    }
    return { artifactId, slotId };
  });
  const logoCloud = getArtifact('logo-cloud');
  if (!logoCloud || logoCloud.dataSource.kind !== 'authored') {
    throw new Error('AppBuildContract requires the registered owner-authored logo-cloud artifact.');
  }

  return {
    version: '1.0',
    brandMark: {
      source: { kind: 'business-profile', field: 'logoUrl' },
      placements,
      image: { objectFit: 'contain', preserveAspectRatio: true, maxWidthPx: 180, maxHeightPx: 48 },
      accessibleName: businessName,
      missingAssetFallback: { kind: 'text-wordmark', text: businessName },
    },
    logoCloud: {
      artifactId: 'logo-cloud',
      source: 'owner-authored',
      minimumItems: logoCloud.dataSource.minRows,
      emptyBehavior: logoCloud.dataSource.fallbackMode,
      generatedEntriesAllowed: false,
    },
  };
}

export type AppBuildCandidateStatus =
  | 'planning'
  | 'generating'
  | 'validating'
  | 'repairing'
  | 'ready-for-commit'
  | 'rejected'
  | 'cancelled';

export type AppBuildCandidateStopReason =
  | 'complete'
  | 'validation-failed'
  | 'repair-exhausted'
  | 'provider-error'
  | 'timeout'
  | 'cancelled';

export type AppBuilderUIFoundation = NonNullable<SiteBundleSnapshotMeta['uiFoundation']>;

export interface AppBuildIdentity {
  projectId: string;
  businessId: string;
  siteId: string;
  systemType: string;
}

export interface AppBuildDesignSourceSelection {
  implementationIds: string[];
  portableRecipeIds: string[];
  primitiveFamilyIds: string[];
  experiencePrimitiveIds: string[];
  pageCompositionIds: string[];
}

const sortedUnique = (values: Iterable<string>): string[] => [...new Set(values)].sort();

export function deriveDesignSourceSelection(registry: WizardAggregatedRegistryContext): AppBuildDesignSourceSelection {
  const implementations = registry.implementations ?? [];
  const families = registry.primitiveFamilies ?? [];
  return {
    implementationIds: sortedUnique(implementations.map((impl) => impl.id)),
    portableRecipeIds: sortedUnique(implementations.filter((impl) => impl.certification === 'portable').map((impl) => impl.id)),
    primitiveFamilyIds: sortedUnique(families.map((family) => family.family)),
    experiencePrimitiveIds: sortedUnique(families.filter((family) => family.family === 'experience').flatMap((family) => family.values)),
    pageCompositionIds: sortedUnique((registry.pageCompositions ?? []).flatMap((entry) => entry.alternatives.map((alt) => alt.id))),
  };
}

export interface AppBuildContract {
  protocolVersion: typeof APP_BUILDER_PROTOCOL_VERSION;
  identity: AppBuildIdentity;
  /** Existing canonical topology objects; App Builder does not own another route model. */
  topology: {
    sitePlan: GeneratedSitePlan;
    pageRegistry: PageRegistry;
  };
  business: {
    industry: string;
    businessName: string;
    branding: AppBuilderLogoContract;
    /** Owner's planning-chat brief carried from WizardSelections.visionPrompt. */
    visionBrief?: string;
    goals: readonly string[];
    intents: readonly string[];
    capabilities: readonly string[];
    bindingGuide: string;
  };
  design: {
    seed: string;
    themePresetId: string;
    themeTokens: ThemeTokens;
    artDirection: ResolvedArtDirection;
    resolvedSiteDesignContext: ResolvedSiteDesignContext;
    uiFoundation: AppBuilderUIFoundation;
    registryContext: WizardAggregatedRegistryContext;
    compositionPlan: SiteCompositionPlan;
    /** Which design knowledge must be hydrated; ids only, never duplicated source. */
    sourceSelection: AppBuildDesignSourceSelection;
  };
  runtime: {
    framework: 'react-vite';
    language: 'typescript';
    styling: 'tailwind';
    protectedPaths: readonly string[];
    approvedDependencies: readonly string[];
    approvedExperienceCapabilities: readonly string[];
  };
}

export interface BuildAppBuildContractInput {
  identity: AppBuildIdentity;
  sitePlan: GeneratedSitePlan;
  pageRegistry: PageRegistry;
  industry: string;
  businessName: string;
  visionBrief?: string;
  goals: readonly string[];
  intents: readonly string[];
  capabilities: readonly string[];
  bindingGuide: string;
  seed: string;
  themePresetId: string;
  themeTokens: ThemeTokens;
  artDirection: ResolvedArtDirection;
  designContext: ResolvedSiteDesignContext;
  uiFoundation: AppBuilderUIFoundation;
  registryContext: WizardAggregatedRegistryContext;
  protectedPaths: Iterable<string>;
}

export interface AppBuildRequest {
  operationId: string;
  contract: AppBuildContract;
  initialFiles: Readonly<Record<string, string>>;
  entryPoint: string;
  baseRevisionId?: string | null;
  signal?: AbortSignal;
  budgetMs?: number;
  maxPages?: number;
  concurrency?: number;
  preflight?: (files: Record<string, string>) => Record<string, string>;
  onProgress?: (event: {
    page: AppBuilderPageTarget;
    index: number;
    total: number;
    phase: 'authoring' | 'committed' | 'kept-baseline';
  }) => void;
  /** M2 compatibility adapter; removed when M3 makes generation candidate-only. */
  acceptPage?: (
    nextFiles: Record<string, string>,
    page: AppBuilderPageTarget,
    beforeFiles: Record<string, string>,
    candidate: AICandidateChangeSet,
  ) => Promise<{ files: Record<string, string>; revisionId?: string | null }>;
}

export interface AppBuilderPageTarget {
  pageId?: string;
  title: string;
  route: string;
  filePath: string;
  role: string;
}

export interface AppBuilderNewPageTarget extends AppBuilderPageTarget {
  pageId: string;
  pageType: BuilderPageType;
  showInNav?: boolean;
  navOrder?: number;
}

export interface AppBuilderPageGenerationRequest {
  operationId: string;
  baseRevisionId?: string | null;
  currentFiles: Readonly<Record<string, string>>;
  pages: readonly AppBuilderNewPageTarget[];
  existingRoutes?: readonly { title: string; route: string }[];
  businessName: string;
  industry?: string;
  designContext?: ResolvedSiteDesignContext | null;
  visionBrief?: string;
  registryContext?: unknown;
  runtimeContext?: string;
  signal?: AbortSignal;
  budgetMs?: number;
  concurrency?: number;
  onProgress?: (event: {
    page: AppBuilderPageTarget;
    index: number;
    total: number;
    phase: 'authoring' | 'committed' | 'kept-baseline';
  }) => void;
}

export interface AppBuilderPageGenerationResult {
  operationId: string;
  protocolVersion: typeof APP_BUILDER_PROTOCOL_VERSION;
  baseRevisionId?: string | null;
  status: 'ready-for-commit' | 'rejected' | 'cancelled';
  stopReason: AppBuildCandidateStopReason;
  candidateFiles: Readonly<Record<string, string>>;
  changeSet?: AICandidateChangeSet;
  routeOps: readonly TopologyChange[];
  outcomes: readonly AppBuildPageOutcome[];
  diagnostics: readonly string[];
}

export interface AppEditRequest {
  operationId: string;
  /** Read-only context from the selected element and existing canonical authorities. */
  connectorContext?: import('@/types/unisonBuilderConnector').UnisonBuilderConnectorInput;
  baseRevisionId?: string | null;
  currentFiles: Readonly<Record<string, string>>;
  instruction: string;
  page: AppBuilderPageTarget;
  sourceTargets: readonly string[];
  routes?: readonly { title: string; route: string }[];
  brief?: string;
  knowledgeQuery?: string;
  registryContext?: unknown;
  runtimeContext?: string;
  gatewayOptions?: Record<string, unknown>;
  diagnostics?: readonly string[];
  initialRouteOps?: readonly TopologyChange[];
  signal?: AbortSignal;
  timeoutMs?: number;
  preflight?: (files: Record<string, string>) => Record<string, string>;
}

export interface AppRepairRequest extends AppEditRequest {
  diagnostics: readonly string[];
}

export interface AppBuildCandidate {
  candidateId: string;
  status: AppBuildCandidateStatus;
  files: Readonly<Record<string, string>>;
  entryPoint: string;
  attempts: number;
  diagnostics: readonly string[];
  provenance?: AppBuildCandidateProvenance;
  closure?: AppBuildCandidateClosureReport;
  designReport?: import('./appBuilderGenerationContext').DesignSourceUsageReport;
}

export interface AppBuildCandidateProvenance {
  protocolVersion: typeof APP_BUILDER_PROTOCOL_VERSION;
  operationId: string;
  baseRevisionId: string | null;
  contractSeed: string;
  sourceHash: string;
  authoredPageIds: readonly string[];
  strategy: 'ai-candidate' | 'ai-candidate+closure-repair' | 'legacy-commit-adapter';
}

export interface AppBuildCandidateClosureIssue {
  severity: 'blocker' | 'advisory';
  code: string;
  message: string;
  path?: string;
}

export interface AppBuildCandidateClosureReport {
  version: '1.0';
  ok: boolean;
  sourceHash: string;
  issues: readonly AppBuildCandidateClosureIssue[];
}

export interface AppBuildResult {
  operationId: string;
  protocolVersion: typeof APP_BUILDER_PROTOCOL_VERSION;
  candidate: AppBuildCandidate;
  /** Alias for the one candidate workspace returned by generate(). */
  candidateFiles: Readonly<Record<string, string>>;
  stopReason: AppBuildCandidateStopReason;
  outcomes?: readonly AppBuildPageOutcome[];
  revisionId?: string | null;
}

export interface AppEditResult extends AppBuildResult {
  baseRevisionId?: string | null;
  changeSet?: AICandidateChangeSet;
  summary?: string;
}

export interface AppBuildPageOutcome {
  page: AppBuilderPageTarget;
  status: 'authored' | 'kept-baseline' | 'skipped';
  reason: string;
  attempts: number;
  summary?: string;
  errors: readonly string[];
  revisionId?: string | null;
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableJsonValue(child)]),
    );
  }
  return value;
}

function requireNonEmpty(value: string, field: string): void {
  if (!value.trim()) throw new Error(`AppBuildContract requires ${field}.`);
}

function assertAppBuildContract(value: unknown): asserts value is AppBuildContract {
  if (!value || typeof value !== 'object') throw new Error('AppBuildContract must be an object.');
  const contract = value as Partial<AppBuildContract>;
  if (contract.protocolVersion !== APP_BUILDER_PROTOCOL_VERSION) {
    throw new Error(`Unsupported AppBuildContract protocol: ${String(contract.protocolVersion)}.`);
  }
  if (!contract.identity || !contract.topology || !contract.business || !contract.design || !contract.runtime) {
    throw new Error('AppBuildContract is incomplete.');
  }
  if (contract.business.branding?.version !== '1.0'
    || contract.business.branding.brandMark?.source?.field !== 'logoUrl'
    || !Array.isArray(contract.business.branding.brandMark.placements)
    || contract.business.branding.logoCloud?.generatedEntriesAllowed !== false) {
    throw new Error('AppBuildContract requires a valid logo and brand-mark contract.');
  }
  const expectedBranding = deriveAppBuilderLogoContract(contract.business.businessName);
  if (JSON.stringify(stableJsonValue(contract.business.branding)) !== JSON.stringify(stableJsonValue(expectedBranding))) {
    throw new Error('AppBuildContract logo rules must match the canonical artifact registry.');
  }
  requireNonEmpty(contract.identity.projectId, 'identity.projectId');
  requireNonEmpty(contract.identity.businessId, 'identity.businessId');
  requireNonEmpty(contract.identity.siteId, 'identity.siteId');
  requireNonEmpty(contract.identity.systemType, 'identity.systemType');
  if (!contract.topology.sitePlan.pages.length || !Object.keys(contract.topology.pageRegistry.pages).length) {
    throw new Error('AppBuildContract topology must include at least one page.');
  }
  if (!contract.design.resolvedSiteDesignContext.contract) {
    throw new Error('AppBuildContract requires the canonical site design context.');
  }
}

export function buildAppBuildContract(input: BuildAppBuildContractInput): AppBuildContract {
  const compositionPlan = planSiteComposition(
    input.industry,
    input.sitePlan.pages.map((page) => ({ pageId: page.id, role: page.role })),
    input.seed,
    {
      artDirection: input.artDirection.storagePackId,
      businessTraits: [input.designContext.contract.experience, input.designContext.contract.mode],
      availableCapabilities: input.capabilities,
    },
  );
  const contract: AppBuildContract = {
    protocolVersion: APP_BUILDER_PROTOCOL_VERSION,
    identity: { ...input.identity },
    topology: {
      sitePlan: input.sitePlan,
      pageRegistry: input.pageRegistry,
    },
    business: {
      industry: input.industry,
      businessName: input.businessName,
      branding: deriveAppBuilderLogoContract(input.businessName),
      visionBrief: input.visionBrief?.trim() || undefined,
      goals: [...input.goals],
      intents: [...input.intents],
      capabilities: [...input.capabilities],
      bindingGuide: input.bindingGuide,
    },
    design: {
      seed: input.seed,
      themePresetId: input.themePresetId,
      themeTokens: input.themeTokens,
      artDirection: input.artDirection,
      resolvedSiteDesignContext: input.designContext,
      uiFoundation: input.uiFoundation,
      registryContext: input.registryContext,
      compositionPlan,
      sourceSelection: deriveDesignSourceSelection(input.registryContext),
    },
    runtime: {
      framework: 'react-vite',
      language: 'typescript',
      styling: 'tailwind',
      protectedPaths: [...new Set(input.protectedPaths)].sort(),
      approvedDependencies: Object.keys(input.registryContext.runtimeDependencies ?? {}).sort(),
      approvedExperienceCapabilities: [
        ...(input.uiFoundation.approvedExperienceCapabilities ?? input.uiFoundation.experienceCapabilities),
      ].sort(),
    },
  };
  assertAppBuildContract(contract);
  return contract;
}

/** Deterministic wire representation for provider calls and reproducibility tests. */
export function serializeAppBuildContract(contract: AppBuildContract): string {
  assertAppBuildContract(contract);
  return JSON.stringify(stableJsonValue(contract));
}

export function parseAppBuildContract(serialized: string): AppBuildContract {
  const value: unknown = JSON.parse(serialized);
  assertAppBuildContract(value);
  return value;
}
