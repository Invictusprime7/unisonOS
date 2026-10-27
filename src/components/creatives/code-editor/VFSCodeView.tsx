import type { TerminalFileOp, CommandContext } from '@/services/terminalCommands';
/**
 * VFSCodeView — IDE-grade Code Editor with event bus, undo/redo, 
 * import graph awareness, and integrated build output.
 *
 * Architecture:
 *   ┌─ Toolbar (breadcrumbs, undo/redo, graph info, actions) ─────────┐
 *   │ ResizablePanelGroup (horizontal)                                 │
 *   │ ├── Panel 1: File Explorer (collapsible)                         │
 *   │ └── Panel 2: Tabs + Monaco Editor                                │
 *   ├─ Build Output Panel (collapsible terminal)                       │
 *   └─ Status Bar (file info, cursor, lang, undo stack, graph) ───────┘
 */

import React, { useCallback, useMemo, useState, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ModernFileExplorer } from './ModernFileExplorer';
import { ModernEditorTabs } from './ModernEditorTabs';
import VFSMonacoEditor from './VFSMonacoEditor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Layout, Plus, Eye, PanelRightClose, PanelRightOpen,
  FileCode, Loader2, Play, ChevronRight, Folder, FolderOpen,
  PanelLeftClose, PanelLeftOpen, Copy, Download, Terminal,
  Sparkles, Save, Maximize2,
  GitBranch, Circle, Braces, Hash, Type, Code2,
  Undo2, Redo2, Camera, Network, AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { VirtualNode, VirtualFile } from '@/hooks/useVirtualFileSystem';
import { getFileIcon } from '@/hooks/useVirtualFileSystem';
import { VFSTerminal } from './VFSTerminal';
import { vfsEventBus } from '@/services/vfsEventBus';
import { vfsSnapshotManager, type DiffSummary } from '@/services/vfsSnapshotManager';
import { analyzeImportGraph, getAffectedFiles, type AffectedFiles } from '@/services/importGraphAnalyzer';
import { getDependenciesForSandpack } from '@/utils/dependencyExtractor';
import { listSnapshots, type EditSnapshot } from '@/services/aiHistoryStore';

// ---------------------------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------------------------

class VFSCodeViewErrorBoundary extends Component<
  { children: ReactNode; onFallbackClick?: () => void },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: ReactNode; onFallbackClick?: () => void }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[VFSCodeView] Crashed:', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-[#0a0a14] rounded-xl border border-fuchsia-500/20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-sm p-10"
          >
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center border border-red-500/30">
              <Code2 className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Code Editor Crashed</h3>
            <p className="text-sm text-white/40 mb-6 leading-relaxed">{this.state.errorMsg || 'An unexpected error occurred while rendering the editor.'}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => this.setState({ hasError: false, errorMsg: '' })}
                className="px-5 py-2.5 text-sm font-medium bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white rounded-lg border border-white/[0.08] transition-all duration-200"
              >
                Retry
              </button>
              {this.props.onFallbackClick && (
                <button
                  onClick={this.props.onFallbackClick}
                  className="px-5 py-2.5 text-sm font-medium bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-300 rounded-lg border border-fuchsia-500/30 transition-all duration-200"
                >
                  Switch to Canvas
                </button>
              )}
            </div>
          </motion.div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Language badge colors
// ---------------------------------------------------------------------------

const LANG_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  typescript: { bg: 'bg-blue-500/15', text: 'text-blue-400', dot: 'bg-blue-400' },
  javascript: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  html: { bg: 'bg-orange-500/15', text: 'text-orange-400', dot: 'bg-orange-400' },
  css: { bg: 'bg-pink-500/15', text: 'text-pink-400', dot: 'bg-pink-400' },
  json: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  markdown: { bg: 'bg-slate-500/15', text: 'text-slate-400', dot: 'bg-slate-400' },
};

function getLangColor(lang: string) {
  return LANG_COLORS[lang] || { bg: 'bg-white/[0.06]', text: 'text-white/50', dot: 'bg-white/40' };
}

// ---------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------

function Breadcrumbs({ path, className }: { path?: string; className?: string }) {
  if (!path) return null;
  const parts = path.split('/').filter(Boolean);
  return (
    <div className={cn('flex items-center gap-0.5 text-[11px] select-none', className)}>
      {parts.map((part, i) => {
        const isLast = i === parts.length - 1;
        const isFolder = !isLast;
        return (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight className="w-3 h-3 text-white/20 flex-shrink-0" />}
            <span
              className={cn(
                'px-1 py-0.5 rounded transition-colors truncate max-w-[120px]',
                isLast ? 'text-white/80 font-medium' : 'text-white/35 hover:text-white/50',
                isFolder && 'flex items-center gap-1',
              )}
            >
              {isFolder && <Folder className="w-3 h-3 flex-shrink-0" />}
              {part}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Minimap-style file stats
// ---------------------------------------------------------------------------

function FileStats({ nodes, undoCount, redoCount, graphNodeCount }: {
  nodes: VirtualNode[];
  undoCount: number;
  redoCount: number;
  graphNodeCount: number;
}) {
  const stats = useMemo(() => {
    const files = nodes.filter((n) => n.type === 'file') as VirtualFile[];
    const folders = nodes.filter((n) => n.type === 'folder');
    let totalLines = 0;
    for (const f of files) {
      totalLines += (f.content?.split('\n').length || 0);
    }
    return { fileCount: files.length, folderCount: folders.length, totalLines };
  }, [nodes]);

  return (
    <div className="flex items-center gap-3 text-[10px] text-white/30 select-none">
      <span>{stats.fileCount} files</span>
      <span>{stats.folderCount} folders</span>
      <span>{stats.totalLines.toLocaleString()} lines</span>
      {undoCount > 0 && (
        <span className="text-cyan-400/50">{undoCount} undo</span>
      )}
      {redoCount > 0 && (
        <span className="text-cyan-400/50">{redoCount} redo</span>
      )}
      {graphNodeCount > 0 && (
        <span className="text-fuchsia-400/40 flex items-center gap-0.5">
          <Network className="w-2.5 h-2.5" />
          {graphNodeCount} deps
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Affected Files Indicator
// ---------------------------------------------------------------------------

function AffectedFilesIndicator({ affected, className }: { affected: AffectedFiles | null; className?: string }) {
  if (!affected || (affected.direct.length === 0 && affected.transitive.length === 0)) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/15', className)}>
            <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
            <span className="text-[10px] text-amber-300 font-medium">
              {affected.direct.length + affected.transitive.length} affected
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-[280px]">
          <div className="space-y-1">
            {affected.direct.length > 0 && (
              <div><span className="font-semibold">Direct:</span> {affected.direct.slice(0, 5).join(', ')}{affected.direct.length > 5 ? ` +${affected.direct.length - 5}` : ''}</div>
            )}
            {affected.transitive.length > 0 && (
              <div><span className="font-semibold">Transitive:</span> {affected.transitive.slice(0, 5).join(', ')}{affected.transitive.length > 5 ? ` +${affected.transitive.length - 5}` : ''}</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VFSCodeViewProps {
  /** Builder draft whose canonical AI snapshots can be reviewed in this VFS. */
  historyDraftId?: string | null;
  // VFS state
  nodes: VirtualNode[];
  activeFileId: string;
  hasFiles: boolean;

  // VFS actions
  openFile: (id: string) => void;
  closeTab: (id: string) => void;
  createFile: (name: string, parentId: string | null) => void;
  createFolder: (name: string, parentId: string | null) => void;
  deleteNode: (id: string) => void;
  renameNode: (id: string, newName: string) => void;
  duplicateNode: (id: string) => void;
  toggleFolder: (id: string) => void;
  expandAll?: () => void;
  collapseAll?: () => void;
  getActiveFile: () => VirtualFile | undefined;
  getOpenFiles: () => VirtualFile[];
  updateFileContent: (id: string, content: string) => void;
  importFiles: (files: Record<string, string>) => void;
  loadDefaultTemplate: () => void;
  getSandpackFiles: () => Record<string, string>;

  // UI indicators
  modifiedFiles: Set<string>;
  aiGeneratedFiles: Set<string>;
  recentlyChangedFiles: Set<string>;
  isAIProcessing?: boolean;

  // Snapshot / Undo-Redo
  onUndo?: () => boolean;
  onRedo?: () => boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  undoCount?: number;
  redoCount?: number;
  onCreateSnapshot?: (label: string) => string;

  // Callbacks
  onFileModified?: (fileId: string, content: string, previousContent?: string) => void;
  onBeforeVfsMutation?: (label: string, beforeFiles: Record<string, string>) => void;
  onSave?: (fileId: string, content: string) => void;
  onSwitchToCanvas?: () => void;
  /** Terminal file commands commit through the host's canonical writer. */
  onTerminalPatch?: CommandContext['onPatch'];
  getRevisionInfo?: CommandContext['getRevisionInfo'];
  /** Canvas preview rendered in a resizable pane beside the editor (Split mode). */
  previewSlot?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VFSCodeView({
  historyDraftId,
  nodes,
  activeFileId,
  hasFiles,
  openFile,
  closeTab,
  createFile,
  createFolder,
  deleteNode,
  renameNode,
  duplicateNode,
  toggleFolder,
  expandAll,
  collapseAll,
  getActiveFile,
  getOpenFiles,
  updateFileContent,
  importFiles,
  loadDefaultTemplate,
  getSandpackFiles,
  modifiedFiles,
  aiGeneratedFiles,
  recentlyChangedFiles,
  isAIProcessing = false,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  undoCount = 0,
  redoCount = 0,
  onCreateSnapshot,
  onFileModified,
  onBeforeVfsMutation,
  onSave,
  onSwitchToCanvas,
  onTerminalPatch,
  getRevisionInfo,
  previewSlot,
}: VFSCodeViewProps) {
  const [showExplorer, setShowExplorer] = useState(true);
  const [terminalCollapsed, setTerminalCollapsed] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(null);
  const snapshots = useMemo(() => listSnapshots(historyDraftId), [historyDraftId, nodes]);
  const selectedSnapshot = useMemo<EditSnapshot | null>(
    () => snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? snapshots[0] ?? null,
    [snapshots, selectedSnapshotId],
  );
  const changedReviewPaths = selectedSnapshot?.changedPaths?.filter((path) =>
    selectedSnapshot.before[path] !== selectedSnapshot.after[path],
  ) ?? [];
  const activeReviewPath = selectedDiffPath && changedReviewPaths.includes(selectedDiffPath)
    ? selectedDiffPath
    : changedReviewPaths[0] ?? null;

  useEffect(() => {
    if (!selectedSnapshotId && snapshots[0]) setSelectedSnapshotId(snapshots[0].id);
  }, [selectedSnapshotId, snapshots]);

  useEffect(() => {
    if (activeReviewPath !== selectedDiffPath) setSelectedDiffPath(activeReviewPath);
  }, [activeReviewPath, selectedDiffPath]);

  // Derive active file
  const activeFile = useMemo(() => getActiveFile(), [getActiveFile, activeFileId, nodes]);
  const projectFiles = useMemo(() => getSandpackFiles(), [getSandpackFiles, nodes]);

  // Open files for tabs
  const openFiles = useMemo(() => getOpenFiles(), [getOpenFiles, nodes, activeFileId]);

  const previewDependencies = useMemo(
    () => getDependenciesForSandpack(getSandpackFiles()).dependencies,
    [getSandpackFiles, nodes],
  );

  const updatePackageManifest = useCallback((
    mutate: (dependencies: Record<string, string>, devDependencies: Record<string, string>) => void,
  ) => {
    const files = getSandpackFiles();
    const raw = files['/package.json'] || files['package.json'];
    let manifest: Record<string, unknown> = {
      name: 'unison-vfs-site',
      private: true,
      version: '0.0.0',
    };
    if (raw) {
      try {
        manifest = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        // Replace malformed package metadata with a valid VFS manifest.
      }
    }
    const dependencies = {
      ...((manifest.dependencies && typeof manifest.dependencies === 'object')
        ? manifest.dependencies as Record<string, string>
        : {}),
    };
    const devDependencies = {
      ...((manifest.devDependencies && typeof manifest.devDependencies === 'object')
        ? manifest.devDependencies as Record<string, string>
        : {}),
    };
    mutate(dependencies, devDependencies);
    // canonical-vfs-exempt: dependency manifest write, not site content
    importFiles({
      '/package.json': JSON.stringify({ ...manifest, dependencies, devDependencies }, null, 2),
    });
  }, [getSandpackFiles, importFiles]);

  const handleAddDependency = useCallback((pkg: string, version: string) => {
    updatePackageManifest((dependencies) => {
      dependencies[pkg] = version;
    });
  }, [updatePackageManifest]);

  const handleRemoveDependency = useCallback((pkg: string) => {
    updatePackageManifest((dependencies, devDependencies) => {
      delete dependencies[pkg];
      delete devDependencies[pkg];
    });
  }, [updatePackageManifest]);

  // Tab data
  const tabs = useMemo(
    () =>
      openFiles.map((f) => ({
        id: f.id,
        name: f.name,
        path: f.path,
        isModified: modifiedFiles.has(f.id),
        isAIGenerated: aiGeneratedFiles.has(f.id),
      })),
    [openFiles, modifiedFiles, aiGeneratedFiles],
  );

  // Language info for status bar
  const langInfo = useMemo(() => {
    if (!activeFile) return null;
    const lang = activeFile.language || 'plaintext';
    const lines = activeFile.content?.split('\n').length || 0;
    const chars = activeFile.content?.length || 0;
    return { lang, lines, chars };
  }, [activeFile]);

  // Import graph — compute lazily on file changes
  const importGraph = useMemo(() => {
    const files = getSandpackFiles();
    try {
      return analyzeImportGraph(files);
    } catch {
      return null;
    }
  }, [getSandpackFiles, nodes]);

  // Affected files for the active file
  const affectedFiles = useMemo((): AffectedFiles | null => {
    if (!activeFile?.path) return null;
    try {
      const files = getSandpackFiles();
      return getAffectedFiles(activeFile.path, files);
    } catch {
      return null;
    }
  }, [activeFile, getSandpackFiles, nodes]);

  // Close helpers
  const handleCloseOthers = useCallback(
    (keepId: string) => {
      openFiles.filter((f) => f.id !== keepId).forEach((f) => closeTab(f.id));
    },
    [openFiles, closeTab],
  );

  const handleCloseAll = useCallback(() => {
    openFiles.forEach((f) => closeTab(f.id));
  }, [openFiles, closeTab]);

  // File edit handler — emit event + track modification
  const handleFileChange = useCallback(
    (value: string) => {
      if (!activeFile) return;
      const previousContent = activeFile.content;
      updateFileContent(activeFile.id, value);
      onFileModified?.(activeFile.id, value, previousContent);

      // Emit file update event
      vfsEventBus.emit('file:updated', {
        path: activeFile.path,
        content: value,
        previousContent: activeFile.content,
        source: 'user',
      });
    },
    [activeFile, updateFileContent, onFileModified],
  );

  // Save handler
  const handleSave = useCallback(
    (value: string) => {
      if (!activeFile) return;
      updateFileContent(activeFile.id, value);
      onSave?.(activeFile.id, value);
    },
    [activeFile, updateFileContent, onSave],
  );

  // Copy file content
  const handleCopy = useCallback(() => {
    if (activeFile?.content) {
      navigator.clipboard.writeText(activeFile.content);
    }
  }, [activeFile]);

  // Undo/Redo handlers
  const handleUndo = useCallback(() => {
    if (onUndo) return onUndo();
    return false;
  }, [onUndo]);

  const handleRedo = useCallback(() => {
    if (onRedo) return onRedo();
    return false;
  }, [onRedo]);

  // Snapshot handler
  const handleSnapshot = useCallback(() => {
    if (onCreateSnapshot) {
      onCreateSnapshot(`Manual snapshot — ${new Date().toLocaleTimeString()}`);
    }
  }, [onCreateSnapshot]);

  const captureBeforeVfsMutation = useCallback((label: string, mutation: () => void) => {
    onBeforeVfsMutation?.(label, getSandpackFiles());
    mutation();
  }, [getSandpackFiles, onBeforeVfsMutation]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  return (
    <VFSCodeViewErrorBoundary onFallbackClick={onSwitchToCanvas}>
      <div
        className="w-full h-full min-h-[calc(100vh-112px)] bg-[#0a0a14] rounded-xl overflow-hidden border border-fuchsia-500/20 shadow-2xl shadow-black/50 flex flex-col"
      >
        {/* ============================================================== */}
        {/* Top Toolbar                                                     */}
        {/* ============================================================== */}
        <div className="h-10 flex-shrink-0 flex items-center justify-between px-2 bg-gradient-to-r from-[#0d0d1a] via-[#0f0f1e] to-[#0d0d1a] border-b border-fuchsia-500/10">
          {/* Left: File explorer toggle + breadcrumbs + undo/redo */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowExplorer((v) => !v)}
                    className="h-7 w-7 text-fuchsia-400/50 hover:text-fuchsia-400 hover:bg-fuchsia-500/10 rounded-md transition-all duration-200 flex-shrink-0"
                  >
                    {showExplorer ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{showExplorer ? 'Hide Explorer' : 'Show Explorer'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="h-4 w-px bg-white/[0.06]" />

            {/* Undo / Redo */}
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleUndo}
                      disabled={!canUndo}
                      className="h-7 w-7 text-white/30 hover:text-white/70 hover:bg-white/[0.06] rounded-md transition-all disabled:opacity-20"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Undo (⌘Z)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRedo}
                      disabled={!canRedo}
                      className="h-7 w-7 text-white/30 hover:text-white/70 hover:bg-white/[0.06] rounded-md transition-all disabled:opacity-20"
                    >
                      <Redo2 className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Redo (⌘⇧Z)</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>

            <div className="h-4 w-px bg-white/[0.06]" />

            {/* Snapshot button */}
            {onCreateSnapshot && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSnapshot}
                      className="h-7 w-7 text-cyan-400/40 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-md transition-all"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Create Snapshot</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <div className="h-4 w-px bg-white/[0.06]" />

            {/* Breadcrumbs */}
            <Breadcrumbs path={activeFile?.path} className="min-w-0 overflow-hidden" />

            {/* Affected files indicator */}
            <AffectedFilesIndicator affected={affectedFiles} className="ml-1 flex-shrink-0" />

            {/* AI processing indicator */}
            <AnimatePresence>
              {isAIProcessing && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/25 ml-2 flex-shrink-0"
                >
                  <Loader2 className="w-3 h-3 text-fuchsia-400 animate-spin" />
                  <span className="text-[10px] font-semibold text-fuchsia-300 tracking-wide">AI</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* Copy */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopy}
                    disabled={!activeFile}
                    className="h-7 w-7 text-white/30 hover:text-white/70 hover:bg-white/[0.06] rounded-md transition-all disabled:opacity-30"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Copy Code</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="h-4 w-px bg-white/[0.06] mx-0.5" />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReviewOpen((open) => !open)}
              className={cn('h-7 px-2.5 text-[11px] gap-1.5', reviewOpen ? 'bg-fuchsia-500/15 text-fuchsia-200' : 'text-white/50 hover:text-white')}
            >
              <Code2 className="w-3 h-3" />
              Changes{snapshots.length ? ` (${snapshots.length})` : ''}
            </Button>

            {/* Canvas switch */}
            {onSwitchToCanvas && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSwitchToCanvas}
                className="h-7 px-2.5 text-[11px] font-medium text-fuchsia-400/60 hover:text-fuchsia-300 hover:bg-fuchsia-500/10 rounded-md gap-1.5 transition-all duration-200"
              >
                <Eye className="w-3 h-3" />
                Canvas
              </Button>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* Main Editor Area                                                */}
        {/* ============================================================== */}
        <div className="flex-1 min-h-0">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* File Explorer Panel */}
            {showExplorer && (
              <>
                <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
                  <div className="h-full flex flex-col">
                    <ModernFileExplorer
                      nodes={nodes}
                      activeFileId={activeFileId}
                      onFileSelect={openFile}
                      onCreateFile={(name, parentId) => captureBeforeVfsMutation(`Create ${name}`, () => createFile(name, parentId))}
                      onCreateFolder={(name, parentId) => captureBeforeVfsMutation(`Create folder ${name}`, () => createFolder(name, parentId))}
                      onDelete={(id) => captureBeforeVfsMutation('Delete VFS node', () => deleteNode(id))}
                      onRename={(id, name) => captureBeforeVfsMutation(`Rename VFS node to ${name}`, () => renameNode(id, name))}
                      onDuplicate={(id) => captureBeforeVfsMutation('Duplicate VFS node', () => duplicateNode(id))}
                      onToggleFolder={toggleFolder}
                      onExpandAll={expandAll}
                      onCollapseAll={collapseAll}
                      modifiedFiles={modifiedFiles}
                      aiGeneratedFiles={aiGeneratedFiles}
                      recentlyChangedFiles={recentlyChangedFiles}
                    />
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle className="bg-white/[0.03] hover:bg-fuchsia-500/20 transition-colors data-[resize-handle-active]:bg-fuchsia-500/30" />
              </>
            )}

            {/* Editor Panel */}
            <ResizablePanel defaultSize={previewSlot ? (showExplorer ? 30 : 50) : (showExplorer ? 80 : 100)} minSize={20}>
              <div className="h-full flex flex-col bg-[#0d0d18]">
                {/* Editor Tabs */}
                <ModernEditorTabs
                  tabs={tabs}
                  activeTabId={activeFileId}
                  onTabSelect={openFile}
                  onTabClose={closeTab}
                  onCloseOthers={handleCloseOthers}
                  onCloseAll={handleCloseAll}
                  modifiedTabs={modifiedFiles}
                  aiGeneratedTabs={aiGeneratedFiles}
                />

                {/* Canonical before/after review or Monaco editor */}
                <div className="flex-1 min-h-0 relative">
                  {reviewOpen ? (
                    <div className="h-full min-h-0 flex bg-[#0a0a14]">
                      <aside className="w-56 shrink-0 border-r border-white/[0.07] overflow-auto p-2 space-y-1">
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-white/40">Accepted AI edits</div>
                        {snapshots.length === 0 ? (
                          <p className="px-2 py-4 text-xs text-white/40">No committed AI edits yet.</p>
                        ) : snapshots.map((snapshot) => (
                          <button key={snapshot.id} type="button"
                            onClick={() => { setSelectedSnapshotId(snapshot.id); setSelectedDiffPath(snapshot.changedPaths?.[0] ?? null); }}
                            className={cn('w-full rounded-md px-2 py-2 text-left transition-colors', selectedSnapshot?.id === snapshot.id ? 'bg-fuchsia-500/15 text-white' : 'text-white/60 hover:bg-white/[0.05]')}
                          >
                            <div className="truncate text-xs font-medium">{snapshot.label}</div>
                            <div className="mt-1 text-[10px] text-white/35">{new Date(snapshot.timestamp).toLocaleString()} · {snapshot.changedPaths?.length ?? 0} files</div>
                          </button>
                        ))}
                      </aside>
                      <section className="flex-1 min-w-0 min-h-0 flex flex-col">
                        <div className="h-10 shrink-0 border-b border-white/[0.07] flex items-center gap-2 px-3 overflow-x-auto">
                          {changedReviewPaths.map((path) => (
                            <button key={path} type="button" onClick={() => setSelectedDiffPath(path)}
                              className={cn('shrink-0 rounded px-2 py-1 text-[11px]', activeReviewPath === path ? 'bg-cyan-500/15 text-cyan-200' : 'text-white/45 hover:bg-white/[0.05]')}>
                              {path.split('/').pop()}
                            </button>
                          ))}
                        </div>
                        {selectedSnapshot && activeReviewPath ? (
                          <div className="grid grid-cols-2 flex-1 min-h-0 divide-x divide-white/[0.07]">
                            <CodeReviewPane title="Before" tone="removed" value={selectedSnapshot.before[activeReviewPath] ?? '// File created by this edit'} />
                            <CodeReviewPane title="After" tone="added" value={selectedSnapshot.after[activeReviewPath] ?? '// File deleted by this edit'} />
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-sm text-white/40">Select an accepted edit to review its VFS changes.</div>
                        )}
                      </section>
                    </div>
                  ) : activeFile ? (
                    <VFSMonacoEditor
                      height="100%"
                      fileName={activeFile.name}
                      filePath={activeFile.path || `/src/${activeFile.name}`}
                      projectFiles={projectFiles}
                      value={activeFile.content}
                      onChange={handleFileChange}
                      isAIProcessing={isAIProcessing}
                      onSave={handleSave}
                      className="w-full h-full"
                    />
                  ) : !hasFiles ? (
                    <EmptyState loadDefaultTemplate={loadDefaultTemplate} importFiles={importFiles} />
                  ) : (
                    <NoFileSelected />
                  )}

                  {/* Modified indicator glow */}
                  {activeFile && modifiedFiles.has(activeFile.id) && (
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
                  )}

                  {/* AI generated indicator glow */}
                  {activeFile && aiGeneratedFiles.has(activeFile.id) && (
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/60 to-transparent" />
                  )}
                </div>
              </div>
            </ResizablePanel>

            {previewSlot && (
              <>
                <ResizableHandle withHandle className="bg-white/[0.03] hover:bg-fuchsia-500/20 transition-colors data-[resize-handle-active]:bg-fuchsia-500/30" />
                <ResizablePanel defaultSize={50} minSize={25}>
                  <div className="h-full min-h-0 flex flex-col" aria-label="Canvas preview">
                    {previewSlot}
                  </div>
                </ResizablePanel>
              </>
            )}

        </ResizablePanelGroup>
        </div>

        {/* ============================================================== */}
        {/* Build Output / Terminal                                         */}
        {/* ============================================================== */}
        <VFSTerminal
          nodes={nodes}
          customDeps={previewDependencies}
          isCollapsed={terminalCollapsed}
          onToggleCollapse={() => setTerminalCollapsed(v => !v)}
          maxHeight="160px"
          onAddDep={handleAddDependency}
          onRemoveDep={handleRemoveDependency}
          onPatch={onTerminalPatch}
          getRevisionInfo={getRevisionInfo}
          onRefreshPreview={() => vfsEventBus.emit('preview:refresh', {})}
        />

        {/* ============================================================== */}
        {/* Status Bar                                                      */}
        {/* ============================================================== */}
        <div className="h-6 flex-shrink-0 flex items-center justify-between px-3 bg-gradient-to-r from-fuchsia-950/40 via-[#0a0a14] to-fuchsia-950/40 border-t border-fuchsia-500/10 select-none">
          {/* Left: file info */}
          <div className="flex items-center gap-3">
            {activeFile && langInfo && (
              <>
                <div className={cn('flex items-center gap-1.5 px-1.5 py-0.5 rounded', getLangColor(langInfo.lang).bg)}>
                  <div className={cn('w-1.5 h-1.5 rounded-full', getLangColor(langInfo.lang).dot)} />
                  <span className={cn('text-[10px] font-medium capitalize', getLangColor(langInfo.lang).text)}>
                    {langInfo.lang}
                  </span>
                </div>
                <span className="text-[10px] text-white/25">{langInfo.lines} lines</span>
                <span className="text-[10px] text-white/25">{langInfo.chars.toLocaleString()} chars</span>
              </>
            )}
            {activeFile && modifiedFiles.has(activeFile.id) && (
              <div className="flex items-center gap-1">
                <Circle className="w-2 h-2 fill-amber-400 text-amber-400" />
                <span className="text-[10px] text-amber-400/70">Modified</span>
              </div>
            )}
            {activeFile && aiGeneratedFiles.has(activeFile.id) && (
              <div className="flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-fuchsia-400" />
                <span className="text-[10px] text-fuchsia-400/70">AI Generated</span>
              </div>
            )}
          </div>

          {/* Right: project stats + undo/redo/graph counts */}
          <FileStats
            nodes={nodes}
            undoCount={undoCount}
            redoCount={redoCount}
            graphNodeCount={importGraph?.nodeCount || 0}
          />
        </div>
      </div>
    </VFSCodeViewErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// No File Selected
// ---------------------------------------------------------------------------

function CodeReviewPane({ title, tone, value }: { title: string; tone: 'added' | 'removed'; value: string }) {
  return (
    <div className="min-w-0 min-h-0 flex flex-col">
      <div className={cn('h-9 shrink-0 px-3 flex items-center border-b border-white/[0.06] text-[11px] font-medium', tone === 'added' ? 'text-emerald-300 bg-emerald-500/[0.06]' : 'text-red-300 bg-red-500/[0.06]')}>
        {title}
      </div>
      <pre className="flex-1 min-h-0 overflow-auto p-3 text-[11px] leading-5 font-mono text-white/75 whitespace-pre-wrap break-words">{value}</pre>
    </div>
  );
}

function NoFileSelected() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0a0a14] via-[#0d0d1a] to-[#0a0a14]">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center"
      >
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
          <FileCode className="w-6 h-6 text-white/20" />
        </div>
        <p className="text-sm font-medium text-white/40">No file selected</p>
        <p className="text-xs mt-1.5 text-white/20">Select a file from the explorer to start editing</p>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({
  loadDefaultTemplate: _loadDefaultTemplate,
  importFiles,
}: {
  loadDefaultTemplate: () => void;
  importFiles: (files: Record<string, string>) => void;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0a0a14] via-[#0d0d1a] to-[#0a0a14] p-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-md"
      >
        {/* Empty state - no preview when no files loaded */}
      </motion.div>
    </div>
  );
}

export default VFSCodeView;
