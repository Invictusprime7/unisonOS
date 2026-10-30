/**
 * Catalog operations exposed through `agentOperations` — the one surface the
 * AI, the command menu and the Catalog panel use to read and change a
 * business's products / services / menu / plans. Table + field mapping comes
 * from `catalogSurfaceRegistry`; Resource Runtime owns project-backend
 * routing, storage validation and one invalidation/event per saved record.
 */
import { getCatalogSurface, getCatalogSurfaceByTable, listCatalogSurfaces, type CatalogSourceTable, type CatalogSurface } from '@/platform/core/catalogSurfaceRegistry';
import { applyResourceOp, queryResource } from '@/services/resources/resourceRuntime';
import { executeEditorCommand } from '@/services/editor/editorCommandService';

export const EDITABLE_CATALOG_SURFACES = listCatalogSurfaces()
  .filter((surface) => surface.editableFields.length > 0).map((surface) => surface.surfaceId);

export interface CatalogItem {
  surfaceId: string;
  id: string;
  name: string;
  price: number | null;
  image: string | null;
  active: boolean;
}

/** Owner-facing patch: price is always in dollars. */
export interface CatalogPatch {
  name?: string | null;
  description?: string | null;
  price?: number | null;
  image_url?: string | null;
  active?: boolean;
  [column: string]: unknown;
}

function surfaceOrThrow(surfaceId: string): CatalogSurface {
  const s = getCatalogSurface(surfaceId) ?? getCatalogSurfaceByTable(surfaceId as CatalogSourceTable);
  if (!s) throw new Error(`Unknown catalog type "${surfaceId}".`);
  return s;
}

export function normalizeCatalogPatch(surface: CatalogSurface, patch: CatalogPatch): Record<string, unknown> {
  const f = surface.fields;
  const editable = new Set(surface.editableFields.map((e) => e.key));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (['name', 'description', 'price', 'image_url', 'active'].includes(k)) continue;
    // Integer columns (duration, sort order, stock) reject fractional seeds.
    if (editable.has(k)) out[k] = typeof v === 'number' && Number.isFinite(v) && /(_minutes|sort_order|_count)$/.test(k) ? Math.round(v) : v;
  }
  if (patch.name !== undefined) out[f.title] = patch.name ?? '';
  if (patch.description !== undefined && f.description) out[f.description] = patch.description;
  if (patch.image_url !== undefined && f.image) out[f.image] = patch.image_url;
  if (patch.active !== undefined && f.active) out[f.active] = patch.active;
  if (patch.price !== undefined) {
    const dollars = patch.price == null || !Number.isFinite(patch.price) ? 0 : patch.price;
    if (f.priceCents) out[f.priceCents] = Math.round(dollars * 100);
    else if (f.price) out[f.price] = dollars;
  }
  return out;
}

export function toCatalogItem(surface: CatalogSurface, r: Record<string, unknown>): CatalogItem {
  const f = surface.fields;
  const cents = f.priceCents ? r[f.priceCents] : undefined;
  const dollars = f.price ? r[f.price] : undefined;
  return {
    surfaceId: surface.surfaceId,
    id: String(r.id),
    name: String(r[f.title] ?? 'Untitled'),
    price: cents != null ? Number(cents) / 100 : dollars != null ? Number(dollars) : null,
    image: f.image && typeof r[f.image] === 'string' ? (r[f.image] as string) : null,
    active: f.active ? r[f.active] !== false : true,
  };
}

export async function listCatalog(businessId: string, surfaceIds: readonly string[] = EDITABLE_CATALOG_SURFACES, projectId?: string | null): Promise<CatalogItem[]> {
  const all = await Promise.all(surfaceIds.map(async (id) => {
    const surface = surfaceOrThrow(id);
    const rows = await queryResource(surface.surfaceId, { businessId, projectId, mode: 'builder' });
    return rows.map((r) => toCatalogItem(surface, r));
  }));
  return all.flat();
}

export async function createCatalogItem(businessId: string, surfaceId: string, patch: CatalogPatch, projectId?: string | null): Promise<CatalogItem> {
  const surface = surfaceOrThrow(surfaceId);
  const row = await applyResourceOp({
    op: 'create',
    resourceKey: surface.surfaceId,
    values: { ...surface.newRowDefaults, ...normalizeCatalogPatch(surface, patch) },
  }, { businessId, projectId, mode: 'builder' });
  if (!row) throw new Error('Catalog creation returned no saved record.');
  const item = toCatalogItem(surface, row);
  return item;
}

export async function updateCatalogItemRow(
  businessId: string, surfaceId: string, id: string, patch: CatalogPatch, projectId?: string | null, observed?: Record<string, unknown>,
): Promise<{ before: CatalogItem | null; after: CatalogItem }> {
  const surface = surfaceOrThrow(surfaceId);
  const rows = await queryResource(surface.surfaceId, { businessId, projectId, mode: 'builder' });
  const beforeRow = rows.find((r) => String(r.id) === id);
  if (!beforeRow) throw new Error('This item is no longer available in this project.');
  const values = normalizeCatalogPatch(surface, patch);
  const expected = observed ?? Object.fromEntries(Object.keys(values).map((key) => [key, beforeRow[key] ?? null]));
  const result = await executeEditorCommand({
    type: 'update-resource-field', target: { ownerKind: 'resource', projectId },
    ref: { resourceKey: surface.surfaceId, kind: 'catalog', recordId: id }, values, expected,
  }, { source: 'ai', resource: { businessId, projectId, mode: 'builder' } });
  if (!result.ok) throw new Error(result.error ?? 'Catalog update failed.');
  const row = result.record;
  if (!row) throw new Error('Catalog update returned no saved record.');
  const after = toCatalogItem(surface, row);
  return { before: beforeRow ? toCatalogItem(surface, beforeRow) : null, after };
}

export async function deleteCatalogItem(businessId: string, surfaceId: string, id: string, projectId?: string | null): Promise<void> {
  const surface = surfaceOrThrow(surfaceId);
  await applyResourceOp({ op: 'delete', ref: { resourceKey: surface.surfaceId, kind: 'catalog', recordId: id } }, { businessId, projectId, mode: 'builder' });
}

/** Compact catalog summary for the AI context. */
export function renderCatalogForPrompt(items: CatalogItem[], maxChars = 1500): string {
  if (items.length === 0) return 'CATALOG: this business has no saved products/services yet.';
  const lines = ['CATALOG (live database; change prices/images via catalog operations, never by editing page text):'];
  for (const i of items) lines.push(`- [${i.surfaceId}#${i.id}] ${i.name}${i.price != null ? ` — $${i.price}` : ''}${i.active ? '' : ' (hidden)'}`);
  const t = lines.join('\n');
  return t.length > maxChars ? `${t.slice(0, maxChars)}\n…` : t;
}
