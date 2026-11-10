import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { importExternalProject, prepareImportedProjectHandoff, navigate } = vi.hoisted(() => ({
  importExternalProject: vi.fn(),
  prepareImportedProjectHandoff: vi.fn(() => ({ projectId: 'p1' })),
  navigate: vi.fn(),
}));
vi.mock('@/services/import/externalProjectImport', () => ({ importExternalProject }));
vi.mock('@/services/import/importHandoff', async (orig) => ({ ...(await orig<typeof import('@/services/import/importHandoff')>()), prepareImportedProjectHandoff }));
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AffinityImportDropZone } from '@/components/import/AffinityImportDropZone';

type Entry = { isFile: boolean; isDirectory: boolean; name: string; fullPath: string; file?: (ok: (f: File) => void) => void; createReader?: () => { readEntries: (ok: (e: Entry[]) => void) => void } };
const fileEntry = (fullPath: string, body = 'x'): Entry => ({ isFile: true, isDirectory: false, name: fullPath.split('/').pop()!, fullPath, file: (ok) => ok(new File([body], fullPath.split('/').pop()!)) });
const dirEntry = (fullPath: string, children: Entry[]): Entry => {
  let served = false;
  return { isFile: false, isDirectory: true, name: fullPath.split('/').pop()!, fullPath, createReader: () => ({ readEntries: (ok) => { ok(served ? [] : children); served = true; } }) };
};
const transfer = (entries: Entry[], files: File[] = []) => ({
  types: ['Files'],
  files,
  items: entries.map((entry) => ({ kind: 'file', webkitGetAsEntry: () => entry })),
  dropEffect: 'none',
});

function renderZone(signedIn = true, onAuthRequired = vi.fn()) {
  render(<MemoryRouter><AffinityImportDropZone signedIn={signedIn} onAuthRequired={onAuthRequired} businessId="biz-1"><p>Affinity chat</p></AffinityImportDropZone></MemoryRouter>);
  return { zone: screen.getByTestId('affinity-import-drop-zone'), onAuthRequired };
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Affinity chat drag-and-drop import', () => {
  it('imports a dropped folder unchanged, keeping folder paths and skipping dependency folders, then opens the builder', async () => {
    importExternalProject.mockResolvedValue({ fileCount: 2, provenance: { readiness: { runtimeCompatibility: 'supported' } } });
    const { zone } = renderZone();
    const folder = dirEntry('/site', [fileEntry('/site/index.html'), dirEntry('/site/css', [fileEntry('/site/css/site.css')]), dirEntry('/site/node_modules', [fileEntry('/site/node_modules/x.js')])]);
    fireEvent.dragEnter(zone, { dataTransfer: transfer([folder]) });
    expect(screen.getByText('Drop to import your project')).toBeInTheDocument();
    fireEvent.drop(zone, { dataTransfer: transfer([folder]) });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/web-builder', { replace: true, state: { projectId: 'p1' } }));
    const [input, options] = importExternalProject.mock.calls[0];
    expect(input.kind).toBe('files');
    expect(input.relativePaths).toEqual(['site/index.html', 'site/css/site.css']);
    expect(options.businessId).toBe('biz-1');
  });

  it('imports a single dropped .zip as an archive', async () => {
    importExternalProject.mockResolvedValue({ fileCount: 5, provenance: { readiness: { runtimeCompatibility: 'blocked' } } });
    const { zone } = renderZone();
    fireEvent.drop(zone, { dataTransfer: transfer([fileEntry('/site.zip')], [new File(['PK'], 'site.zip')]) });
    await waitFor(() => expect(importExternalProject).toHaveBeenCalled());
    expect(importExternalProject.mock.calls[0][0].kind).toBe('zip');
  });

  it('asks a signed-out visitor to sign in instead of importing', () => {
    const { zone, onAuthRequired } = renderZone(false);
    fireEvent.drop(zone, { dataTransfer: transfer([fileEntry('/index.html')], [new File(['x'], 'index.html')]) });
    expect(onAuthRequired).toHaveBeenCalled();
    expect(importExternalProject).not.toHaveBeenCalled();
  });
});
