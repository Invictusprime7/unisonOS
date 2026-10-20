import React, { useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import { getSupabaseFunctionHeaders, getSupabaseFunctionUrl } from '@/integrations/supabase/supabaseFunctionRequest';
const supabase = supabaseClient as any;
import { toast } from 'sonner';
import { sanitizeTsxFile } from '@/utils/tsxSanitizer';

// Enhanced Monaco Editor with React/TypeScript support and AI assistance
const MonacoEditor: React.FC<React.ComponentProps<typeof Editor>> = (props) => {
  const editorRef = useRef<any>(null);
  const [isAIProcessing, setIsAIProcessing] = useState(false);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Configure TypeScript compiler options for React
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: 'React',
      allowJs: true,
      typeRoots: ['node_modules/@types'],
      lib: ['es2020', 'dom', 'dom.iterable'],
    });

    // Configure JSX/TSX support
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: 'React',
      allowJs: true,
      typeRoots: ['node_modules/@types'],
      lib: ['es2020', 'dom', 'dom.iterable'],
    });

    // Add React type definitions for IntelliSense
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      `
      declare module 'react' {
        export interface FC<P = {}> {
          (props: P): JSX.Element | null;
        }
        export function useState<S>(initialState: S | (() => S)): [S, (value: S | ((prev: S) => S)) => void];
        export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
        export function useRef<T>(initialValue: T): { current: T };
        export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
        export function useMemo<T>(factory: () => T, deps: any[]): T;
        export interface CSSProperties {
          [key: string]: any;
        }
        export namespace JSX {
          interface Element {}
          interface IntrinsicElements {
            [elemName: string]: any;
          }
        }
      }
      `,
      'ts:react.d.ts'
    );

    // Add Tailwind CSS class IntelliSense
    monaco.languages.registerCompletionItemProvider(['html', 'typescript', 'javascript', 'typescriptreact', 'javascriptreact'], {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        // Tailwind utility classes
        const suggestions = [
          // Layout
          { label: 'flex', kind: monaco.languages.CompletionItemKind.Property, insertText: 'flex', detail: 'Display flex' },
          { label: 'grid', kind: monaco.languages.CompletionItemKind.Property, insertText: 'grid', detail: 'Display grid' },
          { label: 'block', kind: monaco.languages.CompletionItemKind.Property, insertText: 'block', detail: 'Display block' },
          { label: 'inline-block', kind: monaco.languages.CompletionItemKind.Property, insertText: 'inline-block', detail: 'Display inline-block' },
          { label: 'hidden', kind: monaco.languages.CompletionItemKind.Property, insertText: 'hidden', detail: 'Display none' },
          
          // Flexbox
          { label: 'items-center', kind: monaco.languages.CompletionItemKind.Property, insertText: 'items-center', detail: 'Align items center' },
          { label: 'justify-center', kind: monaco.languages.CompletionItemKind.Property, insertText: 'justify-center', detail: 'Justify content center' },
          { label: 'justify-between', kind: monaco.languages.CompletionItemKind.Property, insertText: 'justify-between', detail: 'Space between' },
          { label: 'flex-col', kind: monaco.languages.CompletionItemKind.Property, insertText: 'flex-col', detail: 'Flex direction column' },
          { label: 'flex-row', kind: monaco.languages.CompletionItemKind.Property, insertText: 'flex-row', detail: 'Flex direction row' },
          
          // Spacing
          { label: 'p-4', kind: monaco.languages.CompletionItemKind.Property, insertText: 'p-4', detail: 'Padding 1rem' },
          { label: 'px-4', kind: monaco.languages.CompletionItemKind.Property, insertText: 'px-4', detail: 'Padding X 1rem' },
          { label: 'py-4', kind: monaco.languages.CompletionItemKind.Property, insertText: 'py-4', detail: 'Padding Y 1rem' },
          { label: 'm-4', kind: monaco.languages.CompletionItemKind.Property, insertText: 'm-4', detail: 'Margin 1rem' },
          { label: 'mx-auto', kind: monaco.languages.CompletionItemKind.Property, insertText: 'mx-auto', detail: 'Margin X auto' },
          { label: 'gap-4', kind: monaco.languages.CompletionItemKind.Property, insertText: 'gap-4', detail: 'Gap 1rem' },
          
          // Sizing
          { label: 'w-full', kind: monaco.languages.CompletionItemKind.Property, insertText: 'w-full', detail: 'Width 100%' },
          { label: 'h-full', kind: monaco.languages.CompletionItemKind.Property, insertText: 'h-full', detail: 'Height 100%' },
          { label: 'max-w-md', kind: monaco.languages.CompletionItemKind.Property, insertText: 'max-w-md', detail: 'Max width medium' },
          { label: 'min-h-screen', kind: monaco.languages.CompletionItemKind.Property, insertText: 'min-h-screen', detail: 'Min height 100vh' },
          
          // Colors
          { label: 'bg-blue-500', kind: monaco.languages.CompletionItemKind.Color, insertText: 'bg-blue-500', detail: 'Background blue' },
          { label: 'text-white', kind: monaco.languages.CompletionItemKind.Color, insertText: 'text-white', detail: 'Text white' },
          { label: 'text-gray-600', kind: monaco.languages.CompletionItemKind.Color, insertText: 'text-gray-600', detail: 'Text gray' },
          { label: 'bg-gradient-to-r', kind: monaco.languages.CompletionItemKind.Color, insertText: 'bg-gradient-to-r', detail: 'Gradient right' },
          
          // Typography
          { label: 'text-lg', kind: monaco.languages.CompletionItemKind.Property, insertText: 'text-lg', detail: 'Font size large' },
          { label: 'text-xl', kind: monaco.languages.CompletionItemKind.Property, insertText: 'text-xl', detail: 'Font size XL' },
          { label: 'font-bold', kind: monaco.languages.CompletionItemKind.Property, insertText: 'font-bold', detail: 'Font weight bold' },
          { label: 'font-semibold', kind: monaco.languages.CompletionItemKind.Property, insertText: 'font-semibold', detail: 'Font weight 600' },
          { label: 'text-center', kind: monaco.languages.CompletionItemKind.Property, insertText: 'text-center', detail: 'Text align center' },
          
          // Borders & Shadows
          { label: 'rounded-lg', kind: monaco.languages.CompletionItemKind.Property, insertText: 'rounded-lg', detail: 'Border radius large' },
          { label: 'shadow-lg', kind: monaco.languages.CompletionItemKind.Property, insertText: 'shadow-lg', detail: 'Box shadow large' },
          { label: 'border', kind: monaco.languages.CompletionItemKind.Property, insertText: 'border', detail: 'Border 1px' },
          
          // Responsive
          { label: 'sm:', kind: monaco.languages.CompletionItemKind.Property, insertText: 'sm:', detail: 'Small breakpoint (640px)' },
          { label: 'md:', kind: monaco.languages.CompletionItemKind.Property, insertText: 'md:', detail: 'Medium breakpoint (768px)' },
          { label: 'lg:', kind: monaco.languages.CompletionItemKind.Property, insertText: 'lg:', detail: 'Large breakpoint (1024px)' },
          
          // State variants
          { label: 'hover:', kind: monaco.languages.CompletionItemKind.Property, insertText: 'hover:', detail: 'Hover state' },
          { label: 'focus:', kind: monaco.languages.CompletionItemKind.Property, insertText: 'focus:', detail: 'Focus state' },
          { label: 'active:', kind: monaco.languages.CompletionItemKind.Property, insertText: 'active:', detail: 'Active state' },
        ];

        return { suggestions: suggestions.map(s => ({ ...s, range })) };
      },
    });

    // Enable better error detection
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    // Register AI code completion provider
    monaco.languages.registerInlineCompletionsProvider('typescript', {
      provideInlineCompletions: async (model, position, context) => {
        if (isAIProcessing) return { items: [] };
        
        const textBeforeCursor = model.getValueInRange({
          startLineNumber: Math.max(1, position.lineNumber - 10),
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        // Only trigger on significant context
        if (textBeforeCursor.trim().length < 20) return { items: [] };

        try {
          setIsAIProcessing(true);
          const completion = await getAICompletion(textBeforeCursor);
          setIsAIProcessing(false);

          if (!completion) return { items: [] };

          return {
            items: [{
              insertText: completion,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
            }],
          };
        } catch (error) {
          setIsAIProcessing(false);
          return { items: [] };
        }
      },
      disposeInlineCompletions: () => {},
    });

    // Register AI assistant command (Ctrl+Shift+A or Cmd+Shift+A)
    editor.addAction({
      id: 'ai-code-assistant',
      label: 'Affinity',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyA,
      ],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: async (ed) => {
        const selection = ed.getSelection();
        const selectedText = selection ? ed.getModel()?.getValueInRange(selection) : '';
        const prompt = selectedText || ed.getValue();

        if (!prompt.trim()) {
          toast.error('Please select code or type something first');
          return;
        }

        try {
          setIsAIProcessing(true);
          toast.loading('AI is thinking...', { id: 'ai-assist' });

          const result = await getAIAssistance(prompt, 'code');

          if (result && selection) {
            ed.executeEdits('', [{
              range: selection,
              text: result,
            }]);
          }

          toast.success('AI assistance complete', { id: 'ai-assist' });
        } catch (error) {
          toast.error('AI assistance failed', { id: 'ai-assist' });
        } finally {
          setIsAIProcessing(false);
        }
      },
    });

    // Quick-fix: run TSX sanitizer on the current buffer (Ctrl/Cmd+Shift+F)
    editor.addAction({
      id: 'tsx-auto-fix',
      label: 'Auto-fix TSX (sanitize JSX, imports, fences)',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      ],
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.5,
      run: (ed) => {
        const model = ed.getModel();
        if (!model) return;
        const path = model.uri?.path || 'file.tsx';
        const before = model.getValue();
        const result = sanitizeTsxFile(path, before);
        if (!result.code || result.code === before) {
          toast.message('Nothing to fix', {
            description: result.issues.length
              ? `Issues: ${result.issues.join(', ')}`
              : 'Code already clean.',
          });
          return;
        }
        ed.executeEdits('tsx-auto-fix', [
          {
            range: model.getFullModelRange(),
            text: result.code,
          },
        ]);
        toast.success(
          result.applied.length
            ? `Auto-fix applied: ${result.applied.join(', ')}`
            : 'Auto-fix applied',
        );
      },
    });
    if (props.onMount) {
      props.onMount(editor, monaco);
    }
  };

  // AI completion helper
  const getAICompletion = async (context: string): Promise<string | null> => {
    try {
      const response = await fetch(
        getSupabaseFunctionUrl('ai-code-assistant'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...await getSupabaseFunctionHeaders(),
          },
          body: JSON.stringify({
            messages: [
              { role: 'user', content: `Complete this code. Only return the next few lines of completion, no explanations:\n\n${context}` }
            ],
            mode: 'code',
            savePattern: false,
          }),
        }
      );

      if (!response.ok) return null;

      const reader = response.body?.getReader();
      if (!reader) return null;

      const decoder = new TextDecoder();
      let fullText = '';
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const jsonStr = line.slice(6).trim();
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) fullText += content;
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }

      // Extract code from markdown blocks
      const codeMatch = fullText.match(/```(?:html|javascript|js|typescript|tsx?)?\n?([\s\S]*?)```/);
      return codeMatch ? codeMatch[1].trim() : fullText.trim().substring(0, 200) || null;
    } catch (error) {
      console.error('AI completion error:', error);
      return null;
    }
  };

  // AI assistance helper
  const getAIAssistance = async (prompt: string, mode: 'code' | 'design' | 'review'): Promise<string | null> => {
    try {
      const response = await fetch(
        getSupabaseFunctionUrl('ai-code-assistant'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...await getSupabaseFunctionHeaders(),
          },
          body: JSON.stringify({
            messages: [
              { role: 'user', content: prompt }
            ],
            mode,
            savePattern: true,
          }),
        }
      );

      if (!response.ok) throw new Error('AI request failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullText = '';
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const jsonStr = line.slice(6).trim();
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) fullText += content;
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }

      // Extract code from markdown blocks
      const codeMatch = fullText.match(/```(?:html|javascript|js|typescript|tsx?)?\n?([\s\S]*?)```/);
      return codeMatch ? codeMatch[1].trim() : fullText.trim() || null;
    } catch (error) {
      console.error('AI assistance error:', error);
      throw error;
    }
  };

  return (
    <Editor
      {...props}
      onMount={handleEditorDidMount}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
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
        ...props.options,
      }}
    />
  );
};

export default MonacoEditor;
