/**
 * CheckpointsPopover — saved checkpoint list for the Web Builder top bar.
 * Every row is a committed revision; Restore commits a NEW revision through
 * restoreRevision, so nothing in history is ever lost.
 */
import { useCallback, useEffect, useState } from 'react';
import { History, RotateCcw, Sparkles, Undo2, Rocket, PencilLine, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { listCheckpoints, type Checkpoint } from '@/services/builder/checkpointService';

interface CheckpointsPopoverProps {
  draftId: string | null | undefined;
  currentRevisionId: string | null | undefined;
  /** Bumped by the host after every save so the list refreshes. */
  refreshKey?: string | number;
  onRestore: (checkpoint: Checkpoint) => Promise<void>;
  disabled?: boolean;
}

const PAGE = 30;
const KIND_ICON = { ai: Sparkles, restore: Undo2, launch: Rocket, manual: PencilLine, other: History } as const;

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function CheckpointsPopover({ draftId, currentRevisionId, refreshKey, onRestore, disabled }: CheckpointsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async () => {
    if (!draftId) return;
    setLoading(true);
    try {
      const page = await listCheckpoints(draftId, PAGE);
      setItems(page);
      setHasMore(page.length === PAGE);
    } finally { setLoading(false); }
  }, [draftId]);

  const loadOlder = useCallback(async () => {
    const last = items[items.length - 1];
    if (!draftId || !last) return;
    setLoading(true);
    try {
      const page = await listCheckpoints(draftId, PAGE, last.createdAt);
      setItems((prev) => [...prev, ...page.filter((p) => !prev.some((x) => x.id === p.id))]);
      setHasMore(page.length === PAGE);
    } finally { setLoading(false); }
  }, [draftId, items]);

  useEffect(() => { if (open) void load(); }, [open, load, refreshKey]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={disabled || !draftId} title="Saved checkpoints" aria-label="Saved checkpoints">
          <History className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Checkpoints</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div>
            <p className="text-sm font-medium text-foreground">Checkpoints</p>
            <p className="text-xs text-muted-foreground">Every change is saved. Restore any point.</p>
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <ScrollArea className="max-h-96">
          <ul className="divide-y divide-border">
            {items.length === 0 && !loading && (
              <li className="px-3 py-4 text-xs text-muted-foreground">No saved checkpoints yet.</li>
            )}
            {items.map((item, index) => {
              const Icon = KIND_ICON[item.kind];
              const isCurrent = currentRevisionId ? item.id === currentRevisionId : index === 0;
              return (
                <li key={item.id} className={cn('flex items-start gap-2 px-3 py-2', isCurrent && 'bg-muted/50')}>
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-foreground" title={item.label}>{item.label}</p>
                    {item.changes.length > 0 && (
                      <ul className="mt-0.5 space-y-0.5 text-[11px] text-muted-foreground" aria-label="Saved changes">
                        {item.changes.slice(0, 6).map((line) => (
                          <li key={line} className="truncate" title={line}>{line}</li>
                        ))}
                        {item.changes.length > 6 && <li>+{item.changes.length - 6} more</li>}
                      </ul>
                    )}
                    <p className="text-[11px] text-muted-foreground">{timeAgo(item.createdAt)}{isCurrent ? ' · current' : ''}</p>
                  </div>
                  {!isCurrent && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[11px]"
                      disabled={restoringId !== null}
                      onClick={async () => {
                        setRestoringId(item.id);
                        try { await onRestore(item); await load(); } finally { setRestoringId(null); }
                      }}
                    >
                      <RotateCcw className={cn('mr-1 h-3 w-3', restoringId === item.id && 'animate-spin')} />
                      Restore
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {hasMore && (
            <div className="border-t border-border p-2">
              <Button variant="ghost" size="sm" className="w-full text-xs" disabled={loading} onClick={() => void loadOlder()}>
                Show older checkpoints
              </Button>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
