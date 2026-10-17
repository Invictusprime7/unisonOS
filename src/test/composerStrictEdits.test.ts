import { describe, expect, it } from 'vitest';
import { parseFileBlocks, isPageCreationRequest } from '../../supabase/functions/ai-code-assistant/composerLane';
import { selectSourceKnowledgeWithReport, scopeForInstruction } from '@/services/builder/sourceKnowledgeContext';

describe('deterministic scoped edits', () => {
  const files = { '/src/pages/Home.tsx': 'a\nb\nc' };
  it('accepts a whole-file replace of an existing file (candidate gates verify it)', () => {
    const parsed = parseFileBlocks('<<<FILE create /src/pages/Home.tsx\nx\n>>>END', files, true) as { fileOps: Array<{ type: string; path: string }> };
    expect(parsed.fileOps[0]).toMatchObject({ type: 'replace', path: '/src/pages/Home.tsx' });
  });
  it('applies EDIT hunks and allows creating new files', () => {
    const out = parseFileBlocks('<<<EDIT /src/pages/Home.tsx\n<<<<<<< SEARCH\nb\n=======\nB\n>>>>>>> REPLACE\n>>>END\n<<<FILE create /src/pages/New.tsx\nn\n>>>END', files, true) as { fileOps: Array<{ path: string; content: string }> };
    expect(out.fileOps.find((o) => o.path === '/src/pages/Home.tsx')?.content).toBe('a\nB\nc');
    expect(out.fileOps.some((o) => o.path === '/src/pages/New.tsx')).toBe(true);
  });
  it('detects page creation requests', () => {
    expect(isPageCreationRequest('Create pages for the new footer links: Specialties')).toBe(true);
    expect(isPageCreationRequest('make the navbar float')).toBe(false);
  });
  it('scoped reads skip theme, package and transitive imports', () => {
    const src = {
      '/src/pages/Home.tsx': "import { A } from './A';",
      '/src/pages/A.tsx': "import { B } from './B'; export const A = 1;",
      '/src/pages/B.tsx': 'export const B = 1;',
      '/src/index.css': ':root{}', '/package.json': '{}',
    };
    const r = selectSourceKnowledgeWithReport(src, ['/src/pages/Home.tsx'], 140_000, scopeForInstruction('change the heading'));
    expect(Object.keys(r.files).sort()).toEqual(['/src/pages/A.tsx', '/src/pages/Home.tsx']);
    const t = selectSourceKnowledgeWithReport(src, ['/src/pages/Home.tsx'], 140_000, scopeForInstruction('change the brand colour'));
    expect(t.files['/src/index.css']).toBeDefined();
  });
});
