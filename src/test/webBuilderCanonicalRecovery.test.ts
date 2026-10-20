import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const source = ts.createSourceFile(
  'WebBuilder.tsx', readFileSync('src/components/creatives/WebBuilder.tsx', 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
);

function executeCallback(anchor: string, dependencies: Record<string, unknown>, argument?: unknown) {
  const callbacks: ts.Expression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)
      && ['useCallback', 'useEffect'].includes(node.expression.getText(source))
      && node.arguments[0]?.getText(source).includes(anchor)) callbacks.push(node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(callbacks).toHaveLength(1);
  const compiled = ts.transpileModule(`const callback = ${callbacks[0].getText(source)}; return callback(argument);`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return new Function(...Object.keys(dependencies), 'argument', compiled)(...Object.values(dependencies), argument);
}

const committedFiles = { '/src/App.tsx': 'committed revision' };
const journalFiles = { '/src/App.tsx': 'unverified local edits' };
const recovery = {
  templateId: 'draft-1', pendingRemote: true, vfsFiles: journalFiles,
  code: 'local preview', editorCode: 'local editor',
};

describe('WebBuilder canonical recovery authority', () => {
  it.each([true, false])('hydrates canonical=%s without overriding committed authority', canonical => {
    const importBuilderFiles = vi.fn();
    const setPreviewCode = vi.fn();
    const readBuilderRecoverySnapshot = vi.fn(() => recovery);
    executeCallback('const shouldReplayRecovery', {
      setPersistedResumeState: vi.fn(),
      creatorPlayground: { hydrateCanonicalState: vi.fn() },
      setPlaygroundBindings: vi.fn(), setPlaygroundCalendars: vi.fn(), setPlaygroundPopups: vi.fn(),
      readBuilderRecoverySnapshot, importBuilderFiles, launchEntryPoint: '/src/App.tsx',
      restorePendingVfsOperations: vi.fn(),
      setPreviewCode, setEditorCode: vi.fn(), toast: { info: vi.fn() },
      setActivePagePath: vi.fn(), setCurrentTemplateName: vi.fn(), setSaveProjectName: vi.fn(),
      setProjectDisplayName: vi.fn(), setSaveProjectDescription: vi.fn(),
      setBuilderMode: vi.fn(), setShowLauncher: vi.fn(),
    }, {
      id: 'draft-1', name: 'Saved project', canvas_data: {
        vfsFiles: committedFiles,
        ...(canonical ? { siteBundleSnapshot: { pageRegistry: {} } } : {}),
      },
    });
    expect(importBuilderFiles.mock.calls[0][0]).toEqual(canonical ? committedFiles : journalFiles);
    expect(setPreviewCode).toHaveBeenCalledTimes(canonical ? 0 : 1);
    expect(recovery.pendingRemote).toBe(true);
  });

  it.each(['loaded', 'pending', 'legacy'])('first VFS observation %s respects revision ownership', state => {
    const canonical = state !== 'legacy';
    const saveDraft = vi.fn();
    const lastSavedVfsSignatureRef = { current: '' };
    executeCallback('First-ever VFS observation', {
      window: { setTimeout: (callback: () => void) => { callback(); return 1; }, clearTimeout: vi.fn() },
      lastSavedVfsSignatureRef,
      virtualFSRef: { current: { getSandpackFiles: () => committedFiles } },
      currentDraftIdRef: { current: 'draft-1' },
      hydratedRevision: state === 'loaded' ? { id: 'revision-1' } : null,
      hydratedRevisionRef: { current: canonical ? 'draft:project-1:draft-1:current#0' : null },
      legacyHydrationKeyRef: { current: null },
      lastPersistedVfsFilesRef: { current: {} },
      readBuilderRecoverySnapshot: vi.fn(() => recovery),
      restorePendingVfsOperations: vi.fn(),
      saveDraftRef: { current: saveDraft }, computeVfsSignature: JSON.stringify,
    });
    expect(saveDraft).toHaveBeenCalledTimes(canonical ? 0 : 1);
    if (state === 'pending') expect(lastSavedVfsSignatureRef.current).toBe('');
    else if (canonical) expect(lastSavedVfsSignatureRef.current).toBe(JSON.stringify(committedFiles));
    else expect(saveDraft).toHaveBeenCalledWith({ force: true, reason: 'ai_recovery', vfsFiles: journalFiles });
  });

  it.each([undefined, { force: true, reason: 'navigation_flush' }])(
    'defers autosave or flush %j while canonical hydration is unresolved', async options => {
      const getSandpackFiles = vi.fn();
      const writeBuilderRecoverySnapshot = vi.fn();
      const result = await executeCallback('const editorCodeForSave', {
        hydratedRevisionRef: { current: 'draft:project-1:draft-1:current#0' },
        legacyHydrationKeyRef: { current: null },
        hydratedRevision: null,
        virtualFSRef: { current: { getSandpackFiles } }, writeBuilderRecoverySnapshot,
      }, options);
      expect(result).toBe(false);
      expect(getSandpackFiles).not.toHaveBeenCalled();
      expect(writeBuilderRecoverySnapshot).not.toHaveBeenCalled();
    },
  );
});
