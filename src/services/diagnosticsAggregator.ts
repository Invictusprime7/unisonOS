/**
 * DiagnosticsAggregator — Unified 5-channel diagnostic collection
 * 
 * Channels:
 * 1. Editor: TypeScript, ESLint, import resolution, JSX parse errors
 * 2. Preview: runtime exceptions, React errors, route failures, hydration crashes
 * 3. Terminal: build logs, install failures, test failures, stack traces
 * 4. Workspace: file tree issues, config problems, dependency conflicts
 * 5. Unison: intent binding errors, workflow graph issues, page registry problems
 */

// ============================================================================
// Types
// ============================================================================

export type DiagnosticChannel = 'editor' | 'preview' | 'terminal' | 'workspace' | 'unison';

export type DiagnosticSource =
  | 'typescript' | 'eslint' | 'import' | 'jsx-parse'           // editor channel
  | 'runtime' | 'react-error' | 'route-failure' | 'hydration'  // preview channel
  | 'build' | 'install' | 'test' | 'stack-trace'               // terminal channel
  | 'file-tree' | 'config' | 'dependency'                      // workspace channel
  | 'intent' | 'workflow' | 'page-registry' | 'blueprint'      // unison channel
  | 'security';                                                  // cross-cutting

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export const SOURCE_TO_CHANNEL: Record<DiagnosticSource, DiagnosticChannel> = {
  'typescript': 'editor', 'eslint': 'editor', 'import': 'editor', 'jsx-parse': 'editor',
  'runtime': 'preview', 'react-error': 'preview', 'route-failure': 'preview', 'hydration': 'preview',
  'build': 'terminal', 'install': 'terminal', 'test': 'terminal', 'stack-trace': 'terminal',
  'file-tree': 'workspace', 'config': 'workspace', 'dependency': 'workspace',
  'intent': 'unison', 'workflow': 'unison', 'page-registry': 'unison', 'blueprint': 'unison',
  'security': 'editor',
};

export interface Diagnostic {
  id: string;
  channel: DiagnosticChannel;
  source: DiagnosticSource;
  severity: DiagnosticSeverity;
  file?: string;
  line?: number;
  column?: number;
  code?: string;
  message: string;
  raw?: string;
  timestamp: number;
  resolved?: boolean;
}

export interface ChannelHealth {
  channel: DiagnosticChannel;
  status: 'healthy' | 'warning' | 'error';
  errorCount: number;
  warningCount: number;
  infoCount: number;
  lastUpdated: number;
}

export interface DiagnosticSnapshot {
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  sources: DiagnosticSource[];
  channels: ChannelHealth[];
  timestamp: number;
}

// ============================================================================
// Aggregator
// ============================================================================

class DiagnosticsAggregatorService {
  private diagnostics: Map<string, Diagnostic> = new Map();
  private listeners: Set<(snapshot: DiagnosticSnapshot) => void> = new Set();
  private channelTimestamps: Map<DiagnosticChannel, number> = new Map();
  private idCounter = 0;

  private genId(): string {
    return `diag-${++this.idCounter}-${Date.now()}`;
  }

  /** Add a diagnostic. Deduplicates by source+file+line+message. */
  add(input: Omit<Diagnostic, 'id' | 'timestamp' | 'resolved' | 'channel'>): Diagnostic {
    const channel = SOURCE_TO_CHANNEL[input.source] ?? 'editor';
    const dedupeKey = `${input.source}:${input.file ?? ''}:${input.line ?? ''}:${input.message}`;

    for (const [, existing] of this.diagnostics) {
      if (`${existing.source}:${existing.file ?? ''}:${existing.line ?? ''}:${existing.message}` === dedupeKey && !existing.resolved) {
        return existing;
      }
    }

    const diag: Diagnostic = {
      ...input, channel,
      id: this.genId(), timestamp: Date.now(), resolved: false,
    };
    this.diagnostics.set(diag.id, diag);
    this.channelTimestamps.set(channel, Date.now());
    this.notify();
    return diag;
  }

  /** Bulk-add diagnostics from a source, replacing all previous from that source */
  replaceSource(source: DiagnosticSource, items: Omit<Diagnostic, 'id' | 'timestamp' | 'resolved' | 'source' | 'channel'>[]): void {
    for (const [id, d] of this.diagnostics) {
      if (d.source === source) this.diagnostics.delete(id);
    }
    const channel = SOURCE_TO_CHANNEL[source] ?? 'editor';
    for (const item of items) {
      const diag: Diagnostic = {
        ...item, source, channel,
        id: this.genId(), timestamp: Date.now(), resolved: false,
      };
      this.diagnostics.set(diag.id, diag);
    }
    this.channelTimestamps.set(channel, Date.now());
    this.notify();
  }

  // ── Channel 1: Editor ──────────────────────────────────────────────────

  /** Ingest TypeScript diagnostics (from Monaco or tsc output) */
  ingestTypeScriptDiagnostics(items: Array<{ file?: string; line?: number; column?: number; code?: string; message: string; severity?: DiagnosticSeverity }>): void {
    this.replaceSource('typescript', items.map(i => ({
      severity: i.severity ?? 'error', file: i.file, line: i.line, column: i.column, code: i.code, message: i.message,
    })));
  }

  /** Ingest ESLint diagnostics */
  ingestESLintDiagnostics(items: Array<{ file?: string; line?: number; column?: number; ruleId?: string; message: string; severity?: DiagnosticSeverity }>): void {
    this.replaceSource('eslint', items.map(i => ({
      severity: i.severity ?? 'warning', file: i.file, line: i.line, column: i.column, code: i.ruleId, message: i.message,
    })));
  }

  /** Ingest import resolution errors */
  ingestImportErrors(items: Array<{ file: string; line?: number; importPath: string; message: string }>): void {
    this.replaceSource('import', items.map(i => ({
      severity: 'error' as DiagnosticSeverity, file: i.file, line: i.line,
      message: `Cannot resolve '${i.importPath}': ${i.message}`,
      code: 'IMPORT_RESOLVE',
    })));
  }

  /** Ingest JSX parse errors */
  ingestJSXParseErrors(items: Array<{ file: string; line?: number; column?: number; message: string }>): void {
    this.replaceSource('jsx-parse', items.map(i => ({
      severity: 'error' as DiagnosticSeverity, file: i.file, line: i.line, column: i.column,
      message: i.message, code: 'JSX_PARSE',
    })));
  }

  // ── Channel 2: Preview ─────────────────────────────────────────────────

  /** Ingest iframe runtime errors from AIBuilderPanel */
  ingestIframeErrors(errors: Array<{ type: string; message: string; stack?: string; file?: string; line?: number; column?: number }>): void {
    const items = errors.map(e => {
      const isReactError = e.type?.includes('React') || e.message?.includes('React') || e.message?.includes('hook');
      const isRouteError = e.message?.includes('route') || e.message?.includes('Route') || e.message?.includes('navigate');
      const isHydration = e.message?.includes('hydrat') || e.message?.includes('server') && e.message?.includes('client');
      const source: DiagnosticSource = isReactError ? 'react-error' : isRouteError ? 'route-failure' : isHydration ? 'hydration' : 'runtime';
      return { source, severity: 'error' as DiagnosticSeverity, file: e.file, line: e.line, column: e.column, message: e.message, raw: e.stack, code: e.type };
    });
    // Replace all preview sources
    for (const src of ['runtime', 'react-error', 'route-failure', 'hydration'] as DiagnosticSource[]) {
      for (const [id, d] of this.diagnostics) { if (d.source === src) this.diagnostics.delete(id); }
    }
    const channel: DiagnosticChannel = 'preview';
    for (const item of items) {
      const diag: Diagnostic = { ...item, channel, id: this.genId(), timestamp: Date.now(), resolved: false };
      this.diagnostics.set(diag.id, diag);
    }
    this.channelTimestamps.set(channel, Date.now());
    this.notify();
  }

  // ── Channel 3: Terminal ────────────────────────────────────────────────

  /** Ingest terminal output lines looking for errors */
  ingestTerminalOutput(lines: Array<{ type: string; text: string }>): void {
    const errorLines = lines.filter(l => l.type === 'error');
    const items = errorLines.map(l => {
      const match = l.text.match(/(?:at\s+)?([^\s]+):(\d+):(\d+)/);
      const isBuild = l.text.includes('vite') || l.text.includes('build') || l.text.includes('rollup');
      const isInstall = l.text.includes('npm') || l.text.includes('install') || l.text.includes('ERESOLVE');
      const isTest = l.text.includes('FAIL') || l.text.includes('vitest') || l.text.includes('test');
      const source: DiagnosticSource = isBuild ? 'build' : isInstall ? 'install' : isTest ? 'test' : 'stack-trace';
      return {
        source, severity: 'error' as DiagnosticSeverity,
        file: match?.[1], line: match ? parseInt(match[2]) : undefined, column: match ? parseInt(match[3]) : undefined,
        message: l.text, raw: l.text,
      };
    });
    // Replace all terminal sources
    for (const src of ['build', 'install', 'test', 'stack-trace'] as DiagnosticSource[]) {
      for (const [id, d] of this.diagnostics) { if (d.source === src) this.diagnostics.delete(id); }
    }
    const channel: DiagnosticChannel = 'terminal';
    for (const item of items) {
      const diag: Diagnostic = { ...item, channel, id: this.genId(), timestamp: Date.now(), resolved: false };
      this.diagnostics.set(diag.id, diag);
    }
    this.channelTimestamps.set(channel, Date.now());
    this.notify();
  }

  // ── Channel 4: Workspace ───────────────────────────────────────────────

  /** Ingest workspace-level issues (circular deps, missing configs, dependency conflicts) */
  ingestWorkspaceIssues(items: Array<{
    type: 'circular-dep' | 'missing-config' | 'orphan-file' | 'dep-conflict' | 'missing-entry';
    file?: string; message: string; severity?: DiagnosticSeverity;
  }>): void {
    const mapped = items.map(i => {
      const source: DiagnosticSource = i.type === 'dep-conflict' ? 'dependency' : i.type === 'missing-config' ? 'config' : 'file-tree';
      return { source, severity: (i.severity ?? 'warning') as DiagnosticSeverity, file: i.file, message: i.message, code: i.type.toUpperCase() };
    });
    // Group by source and replace
    const bySource = new Map<DiagnosticSource, typeof mapped>();
    for (const m of mapped) {
      const arr = bySource.get(m.source) ?? [];
      arr.push(m);
      bySource.set(m.source, arr);
    }
    for (const [src, srcItems] of bySource) {
      this.replaceSource(src, srcItems);
    }
  }

  // ── Channel 5: Unison ──────────────────────────────────────────────────

  /** Ingest Unison-specific diagnostics (intents, workflows, page registry, blueprint) */
  ingestUnisonDiagnostics(items: Array<{
    domain: 'intent' | 'workflow' | 'page-registry' | 'blueprint';
    message: string; file?: string; severity?: DiagnosticSeverity; code?: string;
  }>): void {
    const mapped = items.map(i => ({
      severity: (i.severity ?? 'warning') as DiagnosticSeverity,
      file: i.file, message: i.message, code: i.code,
    }));
    // Group by domain (which maps to source)
    const byDomain = new Map<DiagnosticSource, typeof mapped>();
    for (let idx = 0; idx < items.length; idx++) {
      const src = items[idx].domain as DiagnosticSource;
      const arr = byDomain.get(src) ?? [];
      arr.push(mapped[idx]);
      byDomain.set(src, arr);
    }
    for (const [src, srcItems] of byDomain) {
      this.replaceSource(src, srcItems);
    }
  }

  // ── Common ─────────────────────────────────────────────────────────────

  resolve(id: string): void {
    const d = this.diagnostics.get(id);
    if (d) { d.resolved = true; this.notify(); }
  }

  clear(): void { this.diagnostics.clear(); this.notify(); }

  clearSource(source: DiagnosticSource): void {
    for (const [id, d] of this.diagnostics) { if (d.source === source) this.diagnostics.delete(id); }
    this.notify();
  }

  clearChannel(channel: DiagnosticChannel): void {
    for (const [id, d] of this.diagnostics) { if (d.channel === channel) this.diagnostics.delete(id); }
    this.notify();
  }

  /** Get channel health summaries */
  private getChannelHealthMap(): ChannelHealth[] {
    const channels: DiagnosticChannel[] = ['editor', 'preview', 'terminal', 'workspace', 'unison'];
    return channels.map(ch => {
      const items = Array.from(this.diagnostics.values()).filter(d => !d.resolved && d.channel === ch);
      const errorCount = items.filter(d => d.severity === 'error').length;
      const warningCount = items.filter(d => d.severity === 'warning').length;
      const infoCount = items.filter(d => d.severity === 'info').length;
      return {
        channel: ch,
        status: errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'healthy',
        errorCount, warningCount, infoCount,
        lastUpdated: this.channelTimestamps.get(ch) ?? 0,
      };
    });
  }

  getSnapshot(): DiagnosticSnapshot {
    const all = Array.from(this.diagnostics.values()).filter(d => !d.resolved);
    const sources = [...new Set(all.map(d => d.source))];
    return {
      diagnostics: all.sort((a, b) => {
        const sevOrder = { error: 0, warning: 1, info: 2 };
        return (sevOrder[a.severity] - sevOrder[b.severity]) || (b.timestamp - a.timestamp);
      }),
      errorCount: all.filter(d => d.severity === 'error').length,
      warningCount: all.filter(d => d.severity === 'warning').length,
      infoCount: all.filter(d => d.severity === 'info').length,
      sources: sources as DiagnosticSource[],
      channels: this.getChannelHealthMap(),
      timestamp: Date.now(),
    };
  }

  /** Get diagnostics as compact context string for AI prompts — grouped by channel */
  getContextForAI(maxChars = 4000): string {
    const snap = this.getSnapshot();
    if (snap.diagnostics.length === 0) return 'No diagnostics found.';

    const lines: string[] = [
      `## Diagnostics: ${snap.errorCount}E ${snap.warningCount}W ${snap.infoCount}I`,
      `Channels: ${snap.channels.filter(c => c.status !== 'healthy').map(c => `${c.channel}(${c.status})`).join(', ') || 'all healthy'}`,
    ];

    let chars = lines.join('\n').length;
    const channelOrder: DiagnosticChannel[] = ['preview', 'editor', 'terminal', 'workspace', 'unison'];
    for (const ch of channelOrder) {
      const chDiags = snap.diagnostics.filter(d => d.channel === ch);
      if (chDiags.length === 0) continue;
      const header = `\n### ${ch.toUpperCase()} (${chDiags.length})`;
      if (chars + header.length > maxChars) break;
      lines.push(header);
      chars += header.length;
      for (const d of chDiags) {
        const line = `- [${d.severity.toUpperCase()}] ${d.source}${d.file ? ` ${d.file}` : ''}${d.line ? `:${d.line}` : ''}: ${d.message}`;
        if (chars + line.length > maxChars) { lines.push(`... +${chDiags.length - lines.length} more`); break; }
        lines.push(line);
        chars += line.length;
      }
    }
    return lines.join('\n');
  }

  /** Get diagnostics for a specific channel */
  getChannelDiagnostics(channel: DiagnosticChannel): Diagnostic[] {
    return Array.from(this.diagnostics.values()).filter(d => !d.resolved && d.channel === channel);
  }

  /** Get unresolved diagnostics limited to the current VFS paths and sources. */
  getDiagnosticsForFiles(filePaths: Iterable<string>, sources?: readonly DiagnosticSource[]): Diagnostic[] {
    const paths = new Set(filePaths);
    const allowedSources = sources ? new Set(sources) : null;
    return this.getSnapshot().diagnostics.filter(diagnostic =>
      !!diagnostic.file
      && paths.has(diagnostic.file)
      && (!allowedSources || allowedSources.has(diagnostic.source)),
    );
  }

  subscribe(listener: (snapshot: DiagnosticSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      try { listener(snap); } catch (e) { console.error('[DiagnosticsAggregator] listener error:', e); }
    }
  }
}

export const diagnosticsAggregator = new DiagnosticsAggregatorService();
