/** Resource lane: saved record fields go through ResourceRuntime only. */
import { applyResourceOp, getResourceRecord, parseResourceProvenance } from '@/services/resources/resourceRuntime';
import { getResource } from '@/services/resources/resourceRegistry';
import { executeResourceCommandCompatible } from '@/services/project-backend/runtimeProtocol';
import type { ResourceContext, ResourceRecord } from '@/services/resources/resourceTypes';
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

export async function executeResourceCommand(command: EditorCommand, ctx: ResourceContext): Promise<EditorCommandResult> {
  const ref = (command.type === 'update-resource-field' && command.ref) || parseResourceProvenance(command.target.resourceMark);
  if (!ref) return { ok: false, command: command.type, lane: 'resource', savedTo: null, changedFields: [], error: 'This element is not linked to a saved item.' };
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
