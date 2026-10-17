/**
 * ResourceRuntime — the one read/write surface for catalog, content and the
 * business profile. Picks the adapter, enforces schema-writable fields, and
 * emits RESOURCE_INVALIDATED so live components rehydrate without a preview
 * remount. Catalog writes from the AI/command menu still go through
 * agentOperations, which delegates here for the same semantics.
 */
import { vfsEventBus } from '@/services/vfsEventBus';
import { emitAgentEvent } from '@/services/agent-runtime/agentEvents';
import { RESOURCE_ADAPTERS, filterWritableValues } from './resourceAdapters';
import { getResource } from './resourceRegistry';
import { withProjectBackend } from '@/services/project-backend/projectBackendGateway';
import { callProjectBackend } from '@/services/project-backend/projectBackendClient';
import { newEditorCorrelationId, recordMutationEvent } from '@/services/editor/editorTelemetry';
import type { ProjectBackendDescriptor } from '@/services/project-backend/projectBackendTypes';

/**
 * Dedicated sites: every resource kind goes through the private project-backend
 * connection. The gateway is the authority on which resources a dedicated
 * database supports — unknown ones get a clean rejection there, never a
 * client-side special case per adapter.
 */
function dedicated(d: ProjectBackendDescriptor | null, _def: ResourceDefinition, projectId?: string | null): projectId is string {
  if (d?.mode !== 'dedicated') return false;
  return Boolean(projectId);
}
const rec = (r: unknown): ResourceRecord => ({ ...(r as Record<string, unknown>), id: String((r as Record<string, unknown>)?.id ?? '') });
import type {
  ResourceContext, ResourceDataOp, ResourceDefinition, ResourceEntityRef, ResourceInvalidation, ResourceRecord,
} from './resourceTypes';

export const RESOURCE_INVALIDATED = 'RESOURCE_INVALIDATED' as const;

function defOrThrow(key: string): ResourceDefinition {
  const d = getResource(key);
  if (!d) throw new Error(`Unknown resource "${key}".`);
  return d;
}

export function invalidateResource(inv: ResourceInvalidation): void {
  vfsEventBus.emit<ResourceInvalidation>('resource:invalidated', inv);
  if (typeof window === 'undefined') return;
  // Generated sites listen for CATALOG_BINDINGS_CHANGED (catalogHydration
  // module) and refresh only sections bound to the touched tables.
  const message = { type: 'CATALOG_BINDINGS_CHANGED', invalidation: { type: RESOURCE_INVALIDATED, ...inv, sourceTables: inv.sourceTables ?? [] } };
  for (const iframe of document.querySelectorAll('iframe')) {
    try { iframe.contentWindow?.postMessage(message, '*'); } catch { /* cross-origin frame gone */ }
  }
}

export function onResourceInvalidated(listener: (inv: ResourceInvalidation) => void): () => void {
  return vfsEventBus.on<ResourceInvalidation>('resource:invalidated', (e) => listener(e.payload));
}

export async function queryResource(key: string, ctx: ResourceContext): Promise<ResourceRecord[]> {
  const def = defOrThrow(key);
  return withProjectBackend(ctx.projectId, async (d) => dedicated(d, def, ctx.projectId)
    ? ((await callProjectBackend<unknown[]>({ projectId: ctx.projectId, action: 'list', resource: def.key })) ?? []).map(rec)
    : RESOURCE_ADAPTERS[def.storage.adapter].query(def, ctx), ctx.siteId);
}

export async function getResourceRecord(key: string, ctx: ResourceContext, id: string): Promise<ResourceRecord | null> {
  const def = defOrThrow(key);
  return withProjectBackend(ctx.projectId, async (d) => {
    if (!dedicated(d, def, ctx.projectId)) return RESOURCE_ADAPTERS[def.storage.adapter].get(def, ctx, id);
    const r = await callProjectBackend({ projectId: ctx.projectId, action: 'get', resource: def.key, recordId: id });
    return r ? rec(r) : null;
  }, ctx.siteId);
}

export function buildDuplicateResourceValues(def: ResourceDefinition, record: ResourceRecord): Record<string, unknown> {
  const values = Object.fromEntries(def.schema
    .filter((field) => field.editable && Object.prototype.hasOwnProperty.call(record, field.key))
    .map((field) => [field.key, record[field.key]]));
  const titleField = def.schema.find((field) =>
    field.editable && ["name", "title", "question", "client_name", "author_name"].includes(field.key)
    && typeof record[field.key] === "string");

  if (titleField) values[titleField.key] = `${String(record[titleField.key])} (copy)`;
  const slugField = def.schema.find((field) => field.editable && field.key === "slug");
  if (slugField && typeof record[slugField.key] === "string") {
    values[slugField.key] = `${String(record[slugField.key])}-copy-${Date.now().toString(36)}`;
  }
  const statusField = def.schema.find((field) => field.key === "status" && field.editable);
  if (def.kind === "content" && statusField && def.lifecycle?.statuses.includes("draft")) values.status = "draft";
  return values;
}

/** Validate an op against the schema without touching storage. */
export function validateResourceOp(op: ResourceDataOp): { ok: true; def: ResourceDefinition } | { ok: false; reason: string } {
  const key = op.op === 'create' ? op.resourceKey : op.ref.resourceKey;
  const def = getResource(key);
  if (!def) return { ok: false, reason: `Unknown resource "${key}".` };
  if (op.op !== 'create' && op.ref.kind !== def.kind) {
    return { ok: false, reason: `Resource "${key}" is ${def.kind}, not ${op.ref.kind}.` };
  }
  if (op.op !== 'create' && op.ref.catalogKind && op.ref.catalogKind !== def.catalogKind) {
    return { ok: false, reason: `Resource "${key}" is ${def.catalogKind}, not ${op.ref.catalogKind}.` };
  }
  if (op.op === 'delete') {
    if (def.cardinality === 'single-record') return { ok: false, reason: `${def.label} can't be deleted.` };
    if (!RESOURCE_ADAPTERS[def.storage.adapter].delete) return { ok: false, reason: `${def.label} entries are archived, not deleted.` };
    return { ok: true, def };
  }
  if (op.op === 'create' && def.cardinality === 'single-record') return { ok: false, reason: `${def.label} already exists — edit it instead.` };
  const rejected = Object.keys(op.values).filter((k) => !(k in filterWritableValues(def, { [k]: true })));
  if (rejected.length) return { ok: false, reason: `${def.label} has no editable field ${rejected.map((k) => `"${k}"`).join(', ')}.` };
  return { ok: true, def };
}

export async function applyResourceOp(op: ResourceDataOp, ctx: ResourceContext): Promise<ResourceRecord | null> {
  if (ctx.mode !== 'builder') throw new Error('Published sites cannot change records.');
  const v = validateResourceOp(op);
  if (v.ok === false) throw new Error(v.reason);
  const { def } = v;
  // M0 telemetry: one mutation event per record write (key, op, record id).
  const correlationId = newEditorCorrelationId();
  const startedAt = Date.now();
  const adapter = RESOURCE_ADAPTERS[def.storage.adapter];
  let result: ResourceRecord | null;
  try {
    result = await withProjectBackend(ctx.projectId, async (d) => {
    if (dedicated(d, def, ctx.projectId)) {
      const pid = ctx.projectId;
      if (op.op === 'create') return rec(await callProjectBackend({ projectId: pid, action: 'create', resource: def.key, values: filterWritableValues(def, op.values) }));
      if (op.op === 'update') return rec(await callProjectBackend({ projectId: pid, action: 'update', resource: def.key, recordId: op.ref.recordId, values: filterWritableValues(def, op.values), ...(op.expected ? { expected: op.expected } : {}) }));
      await callProjectBackend({ projectId: pid, action: 'delete', resource: def.key, recordId: op.ref.recordId });
      return null;
    }
    if (op.op === 'create') return adapter.create(def, ctx, filterWritableValues(def, op.values));
    if (op.op === 'update') return adapter.update(def, ctx, op.ref.recordId, filterWritableValues(def, op.values), op.expected);
    if (!adapter.delete) throw new Error(`${def.label} can't be deleted.`);
    await adapter.delete(def, ctx, op.ref.recordId);
    return null;
    }, ctx.siteId);
  } catch (err) {
    recordMutationEvent({ correlationId, at: Date.now(), kind: 'resource-op', surface: 'resource-runtime', baseRevisionId: null, resultRevisionId: null, resourceKey: def.key, resourceOp: op.op, recordId: op.op === 'create' ? null : op.ref.recordId, ok: false, error: err instanceof Error ? err.message : String(err), durationMs: Date.now() - startedAt });
    throw err;
  }
  recordMutationEvent({ correlationId, at: Date.now(), kind: 'resource-op', surface: 'resource-runtime', baseRevisionId: null, resultRevisionId: null, resourceKey: def.key, resourceOp: op.op, recordId: op.op === 'create' ? result?.id ?? null : op.ref.recordId, ok: true, durationMs: Date.now() - startedAt });
  const recordId = op.op === 'create' ? result?.id ?? '' : op.ref.recordId;
  invalidateResource({ resourceKey: def.key, kind: def.kind, businessId: ctx.businessId, projectId: ctx.projectId ?? null, recordIds: recordId ? [recordId] : [], sourceTables: def.storage.table ? [def.storage.table] : undefined });
  emitAgentEvent({ kind: 'data_change', message: `${op.op === 'create' ? 'Added to' : op.op === 'update' ? 'Updated' : 'Removed from'} ${def.label}`, status: 'ok' });
  return result;
}

/** Parse the `data-ut-resource="key#recordId.field"` provenance attribute generated components carry. */
export function parseResourceProvenance(attr: string | null | undefined): ResourceEntityRef | null {
  const m = /^([a-z0-9:_-]+)#([^.#\s]+)(?:\.([A-Za-z0-9_]+))?$/.exec(String(attr ?? '').trim());
  if (!m) return null;
  const def = getResource(m[1]);
  if (!def) return null;
  return { resourceKey: def.key, kind: def.kind, catalogKind: def.catalogKind, recordId: m[2], field: m[3] };
}

export function formatResourceProvenance(ref: ResourceEntityRef): string {
  return `${ref.resourceKey}#${ref.recordId}${ref.field ? `.${ref.field}` : ''}`;
}
