import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Web Builder preview ownership', () => {
  it('applies device widths to the actual Sandpack layout', () => {
    const source = ts.createSourceFile('VFSPreview.tsx', readSource('src/components/VFSPreview.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let styleExpression: ts.Expression | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) && node.tagName.getText(source) === 'SandpackLayout') {
        const style = node.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'style');
        if (style && ts.isJsxAttribute(style) && style.initializer && ts.isJsxExpression(style.initializer)) {
          styleExpression = style.initializer.expression;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(styleExpression).toBeDefined();
    const resolveStyle = new Function('device', `return (${styleExpression!.getText(source)});`);
    for (const [device, width] of [['desktop', '100%'], ['tablet', '768px'], ['mobile', '375px']]) {
      expect(resolveStyle(device)).toMatchObject({ width, maxWidth: '100%', height: '100%', marginInline: 'auto' });
    }
  });

  it('keeps SandpackProvider and the builder preview mount in one owner', () => {
    const sharedPreview = readSource('src/components/VFSPreview.tsx');
    const codeView = readSource('src/components/creatives/code-editor/VFSCodeView.tsx');
    const builder = readSource('src/components/creatives/WebBuilder.tsx');

    expect(sharedPreview).toContain('<SandpackProvider');
    expect(builder.match(/<VFSPreview(?:\s|>)/g)).toHaveLength(1);
    expect(codeView).not.toContain('<VFSPreview');
    expect(codeView).not.toContain('<SandpackProvider');
    expect(codeView).not.toContain('function InlinePreview');
    expect(builder).toContain("(viewMode === 'canvas' || viewMode === 'split')");
    expect(builder).toContain("ref={viewMode === 'split' ? splitViewDropZoneRef : scrollContainerRef}");
  });

  it('threads VFS imports and remounts only when the dependency signature changes', () => {
    const sharedPreview = readSource('src/components/VFSPreview.tsx');
    const builder = readSource('src/components/creatives/WebBuilder.tsx');

    expect(sharedPreview).toContain('dependencySignatureRef');
    expect(sharedPreview).toContain('if (previewCompiling) return;');
    expect(sharedPreview).toContain('if (!hasCompiledPreview) {');
    expect(sharedPreview).toContain('dependencySignatureRef.current = null;');
    expect(sharedPreview).toContain('syncIntoOwner(snapshot)');
    expect(sharedPreview).toContain('importIntoOwner(changedFiles)');
    expect(builder.match(/onImportFiles=\{templateCustomizer\.isDirty \? undefined : virtualFS\.importFiles\}/g)).toHaveLength(1);
    expect(builder.match(/onSyncFiles=\{templateCustomizer\.isDirty \? undefined : virtualFS\.replaceFiles\}/g)).toHaveLength(1);
  });

  it('adopts accepted revision files atomically so Preview recompiles from the complete VFS', () => {
    const sharedPreview = readSource('src/components/VFSPreview.tsx');
    const builder = readSource('src/components/creatives/WebBuilder.tsx');

    expect(builder).toContain('if (options?.replace) vfsReplaceFiles(preflightedFiles);');
    expect(builder).not.toContain('if (options?.replace) vfsResetToEmpty();');
    expect(sharedPreview).toContain('const filesSignature = useMemo(() => createVfsHandoffSignature(rawFiles)');
    expect(sharedPreview).toContain('pendingCompileRef.current = { key, files, launchState: launchRef.current };');
  });

  it('keeps the connected Sandpack provider mounted during background recompiles', () => {
    const sharedPreview = readSource('src/components/VFSPreview.tsx');

    expect(sharedPreview).toContain('const hasCompiledPreview = Object.keys(sandpackFiles).length > 0;');
    expect(sharedPreview).toContain('(!previewCompiling || hasCompiledPreview)');
    expect(sharedPreview).toContain('const sandpackProviderOptions = useMemo(');
    expect(sharedPreview).toContain('const sandpackCustomSetup = useMemo(');
    expect(sharedPreview).toContain('options={sandpackProviderOptions}');
    expect(sharedPreview).toContain('customSetup={sandpackCustomSetup}');
    expect(sharedPreview).toContain("initMode: 'immediate' as const");
    expect(sharedPreview).not.toContain('customSetup={{');
  });

  it('accepts async compile results after the StrictMode remount cycle', () => {
    const sharedPreview = readSource('src/components/VFSPreview.tsx');

    expect(sharedPreview).toContain('unmountedRef.current = false;');
    expect(sharedPreview).toContain('unmountedRef.current = true;');
    expect(sharedPreview).toContain('PREVIEW_ARTIFACT_COMPILE_TIMEOUT_MS = 180_000');
    expect(sharedPreview).toContain("compileController.abort(new Error('Preview artifact compilation timed out after 180 seconds.'))");
    expect(sharedPreview).toContain('signal: compileController.signal');
    expect(sharedPreview).toContain('compileAttemptRef.current !== compileAttempt');
    expect(sharedPreview).toContain('pendingCompileRef.current = request;');
    expect(sharedPreview).toContain('attemptWasInvalidated');
    expect(sharedPreview).toContain("pipelineError?.message.includes('did not respond within 30 seconds')");
    expect(sharedPreview).toContain('onRetry={retryArtifactCompile}');
    expect(sharedPreview).toMatch(/pipelineError: null,\s+emptyDraft: false,\s+compiling: true/);
  });

  it('queues hydration updates without invalidating the first paint', () => {
    const sharedPreview = readSource('src/components/VFSPreview.tsx');

    expect(sharedPreview).toContain('pendingCompileRef');
    expect(sharedPreview).toContain('if (inFlightKeyRef.current) return;');
    expect(sharedPreview).toContain('pendingCompileRef.current = { key, files, launchState: launchRef.current };');
    expect(sharedPreview).not.toContain('latestKeyRef.current !== compileKey');
    expect(sharedPreview).not.toContain("Object.keys(launch?.siteBundleSnapshot?.vfsFiles || {}).length");
  });

  it('does not republish byte-identical canonical router source during hydration', () => {
    const builder = readSource('src/components/creatives/WebBuilder.tsx');

    expect(builder).toContain('currentFiles[launchEntryPoint] !== result.routerCode');
    expect(builder).toContain('virtualFS.importFiles(filesToImport)');
  });

  it('runs the controlled index mount module instead of the unmounted App export', () => {
    const sharedPreview = readSource('src/components/VFSPreview.tsx');

    expect(sharedPreview).toContain("const controlledEntries = ['/index.tsx', '/index.jsx'];");
    expect(sharedPreview.indexOf("const controlledEntries = ['/index.tsx', '/index.jsx'];"))
      .toBeLessThan(sharedPreview.indexOf("if (sandpackFiles['/App.tsx']) return '/App.tsx';"));
  });

  it('bootstraps Tailwind utilities from the controlled Sandpack entry', () => {
    const filePrep = readSource('src/utils/sandpackFilePrep.ts');

    expect(filePrep).toContain("source.type = 'text/tailwindcss';");
    expect(filePrep).toContain("source.textContent = '@tailwind base; @tailwind components; @tailwind utilities;';");
    expect(filePrep).toContain("loader.src = 'https://cdn.tailwindcss.com';");
    expect(filePrep).toContain('void __loadTailwindUtilities().finally(__mountPreview);');
  });

  it('normalizes hash-style nav.goto targets into site routes, not page fragments', () => {
    const filePrep = readSource('src/utils/sandpackFilePrep.ts');

    expect(filePrep).toContain("navPath.startsWith('#')");
    expect(filePrep).toContain(String.raw`navPath.replace(/^#\\/?/, '')`);
    expect(filePrep).toContain('window.location.hash = route;');
  });

  it('keeps the deployed Sandpack dependency-module progress surface in the preview corner', () => {
    const sharedPreview = readSource('src/components/VFSPreview.tsx');
    const viteConfig = readSource('vite.config.ts');

    expect(sharedPreview).toContain('useSandpackPreviewProgress({ timeout: 3000 })');
    expect(sharedPreview).toContain('window.setTimeout(() => setShowInitialInstall(false), 4000)');
    expect(sharedPreview).toContain("sandpack.status === 'initial' && showInitialInstall");
    expect(sharedPreview).toContain("? 'Installing preview modules'");
    expect(sharedPreview).not.toContain('sandpack-bundler.codesandbox.io');
    expect(sharedPreview).not.toContain('sandpack.codesandbox.io');
    const middleware = readSource('middleware.ts');
    expect(sharedPreview).toContain("bundlerURL: new URL('/sandpack/index.html', window.location.origin).toString()");
    expect(sharedPreview).toContain('bundlerTimeOut: 120_000');
    expect(sharedPreview).toContain('startRoute="/sandpack/index.html"');
    expect(sharedPreview).toContain("if (status === 'timeout')");
    expect(sharedPreview).toContain('MAX_SANDPACK_TIMEOUT_RECOVERIES = 3');
    expect(sharedPreview).toContain('timeoutRecoveryCountRef.current >= MAX_SANDPACK_TIMEOUT_RECOVERIES');
    expect(sharedPreview).toContain('setSandpackKey((key) => key + 1);');
    expect(sharedPreview).toContain('onRunning={handleSandpackRunning}');
    expect(sharedPreview).toContain('Preview runner did not connect');
    expect(sharedPreview).toContain('Retry Preview');
    expect(viteConfig).toContain("request.headers.referer?.includes('/web-builder')");
    expect(middleware).toContain("request.headers.get('referer')?.includes('/web-builder')");
    expect(middleware).toContain("rewrite(new URL('/sandpack/index.html', request.url))");
    expect(sharedPreview).toContain('absolute bottom-3 left-3');
    expect(sharedPreview).toContain('({dependencyCount} modules)');
    expect(sharedPreview).toContain('<SandpackDependencyProgress dependencyCount={Object.keys(sandpackDeps).length} />');
  });

  it('keeps template thumbnails painted but non-executable', () => {
    const thumbnail = readSource('src/components/creatives/web-builder/TemplatePreviewThumbnail.tsx');

    expect(thumbnail).not.toContain('<iframe');
    expect(thumbnail).toContain('template thumbnail');
  });
});
