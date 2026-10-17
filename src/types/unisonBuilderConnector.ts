import type { BuilderRequestEnvelope } from '@/types/builderRequestEnvelope';
import type { BuilderRegistryContext } from '@/services/builderRegistryContext';
import type { EditableSelection } from '@/services/agent-runtime/editableOwnershipResolver';
import type { EditableObjectDescriptor } from '@/services/editor/editableObjectDescriptor';
import type { AgentOperationName } from '@/services/agent-runtime/operations';

/** Projection of canonical authorities, not another registry or persistence model. */
export interface UnisonBuilderTurnContext {
  version: 'unison-builder-connector/v1';
  identity: { projectId: string | null; businessId: string | null; revisionId: string | null };
  request: BuilderRequestEnvelope | null;
  element: EnforcedElementTarget | null;
  catalog: ConnectorCatalogContext;
  registry: ConnectorRegistryContext;
  designSystem: DesignSystemConstraints;
  sourceTargets: readonly string[];
  unavailable: readonly ('element' | 'catalog' | 'registry')[];
}

export interface EnforcedElementTarget {
  selection: EditableSelection;
  descriptor: EditableObjectDescriptor | null;
  ownerKind: 'resource' | 'source' | 'unbound';
  filePath: string | null;
  resourceMark: string | null;
}

export interface ConnectorCatalogContext {
  /** Existing project-scoped Resource Runtime prompt projection; never a table dump. */
  summary: string | null;
  authority: 'agentOperations/ResourceRuntime';
}

export interface ConnectorRegistryContext {
  signature: string | null;
  industry: string | null;
  artDirectionPackId: string | null;
  allowedImplementationIds: readonly string[];
  projection: BuilderRegistryContext | null;
}

export interface DesignSystemConstraints {
  tokenNames: readonly string[];
  preserveSealedArtDirection: true;
  existingFiles: 'explicit-hunks';
  newFiles: 'complete-source';
  routerAuthority: 'PageRegistry';
}

export interface UnisonBuilderConnectorInput {
  files?: Readonly<Record<string, string>>;
  projectId?: string | null;
  businessId?: string | null;
  revisionId?: string | null;
  selection?: EditableSelection | null;
  descriptor?: EditableObjectDescriptor | null;
  sourceTargets?: readonly string[];
  requestEnvelope?: BuilderRequestEnvelope | null;
  registryContext?: BuilderRegistryContext | null;
  catalogSummary?: string | null;
}

/** The future dispatcher must use the existing registry's keys, never parallel tool names. */
export type UnisonBuilderConnectorOperation = AgentOperationName;