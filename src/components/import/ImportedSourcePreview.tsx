import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Info, RefreshCw, Square, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ImportedSourceRecords } from '@/services/import/importedSourceRecords';
import { toVfsPath } from '@/services/import/importedSourceRecords';
import { ISOLATED_SOURCE_PREVIEW_ADAPTER, resolveImportPreviewAdapter } from '@/services/import/importCompatibilityProfile';
import { startImportedPreviewSession, stopImportedPreviewSession, type ImportedPreviewSession } from '@/services/import/importedPreviewSession';
import {
  IMPORT_NAV_MESSAGE,
  STATIC_HTML_PREVIEW_ADAPTER,
  buildStaticHtmlPreviewDocument,
  listStaticHtmlPages,
} from '@/services/import/staticHtmlPreview';
import { ImportedSourcePreviewStatus } from './ImportedSourcePreviewStatus';

const SIGNED_URL_SECONDS = 60 * 60;

/**
 * UIMP-01 Phase D — Preview for externally imported projects.
 *
 * When a source-compatible adapter exists the original files run unchanged in
 * an opaque-origin frame (no access to Unison's session, storage or DOM).
 * Otherwise the truthful status panel is shown; a Unison-rendered substitute
 * is never displayed.
 */
export function ImportedSourcePreview({ records, files, projectId, onSessionChange, className }: {
  records: ImportedSourceRecords;
  files: Record<string, string>;
  projectId?: string;
  onSessionChange?: (session: ImportedPreviewSession | null) => void;
  className?: string;
}) {
  const adapter = useMemo(() => resolveImportPreviewAdapter(records.profile, files), [records.profile, files]);
  const runsStaticHtml = adapter.status === 'available' && adapter.adapter === STATIC_HTML_PREVIEW_ADAPTER;
  const usesIsolatedWorker = adapter.adapter === ISOLATED_SOURCE_PREVIEW_ADAPTER;
  const pages = useMemo(() => (runsStaticHtml ? listStaticHtmlPages(files) : []), [files, runsStaticHtml]);
  const [page, setPage] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [assetsReady, setAssetsReady] = useState(false);
  const [session, setSession] = useState<ImportedPreviewSession | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const activePage = page && pages.includes(page) ? page : pages[0] ?? null;
  const availableForAssetPreview = runsStaticHtml || usesIsolatedWorker;

  useEffect(() => onSessionChange?.(session), [onSessionChange, session]);

  useEffect(() => () => {
    if (session) void stopImportedPreviewSession(session.id).catch(() => undefined);
  }, [session]);

  // Stored images/fonts are private; issue short-lived links for this session only.
  useEffect(() => {
    if (!availableForAssetPreview) return;
    const stored = records.assets.assets.filter((a) => a.status === 'stored' && a.storagePath);
    if (stored.length === 0) { setAssetUrls({}); setAssetsReady(true); return; }
    let cancelled = false;
    setAssetsReady(false);
    const byBucket = new Map<string, typeof stored>();
    for (const asset of stored) byBucket.set(asset.bucket, [...(byBucket.get(asset.bucket) ?? []), asset]);
    Promise.all([...byBucket.entries()].map(async ([bucket, list]) => {
      const { data } = await supabase.storage.from(bucket).createSignedUrls(list.map((a) => a.storagePath as string), SIGNED_URL_SECONDS);
      return list.map((asset, i) => [toVfsPath(asset.path), data?.[i]?.signedUrl ?? ''] as const);
    }))
      .then((pairs) => {
        if (cancelled) return;
        setAssetUrls(Object.fromEntries(pairs.flat().filter(([, url]) => url)));
      })
      .catch(() => { if (!cancelled) setAssetUrls({}); })
      .finally(() => { if (!cancelled) setAssetsReady(true); });
    return () => { cancelled = true; };
  }, [availableForAssetPreview, records.assets]);

  const startIsolatedPreview = async () => {
    if (starting || session) return;
    setStarting(true);
    setStartError(null);
    try {
      if (!projectId) throw new Error('The imported project is missing its project identity.');
      const next = await startImportedPreviewSession({
        projectId,
        records,
        files,
        assetUrls,
      });
      setSession(next);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'Unable to start the imported preview.');
    } finally {
      setStarting(false);
    }
  };

  const served = useMemo(() => {
    if (!runsStaticHtml || !activePage || !assetsReady) return null;
    try {
      return buildStaticHtmlPreviewDocument({ files, entryPath: activePage, assetUrls });
    } catch {
      return null;
    }
  }, [activePage, assetUrls, assetsReady, files, runsStaticHtml]);

  useEffect(() => {
    if (!runsStaticHtml) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: string; path?: string } | null;
      if (data?.type !== IMPORT_NAV_MESSAGE || typeof data.path !== 'string' || !pages.includes(data.path)) return;
      setPage(data.path);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [pages, runsStaticHtml]);

  if (session) {
    return (
      <div
        data-unison-imported-source-preview="running"
        data-import-framework={records.profile.framework}
        className={cn('relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background', className)}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="truncate text-xs font-medium text-foreground">Isolated {records.profile.framework} preview</span>
          <span className="text-xs text-muted-foreground">{session.status === 'running' ? 'Running' : 'Starting'}</span>
          <Button type="button" variant="ghost" size="sm" className="ml-auto h-8 gap-1.5 text-xs" onClick={() => window.open(session.iframeUrl, '_blank', 'noopener,noreferrer')}>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Open
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Stop isolated preview" onClick={() => setSession(null)}>
            <Square className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
        <div className="relative min-h-0 flex-1">
          <iframe
            title="Isolated imported project preview"
            className="h-full w-full border-0 bg-white"
            src={session.iframeUrl}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            referrerPolicy="no-referrer"
          />
        </div>
        <details className="border-t border-border">
          <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground">Import details</summary>
          <ImportedSourcePreviewStatus records={records} adapter={adapter} running className="h-auto overflow-visible rounded-none border-0" />
        </details>
      </div>
    );
  }

  if (!runsStaticHtml || pages.length === 0) {
    return (
      <ImportedSourcePreviewStatus
        records={records}
        adapter={adapter}
        starting={starting}
        preparingAssets={usesIsolatedWorker && !assetsReady}
        error={startError}
        onStart={usesIsolatedWorker ? startIsolatedPreview : undefined}
        className={className}
      />
    );
  }

  const missing = served?.diagnostics.length ?? 0;
  return (
    <div
      data-unison-imported-source-preview="running"
      data-import-framework={records.profile.framework}
      className={cn('relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background', className)}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        {pages.length > 1 ? (
          <Select value={activePage ?? undefined} onValueChange={setPage}>
            <SelectTrigger className="h-8 w-56 text-xs" aria-label="Page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pages.map((p) => <SelectItem key={p} value={p} className="text-xs">{p.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs font-medium text-foreground">{activePage?.slice(1)}</span>
        )}
        <span className="truncate text-xs text-muted-foreground">
          Original files, unchanged{missing > 0 ? ` · ${missing} file link${missing === 1 ? '' : 's'} could not be found` : ''}
        </span>
        <Button variant="ghost" size="sm" className="ml-auto h-8 gap-1.5 text-xs" onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails}>
          {showDetails ? <X className="h-3.5 w-3.5" aria-hidden /> : <Info className="h-3.5 w-3.5" aria-hidden />}
          {showDetails ? 'Close' : 'Import details'}
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
        {served ? (
          <iframe
            key={activePage ?? ''}
            ref={frameRef}
            title="Imported site preview"
            data-import-page={activePage ?? ''}
            className="h-full w-full border-0 bg-background"
            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            srcDoc={served.html}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading the original files…</div>
        )}
        {showDetails && (
          <div className="absolute inset-0 overflow-auto bg-background">
            {served && served.diagnostics.length > 0 && (
              <div className="mx-auto w-full max-w-xl px-6 pt-6">
                <p className="mb-2 text-xs font-medium text-foreground">Things the original page asks for that this preview could not supply</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {served.diagnostics.slice(0, 20).map((d, i) => (
                    <li key={`${d.from}:${d.ref}:${i}`}>
                      {d.from.slice(1)}: {d.reason === 'missing-file' ? `missing file "${d.ref}"` : d.reason === 'module-imports' ? 'script modules that load other local files' : d.reason === 'local-fetch' ? `loads "${d.ref}" while running` : 'a base address for links'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ImportedSourcePreviewStatus records={records} adapter={adapter} running className="h-auto overflow-visible rounded-none border-0" />
          </div>
        )}
      </div>
    </div>
  );
}
