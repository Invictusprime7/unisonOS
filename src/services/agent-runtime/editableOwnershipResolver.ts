import type { EditableEntity, EditableEntityKind, EditablePropertyOwner, EditableMutationLane } from './editableEntity';
import type { SystemGraph } from './systemGraph';
import { getCatalogSurfaceByTable } from '@/platform/core/catalogSurfaceRegistry';
import { resolveArtifact } from '@/platform/core/artifactRegistry';
import { getCanonicalComponentDefinition, inferCanonicalComponentSlug } from '@/services/canonicalComponentRegistry';
import { parseResourceProvenance } from '@/services/resources/resourceRuntime';

export interface EditableSelection {
  elementId?: string | null;
  selector?: string | null;
  pageId?: string | null;
  pagePath?: string | null;
  sectionId?: string | null;
  sectionType?: string | null;
  componentType?: string | null;
  componentInstanceId?: string | null;
  artifactId?: string | null;
  registryKey?: string | null;
  bindingId?: string | null;
  bindingKey?: string | null;
  sourceTable?: string | null;
  rowId?: string | null;
  field?: string | null;
  clickedTag?: string | null;
  targetPath?: string | null;
  intents?: string[];
  primaryIntent?: string | null;
  componentPath?: string | null;
  editableRange?: { startLine: number; endLine: number } | null;
  /** Preview selection revision. A stale selection can never target a newer graph. */
  revisionId?: string | null;
  projectId?: string | null;
  /** Raw `data-ut-resource` mark (guidebook §24). */
  resourceMark?: string | null;
}

export interface CatalogBindingReference {
  id: string;
  sourceTable: string;
  pagePath?: string | null;
  sectionId?: string | null;
}

export interface ResolveEditableEntityInput {
  selectedElement: EditableSelection;
  graph: SystemGraph;
  catalogBindings?: readonly CatalogBindingReference[];
}

function canonicalEntityId(
  selected: EditableSelection,
  sourceTable: string | undefined,
  componentType: string | undefined,
  resource: ReturnType<typeof parseResourceProvenance>,
): string {
  const page = selected.pageId ?? selected.pagePath ?? selected.componentPath;
  const identity = resource
    ? ['resource', resource.resourceKey, resource.recordId, resource.field]
    : sourceTable && selected.rowId
      ? ['resource', sourceTable, selected.rowId, selected.field]
      : selected.elementId
        ? ['element', page, selected.elementId]
        : selected.componentInstanceId
          ? ['component', page, componentType, selected.componentInstanceId]
          : selected.bindingId
            ? ['binding', selected.bindingId]
            : selected.bindingKey
              ? ['slot', page, selected.bindingKey]
              : selected.primaryIntent
                ? ['intent', page, selected.primaryIntent]
                : selected.targetPath
                  ? ['route', page, selected.targetPath]
                  : selected.sectionId
                    ? ['section', page, selected.sectionId]
                    : selected.selector && (selected.componentPath || selected.pagePath)
                      ? ['source', selected.componentPath ?? selected.pagePath, selected.selector]
                      : selected.pageId
                        ? ['page', selected.pageId]
                        : selected.pagePath
                          ? ['page', selected.pagePath]
                          : selected.componentPath
                            ? ['file', selected.componentPath]
                            : null;

  if (!identity) {
    throw new Error('Selected entity has no canonical identity. Re-select it with stable page, component, or resource provenance before editing.');
  }
  return `entity:${identity.filter((part): part is string => Boolean(part)).map(encodeURIComponent).join(':')}`;
}

function classification(selected: EditableSelection, intents: string[]): { kind: EditableEntityKind; lanes: EditableMutationLane[] } {
  if (selected.sourceTable && selected.rowId) return { kind: 'catalog', lanes: ['dataOps'] };
  if (selected.clickedTag?.toLowerCase() === 'a' && selected.targetPath) return { kind: 'topology', lanes: ['routeOps'] };
  if (intents.length || selected.bindingId) return { kind: 'behavior', lanes: ['bindingOps'] };
  if (selected.field === 'icon' || selected.field === 'image' || selected.clickedTag?.toLowerCase() === 'img') return { kind: 'presentation', lanes: ['presentationOps', 'fileOps'] };
  return { kind: 'content', lanes: ['fileOps'] };
}

/**
 * Resolves ownership by provenance first. Source ownership is deliberately
 * last so a live catalog field is never silently rewritten as JSX.
 */
export function resolveEditableEntity(input: ResolveEditableEntityInput): EditableEntity {
  const selected = input.selectedElement;
  if (selected.revisionId && selected.revisionId !== input.graph.revision.id) {
    throw new Error(`Selected entity is stale (${selected.revisionId}); current revision is ${input.graph.revision.id}. Re-select it before editing.`);
  }
  const catalogSurface = selected.sourceTable ? getCatalogSurfaceByTable(selected.sourceTable) : null;
  if (selected.sourceTable && selected.rowId && !catalogSurface) {
    throw new Error(`Selected catalog source "${selected.sourceTable}" is not registered for editable data operations.`);
  }
  const sourceTable = catalogSurface?.sourceTable ?? selected.sourceTable ?? undefined;
  const resourceRef = parseResourceProvenance(selected.resourceMark);
  const registryKey = selected.registryKey ?? selected.artifactId ?? undefined;
  const artifact = [registryKey, selected.componentType, selected.sectionType]
    .filter((spelling): spelling is string => Boolean(spelling))
    .map((spelling) => resolveArtifact(spelling))
    .find((resolvedArtifact) => resolvedArtifact !== null);
  const canonicalComponentSlug = selected.componentType
    ? inferCanonicalComponentSlug(selected.componentType)
    : null;
  const canonicalComponent = canonicalComponentSlug
    ? getCanonicalComponentDefinition(canonicalComponentSlug)
    : null;
  const componentType = canonicalComponent?.componentType ?? selected.componentType ?? undefined;
  const intents = Array.from(new Set([...(selected.intents ?? []), ...(selected.primaryIntent ? [selected.primaryIntent] : [])]));
  const resolved = classification(selected, intents);
  const entity: EditableEntity = {
    id: canonicalEntityId(selected, sourceTable, componentType, resourceRef),
    revisionId: input.graph.revision.id,
    projectId: selected.projectId ?? undefined,
    kind: resolved.kind,
    pageId: selected.pageId ?? undefined,
    pagePath: selected.pagePath ?? undefined,
    sectionId: selected.sectionId ?? undefined,
    sectionType: selected.sectionType ?? undefined,
    componentInstanceId: selected.componentInstanceId ?? undefined,
    componentType,
    artifactId: artifact?.artifactId,
    elementId: selected.elementId ?? undefined,
    elementRole: selected.clickedTag ?? undefined,
    selector: selected.selector ?? undefined,
    intents,
    permissions: { readable: true, writable: true, destructive: resolved.kind === 'catalog' },
    allowedMutationLanes: resolved.lanes,
    provenance: { catalogSurface: catalogSurface?.surfaceId, bindingId: selected.bindingId ?? undefined, registryKey },
    owners: {},
  };

  if (resourceRef) {
    entity.resource = resourceRef;
    entity.owners[resourceRef.field ?? 'value'] = { kind: 'resource-field', resource: resourceRef, field: resourceRef.field };
    entity.allowedMutationLanes = ['dataOps', 'presentationOps'];
    if (selected.sectionId) entity.owners.presentation = { kind: 'presentation', presentationKey: selected.sectionId };
    if (intents.length) entity.owners.intent = { kind: 'intent-binding', intent: intents[0], bindingId: selected.bindingId ?? undefined };
    return entity;
  }

  if (sourceTable && selected.rowId) {
    if (catalogSurface) {
      entity.resource = {
        resourceKey: catalogSurface.surfaceId,
        kind: 'catalog',
        catalogKind: catalogSurface.catalogKind,
        recordId: selected.rowId,
        field: selected.field ?? undefined,
      };
    }
    const owner: EditablePropertyOwner = {
      kind: 'catalog-row', table: sourceTable, rowId: selected.rowId, resource: entity.resource,
      field: selected.field ?? undefined, bindingId: selected.bindingId ?? undefined,
    };
    entity.owners[selected.field ?? 'value'] = owner;
    if (intents.length) entity.owners.intent = { kind: 'intent-binding', intent: intents[0], bindingId: selected.bindingId ?? undefined };
    return entity;
  }

  const binding = selected.bindingId
    ? input.catalogBindings?.find((candidate) => candidate.id === selected.bindingId)
    : input.catalogBindings?.find((candidate) => candidate.pagePath === selected.pagePath && candidate.sectionId === selected.sectionId);
  if (binding) {
    entity.owners.data = { kind: 'catalog-row', table: binding.sourceTable, bindingId: binding.id };
  }

  const route = selected.clickedTag?.toLowerCase() === 'a' && selected.targetPath
    ? input.graph.routes.find((candidate) => candidate.path === selected.targetPath)
    : undefined;
  if (route) entity.owners.navigation = { kind: 'topology', pageId: route.pageId ?? undefined, routeId: route.id };
  if (intents.length) entity.owners.intent = { kind: 'intent-binding', intent: intents[0], bindingId: selected.bindingId ?? undefined };
  if (selected.sectionId) entity.owners.presentation = { kind: 'presentation', presentationKey: selected.sectionId };
  if (selected.componentPath) {
    entity.owners.source = {
      kind: 'source-file', sourcePath: selected.componentPath,
      sourceRange: selected.editableRange ?? undefined,
    };
  }
  if (Object.keys(entity.owners).length === 0) {
    entity.owners.source = { kind: 'source-file', sourcePath: selected.pagePath ?? undefined };
  }
  return entity;
}
