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
import { resolvePlaygroundBindingDomIntent, type PlaygroundBinding } from '@/platform/core/playground';
import type { CreatorBusinessInfo, CreatorComponentInstance } from '@/types/creatorData';
import type { AICandidateChangeSet } from '@/services/builder/aiCandidateChangeSet';
import type { TopologyChange } from '@/services/pageTopologyOrchestrator';
import type { WizardBusinessParameters } from '@/platform/core/playground';
import { getIntentDef } from '@/platform/core/intentSurfaceRegistry';
import {
  assertCanonicalComponentDefinition,
  getCanonicalComponentDefinition,
  type CanonicalComponentDefinition,
} from '@/services/canonicalComponentRegistry';
import { resolveComponentRuntimeContract, type ComponentRuntimeContract } from '@/services/componentRuntimeContract';
import { getWizardBindingMarkers } from '@/services/wizardBindingBridge';
import { getArtifact } from '@/platform/core/artifactRegistry';

export const APP_BUILDER_PROTOCOL_VERSION = 'unison-app-builder/3' as const;

export type AppBuildBusinessParameters = Pick<
  WizardBusinessParameters,
  | 'publicEmail'
  | 'phone'
  | 'tagline'
  | 'description'
  | 'website'
  | 'logoUrl'
  | 'brandColor'
  | 'timezone'
  | 'address'
  | 'hours'
  | 'socialLinks'
> & { ctaDestinations?: { call?: string; email?: string } };

export type AppBuildBusinessProfile = Pick<
  CreatorBusinessInfo,
  | 'businessName'
  | 'tagline'
  | 'description'
  | 'website'
  | 'logoUrl'
  | 'brandColor'
  | 'timezone'
  | 'phone'
  | 'email'
  | 'address'
  | 'hours'
  | 'socialLinks'
  | 'logoAssetId'
  | 'faviconAssetId'
  | 'brandProfile'
>;

const PRIVATE_ROUTING_PARAMETER_KEYS = [
  'ownerEmail',
  'notificationEmail',
  'notificationPhone',
  'crmDestination',
  'bookingOwner',
  'paymentProvider',
  'followUpChannel',
] as const;

function getPrivateRoutingValues(
  parameters: WizardBusinessParameters | undefined,
  profile: CreatorBusinessInfo | undefined,
): string[] {
  const values = PRIVATE_ROUTING_PARAMETER_KEYS.flatMap((key) => {
    const value = parameters?.[key];
    return typeof value === 'string' && value.trim() ? [value.trim()] : [];
  });
  for (const key of PRIVATE_ROUTING_PARAMETER_KEYS) {
    const value = profile?.[key];
    if (typeof value === 'string' && value.trim()) values.push(value.trim());
  }
  return [...new Set(values)].sort((left, right) => right.length - left.length);
}

function redactPrivateRoutingValues(text: string | undefined, values: readonly string[]): string | undefined {
  if (!text?.trim()) return undefined;
  return values.reduce((result, value) => {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return result.replace(new RegExp(escaped, 'gi'), '[private routing value omitted]');
  }, text.trim());
}

function projectPublicBusinessParameters(
  parameters: WizardBusinessParameters | undefined,
): AppBuildBusinessParameters {
  if (!parameters) return {};
  const {
    publicEmail, phone, tagline, description, website, logoUrl, brandColor, timezone,
    address, hours, socialLinks, ctaDestinations,
  } = parameters;
  return {
    publicEmail, phone, tagline, description, website, logoUrl, brandColor, timezone,
    address, hours, socialLinks,
    ctaDestinations: { call: ctaDestinations?.call, email: ctaDestinations?.email },
  };
}

function projectPublicBusinessProfile(profile: CreatorBusinessInfo | undefined, businessName: string): AppBuildBusinessProfile {
  if (!profile) return { businessName };
  return {
    businessName: profile.businessName,
    tagline: profile.tagline,
    description: profile.description,
    website: profile.website,
    logoUrl: profile.logoUrl,
    brandColor: profile.brandColor,
    timezone: profile.timezone,
    phone: profile.phone,
    email: profile.email,
    address: profile.address,
    hours: profile.hours,
    socialLinks: profile.socialLinks,
    logoAssetId: profile.logoAssetId,
    faviconAssetId: profile.faviconAssetId,
    brandProfile: profile.brandProfile,
  };
}

function configuredBusinessFields(
  parameters: WizardBusinessParameters | undefined,
  profile: CreatorBusinessInfo | undefined,
): string[] {
  const configured = new Set<string>();
  for (const [key, value] of Object.entries(parameters ?? {})) {
    if (hasConfiguredBusinessValue(value)) configured.add(key);
  }
  for (const [key, value] of Object.entries(profile ?? {})) {
    if (hasConfiguredBusinessValue(value)) configured.add(key);
  }
  for (const key of Object.keys(profile?.customValues ?? {})) configured.add(key);
  return [...configured].sort();
}

function hasConfiguredBusinessValue(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value !== undefined && value !== null;
}

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

export interface AppBuildIntentBinding {
  bindingId: string;
  pageId: string;
  route: string;
  elementKey?: string;
  sourceSection: string;
  sourceSlot: string;
  coreIntent: string;
  domIntent: string;
  ctaMarkers: string[];
  intentHandler: string;
  targetType: string;
  targetId: string;
  requiredCapabilities: string[];
  missingCapabilities: string[];
  componentInstanceId?: string;
  componentSlug?: string;
  componentWriteIntent?: string;
}

export interface AppBuildRegisteredComponent {
  runtime: ComponentRuntimeContract;
  label: string;
  targetType: CanonicalComponentDefinition['targetType'];
  instanceStatus: CreatorComponentInstance['status'];
  bindings: Record<string, string>;
  requiredBindingKeys: string[];
  requiredWhenCapabilitiesEnabled?: string[];
  requiredNativeFormFields?: string[];
  nativeComponentTemplate?: string;
  requiredBusinessFields: string[];
  requiredSetupSteps: string[];
}

function deriveRegisteredComponents(
  instances: readonly CreatorComponentInstance[],
  capabilities: readonly string[],
): AppBuildRegisteredComponent[] {
  return instances.flatMap((instance) => {
    if (!instance.componentSlug) return [];
    const definition = getCanonicalComponentDefinition(instance.componentSlug);
    if (!definition) {
      throw new Error(`AppBuildContract component ${instance.componentSlug} is not registered.`);
    }
    assertCanonicalComponentDefinition(definition);
    const runtime = resolveComponentRuntimeContract(instance, capabilities);
    if (!runtime) throw new Error(`AppBuildContract component ${instance.componentSlug} has no runtime contract.`);
    return [{
      runtime,
      label: instance.label,
      targetType: definition.targetType,
      instanceStatus: instance.status,
      bindings: { ...instance.bindings },
      requiredBindingKeys: [...definition.requiredBindingKeys],
      requiredWhenCapabilitiesEnabled: [...(definition.requiredWhenCapabilitiesEnabled ?? [])],
      requiredNativeFormFields: [...(definition.requiredNativeFormFields ?? [])],
      nativeComponentTemplate: definition.htmlTemplate.replace(/\sclass=/g, ' className='),
      requiredBusinessFields: [...(definition.requiredBusinessFields ?? [])],
      requiredSetupSteps: [...(definition.requiredSetupSteps ?? [])],
    }];
  }).sort((left, right) => left.runtime.instanceId.localeCompare(right.runtime.instanceId));
}

function deriveIntentBindings(
  bindings: readonly PlaygroundBinding[],
  pageRegistry: PageRegistry,
  components: readonly AppBuildRegisteredComponent[],
  enabledCapabilities: readonly string[],
): AppBuildIntentBinding[] {
  return bindings
    .filter((binding) => binding.sourceSection && binding.sourceSlot && binding.coreIntent)
    .map((binding) => {
      const page = pageRegistry.pages[binding.sourcePageId];
      const intent = getIntentDef(binding.coreIntent!);
      if (!page) throw new Error(`AppBuildContract binding ${binding.bindingId} has no registered source page.`);
      if (!intent) throw new Error(`AppBuildContract binding ${binding.bindingId} uses unregistered intent ${binding.coreIntent}.`);
      const targetKey = binding.targetType === 'form' ? 'formId'
        : binding.targetType === 'calendar' ? 'calendarId'
          : binding.targetType === 'product' ? 'productId'
            : null;
      const component = targetKey
        ? components.find((candidate) => candidate.bindings[targetKey] === binding.targetId)
        : undefined;
      const requiredCapabilities = [...new Set([
        ...(intent.requiredCapabilities ?? []),
        ...(binding.requiredCapabilities ?? []),
      ])].sort();
      return {
        bindingId: binding.bindingId,
        pageId: binding.sourcePageId,
        route: page.path || '/',
        elementKey: binding.elementKey,
        sourceSection: binding.sourceSection!,
        sourceSlot: binding.sourceSlot!,
        coreIntent: intent.name,
        domIntent: resolvePlaygroundBindingDomIntent(binding),
        ctaMarkers: getWizardBindingMarkers(binding),
        intentHandler: intent.handler,
        targetType: binding.targetType,
        targetId: binding.targetId,
        requiredCapabilities,
        missingCapabilities: requiredCapabilities.filter((capability) => !enabledCapabilities.includes(capability)),
        componentInstanceId: component?.runtime.instanceId,
        componentSlug: component?.runtime.componentSlug,
        componentWriteIntent: component?.runtime.writeIntent ?? undefined,
      };
    })
    .sort((left, right) => left.bindingId.localeCompare(right.bindingId));
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
    /** Business-provided routing/contact parameters used by registered actions. */
    parameters: AppBuildBusinessParameters;
    businessProfile: AppBuildBusinessProfile;
    /** Field names with configured values; actual private values stay server-side. */
    configuredBusinessFields: string[];
    /** Registered functional components available to own form/CRM/runtime actions. */
    registeredComponents: AppBuildRegisteredComponent[];
    /** Canonical slot bindings joined to registered intent and component contracts. */
    intentBindings: AppBuildIntentBinding[];
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
  businessParameters?: WizardBusinessParameters;
  businessProfile?: CreatorBusinessInfo;
  canonicalBindings?: readonly PlaygroundBinding[];
  registeredComponentInstances?: readonly CreatorComponentInstance[];
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
  /** Extra runtime context appended to the derived generation context. */
  runtimeContext?: string;
  maxPages?: number;
  /** Marketplace material is reference input, not an already accepted application. */
  reuseAcceptedPages?: boolean;
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
  connectorContext?: import('@/types/unisonBuilderConnector').UnisonBuilderConnectorInput;
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
  guestDemoOperationId?: string;
  /** Durable upload links/extracted text; not a substitute for image vision. */
  attachmentContext?: string;
  images?: import('@/contracts/aiComposerContract').AIComposerRequest['images'];
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
  guestDemoOperationId?: string;
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
  if (!Array.isArray(contract.business.registeredComponents) || !Array.isArray(contract.business.intentBindings)) {
    throw new Error('AppBuildContract requires structured component and intent bindings.');
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
  const privateRoutingValues = getPrivateRoutingValues(input.businessParameters, input.businessProfile);
  const registeredComponents = deriveRegisteredComponents(
    input.registeredComponentInstances ?? [],
    input.capabilities,
  );
  const intentBindings = deriveIntentBindings(
    input.canonicalBindings ?? [],
    input.pageRegistry,
    registeredComponents,
    input.capabilities,
  );
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
      visionBrief: redactPrivateRoutingValues(input.visionBrief, privateRoutingValues),
      parameters: Object.fromEntries(
        Object.entries(projectPublicBusinessParameters(input.businessParameters))
          .filter(([, value]) => value !== undefined && value !== '')
          .sort(([left], [right]) => left.localeCompare(right)),
      ) as AppBuildBusinessParameters,
      businessProfile: projectPublicBusinessProfile(input.businessProfile, input.businessName),
      configuredBusinessFields: configuredBusinessFields(input.businessParameters, input.businessProfile),
      registeredComponents,
      intentBindings,
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
