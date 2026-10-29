/**
 * Design Studio Integration Hook
 * 
 * Master hook that connects all Design Intent Compiler systems:
 * - Scene management via Patch Engine
 * - Design tokens and themes
 * - Component library
 * - AI prompt → mockup compilation
 * - Asset management
 * - Export functionality
 * 
 * This is the main API for the Design Studio UI.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { RootNode, SceneNode, SlotNode } from '@/types/scene';
import type { MockupSpec, DesignTokens } from '@/types/designSystem';
import { DesignIntentCompiler } from '@/services/designIntentCompiler';
import { ScenePatchEngine, PatchOperation, createPatchFromAIInstruction, AIEditInstruction } from '@/services/scenePatchEngine';
import { SceneExporter, ExportOptions, ExportResult } from '@/services/sceneExporter';
import { getTokenManager, THEME_PRESETS } from '@/services/designTokens';
import { getAssetRegistry } from '@/services/assetRegistry';
import type { Asset } from '@/types/asset';
import { getComponentLibrary } from '@/services/componentLibrary';

// ============================================
// TYPES
// ============================================

export interface DesignStudioState {
  scene: RootNode | null;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  tokens: DesignTokens;
  isCompiling: boolean;
  lastError: string | null;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
}

export interface DesignStudioActions {
  // Scene creation
  createFromPrompt: (prompt: string) => Promise<RootNode | null>;
  createFromSpec: (spec: MockupSpec) => Promise<RootNode | null>;
  loadScene: (scene: RootNode) => void;
  clearScene: () => void;

  // Selection
  selectNode: (nodeId: string | null) => void;
  hoverNode: (nodeId: string | null) => void;
  getSelectedNode: () => SceneNode | null;

  // Editing via patches
  updateText: (nodeId: string, content: string) => void;
  updateStyle: (nodeId: string, style: Record<string, unknown>) => void;
  updateLayout: (nodeId: string, layout: Record<string, unknown>) => void;
  moveNode: (nodeId: string, deltaX: number, deltaY: number) => void;
  deleteNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => string | null;

  // AI edits
  /** Resolves true only when the edit actually changed the scene. */
  applyAIEdit: (prompt: string, targetNodeId?: string) => Promise<boolean>;
  applyAIInstructions: (instructions: AIEditInstruction[]) => void;

  // Slots & Assets
  bindAssetToSlot: (slotId: string, assetId: string) => void;
  unbindSlot: (slotId: string) => void;
  uploadAsset: (file: File) => Promise<Asset | null>;
  getSlots: () => SlotNode[];

  // Themes
  applyThemePreset: (preset: string) => void;
  updateTokens: (updates: Partial<DesignTokens>) => void;

  // History
  undo: () => void;
  redo: () => void;

  // Export
  exportScene: (options?: Partial<ExportOptions>) => ExportResult | null;
  exportToTSX: () => string;
  exportToHTML: () => string;

  // Sections
  addSection: (sectionType: string, variant?: string, insertIndex?: number) => void;
  swapSectionVariant: (sectionId: string, newVariant: string) => void;
  getAvailableSections: () => Array<{ type: string; variants: string[] }>;
}

export interface UseDesignStudioReturn {
  state: DesignStudioState;
  actions: DesignStudioActions;
}

// ============================================
// EMPTY SCENE
// ============================================

function createEmptyScene(): RootNode {
  return {
    id: `scene_${Date.now()}`,
    type: 'root',
    name: 'New Design',
    visible: true,
    locked: false,
    children: [],
    canvas: {
      width: 1440,
      height: 900,
      backgroundColor: '#ffffff',
    },
  };
}

// ============================================
// HOOK
// ============================================

export function useDesignStudio(initialScene?: RootNode): UseDesignStudioReturn {
  // Core state
  const [scene, setScene] = useState<RootNode | null>(initialScene || null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Services
  const compilerRef = useRef(new DesignIntentCompiler());
  const patchEngineRef = useRef<ScenePatchEngine | null>(null);
  const tokenManager = getTokenManager();
  const assetRegistry = getAssetRegistry();
  const componentLibrary = getComponentLibrary();

  // Token state (reactive)
  const [tokens, setTokens] = useState<DesignTokens>(tokenManager.getTokens());

  // Initialize patch engine when scene changes
  useEffect(() => {
    if (scene) {
      patchEngineRef.current = new ScenePatchEngine(scene);
      patchEngineRef.current.subscribe((newScene) => {
        setScene(newScene);
        setIsDirty(true);
      });
    }
  }, [scene?.id]); // Only reinit on scene change, not every update

  // ============================================
  // SCENE CREATION
  // ============================================

  const createFromPrompt = useCallback(async (prompt: string): Promise<RootNode | null> => {
    setIsCompiling(true);
    setLastError(null);

    try {
      const result = await compilerRef.current.compileFromPrompt(prompt);
      
      if (!result.success || !result.scene) {
        setLastError(result.errors.join(', '));
        return null;
      }

      setScene(result.scene);
      setIsDirty(true);
      return result.scene;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Compilation failed';
      setLastError(message);
      return null;
    } finally {
      setIsCompiling(false);
    }
  }, []);

  const createFromSpec = useCallback(async (spec: MockupSpec): Promise<RootNode | null> => {
    setIsCompiling(true);
    setLastError(null);

    try {
      const result = compilerRef.current.compile(spec);
      
      if (!result.success || !result.scene) {
        setLastError(result.errors.join(', '));
        return null;
      }

      setScene(result.scene);
      setIsDirty(true);
      return result.scene;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Compilation failed';
      setLastError(message);
      return null;
    } finally {
      setIsCompiling(false);
    }
  }, []);

  const loadScene = useCallback((newScene: RootNode) => {
    setScene(newScene);
    setSelectedNodeId(null);
    setIsDirty(false);
  }, []);

  const clearScene = useCallback(() => {
    setScene(createEmptyScene());
    setSelectedNodeId(null);
    setIsDirty(false);
  }, []);

  // ============================================
  // SELECTION
  // ============================================

  const selectNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  const hoverNode = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId);
  }, []);

  const getSelectedNode = useCallback((): SceneNode | null => {
    if (!scene || !selectedNodeId) return null;
    return findNode(scene, selectedNodeId);
  }, [scene, selectedNodeId]);

  // ============================================
  // EDITING (via Patch Engine)
  // ============================================

  const applyPatch = useCallback((patch: Omit<PatchOperation, 'id' | 'timestamp' | 'source'>) => {
    if (!patchEngineRef.current) return;
    
    const fullPatch: PatchOperation = {
      ...patch,
      id: `patch_${Date.now()}`,
      timestamp: Date.now(),
      source: 'user',
    } as PatchOperation;

    patchEngineRef.current.apply(fullPatch);
  }, []);

  const updateText = useCallback((nodeId: string, content: string) => {
    applyPatch({
      type: 'text:update',
      nodeId,
      content,
    } as Omit<PatchOperation, 'id' | 'timestamp' | 'source'>);
  }, [applyPatch]);

  const updateStyle = useCallback((nodeId: string, style: Record<string, unknown>) => {
    applyPatch({
      type: 'style:update',
      nodeId,
      style,
    } as Omit<PatchOperation, 'id' | 'timestamp' | 'source'>);
  }, [applyPatch]);

  const updateLayout = useCallback((nodeId: string, layout: Record<string, unknown>) => {
    applyPatch({
      type: 'layout:update',
      nodeId,
      layout,
    } as Omit<PatchOperation, 'id' | 'timestamp' | 'source'>);
  }, [applyPatch]);

  const moveNode = useCallback((nodeId: string, deltaX: number, deltaY: number) => {
    applyPatch({
      type: 'node:move',
      nodeId,
      deltaX,
      deltaY,
    } as Omit<PatchOperation, 'id' | 'timestamp' | 'source'>);
  }, [applyPatch]);

  const deleteNode = useCallback((nodeId: string) => {
    applyPatch({
      type: 'node:remove',
      nodeId,
    } as Omit<PatchOperation, 'id' | 'timestamp' | 'source'>);
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  }, [applyPatch, selectedNodeId]);

  const duplicateNode = useCallback((nodeId: string): string | null => {
    if (!scene) return null;
    const node = findNode(scene, nodeId);
    if (!node) return null;

    const parent = findParent(scene, nodeId);
    if (!parent) return null;

    const clonedNode = cloneNode(node);
    
    applyPatch({
      type: 'node:add',
      parentId: parent.id,
      node: clonedNode,
    } as Omit<PatchOperation, 'id' | 'timestamp' | 'source'>);

    return clonedNode.id;
  }, [scene, applyPatch]);

  // ============================================
  // AI EDITS
  // ============================================

  const applyAIEdit = useCallback(async (prompt: string, targetNodeId?: string): Promise<boolean> => {
    if (!scene) {
      setLastError('No scene is open, so there was nothing to change.');
      return false;
    }
    let changed = false;

    setIsCompiling(true);
    setLastError(null);

    try {
      // This would send the edit to the configured AI service.
      // For now, we just log it
      console.log('AI Edit:', { prompt, targetNodeId, scene: scene.id });

      // Example: detect simple edits
      const lowerPrompt = prompt.toLowerCase();
      
      if (targetNodeId && lowerPrompt.includes('center')) {
        applyPatch({
          type: 'layout:update',
          nodeId: targetNodeId,
          layout: { alignItems: 'center', justifyContent: 'center' },
        } as Omit<PatchOperation, 'id' | 'timestamp' | 'source'>);
        changed = true;
      }

      if (targetNodeId && lowerPrompt.includes('gradient')) {
        applyPatch({
          type: 'style:update',
          nodeId: targetNodeId,
          style: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
        } as Omit<PatchOperation, 'id' | 'timestamp' | 'source'>);
        changed = true;
      }

      if (!changed) {
        setLastError('That request was not understood, so nothing was changed.');
      }
      return changed;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI edit failed';
      setLastError(message);
      return false;
    } finally {
      setIsCompiling(false);
    }
  }, [scene, applyPatch]);

  const applyAIInstructions = useCallback((instructions: AIEditInstruction[]) => {
    if (!patchEngineRef.current) return;

    const patches = instructions.map(createPatchFromAIInstruction);
    patchEngineRef.current.applyBatch(patches, 'AI bulk edit');
  }, []);

  // ============================================
  // SLOTS & ASSETS
  // ============================================

  const bindAssetToSlot = useCallback((slotId: string, assetId: string) => {
    const asset = assetRegistry.get(assetId);
    if (!asset) return;

    applyPatch({
      type: 'slot:bind',
      slotId,
      assetId,
      assetUrl: asset.url,
    } as Omit<PatchOperation, 'id' | 'timestamp' | 'source'>);
  }, [applyPatch, assetRegistry]);

  const unbindSlot = useCallback((slotId: string) => {
    applyPatch({
      type: 'slot:unbind',
      slotId,
    } as Omit<PatchOperation, 'id' | 'timestamp' | 'source'>);
  }, [applyPatch]);

  const uploadAsset = useCallback(async (file: File): Promise<Asset | null> => {
    try {
      // Use the AssetRegistry upload method which handles everything
      const result = await assetRegistry.upload({ file });
      
      if (result.success && result.asset) {
        return result.asset;
      }
      
      return null;
    } catch (error) {
      console.error('Asset upload failed:', error);
      return null;
    }
  }, [assetRegistry]);

  const getSlots = useCallback((): SlotNode[] => {
    if (!scene) return [];
    return findAllSlots(scene);
  }, [scene]);

  // ============================================
  // THEMES
  // ============================================

  const applyThemePreset = useCallback((preset: string) => {
    tokenManager.applyPreset(preset);
    setTokens(tokenManager.getTokens());

    // Update scene background based on theme
    if (scene && patchEngineRef.current) {
      const themeColors = THEME_PRESETS[preset]?.colors;
      if (themeColors) {
        applyPatch({
          type: 'node:update',
          nodeId: scene.id,
          updates: {
            canvas: {
              ...scene.canvas,
              backgroundColor: themeColors.background,
            },
          },
        } as Omit<PatchOperation, 'id' | 'timestamp' | 'source'>);
      }
    }
  }, [tokenManager, scene, applyPatch]);

  const updateTokens = useCallback((updates: Partial<DesignTokens>) => {
    // Merge updates with current tokens
    const newTokens = { ...tokens, ...updates };
    setTokens(newTokens);
  }, [tokens]);

  // ============================================
  // HISTORY
  // ============================================

  const undo = useCallback(() => {
    patchEngineRef.current?.undo();
  }, []);

  const redo = useCallback(() => {
    patchEngineRef.current?.redo();
  }, []);

  // ============================================
  // EXPORT
  // ============================================

  const exportSceneFn = useCallback((options?: Partial<ExportOptions>): ExportResult | null => {
    if (!scene) return null;
    const exporter = new SceneExporter(options);
    return exporter.export(scene);
  }, [scene]);

  const exportToTSX = useCallback((): string => {
    if (!scene) return '';
    const result = exportSceneFn({ format: 'tsx' });
    const tsxFile = result?.files.find(f => f.type === 'tsx');
    return tsxFile?.content || '';
  }, [scene, exportSceneFn]);

  const exportToHTML = useCallback((): string => {
    if (!scene) return '';
    const result = exportSceneFn({ format: 'html' });
    const htmlFile = result?.files.find(f => f.type === 'html');
    return htmlFile?.content || '';
  }, [scene, exportSceneFn]);

  // ============================================
  // SECTIONS
  // ============================================

  const addSection = useCallback((sectionType: string, variant?: string, insertIndex?: number) => {
    if (!scene) return;

    const template = variant 
      ? componentLibrary.getByVariant(sectionType as import('@/types/designSystem').SectionType, variant)
      : componentLibrary.getDefault(sectionType as import('@/types/designSystem').SectionType);
    if (!template) return;

    // Create a section node from the template
    const sectionNode: SceneNode = {
      id: `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'container',
      name: template.name,
      visible: true,
      locked: false,
      layout: {
        x: 0,
        y: 0,
        width: 1440,
        height: 600,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: [48, 24, 48, 24],
      },
      style: {
        backgroundColor: '#ffffff',
      },
      children: [],
      metadata: {
        sectionType,
        variant: variant || template.variant,
        templateId: template.id,
      },
    } as SceneNode;

    applyPatch({
      type: 'node:add',
      parentId: scene.id,
      node: sectionNode,
      insertIndex,
    } as Omit<PatchOperation, 'id' | 'timestamp' | 'source'>);
  }, [scene, componentLibrary, applyPatch]);

  const swapSectionVariant = useCallback((sectionId: string, newVariant: string) => {
    applyPatch({
      type: 'section:swap',
      sectionId,
      newVariant,
    } as Omit<PatchOperation, 'id' | 'timestamp' | 'source'>);
  }, [applyPatch]);

  const getAvailableSections = useCallback(() => {
    const allComponents = componentLibrary.getAll();
    const grouped = new Map<string, string[]>();

    allComponents.forEach(comp => {
      if (!grouped.has(comp.type)) {
        grouped.set(comp.type, []);
      }
      grouped.get(comp.type)!.push(comp.variant);
    });

    return Array.from(grouped.entries()).map(([type, variants]) => ({
      type,
      variants,
    }));
  }, [componentLibrary]);

  // ============================================
  // COMPUTED STATE
  // ============================================

  const canUndo = patchEngineRef.current?.canUndo() || false;
  const canRedo = patchEngineRef.current?.canRedo() || false;

  // ============================================
  // RETURN
  // ============================================

  return {
    state: {
      scene,
      selectedNodeId,
      hoveredNodeId,
      tokens,
      isCompiling,
      lastError,
      canUndo,
      canRedo,
      isDirty,
    },
    actions: {
      createFromPrompt,
      createFromSpec,
      loadScene,
      clearScene,
      selectNode,
      hoverNode,
      getSelectedNode,
      updateText,
      updateStyle,
      updateLayout,
      moveNode,
      deleteNode,
      duplicateNode,
      applyAIEdit,
      applyAIInstructions,
      bindAssetToSlot,
      unbindSlot,
      uploadAsset,
      getSlots,
      applyThemePreset,
      updateTokens,
      undo,
      redo,
      exportScene: exportSceneFn,
      exportToTSX,
      exportToHTML,
      addSection,
      swapSectionVariant,
      getAvailableSections,
    },
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function findNode(root: RootNode, nodeId: string): SceneNode | null {
  if (root.id === nodeId) return root;

  const search = (nodes: SceneNode[]): SceneNode | null => {
    for (const node of nodes) {
      if (node.id === nodeId) return node;
      if ('children' in node) {
        const found = search((node as { children: SceneNode[] }).children);
        if (found) return found;
      }
    }
    return null;
  };

  return search(root.children);
}

function findParent(root: RootNode, nodeId: string): SceneNode | null {
  const search = (parent: SceneNode, nodes: SceneNode[]): SceneNode | null => {
    for (const node of nodes) {
      if (node.id === nodeId) return parent;
      if ('children' in node) {
        const found = search(node, (node as { children: SceneNode[] }).children);
        if (found) return found;
      }
    }
    return null;
  };

  return search(root, root.children);
}

function findAllSlots(root: RootNode): SlotNode[] {
  const slots: SlotNode[] = [];

  const search = (nodes: SceneNode[]) => {
    for (const node of nodes) {
      if (node.type === 'slot') {
        slots.push(node as SlotNode);
      }
      if ('children' in node) {
        search((node as { children: SceneNode[] }).children);
      }
    }
  };

  search(root.children);
  return slots;
}

function cloneNode(node: SceneNode): SceneNode {
  const cloned = JSON.parse(JSON.stringify(node)) as SceneNode;
  
  // Generate new IDs
  const updateIds = (n: SceneNode) => {
    n.id = `${n.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    if ('children' in n) {
      (n as { children: SceneNode[] }).children.forEach(updateIds);
    }
  };

  updateIds(cloned);
  return cloned;
}

export default useDesignStudio;
