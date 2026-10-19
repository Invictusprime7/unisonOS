/**
 * AIConversationMessage — Modern chat message bubble
 * Inspired by modern conversational UI patterns.
 */

import React, { useState } from 'react';
import {
  Sparkles,
  Eye,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { VFSEdit, IframeError, Message as ConversationMessage } from '../AIBuilderPanel';
import { affinityReplyParagraphs } from './affinityReply';
export type { ConversationMessage };

interface Props {
  message: ConversationMessage;
  onViewEdits?: (edits: VFSEdit[]) => void;
  onRetryError?: (error: IframeError) => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

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

  const lastError = [...(message.thinking ?? [])].reverse().find(step => step.type === 'error');
  const currentStep = message.thinking?.[message.thinking.length - 1];
  const paragraphs = affinityReplyParagraphs(message.content ?? '');

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
          <span className="text-xs font-semibold text-foreground">Affinity</span>
          {message.meta?.modelUsed && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-mono">
              {message.meta.modelUsed.split('/').pop()}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground/50 ml-auto">
            {formatTime(message.timestamp)}
          </span>
        </div>

        {lastError && (
          <p role="alert" className="builder-reply-status text-destructive">Last issue: {lastError.message}</p>
        )}
        {message.isStreaming && (
          <p role="status" className="builder-reply-status text-muted-foreground">
            {currentStep?.message || 'Preparing your reply…'}
          </p>
        )}

        {(message.content || message.edits?.length || message.meta?.outOfScope) && (
          <div className="builder-reply">
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

            {message.meta?.outOfScope && !message.isStreaming && (
              <div className="builder-reply-status text-muted-foreground">
                <p>Outside Affinity's current scope</p>
                {!message.content.includes(message.meta.outOfScope.reason) && (
                  <p>{message.meta.outOfScope.reason}</p>
                )}
                {message.meta.outOfScope.suggestedPatch && (
                  <p>To unlock this: {message.meta.outOfScope.suggestedPatch}</p>
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

            <div className="builder-reply-paragraphs">
              {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
            {message.content && (
              <Button variant="ghost" size="icon" onClick={handleCopy} aria-label="Copy message" title="Copy message">
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              </Button>
            )}

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
                    onClick={() => { if (message.error) onRetryError(message.error); }}
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
