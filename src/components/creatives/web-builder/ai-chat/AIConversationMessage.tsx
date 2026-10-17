/**
 * AIConversationMessage — Modern chat message bubble
 * Inspired by modern conversational UI patterns.
 */

import React, { useState } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  Eye,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Brain,
  FileCode,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { VFSEdit, IframeError, ThinkingStep, MessageMeta, Message as ConversationMessage } from '../AIBuilderPanel';
export type { ConversationMessage };

interface Props {
  message: ConversationMessage;
  onViewEdits?: (edits: VFSEdit[]) => void;
  onRetryError?: (error: IframeError) => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ── Thinking Pipeline (collapsible) ─────────────────────────────
const ThinkingPipeline: React.FC<{ steps: ThinkingStep[] }> = ({ steps }) => {
  const [expanded, setExpanded] = useState(false);
  if (!steps.length) return null;

  const lastStep = steps[steps.length - 1];
  const lastError = [...steps].reverse().find((step) => step.type === 'error');
  const hasError = Boolean(lastError);
  const isComplete = !hasError && lastStep.type === 'complete';
  const doneCount = steps.filter((step) => step.type === 'complete').length;
  const activeCount = hasError || isComplete ? 0 : 1;
  const stepIcons: Record<string, React.ReactNode> = {
    analyzing: <Sparkles className="w-3 h-3 text-muted-foreground" />,
    planning: <FileCode className="w-3 h-3 text-muted-foreground" />,
    generating: <Loader2 className={cn('w-3 h-3 text-muted-foreground', activeCount > 0 && 'animate-spin')} />,
    validating: <CheckCircle2 className="w-3 h-3 text-muted-foreground" />,
    complete: <CheckCircle2 className="w-3 h-3 text-emerald-500" />,
    error: <XCircle className="w-3 h-3 text-destructive" />,
    reasoning: <Brain className="w-3 h-3 text-muted-foreground" />,
  };

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span className="flex items-center gap-1.5">
          {hasError ? (
            <XCircle className="w-3 h-3 text-destructive" />
          ) : isComplete ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          ) : (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          )}
          <span className="font-medium text-foreground/90">
            {hasError ? 'Thinking interrupted' : isComplete ? 'Thinking complete' : 'Thinking...'}
          </span>
        </span>

        <span className="ml-auto min-w-0 truncate text-[10px] text-muted-foreground">
          {hasError || isComplete ? `${steps.length} steps` : lastStep.content}
        </span>
      </button>

      {expanded && (
        <div className="pb-2 pl-1">
          <div>
            <div className="space-y-1.5 border-l border-border/70 pl-2.5">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="relative flex items-start gap-2.5 py-0.5 animate-in fade-in slide-in-from-top-1 duration-300"
                  style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
                >
                  <div className="absolute -left-[11px] top-[8px] h-1.5 w-1.5 rounded-full bg-border" />
                  <div className="mt-0.5 text-muted-foreground">{stepIcons[step.type] || <Sparkles className="w-3 h-3" />}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-foreground/85 leading-relaxed">{step.message}</p>
                    {step.details && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground font-mono truncate">{step.details}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {!isComplete && !hasError && (
              <p className="mt-2 text-[10px] text-muted-foreground">Current: {lastStep.message}</p>
            )}
            {hasError && (
              <p className="mt-2 text-[10px] text-destructive">Last issue: {lastError?.message}</p>
            )}
            {isComplete && (
              <p className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400">{lastStep.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Reasoning Block (collapsible) ─────────────────────────────
const ReasoningBlock: React.FC<{ reasoning: string }> = ({ reasoning }) => {
  const [show, setShow] = useState(false);
  const charCount = reasoning.length;
  return (
    <div className="mb-2 rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
      <button
        onClick={() => setShow(!show)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Brain className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-medium text-foreground/90">Reasoning</span>
        <span className="rounded-md border border-border/80 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {(charCount / 1000).toFixed(1)}k chars
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground/80">{show ? 'Hide' : 'Show'}</span>
      </button>
      {show && (
        <div className="px-3 pb-3">
          <pre className="max-h-52 overflow-y-auto rounded-lg border border-border/70 bg-background p-2.5 text-[11px] text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
            {reasoning}
          </pre>
        </div>
      )}
    </div>
  );
};

// ── File Edit List ─────────────────────────────────────────────
const FileEditList: React.FC<{ edits: VFSEdit[]; onViewEdits?: (e: VFSEdit[]) => void }> = ({ edits, onViewEdits }) => (
  <div className="mt-3 pt-3 border-t border-border/50">
    <Button
      size="sm"
      variant="outline"
      onClick={() => onViewEdits?.(edits)}
      className="gap-2 text-xs h-7"
    >
      <Eye className="w-3 h-3" />
      View {edits.length} file{edits.length > 1 ? 's' : ''} changed
      <ExternalLink className="w-3 h-3" />
    </Button>
    <div className="mt-2 space-y-0.5">
      {edits.map((edit, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            edit.type === 'create' && "bg-green-500",
            edit.type === 'modify' && "bg-primary",
            edit.type === 'delete' && "bg-destructive"
          )} />
          <span className="truncate">{edit.path}</span>
          {edit.linesChanged && (
            <span className="text-muted-foreground/40 ml-auto flex-shrink-0">+{edit.linesChanged}</span>
          )}
        </div>
      ))}
    </div>
  </div>
);

// ── Main Message Component ─────────────────────────────────────
export const AIConversationMessage: React.FC<Props> = ({ message, onViewEdits, onRetryError }) => {
  const [copied, setCopied] = useState(false);

  const compactMode =
    (message.meta?.actionType?.toLowerCase().includes('debug') ?? false) ||
    (message.meta?.actionType?.toLowerCase().includes('patch') ?? false) ||
    (message.edits?.length ?? 0) >= 6;

  const hasLongContent = (message.content?.length ?? 0) > 420;
  const showStickyStatus = hasLongContent && (Boolean(message.thinking?.length) || Boolean(message.taskPlan) || Boolean(message.claudeReasoning));

  const statusLabel = message.isStreaming
    ? 'Thinking...'
    : message.meta?.requiresApproval
      ? 'Review suggested'
      : (message.thinking?.some((s) => s.type === 'error') ?? false)
        ? 'Needs attention'
        : 'Ready';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── User message ──
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4 group">
        <div className="max-w-[85%] relative">
          <div className="rounded-2xl rounded-br-md border border-border/70 bg-muted px-4 py-2.5 text-foreground shadow-sm">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
          <span className="text-[10px] text-muted-foreground/50 mt-1 block text-right pr-1">
            {formatTime(message.timestamp)}
          </span>
        </div>
      </div>
    );
  }

  // ── System message ──
  if (message.role === 'system') {
    return (
      <div className="flex justify-center mb-3">
        <div className="bg-muted/50 rounded-full px-3 py-1 border border-border/50">
          <p className="text-[11px] text-muted-foreground">{message.content}</p>
        </div>
      </div>
    );
  }

  // ── Assistant message ──
  return (
    <div className={cn("flex gap-2.5 mb-4 group", compactMode && "mb-2") }>
      {/* Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-foreground/70" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className={cn("flex items-center gap-2 mb-1", compactMode && "mb-0.5")}>
          <span className="text-xs font-semibold text-foreground">Unison AI</span>
          {message.meta?.modelUsed && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-mono">
              {message.meta.modelUsed.split('/').pop()}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground/50 ml-auto">
            {formatTime(message.timestamp)}
          </span>
        </div>

        {/* AI Reasoning */}
        {message.claudeReasoning && <ReasoningBlock reasoning={message.claudeReasoning} />}

        {/* Task Plan */}

        {/* Thinking Pipeline */}
        {message.thinking && message.thinking.length > 0 && (
          <ThinkingPipeline steps={message.thinking} />
        )}

        {/* Streaming indicator */}
        {message.isStreaming && !message.content && (
          <div className="flex items-center gap-2 py-2">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-xs text-muted-foreground">Thinking...</span>
          </div>
        )}

        {/* Main content card */}
        {message.content && (
          <div className={cn(
            "relative bg-background border border-border/70 rounded-xl rounded-tl-md shadow-sm",
            compactMode ? "px-3 py-2" : "px-4 py-3",
          )}>
            {showStickyStatus && (
              <div className="sticky top-0 z-10 -mx-1 mb-2 rounded-md border border-border/70 bg-background/95 px-2 py-1 backdrop-blur supports-[backdrop-filter]:bg-background/75">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {message.isStreaming ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  )}
                  <span className="font-medium text-foreground/85">{statusLabel}</span>
                  {message.meta?.actionType && (
                    <span className="ml-auto rounded border border-border px-1.5 py-0.5">{message.meta.actionType}</span>
                  )}
                </div>
              </div>
            )}

            {/* Meta badges */}
            {message.meta && !message.isStreaming && (
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {message.meta.actionType && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {message.meta.actionType}
                  </Badge>
                )}
                {message.meta.requiresApproval && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 animate-pulse">
                    ⚠ Review recommended
                  </Badge>
                )}
                {message.meta.filesDetected && message.meta.filesDetected.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/60">
                    {message.meta.filesDetected.length} file{message.meta.filesDetected.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}

            {/* Warnings */}
            {message.meta?.warnings && message.meta.warnings.length > 0 && !message.isStreaming && (
              <div className="mb-2 space-y-1">
                {message.meta.warnings.slice(0, 3).map((w, i) => (
                  <div key={i} className={cn(
                    "flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-md",
                    w.severity === 'error' && "bg-destructive/10 text-destructive",
                    w.severity === 'warning' && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                    w.severity === 'info' && "bg-primary/5 text-muted-foreground",
                  )}>
                    <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Message text */}
            <p className={cn(
              "text-foreground/90 leading-relaxed whitespace-pre-wrap",
              compactMode ? "text-[13px]" : "text-sm",
            )}>
              {message.content}
            </p>

            {/* Copy button on hover */}
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
              title="Copy message"
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
            </button>

            {/* File edits */}
            {message.edits && message.edits.length > 0 && (
              <FileEditList edits={message.edits} onViewEdits={onViewEdits} />
            )}

            {/* Error retry */}
            {message.error && onRetryError && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="flex items-start gap-2 p-2.5 bg-destructive/5 rounded-lg border border-destructive/20">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-destructive">{message.error.type} error</p>
                    <p className="text-[11px] text-destructive/70 truncate">{message.error.message}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRetryError(message.error!)}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
