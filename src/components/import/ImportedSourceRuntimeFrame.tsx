import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ClipboardCheck, Info, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ImportedSourceRecords } from '@/services/import/importedSourceRecords';
import type { ImportCompatibilityProfile } from '@/services/import/importCompatibilityProfile';
import { planSourceBuild, SOURCE_BUILD_ADAPTER } from '@/services/import/sourceBuild/sourceBuildPlan';
import type { SourceBuildResult } from '@/services/import/sourceBuild/sourceBundler';
import { buildImportedSourceInBrowser } from '@/services/import/sourceBuild/browserSourceBuild';
import { instrumentSourceForSelection, selectionBridgeScript } from '@/services/import/sourceBuild/previewInstrumentation';
import {
  findSavedImportedRevision,
  loadLatestImportedVerification,
  saveImportedVerification,
  summarizeVerification,
  type RouteProbe,
  type VerificationSummary,
} from '@/services/import/importedSourceVerification';
import { ImportedSourcePreviewStatus } from './ImportedSourcePreviewStatus';
import { ImportedVerificationPanel } from './ImportedVerificationPanel';

const RUNTIME_URL = '/import-runtime.html';
const PROBE_SETTLE_MS = 1500;

type RuntimeMessage = { source?: string; nonce?: string; type?: string; path?: string; message?: string; requestId?: string } & Partial<RouteProbe>;

/**
 * UIMP-01 Phase D/E — runs a build-based import (React + Vite, TanStack Start)
 * from its saved source in an opaque-origin frame, and lets the owner check
 * every page and confirm the preview matches their original before the same
 * saved version can be published.
 */
export function ImportedSourceRuntimeFrame({ records, files, assetUrls, projectId, adapter, className, editable = false, onFrameChange, revisionId, toolbarHost, previewScale = 1, device = 'desktop', onRefreshReady }: {
  records: ImportedSourceRecords;
  files: Record<string, string>;
  assetUrls: Record<string, string>;
  projectId?: string;
  adapter: ImportCompatibilityProfile['previewAdapter'];
  className?: string;
  /** Builder preview: clicks map to source lines through the shared selection bridge. */
  editable?: boolean;
  /** Reports the live preview frame so the builder can talk to its selection bridge. */
  onFrameChange?: (frame: HTMLIFrameElement | null) => void;
  /** Accepted revision the preview shows; stamped on locators so edits target exactly it. */
  revisionId?: string | null;
  /** Builder header slot for route and source-verification actions. */
  toolbarHost?: HTMLDivElement | null;
  previewScale?: number;
  device?: 'desktop' | 'tablet' | 'mobile';
  onRefreshReady?: (refresh: (() => void) | null) => void;
}) {
  const plan = useMemo(() => planSourceBuild(records.profile, files), [records.profile, files]);
  // Locators only for JSX projects compiled by esbuild (not Vue/Svelte/Solid compilers).
  const selectable = editable && !plan.compilers?.vue && !plan.compilers?.svelte && !plan.compilers?.solid;
  const previewFiles = useMemo(() => (selectable ? instrumentSourceForSelection(files, revisionId) : files), [selectable, files, revisionId]);
  const [editBridge, setEditBridge] = useState<string | null>(null);
  useEffect(() => {
    if (!selectable) { setEditBridge(null); return; }
    let cancelled = false;
    void selectionBridgeScript().then((script) => { if (!cancelled) setEditBridge(script); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [selectable]);
  const routes = useMemo(() => {
    const known = plan.next ? plan.next.routes.map((r) => ({ path: r.path, kind: 'page' as const })) : records.profile.routing.routes;
    const list = known.filter((r) => r.kind === 'page' && !/[$:[*]/.test(r.path) && !r.path.startsWith('/__')).map((r) => r.path);
    return list.length > 0 ? [...new Set(list)] : ['/'];
  }, [plan.next, records.profile.routing.routes]);
  const [build, setBuild] = useState<SourceBuildResult | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [buildKey, setBuildKey] = useState(0);
  const frameViewportWidth = device === 'desktop'
    ? `${100 / previewScale}%`
    : `${(device === 'tablet' ? 768 : 375) / previewScale}px`;
  const [route, setRoute] = useState('/');
  const [runtimeErrors, setRuntimeErrors] = useState<string[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [checking, setChecking] = useState(false);
  const [summary, setSummary] = useState<VerificationSummary | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [publishReady, setPublishReady] = useState(false);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const editBridgeRef = useRef<string | null>(null);
  editBridgeRef.current = editBridge;
  const onFrameChangeRef = useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;
  const attachFrame = useCallback((frame: HTMLIFrameElement | null) => {
    frameRef.current = frame;
    onFrameChangeRef.current?.(frame);
  }, []);
  const nonce = useMemo(() => crypto.randomUUID(), [build]); // eslint-disable-line react-hooks/exhaustive-deps
  const probeWaiters = useRef(new Map<string, (probe: RouteProbe) => void>());

  useEffect(() => {
    let cancelled = false;
    setBuild(null);
    setBuildError(null);
    setRuntimeErrors([]);
    buildImportedSourceInBrowser({ plan, files: previewFiles, assetUrls })
      .then((result) => { if (!cancelled) setBuild(result); })
      .catch((error: unknown) => { if (!cancelled) setBuildError(error instanceof Error ? error.message : String(error)); });
    return () => { cancelled = true; };
  }, [plan, previewFiles, assetUrls, buildKey]);

  useEffect(() => {
    onRefreshReady?.(() => {
      setBuildError(null);
      setBuildKey((key) => key + 1);
    });
    return () => onRefreshReady?.(null);
  }, [onRefreshReady]);

  // Already-confirmed saved version?
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void findSavedImportedRevision(projectId, files).then(async (revision) => {
      if (!revision || cancelled) return;
      const latest = await loadLatestImportedVerification(projectId, revision.id);
      if (!cancelled) setPublishReady(revision.publishReady && latest?.status === 'passed' && latest.owner_confirmed === true);
    });
    return () => { cancelled = true; };
  }, [files, projectId]);

  useEffect(() => {
    if (!build?.ok) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as RuntimeMessage | null;
      if (!data || data.source !== 'unison-source-runtime') return;
      if (data.type === 'unison-source-runtime:ready') {
        frameRef.current?.contentWindow?.postMessage({ type: 'unison-source-runtime:boot', document: build.document, publicUrls: build.publicUrls, initialPath: route, nonce, editBridge: selectable ? editBridgeRef.current : null }, '*');
        return;
      }
      if (data.nonce !== nonce) return;
      if (data.type === 'unison-source-runtime:route' && typeof data.path === 'string') setRoute(data.path.split(/[?#]/)[0] || '/');
      else if (data.type === 'unison-source-runtime:error' && data.message) setRuntimeErrors((prev) => (prev.length < 50 ? [...prev, data.message as string] : prev));
      else if (data.type === 'unison-source-runtime:probe-result' && data.requestId) {
        probeWaiters.current.get(data.requestId)?.({
          path: data.path ?? '/', textLength: data.textLength ?? 0, elementCount: data.elementCount ?? 0,
          imagesBroken: data.imagesBroken ?? [], errors: data.errors ?? [], title: data.title,
        });
        probeWaiters.current.delete(data.requestId);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // route is read only at boot; re-subscribing on navigation would re-boot nothing.
  }, [build, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const post = useCallback((message: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage({ ...message, nonce }, '*');
  }, [nonce]);

  const navigate = (path: string) => { setRoute(path); post({ type: 'unison-source-runtime:navigate', path }); };

  const probe = (path: string) => new Promise<RouteProbe>((resolve) => {
    const requestId = crypto.randomUUID();
    const timer = window.setTimeout(() => { probeWaiters.current.delete(requestId); resolve({ path, textLength: 0, elementCount: 0, imagesBroken: [], errors: ['The page did not respond.'] }); }, 8000);
    probeWaiters.current.set(requestId, (result) => { window.clearTimeout(timer); resolve(result); });
    post({ type: 'unison-source-runtime:probe', requestId });
  });

  const runChecks = async () => {
    if (checking) return;
    setChecking(true);
    setSummary(null);
    setConfirmed(false);
    setSaveMessage(null);
    const results: RouteProbe[] = [];
    let errorsBefore = 0;
    for (const path of routes) {
      navigate(path);
      await new Promise((r) => window.setTimeout(r, PROBE_SETTLE_MS));
      const result = await probe(path);
      // Errors are cumulative inside the frame; attribute only new ones to this page.
      results.push({ ...result, path, errors: result.errors.slice(errorsBefore) });
      errorsBefore = result.errors.length;
    }
    setSummary(summarizeVerification(results, routes));
    setChecking(false);
  };

  const saveCheck = async () => {
    if (!summary || !projectId || saving) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const result = await saveImportedVerification({
        projectId,
        files,
        records,
        adapter: SOURCE_BUILD_ADAPTER,
        summary,
        ownerConfirmed: confirmed,
        adaptations: build?.adaptations ?? [],
        build: ({ files: f, assetUrls: urls }) => buildImportedSourceInBrowser({ plan, files: f, assetUrls: urls }),
      });
      setPublishReady(result.publishReady);
      setSaveMessage(result.publishReady ? 'Saved. This version can now be published.' : 'Saved. Publishing stays off until every page passes and you confirm it matches.');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'The check could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const buildFailed = buildError || (build && !build.ok);
  const issues = build?.diagnostics.filter((d) => d.level !== 'info') ?? [];
  const toolbarActions = toolbarHost ? createPortal(
    <>
      {routes.length > 1 && (
        <Select value={routes.includes(route) ? route : routes[0]} onValueChange={navigate}>
          <SelectTrigger className="h-8 w-auto min-w-24 max-w-36 border-white/[0.08] bg-[#0f0f11] px-3 text-xs text-[#e4e4e7]" aria-label="Imported page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/[0.08] bg-[#0f0f11] text-[#e4e4e7]">
            {routes.map((path) => <SelectItem key={path} value={path} className="text-xs">{path}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <span
        className="hidden max-w-40 truncate px-1 text-[11px] text-white/45 lg:inline"
        title={build ? 'Built from your original files, unchanged' : buildFailed ? 'Could not build the original files' : 'Building your original files'}
      >
        {build ? 'Original files' : buildFailed ? 'Build failed' : 'Building…'}
      </span>
      {publishReady && <CheckCircle2 className="hidden h-3.5 w-3.5 text-emerald-400 sm:block" aria-label="Ready to publish" title="Ready to publish" />}
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-white/55 hover:bg-white/[0.07] hover:text-white" onClick={runChecks} disabled={!build?.ok || checking} title={checking ? 'Checking pages' : 'Check pages'} aria-label={checking ? 'Checking pages' : 'Check pages'}>
        {checking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ClipboardCheck className="h-4 w-4" aria-hidden />}
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-white/55 hover:bg-white/[0.07] hover:text-white" title="Rebuild preview" aria-label="Rebuild preview" onClick={() => setBuildKey((key) => key + 1)}>
        <RefreshCw className="h-4 w-4" aria-hidden />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-white/55 hover:bg-white/[0.07] hover:text-white" onClick={() => setShowDetails((value) => !value)} aria-expanded={showDetails} title={showDetails ? 'Close project details' : 'Project details'} aria-label={showDetails ? 'Close project details' : 'Project details'}>
        {showDetails ? <X className="h-4 w-4" aria-hidden /> : <Info className="h-4 w-4" aria-hidden />}
      </Button>
    </>,
    toolbarHost,
  ) : null;

  return (
    <>
      {toolbarActions}
      <div
        data-unison-imported-source-preview="running"
        data-import-framework={records.profile.framework}
        data-import-adapter={SOURCE_BUILD_ADAPTER}
        className={cn('relative flex h-full flex-col overflow-hidden bg-background', className)}
      >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {build?.ok ? (
          <div className="absolute inset-0 flex justify-center overflow-hidden">
            <div className="shrink-0" style={{ width: frameViewportWidth, height: `${100 / previewScale}%`, transform: `scale(${previewScale})`, transformOrigin: 'top center' }}>
              <iframe
                key={`${nonce}:${editBridge ? 'edit' : 'view'}`}
                ref={attachFrame}
                title="Imported project preview"
                className="h-full w-full border-0 bg-background"
                sandbox="allow-scripts allow-forms allow-popups allow-modals"
                referrerPolicy="no-referrer"
                src={RUNTIME_URL}
              />
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground">
            {buildFailed ? (
              <div className="max-w-md space-y-2">
                <p className="font-medium text-foreground">This project could not be built from its files.</p>
                {(buildError ? [buildError] : build!.diagnostics.filter((d) => d.level === 'error').map((d) => d.message)).slice(0, 5).map((m, i) => <p key={i} className="break-words">{m}</p>)}
              </div>
            ) : (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Building your original files…</span>
            )}
          </div>
        )}
        {summary && !showDetails && (
          <ImportedVerificationPanel
            summary={summary}
            confirmed={confirmed}
            onConfirmedChange={setConfirmed}
            onSave={saveCheck}
            onClose={() => setSummary(null)}
            saving={saving}
            canSave={Boolean(projectId)}
            message={saveMessage}
          />
        )}
        {showDetails && (
          <div className="absolute inset-0 overflow-auto bg-background">
            <div className="mx-auto w-full max-w-xl space-y-3 px-6 pt-6">
              {build && build.adaptations.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-foreground">How this preview runs your files</p>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">{build.adaptations.map((a) => <li key={a}>{a}</li>)}</ul>
                </div>
              )}
              {issues.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-foreground">Things the project asks for that this preview could not supply</p>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">{issues.slice(0, 20).map((d, i) => <li key={`${d.code}:${i}`}>{d.message}</li>)}</ul>
                </div>
              )}
              {runtimeErrors.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-foreground">Errors while running</p>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">{runtimeErrors.slice(0, 10).map((m, i) => <li key={i} className="break-words">{m}</li>)}</ul>
                </div>
              )}
            </div>
            <ImportedSourcePreviewStatus records={records} adapter={adapter} running publishReady={publishReady} className="h-auto overflow-visible rounded-none border-0" />
          </div>
        )}
      </div>
      </div>
    </>
  );
}
