/**
 * EditableObjectDescriptor — M1 view model (guidebook §M1). NOT a data
 * authority: it only names what the user selected so the same object can be
 * found again after a rerender and routed to its one canonical owner.
 *
 * Identity precedence (never "first matching JSX tag"):
 *   1. resource mark  → resourceKey#recordId.field  (survives reorders)
 *   2. source locator + instance index among repeats of that template
 *   3. otherwise unbound → caller must offer "Choose binding" / read-only
 */
import { parseResourceProvenance } from '@/services/resources/resourceRuntime';
import type { CatalogKind } from '@/platform/core/catalogSurfaceRegistry';
import type { EditorTarget } from './editorCommandTypes';

export const OBJECT_ID_VERSION = 'v2';

/** What the preview reports about a clicked element (serialisable). */
export interface SelectionSnapshot {
  pagePath: string;
  sectionId?: string | null;
  resourceMark?: string | null;
  /** Source locator of the JSX that rendered it (data-ut-src / jsx bounds). */
  sourceLocator?: string | null;
  /** Index among siblings rendered from the same sourceLocator. */
  instanceIndex?: number | null;
  tag?: string | null;
  text?: string | null;
  projectId?: string | null;
  revisionId?: string | null;
  sourceHash?: string | null;
  astIdentity?: string | null;
  sourceRevisionId?: string | null;
}

export interface EditableObjectDescriptor {
  objectId: string;
  ownerKind: 'resource' | 'source' | 'unbound';
  pagePath: string;
  sectionId: string | null;
  resourceKey: string | null;
  catalogKind: CatalogKind | null;
  recordId: string | null;
  field: string | null;
  sourceLocator: string | null;
  instanceId: number | null;
  revisionId: string | null;
  sourceHash: string | null;
  astIdentity: string | null;
  sourceRevisionId: string | null;
  /** Why identity is uncertain, when ownerKind is 'unbound'. */
  reason?: string;
}

export function describeSelection(s: SelectionSnapshot): EditableObjectDescriptor {
  const base = {
    pagePath: s.pagePath,
    sectionId: s.sectionId ?? null,
    revisionId: s.revisionId ?? null,
    sourceHash: s.sourceHash ?? null,
    astIdentity: s.astIdentity ?? null,
    sourceRevisionId: s.sourceRevisionId ?? null,
  };
  const ref = parseResourceProvenance(s.resourceMark);
  if (ref) {
    return {
      ...base,
      objectId: `${OBJECT_ID_VERSION}:res:${ref.resourceKey}#${ref.recordId}${ref.field ? `.${ref.field}` : ''}`,
      ownerKind: 'resource', resourceKey: ref.resourceKey, catalogKind: ref.catalogKind ?? null,
      recordId: ref.recordId, field: ref.field ?? null,
      sourceLocator: s.sourceLocator ?? null, instanceId: s.instanceIndex ?? null,
    };
  }
  if (s.sourceLocator) {
    const i = s.instanceIndex ?? 0;
    return {
      ...base,
      objectId: `${OBJECT_ID_VERSION}:src:${s.pagePath}|${s.sourceLocator}|${i}|${s.sourceHash ?? ''}|${s.astIdentity ?? ''}|${s.revisionId ?? ''}`,
      ownerKind: 'source', resourceKey: null, catalogKind: null, recordId: null, field: null,
      sourceLocator: s.sourceLocator, instanceId: i,
    };
  }
  return {
    ...base,
    objectId: `${OBJECT_ID_VERSION}:unbound:${s.pagePath}|${s.sectionId ?? ''}`,
    ownerKind: 'unbound', resourceKey: null, catalogKind: null, recordId: null, field: null,
    sourceLocator: null, instanceId: null,
    reason: 'No saved-record mark or source location — choose a binding before editing.',
  };
}

/**
 * Re-find the selected object among a fresh set of snapshots after rerender.
 * Exact objectId only; returns null (never a guess) when it is gone or ambiguous.
 */
export function reacquireSelection(
  previous: EditableObjectDescriptor,
  candidates: SelectionSnapshot[],
): { descriptor: EditableObjectDescriptor; snapshot: SelectionSnapshot } | null {
  const matches = candidates
    .map((snapshot) => ({ snapshot, descriptor: describeSelection(snapshot) }))
    .filter((c) => c.descriptor.objectId === previous.objectId);
  if (matches.length !== 1 || previous.ownerKind === 'unbound') return null;
  return matches[0];
}

export function descriptorToTarget(d: EditableObjectDescriptor, extra: Partial<EditorTarget> = {}): EditorTarget {
  return {
    ...extra,
    pagePath: d.pagePath, sectionId: d.sectionId,
    objectId: d.objectId, ownerKind: d.ownerKind,
    resourceKey: d.resourceKey, catalogKind: d.catalogKind, recordId: d.recordId, field: d.field,
    instanceId: d.instanceId, sourceLocator: d.sourceLocator,
    revisionId: d.revisionId, sourceHash: d.sourceHash, astIdentity: d.astIdentity,
    sourceRevisionId: d.sourceRevisionId,
    resourceMark: d.resourceKey && d.recordId
      ? `${d.resourceKey}#${d.recordId}${d.field ? `.${d.field}` : ''}`
      : extra.resourceMark ?? null,
  };
}
