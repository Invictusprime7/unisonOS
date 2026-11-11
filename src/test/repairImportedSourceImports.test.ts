import { afterEach, describe, expect, it, vi } from 'vitest';

const { edit, commitMutation } = vi.hoisted(() => ({
  edit: vi.fn(),
  commitMutation: vi.fn(),
}));

vi.mock('@/services/app-builder/UnisonAppBuilder', () => ({
  unisonAppBuilder: { edit },
}));
vi.mock('@/services/vfsCommitService', () => ({ commitMutation }));

import { repairImportedSourceImports } from '@/services/import/repairImportedSourceImports';
import { IMPORT_ASSETS_PATH, IMPORT_MANIFEST_PATH, IMPORT_PROFILE_PATH, IMPORT_PROVENANCE_PATH } from '@/services/import/importedSourceRecords';
import type { ImportCompatibilityProfile } from '@/services/import/importCompatibilityProfile';
import { resolveLocalImport } from '@/services/builder/aiCandidateGates';
import { selectSourceKnowledgeWithReport } from '@/services/builder/sourceKnowledgeContext';

const appPath = '/src/App.tsx';
const componentPath = '/src/components/Header.tsx';

function importedFiles(): Record<string, string> {
  return {
    [appPath]: "import Header from './Missing';\nexport default Header;",
    [componentPath]: 'export default function Header(){ return null; }',
    [IMPORT_PROVENANCE_PATH]: JSON.stringify({ origin: 'external-import', acceptanceProfile: 'imported-source' }),
    [IMPORT_MANIFEST_PATH]: JSON.stringify({ files: [
      { path: 'src/App.tsx', storage: 'text', sha256: 'original' },
      { path: 'src/components/Header.tsx', storage: 'text', sha256: 'header' },
    ] }),
    [IMPORT_PROFILE_PATH]: JSON.stringify({ aliases: {} }),
    [IMPORT_ASSETS_PATH]: JSON.stringify({ assets: [] }),
  };
}

const profile = { framework: 'vite-react', aliases: {} } as ImportCompatibilityProfile;

afterEach(() => vi.clearAllMocks());

describe('repairImportedSourceImports', () => {
  it('resolves framework aliases against the imported project profile', () => {
    expect(resolveLocalImport('/app/routes/index.tsx', '@/components/Header', {
      '/app/components/Header.tsx': 'export default null;',
    }, { '@/*': 'app/*' })).toBe('/app/components/Header.tsx');
  });

  it('includes existing aliased imports in Affinity source context', () => {
    const files = {
      ...importedFiles(),
      '/app/routes/index.tsx': "import Header from '@/components/Header';",
      '/app/components/Header.tsx': 'export default function Header(){ return null; }',
      [IMPORT_PROFILE_PATH]: JSON.stringify({ aliases: { '@/*': 'app/*' } }),
    };
    const report = selectSourceKnowledgeWithReport(files, ['/app/routes/index.tsx'], 10_000, { scoped: true });

    expect(report.unresolvedImports).toEqual([]);
    expect(report.files['/app/components/Header.tsx']).toBe(files['/app/components/Header.tsx']);
  });

  it('uses Affinity for unresolved local imports and saves fixes as a new imported-source revision', async () => {
    const files = importedFiles();
    const repaired = { ...files, [appPath]: "import Header from './components/Header';\nexport default Header;" };
    edit.mockResolvedValue({
      candidate: { status: 'ready-for-commit' },
      changeSet: { fileOps: [{ type: 'replace', path: appPath }] },
      candidateFiles: repaired,
    });
    commitMutation.mockResolvedValue({ status: 'committed', persistedRevisionId: 'revision-2', vfsFiles: repaired });

    const result = await repairImportedSourceImports({
      userId: 'user-1', businessId: 'business-1', projectId: 'project-1', draftId: 'draft-1',
      revisionId: 'revision-1', projectName: 'Imported site', profile, files,
    });

    expect(edit).toHaveBeenCalledWith(expect.objectContaining({
      importedSource: true,
      baseRevisionId: 'revision-1',
      sourceTargets: [appPath],
    }));
    expect(commitMutation).toHaveBeenCalledWith(expect.objectContaining({
      source: 'ai-builder',
      identity: expect.objectContaining({ revisionId: 'revision-1' }),
      options: expect.objectContaining({ acceptanceProfile: 'imported-source' }),
    }));
    expect(result).toMatchObject({
      revisionId: 'revision-2',
      repairedFiles: [appPath],
      resolvedImports: 1,
      unresolvedImports: 0,
    });
    expect(result.files[IMPORT_PROVENANCE_PATH]).toBe(files[IMPORT_PROVENANCE_PATH]);
  });

  it('keeps the original revision when Affinity cannot produce a repair', async () => {
    const files = importedFiles();
    edit.mockRejectedValue(new Error('Affinity unavailable'));

    const result = await repairImportedSourceImports({
      userId: 'user-1', businessId: 'business-1', projectId: 'project-1', draftId: 'draft-1',
      revisionId: 'revision-1', projectName: 'Imported site', profile, files,
    });

    expect(result.files).toEqual(files);
    expect(result.revisionId).toBe('revision-1');
    expect(result.error).toBe('Affinity unavailable');
    expect(commitMutation).not.toHaveBeenCalled();
  });
});