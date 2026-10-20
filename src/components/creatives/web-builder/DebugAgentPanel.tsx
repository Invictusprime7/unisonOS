/**
 * DebugAgentPanel — Auto-fix + conversational debug UI
 * Shows detected errors with one-click auto-fix, plus a chat for manual debugging.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bug, Bot, Send, Loader2, CheckCircle2, XCircle,
  AlertTriangle, ChevronDown, ChevronRight, FileCode, Terminal,
  Play, RotateCcw, Eye, Check, X, Sparkles, Zap,
  Search, FolderOpen, Activity, Wrench, ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { debugAgentService, type DebugSession, type AgentStep } from '@/services/debugAgentService';
import { diagnosticsAggregator } from '@/services/diagnosticsAggregator';
import { workspacePatchEngine, type PatchSet } from '@/services/workspacePatchEngine';
import { terminalOrchestrator, type CommandSpec } from '@/services/terminalOrchestrator';
import { toast } from 'sonner';
import {
  applyAIBuilderFiles,
  type AIBuilderApplyCallback,
  type AIBuilderApplyMeta,
} from '@/services/aiBuilderApply';

export interface DebugAgentPanelProps {
  iframeErrors: Array<{ type: string; message: string; stack?: string; file?: string; line?: number; column?: number; timestamp: Date }>;
  onFixError?: (error: any) => void;
  /** Send a manual debug request through the authenticated Builder/Supabase lane. */
  onDebugRequest?: (prompt: string) => void;
  onClearErrors?: () => void;
  onApplyPatch?: AIBuilderApplyCallback;
  canAutoApplyPatch?: boolean;
  onReviewPatch?: (files: Record<string, string>, meta: AIBuilderApplyMeta) => void;
  vfsFiles?: Record<string, string> | null;
  isFixing?: boolean;
}

// ── Detected Error Card ────────────────────────────────────────────────────────

const ErrorCard: React.FC<{
  error: DebugAgentPanelProps['iframeErrors'][0];
  onFix: () => void;
  isFixing: boolean;
  fixingThis: boolean;
}> = ({ error, onFix, isFixing, fixingThis }) => {
  const [expanded, setExpanded] = useState(false);
  const severityColor = error.type === 'runtime' || error.type === 'syntax'
    ? 'text-destructive border-destructive/30 bg-destructive/5'
    : 'text-amber-500 border-amber-500/30 bg-amber-500/5';

  return (
    <div className={cn('rounded-lg border p-3 transition-all', severityColor)}>
      <div className="flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-mono border-current/30">
              {error.type}
            </Badge>
            {error.file && (
              <span className="text-[10px] font-mono opacity-60 truncate">
                {error.file}{error.line ? `:${error.line}` : ''}
              </span>
            )}
          </div>
          <p className="text-xs leading-snug opacity-90 line-clamp-2">{error.message}</p>
          {error.stack && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] opacity-50 hover:opacity-80 mt-1 flex items-center gap-0.5 transition-opacity"
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Stack trace
            </button>
          )}
          {expanded && error.stack && (
            <pre className="mt-1.5 text-[9px] font-mono opacity-40 whitespace-pre-wrap max-h-24 overflow-y-auto bg-black/20 rounded p-1.5">
              {error.stack}
            </pre>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onFix}
          disabled={isFixing}
          className={cn(
            'h-7 px-2.5 gap-1 text-[10px] font-semibold shrink-0 transition-all',
            fixingThis
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-primary/10 hover:text-primary'
          )}
        >
          {fixingThis ? (
            <><Loader2 className="w-3 h-3 animate-spin" /> Fixing...</>
          ) : (
            <><Wrench className="w-3 h-3" /> Fix</>
          )}
        </Button>
      </div>
    </div>
  );
};

// ── Auto-Fix All Banner ────────────────────────────────────────────────────────

const AutoFixBanner: React.FC<{
  errorCount: number;
  onFixAll: () => void;
  onClear: () => void;
  isFixing: boolean;
}> = ({ errorCount, onFixAll, onClear, isFixing }) => (
  <div className="flex items-center gap-2 px-3 py-2 bg-destructive/5 border-b border-destructive/20">
    <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
    <span className="text-xs text-destructive font-medium flex-1">
      {errorCount} error{errorCount !== 1 ? 's' : ''} detected
    </span>
    <Button
      size="sm"
      onClick={onFixAll}
      disabled={isFixing}
      className="h-6 px-2.5 gap-1 text-[10px] bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
    >
      {isFixing ? (
        <><Loader2 className="w-3 h-3 animate-spin" /> Fixing...</>
      ) : (
        <><Zap className="w-3 h-3" /> Auto-Fix All</>
      )}
    </Button>
    <Button
      size="sm"
      variant="ghost"
      onClick={onClear}
      disabled={isFixing}
      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
      title="Dismiss errors"
    >
      <X className="w-3 h-3" />
    </Button>
  </div>
);

// ── Step renderer ──────────────────────────────────────────────────────────────

const StepBubble: React.FC<{ step: AgentStep; isLast: boolean }> = ({ step, isLast }) => {
  const [expanded, setExpanded] = useState(false);
  const iconMap: Record<string, React.ReactNode> = {
    'context-gather': <FolderOpen className="w-3 h-3 text-primary/70" />,
    'diagnose': <Search className="w-3 h-3 text-amber-500" />,
    'plan': <Activity className="w-3 h-3 text-primary" />,
    'propose-edits': <FileCode className="w-3 h-3 text-green-500" />,
    'propose-command': <Terminal className="w-3 h-3 text-violet-500" />,
    'await-approval': <AlertTriangle className="w-3 h-3 text-amber-500 animate-pulse" />,
    'apply-edits': <Check className="w-3 h-3 text-green-500" />,
    'run-command': <Play className="w-3 h-3 text-primary" />,
    'verify': <Eye className="w-3 h-3 text-primary/70" />,
    'complete': <CheckCircle2 className="w-3 h-3 text-green-500" />,
    'blocked': <XCircle className="w-3 h-3 text-destructive" />,
    'error': <XCircle className="w-3 h-3 text-destructive" />,
  };

  return (
    <div className="flex items-start gap-2 group">
      <div className="flex flex-col items-center">
        <div className="w-6 h-6 rounded-full bg-muted/50 border border-border flex items-center justify-center shrink-0">
          {iconMap[step.type] || <Zap className="w-3 h-3" />}
        </div>
        {!isLast && <div className="w-px h-full min-h-[8px] bg-border/50" />}
      </div>
      <div className="flex-1 min-w-0 pb-3">
        <div
          className={cn(
            'px-3 py-2 rounded-lg bg-card border border-border/60',
            step.type === 'error' && 'border-destructive/20 bg-destructive/5',
            step.type === 'complete' && 'border-green-500/20 bg-green-500/5',
          )}
        >
          <button
            onClick={() => step.details && setExpanded(!expanded)}
            className="flex items-center gap-1.5 w-full text-left"
          >
            <span className="text-[11px] text-foreground/70 font-mono leading-snug flex-1">{step.message}</span>
            {step.details && (
              expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
            )}
          </button>
          {expanded && step.details && (
            <pre className="mt-2 px-2 py-1.5 bg-muted/50 border border-border/50 rounded text-[9px] text-muted-foreground font-mono overflow-x-auto max-h-32 whitespace-pre-wrap">
              {step.details}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Inline patch review ────────────────────────────────────────────────────────

const InlinePatchReview: React.FC<{
  patchSet: PatchSet;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onAcceptPatch: (patchId: string) => void;
  onRejectPatch: (patchId: string) => void;
  onApply: () => void;
}> = ({ patchSet, onAcceptAll, onRejectAll, onAcceptPatch, onRejectPatch, onApply }) => {
  const [expandedPatch, setExpandedPatch] = useState<string | null>(null);
  const hasAccepted = patchSet.patches.some(p => p.status === 'accepted');

  return (
    <div className="space-y-1.5 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-mono">
          {patchSet.patches.length} file{patchSet.patches.length !== 1 ? 's' : ''} changed
        </span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onAcceptAll} className="h-5 text-[9px] text-green-500 hover:bg-green-500/10 px-1.5">
            <Check className="w-3 h-3 mr-0.5" /> Accept
          </Button>
          <Button size="sm" variant="ghost" onClick={onRejectAll} className="h-5 text-[9px] text-destructive hover:bg-destructive/10 px-1.5">
            <X className="w-3 h-3 mr-0.5" /> Reject
          </Button>
        </div>
      </div>
      {patchSet.patches.map(patch => (
        <div key={patch.id} className={cn(
          'border rounded overflow-hidden',
          patch.status === 'accepted' && 'border-green-500/30 bg-green-500/5',
          patch.status === 'rejected' && 'border-destructive/30 bg-destructive/5 opacity-50',
          patch.status === 'pending' && 'border-border bg-muted/30',
          patch.status === 'applied' && 'border-primary/30 bg-primary/5',
        )}>
          <button
            className="w-full flex items-center gap-2 px-2 py-1 text-left"
            onClick={() => setExpandedPatch(expandedPatch === patch.id ? null : patch.id)}
          >
            <Badge variant="outline" className={cn(
              'text-[8px] h-3.5',
              patch.operation === 'create' && 'border-green-500/30 text-green-500',
              patch.operation === 'update' && 'border-primary/30 text-primary',
              patch.operation === 'delete' && 'border-destructive/30 text-destructive',
            )}>
              {patch.operation}
            </Badge>
            <span className="text-[10px] text-foreground/70 font-mono truncate flex-1">{patch.path}</span>
            <span className="text-[8px] text-green-500/60">+{patch.linesAdded}</span>
            <span className="text-[8px] text-destructive/60">-{patch.linesRemoved}</span>
            {patch.status === 'pending' && (
              <div className="flex gap-0.5">
                <button onClick={(e) => { e.stopPropagation(); onAcceptPatch(patch.id); }}
                  className="w-4 h-4 rounded flex items-center justify-center hover:bg-green-500/20 text-green-500">
                  <Check className="w-2.5 h-2.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onRejectPatch(patch.id); }}
                  className="w-4 h-4 rounded flex items-center justify-center hover:bg-destructive/20 text-destructive">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </button>
          {expandedPatch === patch.id && patch.diff && (
            <pre className="px-2 py-1 bg-muted/50 text-[9px] font-mono overflow-x-auto max-h-40 border-t border-border/50">
              {patch.diff.split('\n').map((line, i) => (
                <div key={i} className={cn(
                  line.startsWith('+') && !line.startsWith('+++') && 'text-green-500/80 bg-green-500/5',
                  line.startsWith('-') && !line.startsWith('---') && 'text-destructive/80 bg-destructive/5',
                  line.startsWith('@@') && 'text-primary/60',
                  !line.startsWith('+') && !line.startsWith('-') && !line.startsWith('@@') && 'text-muted-foreground',
                )}>
                  {line}
                </div>
              ))}
            </pre>
          )}
        </div>
      ))}
      {hasAccepted && (
        <Button size="sm" onClick={onApply} className="w-full gap-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[10px] h-7">
          <Play className="w-3 h-3" /> Apply Changes
        </Button>
      )}
    </div>
  );
};

// ── Command approval inline ────────────────────────────────────────────────────

const InlineCommandApproval: React.FC<{
  commands: CommandSpec[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}> = ({ commands, onApprove, onReject }) => {
  if (commands.length === 0) return null;
  return (
    <div className="px-3 py-2 space-y-1.5">
      {commands.map(cmd => (
        <div key={cmd.id} className="flex items-center gap-2 p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <Terminal className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <code className="text-[10px] text-foreground font-mono">{cmd.command} {cmd.args.join(' ')}</code>
            <p className="text-[8px] text-muted-foreground mt-0.5">{cmd.rationale}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => onApprove(cmd.id)} className="w-5 h-5 rounded flex items-center justify-center bg-green-500/20 hover:bg-green-500/30 text-green-500">
              <Check className="w-3 h-3" />
            </button>
            <button onClick={() => onReject(cmd.id)} className="w-5 h-5 rounded flex items-center justify-center bg-destructive/20 hover:bg-destructive/30 text-destructive">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

export const DebugAgentPanel: React.FC<DebugAgentPanelProps> = ({
  iframeErrors, onFixError, onDebugRequest, onClearErrors, onApplyPatch, canAutoApplyPatch = true, onReviewPatch, vfsFiles, isFixing,
}) => {
  const [input, setInput] = useState('');
  const [session, setSession] = useState<DebugSession | null>(null);
  const [patchSets, setPatchSets] = useState<PatchSet[]>([]);
  const [pendingCommands, setPendingCommands] = useState<CommandSpec[]>([]);
  const [fixingErrorIdx, setFixingErrorIdx] = useState<number | null>(null);
  const [fixAllInProgress, setFixAllInProgress] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubs = [
      debugAgentService.subscribe(setSession),
      workspacePatchEngine.subscribe(setPatchSets),
      terminalOrchestrator.subscribe((history) => {
        setPendingCommands(history.filter(c => c.status === 'pending'));
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  useEffect(() => {
    if (iframeErrors.length > 0) diagnosticsAggregator.ingestIframeErrors(iframeErrors);
  }, [iframeErrors]);

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [session?.steps.length, pendingCommands.length, patchSets.length]);

  const handleFixSingle = useCallback((error: typeof iframeErrors[0], idx: number) => {
    if (!onFixError || isFixing) return;
    setFixingErrorIdx(idx);
    onFixError(error);
  }, [onFixError, isFixing]);

  const handleFixAll = useCallback(() => {
    if (!onFixError || isFixing || iframeErrors.length === 0) return;
    setFixAllInProgress(true);
    // Fix the first error — the AI will detect related errors from diagnostics context
    onFixError(iframeErrors[0]);
  }, [onFixError, isFixing, iframeErrors]);

  // Reset fixing state when isFixing goes false
  useEffect(() => {
    if (!isFixing) {
      setFixingErrorIdx(null);
      setFixAllInProgress(false);
    }
  }, [isFixing]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    // If there are errors, prepend them as context to the user's debug prompt
    if (iframeErrors.length > 0 && onFixError) {
      const errorContext = iframeErrors.map(e =>
        `${e.type}: ${e.message}${e.file ? ` (${e.file}:${e.line})` : ''}`
      ).join('\n');
      const enrichedError = {
        ...iframeErrors[0],
        message: `User debug request: "${input.trim()}"\n\nDetected errors:\n${errorContext}`,
      };
      onFixError(enrichedError);
      setInput('');
      return;
    }
    if (onDebugRequest) {
      onDebugRequest(input.trim());
      setInput('');
      return;
    }
    // Fallback: start a debug agent session
    const newSession = debugAgentService.startSession({
      task: input.trim(),
      goal: 'Analyze, debug, and fix the described issue',
      mode: 'debug-agent',
    });
    if (vfsFiles) {
      debugAgentService.gatherContext(newSession.id, vfsFiles, Object.keys(vfsFiles));
      debugAgentService.runSecurityReview(newSession.id, vfsFiles);
      debugAgentService.validateUnisonIntegrity(newSession.id, vfsFiles);
    }
    setInput('');
  }, [input, vfsFiles, iframeErrors, onDebugRequest, onFixError]);

  const handleApplyPatch = useCallback(async (patchSetId: string) => {
    const files = workspacePatchEngine.getAcceptedFiles(patchSetId);
    const meta: AIBuilderApplyMeta = { origin: 'debug-patch' };
    if (files && !canAutoApplyPatch) {
      onReviewPatch?.(files, meta);
      return;
    }
    if (files && onApplyPatch) {
      const outcome = await applyAIBuilderFiles(onApplyPatch, files, meta);
      if (outcome.success) {
        workspacePatchEngine.markApplied(patchSetId);
      } else {
        toast.error('Debug patch was not applied', {
          description: outcome.errors?.[0] ?? 'The VFS rejected the patch.',
          duration: 8000,
        });
      }
    }
  }, [canAutoApplyPatch, onApplyPatch, onReviewPatch]);

  const activePatchSet = useMemo(() => {
    if (session?.activePatchSetId) return workspacePatchEngine.getPatchSet(session.activePatchSetId);
    return patchSets[0];
  }, [session, patchSets]);

  const handleReset = useCallback(() => {
    if (session) debugAgentService.completeSession(session.id);
  }, [session]);

  const hasErrors = iframeErrors.length > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-destructive" />
          <span className="text-sm font-semibold text-foreground">Debug</span>
          {session && (
            <Badge variant="outline" className={cn(
              'text-[9px] h-4',
              session.status === 'running' && 'border-primary/30 text-primary',
              session.status === 'completed' && 'border-green-500/30 text-green-500',
              session.status === 'failed' && 'border-destructive/30 text-destructive',
            )}>
              {session.status}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasErrors && (
            <Badge variant="destructive" className="text-[9px] h-4 px-1.5">
              {iframeErrors.length}
            </Badge>
          )}
          {session && (
            <button onClick={handleReset} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Auto-fix banner when errors exist */}
      {hasErrors && (
        <AutoFixBanner
          errorCount={iframeErrors.length}
          onFixAll={handleFixAll}
          onClear={() => onClearErrors?.()}
          isFixing={!!isFixing}
        />
      )}

      {/* Main scroll area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-3 space-y-2">
          {/* Error cards */}
          {hasErrors && (
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
                <span className="text-[11px] font-semibold text-foreground">Detected Issues</span>
              </div>
              {iframeErrors.map((error, i) => (
                <ErrorCard
                  key={`${error.type}-${error.message.slice(0, 40)}-${i}`}
                  error={error}
                  onFix={() => handleFixSingle(error, i)}
                  isFixing={!!isFixing}
                  fixingThis={fixAllInProgress || fixingErrorIdx === i}
                />
              ))}
            </div>
          )}

          {/* Empty state — no errors, no session */}
          {!hasErrors && !session && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <p className="text-sm font-medium text-foreground/80 mb-1">No errors detected</p>
              <p className="text-[11px] text-muted-foreground max-w-[240px]">
                Your preview is running clean. Use the input below to describe any issues or request a debug analysis.
              </p>
            </div>
          )}

          {/* Session task bubble */}
          {session && (
            <div className="flex justify-end mb-3">
              <div className="px-3 py-2 rounded-xl rounded-br-md bg-primary text-primary-foreground max-w-[85%] shadow-sm">
                <p className="text-xs leading-snug">{session.task}</p>
              </div>
            </div>
          )}

          {/* Agent steps */}
          {session?.steps.map((step, i) => (
            <StepBubble key={step.id} step={step} isLast={i === session.steps.length - 1 && !activePatchSet && pendingCommands.length === 0} />
          ))}

          {/* Command approvals */}
          {pendingCommands.length > 0 && (
            <InlineCommandApproval
              commands={pendingCommands}
              onApprove={(id) => terminalOrchestrator.approve(id)}
              onReject={(id) => terminalOrchestrator.reject(id)}
            />
          )}

          {/* Patch review */}
          {activePatchSet && activePatchSet.status !== 'applied' && (
            <InlinePatchReview
              patchSet={activePatchSet}
              onAcceptAll={() => workspacePatchEngine.acceptAll(activePatchSet.id)}
              onRejectAll={() => {
                for (const p of activePatchSet.patches) {
                  if (p.status === 'pending') workspacePatchEngine.rejectPatch(activePatchSet.id, p.id);
                }
              }}
              onAcceptPatch={(patchId) => workspacePatchEngine.acceptPatch(activePatchSet.id, patchId)}
              onRejectPatch={(patchId) => workspacePatchEngine.rejectPatch(activePatchSet.id, patchId)}
              onApply={() => handleApplyPatch(activePatchSet.id)}
            />
          )}
        </div>
      </ScrollArea>

      {/* Input bar */}
      <div className="shrink-0 border-t border-border px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={hasErrors ? 'Describe the issue or let AI auto-fix...' : 'Describe a bug to debug...'}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
            disabled={isFixing}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || !!isFixing}
            className="h-7 w-7 p-0 shrink-0"
          >
            {isFixing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DebugAgentPanel;
