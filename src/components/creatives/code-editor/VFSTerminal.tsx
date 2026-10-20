/**
 * VFS Terminal — Interactive terminal integrated with the Virtual File System
 * 
 * Features:
 * - Command input with autocomplete hints
 * - VFS-aware commands (ls, cat, tree, find, diagnose)
 * - Dependency management (install, uninstall, preset)
 * - Event bus integration for build logs and AI events
 * - AI can programmatically execute commands via event bus
 * - Command history (up/down arrows)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Terminal, X, Trash2, AlertCircle, CheckCircle,
  Loader2, ChevronDown, ChevronUp, Filter, Copy,
  AlertTriangle, Info, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { vfsEventBus, type BuildLogEvent } from '@/services/vfsEventBus';
import {
  processCommand,
  executeTerminalCommand,
  parseAICommands,
  type TerminalLine,
  type CommandContext,
  type TerminalFileOp,
} from '@/services/terminalCommands';
import type { VirtualNode } from '@/hooks/useVirtualFileSystem';

// ============================================================================
// Types
// ============================================================================

export interface VFSTerminalProps {
  className?: string;
  maxHeight?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  /** VFS nodes for command context */
  nodes: VirtualNode[];
  /** Current custom dependencies beyond the Sandpack defaults */
  customDeps: Record<string, string>;
  /** Business system type (salon, restaurant, etc.) */
  businessType?: string;
  /** Callback to add a dependency */
  onAddDep?: (pkg: string, version: string) => void;
  /** Callback to remove a dependency */
  onRemoveDep?: (pkg: string) => void;
  /** Callback to refresh preview */
  onRefreshPreview?: () => void;
  /** Callback to write a file to VFS */
  onPatch?: CommandContext['onPatch'];
  getRevisionInfo?: CommandContext['getRevisionInfo'];
}

// ============================================================================
// Constants
// ============================================================================

const MAX_LINES = 800;
const COMMAND_HINTS = [
  'install', 'uninstall', 'deps', 'preset', 'ls', 'tree',
  'cat', 'find', 'diagnose', 'whoami', 'clear', 'help',
];

// ============================================================================
// Component
// ============================================================================

export function VFSTerminal({
  className,
  maxHeight = '240px',
  isCollapsed = false,
  onToggleCollapse,
  nodes,
  customDeps,
  businessType,
  onAddDep,
  onRemoveDep,
  onRefreshPreview,
  onPatch,
  getRevisionInfo,
}: VFSTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [filterLevel, setFilterLevel] = useState<'all' | 'error' | 'warn'>('all');
  const [isProcessing, setIsProcessing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoScrollRef = useRef(true);

  // Build command context
  const cmdContext = useMemo<CommandContext>(() => ({
    nodes,
    currentDeps: customDeps,
    businessType,
    onAddDep: onAddDep || (() => {}),
    onRemoveDep: onRemoveDep || (() => {}),
    onRefreshPreview,
    onPatch,
    getRevisionInfo,
  }), [nodes, customDeps, businessType, onAddDep, onRemoveDep, onRefreshPreview, onPatch, getRevisionInfo]);

  // Append lines helper
  const appendLines = useCallback((newLines: TerminalLine[]) => {
    setLines(prev => {
      // Handle clear command
      if (newLines.some(l => l.text === '__CLEAR__')) return [];
      return [...prev, ...newLines].slice(-MAX_LINES);
    });
  }, []);

  // Auto-scroll on new lines
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [lines]);

  // A natural-language change waiting for the user to confirm (Enter runs it, Esc cancels).
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);

  // Execute a command
  const executeCommand = useCallback((input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Add input echo
    const inputLine: TerminalLine = {
      id: `in_${Date.now()}`,
      type: 'input',
      text: `$ ${trimmed}`,
      timestamp: Date.now(),
    };

    setIsProcessing(true);
    if (/^probe\b/.test(trimmed)) {
      // Probe waits for the live preview to answer.
      appendLines([inputLine]);
      void executeTerminalCommand(trimmed, cmdContext)
        .then((r) => appendLines(r.lines))
        .finally(() => setIsProcessing(false));
    } else {
      const result = processCommand(trimmed, cmdContext);
      setIsProcessing(false);
      const confirmLine = result.lines.find((l) => l.text.startsWith('__CONFIRM__'));
      const aiLine = result.lines.find((l) => l.text.startsWith('__AI__'));
      if (confirmLine) {
        const cmd = confirmLine.text.slice('__CONFIRM__'.length);
        setPendingCommand(cmd);
        const label = result.lines.find((l) => !l.text.startsWith('__'))?.text ?? cmd;
        appendLines([
          inputLine,
          { id: `cf_${Date.now()}`, type: 'system', text: `I understood: ${label}`, timestamp: Date.now() },
          { id: `cf2_${Date.now()}`, type: 'warn', text: `This changes your site. Press Enter to run \`${cmd}\`, or Esc to cancel.`, timestamp: Date.now() },
        ]);
      } else if (aiLine) {
        const prompt = aiLine.text.slice('__AI__'.length);
        // One canonical agent: the terminal never calls AI itself.
        window.dispatchEvent(new CustomEvent('unison:builder-send', { detail: { prompt } }));
        appendLines([
          inputLine,
          { id: `ai_${Date.now()}`, type: 'system', text: 'Sent to the AI Builder — follow progress in the chat.', timestamp: Date.now() },
        ]);
      } else {
        appendLines([inputLine, ...result.lines]);
      }
    }

    // Update history
    setCommandHistory(prev => {
      const next = [trimmed, ...prev.filter(h => h !== trimmed)].slice(0, 50);
      return next;
    });
    setHistoryIndex(-1);
  }, [cmdContext, appendLines]);

  // Subscribe to event bus for build logs and AI events
  useEffect(() => {
    const unsubs = [
      vfsEventBus.on<BuildLogEvent>('build:log', (event) => {
        appendLines([{
          id: `bl_${Date.now()}_${Math.random()}`,
          type: event.payload.level === 'error' ? 'error' : event.payload.level === 'warn' ? 'warn' : 'output',
          text: `[${event.payload.source || 'build'}] ${event.payload.message}`,
          timestamp: event.timestamp,
        }]);
      }),
      vfsEventBus.on('build:error', (event) => {
        const payload = event.payload as { message: string };
        appendLines([{
          id: `be_${Date.now()}`,
          type: 'error',
          text: `[build] ✗ ${payload.message}`,
          timestamp: event.timestamp,
        }]);
      }),
      vfsEventBus.on('build:success', (event) => {
        appendLines([{
          id: `bs_${Date.now()}`,
          type: 'success',
          text: '[build] ✓ Build completed successfully',
          timestamp: event.timestamp,
        }]);
      }),
      vfsEventBus.on('deps:resolved', (event) => {
        const payload = event.payload as { newDeps: string[] };
        if (payload.newDeps.length > 0) {
          appendLines([{
            id: `dr_${Date.now()}`,
            type: 'success',
            text: `[deps] ✓ Resolved: ${payload.newDeps.join(', ')}`,
            timestamp: event.timestamp,
          }]);
        }
      }),
      vfsEventBus.on('deps:error', (event) => {
        const payload = event.payload as { message: string };
        appendLines([{
          id: `de_${Date.now()}`,
          type: 'error',
          text: `[deps] ✗ ${payload.message}`,
          timestamp: event.timestamp,
        }]);
      }),
      vfsEventBus.on('ai:apply:start', (event) => {
        appendLines([{
          id: `aas_${Date.now()}`,
          type: 'system',
          text: '▶ AI code generation started...',
          timestamp: event.timestamp,
        }]);
      }),
      vfsEventBus.on('ai:apply:complete', (event) => {
        const payload = event.payload as { filesWritten: string[] };
        appendLines([{
          id: `aac_${Date.now()}`,
          type: 'success',
          text: `✓ AI applied ${payload.filesWritten.length} file(s): ${payload.filesWritten.join(', ')}`,
          timestamp: event.timestamp,
        }]);
      }),
      vfsEventBus.on('ai:apply:error', (event) => {
        const payload = event.payload as { message: string };
        appendLines([{
          id: `aae_${Date.now()}`,
          type: 'error',
          text: `✗ AI error: ${payload.message}`,
          timestamp: event.timestamp,
        }]);
      }),
      vfsEventBus.on('preview:error', (event) => {
        const payload = event.payload as { message: string };
        appendLines([{
          id: `pe_${Date.now()}`,
          type: 'error',
          text: `[preview] ${payload.message}`,
          timestamp: event.timestamp,
        }]);
      }),
    ];

    return () => unsubs.forEach(u => u());
  }, [appendLines]);

  // Listen for AI-triggered terminal commands
  useEffect(() => {
    const unsub = vfsEventBus.on('build:log', (event) => {
      const payload = event.payload as BuildLogEvent;
      if (payload.source === 'ai:terminal' && payload.message) {
        // AI sent a terminal command
        const commands = parseAICommands(payload.message);
        for (const cmd of commands) {
          executeCommand(cmd);
        }
      }
    });
    return unsub;
  }, [executeCommand]);

  // Handle input submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    // An empty Enter confirms a pending natural-language change.
    if (pendingCommand && !inputValue.trim()) {
      const cmd = pendingCommand;
      setPendingCommand(null);
      executeCommand(cmd);
      setInputValue('');
      return;
    }
    if (pendingCommand) setPendingCommand(null);
    executeCommand(inputValue);
    setInputValue('');
  }, [inputValue, executeCommand, pendingCommand]);

  // Handle key events (history navigation, tab completion)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && pendingCommand) {
      e.preventDefault();
      setPendingCommand(null);
      appendLines([{ id: `cx_${Date.now()}`, type: 'system', text: 'Cancelled — nothing was changed.', timestamp: Date.now() }]);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      } else {
        setHistoryIndex(-1);
        setInputValue('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const current = inputValue.trim().toLowerCase();
      if (current) {
        const match = COMMAND_HINTS.find(h => h.startsWith(current));
        if (match) setInputValue(match + ' ');
      }
    }
  }, [commandHistory, historyIndex, inputValue, pendingCommand, appendLines]);

  // Scroll handler
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40;
  }, []);

  // Filtered lines
  const filteredLines = useMemo(() => {
    if (filterLevel === 'all') return lines;
    if (filterLevel === 'error') return lines.filter(l => l.type === 'error' || l.type === 'input');
    return lines.filter(l => l.type === 'error' || l.type === 'warn' || l.type === 'input');
  }, [lines, filterLevel]);

  const errorCount = useMemo(() => lines.filter(l => l.type === 'error').length, [lines]);
  const warnCount = useMemo(() => lines.filter(l => l.type === 'warn').length, [lines]);

  // Line colors
  const getLineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input': return 'text-sky-300';
      case 'error': return 'text-red-300';
      case 'warn': return 'text-amber-300';
      case 'success': return 'text-emerald-300';
      case 'system': return 'text-violet-300/70';
      default: return 'text-white/55';
    }
  };

  const getLineIcon = (type: TerminalLine['type']) => {
    switch (type) {
      case 'error': return <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-[2px]" />;
      case 'warn': return <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-[2px]" />;
      case 'success': return <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-[2px]" />;
      case 'system': return <Info className="w-3 h-3 text-violet-400/60 flex-shrink-0 mt-[2px]" />;
      case 'input': return <ChevronRight className="w-3 h-3 text-sky-400 flex-shrink-0 mt-[2px]" />;
      default: return null;
    }
  };

  return (
    <div className={cn('flex flex-col bg-[#0a0a14] border-t border-white/[0.06]', className)}>
      {/* Header */}
      <div
        className="h-8 flex items-center justify-between px-3 cursor-pointer select-none hover:bg-white/[0.02] transition-colors"
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-violet-400/60" />
          <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Terminal</span>
          {errorCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">
              {errorCount}
            </span>
          )}
          {warnCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">
              {warnCount}
            </span>
          )}
          {isProcessing && <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setFilterLevel(f => f === 'all' ? 'error' : f === 'error' ? 'warn' : 'all'); }}
            className={cn(
              'p-1 rounded transition-colors',
              filterLevel !== 'all' ? 'bg-white/[0.08] text-white/60' : 'text-white/25 hover:text-white/40'
            )}
            title={`Filter: ${filterLevel}`}
          >
            <Filter className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(lines.map(l => l.text).join('\n')); }}
            className="p-1 rounded text-white/25 hover:text-white/40 transition-colors"
            title="Copy all"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setLines([]); }}
            className="p-1 rounded text-white/25 hover:text-white/40 transition-colors"
            title="Clear"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          {isCollapsed
            ? <ChevronUp className="w-3 h-3 text-white/30" />
            : <ChevronDown className="w-3 h-3 text-white/30" />
          }
        </div>
      </div>

      {/* Terminal body */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden flex flex-col"
            style={{ maxHeight }}
          >
            {/* Output area */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto font-mono text-[12px] leading-[1.65] px-3 pb-1 min-h-0"
              style={{ maxHeight: `calc(${maxHeight} - 32px)` }}
              onClick={() => inputRef.current?.focus()}
            >
              {filteredLines.length === 0 ? (
                <div className="py-4 text-center text-white/15 text-[11px]">
                  VFS Terminal ready. Type <span className="text-violet-400/50">help</span> for commands.
                </div>
              ) : (
                filteredLines.map((line) => (
                  <div
                    key={line.id}
                    className={cn(
                      'flex items-start gap-1.5 py-[1px] rounded px-1 -mx-1',
                      line.type === 'error' && 'bg-red-500/[0.04]',
                      line.type === 'input' && 'bg-sky-500/[0.03] mt-1',
                    )}
                  >
                    {getLineIcon(line.type)}
                    <span className={cn('break-all whitespace-pre-wrap', getLineColor(line.type))}>
                      {line.text}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Input area */}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-1.5 px-3 py-1.5 border-t border-white/[0.04] bg-white/[0.01]"
            >
              <ChevronRight className="w-3 h-3 text-violet-400/50 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command..."
                className="flex-1 bg-transparent text-white/80 text-[12px] font-mono placeholder:text-white/15 outline-none"
                autoComplete="off"
                spellCheck={false}
              />
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default VFSTerminal;
