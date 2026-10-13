/**
 * EditorCommandService (guidebook §21). Routes each command to its canonical
 * owner: resource → ResourceRuntime; source/presentation/route/binding → the
 * host's `commitMutation`-backed executors (§26). It never writes storage
 * itself and holds no state of its own.
 */
import type { ResourceContext } from '@/services/resources/resourceTypes';
import { canIssue } from './editorCapabilities';
import { resolvePropertyOwner } from './propertyOwnerResolver';
import { executeResourceCommand } from './executors/resourceExecutor';
import { assetBelongsTo, toAssetRef } from '@/services/assets/assetRef';
import { newEditorCorrelationId, recordEditorCommandEvent, toEditorCommandEvent } from './editorTelemetry';
import type { EditorCommand, EditorCommandResult, EditorCommandSource, EditorOwnerLane } from './editorCommandTypes';

/** Host-supplied executor for lanes owned by page source / topology / bindings. */
export type LaneExecutor = (command: EditorCommand) => Promise<EditorCommandResult>;

export interface EditorCommandContext {
  source: EditorCommandSource;
  resource: ResourceContext;
  executors?: Partial<Record<Exclude<EditorOwnerLane, 'resource'>, LaneExecutor>>;
}

export async function executeEditorCommand(command: EditorCommand, ctx: EditorCommandContext): Promise<EditorCommandResult> {
  const lane = resolvePropertyOwner(command);
  const correlationId = newEditorCorrelationId();
  const startedAt = Date.now();
  const target = {
    elementId: command.target.elementId ?? null,
    selector: command.target.selector ?? null,
    pagePath: command.target.pagePath ?? null,
    sectionId: command.target.sectionId ?? null,
    resourceMark: command.target.resourceMark ?? null,
  };
  const finish = (result: EditorCommandResult): EditorCommandResult => {
    recordEditorCommandEvent(toEditorCommandEvent(correlationId, ctx.source, command.type, lane, target, result, Date.now() - startedAt));
    return result;
  };
  const fail = (error: string): EditorCommandResult => finish({ ok: false, command: command.type, lane, savedTo: null, changedFields: [], error });
  if (command.target.ownerKind === 'unbound' && !command.target.slotId) {
    return fail('This element has no stable source or resource identity and is read-only. Choose a binding before editing.');
  }
  if (!canIssue(ctx.source, command.type)) return fail(`This action isn't available from here.`);
  try {
    let cmd = command;
    if (cmd.type === 'replace-asset') {
      // §18: every image swap is validated as an AssetRef owned by this site.
      const ref = toAssetRef({ url: cmd.url, alt: cmd.alt, projectId: cmd.assetRef?.projectId ?? null, assetId: cmd.assetRef?.assetId ?? null });
      if (!assetBelongsTo(ref, ctx.resource.projectId)) return fail('That image belongs to another site.');
      cmd = { ...cmd, url: ref.url, alt: ref.alt, assetRef: ref };
    }
    if (lane === 'resource') return finish(await executeResourceCommand(cmd, ctx.resource));
    const exec = ctx.executors?.[lane];
    if (!exec) return fail('This change can’t be saved from here yet.');
    return finish(await exec(cmd));
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}
