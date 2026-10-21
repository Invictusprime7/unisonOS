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
import { supabase as rawSupabase } from '@/integrations/supabase/client';
import { loadSiteProfile, saveSiteProfile, type BusinessProfilePatch } from '@/services/businessProfileService';
import type { ResourceAdapter, ResourceAdapterId, ResourceContext, ResourceDefinition, ResourceRecord } from './resourceTypes';

const supabase: any = rawSupabase;

function withId(r: Record<string, unknown>): ResourceRecord {
  return { ...r, id: String(r.id ?? '') };
}

function fromCrmStorage(def: ResourceDefinition, row: Record<string, unknown>): ResourceRecord {
  const record = withId(row);
  if (def.key === 'crm:leads') record.status = row.stage ?? row.status ?? 'new';
  return record;
}

function toCrmStorage(def: ResourceDefinition, values: Record<string, unknown>): Record<string, unknown> {
  const safeValues = filterWritableValues(def, values);
  if (def.key === 'crm:leads' && Object.prototype.hasOwnProperty.call(safeValues, 'status')) {
    safeValues.stage = safeValues.status;
    delete safeValues.status;
  }
  return safeValues;
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
  return { ...data, id: String(r.id ?? ''), status: r.status, slug: r.slug ?? data.slug, title: r.title ?? data.title, updated_at: r.updated_at };
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
      expectedUpdatedAt: String(current.updated_at ?? ''),
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
    const next = await saveSiteProfile(ctx.businessId, ctx.projectId, values as BusinessProfilePatch, expected);
    if (!next) throw new Error('The business profile could not be saved.');
    return { ...next, id: next.businessId } as unknown as ResourceRecord;
  },
};

function requireCrmScope(ctx: ResourceContext, def: ResourceDefinition): void {
  if (!ctx.projectId && !ctx.businessId) throw new Error('CRM records require a selected business or project.');
  if (!def.storage.table) throw new Error(`${def.label} has no CRM table binding.`);
}

function applyCrmScope(query: any, ctx: ResourceContext, def: ResourceDefinition): any {
  if (ctx.businessId) query = query.eq('business_id', ctx.businessId);
  if (ctx.projectId && def.key === 'crm:contacts' && ctx.businessId) {
    return query.or(`project_id.eq.${ctx.projectId},project_id.is.null`);
  }
  if (ctx.projectId) query = query.eq('project_id', ctx.projectId);
  return query;
}

async function invokeCrmCommand(input: {
  resource: string;
  action: 'create' | 'update' | 'delete';
  recordId?: string;
  businessId: string;
  projectId?: string | null;
  values?: Record<string, unknown>;
  expected?: Record<string, unknown>;
}): Promise<{ record?: Record<string, unknown>; deleted?: true }> {
  const { data, error } = await supabase.functions.invoke('crm-command', { body: input });
  if (error) throw error;
  const response = data as { success?: boolean; error?: string; record?: Record<string, unknown>; deleted?: true } | null;
  if (!response?.success) throw new Error(response?.error || 'CRM command failed.');
  return response;
}

export const crmResourceAdapter: ResourceAdapter = {
  async query(def, ctx) {
    requireCrmScope(ctx, def);
    const query = applyCrmScope(supabase
      .from(def.storage.table)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100), ctx, def);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => fromCrmStorage(def, row));
  },
  async get(def, ctx, id) {
    requireCrmScope(ctx, def);
    const query = applyCrmScope(supabase
      .from(def.storage.table)
      .select('*')
      .eq('id', id)
      .maybeSingle(), ctx, def);
    const { data, error } = await query;
    if (error) throw error;
    return data ? fromCrmStorage(def, data) : null;
  },
  async create(def, ctx, values) {
    requireCrmScope(ctx, def);
    const safeValues = toCrmStorage(def, values);
    if (!Object.keys(safeValues).length) throw new Error(`No editable ${def.label.toLowerCase()} fields were provided.`);
    const response = await invokeCrmCommand({
      resource: def.key.replace(/^crm:/, ''),
      action: 'create',
      businessId: ctx.businessId,
      projectId: ctx.projectId,
      values: safeValues,
    });
    if (!response.record) throw new Error('CRM command did not return the created record.');
    return fromCrmStorage(def, response.record);
  },
  async update(def, ctx, id, values, expected) {
    requireCrmScope(ctx, def);
    const safeValues = toCrmStorage(def, values);
    if (!Object.keys(safeValues).length) throw new Error(`No editable ${def.label.toLowerCase()} fields were provided.`);
    const response = await invokeCrmCommand({
      resource: def.key.replace(/^crm:/, ''),
      action: 'update',
      recordId: id,
      businessId: ctx.businessId,
      projectId: ctx.projectId,
      values: safeValues,
      expected,
    });
    if (!response.record) throw new Error(`This ${def.label.slice(0, -1).toLowerCase()} changed elsewhere or is no longer in this project. Refresh and try again.`);
    return fromCrmStorage(def, response.record);
  },
  async delete(def, ctx, id) {
    requireCrmScope(ctx, def);
    await invokeCrmCommand({
      resource: def.key.replace(/^crm:/, ''),
      action: 'delete',
      recordId: id,
      businessId: ctx.businessId,
      projectId: ctx.projectId,
    });
  },
};

export const RESOURCE_ADAPTERS: Record<ResourceAdapterId, ResourceAdapter> = {
  catalog: catalogResourceAdapter,
  content: contentResourceAdapter,
  'business-profile': businessProfileResourceAdapter,
  crm: crmResourceAdapter,
};
