import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import { getIntentDef, type IntentHandler, type IntentSurface } from '@/platform/core/intentSurfaceRegistry';
import {
  resolveSlotBindings,
  type ResolvedSlotBinding,
  type SectionType,
  type SlotRole,
} from '@/platform/core/slotBindingPolicy';
import { CAPABILITY_REGISTRY, type CapabilityId } from '@/platform/core/capabilityRegistry';
import { resolveComponentRuntimeContract, type ComponentRuntimeContract } from '@/services/componentRuntimeContract';
import type { CreatorComponentInstance } from '@/types/creatorData';
import { getVariantById } from '@/sections/variants';
import type { VariantId } from '@/sections/variants';
import { parse } from '@babel/parser';
import { getCanonicalComponentDefinition } from '@/services/canonicalComponentRegistry';

export const GENERATED_SITE_RUNTIME_MANIFEST_VERSION = '1.0' as const;

export interface GeneratedRuntimeSlotBinding {
  slotId: string;
  slot: SlotRole;
  intent: string | null;
  source: 'slot-policy' | 'component-contract' | 'unresolved';
  section: SectionType | null;
  sectionInstanceId: string | null;
  variantId: string | null;
  policyIntent: string | null;
  status: 'ready' | 'blocked';
  blockers: string[];
}

export interface GeneratedRuntimeComponentContract extends ComponentRuntimeContract {
  bindings: Record<string, string>;
  pageLess: boolean;
  slots: GeneratedRuntimeSlotBinding[];
  capabilityProjection: ComponentCapabilityProjection;
}

export interface ComponentCapabilityProjection {
  revisionId: string | null;
  sourcePath: string | null;
  pageIds: string[];
  sectionId: string | null;
  implementationId: string | null;
  componentInstanceId: string;
  componentSlug: string;
  functional: {
    writeIntent: string | null;
    bindingId: string | null;
    formId: string | null;
    requiredFields: string[];
    requiredCapabilities: string[];
    targetResource: string | null;
  };
  validation: {
    sourceResolved: boolean;
    identityVerified: boolean;
    capabilityAuthorized: boolean;
    bindingResolved: boolean;
  };
}

export interface GeneratedRuntimeIntent {
  intent: string;
  handler: IntentHandler;
  surface: IntentSurface;
  requiredCapabilities: CapabilityId[];
  componentIds: string[];
}

export interface GeneratedRuntimeController {
  handler: IntentHandler;
  transport: 'client' | 'supabase-function' | 'external';
  functionName: string | null;
  intents: string[];
  requiredCapabilities: CapabilityId[];
}

export interface GeneratedRuntimeAgentBinding {
  agentSlug: string;
  intents: string[];
  allowedTools: string[];
  requiredCapabilities: CapabilityId[];
}

const CONTROLLER_BY_HANDLER: Record<IntentHandler, Pick<GeneratedRuntimeController, 'transport' | 'functionName'>> = {
  client: { transport: 'client', functionName: null },
  'auth-overlay': { transport: 'client', functionName: null },
  'site-runtime': { transport: 'supabase-function', functionName: 'site-runtime' },
  'intent-exec': { transport: 'supabase-function', functionName: 'intent-exec' },
  // Public generated sites dispatch workflow-backed intents through the
  // entitlement-aware executor; workflow-trigger itself requires owner auth.
  'workflow-trigger': { transport: 'supabase-function', functionName: 'intent-exec' },
  'stripe-checkout': { transport: 'supabase-function', functionName: 'create-order-checkout' },
  webhook: { transport: 'external', functionName: null },
};

/**
 * The persisted contract consumed by both Preview and published-site adapters.
 * It is intentionally transport-agnostic: it authorizes what a component may
 * read or dispatch without teaching generated UI how an adapter is implemented.
 */
export interface GeneratedSiteRuntimeManifest {
  version: typeof GENERATED_SITE_RUNTIME_MANIFEST_VERSION;
  siteId: string | null;
  snapshotId: string | null;
  enabledCapabilities: CapabilityId[];
  components: GeneratedRuntimeComponentContract[];
  reads: string[];
  intents: GeneratedRuntimeIntent[];
  controllers: GeneratedRuntimeController[];
  agents: GeneratedRuntimeAgentBinding[];
  requiredBackendFunctions: string[];
  readiness: {
    status: 'ready' | 'blocked';
    blockers: string[];
  };
  generatedAt: string;
}

export interface CompileGeneratedSiteRuntimeManifestInput {
  siteId?: string | null;
  snapshot?: Pick<SiteBundleSnapshot, 'snapshotId' | 'componentInstances' | 'vfsFiles' | 'pageRegistry' | 'bindings' | 'businessSystem' | 'meta'> | null;
  enabledCapabilities?: readonly CapabilityId[];
  /** Only supply a revision ID after its source has been accepted. */
  acceptedRevisionId?: string | null;
  generatedAt?: string;
}

interface ComponentSourceHost {
  sourcePath: string;
  componentSlug: string | null;
}

function staticJsxAttribute(attributes: any[], name: string): string | null {
  const attribute = attributes.find((entry) => entry.type === 'JSXAttribute' && entry.name?.name === name);
  if (attribute?.value?.type === 'StringLiteral') return attribute.value.value;
  if (attribute?.value?.type === 'JSXExpressionContainer'
    && attribute.value.expression?.type === 'StringLiteral') return attribute.value.expression.value;
  return null;
}

function findComponentSourceHosts(
  files: Readonly<Record<string, string>> | undefined,
  instanceId: string,
): ComponentSourceHost[] {
  const hosts: ComponentSourceHost[] = [];
  for (const [sourcePath, source] of Object.entries(files || {})) {
    if (!/\.[jt]sx?$/i.test(sourcePath)) continue;
    let ast: any;
    try {
      ast = parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
    } catch {
      continue;
    }
    const visit = (node: any): void => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'JSXOpeningElement') {
        const attributes = node.attributes ?? [];
        if (staticJsxAttribute(attributes, 'data-ut-component-instance-id') === instanceId) {
          hosts.push({ sourcePath, componentSlug: staticJsxAttribute(attributes, 'data-ut-component-slug') });
        }
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === 'object') visit(value);
      }
    };
    visit(ast.program);
  }
  return hosts;
}

function requiredFieldsForComponent(componentSlug: string): string[] {
  const definition = getCanonicalComponentDefinition(componentSlug);
  if (!definition) return [];
  try {
    const ast = parse(`const __componentTemplate = <>${definition.htmlTemplate}</>;`, {
      sourceType: 'module', plugins: ['jsx', 'typescript'],
    });
    const required = new Set<string>();
    const visit = (node: any): void => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'JSXOpeningElement') {
        const tag = node.name?.name?.toLowerCase();
        const attributes = node.attributes ?? [];
        const name = staticJsxAttribute(attributes, 'name');
        const isRequired = attributes.some((attribute: any) =>
          attribute.type === 'JSXAttribute' && attribute.name?.name === 'required'
          && (!attribute.value || attribute.value.type === 'StringLiteral' && attribute.value.value !== 'false'),
        );
        if (['input', 'textarea', 'select'].includes(tag) && name && isRequired) required.add(name);
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === 'object') visit(value);
      }
    };
    visit(ast.program);
    return [...required].sort();
  } catch {
    return [];
  }
}

function projectComponentCapability(
  instance: CreatorComponentInstance,
  contract: ComponentRuntimeContract,
  input: CompileGeneratedSiteRuntimeManifestInput,
  enabledCapabilities: readonly CapabilityId[],
): ComponentCapabilityProjection {
  const hosts = findComponentSourceHosts(input.snapshot?.vfsFiles, instance.instanceId);
  const host = hosts.length === 1 ? hosts[0] : null;
  const componentSlug = instance.componentSlug || instance.componentType;
  const usedOnPages = new Set(instance.usedOnPages || []);
  const pageIds = Object.entries(input.snapshot?.pageRegistry?.pages || {})
    .filter(([pageId, page]) => usedOnPages.has(pageId) || page.filePath === host?.sourcePath)
    .map(([pageId]) => pageId)
    .sort();
  const bindingId = Object.entries(input.snapshot?.bindings || {}).find(([, binding]) =>
    (binding as { componentInstanceId?: string }).componentInstanceId === instance.instanceId,
  )?.[0] ?? null;
  const definition = getCanonicalComponentDefinition(componentSlug);
  const bindingResolved = Boolean(definition)
    && (definition?.requiredBindingKeys ?? []).every((key) => Boolean(instance.bindings?.[key]));

  return {
    revisionId: input.acceptedRevisionId ?? input.snapshot?.meta.acceptedRevisionId ?? null,
    sourcePath: host?.sourcePath ?? null,
    pageIds,
    sectionId: readIdentity(instance, 'sectionInstanceId'),
    implementationId: readIdentity(instance, 'variantId'),
    componentInstanceId: instance.instanceId,
    componentSlug,
    functional: {
      writeIntent: contract.writeIntent,
      bindingId,
      formId: instance.bindings?.formId || null,
      requiredFields: requiredFieldsForComponent(componentSlug),
      requiredCapabilities: [...contract.requiredCapabilities],
      targetResource: instance.bindings?.formId
        || instance.bindings?.calendarId
        || instance.bindings?.productId
        || contract.catalogSurfaces[0]
        || null,
    },
    validation: {
      sourceResolved: Boolean(host),
      identityVerified: Boolean(definition && host && host.componentSlug === componentSlug),
      capabilityAuthorized: Boolean(definition)
        && contract.requiredCapabilities.every((capability) => new Set<string>(enabledCapabilities).has(capability)),
      bindingResolved,
    },
  };
}

function inferSection(instance: CreatorComponentInstance): SectionType | null {
  const candidate = instance.bindings?.sectionType || instance.props?.sectionType;
  const allowed: readonly SectionType[] = [
    'navbar', 'hero', 'services', 'pricing', 'testimonials', 'gallery', 'about', 'contact',
    'cta', 'footer', 'faq', 'stats', 'team', 'blog', 'features', 'shop-grid', 'cart',
    'checkout', 'product-detail',
  ];
  return typeof candidate === 'string' && allowed.includes(candidate as SectionType)
    ? candidate as SectionType
    : null;
}

function matchingPolicyBinding(
  bindings: ResolvedSlotBinding[],
  section: SectionType | null,
  slot: SlotRole,
): ResolvedSlotBinding | undefined {
  if (!section) return undefined;
  return bindings.find((binding) => binding.section === section && binding.slot === slot);
}

function readIdentity(
  instance: CreatorComponentInstance,
  key: 'sectionInstanceId' | 'variantId',
): string | null {
  const candidate = instance.bindings?.[key] || instance.props?.[key];
  return typeof candidate === 'string' && candidate.trim() ? candidate : null;
}

function resolveComponentSlots(
  contract: ComponentRuntimeContract,
  instance: CreatorComponentInstance,
  enabledCapabilities: CapabilityId[],
): GeneratedRuntimeSlotBinding[] {
  const policy = resolveSlotBindings(enabledCapabilities);
  const section = inferSection(instance);
  const sectionInstanceId = readIdentity(instance, 'sectionInstanceId');
  const variantId = readIdentity(instance, 'variantId');

  return contract.slotBindings.map((slot) => {
    const policyBinding = matchingPolicyBinding(policy.resolved, section, slot as SlotRole);
    const intent = contract.writeIntent || policyBinding?.intent || null;
    const intentDefinition = intent ? getIntentDef(intent) : null;
    const blockers: string[] = [];

    if (variantId) {
      const variant = getVariantById(variantId as VariantId);
      if (!variant) {
        blockers.push(`Component variant is not registered: ${variantId}.`);
      } else if (section && variant.sectionType !== section) {
        blockers.push(`Component variant ${variantId} does not match section: ${section}.`);
      }
    }

    if (!intent) {
      blockers.push(`No runtime intent is resolved for slot: ${slot}.`);
    } else if (!intentDefinition) {
      blockers.push(`Slot intent is not registered: ${intent}.`);
    } else {
      for (const capability of intentDefinition.requiredCapabilities || []) {
        if (!enabledCapabilities.includes(capability)) {
          blockers.push(`Slot intent requires capability: ${capability}.`);
        }
      }
    }

    return {
      slotId: `${instance.instanceId}:${slot}`,
      slot: slot as SlotRole,
      intent,
      source: contract.writeIntent
        ? 'component-contract'
        : policyBinding
          ? 'slot-policy'
          : 'unresolved',
      section: policyBinding?.section || section,
      sectionInstanceId,
      variantId,
      policyIntent: policyBinding?.intent || null,
      status: blockers.length === 0 ? 'ready' : 'blocked',
      blockers,
    };
  });
}

function toComponentContract(
  instance: CreatorComponentInstance,
  enabledCapabilities: CapabilityId[],
  input: CompileGeneratedSiteRuntimeManifestInput,
): GeneratedRuntimeComponentContract {
  const contract = resolveComponentRuntimeContract(instance, enabledCapabilities);
  if (!contract) {
    return {
      instanceId: instance.instanceId,
      componentSlug: instance.componentSlug || instance.componentType,
      usedOnPages: [...(instance.usedOnPages || [])],
      bindings: { ...(instance.bindings || {}) },
      pageLess: (instance.usedOnPages || []).length === 0,
      requiredCapabilities: [],
      catalogSurfaces: [],
      writeIntent: null,
      slotBindings: [],
      slots: [],
      capabilityProjection: projectComponentCapability(instance, {
        instanceId: instance.instanceId,
        componentSlug: instance.componentSlug || instance.componentType,
        usedOnPages: [...(instance.usedOnPages || [])],
        requiredCapabilities: [],
        catalogSurfaces: [],
        writeIntent: null,
        slotBindings: [],
        status: 'blocked',
        blockers: [`Component is not registered for runtime: ${instance.componentSlug || instance.componentType}.`],
      }, input, enabledCapabilities),
      status: 'blocked',
      blockers: [`Component is not registered for runtime: ${instance.componentSlug || instance.componentType}.`],
    };
  }

  const slots = resolveComponentSlots(contract, instance, enabledCapabilities);
  const blockers = [...contract.blockers, ...slots.flatMap((slot) => slot.blockers)];
  return {
    ...contract,
    bindings: { ...(instance.bindings || {}) },
    pageLess: (instance.usedOnPages || []).length === 0,
    slots,
    capabilityProjection: projectComponentCapability(instance, contract, input, enabledCapabilities),
    status: blockers.length === 0 ? 'ready' : 'blocked',
    blockers,
  };
}

export function compileGeneratedSiteRuntimeManifest(
  input: CompileGeneratedSiteRuntimeManifestInput,
): GeneratedSiteRuntimeManifest {
  const persistedCapabilities = input.snapshot?.businessSystem?.capabilities
    .filter((capability) => capability.status === 'approved' || capability.status === 'provisioned')
    .map((capability) => capability.id) ?? [];
  // Explicit caller selection (including an empty list) wins; hydration reads saved approvals only.
  const enabledCapabilities = Array.from(new Set(input.enabledCapabilities ?? persistedCapabilities)).sort();
  const components = Object.values(input.snapshot?.componentInstances || {})
    .map((instance) => toComponentContract(instance, enabledCapabilities, input));
  const reads = Array.from(new Set(components.flatMap((component) => component.catalogSurfaces))).sort();
  const intentsByName = new Map<string, GeneratedRuntimeIntent>();

  for (const component of components) {
    const componentIntents = new Set([
      component.writeIntent,
      ...component.slots.map((slot) => slot.intent),
    ]);
    for (const intent of componentIntents) {
      if (!intent) continue;
      const definition = getIntentDef(intent);
      if (!definition) continue;
      const existing = intentsByName.get(intent);
      if (existing) {
        existing.componentIds.push(component.instanceId);
      } else {
        intentsByName.set(intent, {
          intent,
          handler: definition.handler,
          surface: definition.surface,
          requiredCapabilities: [...(definition.requiredCapabilities || [])],
          componentIds: [component.instanceId],
        });
      }
    }
  }

  const blockers = components.flatMap((component) => component.blockers);
  const intents = Array.from(intentsByName.values()).sort((left, right) => left.intent.localeCompare(right.intent));
  const controllerGroups = new Map<string, GeneratedRuntimeIntent[]>();
  for (const intent of intents) {
    const controller = CONTROLLER_BY_HANDLER[intent.handler];
    const key = `${intent.handler}:${controller.transport}:${controller.functionName || ''}`;
    controllerGroups.set(key, [...(controllerGroups.get(key) || []), intent]);
  }
  const controllers = Array.from(controllerGroups.values())
    .map((controllerIntents): GeneratedRuntimeController => ({
      handler: controllerIntents[0].handler,
      ...CONTROLLER_BY_HANDLER[controllerIntents[0].handler],
      intents: controllerIntents.map((intent) => intent.intent).sort(),
      requiredCapabilities: Array.from(new Set(
        controllerIntents.flatMap((intent) => intent.requiredCapabilities),
      )).sort(),
    }))
    .sort((left, right) => left.handler.localeCompare(right.handler));
  const agents: GeneratedRuntimeAgentBinding[] = intents.some((intent) => intent.intent === 'booking.create')
    ? [{
        agentSlug: 'booking_agent',
        intents: ['booking.create'],
        allowedTools: ['calendar.check', 'calendar.book'],
        requiredCapabilities: ['booking'],
      }]
    : [];
  const requiredBackendFunctions = Array.from(new Set([
    ...enabledCapabilities.flatMap((capability) => CAPABILITY_REGISTRY[capability]?.backend.functions || []),
    ...controllers.flatMap((controller) => controller.functionName ? [controller.functionName] : []),
  ])).sort();
  return {
    version: GENERATED_SITE_RUNTIME_MANIFEST_VERSION,
    siteId: input.siteId || null,
    snapshotId: input.snapshot?.snapshotId || null,
    enabledCapabilities,
    components,
    reads,
    intents,
    controllers,
    agents,
    requiredBackendFunctions,
    readiness: {
      status: blockers.length === 0 ? 'ready' : 'blocked',
      blockers,
    },
    generatedAt: input.generatedAt || new Date().toISOString(),
  };
}