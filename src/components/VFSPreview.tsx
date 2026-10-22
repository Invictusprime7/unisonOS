/**
 * VFSPreview - Sandpack-Only Preview Component
 * 
 * All previews use Sandpack in-browser React/TypeScript bundling.
 * No static HTML fallback — everything renders as live React.
 * 
 * Features:
 * - Sandpack in-browser bundling (primary and only engine)
 * - Docker-based Vite preview with true HMR (local dev enhancement)
 * - Automatic file sync from VFS
 * - Toolbar with status, controls, and logs
 * - Open in new tab
 */

import { resolvePendingVfsConflicts } from '@/services/snapshotProjector';
import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef, useMemo, Component, type ReactNode, type ErrorInfo } from 'react';
import { cn } from '@/lib/utils';
import { UnisonLoadingMark } from '@/components/UnisonLoadingMark';
import { 
  RefreshCw, 
  ExternalLink, 
  Wifi, 
  WifiOff, 
  Loader2,
  Server,
  Terminal,
  ChevronDown,
  AlertCircle,
  Play,
  Square,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SandpackProvider, SandpackPreview, SandpackLayout, useSandpack, useSandpackPreviewProgress } from '@codesandbox/sandpack-react';
import { usePreviewService } from '@/hooks/usePreviewService';
import { createExternalPreviewSession } from '@/services/externalPreviewSession';
import { usePreviewAI } from '@/hooks/usePreviewAI';
import { getGlobalAITerminalBridge } from '@/services/aiTerminalBridge';
import { buildPreviewArtifactsAsync } from '@/utils/previewArtifacts';
import { PreviewPipelineError, isPreviewPipelineError } from '@/services/previewPipelineError';
import { createVfsHandoffSignature } from '@/services/vfsHandoffSignature';
import { PreviewRuntimeError } from '@/components/PreviewRuntimeError';
import { attachPreviewListener, reportPreviewError, reportPreviewRunning } from '@/services/builder/previewVerification';
import { LaunchGateNotice } from '@/components/creatives/web-builder/LaunchGateNotice';
import { isCanonicalRuntimeError } from '@/platform/core/canonicalRuntimeContract';
import { resolveSnapshot } from '@/services/snapshotProjector';
import { resolveLauncherEntryPoint } from '@/utils/launcherPayload';
import { resolveHydrationRequest, projectRowsForSection } from '@/services/catalogRuntime';
import { getSelectedElementData, highlightElement, removeHighlight } from '@/utils/htmlElementSelector';
import type { VirtualNode, VirtualFile } from '@/hooks/useVirtualFileSystem';
import { useLaunch } from '@/contexts/useLaunchHooks';
import { useVFSSafe } from '@/hooks/useVFSContext';
import { BuilderSessionContext } from '@/builder/controllers/BuilderSessionProvider';

// ============================================================================
// Types
// ============================================================================

type PreviewBackend = 'docker' | 'local' | 'sandpack' | 'loading' | 'none';

interface PreviewServiceFacade {
  session: {
    iframeUrl: string;
    status: 'starting' | 'running' | 'stopped' | 'error';
  } | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  startSession: (nodes: VirtualNode[]) => Promise<unknown>;
  stopSession: () => Promise<void>;
  patchFile: (path: string, content: string) => Promise<boolean>;
}

interface PreviewCompileState {
  sandpackFiles: Record<string, string>;
  dependencies: Record<string, string>;
  pipelineError: PreviewPipelineError | null;
  emptyDraft: boolean;
  compiling: boolean;
}

const MAX_SANDPACK_TIMEOUT_RECOVERIES = 3;
const MAX_SANDPACK_RENDER_RECOVERIES = 1;
const PREVIEW_RENDER_READY_TIMEOUT_MS = 20_000;
// Large generated multi-page sites can legitimately take longer than 45s on a
// cold worker. Keep this aligned with Sandpack's own startup budget.
const PREVIEW_ARTIFACT_COMPILE_TIMEOUT_MS = 180_000;

// Local Vite server URL (for development without Docker)
const LOCAL_PREVIEW_URL = import.meta.env.VITE_LOCAL_PREVIEW_URL || '';
export interface InlineTextEditChange {
  selector: string;
  text: string;
  originalText?: string;
  revisionId: string | null;
  target: {
    pagePath: string | null;
    sectionId: string | null;
    sectionType: string | null;
    slotId: string | null;
    resourceMark: string | null;
  };
}

export interface VFSPreviewProps {
  /** VFS nodes for file content */
  nodes: VirtualNode[];
  /** Files map (alternative to nodes) */
  files?: Record<string, string>;
  /** Import terminal/AI mutations back into the VFS that owns this preview. */
  onImportFiles?: (files: Record<string, string>) => void;
  /** Atomically reconcile a complete terminal/AI VFS snapshot with its owner. */
  onSyncFiles?: (files: Record<string, string>) => void;
  /** Active file path */
  activeFile?: string;
  /** Additional CSS classes */
  className?: string;
  /** Show console panel */
  showConsole?: boolean;
  /** Show toolbar */
  showToolbar?: boolean;
  /** Auto-start Docker preview */
  autoStart?: boolean;
  /** Force a specific backend (kept for compatibility) */
  forceBackend?: 'docker' | 'sandpack';
  /** Callback when preview is ready */
  onReady?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
  /** Show backend indicator */
  showBackendIndicator?: boolean;
  /** Callback when navigation intent is triggered */
  onNavigate?: (path: string) => void;
  /** Callback when any intent is triggered */
  onIntentTrigger?: (intent: string, payload: Record<string, unknown>) => void;
  /** Business ID for intent context */
  businessId?: string;
  /** Site ID for intent context */
  siteId?: string;
  /** Accepted canonical revision rendered by this preview, when persisted. */
  revisionId?: string | null;
  /** Device breakpoint for responsive preview */
  device?: 'desktop' | 'tablet' | 'mobile';
  /** Enable element selection (edit mode) */
  enableSelection?: boolean;
  /** Callback when an element is selected */
  onElementSelect?: (elementData: any) => void;
  /** Commit a text edit performed directly on a selected preview leaf. */
  onInlineTextCommit?: (change: InlineTextEditChange) => boolean | void | Promise<boolean | void>;
}

export interface VFSPreviewHandle {
  refresh: () => void;
  startDocker: () => Promise<void>;
  stopDocker: () => Promise<void>;
  getBackend: () => PreviewBackend;
  openInNewTab: () => void;
  getIframe: () => HTMLIFrameElement | null;
  /** Navigate the preview to a hash route (e.g. "/contact") */
  navigateToRoute: (route: string) => void;
  clearSelectedElement: () => void;
}

// ============================================================================
// Sandpack Error Boundary — catches Sandpack/Babel crashes and provides retry
// ============================================================================

class SandpackErrorBoundary extends Component<
  { children: ReactNode; onRetryExhausted?: () => void },
  { hasError: boolean; error: Error | null; retryCount: number }
> {
  constructor(props: { children: ReactNode; onRetryExhausted?: () => void }) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[VFSPreview] Sandpack render crash:', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full bg-background text-foreground p-10">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="text-lg font-semibold mb-2">Preview Error</h3>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              {this.state.error?.message || 'The preview encountered an issue during compilation.'}
            </p>
            <Button
              size="sm"
              onClick={() => this.setState(s => ({ hasError: false, error: null, retryCount: s.retryCount + 1 }))}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Preview
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// Sandpack Error Listener — captures compile/runtime errors from Sandpack
// ============================================================================

const SandpackErrorListener: React.FC<{
  onError?: (error: string) => void;
  onTimeout?: () => void;
  onRunning?: () => void;
  dependencies: Record<string, string>;
}> = ({ onError, onTimeout, onRunning, dependencies }) => {
  const { sandpack } = useSandpack();
  const lastReportedRef = useRef<string>('');

  useEffect(() => attachPreviewListener(), []);

  // Only the client's actual timeout may restart the runner. A shorter
  // watchdog aborts healthy cold-start module installs before the SDK's
  // connection deadline and turns slow saved-project loads into retry loops.

  useEffect(() => {
    const status = sandpack.status;
    const error = sandpack.error;

    if (status === 'timeout') {
      const timeoutMessage = 'Preview runner took too long to connect. Retrying once automatically.';
      if (lastReportedRef.current !== timeoutMessage) {
        lastReportedRef.current = timeoutMessage;
        onError?.(timeoutMessage);
        onTimeout?.();
      }
      return;
    }

    if (error) {
      const msg = typeof error === 'string'
        ? error
        : (error as any).message
          ? `${(error as any).title || 'Error'}: ${(error as any).message}${(error as any).path ? ` (${(error as any).path}:${(error as any).line || ''})` : ''}`
          : String(error);

      // P0.4: a fatal preview error means no surface may claim "applied".
      reportPreviewError(msg);
      if (msg !== lastReportedRef.current) {
        lastReportedRef.current = msg;
        const dependencyFetchFailure = /could not fetch dependencies/i.test(msg);
        const requestedDependencies = Object.entries(dependencies)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([name, version]) => `${name}@${version}`);
        const dependencySummary = requestedDependencies.length > 0
          ? requestedDependencies.slice(0, 12).join(', ') + (requestedDependencies.length > 12 ? `, +${requestedDependencies.length - 12} more` : '')
          : 'the core preview runtime';
        const report = dependencyFetchFailure
          ? `Sandpack could not fetch preview dependencies (${dependencySummary}). Retrying once automatically.`
          : msg;
        onError?.(report);
        if (dependencyFetchFailure || /\bTIME_OUT\b|couldn't connect to server/i.test(msg)) {
          onTimeout?.();
        }
      }
    } else if (status === 'running') {
      lastReportedRef.current = '';
      // Connection is not proof of a successful React render. The canonical
      // entry shell reports readiness (or its error boundary) from the iframe.
      onRunning?.();
    } else if (status === 'idle') {
      lastReportedRef.current = '';
    }
  }, [sandpack.status, sandpack.error, onError, onTimeout, onRunning, dependencies]);

  return null;
};

// Sandpack owns the installation lifecycle; render only its native compiler
// progress signal in the existing bottom-left preview position.
const SandpackDependencyProgress: React.FC<{ dependencyCount: number }> = ({ dependencyCount }) => {
  const { sandpack } = useSandpack();
  const progressMessage = useSandpackPreviewProgress({ timeout: 3000 });
  const [showInitialInstall, setShowInitialInstall] = useState(true);

  useEffect(() => {
    if (sandpack.status !== 'initial') {
      setShowInitialInstall(false);
      return;
    }

    // The remote Sandpack compiler does not consistently emit a terminal
    // completion event. Keep the fallback brief; native progress messages
    // remain visible whenever the compiler does publish them.
    const timer = window.setTimeout(() => setShowInitialInstall(false), 4000);
    return () => window.clearTimeout(timer);
  }, [sandpack.status]);

  const progressLabel = progressMessage || (
    sandpack.status === 'initial' && showInitialInstall
      ? 'Installing preview modules'
      : null
  );

  if (!progressLabel) return null;

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-md border border-border/70 bg-background/95 px-3 py-2 text-xs text-foreground shadow-sm backdrop-blur">
      <UnisonLoadingMark size={16} />
      <span>{progressLabel}</span>
      <span className="text-muted-foreground">({dependencyCount} modules)</span>
    </div>
  );
};

// ============================================================================
// Helpers
// ============================================================================

function nodesToFileMap(nodes: VirtualNode[]): Record<string, string> {
  const files: Record<string, string> = {};
  for (const node of nodes) {
    if (node.type === 'file') {
      const file = node as VirtualFile;
      const path = file.path || `/${file.name}`;
      files[path] = file.content;
    }
  }
  return files;
}

function hasRenderablePreviewSource(files: Record<string, string>): boolean {
  return Object.entries(files).some(([path, content]) => {
    if (typeof content !== 'string' || content.trim().length === 0) return false;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    // Metadata, config, public assets, and hidden Unison handoff files are not
    // preview entrypoints. A blank builder draft can legitimately contain only
    // these files while the user is still starting a project.
    if (normalizedPath.includes('/.') || normalizedPath.endsWith('.json')) return false;
    if (normalizedPath.includes('/public/') || normalizedPath.includes('node_modules')) return false;
    if (/\.config\.[cm]?[jt]s$/.test(normalizedPath)) return false;

    return /\.(tsx?|jsx?|css|html)$/.test(normalizedPath);
  });
}

// ============================================================================
// Main Component
// ============================================================================

export const VFSPreview = forwardRef<VFSPreviewHandle, VFSPreviewProps>(({
  nodes,
  files: propFiles,
  onImportFiles,
  onSyncFiles,
  activeFile,
  className,
  showConsole = false,
  showToolbar = true,
  autoStart = true,
  forceBackend,
  onReady,
  onError,
  showBackendIndicator = true,
  onNavigate,
  onIntentTrigger,
  businessId,
  siteId,
  revisionId = null,
  device = 'desktop',
  enableSelection = false,
  onElementSelect,
  onInlineTextCommit,
}, ref) => {
  const builderSession = React.useContext(BuilderSessionContext);
  const { launch } = useLaunch();
  const vfsContext = useVFSSafe();
  // State - default to 'sandpack' — no HTML fallback
  const [backend, setBackend] = useState<PreviewBackend>('sandpack');
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [sandpackKey, setSandpackKey] = useState(0);
  const [sandpackTimeoutExhausted, setSandpackTimeoutExhausted] = useState(false);
  const [sandpackRenderExhausted, setSandpackRenderExhausted] = useState(false);
  const dependencySignatureRef = useRef<string | null>(null);
  const startAttemptedRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  // Last route requested from the Builder page router, replayed until the
  // preview nav bridge acknowledges it by actually moving.
  const pendingRouteRef = useRef<string | null>(null);
  const navRetryTimerRef = useRef<number | null>(null);
  const timeoutRecoveryCountRef = useRef(0);
  const timeoutRecoveryTimerRef = useRef<number | null>(null);
  const renderRecoveryCountRef = useRef(0);
  const renderReadyRef = useRef(false);
  const renderReadyTimeoutRef = useRef<number | null>(null);
  const renderWatchKeyRef = useRef<string | null>(null);
  
  const localPreviewService = usePreviewService();
  const canUseContextPreview =
    !!vfsContext &&
    !propFiles &&
    vfsContext.nodes === nodes;

  const contextPreviewService = useMemo<PreviewServiceFacade | null>(() => {
    if (!canUseContextPreview || !vfsContext) return null;

    return {
      session: vfsContext.previewSession,
      loading: vfsContext.previewLoading,
      error: vfsContext.previewError,
      connected: vfsContext.previewConnected,
      startSession: async () => vfsContext.startPreview(),
      stopSession: vfsContext.stopPreview,
      patchFile: vfsContext.patchFile,
    };
  }, [canUseContextPreview, vfsContext]);

  const dockerService = contextPreviewService ?? localPreviewService;
  
  // AI execution and terminal bridge
  const previewAI = usePreviewAI();
  
  // React/Sandpack is the sole preview runtime. Docker/local preview
  // environment variables must never replace the canonical in-browser VFS.
  const dockerGatewayConfigured = false;
  const localViteConfigured = false;
  
  // Convert nodes to files - ALWAYS recompute to ensure we have latest
  const rawFiles = useMemo(() => {
    const nodeFiles = nodesToFileMap(nodes);
    return { ...nodeFiles, ...propFiles };
  }, [nodes, propFiles]);
  const filesSignature = useMemo(() => createVfsHandoffSignature(rawFiles) || 'empty-vfs', [rawFiles]);
  // Identity-stable file map: callers frequently pass inline `nodes={[]}` or a
  // freshly spread object, which would otherwise re-trigger the (expensive)
  // preview compile on every parent render and lock up the main thread.
  const stableFilesRef = useRef<{ signature: string; files: Record<string, string> } | null>(null);
  if (!stableFilesRef.current || stableFilesRef.current.signature !== filesSignature) {
    stableFilesRef.current = { signature: filesSignature, files: rawFiles };
  }
  const files = stableFilesRef.current.files;


  useEffect(() => {
    timeoutRecoveryCountRef.current = 0;
    setSandpackTimeoutExhausted(false);
    renderRecoveryCountRef.current = 0;
    renderReadyRef.current = false;
    renderWatchKeyRef.current = null;
    setSandpackRenderExhausted(false);
    if (timeoutRecoveryTimerRef.current !== null) {
      window.clearTimeout(timeoutRecoveryTimerRef.current);
      timeoutRecoveryTimerRef.current = null;
    }
    if (renderReadyTimeoutRef.current !== null) {
      window.clearTimeout(renderReadyTimeoutRef.current);
      renderReadyTimeoutRef.current = null;
    }
  }, [filesSignature]);

  const [previewCompile, setPreviewCompile] = useState<PreviewCompileState>({
    sandpackFiles: {},
    dependencies: {},
    pipelineError: null,
    emptyDraft: false,
    compiling: true,
  });

  // Coarse launch signature — LaunchContext re-publishes a new object on every
  // status tick. Only the values the preview compiler actually reads may
  // invalidate compiled artifacts.
  const launchSignature = useMemo(() => [
    launch?.themePresetId ?? '',
    launch?.siteBundleSnapshot?.meta?.themePresetId ?? '',
    launch?.siteBundleSnapshot?.industry ?? '',
    launch?.businessName ?? '',
    launch?.runtimeManifest?.appContext?.themePresetId ?? '',
  ].join('|'), [launch]);
  const launchRef = useRef(launch);
  launchRef.current = launch;
  const compiledKeyRef = useRef<string | null>(null);
  const inFlightKeyRef = useRef<string | null>(null);
  const pendingCompileRef = useRef<{
    key: string;
    files: Record<string, string>;
    launchState: typeof launch;
    pendingSourceConflictPolicy: 'block' | 'accepted-only';
  } | null>(null);
  const [compileDrainVersion, setCompileDrainVersion] = useState(0);
  const [acceptedRevisionPreview, setAcceptedRevisionPreview] = useState(false);
  const unmountedRef = useRef(false);
  const compileAttemptRef = useRef(0);
  const activeCompileControllerRef = useRef<AbortController | null>(null);
  const activeCompileTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    // React StrictMode intentionally runs mount → cleanup → mount in
    // development. Reset this flag on every setup; otherwise the first cleanup
    // permanently marks the live component as unmounted and every completed
    // preview compile is discarded as stale, leaving "Preparing preview"
    // visible forever despite a fully populated VFS.
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      compileAttemptRef.current += 1;
      activeCompileControllerRef.current?.abort(new Error('Preview component unmounted.'));
      activeCompileControllerRef.current = null;
      if (activeCompileTimeoutRef.current !== null) {
        window.clearTimeout(activeCompileTimeoutRef.current);
        activeCompileTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const pendingSourceConflictPolicy = acceptedRevisionPreview ? 'accepted-only' : 'block';
    const key = `${filesSignature}::${launchSignature}::${pendingSourceConflictPolicy}`;
    if (compiledKeyRef.current === key || inFlightKeyRef.current === key) return;

    // Builder hydration publishes the route handoff, committed revision, and
    // canonical router in quick succession. Queue the newest snapshot instead
    // of invalidating the compile already in flight. Invalidating every result
    // before first paint caused the permanent "Preparing preview" loop even
    // though every individual VFS snapshot was renderable.
    pendingCompileRef.current = { key, files, launchState: launchRef.current, pendingSourceConflictPolicy };
    setCompileDrainVersion((version) => version + 1);
  }, [acceptedRevisionPreview, files, filesSignature, launchSignature]);

  useEffect(() => {
    if (inFlightKeyRef.current) return;
    const request = pendingCompileRef.current;
    if (!request || compiledKeyRef.current === request.key) return;

    pendingCompileRef.current = null;
    const compileKey = request.key;
    inFlightKeyRef.current = compileKey;
    const compileAttempt = ++compileAttemptRef.current;

    setPreviewCompile((current) => ({
      ...current,
      pipelineError: null,
      emptyDraft: false,
      compiling: true,
    }));

    const isStale = () =>
      unmountedRef.current || compileAttemptRef.current !== compileAttempt;

    window.setTimeout(async () => {
      const compileController = new AbortController();
      activeCompileControllerRef.current = compileController;
      const compileTimeout = window.setTimeout(() => {
        compileController.abort(new Error('Preview artifact compilation timed out after 180 seconds.'));
      }, PREVIEW_ARTIFACT_COMPILE_TIMEOUT_MS);
      activeCompileTimeoutRef.current = compileTimeout;
      try {
        const isWizardPreview = resolveSnapshot(request.files, request.launchState).isWizardDraft;

        if (!isWizardPreview && !hasRenderablePreviewSource(request.files)) {
          if (!isStale()) {
            compiledKeyRef.current = compileKey;
            setPreviewCompile({
              sandpackFiles: {},
              dependencies: {},
              pipelineError: null,
              emptyDraft: true,
              compiling: false,
            });
          }
          return;
        }

        // Async/Worker-offloaded: the underlying prepareSandpackFiles() call
        // has no yield points and previously froze the tab (unresponsive
        // mouse, no repaint) on large or drifted generated sites.
        const result = await buildPreviewArtifactsAsync({
          sourceFiles: request.files,
          launchState: request.launchState,
          pendingSourceConflictPolicy: request.pendingSourceConflictPolicy,
        }, { signal: compileController.signal });

        if (!isStale()) {
          compiledKeyRef.current = compileKey;
          setPreviewCompile({
            sandpackFiles: result.sandpackFiles,
            dependencies: result.dependencies,
            pipelineError: null,
            emptyDraft: false,
            compiling: false,
          });
        }
      } catch (err) {
        if (isStale()) return;

        const pipelineError = isPreviewPipelineError(err)
          ? err
          : new PreviewPipelineError('sandpack', `Preview artifact compile failed: ${err instanceof Error ? err.message : String(err)}`, {
              cause: err,
              recoverableByRelaunch: false,
            });

        console.error('[VFSPreview] Pipeline error:', pipelineError);
        compiledKeyRef.current = compileKey;
        setPreviewCompile({
          sandpackFiles: {},
          dependencies: {},
          pipelineError,
          emptyDraft: false,
          compiling: false,
        });
      } finally {
        window.clearTimeout(compileTimeout);
        if (activeCompileControllerRef.current === compileController) {
          activeCompileControllerRef.current = null;
          activeCompileTimeoutRef.current = null;
        }
        if (inFlightKeyRef.current === compileKey) {
          inFlightKeyRef.current = null;
        }
        // StrictMode's development mount → cleanup → mount cycle can cancel
        // this attempt after its queue item was consumed. Once the live setup
        // has restored unmountedRef, put that exact artifact back into the
        // drain queue. Without this hand-back there is no dependency change to
        // schedule another attempt and the UI remains on “Preparing preview”.
        const attemptWasInvalidated = compileAttemptRef.current !== compileAttempt;
        if (!unmountedRef.current && attemptWasInvalidated && compiledKeyRef.current !== compileKey) {
          const pending = pendingCompileRef.current;
          if (!pending || pending.key === compileKey) {
            pendingCompileRef.current = request;
          }
        }
        if (!unmountedRef.current && pendingCompileRef.current) {
          setCompileDrainVersion((version) => version + 1);
        }
      }
    }, 80);

    return () => {
      // Intentionally no abort/clearTimeout here: this effect re-runs on
      // harmless identity churn, and tearing down the pending compile each
      // time is what stalled the preview forever. Stale results are ignored
      // via compileAttemptRef/unmountedRef instead.
    };

  }, [compileDrainVersion]);



  const {
    sandpackFiles,
    dependencies: sandpackDeps,
    pipelineError,
    emptyDraft,
    compiling: previewCompiling,
  } = previewCompile;
  const hasCompiledPreview = Object.keys(sandpackFiles).length > 0;
  const legacyTimeoutRecoveryKeyRef = useRef<string | null>(null);
  const retryArtifactCompile = useCallback(() => {
    const pendingSourceConflictPolicy = acceptedRevisionPreview ? 'accepted-only' : 'block';
    const key = `${filesSignature}::${launchSignature}::${pendingSourceConflictPolicy}`;
    compiledKeyRef.current = null;
    pendingCompileRef.current = {
      key,
      files,
      launchState: launchRef.current,
      pendingSourceConflictPolicy,
    };
    setPreviewCompile((current) => ({
      ...current,
      pipelineError: null,
      emptyDraft: false,
      compiling: true,
    }));
    setCompileDrainVersion((version) => version + 1);
  }, [acceptedRevisionPreview, files, filesSignature, launchSignature]);

  useEffect(() => {
    if (!pipelineError?.message.includes('did not respond within 30 seconds')) return;
    const key = `${filesSignature}::${launchSignature}`;
    if (legacyTimeoutRecoveryKeyRef.current === key) return;
    legacyTimeoutRecoveryKeyRef.current = key;
    retryArtifactCompile();
  }, [filesSignature, launchSignature, pipelineError, retryArtifactCompile]);

  // Sandpack HMR handles source-file updates without destroying iframe state.
  // Dependency graph changes are different: customSetup is read at provider
  // startup, so remount only when package names/versions actually change.
  const dependencySignature = useMemo(
    () => Object.entries(sandpackDeps)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, version]) => `${name}@${version}`)
      .join('|'),
    [sandpackDeps],
  );
  const sandpackCustomSetup = useMemo(() => ({
    dependencies: sandpackDeps,
  }), [dependencySignature]);

  useEffect(() => {
    // The provider is not mounted while artifacts compile. Its first real
    // dependency graph is initial state, not a runtime change; remounting at
    // this point aborts the Sandpack runner before it can connect.
    if (previewCompiling) return;
    if (!hasCompiledPreview) {
      dependencySignatureRef.current = null;
      return;
    }
    if (dependencySignatureRef.current === null) {
      dependencySignatureRef.current = dependencySignature;
      return;
    }
    if (dependencySignatureRef.current !== dependencySignature) {
      dependencySignatureRef.current = dependencySignature;
      setSandpackKey((key) => key + 1);
    }
  }, [dependencySignature, hasCompiledPreview, previewCompiling]);

  // Keep AI terminal bridge state synced with the live preview VFS/dependencies.
  useEffect(() => {
    const bridge = getGlobalAITerminalBridge(nodes, sandpackDeps);
    bridge.updateVFSNodes(nodes);
    bridge.updateDependencies(sandpackDeps);
  }, [nodes, sandpackDeps]);

  useEffect(() => {
    const importIntoOwner = onImportFiles
      || (canUseContextPreview && vfsContext ? vfsContext.importFiles : null);
    const syncIntoOwner = onSyncFiles
      || (canUseContextPreview && vfsContext ? vfsContext.replaceFiles : null);
    if (!importIntoOwner && !syncIntoOwner) return;

    const bridge = getGlobalAITerminalBridge();
    return bridge.watchVFS((changes) => {
      const snapshot = bridge.getVFSSnapshot();
      if (!changes || changes.length === 0) return;

      // The terminal bridge is authoritative for its VFS session. Reconcile
      // its complete snapshot whenever available so deletions cannot leave a
      // stale generated module in the preview owner.
      if (syncIntoOwner) {
        syncIntoOwner(snapshot);
        return;
      }

      const changedFiles: Record<string, string> = {};
      changes.forEach((path) => {
        if (snapshot[path] !== undefined) {
          changedFiles[path] = snapshot[path];
        }
      });

      if (Object.keys(changedFiles).length > 0 && importIntoOwner) {
        importIntoOwner(changedFiles);
      }
    });
  }, [canUseContextPreview, onImportFiles, onSyncFiles, vfsContext]);

  const normalizedActiveFile = useMemo(() => {
    if (!activeFile) return null;
    if (activeFile.startsWith('/src/')) return activeFile.replace('/src/', '/');
    if (activeFile.startsWith('/styles/')) return activeFile.replace('/styles/', '/');
    return activeFile;
  }, [activeFile]);
  
  // Sandpack must run the controlled index entry, which mounts the routed App.
  const sandpackEntryFile = useMemo(() => {
    const controlledEntries = ['/index.tsx', '/index.jsx'];
    for (const entry of controlledEntries) {
      if (sandpackFiles[entry]) return entry;
    }

    // Fallback to the active file only when artifact preparation did not emit
    // the controlled mount module.
    if (normalizedActiveFile && sandpackFiles[normalizedActiveFile]) {
      return normalizedActiveFile;
    }

    if (sandpackFiles['/App.tsx']) return '/App.tsx';
    if (sandpackFiles['/App.jsx']) return '/App.jsx';

    const firstCode = Object.keys(sandpackFiles).find(p => /\.(tsx?|jsx?)$/.test(p) && p !== '/hooks-shim.ts' && p !== '/index.tsx');
    return firstCode || '/App.tsx';
  }, [sandpackFiles, normalizedActiveFile]);
  const sandpackProviderOptions = useMemo(() => ({
    externalResources: ['https://cdn.tailwindcss.com'],
    bundlerURL: new URL('/sandpack/index.html', window.location.origin).toString(),
    bundlerTimeOut: 120_000,
    activeFile: sandpackEntryFile,
    visibleFiles: [sandpackEntryFile],
    autorun: true,
    initMode: 'immediate' as const,
    autoReload: true,
    recompileMode: 'delayed' as const,
    recompileDelay: 300,
  }), [sandpackEntryFile]);
  
  // Track Sandpack iframe + bridge readiness for the Edit-mode selection bridge
  const sandpackIframeRef = useRef<HTMLIFrameElement | null>(null);
  const bridgeReadyRef = useRef(false);
  const editActivationKeyRef = useRef(0);
  const directHoverRef = useRef<HTMLElement | null>(null);
  const directSelectedRef = useRef<HTMLElement | null>(null);
  // M1c: last selection identity, replayed into the iframe after a rebuild so
  // the highlight re-attaches to the same object.
  const lastSelectionRef = useRef<{
    selector?: string;
    sectionId?: string | null;
    structuralPath?: string;
    repeatIndex?: number | null;
    resource?: string | null;
  } | null>(null);

  const clearDirectPreviewSelection = useCallback(() => {
    if (directHoverRef.current) {
      removeHighlight(directHoverRef.current);
      directHoverRef.current = null;
    }
    if (directSelectedRef.current) {
      removeHighlight(directSelectedRef.current);
      directSelectedRef.current = null;
    }
  }, []);

  // Resolve a target window for posting bridge messages (Sandpack iframe or docker iframe)
  const getPreviewWindow = useCallback((): Window | null => {
    if (sandpackIframeRef.current?.isConnected && sandpackIframeRef.current.contentWindow) return sandpackIframeRef.current.contentWindow;
    const sp = previewContainerRef.current?.querySelector(
      'iframe.sp-preview-iframe, .sp-preview iframe, iframe[title*="Sandpack"], iframe[src*="csb.app"], iframe[src*="codesandbox"]',
    ) as HTMLIFrameElement | null;
    if (sp?.contentWindow) {
      sandpackIframeRef.current = sp;
      return sp.contentWindow;
    }
    if (iframeRef.current?.contentWindow) return iframeRef.current.contentWindow;
    return null;
  }, []);

  const clearSelectedElement = useCallback(() => {
    clearDirectPreviewSelection();
    lastSelectionRef.current = null;
    const win = getPreviewWindow();
    if (win) {
      win.postMessage({ type: 'EDIT_MODE_CLEAR_SELECTION' }, '*');
    }
  }, [clearDirectPreviewSelection, getPreviewWindow]);

  const handleSandpackRunning = useCallback(() => {
    if (timeoutRecoveryTimerRef.current !== null) {
      window.clearTimeout(timeoutRecoveryTimerRef.current);
      timeoutRecoveryTimerRef.current = null;
    }
    timeoutRecoveryCountRef.current = 0;
    setSandpackTimeoutExhausted(false);
    if (renderReadyRef.current) return;
    const watchKey = `${filesSignature}::${launchSignature}::${sandpackKey}`;
    if (renderWatchKeyRef.current === watchKey && renderReadyTimeoutRef.current !== null) return;
    renderWatchKeyRef.current = watchKey;
    if (renderReadyTimeoutRef.current !== null) {
      window.clearTimeout(renderReadyTimeoutRef.current);
    }
    renderReadyTimeoutRef.current = window.setTimeout(() => {
      renderReadyTimeoutRef.current = null;
      if (renderReadyRef.current || renderWatchKeyRef.current !== watchKey) return;
      if (renderRecoveryCountRef.current < MAX_SANDPACK_RENDER_RECOVERIES) {
        renderRecoveryCountRef.current += 1;
        setSandpackKey((key) => key + 1);
      } else {
        setSandpackRenderExhausted(true);
      }
    }, PREVIEW_RENDER_READY_TIMEOUT_MS);
  }, [filesSignature, launchSignature, sandpackKey]);

  const handleSandpackError = useCallback((message: string) => {
    renderWatchKeyRef.current = null;
    if (renderReadyTimeoutRef.current !== null) {
      window.clearTimeout(renderReadyTimeoutRef.current);
      renderReadyTimeoutRef.current = null;
    }
    onError?.(message);
  }, [onError]);

  // Push the current Edit-mode state into the preview iframe.
  // Retries briefly to cover the brief window before the bridge boots.
  const pushEditModeState = useCallback((enabled: boolean) => {
    const key = ++editActivationKeyRef.current;
    let attempts = 0;
    const send = () => {
      const win = getPreviewWindow();
      if (win) {
        win.postMessage({ type: 'EDIT_MODE_TOGGLE', enabled, activationKey: key, revisionId, siteId }, '*');
      }
      attempts++;
      if (!bridgeReadyRef.current && attempts < 12) {
        setTimeout(send, 250);
      }
    };
    send();
  }, [getPreviewWindow, revisionId, siteId]);

  // Re-push state whenever Edit/Select mode toggles
  useEffect(() => {
    pushEditModeState(enableSelection);
    if (!enableSelection) {
      clearSelectedElement();
    }
  }, [clearSelectedElement, enableSelection, pushEditModeState, sandpackKey]);

  // Handle messages from preview iframe (intent system + selection bridge)
  useEffect(() => {
    if (backend === 'sandpack') {
      clearDirectPreviewSelection();
      return;
    }

    const iframe = iframeRef.current;
    if (!iframe) return;

    let cleanup: (() => void) | null = null;

    const attach = () => {
      cleanup?.();
      clearDirectPreviewSelection();
      if (!enableSelection) return;

      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc?.body) return;

        const isUiChrome = (el: HTMLElement | null) => {
          if (!el) return true;
          const id = el.id || '';
          return id.startsWith('__ut-') || el.closest('[data-ut-builder-chrome="true"]') !== null;
        };

        const clearHover = () => {
          if (directHoverRef.current && directHoverRef.current !== directSelectedRef.current) {
            removeHighlight(directHoverRef.current);
          }
          directHoverRef.current = null;
        };

        const handleMouseOver = (event: MouseEvent) => {
          if (!enableSelection) return;
          const target = event.target as HTMLElement | null;
          if (!target || target === directSelectedRef.current || isUiChrome(target)) return;
          if (directHoverRef.current && directHoverRef.current !== target) {
            removeHighlight(directHoverRef.current);
          }
          directHoverRef.current = target;
          highlightElement(target, '#22d3ee');
        };

        const handleMouseOut = (event: MouseEvent) => {
          if (event.target === directHoverRef.current) {
            clearHover();
          }
        };

        const handleClick = (event: MouseEvent) => {
          if (!enableSelection) return;
          const target = event.target as HTMLElement | null;
          if (!target || isUiChrome(target)) return;
          event.preventDefault();
          event.stopPropagation();
          if (typeof (event as Event & { stopImmediatePropagation?: () => void }).stopImmediatePropagation === 'function') {
            (event as Event & { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
          }

          clearHover();
          if (directSelectedRef.current && directSelectedRef.current !== target) {
            removeHighlight(directSelectedRef.current);
          }
          directSelectedRef.current = target;
          highlightElement(target, '#06b6d4');
          onElementSelect?.(getSelectedElementData(target));
        };

        doc.addEventListener('mouseover', handleMouseOver, true);
        doc.addEventListener('mouseout', handleMouseOut, true);
        doc.addEventListener('click', handleClick, true);

        cleanup = () => {
          doc.removeEventListener('mouseover', handleMouseOver, true);
          doc.removeEventListener('mouseout', handleMouseOut, true);
          doc.removeEventListener('click', handleClick, true);
          clearDirectPreviewSelection();
        };
      } catch {
        cleanup = null;
      }
    };

    attach();
    attach();
    iframe.addEventListener('load', attach);

    return () => {
      iframe.removeEventListener('load', attach);
      cleanup?.();
      clearDirectPreviewSelection();
    };
  }, [backend, clearDirectPreviewSelection, enableSelection, onElementSelect]);

  useEffect(() => {
    const handlePreviewMessage = (event: MessageEvent) => {
      if (event.source !== getPreviewWindow()) return;
      const data = event.data;
      if (!data?.type) return;

      if (data.type === 'UNISON_PREVIEW_RENDER_READY') {
        handleSandpackRunning();
        renderReadyRef.current = true;
        renderWatchKeyRef.current = null;
        renderRecoveryCountRef.current = 0;
        setSandpackRenderExhausted(false);
        if (renderReadyTimeoutRef.current !== null) {
          window.clearTimeout(renderReadyTimeoutRef.current);
          renderReadyTimeoutRef.current = null;
        }
        reportPreviewRunning();
        onReady?.();
        return;
      }
      if (data.type === 'UNISON_PREVIEW_RENDER_ERROR') {
        renderWatchKeyRef.current = null;
        if (renderReadyTimeoutRef.current !== null) {
          window.clearTimeout(renderReadyTimeoutRef.current);
          renderReadyTimeoutRef.current = null;
        }
        const message = typeof data.error === 'string' ? data.error : 'The preview application failed to render.';
        reportPreviewError(message);
        onError?.(message);
        return;
      }

      // ── Selection bridge ────────────────────────────────────────────────
      if (data.type === 'EDIT_MODE_BRIDGE_READY' || data.type === 'EDIT_MODE_READY') {
        bridgeReadyRef.current = true;
        // On first ready, push the current state so a freshly-mounted iframe
        // immediately matches the parent's enableSelection prop.
        if (data.type === 'EDIT_MODE_BRIDGE_READY') {
          const win = getPreviewWindow();
          if (win) {
            win.postMessage({
              type: 'EDIT_MODE_TOGGLE',
              enabled: enableSelection,
              activationKey: editActivationKeyRef.current,
              revisionId,
              siteId,
            }, '*');
            // Fresh iframe document (rebuild) — re-attach the highlight to the
            // same object the user had selected before the redraw.
            if (enableSelection && lastSelectionRef.current) {
              win.postMessage({ type: 'UT_REACQUIRE_SELECTION', selection: lastSelectionRef.current }, '*');
            }
          }
        }
        return;
      }
      if (data.type === 'ELEMENT_SELECTED' && data.element) {
        // Ignore stale selections from a previous activation cycle
        if (typeof data.activationKey === 'number' && data.activationKey !== editActivationKeyRef.current) return;
        // A selection is only valid for the canonical revision that rendered it.
        if (revisionId && data.element.revisionId && data.element.revisionId !== revisionId) return;
        clearDirectPreviewSelection();
        const sa = data.element.scopeAncestors ?? {};
        lastSelectionRef.current = {
          selector: data.element.selector,
          sectionId: sa.sectionId ?? null,
          structuralPath: sa.structuralPath,
          repeatIndex: typeof sa.repeatIndex === 'number' ? sa.repeatIndex : null,
          resource: sa.resource ?? data.element.attributes?.['data-ut-resource'] ?? null,
        };
        onElementSelect?.(data.element);
        return;
      }
      if (data.type === 'INLINE_TEXT_EDIT_COMMIT') {
        const source = event.source as Window | null;
        const respond = (ok: boolean) => {
          try { source?.postMessage({ type: 'INLINE_TEXT_EDIT_RESULT', editId: data.editId, ok }, '*'); }
          catch { /* preview navigated during the save */ }
        };
        if (!source || !onInlineTextCommit || typeof data.editId !== 'number'
          || typeof data.selector !== 'string' || typeof data.text !== 'string'
          || (revisionId && data.revisionId && data.revisionId !== revisionId)) {
          respond(false);
          return;
        }
        void Promise.resolve(onInlineTextCommit({
          selector: data.selector,
          text: data.text,
          originalText: typeof data.originalText === 'string' ? data.originalText : undefined,
          revisionId: typeof data.revisionId === 'string' ? data.revisionId : null,
          target: {
            pagePath: typeof data.target?.pagePath === 'string' ? data.target.pagePath : null,
            sectionId: typeof data.target?.sectionId === 'string' ? data.target.sectionId : null,
            sectionType: typeof data.target?.sectionType === 'string' ? data.target.sectionType : null,
            slotId: typeof data.target?.slotId === 'string' ? data.target.slotId : null,
            resourceMark: typeof data.target?.resourceMark === 'string' ? data.target.resourceMark : null,
          },
        })).then((result) => respond(result !== false)).catch(() => respond(false));
        return;
      }
      if (data.type === 'UT_REACQUIRE_RESULT' && data.ok === false) {
        // The selected object no longer exists in the redrawn preview — drop it.
        lastSelectionRef.current = null;
        return;
      }

      if (data.type === 'preview-nav' && data.intent === 'nav.goto') {
        onNavigate?.(data.path);
      }

      // Forward NAV_PAGE_GENERATE from Sandpack iframe to WebBuilder
      if (data.type === 'NAV_PAGE_GENERATE') {
        const pageName = data.pageName || '';
        if (pageName && pageName !== 'index') {
          onNavigate?.(pageName);
        }
      }

      if (data.type === 'INTENT_TRIGGER') {
        const { intent, payload } = data;
        const enrichedPayload = {
          ...payload,
          businessId: businessId || payload.businessId,
          siteId: siteId || payload.siteId,
        };
        onIntentTrigger?.(intent, enrichedPayload);
      }

      // Capture runtime errors forwarded from Sandpack iframe
      if (data.type === 'console' && data.log) {
        const log = data.log;
        if (log.method === 'error' && log.data?.length) {
          const errorMsg = log.data.map((d: any) => typeof d === 'string' ? d : JSON.stringify(d)).join(' ');
          if (errorMsg && !errorMsg.includes('ResizeObserver') && !errorMsg.includes('MutationRecord')) {
            onError?.(errorMsg);
          }
        }
      }
      // ── Catalog hydration bridge (Track B, Pass 3) ────────────────────────
      // Generated sections post CATALOG_HYDRATE_REQUEST asking the host to
      // resolve their live rows against site_data_bindings. We look up the
      // binding, project rows plus card metadata, and echo back.
      if (data.type === 'CATALOG_HYDRATE_REQUEST') {
        const source = event.source as Window | null;
        const requestId = data.requestId;
        const pagePath: string = (data.pagePath as string) || '/';
        const sectionId: string | null = data.sectionId ?? null;
        const sectionType: string | null = data.sectionType ?? null;
        const occurrenceIndex: number | null =
          typeof data.occurrenceIndex === 'number' ? data.occurrenceIndex : null;
        // The canonical runtime context is authoritative. URL parsing remains
        // only as a compatibility fallback for legacy/non-builder previews.
        let projectId = builderSession.runtimeContext?.projectId || builderSession.projectId || '';
        if (!projectId) {
          try {
            projectId = new URLSearchParams(window.location.search).get('id') || '';
          } catch { /* ignore */ }
        }
        if (!projectId || !source) {
          try {
            source?.postMessage(
              { type: 'CATALOG_HYDRATE_RESPONSE', requestId, rows: null, fallback: 'hide_section' },
              '*',
            );
          } catch { /* ignore */ }
          return;
        }
        void resolveHydrationRequest({ projectId, pagePath, sectionId, sectionType, occurrenceIndex })
          .then((result) => {
            const rows = projectRowsForSection(result);
            try {
              source.postMessage(
                {
                  type: 'CATALOG_HYDRATE_RESPONSE',
                  requestId,
                  rows,
                  cardBinding: result.cardBinding,
                  bindingId: result.binding?.id ?? null,
                  sourceTable: result.binding?.sourceTable ?? null,
                  fallback: result.fallback,
                },
                '*',
              );
            } catch { /* ignore */ }
          })
          .catch((err) => {
            try {
              source.postMessage(
                {
                  type: 'CATALOG_HYDRATE_RESPONSE',
                  requestId,
                  rows: null,
                  fallback: 'hide_section',
                  error: String(err),
                },
                '*',
              );
            } catch { /* ignore */ }
          });
        return;
      }

      // Forward binding-change bumps from the Builder into the preview iframe
      // so mounted sections re-request their live rows.
      if (data.type === 'CATALOG_BINDINGS_CHANGED' || data.type === 'RESOURCE_INVALIDATED') {
        try {
          const target = getPreviewWindow();
          target?.postMessage({ type: 'CATALOG_BINDINGS_CHANGED', invalidation: data.type === 'RESOURCE_INVALIDATED' ? data : undefined }, '*');
        } catch { /* ignore */ }
        return;
      }
    };

    window.addEventListener('message', handlePreviewMessage);
    return () => window.removeEventListener('message', handlePreviewMessage);
  }, [builderSession.projectId, builderSession.runtimeContext?.projectId, onNavigate, onIntentTrigger, businessId, siteId, revisionId, onError, onReady, onElementSelect, onInlineTextCommit, enableSelection, getPreviewWindow, clearDirectPreviewSelection, handleSandpackRunning]);


  
  // Initialize Sandpack as the canonical preview runtime.
  useEffect(() => {
    if (startAttemptedRef.current) return;
    startAttemptedRef.current = true;

    setBackend('sandpack');

  }, [onReady, pipelineError, previewCompiling]);
  
  // Sync file changes to Docker when running
  useEffect(() => {
    if (backend !== 'docker' || !dockerService.session || dockerService.session.status !== 'running') return;
    if (canUseContextPreview) return;
    for (const [path, content] of Object.entries(files)) {
      dockerService.patchFile(path, content);
    }
  }, [files, backend, canUseContextPreview, dockerService]);
  
  // Handlers
  const handleStartDocker = useCallback(async () => {
    setBackend('sandpack');
    onError?.('Docker preview is disabled. React preview is the only supported runtime.');
  }, [onError]);
  
  const handleStopDocker = useCallback(async () => {
    await dockerService.stopSession();
    setBackend('sandpack');
  }, [dockerService]);
  
  const handleRestart = useCallback(() => {
    if (backend === 'docker') {
      const entryPath = resolveLauncherEntryPoint(
        files,
        launch?.runtimeManifest?.entryPoint || launch?.entryPoint,
      );
      dockerService.patchFile(entryPath, files[entryPath] || '');
    } else {
      // Force Sandpack remount
      renderRecoveryCountRef.current = 0;
      renderReadyRef.current = false;
      renderWatchKeyRef.current = null;
      setSandpackRenderExhausted(false);
      setSandpackKey(k => k + 1);
    }
  }, [backend, dockerService, files, launch]);

  const handleSandpackTimeout = useCallback(() => {
    if (
      timeoutRecoveryCountRef.current >= MAX_SANDPACK_TIMEOUT_RECOVERIES ||
      timeoutRecoveryTimerRef.current !== null
    ) {
      if (timeoutRecoveryCountRef.current >= MAX_SANDPACK_TIMEOUT_RECOVERIES) {
        setSandpackTimeoutExhausted(true);
      }
      return;
    }

    timeoutRecoveryCountRef.current += 1;
    // Sandpack has already unregistered the timed-out client and removed the
    // iframe src. Remount only after that teardown settles; remounting during
    // the handshake would abort a client that could still connect.
    timeoutRecoveryTimerRef.current = window.setTimeout(() => {
      timeoutRecoveryTimerRef.current = null;
      setSandpackKey((key) => key + 1);
    }, 700 * timeoutRecoveryCountRef.current);
  }, []);

  const handleRetrySandpackConnection = useCallback(() => {
    if (timeoutRecoveryTimerRef.current !== null) {
      window.clearTimeout(timeoutRecoveryTimerRef.current);
      timeoutRecoveryTimerRef.current = null;
    }
    timeoutRecoveryCountRef.current = 0;
    setSandpackTimeoutExhausted(false);
    renderRecoveryCountRef.current = 0;
    renderReadyRef.current = false;
    renderWatchKeyRef.current = null;
    setSandpackRenderExhausted(false);
    if (renderReadyTimeoutRef.current !== null) {
      window.clearTimeout(renderReadyTimeoutRef.current);
      renderReadyTimeoutRef.current = null;
    }
    setSandpackKey((key) => key + 1);
  }, []);

  useEffect(() => () => {
    if (timeoutRecoveryTimerRef.current !== null) {
      window.clearTimeout(timeoutRecoveryTimerRef.current);
    }
    if (renderReadyTimeoutRef.current !== null) {
      window.clearTimeout(renderReadyTimeoutRef.current);
    }
  }, []);
  
  const handleOpenInNewTab = useCallback(() => {
    if (backend === 'docker' && dockerService.session?.iframeUrl) {
      window.open(dockerService.session.iframeUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (backend === 'local' && LOCAL_PREVIEW_URL) {
      window.open(LOCAL_PREVIEW_URL, '_blank', 'noopener,noreferrer');
      return;
    }
    // Sandpack: persist the canonical files and open a stable same-origin route.
    try {
      const root = previewContainerRef.current;
      if (!root) {
        onError?.('Preview is still starting — try again in a moment.');
        return;
      }
      const spIframe = root.querySelector('iframe.sp-preview-iframe, iframe[title*="Sandpack"], iframe[src*="csb.app"], iframe[src*="codesandbox"]') as HTMLIFrameElement | null;
      const src = spIframe?.src;
      if (src) {
        const previewTitle = document.title
          .replace(/\s*[|–—-]\s*Unison.*$/i, '')
          .trim() || 'Site preview';
        const previewKey = createExternalPreviewSession(files, previewTitle);
        const previewUrl = new URL(`/preview/${previewKey}`, window.location.origin);
        window.open(previewUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      onError?.('Preview is still starting — try again in a moment.');
    } catch (err) {
      console.error('[VFSPreview] openInNewTab failed:', err);
      onError?.('Failed to open preview in new tab.');
    }
  }, [backend, dockerService.session, files, onError]);

  // Navigate preview to a hash route via postMessage.
  //
  // The Sandpack iframe is mounted by <SandpackPreview>, so iframeRef is null
  // for that backend and the frame may not exist yet (or may be remounted by a
  // rebuild) at the moment a page tab is clicked. The requested route is
  // therefore retried until the nav bridge is reachable, and remembered so a
  // later reload lands on the same page instead of falling back to home.
  const resolvePreviewIframe = useCallback((): HTMLIFrameElement | null => {
    if (iframeRef.current?.contentWindow) return iframeRef.current;
    const root: ParentNode = previewContainerRef.current ?? document;
    const sp = root.querySelector(
      'iframe.sp-preview-iframe, .sp-preview iframe, iframe[title*="Sandpack"]'
    ) as HTMLIFrameElement | null;
    return sp?.contentWindow ? sp : null;
  }, []);

  const handleNavigateToRoute = useCallback((route: string) => {
    pendingRouteRef.current = route;
    if (navRetryTimerRef.current) {
      window.clearTimeout(navRetryTimerRef.current);
      navRetryTimerRef.current = null;
    }

    let attempts = 0;
    const send = () => {
      navRetryTimerRef.current = null;
      if (pendingRouteRef.current !== route) return; // superseded by a newer request
      attempts += 1;
      const iframe = resolvePreviewIframe();
      try {
        iframe?.contentWindow?.postMessage({ type: 'NAV_ROUTE', route }, '*');
      } catch (_e) { /* cross-origin frame */ }

      // Keep re-sending briefly: the bridge listener mounts after the frame.
      if (attempts < 12) {
        navRetryTimerRef.current = window.setTimeout(send, iframe ? 300 : 200);
      }
    };
    send();
  }, [resolvePreviewIframe]);

  useEffect(() => () => {
    if (navRetryTimerRef.current) window.clearTimeout(navRetryTimerRef.current);
  }, []);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    refresh: handleRestart,
    startDocker: handleStartDocker,
    stopDocker: handleStopDocker,
    getBackend: () => backend,
    openInNewTab: handleOpenInNewTab,
    getIframe: () => {
      // Docker/local backends attach iframeRef directly. On Sandpack the
      // rendered iframe lives inside <SandpackPreview>, so fall back to a
      // DOM query so consumers (behavior map, edit-mode bridge) can still
      // reach the running app iframe.
      if (iframeRef.current) return iframeRef.current;
      try {
        const sp = previewContainerRef.current?.querySelector(
          'iframe.sp-preview-iframe, .sp-preview iframe'
        ) as HTMLIFrameElement | null;
        return sp ?? null;
      } catch {
        return null;
      }
    },
    navigateToRoute: handleNavigateToRoute,
    clearSelectedElement,
  }), [handleRestart, handleStartDocker, handleStopDocker, backend, handleOpenInNewTab, handleNavigateToRoute, clearSelectedElement]);
  
  // Docker preview URL
  const dockerUrl = useMemo(() => {
    if (backend === 'docker' && dockerService.session?.iframeUrl) return dockerService.session.iframeUrl;
    if (backend === 'local' && LOCAL_PREVIEW_URL) return LOCAL_PREVIEW_URL;
    return null;
  }, [backend, dockerService.session]);
  
  if (pipelineError) {
    const goLauncher = () => {
      try {
        sessionStorage.removeItem('unison.launcher.handoff');
      } catch {
        // Session storage can be unavailable in privacy-restricted contexts.
      }
      window.location.assign('/system-launcher');
    };

    if (isCanonicalRuntimeError(pipelineError)) {
      return (
        <div className={cn('flex flex-col h-full bg-background rounded-lg overflow-hidden border border-border', className)}>
          <LaunchGateNotice
            error={pipelineError}
            onRunLauncher={goLauncher}
          />
        </div>
      );
    }

    return (
      <div className={cn('flex flex-col h-full bg-background rounded-lg overflow-hidden border border-border', className)}>
        <PreviewRuntimeError
          error={pipelineError}
          onRetry={retryArtifactCompile}
          onRelaunch={goLauncher}
          onResolveConflict={(choice) => {
            const pending = pipelineError.details.pendingConflict;
            if (!pending) return;
            resolvePendingVfsConflicts(pending.scope, pending.acceptedRevisionId, choice);
            retryArtifactCompile();
          }}
        />
      </div>
    );
  }

  if (emptyDraft) {
    return (
      <div className={cn('flex flex-col h-full bg-background rounded-lg overflow-hidden border border-border', className)}>
        {showToolbar && (
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                <Zap className="h-3 w-3" /> Preview idle
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={handleRestart} className="h-7 w-7 p-0" title="Refresh preview">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div className="max-w-sm space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted/60">
              <Zap className="h-4 w-4 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Preview waiting for app files</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Start from a template or ask Affinity to create a page. The preview will compile as soon as a real React entry or page file exists.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={previewContainerRef}
      data-unison-preview-runtime="true"
      data-unison-preview-revision={revisionId ?? undefined}
      className={cn('flex flex-col h-full bg-background rounded-lg overflow-hidden border border-border', className)}
    >
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
          <div className="flex items-center gap-2">
            {showBackendIndicator && (
              <div className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
                backend === 'docker' && 'bg-green-500/20 text-green-600 dark:text-green-400',
                backend === 'local' && 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
                backend === 'sandpack' && 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
                backend === 'loading' && 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
              )}>
                {backend === 'docker' && <><Server className="h-3 w-3" /> Docker HMR</>}
                {backend === 'local' && <><Server className="h-3 w-3" /> Local Vite</>}
                {backend === 'sandpack' && <><Zap className="h-3 w-3" /> React Live</>}
                {backend === 'loading' && <><Loader2 className="h-3 w-3 animate-spin" /> Starting...</>}
              </div>
            )}
            
            {backend === 'docker' && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {dockerService.connected ? (
                  <><Wifi className="h-3 w-3 text-green-500" /> Connected</>
                ) : (
                  <><WifiOff className="h-3 w-3 text-yellow-500" /> Connecting...</>
                )}
              </div>
            )}
            {backend === 'local' && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Wifi className="h-3 w-3 text-green-500" /> {LOCAL_PREVIEW_URL}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {dockerGatewayConfigured && (
              <>
                {backend === 'docker' ? (
                  <Button size="sm" variant="ghost" onClick={handleStopDocker} className="h-7 px-2 gap-1 text-xs" title="Stop Docker preview">
                    <Square className="h-3 w-3" /> Stop
                  </Button>
                ) : backend !== 'loading' && (
                  <Button size="sm" variant="default" onClick={handleStartDocker} className="h-7 px-2 gap-1 text-xs" title="Start Docker preview with HMR">
                    <Play className="h-3 w-3" /> Start Docker
                  </Button>
                )}
              </>
            )}
            
            <Button size="sm" variant="ghost" onClick={handleRestart} disabled={backend === 'loading'} className="h-7 w-7 p-0" title="Refresh preview">
              <RefreshCw className={cn('h-4 w-4', backend === 'loading' && 'animate-spin')} />
            </Button>
            
            {backend === 'docker' && (
              <Button size="sm" variant="ghost" onClick={() => setShowLogs(!showLogs)} className={cn('h-7 px-2 gap-1 text-xs', showLogs && 'bg-accent')}>
                <Terminal className="h-3 w-3" /> Logs
              </Button>
            )}
            
            <Button size="sm" variant="ghost" onClick={handleOpenInNewTab} className="h-7 w-7 p-0" title="Open preview in new tab">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Error display */}
      {dockerGatewayConfigured && dockerService.error && (
        <div className="px-3 py-2 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {dockerService.error}
        </div>
      )}

      {acceptedRevisionPreview && backend === 'sandpack' && !previewCompiling && !pipelineError && (
        <div role="status" className="flex items-center gap-2 border-b border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Showing the last accepted revision. Conflicting pending edits are preserved but not included in this preview.
        </div>
      )}
      
      {/* Preview Content */}
      <div className="flex-1 relative min-h-0">
        {/* Loading State */}
        {backend === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Starting Docker preview...</p>
            </div>
          </div>
        )}
        
        {/* Docker / Local Vite iframe */}
        {(backend === 'docker' || backend === 'local') && dockerUrl && (
          <div 
            className="w-full h-full flex justify-center overflow-hidden bg-muted"
            style={{ padding: device !== 'desktop' ? '16px' : 0 }}
          >
            <iframe
              ref={iframeRef}
              src={dockerUrl}
              className="h-full border-0 bg-white transition-all duration-300"
              style={{
                width: device === 'mobile' ? '375px' : device === 'tablet' ? '768px' : '100%',
                maxWidth: '100%',
                boxShadow: device !== 'desktop' ? '0 4px 20px rgba(0,0,0,0.15)' : 'none',
                borderRadius: device !== 'desktop' ? '12px' : '0',
                pointerEvents: enableSelection ? 'auto' : undefined,
              }}
              title="VFS Preview"
              sandbox={enableSelection
                ? 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals'
                : 'allow-scripts allow-forms allow-popups allow-modals'}
            />
          </div>
        )}
        
        {/* Snapshot-only gate: pipeline error surfaces instead of a stale/minimal preview */}
        {backend === 'sandpack' && !previewCompiling && pipelineError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background p-6 z-10">
            <div className="max-w-md text-center space-y-3">
              <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
              <h3 className="text-sm font-semibold">Preview blocked by canonical gate</h3>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                {pipelineError.summary}
              </p>
              <p className="text-[10px] text-muted-foreground/70 font-mono">
                [{pipelineError.stage}] {pipelineError.message}
              </p>

            </div>
          </div>
        )}

        {backend === 'sandpack' && !previewCompiling && !pipelineError && !emptyDraft && (sandpackTimeoutExhausted || sandpackRenderExhausted) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background p-6">
            <div className="max-w-sm text-center space-y-3">
              <WifiOff className="h-8 w-8 mx-auto text-muted-foreground" />
              <h3 className="text-sm font-semibold">
                {sandpackRenderExhausted ? 'Preview did not render' : 'Preview runner did not connect'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {sandpackRenderExhausted
                  ? 'The preview runner connected, but the app did not finish rendering.'
                  : 'The generated site is ready, but the in-browser preview runner could not finish its module connection.'}
              </p>
              <Button size="sm" onClick={handleRetrySandpackConnection}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Preview
              </Button>
            </div>
          </div>
        )}

        {/* Empty draft — no snapshot, no source. Render idle, never a minimal fallback. */}
        {backend === 'sandpack' && previewCompiling && !hasCompiledPreview && (
          <div className="absolute inset-0 flex items-center justify-center bg-background p-6 z-10">
            <div className="max-w-sm text-center space-y-2">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
              <h3 className="text-sm font-semibold">Preparing preview</h3>
              <p className="text-xs text-muted-foreground">
                The builder shell is ready while the site runtime compiles in the background.
              </p>
            </div>
          </div>
        )}

        {backend === 'sandpack' && !previewCompiling && !pipelineError && emptyDraft && (
          <div className="absolute inset-0 flex items-center justify-center bg-background p-6 z-10">
            <div className="max-w-sm text-center space-y-2">
              <Zap className="h-8 w-8 mx-auto text-muted-foreground" />
              <h3 className="text-sm font-semibold">Preview idle</h3>
              <p className="text-xs text-muted-foreground">
                No SiteBundleSnapshot is bound to this draft yet. Ask Affinity to generate the first page — the canonical preview will hydrate automatically.
              </p>
            </div>
          </div>
        )}

        {/* Sandpack In-Browser React Preview — the primary rendering engine */}
        {backend === 'sandpack' && (!previewCompiling || hasCompiledPreview) && !pipelineError && !emptyDraft && !sandpackTimeoutExhausted && !sandpackRenderExhausted && (
          <SandpackErrorBoundary key={`boundary-${sandpackKey}`}>
            <SandpackProvider
              key={`sandpack-${sandpackKey}`}
              template="react-ts"
              files={sandpackFiles}
              theme="light"
              options={sandpackProviderOptions}
              customSetup={sandpackCustomSetup}
            >
              <SandpackLayout
                className="!flex-1 !min-h-0 !border-0 !rounded-none !bg-transparent"
                style={{
                  height: '100%',
                  width: device === 'mobile' ? '375px' : device === 'tablet' ? '768px' : '100%',
                  maxWidth: '100%',
                  marginInline: 'auto',
                }}
              >
                <SandpackPreview
                  startRoute="/sandpack/index.html"
                  showNavigator={false}
                  showRefreshButton={false}
                  showOpenInCodeSandbox={false}
                  style={{ height: '100%', minHeight: 0 }}
                />
              </SandpackLayout>
              <SandpackErrorListener
                onError={handleSandpackError}
                onTimeout={handleSandpackTimeout}
                onRunning={handleSandpackRunning}
                dependencies={sandpackDeps}
              />
              <SandpackDependencyProgress dependencyCount={Object.keys(sandpackDeps).length} />
            </SandpackProvider>
          </SandpackErrorBoundary>
        )}

        
        {/* Logs Panel */}
        {showLogs && backend === 'docker' && (
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-background/95 text-green-600 dark:text-green-400 font-mono text-xs overflow-hidden flex flex-col border-t border-border">
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50">
              <span className="text-muted-foreground">Container Logs</span>
              <Button size="sm" variant="ghost" onClick={() => setShowLogs(false)} className="h-5 w-5 p-0">
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {logs.length === 0 ? (
                <span className="text-muted-foreground">No logs yet...</span>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="whitespace-pre-wrap">{log}</div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

VFSPreview.displayName = 'VFSPreview';

export default VFSPreview;
