import { beforeEach, describe, expect, it, vi } from 'vitest';

const updates: Array<{ metadata: Record<string, unknown>; id: string }> = [];
const commits: Array<Record<string, string>> = [];
let refuseAffinityLabel = true;

vi.mock('@/integrations/supabase/client', () => {
  const from = () => ({
    insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'draft-1', project_id: 'project-1' }, error: null }) }) }),
    update: (values: { metadata: Record<string, unknown> }) => ({
      eq: async (_column: string, id: string) => { updates.push({ metadata: values.metadata, id }); return { error: null }; },
    }),
  });
  return { supabase: { from, auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) } } };
});

vi.mock('@/services/import/externalProjectImport', () => ({
  resolveImportBusinessId: async () => 'business-1',
}));

vi.mock('@/services/source-authoring/affinitySourceAuthor', () => ({
  authorSourceProject: async () => ({
    summary: 'A bold events site',
    pages: [{ path: '/src/pages/Index.tsx' }],
    files: {
      '/package.json': JSON.stringify({ name: 'site', dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' }, devDependencies: { vite: '^5.4.0' } }),
      '/index.html': '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
      '/src/main.tsx': "import { createRoot } from 'react-dom/client';\nimport App from './App';\ncreateRoot(document.getElementById('root')!).render(<App />);\n",
      '/src/App.tsx': 'export default function App() { return <main>Hello</main>; }\n',
    },
  }),
}));

vi.mock('@/services/vfsCommitService', () => ({
  commitMutation: async (input: { patch: { files?: Array<{ path: string; content: string }> } & Record<string, unknown> }) => {
    const files: Record<string, string> = {};
    const ops = (input.patch as { fileOps?: Array<{ path: string; content?: string }> }).fileOps ?? [];
    for (const op of ops) if (typeof op.content === 'string') files[op.path] = op.content;
    commits.push(files);
    const provenance = JSON.parse(files['/.unison-import/provenance.json'] ?? '{}');
    if (refuseAffinityLabel && provenance.origin === 'affinity-authored') {
      throw new Error('[VFSCommitService] canonical revision transaction failed: Imported source acceptance profile is invalid');
    }
    return { status: 'committed', persistedRevisionId: `rev-${commits.length}`, vfsFiles: files };
  },
}));

import { createAffinitySourceProject, isOlderSourceProjectSaveRule } from '@/services/source-authoring/createAffinitySourceProject';

describe('Affinity site save against the older live save rule', () => {
  beforeEach(() => { updates.length = 0; commits.length = 0; refuseAffinityLabel = true; });

  it('recognises only the older rule refusals', () => {
    expect(isOlderSourceProjectSaveRule(new Error('canonical revision transaction failed: Imported source acceptance profile is invalid'))).toBe(true);
    expect(isOlderSourceProjectSaveRule(new Error('Imported source provenance identity is invalid'))).toBe(true);
    expect(isOlderSourceProjectSaveRule(new Error('Imported source revision conflict: draft pointer changed before commit'))).toBe(false);
  });

  it('keeps the site by saving under the older label when the live rule refuses Affinity-written sites', async () => {
    const result = await createAffinitySourceProject({ prompt: 'events venue', projectName: 'Venue' });
    expect(result.revisionId).toBe('rev-2');
    expect(commits).toHaveLength(2);
    expect(updates).toEqual([{ id: 'draft-1', metadata: expect.objectContaining({ source: 'external-import', authoredBy: 'affinity', acceptanceProfile: 'imported-source' }) }]);
    const saved = JSON.parse(commits[1]['/.unison-import/provenance.json']);
    expect(saved.origin).toBe('external-import');
    expect(saved.authoredBy).toBe('affinity');
    expect(result.provenance.authoredBy).toBe('affinity');
    // Same written source both times; only the records change.
    expect(commits[1]['/src/App.tsx']).toBe(commits[0]['/src/App.tsx']);
  });

  it('saves once with the Affinity label when the live rule accepts it', async () => {
    refuseAffinityLabel = false;
    const result = await createAffinitySourceProject({ prompt: 'events venue', projectName: 'Venue' });
    expect(result.revisionId).toBe('rev-1');
    expect(updates).toHaveLength(0);
    expect(JSON.parse(commits[0]['/.unison-import/provenance.json']).origin).toBe('affinity-authored');
  });
});
