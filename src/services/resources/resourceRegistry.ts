/**
 * ResourceRegistry — sits ABOVE catalogSurfaceRegistry (never replaces it).
 * Catalog surfaces and the Business Profile are registered statically;
 * content types are exposed dynamically from the content_types records.
 */
import { getCatalogSurface, listCatalogSurfaces, type CatalogFieldType, type CatalogSurface } from '@/platform/core/catalogSurfaceRegistry';
import type { ResourceDefinition, ResourceFieldDefinition, ResourceFieldType } from './resourceTypes';

export const BUSINESS_PROFILE_RESOURCE_KEY = 'business-profile';
export const CONTENT_STATUSES = ['draft', 'review', 'published', 'archived'] as const;

export type CanonicalRecordKind = 'testimonials' | 'projects' | 'case-studies' | 'faqs';
/** Content aliases are separate from renderer aliases: case_studies still renders portfolio cards. */
const CONTENT_RECORD_ALIASES: Record<CanonicalRecordKind, readonly string[]> = {
  testimonials: ['testimonials', 'testimonial', 'reviews', 'review', 'social-proof', 'socialproof', 'customer-reviews', 'customerreviews'],
  projects: ['projects', 'project', 'portfolio', 'portfolio-projects', 'work'],
  'case-studies': ['case-studies', 'case-study', 'casestudies', 'casestudy', 'caseStudies'],
  faqs: ['faq', 'faqs', 'frequently-asked-questions', 'frequently-asked-question', 'frequentlyaskedquestions', 'questions-and-answers', 'questions', 'q-and-a'],
};
const normalizeRecordAlias = (key: string) => key.replace(/^content:/i, '').trim().replace(/_/g, '-').toLowerCase();
export function resolveContentRecordKind(key: string): CanonicalRecordKind | null {
  const normalized = normalizeRecordAlias(key);
  return (Object.keys(CONTENT_RECORD_ALIASES) as CanonicalRecordKind[]).find((kind) => CONTENT_RECORD_ALIASES[kind].some((alias) => normalizeRecordAlias(alias) === normalized)) ?? null;
}
export function canonicalContentSlug(key: string): string {
  const kind = resolveContentRecordKind(key);
  return kind === 'faqs' ? 'faq' : kind ?? key.trim().replace(/_/g, '-');
}
export function canonicalRecordKind(def: ResourceDefinition): CanonicalRecordKind | null {
  if (def.kind === 'content') return resolveContentRecordKind(def.storage.contentType ?? def.key);
  if (def.key === 'testimonials') return 'testimonials';
  if (def.key === 'portfolio') return 'projects';
  return null;
}

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

const CONTENT_FIELD_TYPES = new Set<ResourceFieldType>(['text', 'textarea', 'richtext', 'number', 'image', 'boolean', 'url', 'email', 'json', 'tags']);

export function contentTypeToResource(row: ContentTypeRow): ResourceDefinition | null {
  const slug = canonicalContentSlug(String(row.api_key ?? row.slug ?? row.key ?? '').trim());
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
  if (!schema.some((field) => field.key === 'title')) schema.unshift({ key: 'title', label: 'Title', type: 'text', required: true, editable: true });
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
  for (const definition of projectContentTypes(rows)) contentDefs.set(definition.key, definition);
  return [...contentDefs.values()];
}

/** Job-local projection; never changes the UI's current CMS registry. */
export function projectContentTypes(rows: readonly ContentTypeRow[]): ResourceDefinition[] {
  const definitions = new Map<string, ResourceDefinition>();
  // Prefer the canonical spelling for future creates; retain every historical
  // type ID for reads. Never dedupe entries by title or destroy their revisions.
  for (const r of [...rows].sort((a, b) => {
    const score = (row: ContentTypeRow) => Number(String(row.api_key ?? row.slug ?? '') !== canonicalContentSlug(String(row.api_key ?? row.slug ?? '')));
    return score(a) - score(b) || String(a.id ?? '').localeCompare(String(b.id ?? ''));
  })) {
    const d = contentTypeToResource(r);
    if (!d) continue;
    const existing = definitions.get(d.key);
    if (!existing) {
      d.storage.contentTypeIds = d.storage.contentTypeId ? [d.storage.contentTypeId] : [];
      definitions.set(d.key, d);
    } else {
      if (d.storage.contentTypeId && !existing.storage.contentTypeIds?.includes(d.storage.contentTypeId)) existing.storage.contentTypeIds?.push(d.storage.contentTypeId);
      for (const field of d.schema) if (!existing.schema.some((f) => f.key === field.key)) existing.schema.push(field);
    }
  }
  return [...definitions.values()];
}

export function listResources(contentTypes?: readonly ContentTypeRow[]): ResourceDefinition[] {
  return [
    ...listCatalogSurfaces().filter((s) => s.editableFields.length > 0).map(catalogSurfaceToResource),
    ...(contentTypes === undefined ? [...contentDefs.values()] : projectContentTypes(contentTypes)),
    BUSINESS_PROFILE_RESOURCE,
  ];
}

/** Blank entry values belong to the selected schema, never another CMS family. */
export function resourceCreateDefaults(def: ResourceDefinition): Record<string, unknown> {
  const catalog = getCatalogSurface(def.key);
  if (catalog) return { ...catalog.newRowDefaults };
  const values: Record<string, unknown> = {};
  for (const field of def.schema.filter((field) => field.editable)) {
    if (field.key === 'title') values.title = `New ${def.label.toLowerCase()}`;
    else if (field.type === 'boolean') values[field.key] = false;
    else if (['number', 'rating', 'money', 'money-cents'].includes(field.type)) values[field.key] = 0;
    else if (field.type === 'tags') values[field.key] = [];
    else if (field.type === 'json') values[field.key] = {};
    else values[field.key] = '';
  }
  if (def.storage.contentType === 'faq') {
    values.title = 'New question';
    if (def.schema.some((field) => field.key === 'question')) values.question = 'New question';
  }
  return values;
}

export function getResource(key: string): ResourceDefinition | null {
  if (key === BUSINESS_PROFILE_RESOURCE_KEY) return BUSINESS_PROFILE_RESOURCE;
  if (key.startsWith('content:')) return contentDefs.get(`content:${canonicalContentSlug(key.slice('content:'.length))}`) ?? null;
  const surface = getCatalogSurface(key);
  return surface && surface.editableFields.length > 0 ? catalogSurfaceToResource(surface) : null;
}

/** Records navigation is derived from the authorities above, not another registry. */
export function listRecordCollections(): Array<{ kind: CanonicalRecordKind; label: string; resources: ResourceDefinition[] }> {
  const resources = listResources();
  return (['testimonials', 'projects', 'case-studies', 'faqs'] as const).map((kind) => ({
    kind,
    label: kind === 'case-studies' ? 'Case studies' : kind === 'faqs' ? 'FAQs' : kind === 'projects' ? 'Projects' : 'Testimonials',
    resources: resources.filter((def) => canonicalRecordKind(def) === kind),
  }));
}

/** Blank values for a new record, derived from the resource's declared schema. */
export function resourceCreateDefaults(def: ResourceDefinition): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of def.schema) {
    if (!field.editable) continue;
    if (field.key === 'title') {
      values.title = `New ${def.storage.contentType ?? def.label ?? def.key}`;
      continue;
    }
    switch (field.type) {
      case 'boolean': values[field.key] = false; break;
      case 'number':
      case 'money':
      case 'money-cents':
      case 'rating': values[field.key] = 0; break;
      case 'tags': values[field.key] = []; break;
      case 'json': values[field.key] = {}; break;
      default: values[field.key] = ''; break;
    }
  }
  return values;
}

/** Records navigation is derived from the authorities above, not another registry. */
/** Every collection family: four canonical record kinds plus each other registered collection under its own key. */
export type RecordCollectionKind = CanonicalRecordKind | string;
export function listRecordCollections(): Array<{ kind: RecordCollectionKind; label: string; resources: ResourceDefinition[] }> {
  const resources = listResources().filter((def) => def.cardinality === 'collection');
  const canonical = (['testimonials', 'projects', 'case-studies', 'faqs'] as const).map((kind) => ({
    kind: kind as RecordCollectionKind,
    label: kind === 'case-studies' ? 'Case studies' : kind === 'faqs' ? 'FAQs' : kind === 'projects' ? 'Projects' : 'Testimonials',
    resources: resources.filter((def) => canonicalRecordKind(def) === kind),
  }));
  const others = resources.filter((def) => !canonicalRecordKind(def))
    .sort((a, b) => a.label.localeCompare(b.label) || a.key.localeCompare(b.key))
    .map((def) => ({ kind: def.key as RecordCollectionKind, label: def.label, resources: [def] }));
  return [...canonical, ...others];
}
