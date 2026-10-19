/**
 * Web Builder State Management Hook
 * Centralized state management for the Web Builder
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Canvas as FabricCanvas } from 'fabric';
import { toast } from 'sonner';

export type BuilderMode = 'select' | 'edit' | 'preview' | 'pan' | 'code';
export type ViewMode = 'canvas' | 'code' | 'split' | 'changes';

/**
 * Editor layer determines what powers the visual editing surface.
 * - 'react-preview': React runtime in Sandpack iframe (PRIMARY — source of truth)
 * - 'visual-overlay': Fabric.js for drag handles, selection boxes, annotations
 * - 'wireframe': Fabric.js for spatial planning / wireframe mode
 *
 * Fabric is NEVER the rendering truth. It only provides editing affordances
 * as an overlay on top of the React preview.
 */
export type EditorLayer = 'react-preview' | 'visual-overlay' | 'wireframe';
export type DeviceType = 'desktop' | 'tablet' | 'mobile';

interface CanvasState {
  zoom: number;
  panOffset: { x: number; y: number };
  canvasHeight: number;
}

interface SelectionState {
  selectedObject: any | null;
  selectedHTMLElement: any | null;
  multiSelection: any[];
}

interface HistoryState {
  past: string[];
  future: string[];
  current: string | null;
}

interface WebBuilderState {
  // Mode states
  builderMode: BuilderMode;
  viewMode: ViewMode;
  isInteractive: boolean;
  
  /**
   * Active editor layer. Controls whether Fabric is mounted.
   * Default: 'react-preview' — Fabric is NOT loaded.
   * Only 'visual-overlay' and 'wireframe' activate Fabric.
   */
  editorLayer: EditorLayer;
  
  // Device & Viewport
  device: DeviceType;
  zoom: number;
  isFullscreen: boolean;
  
  // Panel states
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  
  // Code states
  editorCode: string;
  previewCode: string;
  
  // Selection
  selectedObject: any | null;
  selectedHTMLElement: any | null;
  
  // UI states
  isLoading: boolean;
  isSaving: boolean;
}

const DEVICE_WIDTHS: Record<DeviceType, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 375,
};

/** Whether the given editor layer requires Fabric.js to be mounted */
export function layerRequiresFabric(layer: EditorLayer): boolean {
  return layer === 'visual-overlay' || layer === 'wireframe';
}

const DEFAULT_STATE: WebBuilderState = {
  builderMode: 'select',
  viewMode: 'canvas',
  isInteractive: false,
  editorLayer: 'react-preview', // React preview is default — no Fabric
  device: 'desktop',
  zoom: 0.5,
  isFullscreen: false,
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  editorCode: '',
  previewCode: '',
  selectedObject: null,
  selectedHTMLElement: null,
  isLoading: false,
  isSaving: false,
};

export const useWebBuilderState = (fabricCanvas: FabricCanvas | null) => {
  const [state, setState] = useState<WebBuilderState>(DEFAULT_STATE);
  const historyRef = useRef<HistoryState>({ past: [], future: [], current: null });
  const maxHistorySize = 50;

  // Editor layer control
  const setEditorLayer = useCallback((layer: EditorLayer) => {
    setState(prev => ({ ...prev, editorLayer: layer }));
    console.log(`[WebBuilder] Editor layer: ${layer} (fabric: ${layerRequiresFabric(layer)})`);
  }, []);

  // Mode setters
  const setBuilderMode = useCallback((mode: BuilderMode) => {
    setState(prev => ({ ...prev, builderMode: mode }));
    
    if (fabricCanvas) {
      // Update canvas interaction based on mode
      switch (mode) {
        case 'select':
          fabricCanvas.selection = true;
          fabricCanvas.defaultCursor = 'default';
          break;
        case 'edit':
          fabricCanvas.selection = true;
          fabricCanvas.defaultCursor = 'crosshair';
          break;
        case 'preview':
          fabricCanvas.selection = false;
          fabricCanvas.defaultCursor = 'default';
          break;
        case 'pan':
          fabricCanvas.selection = false;
          fabricCanvas.defaultCursor = 'grab';
          break;
        case 'code':
          // Code mode doesn't affect canvas directly
          break;
      }
    }
  }, [fabricCanvas]);

  const setViewMode = useCallback((mode: ViewMode) => {
    setState(prev => ({ ...prev, viewMode: mode }));
  }, []);

  const setIsInteractive = useCallback((interactive: boolean) => {
    setState(prev => ({ ...prev, isInteractive: interactive }));
    
    if (fabricCanvas) {
      fabricCanvas.selection = !interactive;
      fabricCanvas.forEachObject((obj) => {
        obj.selectable = !interactive;
        obj.evented = !interactive;
      });
      fabricCanvas.renderAll();
    }
  }, [fabricCanvas]);

  // Device & Viewport
  const setDevice = useCallback((device: DeviceType) => {
    setState(prev => ({ ...prev, device }));
    
    if (fabricCanvas) {
      const width = DEVICE_WIDTHS[device];
      fabricCanvas.setDimensions({ width });
      fabricCanvas.renderAll();
    }
  }, [fabricCanvas]);

  const setZoom = useCallback((zoom: number) => {
    const clampedZoom = Math.max(0.1, Math.min(2, zoom));
    setState(prev => ({ ...prev, zoom: clampedZoom }));
    
    if (fabricCanvas) {
      fabricCanvas.setZoom(clampedZoom);
      fabricCanvas.renderAll();
    }
  }, [fabricCanvas]);

  const zoomIn = useCallback(() => {
    setZoom(state.zoom + 0.1);
  }, [state.zoom, setZoom]);

  const zoomOut = useCallback(() => {
    setZoom(state.zoom - 0.1);
  }, [state.zoom, setZoom]);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, [setZoom]);

  const toggleFullscreen = useCallback(() => {
    setState(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }));
  }, []);

  // Panel toggles
  const toggleLeftPanel = useCallback(() => {
    setState(prev => ({ ...prev, leftPanelCollapsed: !prev.leftPanelCollapsed }));
  }, []);

  const toggleRightPanel = useCallback(() => {
    setState(prev => ({ ...prev, rightPanelCollapsed: !prev.rightPanelCollapsed }));
  }, []);

  // Code management
  const setEditorCode = useCallback((code: string) => {
    setState(prev => ({ ...prev, editorCode: code }));
  }, []);

  const setPreviewCode = useCallback((code: string) => {
    setState(prev => ({ ...prev, previewCode: code }));
  }, []);

  const syncCodeToPreview = useCallback(() => {
    setState(prev => ({ ...prev, previewCode: prev.editorCode }));
  }, []);

  // Selection management
  const setSelectedObject = useCallback((obj: any | null) => {
    setState(prev => ({ ...prev, selectedObject: obj }));
  }, []);

  const setSelectedHTMLElement = useCallback((element: any | null) => {
    setState(prev => ({ ...prev, selectedHTMLElement: element }));
  }, []);

  const clearSelection = useCallback(() => {
    setState(prev => ({ ...prev, selectedObject: null, selectedHTMLElement: null }));
    fabricCanvas?.discardActiveObject();
    fabricCanvas?.renderAll();
  }, [fabricCanvas]);

  // History management
  const saveToHistory = useCallback(() => {
    if (!fabricCanvas) return;
    
    const json = JSON.stringify(fabricCanvas.toJSON());
    const history = historyRef.current;
    
    // Don't save if nothing changed
    if (history.current === json) return;
    
    // Add current to past if it exists
    if (history.current) {
      history.past.push(history.current);
      if (history.past.length > maxHistorySize) {
        history.past.shift();
      }
    }
    
    history.current = json;
    history.future = []; // Clear redo stack
  }, [fabricCanvas]);

  const undo = useCallback(() => {
    if (!fabricCanvas) return;
    const history = historyRef.current;
    
    if (history.past.length === 0) {
      toast.info('Nothing to undo');
      return;
    }
    
    // Save current to future
    if (history.current) {
      history.future.unshift(history.current);
    }
    
    // Pop from past
    const previousState = history.past.pop()!;
    history.current = previousState;
    
    fabricCanvas.loadFromJSON(JSON.parse(previousState), () => {
      fabricCanvas.renderAll();
      toast.success('Undo successful');
    });
  }, [fabricCanvas]);

  const redo = useCallback(() => {
    if (!fabricCanvas) return;
    const history = historyRef.current;
    
    if (history.future.length === 0) {
      toast.info('Nothing to redo');
      return;
    }
    
    // Save current to past
    if (history.current) {
      history.past.push(history.current);
    }
    
    // Pop from future
    const nextState = history.future.shift()!;
    history.current = nextState;
    
    fabricCanvas.loadFromJSON(JSON.parse(nextState), () => {
      fabricCanvas.renderAll();
      toast.success('Redo successful');
    });
  }, [fabricCanvas]);

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  // Object operations
  const deleteSelected = useCallback(() => {
    if (!fabricCanvas || !state.selectedObject) return;
    
    saveToHistory();
    fabricCanvas.remove(state.selectedObject);
    fabricCanvas.renderAll();
    clearSelection();
    toast.success('Element deleted');
  }, [fabricCanvas, state.selectedObject, saveToHistory, clearSelection]);

  const duplicateSelected = useCallback(() => {
    if (!fabricCanvas || !state.selectedObject) return;
    
    saveToHistory();
    state.selectedObject.clone((cloned: any) => {
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
      });
      fabricCanvas.add(cloned);
      fabricCanvas.setActiveObject(cloned);
      fabricCanvas.renderAll();
      setSelectedObject(cloned);
      toast.success('Element duplicated');
    });
  }, [fabricCanvas, state.selectedObject, saveToHistory, setSelectedObject]);

  // Loading states
  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  const setSaving = useCallback((saving: boolean) => {
    setState(prev => ({ ...prev, isSaving: saving }));
  }, []);

  // Setup canvas event listeners
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleSelectionCreated = (e: any) => {
      setSelectedObject(e.selected?.[0] || null);
    };

    const handleSelectionUpdated = (e: any) => {
      setSelectedObject(e.selected?.[0] || null);
    };

    const handleSelectionCleared = () => {
      clearSelection();
    };

    const handleObjectModified = () => {
      saveToHistory();
    };

    fabricCanvas.on('selection:created', handleSelectionCreated);
    fabricCanvas.on('selection:updated', handleSelectionUpdated);
    fabricCanvas.on('selection:cleared', handleSelectionCleared);
    fabricCanvas.on('object:modified', handleObjectModified);

    return () => {
      fabricCanvas.off('selection:created', handleSelectionCreated);
      fabricCanvas.off('selection:updated', handleSelectionUpdated);
      fabricCanvas.off('selection:cleared', handleSelectionCleared);
      fabricCanvas.off('object:modified', handleObjectModified);
    };
  }, [fabricCanvas, setSelectedObject, clearSelection, saveToHistory]);

  return {
    // State
    ...state,
    canUndo,
    canRedo,
    
    // Mode setters
    setBuilderMode,
    setViewMode,
    setIsInteractive,
    
    // Viewport
    setDevice,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    toggleFullscreen,
    
    // Editor layer
    setEditorLayer,
    
    // Panels
    toggleLeftPanel,
    toggleRightPanel,
    
    // Code
    setEditorCode,
    setPreviewCode,
    syncCodeToPreview,
    
    // Selection
    setSelectedObject,
    setSelectedHTMLElement,
    clearSelection,
    
    // History
    saveToHistory,
    undo,
    redo,
    
    // Object operations
    deleteSelected,
    duplicateSelected,
    
    // Loading
    setLoading,
    setSaving,
  };
};

export type WebBuilderStateReturn = ReturnType<typeof useWebBuilderState>;
