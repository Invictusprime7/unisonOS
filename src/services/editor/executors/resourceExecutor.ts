/** Resource lane: saved record fields go through ResourceRuntime only. */
import { applyResourceOp, getResourceRecord, parseResourceProvenance, queryResource } from '@/services/resources/resourceRuntime';
import { getResource } from '@/services/resources/resourceRegistry';
import { executeResourceCommandCompatible } from '@/services/project-backend/runtimeProtocol';
import type { ResourceContext, ResourceEntityRef, ResourceRecord } from '@/services/resources/resourceTypes';
import type { EditorCommand, EditorCommandResult } from '../editorCommandTypes';

function valuesFor(command: EditorCommand, field?: string): Record<string, unknown> {
  if (command.type === 'update-resource-field') return command.values;
  const key = field ?? defaultFieldFor(command);
  if (command.type === 'set-text') return { [key]: command.text };
  if (command.type === 'replace-asset') return { [key]: command.url };
  return {};
}

/** Unmarked fields resolve from the resource schema, never a hardcoded guess. */
function defaultFieldFor(command: EditorCommand): string {
  const ref = parseResourceProvenance(command.target.resourceMark);
  const schema = ref ? getResource(ref.resourceKey)?.schema ?? [] : [];
  if (command.type === 'replace-asset') {
    return schema.find((f) => f.editable && f.type === 'image')?.key ?? 'image';
  }
  return schema.find((f) => f.editable && f.key === 'name')?.key
    ?? schema.find((f) => f.editable && f.key === 'title')?.key
    ?? schema.find((f) => f.editable && f.type === 'text')?.key
    ?? 'name';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Seed a created record with a human name derived from the element's mark slug. */
function seedValuesFor(ref: ResourceEntityRef, values: Record<string, unknown>): Record<string, unknown> {
  const schema = getResource(ref.resourceKey)?.schema ?? [];
  const nameKey = schema.find((f) => f.editable && f.key === 'name')?.key
    ?? schema.find((f) => f.editable && f.key === 'title')?.key;
  const seeded = { ...values };
  if (nameKey && seeded[nameKey] === undefined) {
    seeded[nameKey] = ref.recordId.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return seeded;
}

/**
 * Generated catalog sections stamp marks with the in-memory product id/slug,
 * while the saved CMS row owns a UUID. Resolve slug marks to the real saved
 * record (scoped to this project) so WYSIWYG edits reach the CMS row instead
 * of failing gateway validation.
 */
async function resolveRecordId(ref: ResourceEntityRef, ctx: ResourceContext): Promise<string | null> {
  if (ref.kind === 'business-profile') return ctx.businessId;
  if (UUID_RE.test(ref.recordId)) return ref.recordId;
  const listed = await executeResourceCommandCompatible<ResourceRecord[]>(ctx, {
    kind: 'resource.list', resourceKey: ref.resourceKey,
  }, () => queryResource(ref.resourceKey, ctx));
  const records = Array.isArray(listed) ? listed
    : Array.isArray((listed as { data?: unknown })?.data) ? (listed as { data: ResourceRecord[] }).data
    : [];
  const wanted = ref.recordId.toLowerCase();
  const match = records.find((r) => String(r.id).toLowerCase() === wanted)
    ?? records.find((r) => typeof r.slug === 'string' && r.slug.toLowerCase() === wanted)
    ?? records.find((r) => typeof r.name === 'string' && r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === wanted);
  return match ? String(match.id) : null;
}

/** Expected-revision check: a field is stale when it no longer holds what the editor saw (and isn't already the new value). */
export function staleFields(command: EditorCommand, before: ResourceRecord | null, values: Record<string, unknown>): string[] {
  if (!command.expected || !before) return [];
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  return Object.entries(command.expected)
    .filter(([k, seen]) => k in values && !same(before[k], seen) && !same(before[k], values[k]))
    .map(([k]) => k);
}

/** Shared scoped lookup for inspector forms and AI reads, including generated slug marks. */
export async function readEditorResource(ref: ResourceEntityRef, ctx: ResourceContext): Promise<ResourceRecord | null> {
  const recordId = await resolveRecordId(ref, ctx);
  if (!recordId) return null;
  return executeResourceCommandCompatible<ResourceRecord | null>(ctx, {
    kind: 'resource.get', resourceKey: ref.resourceKey, recordId,
  }, () => getResourceRecord(ref.resourceKey, ctx, recordId));
}

export async function executeResourceCommand(command: EditorCommand, ctx: ResourceContext): Promise<EditorCommandResult> {
  if (ctx.mode !== 'builder') return { ok: false, command: command.type, lane: 'resource', savedTo: null, changedFields: [], error: 'Published sites cannot change records.' };
  if (command.target.projectId && command.target.projectId !== ctx.projectId) {
    return { ok: false, command: command.type, lane: 'resource', savedTo: null, changedFields: [], error: 'This item belongs to another project.' };
  }
  const parsed = (command.type === 'update-resource-field' && command.ref) || parseResourceProvenance(command.target.resourceMark);
  if (!parsed) return { ok: false, command: command.type, lane: 'resource', savedTo: null, changedFields: [], error: 'This element is not linked to a saved item.' };
  const values = valuesFor(command, parsed.field);
  const label = getResource(parsed.resourceKey)?.label ?? parsed.resourceKey;
  const recordId = await resolveRecordId(parsed, ctx);
  if (!recordId) {
    // WYSIWYG edits must never be gated on a manual save: materialize the
    // record from the element's identity and apply the edit in one write.
    const created = await executeResourceCommandCompatible<ResourceRecord>(ctx, {
      kind: 'resource.mutate', resourceKey: parsed.resourceKey, action: 'create', values: seedValuesFor(parsed, values),
    }, () => applyResourceOp({ op: 'create', resourceKey: parsed.resourceKey, values: seedValuesFor(parsed, values) }, ctx)).catch(() => null);
    if (!created) {
      return { ok: false, command: command.type, lane: 'resource', savedTo: null, changedFields: [], error: `Couldn't save this ${label} edit yet — try again in a moment.` };
    }
    return {
      ok: true, command: command.type, lane: 'resource',
      savedTo: `${label} → ${String(created.name ?? created.title ?? parsed.recordId)} (created)`,
      changedFields: Object.keys(values),
      record: created,
    };
  }
  const ref = { ...parsed, recordId };
  const before = await executeResourceCommandCompatible<ResourceRecord | null>(ctx, {
    kind: 'resource.get', resourceKey: ref.resourceKey, recordId: ref.recordId,
  }, () => getResourceRecord(ref.resourceKey, ctx, ref.recordId));
  if (!before) return { ok: false, command: command.type, lane: 'resource', savedTo: null, changedFields: [], error: 'This item is no longer available in this project.' };
  const field = Object.keys(values)[0];
  const expected = command.expected ?? (command.type === 'set-text' && command.originalText !== undefined && field && typeof before[field] === 'string'
    ? { [field]: command.originalText } : undefined);
  const stale = staleFields({ ...command, expected }, before, values);
  if (stale.length) {
    return { ok: false, command: command.type, lane: 'resource', savedTo: null, changedFields: [],
      error: `This ${label} changed elsewhere (${stale.join(', ')}) since you opened it — reload to see the latest, then edit again.` };
  }
  // Guard the actual write, not just the pre-read. Concurrent changes after
  // this read must be rejected by the storage adapter's conditional update.
  const baseline = Object.fromEntries(Object.keys(values).map((key) => [key, before[key] ?? null]));
  const record = await executeResourceCommandCompatible<ResourceRecord | null>(ctx, {
    kind: 'resource.mutate', resourceKey: ref.resourceKey, action: 'update', recordId: ref.recordId, values, expected: baseline,
  }, () => applyResourceOp({ op: 'update', ref, values, expected: baseline }, ctx));
  const previous = before ? Object.fromEntries(Object.keys(values).map((k) => [k, before[k]])) : null;
  return {
    ok: true, command: command.type, lane: 'resource',
    savedTo: `${label} → ${String(before?.name ?? before?.title ?? ref.recordId)}`,
    changedFields: Object.keys(values),
    record,
    undo: previous ? async () => { await applyResourceOp({ op: 'update', ref, values: previous, expected: values }, ctx); } : undefined,
  };
}
