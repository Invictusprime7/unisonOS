/**
 * ResourceRegistry — sits ABOVE catalogSurfaceRegistry (never replaces it).
 * Catalog surfaces and the Business Profile are registered statically;
 * content types are exposed dynamically from the content_types records.
 */
import { getCatalogSurface, listCatalogSurfaces, type CatalogFieldType, type CatalogSurface } from '@/platform/core/catalogSurfaceRegistry';
import type { ResourceDefinition, ResourceFieldDefinition, ResourceFieldType } from './resourceTypes';

export const BUSINESS_PROFILE_RESOURCE_KEY = 'business-profile';
export const CONTENT_STATUSES = ['draft', 'review', 'published', 'archived'] as const;

function catalogFieldType(t: CatalogFieldType): ResourceFieldType {
  return t;
}

export function catalogSurfaceToResource(s: CatalogSurface): ResourceDefinition {
  const kind = s.catalogKind;
  return {
    key: s.surfaceId,
    kind: 'catalog',
    catalogKind: s.catalogKind,
    cardinality: 'collection',
    label: s.friendlyName,
    schema: s.editableFields.map((f) => ({
      key: f.key, label: f.label, type: catalogFieldType(f.type), required: f.required, editable: true,
    })),
    storage: { adapter: 'catalog', table: s.sourceTable },
    capabilities: {
      commerce: kind === 'product' || kind === 'menu_item' || kind === 'pricing_plan' || kind === 'offer',
      booking: kind === 'service' || kind === 'availability_slot',
      ordering: kind === 'product' || kind === 'menu_item',
      featured: Boolean(s.fields.featured),
    },
    rendererFamilies: [s.componentType],
  };
}

const PROFILE_FIELDS: ResourceFieldDefinition[] = [
  { key: 'name', label: 'Business name', type: 'text', required: true, editable: true },
  { key: 'tagline', label: 'Tagline', type: 'text', editable: true },
  { key: 'description', label: 'Description', type: 'textarea', editable: true },
  { key: 'logoUrl', label: 'Logo', type: 'image', editable: true },
  { key: 'phone', label: 'Phone', type: 'phone', editable: true },
  { key: 'email', label: 'Email', type: 'email', editable: true },
  { key: 'website', label: 'Website', type: 'url', editable: true },
  { key: 'address', label: 'Address', type: 'json', editable: true },
  { key: 'hours', label: 'Business hours', type: 'json', editable: true },
  { key: 'socialLinks', label: 'Social links', type: 'json', editable: true },
];

export const BUSINESS_PROFILE_RESOURCE: ResourceDefinition = {
  key: BUSINESS_PROFILE_RESOURCE_KEY,
  kind: 'business-profile',
  cardinality: 'single-record',
  label: 'Business profile',
  schema: PROFILE_FIELDS,
  storage: { adapter: 'business-profile', table: 'businesses' },
};

/** Shape of a content_types row as returned by the cms-records function. */
export interface ContentTypeRow {
  id?: string;
  slug?: string;
  key?: string;
  /** cms-records returns api_key / display_name. */
  api_key?: string;
  name?: string;
  display_name?: string;
  field_schema?: unknown;
}

const CONTENT_FIELD_TYPES = new Set<ResourceFieldType>(['text', 'textarea', 'richtext', 'number', 'image', 'boolean', 'url', 'email', 'json']);

export function contentTypeToResource(row: ContentTypeRow): ResourceDefinition | null {
  const slug = String(row.api_key ?? row.slug ?? row.key ?? '').trim();
  if (!slug) return null;
  const raw = Array.isArray(row.field_schema)
    ? row.field_schema
    : Array.isArray((row.field_schema as { fields?: unknown })?.fields) ? (row.field_schema as { fields: unknown[] }).fields : [];
  const schema: ResourceFieldDefinition[] = raw.flatMap((f) => {
    const o = f as Record<string, unknown>;
    const key = typeof o.key === 'string' ? o.key : typeof o.name === 'string' ? o.name : '';
    if (!key) return [];
    const t = String(o.type ?? 'text') as ResourceFieldType;
    return [{ key, label: String(o.label ?? key), type: CONTENT_FIELD_TYPES.has(t) ? t : 'text', required: o.required === true, editable: true }];
  });
  return {
    key: `content:${slug}`,
    kind: 'content',
    cardinality: 'collection',
    label: String(row.display_name ?? row.name ?? slug),
    schema,
    storage: { adapter: 'content', contentType: slug, contentTypeId: row.id ? String(row.id) : undefined },
    capabilities: { publishing: true, ordering: true },
    lifecycle: { statuses: CONTENT_STATUSES, publicStatus: 'published' },
  };
}

const contentDefs = new Map<string, ResourceDefinition>();

/** Replace the dynamic content definitions for the current business. */
export function registerContentTypes(rows: ContentTypeRow[]): ResourceDefinition[] {
  contentDefs.clear();
  for (const r of rows) {
    const d = contentTypeToResource(r);
    if (d) contentDefs.set(d.key, d);
  }
  return [...contentDefs.values()];
}

export function listResources(): ResourceDefinition[] {
  return [
    ...listCatalogSurfaces().filter((s) => s.editableFields.length > 0).map(catalogSurfaceToResource),
    ...contentDefs.values(),
    BUSINESS_PROFILE_RESOURCE,
  ];
}

export function getResource(key: string): ResourceDefinition | null {
  if (key === BUSINESS_PROFILE_RESOURCE_KEY) return BUSINESS_PROFILE_RESOURCE;
  if (key.startsWith('content:')) return contentDefs.get(key) ?? null;
  const surface = getCatalogSurface(key);
  return surface && surface.editableFields.length > 0 ? catalogSurfaceToResource(surface) : null;
}
