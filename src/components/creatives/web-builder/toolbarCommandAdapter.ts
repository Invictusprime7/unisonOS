/**
 * Toolbar → EditorCommandService adapter (guidebook §25).
 *
 * The floating toolbar never calls its host callbacks directly. Every button
 * issues a typed EditorCommand; the service resolves the owning lane, checks
 * the toolbar's capabilities, and dispatches to these executors, which delegate
 * to the host's commitMutation-backed handlers. One command path, one result
 * shape (§44) for toolbar, inline editor, AI and command palette.
 */
import { useCallback } from 'react';
import { toast } from 'sonner';
import { executeEditorCommand, type LaneExecutor } from '@/services/editor/editorCommandService';
import { resolvePropertyOwner } from '@/services/editor/propertyOwnerResolver';
import type { EditorCommand, EditorCommandResult, EditorCommandType } from '@/services/editor/editorCommandTypes';
import type { ResourceContext } from '@/services/resources/resourceTypes';

export interface ToolbarCommandHandlers {
  onUpdateStyles: (selector: string, styles: Record<string, string>) => void;
  onUpdateText?: (selector: string, text: string, target: EditorCommand['target']) => void | boolean | Promise<void | boolean>;
  onUpdateAttributes?: (selector: string, attributes: Record<string, string>) => void;
  onReplaceImage: (selector: string, src: string) => void;
  onDelete: (selector: string) => void;
  onDuplicate: (selector: string) => void;
  onMoveUp?: (selector: string) => void;
  onMoveDown?: (selector: string) => void;
}

function ok(command: EditorCommand, lane: EditorCommandResult['lane'], savedTo: string, changedFields: string[]): EditorCommandResult {
  return { ok: true, command: command.type, lane, savedTo, changedFields };
}

function unsupported(command: EditorCommand, lane: EditorCommandResult['lane']): EditorCommandResult {
  return { ok: false, command: command.type, lane, savedTo: null, changedFields: [], error: 'This change can’t be saved from the toolbar yet.' };
}

export function useToolbarCommands(
  handlers: ToolbarCommandHandlers,
  resource: Pick<ResourceContext, 'businessId' | 'projectId'>,
) {
  return useCallback(
    async (command: EditorCommand): Promise<EditorCommandResult> => {
      const selector = command.target.selector ?? '';

      const source: LaneExecutor = async (cmd) => {
        switch (cmd.type) {
          case 'set-text':
            if (!handlers.onUpdateText) return unsupported(cmd, 'source');
            if (await handlers.onUpdateText(selector, cmd.text, cmd.target) === false) {
              return { ok: false, command: cmd.type, lane: 'source', savedTo: null, changedFields: [], error: 'The selected text could not be saved.' };
            }
            return ok(cmd, 'source', 'page source', ['text']);
          case 'set-attribute':
            if (!handlers.onUpdateAttributes) return unsupported(cmd, 'source');
            handlers.onUpdateAttributes(selector, { [cmd.name]: cmd.value ?? '' });
            return ok(cmd, 'source', 'page source', [cmd.name]);
          case 'replace-asset':
            handlers.onReplaceImage(selector, cmd.url);
            return ok(cmd, 'source', 'page source', ['image']);
          case 'delete':
            handlers.onDelete(selector);
            return ok(cmd, 'source', 'page source', ['element']);
          case 'duplicate':
            handlers.onDuplicate(selector);
            return ok(cmd, 'source', 'page source', ['element']);
          default:
            return unsupported(cmd, 'source');
        }
      };

      const presentation: LaneExecutor = async (cmd) => {
        switch (cmd.type) {
          case 'set-style':
            handlers.onUpdateStyles(selector, cmd.styles);
            return ok(cmd, 'presentation', 'page styles', Object.keys(cmd.styles));
          case 'resize': {
            const styles: Record<string, string> = {};
            if (cmd.width) styles.width = cmd.width;
            if (cmd.height) styles.height = cmd.height;
            handlers.onUpdateStyles(selector, styles);
            return ok(cmd, 'presentation', 'page styles', Object.keys(styles));
          }
          case 'set-visibility':
            handlers.onUpdateStyles(selector, { display: cmd.visible ? 'block' : 'none' });
            return ok(cmd, 'presentation', 'page styles', ['display']);
          case 'move': {
            const move = cmd.direction === 'up' ? handlers.onMoveUp : handlers.onMoveDown;
            if (!move) return unsupported(cmd, 'presentation');
            move(selector);
            return ok(cmd, 'presentation', 'page order', ['position']);
          }
          default:
            return unsupported(cmd, 'presentation');
        }
      };

      const route: LaneExecutor = async (cmd) => {
        if (cmd.type === 'set-link' && handlers.onUpdateAttributes) {
          handlers.onUpdateAttributes(selector, { href: cmd.href });
          return ok(cmd, 'route', 'page source', ['href']);
        }
        return unsupported(cmd, 'route');
      };

      // Binding lane: intents are a canonical data-ut-intent attribute on the
      // element, saved through the same page-source commit as other attributes.
      const binding: LaneExecutor = async (cmd) => {
        if (cmd.type === 'bind-intent' && handlers.onUpdateAttributes) {
          const intent = cmd.intent.trim();
          if (!/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(intent)) {
            return { ok: false, command: cmd.type, lane: 'binding', savedTo: null, changedFields: [], error: 'That is not a valid action name.' };
          }
          handlers.onUpdateAttributes(selector, { 'data-ut-intent': intent });
          return ok(cmd, 'binding', 'page source', ['data-ut-intent']);
        }
        return unsupported(cmd, 'binding');
      };

      // M2 pending/error states. Saved-record writes are awaited, so only they
      // report "Saved"; page-source edits hand off to the queued page save,
      // which reports its own outcome — never imply persistence early.
      const lane = resolvePropertyOwner(command);
      const pending = lane === 'resource' ? toast.loading('Saving to the linked item…') : null;
      const result = await executeEditorCommand(command, {
        source: 'toolbar',
        resource: { ...resource, mode: 'builder' },
        executors: { source, presentation, route, binding },
      });
      if (pending !== null) toast.dismiss(pending);
      if (!result.ok && result.error) {
        toast.error('Could not apply that change', { description: result.error });
      } else if (result.ok && lane === 'resource') {
        const undo = result.undo;
        toast.success(`Saved to ${result.savedTo ?? 'the linked item'}`, undo
          ? { action: { label: 'Undo', onClick: () => { void undo().then(() => toast.success('Change undone')).catch(() => toast.error('Could not undo')); } } }
          : undefined);
      }
      return result;
    },
    // Handlers are stable host callbacks; rebuilding per render is cheap and safe.
    [handlers, resource],
  );
}

export type { EditorCommandType };
