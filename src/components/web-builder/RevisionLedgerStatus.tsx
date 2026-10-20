/**
 * RevisionLedgerStatus — Move D/F surface
 *
 * Reads the most recent `site_revisions` row for the active project and
 * shows publish-readiness, blocker count, VFS drift versus the hydrated
 * in-memory VFS, plus a short revision history with a one-click Restore
 * action that funnels through `restoreRevision()` (so the restore goes
 * through gates + readiness + persistence like any other commit).
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, History, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { evaluateDrift, type DriftReport } from '@/services/vfsDriftWatcher';
import {
  listRecentRevisionsForProject,
  restoreRevision,
  type LoadedRevision,
} from '@/services/vfsCommitService';
import type { BuilderIdentity } from '@/types/builderIdentity';
import { toast } from 'sonner';

interface RevisionLedgerStatusProps {
  projectId: string | null;
  vfsFiles: Record<string, string>;
  /** When provided, enables the Restore action against historical revisions. */
  identity?: BuilderIdentity | null;
  /** Notified after a successful restore so the host can rehydrate the builder. */
  onRestored?: (revisionId: string) => void;
  /**
  * When explicitly enabled, drift detection auto-fires a `system-restore` commit
   * from the latest ledger row. Requires `identity` to be set.
   */
  autoResyncOnDrift?: boolean;
  className?: string;
}

export default function RevisionLedgerStatus({
  projectId,
  vfsFiles,
  identity,
  onRestored,
  autoResyncOnDrift = false,
  className,
}: RevisionLedgerStatusProps) {
  const [report, setReport] = useState<DriftReport | null>(null);
  const [history, setHistory] = useState<LoadedRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [r, h] = await Promise.all([
        evaluateDrift({ projectId, vfsFiles }),
        listRecentRevisionsForProject(projectId, 8),
      ]);
      setReport(r);
      setHistory(h);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [projectId, vfsFiles]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ── Auto-resync on drift ────────────────────────────────────────────────
  // When the live VFS hash diverges from the latest ledger row, automatically
  // roll that revision forward as a fresh `system-restore` commit. Tracks the
  // last-resynced revision id to guarantee at-most-once per ledger row and
  // prevent thrash if the restored commit itself ends up drifted (e.g. preflight
  // mutates files).
  const autoResyncedRevisionIdRef = React.useRef<string | null>(null);
  const [autoResyncing, setAutoResyncing] = useState(false);

  useEffect(() => {
    if (!autoResyncOnDrift) return;
    if (!identity || !projectId) return;
    if (!report || report.reason !== 'drift') return;
    const rev = report.revision;
    if (!rev || rev.status !== 'committed') return;
    if (autoResyncedRevisionIdRef.current === rev.id) return;
    autoResyncedRevisionIdRef.current = rev.id;
    setAutoResyncing(true);
    void (async () => {
      try {
        const result = await restoreRevision({
          targetRevisionId: rev.id,
          identity,
        });
        if (result.status === 'committed' && result.persistedRevisionId) {
          toast.success(`Auto-resynced VFS to revision ${rev.id.slice(0, 8)}`);
          onRestored?.(result.persistedRevisionId);
          await refresh();
        } else {
          toast.warning(
            `Auto-resync blocked (${result.publishBlockers?.length ?? 0} blocker${(result.publishBlockers?.length ?? 0) === 1 ? '' : 's'})`,
          );
        }
      } catch (err) {
        console.warn('[RevisionLedgerStatus] auto-resync failed:', err);
      } finally {
        setAutoResyncing(false);
      }
    })();
  }, [autoResyncOnDrift, identity, projectId, report, onRestored, refresh]);


  const handleRestore = React.useCallback(
    async (rev: LoadedRevision) => {
      if (!identity) {
        toast.error('Restore unavailable — builder identity not ready.');
        return;
      }
      setRestoringId(rev.id);
      try {
        const result = await restoreRevision({
          targetRevisionId: rev.id,
          identity,
        });
        if (result.status === 'committed' && result.persistedRevisionId) {
          toast.success(`Restored revision ${rev.id.slice(0, 8)}`);
          onRestored?.(result.persistedRevisionId);
          await refresh();
        } else {
          toast.error(`Restore rejected (${result.publishBlockers?.length ?? 0} blockers)`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setRestoringId(null);
      }
    },
    [identity, onRestored, refresh],
  );

  if (!projectId) return null;

  const revision = report?.revision ?? null;
  const publishReady = revision?.publishReady === true;
  const blockerCount = revision?.publishBlockers.length ?? 0;
  const drift = report?.reason === 'drift';

  return (
    <Card className={cn('bg-slate-950/40 border-slate-800', className)}>
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-cyan-400" />
            Commit Ledger
          </CardTitle>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-slate-400 hover:text-slate-200"
            onClick={() => void refresh()}
            disabled={loading}
            title="Refresh ledger status"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3 space-y-2 text-[11px]">
        {error && <div className="text-red-400">{error}</div>}
        {!report && !error && !loading && (
          <div className="text-slate-500">No ledger data yet.</div>
        )}
        {report && !revision && (
          <div className="text-slate-500">No revisions persisted for this project.</div>
        )}
        {revision && (
          <>
            <Row
              label="Publish gate"
              value={
                publishReady ? (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px] h-4 px-1.5">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-1" />Ready
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 text-[10px] h-4 px-1.5">
                    <AlertTriangle className="h-2.5 w-2.5 mr-1" />Blocked ({blockerCount})
                  </Badge>
                )
              }
            />
            <Row label="Source" value={<span className="text-slate-300">{revision.source}</span>} />
            <Row
              label="VFS drift"
              value={
                drift ? (
                  <Badge variant="outline" className="border-red-500/40 text-red-300 bg-red-500/10 text-[10px] h-4 px-1.5">
                    <XCircle className="h-2.5 w-2.5 mr-1" />Drift
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-slate-600 text-slate-300 bg-slate-800/40 text-[10px] h-4 px-1.5">
                    In sync
                  </Badge>
                )
              }
            />
            {!publishReady && revision.publishBlockers.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-slate-800 pt-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Top blockers</div>
                {revision.publishBlockers.slice(0, 4).map((b, i) => (
                  <div key={i} className="text-[10px] text-slate-400 truncate" title={b.message}>
                    <span className="text-amber-400">{b.source}</span>: {b.message}
                  </div>
                ))}
                {revision.publishBlockers.length > 4 && (
                  <div className="text-[10px] text-slate-500">
                    + {revision.publishBlockers.length - 4} more
                  </div>
                )}
              </div>
            )}
            {drift && (
              <div className="mt-1 text-[10px] text-red-300/80 flex items-center gap-1.5">
                {autoResyncing ? (
                  <>
                    <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                    Auto-resyncing VFS to latest ledger row…
                  </>
                ) : autoResyncOnDrift && identity ? (
                  'Drift detected — auto-resync queued.'
                ) : (
                  'Live VFS hash differs from the latest ledger row. Re-commit through the AI Builder or layout fast-path to resync.'
                )}
              </div>
            )}
          </>
        )}

        {history.length > 1 && (
          <div className="mt-3 border-t border-slate-800 pt-2 space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Recent revisions</div>
              {!identity && (
                <span className="text-[9px] text-slate-600">restore unavailable</span>
              )}
            </div>
            {history.slice(0, 6).map((rev, idx) => {
              const isLatest = idx === 0;
              const isRestoring = restoringId === rev.id;
              return (
                <div
                  key={rev.id}
                  className="flex items-center justify-between gap-2 rounded border border-slate-800/60 bg-slate-900/30 px-1.5 py-1"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <code className="text-[10px] text-slate-300">{rev.id.slice(0, 8)}</code>
                      <span className="text-[10px] text-slate-500">{rev.source}</span>
                      {rev.publishReady && (
                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                      )}
                      {rev.status === 'rejected' && (
                        <XCircle className="h-2.5 w-2.5 text-red-400" />
                      )}
                    </div>
                    <div className="text-[9px] text-slate-500">
                      {new Date(rev.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-5 px-1.5 text-[10px] border-slate-700 text-slate-300 hover:bg-slate-800"
                    disabled={!identity || isLatest || isRestoring || rev.status !== 'committed'}
                    onClick={() => void handleRestore(rev)}
                    title={
                      isLatest
                        ? 'Already current'
                        : rev.status !== 'committed'
                          ? 'Only committed revisions can be restored'
                          : 'Restore as new revision'
                    }
                  >
                    <RotateCcw className={cn('h-2.5 w-2.5 mr-1', isRestoring && 'animate-spin')} />
                    {isLatest ? 'Current' : 'Restore'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}
