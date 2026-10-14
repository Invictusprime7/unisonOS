import type { CatalogKind } from '@/platform/core/catalogSurfaceRegistry';

/**
 * Unified Resource Runtime — type contracts (milestone 2026-10-08, Phase 1).
 *
 * Catalog, Content and Business Profile share these mechanics; each keeps its
 * own storage adapter, schema and semantics. Storage is never inferred from
 * `kind` — it is adapter-defined.
 */
export type ResourceKind = 'catalog' | 'content' | 'business-profile';
export type ResourceCardinality = 'collection' | 'single-record';
export type ResourceAdapterId = 'catalog' | 'content' | 'business-profile';

export type ResourceFieldType =
  | 'text' | 'textarea' | 'richtext' | 'number' | 'money' | 'money-cents'
  | 'image' | 'boolean' | 'rating' | 'email' | 'phone' | 'url' | 'json';

export interface ResourceFieldDefinition {
  key: string;
  label: string;
  type: ResourceFieldType;
  required?: boolean;
  /** Field can be edited from WYSIWYG / AI. */
  editable: boolean;
}

export interface ResourceCapabilities {
  commerce?: boolean;
  booking?: boolean;
  publishing?: boolean;
  ordering?: boolean;
  featured?: boolean;
}

export interface ResourceStorageDefinition {
  adapter: ResourceAdapterId;
  /** Physical table (catalog/profile) — informational only. */
  table?: string;
  /** Content type slug for content resources. */
  contentType?: string;
  /** content_types.id, required by the content command gateway. */
  contentTypeId?: string;
}

export interface ResourceDefinition {
  key: string;
  kind: ResourceKind;
  /** Catalog subtype from the canonical catalog surface registry. */
  catalogKind?: CatalogKind;
  cardinality: ResourceCardinality;
  label: string;
  schema: ResourceFieldDefinition[];
  storage: ResourceStorageDefinition;
  capabilities?: ResourceCapabilities;
  rendererFamilies?: string[];
  /** Content lifecycle; catalog/profile have none. */
  lifecycle?: { statuses: readonly string[]; publicStatus: string };
}

export type ResourceRecord = Record<string, unknown> & { id: string };

/** Identity of one rendered field of one record — what WYSIWYG clicks resolve to. */
export interface ResourceEntityRef {
  resourceKey: string;
  kind: ResourceKind;
  /** Precise catalog object type; absent only on legacy serialized refs. */
  catalogKind?: CatalogKind;
  recordId: string;
  field?: string;
}

export type ResourceRuntimeMode = 'builder' | 'published';

export interface ResourceContext {
  businessId: string;
  projectId?: string | null;
  siteId?: string | null;
  /** Builder preview may read drafts; published runtime reads published only. */
  mode: ResourceRuntimeMode;
}

export type ResourceDataOp =
  | { op: 'update'; ref: ResourceEntityRef; values: Record<string, unknown> }
  | { op: 'create'; resourceKey: string; values: Record<string, unknown> }
  | { op: 'delete'; ref: ResourceEntityRef };

export interface ResourceAdapter {
  query(def: ResourceDefinition, ctx: ResourceContext): Promise<ResourceRecord[]>;
  get(def: ResourceDefinition, ctx: ResourceContext, id: string): Promise<ResourceRecord | null>;
  create(def: ResourceDefinition, ctx: ResourceContext, values: Record<string, unknown>): Promise<ResourceRecord>;
  update(def: ResourceDefinition, ctx: ResourceContext, id: string, values: Record<string, unknown>): Promise<ResourceRecord>;
  delete?(def: ResourceDefinition, ctx: ResourceContext, id: string): Promise<void>;
}

export interface ResourceInvalidation {
  resourceKey: string;
  kind: ResourceKind;
  businessId: string;
  /** Owning site; live previews of other sites ignore the invalidation. */
  projectId?: string | null;
  recordIds: string[];
  /** Storage tables touched, so live sections bound to them refresh (and only them). */
  sourceTables?: string[];
}
