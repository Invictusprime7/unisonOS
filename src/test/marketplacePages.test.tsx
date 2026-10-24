import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { PublicMarketplaceListing } from '@/marketplace/contracts';

const listPublicMarketplaceListings = vi.hoisted(() => vi.fn());
vi.mock('@/marketplace/listingService', () => ({ listPublicMarketplaceListings }));
vi.mock('@/marketplace/stageReleaseClient', () => ({ loadMarketplaceReleasePreview: vi.fn().mockRejectedValue(new Error('none')) }));

import Marketplace from '@/pages/Marketplace';
import MarketplaceListing from '@/pages/MarketplaceListing';

const listing: PublicMarketplaceListing = {
  id: 'listing-1',
  slug: 'editorial-salon',
  productType: 'site_template',
  title: 'Editorial Salon',
  industryKey: 'salon',
  summary: 'A site template for a salon.',
  priceCents: 4900,
  currency: 'usd',
  currentReleaseId: 'release-1',
  createdAt: '2026-10-22T12:00:00.000Z',
  updatedAt: '2026-10-22T12:00:00.000Z',
};

function renderBrowse(path = '/marketplace') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/marketplace" element={<Marketplace />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDetail(path = '/marketplace/editorial-salon') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/marketplace/:slug" element={<MarketplaceListing />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('marketplace public pages', () => {
  beforeEach(() => {
    listPublicMarketplaceListings.mockReset();
  });
  afterEach(cleanup);

  it('shows an honest empty catalog state', async () => {
    listPublicMarketplaceListings.mockResolvedValue([]);
    renderBrowse();

    expect(await screen.findByText('No templates published yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth?next=%2Fmarketplace');
  });

  it('restores URL filters and uses server-side industry/product filters', async () => {
    listPublicMarketplaceListings.mockResolvedValue([listing]);
    renderBrowse('/marketplace?q=editorial&industry=salon&type=site_template');

    expect(await screen.findByRole('link', { name: /View details/ })).toHaveAttribute(
      'href',
      '/marketplace/editorial-salon',
    );
    expect(screen.getByRole('searchbox', { name: 'Search marketplace' })).toHaveValue('editorial');
    expect(screen.getByRole('combobox', { name: 'Product type' })).toHaveValue('site_template');
    expect(listPublicMarketplaceListings).toHaveBeenCalledWith({
      industryKey: 'salon',
      productType: 'site_template',
      limit: 60,
    });
  });

  it('loads listing details but keeps install unavailable before certified preview exists', async () => {
    listPublicMarketplaceListings.mockResolvedValue([listing]);
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Editorial Salon' })).toBeInTheDocument();
    expect(screen.getByText('Certified preview unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Install unavailable' })).toBeDisabled();
    expect(listPublicMarketplaceListings).toHaveBeenCalledWith({ slug: 'editorial-salon', limit: 1 });
  });

  it('shows not-found for a slug absent from the public view', async () => {
    listPublicMarketplaceListings.mockResolvedValue([]);
    renderDetail('/marketplace/not-published');

    expect(await screen.findByRole('heading', { name: 'Listing not found' })).toBeInTheDocument();
  });

  it('exposes catalog read failures accessibly', async () => {
    listPublicMarketplaceListings.mockRejectedValue(new Error('request failed'));
    renderBrowse();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Marketplace listings could not be loaded.'));
  });
});