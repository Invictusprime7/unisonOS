import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALL_COMPOSITIONS } from '@/sections/templates';
import { ART_DIRECTION_PACKS } from '@/sections/variants/artDirectionPacks';

vi.mock('@/components/VFSPreview', () => ({
  VFSPreview: ({ files, device }: { files: Record<string, string>; device: string }) => (
    <div data-testid="live-vfs-preview" data-device={device}>
      <pre data-testid="preview-page-source">{files['/src/pages/Home.tsx']}</pre>
      <pre data-testid="preview-root-app">{files['/src/App.tsx']}</pre>
      <pre data-testid="preview-base-css">{files['/src/index.css']}</pre>
    </div>
  ),
}));

import { MarketplaceTemplateShowcase } from '@/marketplace/MarketplaceTemplateShowcase';

describe('Marketplace live template previews', () => {
  afterEach(cleanup);

  it('renders a real registry composition in the isolated live preview', async () => {
    const template = ALL_COMPOSITIONS[0];
    render(<MarketplaceTemplateShowcase />);

    expect(screen.getByRole('heading', { name: 'Live template previews' })).toBeInTheDocument();
    expect(screen.getByText('Certified marketplace releases', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Template category' })).toHaveClass('rounded-none');
    expect(screen.getByRole('searchbox', { name: 'Search previews' })).toHaveClass('rounded-none');
    expect(screen.getByRole('combobox', { name: 'Style card' })).toHaveClass('rounded-none');
    expect(screen.getByRole('combobox', { name: 'Art direction' })).toHaveClass('rounded-none');

    fireEvent.click(screen.getByRole('button', { name: `Preview ${template.name} live` }));

    expect(await screen.findByTestId('live-vfs-preview')).toHaveAttribute('data-device', 'desktop');
    const renderedSource = screen.getByTestId('preview-page-source').textContent ?? '';
    expect(renderedSource).toContain('const SECTIONS =');
    expect(renderedSource).toContain(template.id);
    expect(screen.getByTestId('preview-root-app')).toHaveTextContent("import Page from './pages/Home'");
    expect(screen.getByTestId('preview-base-css').textContent).toContain('ART DIRECTION:');

    fireEvent.change(screen.getByRole('combobox', { name: 'Art direction' }), { target: { value: 'glass-tech' } });
    expect(screen.getByTestId('preview-base-css').textContent).toContain(`ART DIRECTION: ${ART_DIRECTION_PACKS['glass-tech'].name}`);

    fireEvent.click(screen.getByRole('button', { name: 'Mobile preview' }));
    expect(screen.getByTestId('live-vfs-preview')).toHaveAttribute('data-device', 'mobile');
  });
});