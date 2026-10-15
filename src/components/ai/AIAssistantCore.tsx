/**
 * AIAssistantCore - Reusable AI chat assistant component
 * 
 * This is the shared core logic for AI assistant functionality.
 * Can be used in:
 * - LauncherWizard and WebBuilder AI surfaces
 * - WebBuilder (as floating code assistant widget)
 * 
 * Provides:
 * - Chat interface with message history
 * - Quick action chips
 * - File drop support
 * - Code generation callbacks
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeAIFunction } from "@/integrations/supabase/ai-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Send,
  Loader2,
  Copy,
  Check,
  Trash2,
  Paperclip,
  X,
  Bot,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getChatWizardStep, type ChatWizardStep } from '@/services/launch/chatWizardStep';
import { FileDropZone, DroppedFile } from "@/components/creatives/web-builder/FileDropZone";
import { useAIFileAnalysis } from "@/hooks/useAIFileAnalysis";
import {
  buildConfirmedSiteBrief,
  describeAssistantFailure,
  isSiteDiscoveryResponse,
  hasSiteConfirmationRequest,
  isSiteConfirmation,
  stripSiteConfirmationMarker,
} from "./siteConfirmation";
import {
  readSiteDiscoveryMessages,
  writeSiteDiscoveryMessages,
} from "./siteDiscoveryPersistence";

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  hasCode?: boolean;
  code?: string;
  wizardStep?: ChatWizardStep;
}

export interface QuickAction {
  id: string;
  label: string;
  prompt: string;
  icon?: React.ReactNode;
}

export interface AIAssistantCoreProps {
  /** Custom class name for styling */
  className?: string;
  /** Placeholder text for input */
  placeholder?: string;
  /** Quick action chips to show */
  quickActions?: QuickAction[];
  /** Callback when code is generated */
  onCodeGenerated?: (code: string) => void;
  /** Callback when a message is sent (for custom handling) */
  onMessageSent?: (message: string) => Promise<string | null>;
  /** Return false to stop submission before adding it to the conversation */
  onBeforeSend?: (message: string) => boolean;
  /** Backend mode for a specialized assistant surface */
  aiMode?: string;
  /** Called instead of another AI turn after explicit site confirmation */
  onSiteConfirmed?: (siteBrief: string) => void;
  /** Manual fallback for continuing in a guided Wizard when AI misses the handoff. */
  onContinueToWizard?: (siteBrief: string) => void;
  /** Current context code for the AI */
  contextCode?: string;
  /** System type for context */
  systemType?: string;
  /** Business name for context */
  businessName?: string;
  /** Initial messages to display */
  initialMessages?: AIMessage[];
  /** Persist this conversation in local storage, scoped by the caller-provided key. */
  persistenceKey?: string;
  /** Whether to show file drop zone */
  showFileUpload?: boolean;
  /** Whether to allow clearing history */
  allowClearHistory?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
  /** Header content override */
  headerContent?: React.ReactNode;
  /** Hide the default header */
  hideHeader?: boolean;
  /** Presentation style for embedded surfaces */
  appearance?: "default" | "unison";
  /** Guided selections rendered as the next turn in this conversation. */
  conversationContent?: React.ReactNode;
  /** Selection turns provide their own controls while keeping history visible. */
  selectionActive?: boolean;
  /** Selection controls accompanying the current AI discovery question. */
  discoverySelections?: (turn: { step: ChatWizardStep; brief: string; pending: boolean }, answer: (value: string) => void) => React.ReactNode;
  onDiscoveryStarted?: () => void;
  /** Custom send handler - if provided, bypasses default AI logic */
  customSendHandler?: (message: string, files?: DroppedFile[]) => Promise<{ content: string; code?: string } | null>;
}

export const AIAssistantCore: React.FC<AIAssistantCoreProps> = ({
  className,
  placeholder = "Ask me anything about your project...",
  quickActions = [],
  onCodeGenerated,
  onMessageSent,
  onBeforeSend,
  aiMode,
  onSiteConfirmed,
  onContinueToWizard,
  contextCode,
  systemType,
  businessName,
  initialMessages = [],
  persistenceKey,
  showFileUpload = true,
  allowClearHistory = true,
  compact = false,
  headerContent,
  hideHeader = false,
  appearance = "default",
  conversationContent,
  selectionActive = false,
  discoverySelections,
  onDiscoveryStarted,
  customSendHandler,
}) => {
  const [messages, setMessages] = useState<AIMessage[]>(() => {
    if (!persistenceKey || typeof window === "undefined") return initialMessages;
    try {
      return readSiteDiscoveryMessages(persistenceKey) ?? initialMessages;
    } catch (error) {
      console.error("[AIAssistantCore] Could not restore site-discovery conversation.", error);
      return initialMessages;
    }
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<DroppedFile[]>([]);
  const [showFileZone, setShowFileZone] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { analyzing, analyzeAndGenerate } = useAIFileAnalysis();

  useEffect(() => {
    if (!persistenceKey || typeof window === "undefined") return;
    try {
      writeSiteDiscoveryMessages(persistenceKey, messages);
    } catch (error) {
      console.error("[AIAssistantCore] Could not persist site-discovery conversation.", error);
    }
  }, [messages, persistenceKey]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, conversationContent]);

  // File handlers
  const handleFilesDropped = useCallback((files: DroppedFile[]) => {
    setDroppedFiles(prev => [...prev, ...files]);
    setShowFileZone(false);
  }, []);

  const handleRemoveFile = useCallback((id: string) => {
    setDroppedFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // Copy code to clipboard
  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast({ title: "Copied to clipboard" });
  };

  // Clear conversation
  const handleClearHistory = () => {
    setMessages([]);
    toast({ title: "Conversation cleared" });
  };

  const handleContinueToWizard = () => {
    if (!onContinueToWizard || !messages.some((message) => message.role === "user")) return;
    onContinueToWizard(buildConfirmedSiteBrief(messages));
    setMessages((previous) => [
      ...previous,
      {
        role: "assistant",
        content: "Let's continue with the guided setup. Your conversation is included as context.",
        timestamp: new Date(),
      },
    ]);
  };

  // Send message
  const handleSend = async (selectionAnswer?: string) => {
    const trimmedInput = (selectionAnswer ?? input).trim();
    if (!trimmedInput && droppedFiles.length === 0) return;
    if (isLoading) return;
    if (onBeforeSend && !onBeforeSend(trimmedInput)) return;

    const userMessage: AIMessage = {
      role: "user",
      content: trimmedInput || "Analyze these files",
      timestamp: new Date(),
    };

    const previousAssistantMessage = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");
    if (
      onSiteConfirmed
      && !discoverySelections
      && isSiteConfirmation(trimmedInput)
      && hasSiteConfirmationRequest(previousAssistantMessage)
    ) {
      onSiteConfirmed(buildConfirmedSiteBrief([...messages, userMessage]));
      setMessages((previous) => [
        ...previous,
        userMessage,
        {
          role: "assistant",
          content: "Great. Let’s fine-tune the goals, visitor actions, pages, and visual direction.",
          timestamp: new Date(),
        },
      ]);
      setInput("");
      return;
    }

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      let response: { content: string; code?: string; wizardStep?: ChatWizardStep } | null = null;

      // Use custom handler if provided
      if (customSendHandler) {
        response = await customSendHandler(trimmedInput, droppedFiles);
      } 
      // Handle file analysis
      else if (droppedFiles.length > 0) {
        const result = await analyzeAndGenerate(
          trimmedInput || "Analyze these files and suggest improvements",
          droppedFiles
        );
        if (result.success) {
          response = {
            content: result.explanation || "Analysis complete.",
            code: result.code,
          };
        } else {
          response = {
            content: `Sorry, I couldn't process those files: ${result.error || 'Unknown error'}`,
          };
        }
      }
      // Default AI handler via edge function
      else {
        const requestMessages = [
          ...(contextCode ? [{ role: "system" as const, content: `Context:\n${contextCode}` }] : []),
          ...messages.slice(-12).map(({ role, content }) => ({ role, content })),
          { role: "user" as const, content: trimmedInput },
        ];
        const { data, error } = await invokeAIFunction("ai-code-assistant", {
          messages: requestMessages,
          systemType,
          businessName,
          mode: aiMode ?? "code",
        });

        if (error) {
          throw error;
        }

        if (aiMode === "site-discovery" && !isSiteDiscoveryResponse(data)) {

          throw new Error("Site planning is unavailable: the AI backend has not been updated with the site-discovery lane.");

        }

        const content = data?.choices?.[0]?.message?.content || data?.content || "I couldn't generate a response.";
        
        // Extract code blocks if present
        const codeMatch = content.match(/```(?:html|jsx|tsx|javascript|typescript)?\n?([\s\S]*?)```/);
        
        response = {
          content,
          code: codeMatch ? codeMatch[1].trim() : undefined,
          ...(aiMode === 'site-discovery' ? { wizardStep: getChatWizardStep(content, data?.wizardStep) } : {}),
        };
      }

      // Clear dropped files
      setDroppedFiles([]);

      if (response) {
        const assistantMessage: AIMessage = {
          role: "assistant",
          content: response.content,
          timestamp: new Date(),
          hasCode: !!response.code,
          code: response.code,
          wizardStep: response.wizardStep,
        };

        setMessages(prev => [...prev, assistantMessage]);
        if (aiMode === 'site-discovery') onDiscoveryStarted?.();

        // Notify parent if code was generated
        if (response.code && onCodeGenerated) {
          onCodeGenerated(response.code);
        }

        // Notify parent of message
        if (onMessageSent) {
          await onMessageSent(response.content);
        }
      }
    } catch (error) {
      console.error("AI Assistant error:", error);
      const errorMessage: AIMessage = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      toast({
        title: "Error",
        description: describeAssistantFailure(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle quick action click
  const handleQuickAction = (action: QuickAction) => {
    setInput(action.prompt);
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle paste for images
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith("image/"));

    if (imageItems.length > 0) {
      e.preventDefault();
      const files: DroppedFile[] = [];

      for (const item of imageItems) {
        const file = item.getAsFile();
        if (file) {
          const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const preview = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });

          files.push({
            id,
            file,
            name: `pasted-image-${files.length + 1}.png`,
            type: "image",
            preview,
          });
        }
      }

      if (files.length > 0) {
        setDroppedFiles(prev => [...prev, ...files]);
      }
    }
  };

  // Extract code from message content
  const extractCode = (content: string): string | null => {
    const match = content.match(/```(?:html|jsx|tsx|javascript|typescript)?\n?([\s\S]*?)```/);
    return match ? match[1].trim() : null;
  };

  return (
    <div className={cn(
      "flex flex-col overflow-hidden",
      appearance === "unison"
        ? "bg-transparent border-0 rounded-none"
        : "bg-background border rounded-lg",
      compact ? "max-h-[400px]" : "h-full",
      className
    )}>
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-purple-600 to-blue-600 text-white">
          {headerContent || (
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <span className="font-semibold">AI Assistant</span>
            </div>
          )}
          {allowClearHistory && messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearHistory}
              className="text-white/80 hover:text-white hover:bg-white/20 h-8 w-8"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {/* Quick Actions */}
      {!selectionActive && quickActions.length > 0 && (
        <div className={cn(
          "p-2 border-b",
          appearance === "unison" ? "border-0 bg-transparent px-0 pt-0" : "bg-muted/30"
        )}>
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                className={cn(
                  "text-xs px-2.5 py-1.5 border rounded-full transition-colors flex items-center gap-1",
                  appearance === "unison"
                    ? "bg-white/5 border-cyan-300/20 text-white/75 hover:bg-cyan-400/10 hover:border-cyan-300/50 hover:text-white"
                    : "bg-background hover:bg-primary/10 hover:border-primary/30"
                )}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="sleek-scrollbar min-h-0 flex-1 p-3" ref={scrollRef} data-chat-viewport>
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className={cn(
              "text-center py-5",
              appearance === "unison" ? "text-cyan-100/70" : "text-muted-foreground py-8"
            )}>
              <Bot className={cn(
                "w-8 h-8 mx-auto mb-2",
                appearance === "unison"
                  ? "text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.55)]"
                  : "opacity-50"
              )} />
              <p className="text-sm">
                {appearance === "unison"
                  ? "Tell Unison what you have in mind."
                  : "Start a conversation or try a quick action above"}
              </p>
            </div>
          )}
          
          {messages.map((message, index) => {
            const code = message.code || extractCode(message.content);
            
            return (
              <div
                key={index}
                className={cn(
                  "flex gap-2",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                    appearance === "unison"
                      ? "bg-gradient-to-br from-cyan-400 to-violet-500 shadow-[0_0_12px_rgba(34,211,238,0.35)]"
                      : "bg-gradient-to-r from-purple-500 to-blue-500"
                  )}>
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div className={cn(
                  "max-w-[85%] rounded-lg p-3",
                  appearance === "unison"
                    ? message.role === "user"
                      ? "border border-cyan-300/20 bg-cyan-400/10 text-white"
                      : "border border-white/10 bg-white/5 text-white/85"
                    : message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                )}>
                  <p className="text-sm whitespace-pre-wrap">{stripSiteConfirmationMarker(message.content)}</p>
                  
                  {/* Code block with copy button */}
                  {code && message.role === "assistant" && (
                    <div className="mt-2 relative">
                      <pre className="bg-black/10 rounded p-2 text-xs overflow-x-auto max-h-32">
                        <code>{code.substring(0, 500)}{code.length > 500 ? "..." : ""}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="absolute top-1 right-1 h-6 px-2"
                        onClick={() => handleCopyCode(code, index)}
                      >
                        {copiedIndex === index ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {message.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-2 justify-start">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center",
                appearance === "unison"
                  ? "bg-gradient-to-br from-cyan-400 to-violet-500"
                  : "bg-gradient-to-r from-purple-500 to-blue-500"
              )}>
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
              <div className={cn(
                "rounded-lg p-3",
                appearance === "unison" ? "text-cyan-100/70" : "bg-muted"
              )}>
                <p className={cn("text-sm", appearance === "unison" ? "text-cyan-100/70" : "text-muted-foreground")}>
                  {analyzing ? "Analyzing files..." : "Thinking..."}
                </p>
              </div>
            </div>
          )}
          {conversationContent}
          {!conversationContent && discoverySelections && messages.some(message => message.wizardStep) && (() => {
            const turn = [...messages].reverse().find(message => message.wizardStep)!;
            return discoverySelections({
              step: getChatWizardStep(turn.content, turn.wizardStep),
              brief: buildConfirmedSiteBrief(messages), pending: isLoading,
            }, value => { void handleSend(value); });
          })()}
        </div>
      </ScrollArea>

      {/* File Drop Zone */}
      {showFileUpload && (showFileZone || droppedFiles.length > 0) && (
        <div className="px-3 py-2 border-t">
          <FileDropZone
            onFilesDropped={handleFilesDropped}
            files={droppedFiles}
            onRemoveFile={handleRemoveFile}
            compact={droppedFiles.length > 0}
          />
        </div>
      )}

      {/* Input Area */}
      {!selectionActive && <div className={cn(
        "p-3 border-t",
        appearance === "unison" ? "border-cyan-300/20 bg-transparent px-0 pb-0" : "bg-background"
      )}>
        <div className="flex gap-2">
          {showFileUpload && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowFileZone(!showFileZone)}
              className={cn("h-9 w-9", showFileZone && "bg-primary/10 text-primary")}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
          )}
          
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={droppedFiles.length > 0 ? "Describe what to do with files..." : placeholder}
            aria-label={appearance === "unison" ? "Describe what you want Unison to build" : undefined}
            disabled={isLoading}
            className={cn(
              "sleek-scrollbar flex-1 min-h-[40px] max-h-[120px] resize-none",
              appearance === "unison" && "border-cyan-300/25 bg-white/5 text-white placeholder:text-white/45 focus-visible:ring-cyan-300/40",
              compact && "min-h-[36px]"
            )}
            rows={1}
          />
          
          <Button
            onClick={() => { void handleSend(); }}
            disabled={isLoading || (!input.trim() && droppedFiles.length === 0)}
            size="icon"
            className={cn(
              "h-9 w-9",
              appearance === "unison"
                ? "bg-cyan-400 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.35)] hover:bg-cyan-300"
                : "bg-primary hover:bg-primary/90"
            )}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        {showFileUpload && (
          <p className={cn("text-xs mt-1.5", appearance === "unison" ? "text-white/40" : "text-muted-foreground")}>
            📎 Paste images or drop files • Powered by AI
          </p>
        )}
        {onContinueToWizard && !selectionActive && messages.some((message) => message.role === "user") && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleContinueToWizard}
            disabled={isLoading}
            className={cn(
              "mt-2 h-8 w-full justify-center text-xs",
              appearance === "unison"
                ? "text-cyan-100/75 hover:bg-cyan-300/10 hover:text-white"
                : "text-muted-foreground"
            )}
          >
            Continue with guided setup
          </Button>
        )}
      </div>}
    </div>
  );
};

export default AIAssistantCore;
