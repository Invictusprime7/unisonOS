/**
 * Scene Patch Engine
 * 
 * Handles all edits to the Scene with:
 * - Immutable operations
 * - Full undo/redo support
 * - AI-driven batch updates
 * - Conflict resolution
 * 
 * Patches are atomic operations that can be:
 * - Applied (forward)
 * - Reverted (backward)
 * - Serialized for persistence
 * - Merged for optimization
 */

import type {
  RootNode,
  SceneNode,
  ContainerNode,
  TextNode,
  SlotNode,
  ImageNode,
  NodeStyle,
  NodeLayout,
  PositionedNode,
} from '@/types/scene';

// Type guard for nodes with layout and style
function isPositionedNode(node: SceneNode): node is PositionedNode & SceneNode {
  return node.type !== 'root' && 'layout' in node && 'style' in node;
}

// ============================================
// PATCH TYPES
// ============================================

export type PatchOperation =
  | NodeAddPatch
  | NodeRemovePatch
  | NodeUpdatePatch
  | NodeMovePatch
  | NodeReparentPatch
  | SlotBindPatch
  | SlotUnbindPatch
  | StyleUpdatePatch
  | LayoutUpdatePatch
  | TextUpdatePatch
  | BulkUpdatePatch
  | SectionSwapPatch;

export interface BasePatch {
  id: string;
  timestamp: number;
  source: 'user' | 'ai' | 'system';
  description?: string;
}

export interface NodeAddPatch extends BasePatch {
  type: 'node:add';
  parentId: string;
  node: SceneNode;
  insertIndex?: number;
}

export interface NodeRemovePatch extends BasePatch {
  type: 'node:remove';
  nodeId: string;
  // Stored for undo
  _parentId?: string;
  _removedNode?: SceneNode;
  _insertIndex?: number;
}

export interface NodeUpdatePatch extends BasePatch {
  type: 'node:update';
  nodeId: string;
  updates: Partial<SceneNode>;
  _previousValues?: Partial<SceneNode>;
}

export interface NodeMovePatch extends BasePatch {
  type: 'node:move';
  nodeId: string;
  deltaX: number;
  deltaY: number;
}

export interface NodeReparentPatch extends BasePatch {
  type: 'node:reparent';
  nodeId: string;
  newParentId: string;
  insertIndex?: number;
  _oldParentId?: string;
  _oldIndex?: number;
}

export interface SlotBindPatch extends BasePatch {
  type: 'slot:bind';
  slotId: string;
  assetId: string;
  assetUrl: string;
  transform?: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
  _previousAsset?: SlotNode['currentAsset'];
}

export interface SlotUnbindPatch extends BasePatch {
  type: 'slot:unbind';
  slotId: string;
  _previousAsset?: SlotNode['currentAsset'];
}

export interface StyleUpdatePatch extends BasePatch {
  type: 'style:update';
  nodeId: string;
  style: Partial<NodeStyle>;
  _previousStyle?: Partial<NodeStyle>;
}

export interface LayoutUpdatePatch extends BasePatch {
  type: 'layout:update';
  nodeId: string;
  layout: Partial<NodeLayout>;
  _previousLayout?: Partial<NodeLayout>;
}

export interface TextUpdatePatch extends BasePatch {
  type: 'text:update';
  nodeId: string;
  content: string;
  _previousContent?: string;
}

export interface BulkUpdatePatch extends BasePatch {
  type: 'bulk:update';
  patches: PatchOperation[];
}

export interface SectionSwapPatch extends BasePatch {
  type: 'section:swap';
  sectionId: string;
  newVariant: string;
  _previousVariant?: string;
  _previousNodes?: SceneNode[];
}

// ============================================
// PATCH HISTORY
// ============================================

export interface PatchHistoryEntry {
  patch: PatchOperation;
  applied: boolean;
}

export interface PatchHistory {
  entries: PatchHistoryEntry[];
  currentIndex: number;
  maxSize: number;
}

// ============================================
// SCENE PATCH ENGINE
// ============================================

export class ScenePatchEngine {
  private scene: RootNode;
  private history: PatchHistory;
  private listeners: Set<(scene: RootNode, patch: PatchOperation) => void>;

  constructor(initialScene: RootNode, maxHistorySize = 100) {
    this.scene = initialScene;
    this.history = {
      entries: [],
      currentIndex: -1,
      maxSize: maxHistorySize,
    };
    this.listeners = new Set();
  }

  /**
   * Get current scene state
   */
  getScene(): RootNode {
    return this.scene;
  }

  /**
   * Apply a patch to the scene
   */
  apply(patch: PatchOperation): boolean {
    try {
      const newScene = this.applyPatch(this.scene, patch);
      
      // Clear any redo history
      if (this.history.currentIndex < this.history.entries.length - 1) {
        this.history.entries = this.history.entries.slice(0, this.history.currentIndex + 1);
      }

      // Add to history
      this.history.entries.push({ patch, applied: true });
      this.history.currentIndex++;

      // Trim history if needed
      if (this.history.entries.length > this.history.maxSize) {
        const trimCount = this.history.entries.length - this.history.maxSize;
        this.history.entries = this.history.entries.slice(trimCount);
        this.history.currentIndex -= trimCount;
      }

      this.scene = newScene;
      this.notifyListeners(patch);
      return true;

    } catch (error) {
      console.error('Failed to apply patch:', error);
      return false;
    }
  }

  /**
   * Apply multiple patches as a batch
   */
  applyBatch(patches: PatchOperation[], description?: string): boolean {
    const batchPatch: BulkUpdatePatch = {
      id: this.generateId(),
      type: 'bulk:update',
      timestamp: Date.now(),
      source: patches[0]?.source || 'system',
      description: description || `Batch update (${patches.length} changes)`,
      patches,
    };

    return this.apply(batchPatch);
  }

  /**
   * Undo last patch
   */
  undo(): boolean {
    if (this.history.currentIndex < 0) return false;

    const entry = this.history.entries[this.history.currentIndex];
    if (!entry) return false;

    try {
      const newScene = this.revertPatch(this.scene, entry.patch);
      entry.applied = false;
      this.history.currentIndex--;
      this.scene = newScene;
      this.notifyListeners(entry.patch);
      return true;
    } catch (error) {
      console.error('Failed to undo patch:', error);
      return false;
    }
  }

  /**
   * Redo last undone patch
   */
  redo(): boolean {
    if (this.history.currentIndex >= this.history.entries.length - 1) return false;

    const entry = this.history.entries[this.history.currentIndex + 1];
    if (!entry) return false;

    try {
      const newScene = this.applyPatch(this.scene, entry.patch);
      entry.applied = true;
      this.history.currentIndex++;
      this.scene = newScene;
      this.notifyListeners(entry.patch);
      return true;
    } catch (error) {
      console.error('Failed to redo patch:', error);
      return false;
    }
  }

  /**
   * Can undo?
   */
  canUndo(): boolean {
    return this.history.currentIndex >= 0;
  }

  /**
   * Can redo?
   */
  canRedo(): boolean {
    return this.history.currentIndex < this.history.entries.length - 1;
  }

  /**
   * Subscribe to scene changes
   */
  subscribe(listener: (scene: RootNode, patch: PatchOperation) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get history for debugging
   */
  getHistory(): PatchHistory {
    return { ...this.history };
  }

  // ============================================
  // PATCH APPLICATION
  // ============================================

  private applyPatch(scene: RootNode, patch: PatchOperation): RootNode {
    switch (patch.type) {
      case 'node:add':
        return this.applyNodeAdd(scene, patch);
      case 'node:remove':
        return this.applyNodeRemove(scene, patch);
      case 'node:update':
        return this.applyNodeUpdate(scene, patch);
      case 'node:move':
        return this.applyNodeMove(scene, patch);
      case 'node:reparent':
        return this.applyNodeReparent(scene, patch);
      case 'slot:bind':
        return this.applySlotBind(scene, patch);
      case 'slot:unbind':
        return this.applySlotUnbind(scene, patch);
      case 'style:update':
        return this.applyStyleUpdate(scene, patch);
      case 'layout:update':
        return this.applyLayoutUpdate(scene, patch);
      case 'text:update':
        return this.applyTextUpdate(scene, patch);
      case 'bulk:update':
        return this.applyBulkUpdate(scene, patch);
      case 'section:swap':
        return this.applySectionSwap(scene, patch);
      default:
        throw new Error(`Unknown patch type: ${(patch as PatchOperation).type}`);
    }
  }

  private applyNodeAdd(scene: RootNode, patch: NodeAddPatch): RootNode {
    return this.updateNode(scene, patch.parentId, (parent) => {
      if (!('children' in parent)) throw new Error('Parent is not a container');
      const container = parent as ContainerNode;
      const newChildren = [...container.children];
      const index = patch.insertIndex ?? newChildren.length;
      newChildren.splice(index, 0, patch.node);
      return { ...container, children: newChildren };
    });
  }

  private applyNodeRemove(scene: RootNode, patch: NodeRemovePatch): RootNode {
    const result = this.findNodeWithParent(scene, patch.nodeId);
    if (!result) throw new Error(`Node not found: ${patch.nodeId}`);

    // Store for undo
    patch._parentId = result.parent?.id || 'root';
    patch._removedNode = result.node;
    patch._insertIndex = result.index;

    return this.updateNode(scene, result.parent?.id || 'root', (parent) => {
      if (!('children' in parent)) throw new Error('Parent is not a container');
      const container = parent as ContainerNode;
      return {
        ...container,
        children: container.children.filter(c => c.id !== patch.nodeId),
      };
    });
  }

  private applyNodeUpdate(scene: RootNode, patch: NodeUpdatePatch): RootNode {
    return this.updateNode(scene, patch.nodeId, (node): SceneNode => {
      // Store previous values for undo
      const previousValues: Record<string, unknown> = {};
      for (const key of Object.keys(patch.updates)) {
        previousValues[key] = (node as unknown as Record<string, unknown>)[key];
      }
      patch._previousValues = previousValues as Partial<SceneNode>;

      return { ...node, ...patch.updates } as SceneNode;
    });
  }

  private applyNodeMove(scene: RootNode, patch: NodeMovePatch): RootNode {
    return this.updateNode(scene, patch.nodeId, (node): SceneNode => {
      if (!isPositionedNode(node)) {
        throw new Error(`Cannot move node ${node.id}: not a positioned node`);
      }
      return {
        ...node,
        layout: {
          ...node.layout,
          x: (node.layout.x || 0) + patch.deltaX,
          y: (node.layout.y || 0) + patch.deltaY,
        },
      } as SceneNode;
    });
  }

  private applyNodeReparent(scene: RootNode, patch: NodeReparentPatch): RootNode {
    const result = this.findNodeWithParent(scene, patch.nodeId);
    if (!result) throw new Error(`Node not found: ${patch.nodeId}`);

    // Store for undo
    patch._oldParentId = result.parent?.id || 'root';
    patch._oldIndex = result.index;

    // Remove from old parent
    let newScene = this.updateNode(scene, result.parent?.id || 'root', (parent) => {
      if (!('children' in parent)) throw new Error('Parent is not a container');
      const container = parent as ContainerNode;
      return {
        ...container,
        children: container.children.filter(c => c.id !== patch.nodeId),
      };
    });

    // Add to new parent
    newScene = this.updateNode(newScene, patch.newParentId, (parent) => {
      if (!('children' in parent)) throw new Error('New parent is not a container');
      const container = parent as ContainerNode;
      const newChildren = [...container.children];
      const index = patch.insertIndex ?? newChildren.length;
      newChildren.splice(index, 0, result.node);
      return { ...container, children: newChildren };
    });

    return newScene;
  }

  private applySlotBind(scene: RootNode, patch: SlotBindPatch): RootNode {
    return this.updateNode(scene, patch.slotId, (node) => {
      const slot = node as SlotNode;
      patch._previousAsset = slot.currentAsset;
      return {
        ...slot,
        currentAsset: {
          assetId: patch.assetId,
          url: patch.assetUrl,
          transform: patch.transform || { x: 0, y: 0, scale: 1, rotation: 0 },
        },
      };
    });
  }

  private applySlotUnbind(scene: RootNode, patch: SlotUnbindPatch): RootNode {
    return this.updateNode(scene, patch.slotId, (node) => {
      const slot = node as SlotNode;
      patch._previousAsset = slot.currentAsset;
      return { ...slot, currentAsset: undefined };
    });
  }

  private applyStyleUpdate(scene: RootNode, patch: StyleUpdatePatch): RootNode {
    return this.updateNode(scene, patch.nodeId, (node): SceneNode => {
      if (!isPositionedNode(node)) {
        throw new Error(`Cannot update style on node ${node.id}: not a positioned node`);
      }
      const previousStyle: Partial<NodeStyle> = {};
      for (const key of Object.keys(patch.style) as (keyof NodeStyle)[]) {
        if (node.style) {
          previousStyle[key] = node.style[key] as never;
        }
      }
      patch._previousStyle = previousStyle;

      return {
        ...node,
        style: { ...node.style, ...patch.style },
      } as SceneNode;
    });
  }

  private applyLayoutUpdate(scene: RootNode, patch: LayoutUpdatePatch): RootNode {
    return this.updateNode(scene, patch.nodeId, (node): SceneNode => {
      if (!isPositionedNode(node)) {
        throw new Error(`Cannot update layout on node ${node.id}: not a positioned node`);
      }
      const previousLayout: Partial<NodeLayout> = {};
      for (const key of Object.keys(patch.layout) as (keyof NodeLayout)[]) {
        previousLayout[key] = node.layout[key] as never;
      }
      patch._previousLayout = previousLayout;

      return {
        ...node,
        layout: { ...node.layout, ...patch.layout },
      } as SceneNode;
    });
  }

  private applyTextUpdate(scene: RootNode, patch: TextUpdatePatch): RootNode {
    return this.updateNode(scene, patch.nodeId, (node) => {
      const textNode = node as TextNode;
      patch._previousContent = textNode.content;
      return { ...textNode, content: patch.content };
    });
  }

  private applyBulkUpdate(scene: RootNode, patch: BulkUpdatePatch): RootNode {
    let newScene = scene;
    for (const subPatch of patch.patches) {
      newScene = this.applyPatch(newScene, subPatch);
    }
    return newScene;
  }

  private applySectionSwap(scene: RootNode, patch: SectionSwapPatch): RootNode {
    // Section swap is handled by replacing section content
    // This would integrate with ComponentLibrary
    return this.updateNode(scene, patch.sectionId, (node) => {
      const container = node as ContainerNode;
      patch._previousVariant = container.metadata?.variant as string;
      patch._previousNodes = container.children;
      
      return {
        ...container,
        metadata: { ...container.metadata, variant: patch.newVariant },
      };
    });
  }

  // ============================================
  // PATCH REVERSION (UNDO)
  // ============================================

  private revertPatch(scene: RootNode, patch: PatchOperation): RootNode {
    switch (patch.type) {
      case 'node:add':
        // Undo add = remove the node
        return this.updateNode(scene, patch.parentId, (parent) => {
          if (!('children' in parent)) throw new Error('Parent is not a container');
          const container = parent as ContainerNode;
          return {
            ...container,
            children: container.children.filter(c => c.id !== patch.node.id),
          };
        });

      case 'node:remove':
        // Undo remove = add the node back
        if (!patch._removedNode || !patch._parentId) {
          throw new Error('Cannot revert: missing undo data');
        }
        return this.updateNode(scene, patch._parentId, (parent) => {
          if (!('children' in parent)) throw new Error('Parent is not a container');
          const container = parent as ContainerNode;
          const newChildren = [...container.children];
          newChildren.splice(patch._insertIndex ?? newChildren.length, 0, patch._removedNode!);
          return { ...container, children: newChildren };
        });

      case 'node:update':
        if (!patch._previousValues) throw new Error('Cannot revert: missing undo data');
        return this.updateNode(scene, patch.nodeId, (node): SceneNode => {
          return { ...node, ...patch._previousValues } as SceneNode;
        });

      case 'node:move':
        // Undo move = move in opposite direction
        return this.updateNode(scene, patch.nodeId, (node): SceneNode => {
          if (!isPositionedNode(node)) {
            throw new Error(`Cannot revert move on node ${node.id}: not a positioned node`);
          }
          return {
            ...node,
            layout: {
              ...node.layout,
              x: (node.layout.x || 0) - patch.deltaX,
              y: (node.layout.y || 0) - patch.deltaY,
            },
          } as SceneNode;
        });

      case 'node:reparent':
        if (!patch._oldParentId) throw new Error('Cannot revert: missing undo data');
        // Reparent back
        return this.applyPatch(scene, {
          ...patch,
          newParentId: patch._oldParentId,
          insertIndex: patch._oldIndex,
        });

      case 'slot:bind':
        if (patch._previousAsset) {
          return this.updateNode(scene, patch.slotId, (node): SceneNode => {
            return { ...node, currentAsset: patch._previousAsset } as SceneNode;
          });
        }
        return this.updateNode(scene, patch.slotId, (node): SceneNode => {
          return { ...node, currentAsset: undefined } as SceneNode;
        });

      case 'slot:unbind':
        if (!patch._previousAsset) throw new Error('Cannot revert: missing undo data');
        return this.updateNode(scene, patch.slotId, (node): SceneNode => {
          return { ...node, currentAsset: patch._previousAsset } as SceneNode;
        });

      case 'style:update':
        if (!patch._previousStyle) throw new Error('Cannot revert: missing undo data');
        return this.updateNode(scene, patch.nodeId, (node): SceneNode => {
          if (!isPositionedNode(node)) {
            throw new Error(`Cannot revert style on node ${node.id}: not a positioned node`);
          }
          return { ...node, style: { ...node.style, ...patch._previousStyle } } as SceneNode;
        });

      case 'layout:update':
        if (!patch._previousLayout) throw new Error('Cannot revert: missing undo data');
        return this.updateNode(scene, patch.nodeId, (node): SceneNode => {
          if (!isPositionedNode(node)) {
            throw new Error(`Cannot revert layout on node ${node.id}: not a positioned node`);
          }
          return { ...node, layout: { ...node.layout, ...patch._previousLayout } } as SceneNode;
        });

      case 'text:update':
        if (patch._previousContent === undefined) throw new Error('Cannot revert: missing undo data');
        return this.updateNode(scene, patch.nodeId, (node): SceneNode => {
          return { ...node, content: patch._previousContent } as SceneNode;
        });

      case 'bulk:update':
        // Revert in reverse order
        let newScene = scene;
        for (let i = patch.patches.length - 1; i >= 0; i--) {
          newScene = this.revertPatch(newScene, patch.patches[i]);
        }
        return newScene;

      case 'section:swap':
        return this.updateNode(scene, patch.sectionId, (node) => {
          const container = node as ContainerNode;
          return {
            ...container,
            metadata: { ...container.metadata, variant: patch._previousVariant },
            children: patch._previousNodes || container.children,
          };
        });

      default:
        throw new Error(`Cannot revert unknown patch type: ${(patch as PatchOperation).type}`);
    }
  }

  // ============================================
  // TREE TRAVERSAL
  // ============================================

  private updateNode(
    scene: RootNode,
    nodeId: string,
    updater: (node: SceneNode) => SceneNode
  ): RootNode {
    if (scene.id === nodeId) {
      return updater(scene) as RootNode;
    }

    return {
      ...scene,
      children: this.updateNodeInChildren(scene.children, nodeId, updater),
    };
  }

  private updateNodeInChildren(
    children: SceneNode[],
    nodeId: string,
    updater: (node: SceneNode) => SceneNode
  ): SceneNode[] {
    return children.map(child => {
      if (child.id === nodeId) {
        return updater(child);
      }

      if ('children' in child) {
        const container = child as ContainerNode;
        return {
          ...container,
          children: this.updateNodeInChildren(container.children, nodeId, updater),
        };
      }

      return child;
    });
  }

  private findNodeWithParent(
    scene: RootNode,
    nodeId: string
  ): { node: SceneNode; parent: ContainerNode | null; index: number } | null {
    // Check root children
    for (let i = 0; i < scene.children.length; i++) {
      if (scene.children[i].id === nodeId) {
        return { node: scene.children[i], parent: scene as unknown as ContainerNode, index: i };
      }

      const result = this.findInChildren(scene.children[i], nodeId);
      if (result) return result;
    }

    return null;
  }

  private findInChildren(
    node: SceneNode,
    nodeId: string
  ): { node: SceneNode; parent: ContainerNode; index: number } | null {
    if (!('children' in node)) return null;

    const container = node as ContainerNode;
    for (let i = 0; i < container.children.length; i++) {
      if (container.children[i].id === nodeId) {
        return { node: container.children[i], parent: container, index: i };
      }

      const result = this.findInChildren(container.children[i], nodeId);
      if (result) return result;
    }

    return null;
  }

  // ============================================
  // HELPERS
  // ============================================

  private generateId(): string {
    return `patch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private notifyListeners(patch: PatchOperation): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.scene, patch);
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }
}

// ============================================
// AI PATCH HELPERS
// ============================================

/**
 * Create patches from AI edit instructions
 */
export function createPatchFromAIInstruction(
  instruction: AIEditInstruction
): PatchOperation {
  const basePatch: Omit<BasePatch, 'type'> = {
    id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    source: 'ai',
    description: instruction.description,
  };

  switch (instruction.action) {
    case 'update-text':
      return {
        ...basePatch,
        type: 'text:update',
        nodeId: instruction.targetId,
        content: instruction.value as string,
      };

    case 'update-style':
      return {
        ...basePatch,
        type: 'style:update',
        nodeId: instruction.targetId,
        style: instruction.value as Partial<NodeStyle>,
      };

    case 'update-layout':
      return {
        ...basePatch,
        type: 'layout:update',
        nodeId: instruction.targetId,
        layout: instruction.value as Partial<NodeLayout>,
      };

    case 'bind-asset':
      return {
        ...basePatch,
        type: 'slot:bind',
        slotId: instruction.targetId,
        assetId: (instruction.value as { assetId: string; url: string }).assetId,
        assetUrl: (instruction.value as { assetId: string; url: string }).url,
      };

    case 'swap-variant':
      return {
        ...basePatch,
        type: 'section:swap',
        sectionId: instruction.targetId,
        newVariant: instruction.value as string,
      };

    default:
      throw new Error(`Unknown AI action: ${instruction.action}`);
  }
}

export interface AIEditInstruction {
  action: 'update-text' | 'update-style' | 'update-layout' | 'bind-asset' | 'swap-variant';
  targetId: string;
  value: unknown;
  description?: string;
}

/**
 * Parse natural language edits into patches
 */
export function parseAIEditsToPatches(
  edits: string,
  scene: RootNode
): PatchOperation[] {
  // This would integrate with the configured AI service to parse natural language.
  // For now, return empty array
  console.log('Parsing AI edits:', edits, 'for scene:', scene.id);
  return [];
}

// ============================================
// SINGLETON
// ============================================

let patchEngine: ScenePatchEngine | null = null;

export function initPatchEngine(scene: RootNode): ScenePatchEngine {
  patchEngine = new ScenePatchEngine(scene);
  return patchEngine;
}

export function getPatchEngine(): ScenePatchEngine {
  if (!patchEngine) {
    throw new Error('Patch engine not initialized. Call initPatchEngine first.');
  }
  return patchEngine;
}
