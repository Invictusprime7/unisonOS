import { describe, expect, it, vi } from 'vitest';
import {
  getMonacoModelUri,
  MonacoVFSSync,
  resolveVFSCompilerOptions,
  type MonacoAPI,
  type MonacoMarker,
  type MonacoModel,
} from '@/services/monacoVFSSync';
import { diagnosticsAggregator } from '@/services/diagnosticsAggregator';

function createMonacoMock() {
  const models = new Map<string, MonacoModel>();
  const modelMarkers = new Map<string, MonacoMarker[]>();
  const markerListeners = new Set<(uris: Array<{ toString: () => string }>) => void>();
  const setTypeScriptCompilerOptions = vi.fn();
  const setJavaScriptCompilerOptions = vi.fn();

  const monaco: MonacoAPI = {
    Uri: {
      parse: (uri) => ({ toString: () => uri }),
    },
    editor: {
      getModel: (uri) => models.get(uri.toString()) ?? null,
      createModel: (value, language, uri) => {
        const key = uri.toString();
        const model: MonacoModel = {
          uri,
          getValue: () => value,
          setValue: (nextValue) => { value = nextValue; },
          getLanguageId: () => language,
          dispose: () => { models.delete(key); },
          onDidChangeContent: () => ({ dispose: () => undefined }),
        };
        models.set(key, model);
        return model;
      },
      getModels: () => [...models.values()],
      getModelMarkers: ({ resource }) => modelMarkers.get(resource?.toString() ?? '') ?? [],
      onDidChangeMarkers: (listener) => {
        markerListeners.add(listener);
        return { dispose: () => markerListeners.delete(listener) };
      },
      setModelLanguage: (model, language) => {
        const mutableModel = model as MonacoModel & { language: string };
        mutableModel.language = language;
      },
    },
    languages: {
      typescript: {
        ScriptTarget: { ES2020: 7, ESNext: 99 },
        ModuleKind: { ESNext: 99 },
        ModuleResolutionKind: { NodeJs: 2, Bundler: 100 },
        JsxEmit: { React: 2, ReactJSX: 4 },
        typescriptDefaults: {
          addExtraLib: () => ({ dispose: () => undefined }),
          setCompilerOptions: setTypeScriptCompilerOptions,
          setDiagnosticsOptions: () => undefined,
        },
        javascriptDefaults: {
          addExtraLib: () => ({ dispose: () => undefined }),
          setCompilerOptions: setJavaScriptCompilerOptions,
          setDiagnosticsOptions: () => undefined,
        },
      },
    },
  };

  return {
    monaco,
    models,
    setTypeScriptCompilerOptions,
    setJavaScriptCompilerOptions,
    emitMarkers: (uri: string, markers: MonacoMarker[]) => {
      const resource = { toString: () => uri };
      modelMarkers.set(uri, markers);
      for (const listener of markerListeners) listener([resource]);
    },
  };
}

describe('Monaco VFS synchronization', () => {
  it('uses stable project file URIs and creates models for sibling imports', () => {
    const { monaco, models, setTypeScriptCompilerOptions, setJavaScriptCompilerOptions } = createMonacoMock();
    const sync = new MonacoVFSSync();

    const stats = sync.syncAll({
      '/src/App.tsx': "import { Card } from '@/components/Card';",
      '/src/components/Card.tsx': 'export function Card() { return null; }',
    }, monaco);

    expect(stats).toMatchObject({ created: 2, total: 2 });
    expect(getMonacoModelUri('src/App.tsx')).toBe('file:///src/App.tsx');
    expect(models.has('file:///src/components/Card.tsx')).toBe(true);
    expect(setTypeScriptCompilerOptions).toHaveBeenCalledWith(expect.objectContaining({
      paths: { '@/*': ['./src/*'] },
    }));
    expect(setJavaScriptCompilerOptions).toHaveBeenCalled();

    sync.dispose();
  });

  it('updates changed VFS models and removes models for deleted files', () => {
    const { monaco, models } = createMonacoMock();
    const sync = new MonacoVFSSync();
    sync.syncAll({
      '/src/App.tsx': 'export const value = 1;',
      '/src/Removed.ts': 'export const removed = true;',
    }, monaco);

    const stats = sync.syncAll({ '/src/App.tsx': 'export const value = 2;' }, monaco);

    expect(stats).toMatchObject({ updated: 1, removed: 1, total: 1 });
    expect(models.get('file:///src/App.tsx')?.getValue()).toBe('export const value = 2;');
    expect(models.has('file:///src/Removed.ts')).toBe(false);

    sync.dispose();
  });

  it('uses the VFS tsconfig module, JSX, strictness, and paths settings', async () => {
    const { monaco } = createMonacoMock();
    const sync = new MonacoVFSSync();
    const stats = sync.syncAll({
      '/tsconfig.json': `{
        // Unison-generated React VFS settings.
        "compilerOptions": {
          "target": "ES2020",
          "module": "ESNext",
          "moduleResolution": "bundler",
          "jsx": "react-jsx",
          "strict": false,
          "paths": { "@/*": ["./src/*"], "~/*": ["./src/*"] }
        }
      }`,
      '/src/App.tsx': 'export default function App() { return <main />; }',
    }, monaco);

    expect(stats.total).toBe(2);
    await vi.waitFor(() => {
      expect(monaco.languages.typescript.typescriptDefaults.setCompilerOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          target: 7,
          module: 99,
          moduleResolution: 100,
          jsx: 4,
          strict: false,
          paths: { '@/*': ['./src/*'], '~/*': ['./src/*'] },
        }),
      );
    });

    sync.dispose();
  });

  it('adds the Unison @/src alias when a VFS config does not define paths', async () => {
    const { monaco } = createMonacoMock();
    const options = await resolveVFSCompilerOptions(
      '{ "compilerOptions": { "moduleResolution": "bundler" } }',
      monaco.languages.typescript,
    );

    expect(options.paths).toEqual({ '@/*': ['./src/*'] });
    expect(options.moduleResolution).toBe(100);
  });

  it('publishes only tracked VFS TypeScript diagnostics to the AI diagnostics context', () => {
    diagnosticsAggregator.clearSource('typescript');
    const { monaco, emitMarkers } = createMonacoMock();
    const sync = new MonacoVFSSync();
    sync.syncAll({ '/src/App.tsx': 'const title: string = 1;' }, monaco);

    emitMarkers('file:///outside/Other.ts', [{
      owner: 'typescript', severity: 8, message: 'Unrelated model error', startLineNumber: 1, startColumn: 1,
    }]);
    expect(diagnosticsAggregator.getChannelDiagnostics('editor')).toHaveLength(0);

    emitMarkers('file:///src/App.tsx', [{
      owner: 'typescript',
      severity: 8,
      code: 2322,
      message: "Type 'number' is not assignable to type 'string'.",
      startLineNumber: 1,
      startColumn: 7,
    }]);

    expect(diagnosticsAggregator.getChannelDiagnostics('editor')).toEqual([
      expect.objectContaining({
        source: 'typescript',
        file: '/src/App.tsx',
        line: 1,
        column: 7,
        code: '2322',
        message: "Type 'number' is not assignable to type 'string'.",
      }),
    ]);
    expect(diagnosticsAggregator.getContextForAI()).toContain('/src/App.tsx:1');

    sync.dispose();
    expect(diagnosticsAggregator.getChannelDiagnostics('editor')).toHaveLength(0);
  });
});