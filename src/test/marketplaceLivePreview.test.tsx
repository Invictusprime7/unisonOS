import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MarketplaceTemplateShowcase } from '@/marketplace/MarketplaceTemplateShowcase';
import { AUTHORED_MARKETPLACE_TEMPLATES } from '@/marketplace/authoredTemplatePreviews';

// Contract for the authored concept showcase. Real registry-backed candidate VFS
// output is covered by marketplaceTemplateCuration.test.ts; certified release
// previews will be covered by release-artifact tests once artifacts exist.
describe('Marketplace concept previews', () => {
  afterEach(cleanup);

  it('labels authored designs as concept previews, never certified releases', () => {
    render(<MemoryRouter><MarketplaceTemplateShowcase /></MemoryRouter>);
    const section = screen.getByRole('region', { name: 'Designed for a point of view' });
    expect(within(section).getByText('Concept previews')).toBeInTheDocument();
    expect(within(section).getByText(/installed as editable project drafts/i)).toBeInTheDocument();
    expect(within(section).getByText(/not real client endorsements/i)).toBeInTheDocument();
  });

  it('offers no price, purchase, claim, or install action for concepts', () => {
    render(<MemoryRouter><MarketplaceTemplateShowcase /></MemoryRouter>);
    const section = screen.getByRole('region', { name: 'Designed for a point of view' });
    expect(within(section).queryByText(/\$\d/)).not.toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: /buy|purchase|claim|install|checkout/i })).not.toBeInTheDocument();
  });

  it('opens a concept in a dialog labelled concept preview only, with device toggle', () => {
    render(<MemoryRouter><MarketplaceTemplateShowcase /></MemoryRouter>);
    const template = AUTHORED_MARKETPLACE_TEMPLATES[0];
    fireEvent.click(screen.getByRole('button', { name: `Preview ${template.name}` }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Concept preview only/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Install as draft' })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mobile preview' }));
    expect(within(dialog).getByRole('button', { name: 'Mobile preview' })).toBeInTheDocument();
  });
});
