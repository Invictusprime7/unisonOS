import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExportDialog } from '@/components/creatives/design-studio/ExportDialog';

const mocks = vi.hoisted(() => ({ exportSourceProject: vi.fn(), downloadBlob: vi.fn() }));
vi.mock('@/services/export/exportSourceProject', () => mocks);

describe('ExportDialog', () => {
  it('shows the canonical archive metadata and real preflight warnings', async () => {
    mocks.exportSourceProject.mockResolvedValue({
      blob: new Blob(),
      fileName: 'esteem-site-source.zip',
      fileCount: 24,
      preflight: {
        schemaVersion: 'unison-export-preflight/1',
        passed: true,
        entryPoint: '/src/main.tsx',
        issues: [],
        warnings: [{ code: 'lockfile-missing' }],
      },
    });

    render(
      <ExportDialog
        open
        onOpenChange={vi.fn()}
        html="<main>Preview</main>"
        css="main { color: black; }"
        projectName="Esteem Site"
        vfsFiles={{ '/src/main.tsx': 'export {};' }}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('project-manifest.json')).toBeInTheDocument();
    expect(screen.getByText(/No project-specific lockfile is generated/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'HTML/CSS/JS' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'HTML' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Download .zip' }));
    await waitFor(() => expect(mocks.downloadBlob).toHaveBeenCalled());
    expect(await screen.findByText(/No project-specific lockfile is included/)).toBeInTheDocument();
  });

  it('retains snippet formats when no canonical VFS is available', () => {
    render(
      <ExportDialog
        open
        onOpenChange={vi.fn()}
        html="<main>Preview</main>"
        css="main { color: black; }"
      />,
    );

    expect(screen.getByRole('button', { name: 'HTML/CSS/JS' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'HTML' })).toBeInTheDocument();
    expect(screen.queryByText('project-manifest.json')).toBeNull();
  });
});