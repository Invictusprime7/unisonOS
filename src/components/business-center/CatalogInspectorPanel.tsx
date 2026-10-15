/**
 * CatalogInspectorPanel — Track B Builder surface.
 *
 * Lists every `site_data_binding` for the active project, shows the live row
 * count for each bound section, and calls out sections that block publish.
 * B4: bindings are inline-editable — pick collection, cap limit, sort.
 * B5: rows are inline-editable — edit name / description / price / image and
 * write back to the source table; the preview re-hydrates on save.
 */
import { createCatalogItem, deleteCatalogItem, updateCatalogItemRow } from '@/services/agent-runtime/catalogOps';
import { useCallback, useEffect, useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import { useBusinessProfile } from '@/contexts/useBusinessProfile';

import {
  evaluateCatalogReadinessGate,
  type CatalogGateVerdict,
} from '@/services/catalogReadinessGate';
import { listCollections } from '@/services/catalogCollectionService';
import { upsertBinding } from '@/services/sectionDataBindingService';
import {
  catalogCardBindingFor,
  updateCatalogCardBinding,
  updateCatalogCardPresentation,
} from '@/services/catalogCardBindingService';
import {
  loadRowsForBinding,
} from '@/services/catalogRowService';
import type {
  CatalogCollectionDTO,
  CatalogBindingPresentation,
  CatalogBindingActions,
  SectionDataBindingDTO,
} from '@/types/catalog';

interface CatalogInspectorPanelProps {
  projectId: string | null | undefined;
  sectionTypeMap?: Record<string, string>;
  /** Canonical snapshot — lets the gate see unbound + profile-backed sections. */
  snapshot?: SiteBundleSnapshot | null;
  onClose?: () => void;
  className?: string;
}


type RowRec = Record<string, unknown>;

interface RowDraft {
  name: string;
  description: string;
  price: string;
  image_url: string;
  saving: boolean;
  dirty: boolean;
}

interface DraftState {
  collectionId: string | null;
  limitCount: number | null;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  saving: boolean;
  collections: CatalogCollectionDTO[];
  loadedCollections: boolean;
  rows: RowRec[];
  loadedRows: boolean;
  rowDrafts: Record<string, RowDraft>;
  newRow: RowDraft | null;
  pendingDeleteId: string | null;
  presentation: CatalogBindingPresentation | null;
  actions: CatalogBindingActions | null;
  presentationSaving: boolean;
  bindingDirty: boolean;
  presentationDirty: boolean;
  actionsDirty: boolean;
}

function draftFromBinding(b: SectionDataBindingDTO): DraftState {
  return {
    collectionId: b.collectionId,
    limitCount: b.limitCount,
    sortField: b.sort?.field ?? '',
    sortDirection: b.sort?.direction ?? 'asc',
    saving: false,
    collections: [],
    loadedCollections: false,
    rows: [],
    loadedRows: false,
    rowDrafts: {},
    newRow: null,
    pendingDeleteId: null,
    presentation: catalogCardBindingFor(b)?.presentation ?? null,
    actions: catalogCardBindingFor(b)?.actions ?? null,
    presentationSaving: false,
    bindingDirty: false,
    presentationDirty: false,
    actionsDirty: false,
  };
}

function toRowDraft(row: RowRec): RowDraft {
  return {
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    price: row.price != null ? String(row.price) : '',
    image_url: String(row.image_url ?? ''),
    saving: false,
    dirty: false,
  };
}


export function CatalogInspectorPanel({
  projectId,
  sectionTypeMap,
  snapshot,
  onClose,
  className,
}: CatalogInspectorPanelProps) {
  const [verdict, setVerdict] = useState<CatalogGateVerdict | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const { profile } = useBusinessProfile();

  useEffect(() => {
    let cancelled = false;
    if (!projectId) {
      setVerdict(null);
      return;
    }
    setLoading(true);
    evaluateCatalogReadinessGate(projectId, sectionTypeMap ?? {}, { snapshot, profile })
      .then((v) => {
        if (!cancelled) setVerdict(v);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, sectionTypeMap, snapshot, profile, reloadKey]);


  // Auto-reload when the System Launcher (or any downstream service) reports
  // that fresh catalog rows have been seeded for this project. Keeps the
  // inspector in sync with `autoEmitSectionBindings` without a manual refresh.
  useEffect(() => {
    if (typeof window === 'undefined' || !projectId) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      if (!detail?.projectId || detail.projectId === projectId) {
        setReloadKey((k) => k + 1);
      }
    };
    window.addEventListener('unison:catalog-seeded', handler as EventListener);
    return () => window.removeEventListener('unison:catalog-seeded', handler as EventListener);
  }, [projectId]);

  const loadRows = useCallback(async (binding: SectionDataBindingDTO) => {
    const result = await loadRowsForBinding(binding);
    const rowsArr = result.rows ?? [];
    const rowDrafts: Record<string, RowDraft> = {};
    for (const r of rowsArr) {
      const id = String(r.id ?? '');
      if (id) rowDrafts[id] = toRowDraft(r);
    }
    setDrafts((prev) => ({
      ...prev,
      [binding.id]: {
        ...(prev[binding.id] ?? draftFromBinding(binding)),
        rows: rowsArr,
        loadedRows: true,
        rowDrafts,
      },
    }));
  }, []);

  const toggleExpand = useCallback(
    async (binding: SectionDataBindingDTO) => {
      const isOpen = expanded === binding.id;
      if (isOpen) {
        setExpanded(null);
        return;
      }
      setExpanded(binding.id);
      setDrafts((prev) => ({
        ...prev,
        [binding.id]: prev[binding.id] ?? draftFromBinding(binding),
      }));
      const existing = drafts[binding.id];
      if (!existing?.loadedCollections) {
        const cols = await listCollections(binding.businessId, binding.sourceKind);
        setDrafts((prev) => ({
          ...prev,
          [binding.id]: {
            ...(prev[binding.id] ?? draftFromBinding(binding)),
            collections: cols,
            loadedCollections: true,
          },
        }));
      }
      if (!existing?.loadedRows) {
        void loadRows(binding);
      }
    },
    [expanded, drafts, loadRows],
  );

  const updateDraft = (id: string, patch: Partial<DraftState>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const updateBindingDraft = (id: string, patch: Partial<DraftState>) => {
    updateDraft(id, { ...patch, bindingDirty: true });
  };

  const stageNewRow = (binding: SectionDataBindingDTO) => {
    updateDraft(binding.id, {
      newRow: toRowDraft({ name: 'New item', description: '', price: 0, image_url: '' }),
    });
  };

  const updateNewRowDraft = (bindingId: string, patch: Partial<RowDraft>) => {
    setDrafts((prev) => {
      const draft = prev[bindingId];
      if (!draft?.newRow) return prev;
      return {
        ...prev,
        [bindingId]: {
          ...draft,
          newRow: { ...draft.newRow, ...patch, dirty: true },
        },
      };
    });
  };

  const updateRowDraft = (
    bindingId: string,
    rowId: string,
    patch: Partial<RowDraft>,
  ) => {
    setDrafts((prev) => {
      const d = prev[bindingId];
      if (!d) return prev;
      const current = d.rowDrafts[rowId];
      if (!current) return prev;
      return {
        ...prev,
        [bindingId]: {
          ...d,
          rowDrafts: {
            ...d.rowDrafts,
            [rowId]: { ...current, ...patch, dirty: true },
          },
        },
      };
    });
  };

  const updatePresentationDraft = (
    bindingId: string,
    patch: Partial<CatalogBindingPresentation>,
  ) => {
    setDrafts((prev) => {
      const draft = prev[bindingId];
      if (!draft?.presentation) return prev;
      return {
        ...prev,
        [bindingId]: {
          ...draft,
          presentation: { ...draft.presentation, ...patch },
          presentationDirty: true,
        },
      };
    });
  };

  const updateActionsDraft = (
    bindingId: string,
    patch: Partial<CatalogBindingActions>,
  ) => {
    setDrafts((prev) => {
      const draft = prev[bindingId];
      if (!draft?.actions) return prev;
      return {
        ...prev,
        [bindingId]: {
          ...draft,
          actions: { ...draft.actions, ...patch },
          actionsDirty: true,
        },
      };
    });
  };

  const bumpPreview = () => {
    try {
      window.postMessage({ type: 'CATALOG_BINDINGS_CHANGED', projectId }, '*');
    } catch { /* noop */ }
  };

  const saveRow = async (binding: SectionDataBindingDTO, rowId: string) => {
    const d = drafts[binding.id];
    const rd = d?.rowDrafts[rowId];
    if (!d || !rd) return;
    updateRowDraft(binding.id, rowId, { saving: true });
    const priceNum = rd.price.trim() === '' ? null : Number(rd.price);
    const ok = await updateCatalogItemRow(binding.businessId, binding.sourceTable, rowId, {
      name: rd.name,
      description: rd.description || null,
      price: Number.isFinite(priceNum as number) ? (priceNum as number) : null,
      image_url: rd.image_url || null,
    }).then(() => true, () => false);
    updateRowDraft(binding.id, rowId, { saving: false, dirty: !ok });
    if (ok) {
      await loadRows(binding);
      bumpPreview();
    } else {
      toast.error('Could not save catalog item changes.');
    }
  };

  const createRow = async (binding: SectionDataBindingDTO) => {
    const row = drafts[binding.id]?.newRow;
    if (!row || !row.name.trim()) return;
    updateDraft(binding.id, { saving: true });
    const priceNum = row.price.trim() === '' ? 0 : Number(row.price);
    try {
      const created = await createCatalogItem(binding.businessId, binding.sourceTable, {
        name: row.name.trim(),
        description: row.description,
        price: Number.isFinite(priceNum) ? priceNum : 0,
        image_url: row.image_url,
      });
      if (!created) throw new Error('The catalog item was not created.');
      updateDraft(binding.id, { saving: false, newRow: null });
      await loadRows(binding);
      bumpPreview();
    } catch (error) {
      updateDraft(binding.id, { saving: false });
      toast.error(error instanceof Error ? error.message : 'Could not create the catalog item.');
    }
  };

  const removeRow = async (binding: SectionDataBindingDTO, rowId: string) => {
    updateRowDraft(binding.id, rowId, { saving: true });
    const ok = await deleteCatalogItem(binding.businessId, binding.sourceTable, rowId).then(() => true, () => false);
    if (ok) {
      updateDraft(binding.id, { pendingDeleteId: null });
      await loadRows(binding);
      bumpPreview();
    } else {
      updateRowDraft(binding.id, rowId, { saving: false });
      toast.error('Could not delete the catalog item.');
    }
  };

  const saveBinding = async (binding: SectionDataBindingDTO) => {
    const d = drafts[binding.id];
    if (!d) return;
    updateDraft(binding.id, { saving: true });
    try {
      await upsertBinding({
      businessId: binding.businessId,
      projectId: binding.projectId,
      snapshotId: binding.snapshotId,
      pagePath: binding.pagePath,
      sectionId: binding.sectionId,
      slotKey: binding.slotKey,
      bindingType: binding.bindingType,
      sourceKind: binding.sourceKind,
      sourceTable: binding.sourceTable,
      collectionId: d.collectionId,
      filters: binding.filters,
      sort: d.sortField ? { field: d.sortField, direction: d.sortDirection } : {},
      limitCount: d.limitCount,
      displayMapping: binding.displayMapping,
      fallbackMode: binding.fallbackMode,
      });
      updateDraft(binding.id, { saving: false, bindingDirty: false });
      setReloadKey((k) => k + 1);
      bumpPreview();
    } catch (error) {
      updateDraft(binding.id, { saving: false });
      toast.error(error instanceof Error ? error.message : 'Could not save the data binding.');
    }
  };

  const savePresentation = async (binding: SectionDataBindingDTO) => {
    const draft = drafts[binding.id];
    if (!draft?.presentation) return;
    updateDraft(binding.id, { presentationSaving: true });
    try {
      const saved = await updateCatalogCardPresentation(binding.id, draft.presentation);
      updateDraft(binding.id, { presentationSaving: false, presentationDirty: !saved });
      if (saved) {
        setReloadKey((key) => key + 1);
        bumpPreview();
      } else {
        toast.error('Could not save card presentation.');
      }
    } catch (error) {
      updateDraft(binding.id, { presentationSaving: false, presentationDirty: true });
      toast.error(error instanceof Error ? error.message : 'Could not save card presentation.');
    }
  };

  const saveCardActions = async (binding: SectionDataBindingDTO) => {
    const draft = drafts[binding.id];
    if (!draft?.actions) return;
    updateDraft(binding.id, { presentationSaving: true });
    try {
      const saved = await updateCatalogCardBinding(binding.id, { actions: draft.actions });
      updateDraft(binding.id, { presentationSaving: false, actionsDirty: !saved });
      if (saved) {
        setReloadKey((key) => key + 1);
        bumpPreview();
      } else {
        toast.error('Could not save card actions.');
      }
    } catch (error) {
      updateDraft(binding.id, { presentationSaving: false, actionsDirty: true });
      toast.error(error instanceof Error ? error.message : 'Could not save card actions.');
    }
  };


  return (
    <div
      className={cn(
        'w-[380px] max-h-[75vh] overflow-auto rounded-lg border border-indigo-500/30 bg-zinc-950/95 backdrop-blur-md shadow-[0_0_25px_rgba(99,102,241,0.15)] text-zinc-200',
        className,
      )}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-indigo-500/20">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
            Connected Data
          </span>
          {verdict && (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full border',
                verdict.publishBlocked
                  ? 'bg-red-500/10 text-red-300 border-red-500/30'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
              )}
            >
              {verdict.publishBlocked ? 'Publish blocked' : 'Ready'}
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-sm leading-none"
          >
            ×
          </button>
        )}
      </div>

      <div className="p-3 space-y-2">
        {loading && <div className="text-xs text-zinc-500">Loading bindings…</div>}
        {!loading && !projectId && (
          <div className="text-xs text-zinc-500">
            No project attached. Open a builder draft to inspect connected data.
          </div>
        )}
        {!loading && verdict && verdict.bindings.length === 0 && (
          <div className="text-xs text-zinc-500">
            No live-data sections bound yet. Generated sections will appear here when
            they connect to catalog rows.
          </div>
        )}

        {verdict?.bindings.map(({ binding, rowCount }) => {
          const blocked = verdict.reasons.some(
            (r) => r.pagePath === binding.pagePath && r.sectionId === binding.sectionId,
          );
          const soft = verdict.recommended.some(
            (r) => r.pagePath === binding.pagePath && r.sectionId === binding.sectionId,
          );
          const isOpen = expanded === binding.id;
          const draft = drafts[binding.id];
          const cardBinding = catalogCardBindingFor(binding);
          return (
            <div
              key={binding.id}
              className={cn(
                'rounded-md border bg-zinc-900/60',
                blocked
                  ? 'border-red-500/40'
                  : soft
                    ? 'border-amber-500/30'
                    : 'border-zinc-800',
              )}
            >
              <button
                type="button"
                onClick={() => toggleExpand(binding)}
                className="w-full text-left px-3 py-2 hover:bg-zinc-900/80 rounded-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-zinc-100 truncate">
                    {binding.pagePath} · {binding.sectionId}
                  </div>
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full',
                      rowCount === 0
                        ? 'bg-zinc-800 text-zinc-500'
                        : 'bg-indigo-500/10 text-indigo-300',
                    )}
                  >
                    {rowCount} row{rowCount === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-zinc-500 flex items-center gap-2">
                  <span>{binding.sourceKind}</span>
                  <span>·</span>
                  <span>{binding.sourceTable}</span>
                  {binding.collectionId && (
                    <>
                      <span>·</span>
                      <span>collection</span>
                    </>
                  )}
                  <span>·</span>
                  <span>fallback: {binding.fallbackMode}</span>
                  {cardBinding && (
                    <>
                      <span>·</span>
                      <span>card</span>
                    </>
                  )}
                  <span className="ml-auto text-indigo-400">{isOpen ? '▾' : '▸'}</span>
                </div>
              </button>

              {isOpen && draft && (
                <div className="px-3 pb-3 pt-1 border-t border-zinc-800/70 space-y-2">
                  {cardBinding && draft.presentation && (
                    <div className="space-y-2 rounded border border-indigo-500/20 bg-indigo-500/5 p-2">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wider text-indigo-200">
                          Presentation and actions
                        </div>
                        <div className="mt-0.5 text-[10px] text-zinc-500">
                          Changes only this card instance.
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-300">
                        {([
                          ['showImage', 'Image'],
                          ['showDescription', 'Description'],
                          ['showPrice', 'Price'],
                          ['showCTA', 'CTA'],
                        ] as const).map(([key, label]) => (
                          <label key={key} className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={Boolean(draft.presentation?.[key])}
                              onChange={(event) =>
                                updatePresentationDraft(binding.id, { [key]: event.target.checked })
                              }
                              className="accent-indigo-400"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                            Image ratio
                          </label>
                          <input
                            type="text"
                            value={String(draft.presentation.imageAspectRatio ?? '')}
                            onChange={(event) =>
                              updatePresentationDraft(binding.id, { imageAspectRatio: event.target.value })
                            }
                            placeholder="e.g. 4:3"
                            className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                            Alignment
                          </label>
                          <select
                            value={String(draft.presentation.alignment ?? '')}
                            onChange={(event) =>
                              updatePresentationDraft(binding.id, { alignment: event.target.value })
                            }
                            className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                          >
                            <option value="">Default</option>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                            Primary action
                          </label>
                          <select
                            value={draft.actions?.primary ?? ''}
                            onChange={(event) =>
                              updateActionsDraft(binding.id, {
                                primary: event.target.value
                                  ? event.target.value as CatalogBindingActions['primary']
                                  : undefined,
                              })
                            }
                            className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                          >
                            <option value="">No primary action</option>
                            <option value="cart.add">Add to cart</option>
                            <option value="booking.start">Start booking</option>
                            <option value="quote.request">Request quote</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                            Secondary action
                          </label>
                          <select
                            value={draft.actions?.secondary ?? ''}
                            onChange={(event) =>
                              updateActionsDraft(binding.id, {
                                secondary: event.target.value
                                  ? 'catalog.view_details'
                                  : undefined,
                              })
                            }
                            className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                          >
                            <option value="">No secondary action</option>
                            <option value="catalog.view_details">View details</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          aria-label="Confirm card presentation changes"
                          title="Apply presentation changes"
                          disabled={draft.presentationSaving || !draft.presentationDirty}
                          onClick={() => savePresentation(binding)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-35"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Confirm card action changes"
                          title="Apply action changes"
                          disabled={draft.presentationSaving || !draft.actionsDirty}
                          onClick={() => saveCardActions(binding)}
                          className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded border border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-35"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                    {cardBinding ? 'Data source' : 'Collection'}
                  </label>
                  <select
                    value={draft.collectionId ?? ''}
                    onChange={(e) =>
                      updateBindingDraft(binding.id, {
                        collectionId: e.target.value || null,
                      })
                    }
                    className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                  >
                    <option value="">— All rows —</option>
                    {draft.collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.slug})
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                        Limit
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={draft.limitCount ?? ''}
                        onChange={(e) =>
                          updateBindingDraft(binding.id, {
                            limitCount: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        placeholder="none"
                        className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                        Sort dir
                      </label>
                      <select
                        value={draft.sortDirection}
                        onChange={(e) =>
                          updateBindingDraft(binding.id, {
                            sortDirection: e.target.value as 'asc' | 'desc',
                          })
                        }
                        className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                      >
                        <option value="asc">asc</option>
                        <option value="desc">desc</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                      Sort field
                    </label>
                    <input
                      type="text"
                      value={draft.sortField}
                      onChange={(e) =>
                        updateBindingDraft(binding.id, { sortField: e.target.value })
                      }
                      placeholder="e.g. sort_order, created_at"
                      className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      aria-label="Confirm data binding changes"
                      title="Apply data binding changes"
                      disabled={draft.saving || !draft.bindingDirty}
                      onClick={() => saveBinding(binding)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-35"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-3 pt-2 border-t border-zinc-800/70">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                        {cardBinding ? 'Content (shared catalog item)' : `Rows (${draft.rows.length})`}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Stage a new item in ${binding.sectionId}`}
                          title="Add item"
                          disabled={Boolean(draft.newRow) || draft.saving}
                          onClick={() => stageNewRow(binding)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded border border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/15 disabled:opacity-35"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => loadRows(binding)}
                          className="text-[10px] text-indigo-300 hover:text-indigo-200"
                        >
                          Reload
                        </button>
                      </div>
                    </div>
                    {!draft.loadedRows && (
                      <div className="text-[11px] text-zinc-500">Loading rows…</div>
                    )}
                    {draft.loadedRows && draft.rows.length === 0 && (
                      <div className="text-[11px] text-zinc-500">
                        No rows yet. Add items in the {binding.sourceTable} table.
                      </div>
                    )}
                    {draft.newRow && (
                      <div className="rounded border border-emerald-500/30 bg-emerald-500/[0.04] p-2 space-y-1">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-200">New item draft</div>
                        <input
                          type="text"
                          value={draft.newRow.name}
                          onChange={(e) => updateNewRowDraft(binding.id, { name: e.target.value })}
                          placeholder="Name"
                          className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-100"
                        />
                        <textarea
                          value={draft.newRow.description}
                          onChange={(e) => updateNewRowDraft(binding.id, { description: e.target.value })}
                          placeholder="Description"
                          rows={2}
                          className="w-full text-[11px] bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-300 resize-none"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={draft.newRow.price}
                            onChange={(e) => updateNewRowDraft(binding.id, { price: e.target.value })}
                            placeholder="Price"
                            className="w-full text-[11px] bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                          />
                          <input
                            type="text"
                            value={draft.newRow.image_url}
                            onChange={(e) => updateNewRowDraft(binding.id, { image_url: e.target.value })}
                            placeholder="Image URL"
                            className="w-full text-[11px] bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                          />
                        </div>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            aria-label="Cancel new item"
                            title="Discard new item"
                            disabled={draft.saving}
                            onClick={() => updateDraft(binding.id, { newRow: null })}
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-white/5"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Confirm new item"
                            title="Create item"
                            disabled={draft.saving || !draft.newRow.name.trim()}
                            onClick={() => createRow(binding)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-35"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      {draft.rows.map((row) => {
                        const rowId = String(row.id ?? '');
                        const rd = draft.rowDrafts[rowId];
                        if (!rd) return null;
                        return (
                          <div
                            key={rowId}
                            className="rounded border border-zinc-800 bg-zinc-950/60 p-2 space-y-1"
                          >
                            <input
                              type="text"
                              value={rd.name}
                              onChange={(e) =>
                                updateRowDraft(binding.id, rowId, { name: e.target.value })
                              }
                              placeholder="Name"
                              className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-100"
                            />
                            <textarea
                              value={rd.description}
                              onChange={(e) =>
                                updateRowDraft(binding.id, rowId, {
                                  description: e.target.value,
                                })
                              }
                              placeholder="Description"
                              rows={2}
                              className="w-full text-[11px] bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-300 resize-none"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                step="0.01"
                                value={rd.price}
                                onChange={(e) =>
                                  updateRowDraft(binding.id, rowId, {
                                    price: e.target.value,
                                  })
                                }
                                placeholder="Price"
                                className="w-full text-[11px] bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                              />
                              <input
                                type="text"
                                value={rd.image_url}
                                onChange={(e) =>
                                  updateRowDraft(binding.id, rowId, {
                                    image_url: e.target.value,
                                  })
                                }
                                placeholder="Image URL"
                                className="w-full text-[11px] bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                              />
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              {draft.pendingDeleteId === rowId ? (
                                <>
                                  <button
                                    type="button"
                                    aria-label={`Cancel deleting ${rd.name}`}
                                    title="Cancel delete"
                                    disabled={rd.saving}
                                    onClick={() => updateDraft(binding.id, { pendingDeleteId: null })}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-white/5"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Confirm deleting ${rd.name}`}
                                    title="Delete item"
                                    disabled={rd.saving}
                                    onClick={() => removeRow(binding, rowId)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-red-500/30 text-red-200 hover:bg-red-500/10 disabled:opacity-40"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  aria-label={`Stage deleting ${rd.name}`}
                                  title="Delete item"
                                  disabled={rd.saving}
                                  onClick={() => updateDraft(binding.id, { pendingDeleteId: rowId })}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                aria-label={`Confirm changes to ${rd.name}`}
                                title="Save item changes"
                                disabled={rd.saving || !rd.dirty}
                                onClick={() => saveRow(binding, rowId)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-35"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

            </div>
          );
        })}

        {verdict && verdict.reasons.length > 0 && (
          <div className="mt-3 border-t border-red-500/20 pt-2 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-red-300">
              Publish blockers
            </div>
            {verdict.reasons.map((r) => (
              <div key={r.code + r.sectionId} className="text-[11px] text-red-200">
                {r.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CatalogInspectorPanel;
