/**
 * MigrationProposalPanel — Pass C UI surface for the AI Builder
 * "propose → review → apply" loop.
 *
 * Lists AI-drafted backend changes (SQL migrations, edge-function edits,
 * config changes) scoped to the active project or business and lets the user
 * approve / reject them. Approved SQL migrations return the SQL body so it
 * can be handed to the platform migration flow (raw SQL execution from
 * edge functions is intentionally not allowed by the hosted runtime).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw, Check, X, Copy, ShieldAlert, Database, Cog, FileCode2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  listProposals,
  reviewProposal,
  type AIBuilderProposal,
  type ProposalStatus,
} from '@/services/aiBuilderProposals';

interface Props {
  projectId?: string;
  businessId?: string;
  className?: string;
}

const KIND_ICON: Record<AIBuilderProposal['kind'], React.ReactNode> = {
  sql_migration: <Database className="h-3.5 w-3.5" />,
  edge_function: <FileCode2 className="h-3.5 w-3.5" />,
  config_change: <Cog className="h-3.5 w-3.5" />,
};

const STATUS_TONE: Record<ProposalStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  approved: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  applied: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  rejected: 'bg-muted text-muted-foreground border-border',
  failed: 'bg-destructive/15 text-destructive border-destructive/30',
};

export const MigrationProposalPanel: React.FC<Props> = ({ projectId, businessId, className }) => {
  const [rows, setRows] = useState<AIBuilderProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listProposals({ projectId, businessId, limit: 50 });
      setRows(data);
    } catch (err) {
      toast.error('Failed to load proposals', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, businessId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleReview = useCallback(
    async (id: string, action: 'approve' | 'reject' | 'mark_applied') => {
      setBusyId(id);
      try {
        const updated = await reviewProposal(id, action);
        setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
        const migrationSql = (updated.apply_result as Record<string, unknown> | null)?.migration_sql;
        if (action === 'approve' && typeof migrationSql === 'string' && migrationSql.trim()) {
          try {
            await navigator.clipboard.writeText(migrationSql);
            toast.success('Approved — SQL copied to clipboard', {
              description: 'Paste it into the Supabase migration tool to apply.',
            });
          } catch {
            toast.success('Approved — copy the SQL from Apply Result below.');
          }
        } else {
          toast.success(`Proposal ${action.replace('_', ' ')}d.`);
        }
      } catch (err) {
        toast.error('Review failed', {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const pending = useMemo(() => rows.filter((r) => r.status === 'pending'), [rows]);
  const others = useMemo(() => rows.filter((r) => r.status !== 'pending'), [rows]);

  return (
    <div className={cn('flex h-full flex-col bg-background', className)}>
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Migration Proposals</h3>
          <p className="text-xs text-muted-foreground">
            AI-drafted backend changes waiting for your approval.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => void refresh()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </header>

      <ScrollArea className="flex-1">
        <div className="space-y-3 p-4">
          {rows.length === 0 && !loading && (
            <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
              No proposals yet. When the AI Builder drafts a schema, edge-function, or config change,
              it will appear here for your review.
            </div>
          )}

          {pending.length > 0 && (
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Awaiting review ({pending.length})
            </div>
          )}
          {pending.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              busy={busyId === p.id}
              onReview={handleReview}
            />
          ))}

          {others.length > 0 && (
            <div className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              History
            </div>
          )}
          {others.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              busy={busyId === p.id}
              onReview={handleReview}
              readOnly
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

interface CardProps {
  proposal: AIBuilderProposal;
  busy: boolean;
  onReview: (id: string, action: 'approve' | 'reject' | 'mark_applied') => void;
  readOnly?: boolean;
}

const ProposalCard: React.FC<CardProps> = ({ proposal, busy, onReview, readOnly }) => {
  const dry = (proposal.dry_run_report ?? {}) as {
    ok?: boolean;
    warnings?: string[];
    blockers?: string[];
    statementCount?: number;
    affectedSchemas?: string[];
  };
  const sql = String((proposal.payload as Record<string, unknown>)?.sql ?? '');
  const applyResult = (proposal.apply_result ?? {}) as Record<string, unknown>;
  const migrationSql = typeof applyResult.migration_sql === 'string' ? applyResult.migration_sql : '';

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                {KIND_ICON[proposal.kind]} {proposal.kind.replace('_', ' ')}
              </span>
              <span className="truncate">{proposal.title}</span>
            </CardTitle>
            {proposal.summary && (
              <p className="mt-1 text-xs text-muted-foreground">{proposal.summary}</p>
            )}
          </div>
          <Badge variant="outline" className={cn('text-[10px]', STATUS_TONE[proposal.status])}>
            {proposal.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 text-xs">
        {proposal.rationale && (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Why: </span>
            {proposal.rationale}
          </p>
        )}

        {(dry.blockers?.length ?? 0) > 0 && (
          <div className="rounded border border-destructive/30 bg-destructive/10 p-2">
            <div className="mb-1 flex items-center gap-1 font-medium text-destructive">
              <ShieldAlert className="h-3 w-3" /> Blockers
            </div>
            <ul className="ml-4 list-disc space-y-0.5">
              {dry.blockers!.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        )}
        {(dry.warnings?.length ?? 0) > 0 && (
          <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
            <div className="mb-1 font-medium">Warnings</div>
            <ul className="ml-4 list-disc space-y-0.5">
              {dry.warnings!.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {proposal.kind === 'sql_migration' && sql && (
          <details className="group rounded border bg-muted/40" open={!readOnly}>
            <summary className="cursor-pointer list-none px-2 py-1.5 text-[11px] font-medium text-muted-foreground group-open:border-b">
              SQL ({dry.statementCount ?? '?'} statements
              {dry.affectedSchemas?.length ? ` · schemas: ${dry.affectedSchemas.join(', ')}` : ''})
            </summary>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap p-2 font-mono text-[11px] leading-snug">
              {sql}
            </pre>
          </details>
        )}

        {migrationSql && proposal.status === 'approved' && (
          <div className="flex items-center gap-2 rounded border border-blue-500/30 bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
            <span className="flex-1">Approved. Run this SQL through the Supabase migration tool.</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard.writeText(migrationSql).then(
                  () => toast.success('SQL copied'),
                  () => toast.error('Copy failed'),
                );
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        )}

        {!readOnly && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="default"
              disabled={busy}
              onClick={() => onReview(proposal.id, 'approve')}
            >
              {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onReview(proposal.id, 'reject')}
            >
              <X className="mr-1 h-3 w-3" /> Reject
            </Button>
            {proposal.status !== 'applied' && proposal.kind === 'sql_migration' && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => onReview(proposal.id, 'mark_applied')}
              >
                Mark applied
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MigrationProposalPanel;
