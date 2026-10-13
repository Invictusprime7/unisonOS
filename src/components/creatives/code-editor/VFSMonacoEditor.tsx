/**
 * VFS Monaco Editor — Full IDE-grade code editor
 * 
 * Features:
 * - Monaco (VS Code engine) with IntelliSense
 * - Language-specific syntax highlighting (HTML/CSS/JS/TS/JSON)
 * - Prettier format-on-demand (Shift+Alt+F)
 * - AI inline completions
 * - Minimap, bracket matching, breadcrumbs
 * - VFS-aware: auto-detects language from file extension
 */

import React, { useRef, useCallback, useEffect, useState, Component, type ReactNode, type ErrorInfo } from 'react';
import Editor, { OnMount, loader } from '@monaco-editor/react';

// Infer editor type from OnMount callback (avoids direct 'monaco-editor' dependency)
type IStandaloneCodeEditor = Parameters<OnMount>[0];
import { cn } from '@/lib/utils';
import { isUnisonProtectedPath } from '@/services/unisonCanonicalRegistry';
import { getMonacoModelUri, MonacoVFSSync, normalizeVFSPath, type MonacoAPI } from '@/services/monacoVFSSync';

// ---------------------------------------------------------------------------
// Fallback plain-text editor when Monaco fails to load
// ---------------------------------------------------------------------------

function FallbackEditor({
  value,
  onChange,
  fileName,
  height,
  className,
  onSave,
  error,
}: {
  value: string;
  onChange?: (value: string) => void;
  fileName?: string;
  height?: string;
  className?: string;
  onSave?: (value: string) => void;
  error?: string;
}) {
  return (
    <div className={cn('relative w-full overflow-hidden bg-[#1e1e1e]', className)} style={{ height }}>
      {error && (
        <div className="px-3 py-1.5 bg-amber-500/20 text-amber-300 text-xs border-b border-amber-500/30">
          Code editor failed to load ({error}). Using plain-text fallback.
        </div>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            onSave?.(value);
          }
        }}
        className="w-full h-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm p-4 resize-none outline-none border-none"
        spellCheck={false}
        style={{ tabSize: 2, fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace" }}
      />
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#007acc] flex items-center justify-between px-3 text-[11px] text-white/90 font-medium z-10 select-none">
        <span>{fileName || 'untitled'} (fallback editor)</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error boundary that catches Monaco render crashes
// ---------------------------------------------------------------------------

class MonacoErrorBoundary extends Component<
  { children: ReactNode; fallbackProps: { value: string; onChange?: (v: string) => void; fileName?: string; height?: string; className?: string; onSave?: (v: string) => void } },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[VFSMonacoEditor] Monaco crashed:', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return <FallbackEditor {...this.props.fallbackProps} error={this.state.errorMsg} />;
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VFSMonacoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  fileName?: string;           // e.g. "App.tsx" — used for language detection
  filePath?: string;
  projectFiles?: Record<string, string>;
  language?: string;           // override language
  readOnly?: boolean;
  isAIProcessing?: boolean;
  height?: string;
  className?: string;
  onSave?: (value: string) => void;
}

// Map file extension → Monaco language id
const EXT_LANG_MAP: Record<string, string> = {
  'tsx': 'typescript',
  'ts': 'typescript',
  'jsx': 'javascript',
  'js': 'javascript',
  'html': 'html',
  'htm': 'html',
  'css': 'css',
  'scss': 'scss',
  'json': 'json',
  'md': 'markdown',
  'svg': 'xml',
  'xml': 'xml',
  'yaml': 'yaml',
  'yml': 'yaml',
};

function detectLanguage(fileName?: string, fallback?: string): string {
  if (fallback) return fallback;
  if (!fileName) return 'typescript';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return EXT_LANG_MAP[ext] || 'plaintext';
}

// ---------------------------------------------------------------------------
// Prettier helpers (lazy-loaded)
// ---------------------------------------------------------------------------

let prettierPromise: Promise<any> | null = null;
let prettierPluginsPromise: Promise<any[]> | null = null;

async function loadPrettier() {
  if (!prettierPromise) {
    prettierPromise = import('prettier/standalone');
    prettierPluginsPromise = Promise.all([
      import('prettier/plugins/html'),
      import('prettier/plugins/babel'),
      import('prettier/plugins/estree'),
      import('prettier/plugins/postcss'),
      import('prettier/plugins/typescript'),
    ]);
  }
  const prettier = await prettierPromise;
  const plugins = await prettierPluginsPromise!;
  return { prettier, plugins };
}

const LANG_TO_PARSER: Record<string, string> = {
  typescript: 'typescript',
  javascript: 'babel',
  html: 'html',
  css: 'css',
  scss: 'css',
  json: 'json',
};

async function formatCode(code: string, language: string): Promise<string> {
  const parser = LANG_TO_PARSER[language];
  if (!parser) return code;

  try {
    const { prettier, plugins } = await loadPrettier();
    return await prettier.format(code, {
      parser,
      plugins,
      singleQuote: true,
      trailingComma: 'all',
      printWidth: 100,
      tabWidth: 2,
      semi: true,
    });
  } catch (err) {
    console.warn('[Prettier] format failed:', err);
    return code;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const VFSMonacoEditor: React.FC<VFSMonacoEditorProps> = ({
  value,
  onChange,
  fileName,
  filePath,
  projectFiles = {},
  language: languageOverride,
  readOnly = false,
  isAIProcessing = false,
  height = '100%',
  className,
  onSave,
}) => {
  const editorRef = useRef<IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<any>(null);
  const vfsSyncRef = useRef<MonacoVFSSync | null>(null);
  const projectFilesRef = useRef(projectFiles);
  const valueRef = useRef(value);
  const [isFormatting, setIsFormatting] = useState(false);

  const language = detectLanguage(fileName, languageOverride);
  const modelPath = filePath ?? (fileName?.startsWith('/') ? fileName : `/src/${fileName || 'Untitled.tsx'}`);
  projectFilesRef.current = projectFiles;
  valueRef.current = value;

  const syncProjectModels = useCallback((monaco: unknown) => {
    if (!vfsSyncRef.current) vfsSyncRef.current = new MonacoVFSSync();
    const normalizedPath = normalizeVFSPath(modelPath);
    const files = {
      ...projectFilesRef.current,
      [normalizedPath]: editorRef.current?.getValue() ?? valueRef.current,
    };
    vfsSyncRef.current.syncAll(files, monaco as MonacoAPI);
  }, [modelPath]);

  // Auto-protect canonical Unison files — they're deterministically
  // regenerated from CreatorData, so any manual edit is overwritten on
  // the next preview compile anyway. Force read-only to prevent confusion.
  const isCanonicalProtected = fileName ? isUnisonProtectedPath(fileName) : false;
  const effectiveReadOnly = readOnly || isCanonicalProtected;

  // Format action
  const handleFormat = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || effectiveReadOnly) return;
    setIsFormatting(true);
    try {
      const formatted = await formatCode(editor.getValue(), language);
      if (formatted !== editor.getValue()) {
        editor.setValue(formatted);
        onChange?.(formatted);
      }
    } finally {
      setIsFormatting(false);
    }
  }, [language, onChange, effectiveReadOnly]);

  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    syncProjectModels(monaco);

    // ---- Tailwind class completions inside className="" ----
    const tailwindClasses = [
      'flex', 'grid', 'block', 'inline-block', 'hidden',
      'items-center', 'justify-center', 'justify-between', 'flex-col', 'flex-row', 'flex-wrap',
      'p-1','p-2','p-3','p-4','p-6','p-8','px-2','px-4','px-6','py-2','py-4','py-6',
      'm-1','m-2','m-4','mx-auto','my-4','gap-2','gap-4','gap-6',
      'w-full','h-full','max-w-sm','max-w-md','max-w-lg','max-w-xl','max-w-2xl','min-h-screen',
      'text-xs','text-sm','text-base','text-lg','text-xl','text-2xl','text-3xl','text-4xl',
      'font-normal','font-medium','font-semibold','font-bold',
      'text-center','text-left','text-right',
      'bg-primary','bg-secondary','bg-muted','bg-accent','bg-destructive','bg-background',
      'text-primary','text-secondary','text-muted','text-accent','text-foreground','text-muted-foreground',
      'border','border-border','border-primary','rounded','rounded-md','rounded-lg','rounded-xl','rounded-full',
      'shadow','shadow-md','shadow-lg','shadow-xl',
      'opacity-50','opacity-75','opacity-100',
      'transition-all','transition-colors','duration-200','duration-300',
      'hover:bg-primary/90','hover:opacity-80','hover:scale-105',
      'animate-spin','animate-pulse','animate-bounce',
      'absolute','relative','fixed','sticky','inset-0','z-10','z-50',
      'overflow-hidden','overflow-auto','overflow-x-auto',
      'space-x-2','space-x-4','space-y-2','space-y-4',
      'cursor-pointer','select-none','pointer-events-none',
      'sm:','md:','lg:','xl:','2xl:',
    ];

    monaco.languages.registerCompletionItemProvider(
      ['html', 'typescript', 'javascript', 'typescriptreact', 'javascriptreact'],
      {
        triggerCharacters: ['"', "'", ' '],
        provideCompletionItems: (model, position) => {
          // Only inside className=""
          const lineContent = model.getLineContent(position.lineNumber);
          const beforeCursor = lineContent.substring(0, position.column - 1);
          if (!/(className|class)\s*=\s*["'][^"']*$/.test(beforeCursor)) {
            return { suggestions: [] };
          }
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          return {
            suggestions: tailwindClasses.map(cls => ({
              label: cls,
              kind: cls.startsWith('bg-') || cls.startsWith('text-')
                ? monaco.languages.CompletionItemKind.Color
                : monaco.languages.CompletionItemKind.Property,
              insertText: cls,
              range,
              sortText: cls,
            })),
          };
        },
      },
    );

    // ---- Keyboard shortcuts ----
    // Shift+Alt+F → Format with Prettier
    editor.addAction({
      id: 'prettier-format',
      label: 'Format Document (Prettier)',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1,
      run: () => handleFormat(),
    });

    // Ctrl/Cmd+S → Save
    editor.addAction({
      id: 'save-file',
      label: 'Save File',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: (ed) => {
        onSave?.(ed.getValue());
      },
    });

    // Enable diagnostics
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });
  }, [handleFormat, onSave, syncProjectModels]);

  useEffect(() => {
    if (monacoRef.current) syncProjectModels(monacoRef.current);
  }, [projectFiles, syncProjectModels]);

  useEffect(() => () => {
    vfsSyncRef.current?.dispose();
    vfsSyncRef.current = null;
  }, []);

  // Update language when file changes
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        monacoRef.current.editor.setModelLanguage(model, language);
      }
    }
  }, [language]);

  return (
    <MonacoErrorBoundary fallbackProps={{ value, onChange, fileName, height, className, onSave }}>
      <div
        className={cn(
          'relative w-full overflow-hidden',
          isAIProcessing && 'opacity-50 pointer-events-none',
          className,
        )}
        style={{ height }}
      >
        {/* AI processing overlay */}
        {isAIProcessing && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border shadow-lg">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground font-medium">AI is processing…</span>
            </div>
          </div>
        )}

        {/* Format indicator */}
        {isFormatting && (
          <div className="absolute top-2 right-16 z-20 px-2 py-1 rounded bg-primary/20 text-primary text-xs font-medium animate-pulse">
            Formatting…
          </div>
        )}

        <Editor
          height="100%"
          path={getMonacoModelUri(modelPath)}
          language={language}
          value={value}
          onChange={(v) => onChange?.(v || '')}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          loading={
            <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-white/50 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                Loading editor…
              </div>
            </div>
          }
          options={{
            readOnly: effectiveReadOnly,
            minimap: { enabled: true, maxColumn: 80 },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
            fontLigatures: true,
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            roundedSelection: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            inlineSuggest: { enabled: true },
            bracketPairColorization: { enabled: true },
            guides: {
              bracketPairs: true,
              indentation: true,
            },
            stickyScroll: { enabled: true },
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            padding: { top: 8, bottom: 8 },
            folding: true,
            foldingStrategy: 'indentation',
            showFoldingControls: 'mouseover',
            matchBrackets: 'always',
            colorDecorators: true,
            linkedEditing: true,
          }}
        />

        {/* Status bar */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#007acc] flex items-center justify-between px-3 text-[11px] text-white/90 font-medium z-10 select-none">
          <div className="flex items-center gap-3">
            <span>{fileName || 'untitled'}</span>
            <span className="opacity-60">Ln {(value ?? '').split('\n').length}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="opacity-70 cursor-pointer hover:opacity-100" onClick={handleFormat} title="Shift+Alt+F">
              Prettier
            </span>
            <span className="uppercase tracking-wider">{language}</span>
            <span className="opacity-60">UTF-8</span>
          </div>
        </div>
      </div>
    </MonacoErrorBoundary>
  );
};

export default VFSMonacoEditor;
