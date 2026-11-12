import { beforeEach, describe, expect, it, vi } from 'vitest';

const commitMutation = vi.fn();
vi.mock('@/services/vfsCommitService', () => ({ commitMutation: (...args: unknown[]) => commitMutation(...args) }));

import { convertLegacyProject, LegacyConversionError, standaloneSourceFromPreview, stripPreviewLocators } from '@/services/source-authoring/convertLegacyProject';

const compiled = {
  sandpackFiles: {
    '/index.html': '<!doctype html><html><head><title>Preview</title><script src="https://cdn.tailwindcss.com"></script></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
    '/index.tsx': "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nReactDOM.createRoot(document.getElementById('root')!).render(<App />);\n",
    '/App.tsx': 'export default function App() { return <main data-ut-source-locator="/src/App.tsx:1:30" data-ut-source-ast="a1" data-ut-source-hash="h1" data-ut-source-revision="rev-1"><h1>Salon</h1></main>; }\n',
    '/package.json': JSON.stringify({ dependencies: { react: '^18.3.1' } }),
    '/.unison/runtime-manifest.json': '{}',
  },
  dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1', 'lucide-react': '0.545.0' },
};

describe('convert on open: standalone source from the rendered preview', () => {
  it('removes preview-only selection markers and nothing else', () => {
    expect(stripPreviewLocators(compiled.sandpackFiles['/App.tsx'])).toBe('export default function App() { return <main><h1>Salon</h1></main>; }\n');
  });

  it('starts the page from the preview entry and keeps the Tailwind runtime', () => {
    const files = standaloneSourceFromPreview(compiled, 'Bloom Salon');
    expect(files['/index.html']).toContain('<script type="module" src="/index.tsx"></script>');
    expect(files['/index.html']).not.toContain('/src/main.tsx');
    expect(files['/index.html']).toContain('https://cdn.tailwindcss.com');
    expect(files['/index.html']).toContain('<title>Bloom Salon</title>');
    expect(files['/.unison/runtime-manifest.json']).toBeUndefined();
    const pkg = JSON.parse(files['/package.json']);
    expect(pkg.dependencies).toEqual({ 'lucide-react': '0.545.0', react: '^18.3.1', 'react-dom': '^18.3.1' });
    expect(pkg.devDependencies.vite).toBeDefined();
    expect(files['/vite.config.ts']).toContain("'@'");
    expect(standaloneSourceFromPreview(compiled, 'Bloom Salon')).toEqual(files);
  });
});

describe('convert on open: saving', () => {
  beforeEach(() => commitMutation.mockReset().mockResolvedValue({ status: 'committed', persistedRevisionId: 'rev-2', vfsFiles: {} }));
  const identity = { userId: 'u1', businessId: 'b1', projectId: 'p1', draftId: 'd1', revisionId: 'rev-1', sessionId: 's1' };
  const currentFiles = { '/src/App.tsx': 'old', '/src/main.tsx': 'old', '/App.tsx': 'old root' };

  it('saves once through commitMutation, parented on the older revision, replacing every older file', async () => {
    await convertLegacyProject({ identity, currentFiles, compiled, projectName: 'Bloom Salon' });
    expect(commitMutation).toHaveBeenCalledTimes(1);
    const call = commitMutation.mock.calls[0][0];
    expect(call.identity.revisionId).toBe('rev-1');
    expect(call.options).toMatchObject({ acceptanceProfile: 'imported-source', sourceConversion: true });
    const ops = call.patch.fileOps as Array<{ type: string; path: string; contents?: string }>;
    expect(ops.filter((op) => op.type === 'delete').map((op) => op.path).sort()).toEqual(['/src/App.tsx', '/src/main.tsx']);
    expect(ops.find((op) => op.path === '/App.tsx')?.type).toBe('replace');
    const provenance = JSON.parse(ops.find((op) => op.path === '/.unison-import/provenance.json')!.contents!);
    expect(provenance).toMatchObject({ origin: 'affinity-authored', convertedFromRevisionId: 'rev-1' });
  });

  it('never saves when the converted site does not build', async () => {
    await expect(convertLegacyProject({ identity, currentFiles, compiled, projectName: 'Bloom', buildCheck: async () => ({ ok: false, errors: [{ message: 'boom' }] }) }))
      .rejects.toThrow(/did not build: boom/);
    expect(commitMutation).not.toHaveBeenCalled();
  });

  it('refuses a site that is already a source project or has no saved version', async () => {
    const imported = { '/.unison-import/provenance.json': '{"origin":"affinity-authored"}' };
    await expect(convertLegacyProject({ identity, currentFiles: imported, compiled, projectName: 'x' })).rejects.toBeInstanceOf(LegacyConversionError);
    await expect(convertLegacyProject({ identity: { ...identity, revisionId: '' }, currentFiles, compiled, projectName: 'x' })).rejects.toBeInstanceOf(LegacyConversionError);
    expect(commitMutation).not.toHaveBeenCalled();
  });
});
