import type { CatalogSurface } from '@/platform/core/catalogSurfaceRegistry';
import { getCatalogSurface } from '@/platform/core/catalogSurfaceRegistry';
import { getResource } from './resourceRegistry';
import { applyResourceOp, parseResourceProvenance, queryResource } from './resourceRuntime';
import type { ResourceRecord } from './resourceTypes';
import { PERSISTED_RESOURCE_ID, resolveResourceIdentity } from './resourceIdentity';

export interface ScannedCatalogItem {
  name: string;
  description: string;
  price: string | null;
  image: string | null;
  fields?: Record<string, unknown>;
  resourceMark?: string | null;
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[^\d,.-]/g, '').replace(/,(?=\d{3}(?:\D|$))/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return null;
  if (/^(true|yes|1|available|active|featured)$/i.test(value.trim())) return true;
  if (/^(false|no|0|unavailable|inactive|not featured)$/i.test(value.trim())) return false;
  return null;
}

function normalizeFieldValue(type: CatalogSurface['editableFields'][number]['type'], value: unknown): unknown {
  if (type === 'tags') {
    if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
    return typeof value === 'string' ? value.split(',').map((tag) => tag.trim()).filter(Boolean) : [];
  }
  if (type === 'boolean') return booleanValue(value) ?? value;
  if (['number', 'rating', 'money'].includes(type)) return numericValue(value) ?? value;
  if (type === 'money-cents' && typeof value === 'string') {
    const parsed = numericValue(value);
    if (parsed === null) return value;
    const hasCurrencyOrDecimal = /[$£€]|[.,]\d{1,2}$/.test(value.trim());
    return Math.round(hasCurrencyOrDecimal ? parsed * 100 : parsed);
  }
  return value;
}

/** Build a create/update payload from a preview scan, constrained by the surface schema. */
export function buildScannedCatalogValues(
  surface: CatalogSurface,
  item: ScannedCatalogItem,
  index: number,
): Record<string, unknown> {
  const allowed = new Map(surface.editableFields.map((field) => [field.key, field]));
  const values: Record<string, unknown> = { ...surface.newRowDefaults };
  const scanned = item.fields ?? {};

  for (const [key, value] of Object.entries(scanned)) {
    const field = allowed.get(key);
    if (field && value !== undefined && value !== null && value !== '') values[key] = normalizeFieldValue(field.type, value);
  }

  const assign = (key: string | undefined, value: unknown) => {
    if (key && allowed.has(key) && !Object.prototype.hasOwnProperty.call(scanned, key) && value !== undefined && value !== null && value !== '') values[key] = value;
  };

  assign(surface.fields.title, item.name.trim());
  assign(surface.fields.description, item.description.trim());
  assign(surface.fields.image, item.image?.trim());
  assign(surface.fields.category, scanned.category);
  assign(surface.fields.featured, booleanValue(scanned.featured) ?? undefined);
  assign(surface.fields.active, booleanValue(scanned.available ?? scanned.is_active) ?? undefined);

  const priceKey = surface.fields.priceCents ?? surface.fields.price;
  if (priceKey && !Object.prototype.hasOwnProperty.call(scanned, priceKey)) {
    const parsedPrice = numericValue(item.price);
    if (parsedPrice !== null) values[priceKey] = surface.fields.priceCents ? Math.round(parsedPrice * 100) : parsedPrice;
  } else if (priceKey && typeof scanned[priceKey] === 'string') {
    const rawPrice = scanned[priceKey] as string;
    const parsedPrice = numericValue(rawPrice);
    const includesCurrencyOrDecimal = /[$£€]|[.,]\d{1,2}$/.test(rawPrice.trim());
    if (parsedPrice !== null) values[priceKey] = surface.fields.priceCents && includesCurrencyOrDecimal ? Math.round(parsedPrice * 100) : parsedPrice;
  }

  assign(surface.editableFields.find((field) => field.key === 'sort_order')?.key, index);
  return Object.fromEntries([...allowed.keys()]
    .filter((key) => Object.prototype.hasOwnProperty.call(values, key))
    .map((key) => [key, values[key]]));
}

/** Persist a scan using the surface schema and the one canonical resource writer. */
export async function persistScannedCatalogItem(input: {
  kind: string;
  item: ScannedCatalogItem;
  index: number;
  businessId: string;
  projectId?: string | null;
}): Promise<ResourceRecord> {
  const surface = getCatalogSurface(input.kind);
  const surfaceId = surface?.surfaceId;
  const definition = surfaceId ? getResource(surfaceId) : null;
  if (!surfaceId || !surface || !definition) throw new Error(`No catalog surface is registered for "${input.kind}".`);

  const context = { businessId: input.businessId, projectId: input.projectId, mode: 'builder' as const };
  const values = buildScannedCatalogValues(surface, input.item, input.index);
  const markedRef = parseResourceProvenance(input.item.resourceMark);
  const markedRecordId = markedRef?.resourceKey === surfaceId ? markedRef.recordId : null;
  const rows = markedRecordId && PERSISTED_RESOURCE_ID.test(markedRecordId) ? [] : await queryResource(surfaceId, context);
  const titleField = surface.fields.title;
  const duplicateMatches = rows.filter((row) => String(row[titleField] ?? '').trim().toLowerCase() === input.item.name.trim().toLowerCase()
    && (!values.category || String(row[surface.fields.category ?? 'category'] ?? '').trim().toLowerCase() === String(values.category).trim().toLowerCase()));
  if (duplicateMatches.length > 1) throw new Error(`More than one ${surface.rowLabel} matches "${input.item.name}"; choose a specific item before saving.`);
  const resolvedMark = markedRecordId
    ? PERSISTED_RESOURCE_ID.test(markedRecordId) ? markedRecordId : resolveResourceIdentity(markedRecordId, rows)
    : null;
  if (markedRef && markedRef.resourceKey !== surfaceId) throw new Error('This item belongs to a different resource collection.');
  const recordId = resolvedMark || duplicateMatches[0]?.id;
  const saved = recordId
    ? await applyResourceOp({ op: 'update', ref: { resourceKey: surfaceId, kind: 'catalog', catalogKind: surface.catalogKind, recordId }, values }, context)
    : await applyResourceOp({ op: 'create', resourceKey: surfaceId, values }, context);
  if (!saved) throw new Error(`The ${surface.rowLabel} wasn't returned after saving.`);
  return saved;
}