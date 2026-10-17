/**
 * Resource adapters — wrap the existing, working systems; never rewrite them.
 *   catalog          → cms-records function (catalog commands, business access rules)
 *   content          → cms-records content-entry commands (publishing lifecycle kept)
 *   business-profile → businessProfileService (businesses row, RLS-protected)
 */
import {
  createCmsRecord, listCmsRecords, removeCmsRecord, updateCmsRecord,
  createContentRecord, getContentRecord, listContentRecords, updateContentRecord,
} from '@/services/cmsRecordService';
import { loadSiteProfile, saveSiteProfile, type BusinessProfilePatch } from '@/services/businessProfileService';
import type { ResourceAdapter, ResourceAdapterId, ResourceDefinition, ResourceRecord } from './resourceTypes';

function withId(r: Record<string, unknown>): ResourceRecord {
  return { ...r, id: String(r.id ?? '') };
}

/** Only fields declared editable in the resource schema may be written. */
export function filterWritableValues(def: ResourceDefinition, values: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(def.schema.filter((f) => f.editable).map((f) => f.key));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) if (allowed.has(k)) out[k] = v;
  return out;
}

export const catalogResourceAdapter: ResourceAdapter = {
  async query(def, ctx) {
    const rows = await listCmsRecords({ businessId: ctx.businessId, projectId: ctx.projectId, resource: def.key });
    return rows.map(withId);
  },
  async get(def, ctx, id) {
    const rows = await this.query(def, ctx);
    return rows.find((r) => r.id === id) ?? null;
  },
  async create(def, ctx, values) {
    return withId(await createCmsRecord({ businessId: ctx.businessId, projectId: ctx.projectId, resource: def.key, values }));
  },
  async update(def, ctx, id, values, expected) {
    return withId(await updateCmsRecord({ businessId: ctx.businessId, projectId: ctx.projectId, resource: def.key, recordId: id, values, ...(expected ? { expected } : {}) }));
  },
  async delete(def, ctx, id) {
    await removeCmsRecord({ businessId: ctx.businessId, projectId: ctx.projectId, resource: def.key, recordId: id });
  },
};

/** Flatten a content entry: its field values live in `data`, lifecycle stays visible. */
export function flattenContentEntry(r: Record<string, unknown>): ResourceRecord {
  const data = r.data && typeof r.data === 'object' ? (r.data as Record<string, unknown>) : {};
  return { ...data, id: String(r.id ?? ''), status: r.status, slug: r.slug ?? data.slug, title: r.title ?? data.title };
}

export const contentResourceAdapter: ResourceAdapter = {
  async query(def, ctx) {
    const ids = def.storage.contentTypeIds?.length ? def.storage.contentTypeIds : [def.storage.contentTypeId];
    const rows = (await Promise.all(ids.map((contentTypeId) => listContentRecords({
      businessId: ctx.businessId, projectId: ctx.projectId, siteId: ctx.siteId,
      contentTypeId,
      // Published runtime never sees drafts — enforced here AND by the filter below.
      status: ctx.mode === 'published' ? 'published' : undefined,
    })))).flat();
    const flat = [...new Map(rows.map((row) => [String(row.id), flattenContentEntry(row)])).values()];
    return ctx.mode === 'published' ? flat.filter((r) => r.status === 'published') : flat;
  },
  async get(def, ctx, id) {
    const raw = await getContentRecord({ businessId: ctx.businessId, projectId: ctx.projectId, recordId: id });
    if (raw.content_type_id && def.storage.contentTypeIds?.length && !def.storage.contentTypeIds.includes(String(raw.content_type_id))) return null;
    const r = flattenContentEntry(raw);
    if (ctx.mode === 'published' && r.status !== 'published') return null;
    return r;
  },
  async create(def, ctx, values) {
    const { title, ...data } = values;
    return flattenContentEntry(await createContentRecord({
      businessId: ctx.businessId, projectId: ctx.projectId, siteId: ctx.siteId,
      contentTypeId: def.storage.contentTypeId, status: 'draft', values: { title: String(title ?? values.name ?? values.question ?? ''), data },
    }));
  },
  async update(def, ctx, id, values, expected) {
    const current = await getContentRecord({ businessId: ctx.businessId, projectId: ctx.projectId, recordId: id });
    const flat = flattenContentEntry(current);
    if (expected && Object.entries(expected).some(([key, seen]) => JSON.stringify(flat[key] ?? null) !== JSON.stringify(seen ?? null))) {
      throw new Error('Conflict: this content changed elsewhere. Reload the item and try again.');
    }
    const dataValues = Object.fromEntries(Object.entries(values).filter(([key]) => key !== 'title'));
    const data = { ...((current.data as Record<string, unknown>) ?? {}), ...dataValues };
    return flattenContentEntry(await updateContentRecord({
      businessId: ctx.businessId, projectId: ctx.projectId, recordId: id,
      // The content command requires the title on every update.
      values: { title: String(values.title ?? values.name ?? current.title ?? ''), slug: current.slug, locale: current.locale, data }, changeSummary: `Edited ${Object.keys(values).join(', ')}`,
    }));
  },
  // No delete: content leaves via the archive transition, preserving the publishing workflow.
};

export const businessProfileResourceAdapter: ResourceAdapter = {
  async query(def, ctx) {
    const r = await this.get(def, ctx, ctx.businessId);
    return r ? [r] : [];
  },
  async get(_def, ctx) {
    const p = await loadSiteProfile(ctx.businessId, ctx.projectId);
    return p ? ({ ...p, id: p.businessId } as unknown as ResourceRecord) : null;
  },
  async create() {
    throw new Error('The business profile already exists — edit it instead.');
  },
  async update(_def, ctx, id, values, expected) {
    if (id !== ctx.businessId) throw new Error('A business can only edit its own profile.');
    if (expected) {
      const current = await loadSiteProfile(ctx.businessId, ctx.projectId);
      if (!current) throw new Error('This profile is no longer available.');
      const fields = current as unknown as Record<string, unknown>;
      if (Object.entries(expected).some(([key, seen]) => JSON.stringify(fields[key] ?? null) !== JSON.stringify(seen ?? null))) {
        throw new Error('Conflict: these site details changed elsewhere. Reload the item and try again.');
      }
    }
    const next = await saveSiteProfile(ctx.businessId, ctx.projectId, values as BusinessProfilePatch);
    if (!next) throw new Error('The business profile could not be saved.');
    return { ...next, id: next.businessId } as unknown as ResourceRecord;
  },
};

export const RESOURCE_ADAPTERS: Record<ResourceAdapterId, ResourceAdapter> = {
  catalog: catalogResourceAdapter,
  content: contentResourceAdapter,
  'business-profile': businessProfileResourceAdapter,
};
