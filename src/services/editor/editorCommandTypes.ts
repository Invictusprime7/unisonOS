/**
 * EditorCommand vocabulary (guidebook §22). Inline editor, floating toolbar,
 * inspector, AI Builder and command palette all speak these commands.
 * This is an orchestration layer, not a data authority (§21).
 */
import type { ResourceEntityRef } from '@/services/resources/resourceTypes';
import type { AssetRef } from '@/services/assets/assetRef';

export interface EditorTarget {
  /** Preview element identity. */
  elementId?: string | null;
  selector?: string | null;
  pagePath?: string | null;
  sectionId?: string | null;
  componentPath?: string | null;
  /** Raw `data-ut-resource` mark, when the element renders a saved record field. */
  resourceMark?: string | null;
  revisionId?: string | null;
  /** M1 unified identity (see editableObjectDescriptor.ts). Optional for back-compat. */
  objectId?: string | null;
  ownerKind?: 'resource' | 'source' | 'unbound' | null;
  resourceKey?: string | null;
  recordId?: string | null;
  field?: string | null;
  /** Position among sibling repeats of the same template (0-based). */
  instanceId?: number | null;
  /** Stable source locator, e.g. "/src/pages/Home.tsx:42:6". */
  sourceLocator?: string | null;
  projectId?: string | null;
}

interface Base<T extends string> { type: T; target: EditorTarget }

export type SetTextCommand = Base<'set-text'> & { text: string };
export type SetStyleCommand = Base<'set-style'> & { styles: Record<string, string> };
export type SetAttributeCommand = Base<'set-attribute'> & { name: string; value: string | null };
export type SetLinkCommand = Base<'set-link'> & { href: string };
export type ReplaceAssetCommand = Base<'replace-asset'> & { url: string; alt?: string; assetRef?: AssetRef };
export type ResizeCommand = Base<'resize'> & { width?: string; height?: string };
export type MoveCommand = Base<'move'> & { direction: 'up' | 'down' };
export type SetVisibilityCommand = Base<'set-visibility'> & { visible: boolean };
export type DuplicateCommand = Base<'duplicate'>;
export type DeleteCommand = Base<'delete'>;
export type UpdateResourceFieldCommand = Base<'update-resource-field'> & { ref?: ResourceEntityRef; values: Record<string, unknown> };
export type InsertComponentCommand = Base<'insert-component'> & { implementationId: string; position: 'before' | 'after' };
export type CreateComponentCommand = Base<'create-component'> & { name: string; purpose: string };
export type CreatePageCommand = Base<'create-page'> & { path: string; title: string };
export type CreateOverlayCommand = Base<'create-overlay'> & { kind: 'modal' | 'drawer' | 'popover'; title: string };
export type BindIntentCommand = Base<'bind-intent'> & { intent: string; payload?: Record<string, unknown> };

export type EditorCommand =
  | SetTextCommand | SetStyleCommand | SetAttributeCommand | SetLinkCommand
  | ReplaceAssetCommand | ResizeCommand | MoveCommand | SetVisibilityCommand
  | DuplicateCommand | DeleteCommand | UpdateResourceFieldCommand
  | InsertComponentCommand | CreateComponentCommand | CreatePageCommand
  | CreateOverlayCommand | BindIntentCommand;

export type EditorCommandType = EditorCommand['type'];

/** Canonical owner a property routes to (§23). */
export type EditorOwnerLane = 'resource' | 'source' | 'presentation' | 'route' | 'binding';

export type EditorCommandSource = 'inline' | 'toolbar' | 'inspector' | 'ai' | 'command-palette';

/** One result shape for every surface (§44). */
export interface EditorCommandResult {
  ok: boolean;
  command: EditorCommandType;
  lane: EditorOwnerLane;
  /** Where it was saved, in user terms ("Services → Haircut", "/src/pages/Home.tsx"). */
  savedTo: string | null;
  changedFields: string[];
  revisionId?: string | null;
  undo?: () => Promise<void>;
  error?: string;
}
