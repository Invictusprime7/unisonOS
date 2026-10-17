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

/**
 * Generated catalog sections stamp marks with the in-memory product id/slug,
 * while the saved CMS row owns a UUID. Resolve slug marks to the real saved
 * record (scoped to this project) so WYSIWYG edits reach the CMS row instead
 * of failing gateway validation.
 */
async function resolveRecordId(ref: ResourceEntityRef, ctx: ResourceContext): Promise<string | null> {
  if (UUID_RE.test(ref.recordId)) return ref.recordId;
  const records = await executeResourceCommandCompatible<ResourceRecord[]>(ctx, {
    kind: 'resource.list', resourceKey: ref.resourceKey,
  }, () => queryResource(ref.resourceKey, ctx)).catch(() => [] as ResourceRecord[]);
  const wanted = ref.recordId.toLowerCase();
  const match = records.find((r) => String(r.id).toLowerCase() === wanted)
    ?? records.find((r) => typeof r.slug === 'string' && r.slug.toLowerCase() === wanted)
    ?? records.find((r) => typeof r.name === 'string' && r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === wanted);
  return match ? String(match.id) : null;
}

export async function executeResourceCommand(command: EditorCommand, ctx: ResourceContext): Promise<EditorCommandResult> {
  const parsed = (command.type === 'update-resource-field' && command.ref) || parseResourceProvenance(command.target.resourceMark);
  if (!parsed) return { ok: false, command: command.type, lane: 'resource', savedTo: null, changedFields: [], error: 'This element is not linked to a saved item.' };
  const recordId = await resolveRecordId(parsed, ctx);
  if (!recordId) {
    const label = getResource(parsed.resourceKey)?.label ?? parsed.resourceKey;
    return { ok: false, command: command.type, lane: 'resource', savedTo: null, changedFields: [], error: `No saved ${label} record matches this element yet. Save the site first, then try again.` };
  }
  const ref = { ...parsed, recordId };
  const values = valuesFor(command, ref.field);
  const before = await executeResourceCommandCompatible<ResourceRecord | null>(ctx, {
    kind: 'resource.get', resourceKey: ref.resourceKey, recordId: ref.recordId,
  }, () => getResourceRecord(ref.resourceKey, ctx, ref.recordId)).catch(() => null);
  await executeResourceCommandCompatible(ctx, {
    kind: 'resource.mutate', resourceKey: ref.resourceKey, action: 'update', recordId: ref.recordId, values,
  }, () => applyResourceOp({ op: 'update', ref, values }, ctx));
  const label = getResource(ref.resourceKey)?.label ?? ref.resourceKey;
  const previous = before ? Object.fromEntries(Object.keys(values).map((k) => [k, before[k]])) : null;
  return {
    ok: true, command: command.type, lane: 'resource',
    savedTo: `${label} → ${String(before?.name ?? before?.title ?? ref.recordId)}`,
    changedFields: Object.keys(values),
    undo: previous ? async () => { await applyResourceOp({ op: 'update', ref, values: previous }, ctx); } : undefined,
  };
}
