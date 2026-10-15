import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogInspectorPanel } from '@/components/business-center/CatalogInspectorPanel';

const mocks = vi.hoisted(() => ({
  evaluate: vi.fn(),
  listCollections: vi.fn(),
  upsertBinding: vi.fn(),
  loadRows: vi.fn(),
  createRow: vi.fn(),
  deleteRow: vi.fn(),
  updateRow: vi.fn(),
}));

vi.mock('@/contexts/useBusinessProfile', () => ({ useBusinessProfile: () => ({ profile: null }) }));
vi.mock('@/services/catalogReadinessGate', () => ({ evaluateCatalogReadinessGate: mocks.evaluate }));
vi.mock('@/services/catalogCollectionService', () => ({ listCollections: mocks.listCollections }));
vi.mock('@/services/sectionDataBindingService', () => ({ upsertBinding: mocks.upsertBinding }));
vi.mock('@/services/catalogCardBindingService', () => ({
  catalogCardBindingFor: () => null,
  updateCatalogCardBinding: vi.fn(),
  updateCatalogCardPresentation: vi.fn(),
}));
vi.mock('@/services/catalogRowService', () => ({ loadRowsForBinding: mocks.loadRows }));
vi.mock('@/services/agent-runtime/catalogOps', () => ({
  createCatalogItem: mocks.createRow,
  deleteCatalogItem: mocks.deleteRow,
  updateCatalogItemRow: mocks.updateRow,
}));

const binding = {
  id: 'binding-1',
  businessId: 'business-1',
  projectId: 'project-1',
  snapshotId: 'snapshot-1',
  pagePath: '/src/pages/Home.tsx',
  sectionId: 'services-1',
  slotKey: 'services.items',
  bindingType: 'catalog',
  sourceKind: 'products',
  sourceTable: 'products',
  collectionId: null,
  filters: {},
  sort: {},
  limitCount: null,
  displayMapping: {},
  fallbackMode: 'hide_section',
} as never;

function renderPanel() {
  return render(<CatalogInspectorPanel projectId="project-1" sectionTypeMap={{}} />);
}

async function expandBinding() {
  fireEvent.click(await screen.findByRole('button', { name: /services-1/ }));
  await screen.findByLabelText('Stage a new item in services-1');
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.evaluate.mockResolvedValue({ bindings: [{ binding, rowCount: 1 }], reasons: [], recommended: [] });
  mocks.listCollections.mockResolvedValue([]);
  mocks.upsertBinding.mockResolvedValue({});
  mocks.loadRows.mockResolvedValue({ rows: [{ id: 'row-1', name: 'Hammer', price: 10 }] });
  mocks.createRow.mockResolvedValue({ id: 'created-row' });
  mocks.deleteRow.mockResolvedValue(true);
  mocks.updateRow.mockResolvedValue(true);
});

afterEach(cleanup);

describe('Connected Data confirmations', () => {
  it('does not create a row until the staged item is confirmed', async () => {
    renderPanel();
    await expandBinding();

    fireEvent.click(screen.getByLabelText('Stage a new item in services-1'));
    expect(await screen.findByText('New item draft')).toBeInTheDocument();
    expect(mocks.createRow).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Confirm new item'));
    await waitFor(() => expect(mocks.createRow).toHaveBeenCalledOnce());
  });

  it('does not delete a row until the staged deletion is confirmed', async () => {
    renderPanel();
    await expandBinding();

    fireEvent.click(await screen.findByLabelText('Stage deleting Hammer'));
    expect(mocks.deleteRow).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Confirm deleting Hammer'));
    await waitFor(() => expect(mocks.deleteRow).toHaveBeenCalledOnce());
  });
});