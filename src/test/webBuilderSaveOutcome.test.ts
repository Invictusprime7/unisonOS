import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const source = ts.createSourceFile(
  'WebBuilder.tsx',
  readFileSync('src/components/creatives/WebBuilder.tsx', 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function loadSaveCallback(name: string, dependencies: Record<string, unknown>) {
  let callback: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name &&
      node.initializer && ts.isCallExpression(node.initializer)) {
      callback = node.initializer.arguments[0];
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!callback) throw new Error(`Missing save callback: ${name}`);
  const compiled = ts.transpileModule(`const callback = ${callback.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(...Object.keys(dependencies), `${compiled}\nreturn callback;`)(...Object.values(dependencies));
}

function createDependencies() {
  return {
    templateFiles: {
      currentDraftId: 'existing-draft',
      saveTemplate: vi.fn().mockResolvedValue(null),
      updateTemplate: vi.fn().mockResolvedValue(false),
      setCurrentDraftId: vi.fn(),
    },
    saveProjectName: 'Studio Portfolio',
    saveProjectDescription: 'Keep this description',
    getFinalCodeWithOverrides: vi.fn(() => 'source'),
    buildSavePayloadOrFallback: vi.fn(() => ({ projectId: 'project-1' })),
    virtualFSRef: { current: { getSandpackFiles: () => ({}) } },
    setIsSavingProject: vi.fn(),
    setSaveProjectDialogOpen: vi.fn(),
    setCurrentDraftId: vi.fn(),
    setCurrentTemplateName: vi.fn(),
    setHydrationNonce: vi.fn(),
    clearDraft: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn() },
    console: { error: vi.fn() },
  };
}

describe('WebBuilder save outcome', () => {
  it('advances the toolbar base revision synchronously after an accepted commit', () => {
    const commitCallback = source.text.slice(
      source.text.indexOf('const commitBuilderFiles = useCallback'),
      source.text.indexOf("const onTerminalPatch = useCallback"),
    );
    expect(commitCallback.indexOf('currentRevisionIdRef.current = commit.persistedRevisionId'))
      .toBeGreaterThanOrEqual(0);
    expect(commitCallback.indexOf('currentRevisionIdRef.current = commit.persistedRevisionId'))
      .toBeLessThan(commitCallback.indexOf('setCurrentRevisionId(commit.persistedRevisionId)'));
  });

  it('serializes autosave through the shared builder mutation coordinator', () => {
    expect(source.text).toContain("runExclusive('autosave'");
  });

  it('leaves an unchanged canonical draft without prompting or writing after a page switch', () => {
    const files = { '/src/pages/Home.tsx': 'home', '/src/pages/Gallery.tsx': 'gallery' };
    const dependencies = {
      previewCode: 'gallery', lastSavedCodeRef: { current: 'home' },
      virtualFSRef: { current: { getSandpackFiles: () => files } },
      computeVfsSignature: JSON.stringify,
      lastSavedVfsSignatureRef: { current: JSON.stringify(files) },
      effectiveRouteState: undefined, hasUnsavedChanges: true,
      window: { confirm: vi.fn() }, clearLauncherHandoff: vi.fn(),
      navigate: vi.fn(), saveDraft: vi.fn(),
    };
    loadSaveCallback('handleBackNavigation', dependencies)();
    expect(dependencies.window.confirm).not.toHaveBeenCalled();
    expect(dependencies.saveDraft).not.toHaveBeenCalled();
    expect(dependencies.clearLauncherHandoff).toHaveBeenCalledOnce();
    expect(dependencies.navigate).toHaveBeenCalledWith('/home');
  });

  it('preserves the leave confirmation for actual unsaved VFS edits', () => {
    const dependencies = {
      previewCode: 'gallery', lastSavedCodeRef: { current: 'home' },
      virtualFSRef: { current: { getSandpackFiles: () => ({ '/src/pages/Home.tsx': 'edited' }) } },
      computeVfsSignature: JSON.stringify,
      lastSavedVfsSignatureRef: { current: JSON.stringify({ '/src/pages/Home.tsx': 'saved' }) },
      effectiveRouteState: undefined, hasUnsavedChanges: true,
      window: { confirm: vi.fn(() => false) }, clearLauncherHandoff: vi.fn(),
      navigate: vi.fn(), saveDraft: vi.fn(),
    };
    loadSaveCallback('handleBackNavigation', dependencies)();
    expect(dependencies.window.confirm).toHaveBeenCalledOnce();
    expect(dependencies.saveDraft).not.toHaveBeenCalled();
    expect(dependencies.navigate).not.toHaveBeenCalled();
  });

  it('preserves durable runtime identity through save payload finalization', () => {
    const runtimeContext = { workspaceId: 'workspace-1', websiteId: 'site-1', environment: 'builder' };
    const snapshot = { meta: { themePresetId: 'editorial', templateId: 'salon-premium' }, appContext: { runtimeContext }, industry: 'salon' };
    const files = { '/.unison/site-bundle-snapshot.json': JSON.stringify(snapshot) };
    const finalizer = vi.fn(() => ({ files, siteBundleSnapshot: snapshot }));
    const dependencies = {
      creatorPlayground: { pageRegistry: {}, creatorData: { businessInfo: { businessName: 'Studio' } } },
      playgroundBindings: {}, playgroundCalendars: {}, playgroundPopups: {},
      virtualFS: { getSandpackFiles: () => files }, hydratedRevision: { siteBundleSnapshot: snapshot },
      effectiveRouteState: undefined, resolveSnapshot: vi.fn(),
      currentTemplateName: 'Studio', projectNameFromState: undefined, systemName: undefined,
      resolvedThemePresetId: 'editorial', currentDesignPreset: 'editorial',
      commitToPipeline: vi.fn(() => ({ siteBundleSnapshot: snapshot })),
      buildCanonicalLaunchArtifacts: finalizer,
      launchEntryPoint: '/src/App.tsx', activePagePath: '/src/pages/Gallery.tsx',
      businessId: 'business-1', projectId: undefined, resolvedProjectId: 'project-1',
      currentManifestId: undefined, manifestIdFromState: undefined, activeSystemType: 'booking',
      systemType: undefined, currentTemplateCategory: undefined,
      projectDisplayName: 'Studio', saveProjectName: 'Studio', routeStateHasStructuredProject: false,
    };
    const payload = loadSaveCallback('buildSavePayload', dependencies)();
    expect(finalizer).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1', businessId: 'business-1', organizationId: 'workspace-1',
      siteId: 'site-1', environment: 'builder',
    }));
    expect(payload.projectId).toBe('project-1');
  });

  it('marks the adopted committed runtime projection as saved', () => {
    const files = { '/src/App.tsx': 'finalized router' };
    const dependencies = {
      projectCommittedWizardRuntime: vi.fn(() => ({ files })),
      importedRouteStateRef: { current: '' }, vfsReplaceFiles: vi.fn(),
      lastSavedVfsSignatureRef: { current: '' }, lastSavedCodeRef: { current: '' },
      lastPersistedVfsFilesRef: { current: {} },
      computeBuilderVfsSignature: JSON.stringify,
      syncBuilderFromFiles: vi.fn(() => ({ entrySource: 'finalized router' })),
      launchEntryPoint: '/src/App.tsx',
    };
    loadSaveCallback('replaceCommittedWizardFiles', dependencies)({ '/src/App.tsx': 'old router' });
    expect(dependencies.vfsReplaceFiles).toHaveBeenCalledWith(files);
    expect(dependencies.lastSavedVfsSignatureRef.current).toBe(JSON.stringify(files));
    expect(dependencies.lastSavedCodeRef.current).toBe('finalized router');
    expect(dependencies.lastPersistedVfsFilesRef.current).toEqual(files);
  });

  it('does not autosave a page switch when the multi-file VFS is unchanged', async () => {
    const files = { '/src/pages/About.tsx': 'about', '/src/pages/Home.tsx': 'home' };
    const dependencies = {
      hydratedRevisionRef: { current: 'revision-1' }, hydratedRevision: { id: 'revision-1' },
      virtualFSRef: { current: { getSandpackFiles: () => files } },
      computeVfsSignature: JSON.stringify, activePagePath: '/src/pages/About.tsx',
      previewCode: 'about', editorCode: 'about',
      lastSavedCodeRef: { current: 'home' },
      lastSavedVfsSignatureRef: { current: JSON.stringify(files) },
    };
    await expect(loadSaveCallback('saveDraft', dependencies)()).resolves.toBe(true);
  });

  it.each([true, false])('commits an explicit variant selection and rolls back rejection (accepted=%s)', async (accepted) => {
    const dependencies = {
      templateCustomizer: {
        activeVariants: { gallery: 'gallery:masonry' },
        setActiveVariant: vi.fn(), clearActiveVariant: vi.fn(),
      },
      commitPresentationOps: vi.fn().mockResolvedValue(accepted),
      businessId: 'business-1', currentDraftId: 'draft-1',
    };
    await loadSaveCallback('commitVariantSelection', dependencies)('gallery', 'gallery:lightbox-grid');
    expect(dependencies.commitPresentationOps).toHaveBeenCalledExactlyOnceWith([
      { type: 'setVariant', sectionId: 'gallery', variantId: 'gallery:lightbox-grid' },
    ]);
    expect(dependencies.templateCustomizer.setActiveVariant).toHaveBeenLastCalledWith(
      'gallery', accepted ? 'gallery:lightbox-grid' : 'gallery:masonry',
    );
  });

  it('does not commit presentation changes from restoration effects', () => {
    const writers: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' &&
        node.arguments[0]?.getText(source).includes('commitPresentationOps(')) {
        writers.push(node.arguments[0].getText(source));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(writers).toEqual([]);
  });

  it.each([false, true])('retains the dialog and recovery draft on failure (saveAsNew=%s)', async (saveAsNew) => {
    const dependencies = createDependencies();
    await loadSaveCallback('handleSaveToProjects', dependencies)(saveAsNew);

    expect(dependencies.toast.success).not.toHaveBeenCalled();
    expect(dependencies.setSaveProjectDialogOpen).not.toHaveBeenCalled();
    expect(dependencies.clearDraft).not.toHaveBeenCalled();
    expect(dependencies.setCurrentDraftId).not.toHaveBeenCalled();
    expect(dependencies.setHydrationNonce).not.toHaveBeenCalled();
    expect(dependencies.toast.error).toHaveBeenCalledWith('Failed to save project');
    expect(dependencies.setIsSavingProject).toHaveBeenLastCalledWith(false);
  });

  it.each([false, true])('dismisses only after confirmed success (saveAsNew=%s)', async (saveAsNew) => {
    const dependencies = createDependencies();
    dependencies.templateFiles.saveTemplate.mockResolvedValue('saved-draft');
    dependencies.templateFiles.updateTemplate.mockResolvedValue(true);
    await loadSaveCallback('handleSaveToProjects', dependencies)(saveAsNew);

    expect(dependencies.toast.success).toHaveBeenCalledOnce();
    expect(dependencies.setHydrationNonce).toHaveBeenCalledOnce();
    expect(dependencies.setHydrationNonce.mock.calls[0][0](3)).toBe(4);
    expect(dependencies.setSaveProjectDialogOpen).toHaveBeenCalledWith(false);
    expect(dependencies.clearDraft).toHaveBeenCalledOnce();
    if (saveAsNew) expect(dependencies.setCurrentDraftId).toHaveBeenCalledWith('saved-draft');
  });

  it('rejects the panel save callback when the hook returns no draft', async () => {
    const dependencies = createDependencies();
    await expect(loadSaveCallback('handleSaveTemplate', dependencies)('Studio', '', false)).rejects.toThrow();
  });

  it('allows a successful retry after a rejected content commit', async () => {
    const dependencies = createDependencies();
    dependencies.templateFiles.updateTemplate.mockRejectedValueOnce(new Error('Canonical commit rejected'));
    const save = loadSaveCallback('handleSaveToProjects', dependencies);
    await save(false);
    expect(dependencies.clearDraft).not.toHaveBeenCalled();
    expect(dependencies.setSaveProjectDialogOpen).not.toHaveBeenCalled();

    dependencies.templateFiles.updateTemplate.mockResolvedValue(true);
    await save(false);
    expect(dependencies.toast.success).toHaveBeenCalledOnce();
    expect(dependencies.clearDraft).toHaveBeenCalledOnce();
    expect(dependencies.setSaveProjectDialogOpen).toHaveBeenCalledExactlyOnceWith(false);
  });
});
