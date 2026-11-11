import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Info, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ImportedSourceRecords } from '@/services/import/importedSourceRecords';
import type { ImportCompatibilityProfile } from '@/services/import/importCompatibilityProfile';
import { planSourceBuild, SOURCE_BUILD_ADAPTER } from '@/services/import/sourceBuild/sourceBuildPlan';
import type { SourceBuildResult } from '@/services/import/sourceBuild/sourceBundler';
import { buildImportedSourceInBrowser } from '@/services/import/sourceBuild/browserSourceBuild';
import { buildImportedPublishArtifact } from '@/services/import/importedPublishArtifact';
import {
  findSavedImportedRevision,
  loadLatestImportedVerification,
  recordImportedSourceVerification,
  summarizeVerification,
  type RouteProbe,
  type VerificationSummary,
} from '@/services/import/importedSourceVerification';
import { ImportedSourcePreviewStatus } from './ImportedSourcePreviewStatus';

const RUNTIME_URL = '/import-runtime.html';
const PROBE_SETTLE_MS = 1500;

type RuntimeMessage = { source?: string; nonce?: string; type?: string; path?: string; message?: string; requestId?: string } & Partial<RouteProbe>;

/**
 * UIMP-01 Phase D/E — runs a build-based import (React + Vite, TanStack Start)
 * from its saved source in an opaque-origin frame, and lets the owner check
 * every page and confirm the preview matches their original before the same
 * saved version can be published.
 */
export function ImportedSourceRuntimeFrame({ records, files, assetUrls, projectId, adapter, className }: {
  records: ImportedSourceRecords;
  files: Record<string, string>;
  assetUrls: Record<string, string>;
  projectId?: string;
  adapter: ImportCompatibilityProfile['previewAdapter'];
  className?: string;
}) {
  const plan = useMemo(() => planSourceBuild(records.profile, files), [records.profile, files]);
  const routes = useMemo(() => {
    const list = records.profile.routing.routes.filter((r) => r.kind === 'page' && !/[$:[*]/.test(r.path) && !r.path.startsWith('/__')).map((r) => r.path);
    return list.length > 0 ? [...new Set(list)] : ['/'];
  }, [records.profile.routing.routes]);
  const [build, setBuild] = useState<SourceBuildResult | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [buildKey, setBuildKey] = useState(0);
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
  const nonce = useMemo(() => crypto.randomUUID(), [build]); // eslint-disable-line react-hooks/exhaustive-deps
  const probeWaiters = useRef(new Map<string, (probe: RouteProbe) => void>());

  useEffect(() => {
    let cancelled = false;
    setBuild(null);
    setBuildError(null);
    setRuntimeErrors([]);
    buildImportedSourceInBrowser({ plan, files, assetUrls })
      .then((result) => { if (!cancelled) setBuild(result); })
      .catch((error: unknown) => { if (!cancelled) setBuildError(error instanceof Error ? error.message : String(error)); });
    return () => { cancelled = true; };
  }, [plan, files, assetUrls, buildKey]);

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
        frameRef.current?.contentWindow?.postMessage({ type: 'unison-source-runtime:boot', document: build.document, publicUrls: build.publicUrls, initialPath: route, nonce }, '*');
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
      const revision = await findSavedImportedRevision(projectId, files);
      if (!revision) throw new Error('Save your latest changes first; only a saved version can be checked for publishing.');
      const artifact = await buildImportedPublishArtifact({
        adapter: SOURCE_BUILD_ADAPTER,
        records,
        files,
        build: ({ files: f, assetUrls: urls }) => buildImportedSourceInBrowser({ plan, files: f, assetUrls: urls }),
      });
      const result = await recordImportedSourceVerification({
        projectId,
        revisionId: revision.id,
        vfsHash: revision.vfsHash,
        adapter: SOURCE_BUILD_ADAPTER,
        artifactHash: artifact.hash,
        summary,
        ownerConfirmed: confirmed,
        adaptations: build?.adaptations ?? [],
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

  return (
    <div
      data-unison-imported-source-preview="running"
      data-import-framework={records.profile.framework}
      data-import-adapter={SOURCE_BUILD_ADAPTER}
      className={cn('relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background', className)}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        {routes.length > 1 ? (
          <Select value={routes.includes(route) ? route : undefined} onValueChange={navigate}>
            <SelectTrigger className="h-8 w-48 text-xs" aria-label="Page">
              <SelectValue placeholder={route} />
            </SelectTrigger>
            <SelectContent>
              {routes.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs font-medium text-foreground">{route}</span>
        )}
        <span className="truncate text-xs text-muted-foreground">
          {build ? 'Built from your original files, unchanged' : buildFailed ? 'Could not build' : 'Building your original files…'}
          {runtimeErrors.length > 0 ? ` · ${runtimeErrors.length} error${runtimeErrors.length === 1 ? '' : 's'} while running` : ''}
        </span>
        {publishReady && (
          <span className="flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Ready to publish</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={runChecks} disabled={!build?.ok || checking}>
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />}
            {checking ? 'Checking pages…' : 'Check pages'}
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Rebuild" aria-label="Rebuild preview" onClick={() => setBuildKey((k) => k + 1)}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails}>
            {showDetails ? <X className="h-3.5 w-3.5" aria-hidden /> : <Info className="h-3.5 w-3.5" aria-hidden />}
            {showDetails ? 'Close' : 'Import details'}
          </Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        {build?.ok ? (
          <iframe
            key={nonce}
            ref={frameRef}
            title="Imported project preview"
            className="h-full w-full border-0 bg-background"
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
            referrerPolicy="no-referrer"
            src={RUNTIME_URL}
          />
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
          <div className="absolute inset-x-0 bottom-0 max-h-[60%] overflow-auto border-t border-border bg-background p-4" role="region" aria-label="Page check results">
            <div className="mx-auto w-full max-w-xl space-y-3">
              <p className="text-xs font-medium text-foreground">
                {summary.status === 'passed' ? `All ${summary.routes.length} page${summary.routes.length === 1 ? '' : 's'} rendered without errors.` : 'Some pages need attention before publishing.'}
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {summary.routes.map((r) => (
                  <li key={r.path}>{r.ok ? '✓' : '✗'} {r.path}{r.problems.length ? ` — ${r.problems.join(' ')}` : ''}</li>
                ))}
              </ul>
              {summary.status === 'passed' && (
                <label className="flex items-start gap-2 text-xs text-foreground">
                  <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} aria-label="Confirm the preview matches the original" />
                  <span>I looked through these pages and they match my original design.</span>
                </label>
              )}
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" onClick={saveCheck} disabled={saving || !projectId || (summary.status === 'passed' && !confirmed)}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                  {summary.status === 'passed' ? 'Save check and allow publishing' : 'Save check result'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSummary(null)}>Close</Button>
              </div>
              {saveMessage && <p role="status" className="text-xs text-muted-foreground">{saveMessage}</p>}
            </div>
          </div>
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
  );
}
