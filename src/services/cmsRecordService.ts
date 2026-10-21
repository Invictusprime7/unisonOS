import { supabase } from '@/integrations/supabase/client';
import { getCatalogSurface, type CatalogSurface } from '@/platform/core/catalogSurfaceRegistry';

export type CmsRecordAction = 'list' | 'get' | 'create' | 'update' | 'delete';
export type ContentCmsAction =
  | 'content-type-list'
  | 'content-type-create'
  | 'content-type-update'
  | 'content-entry-list'
  | 'content-entry-get'
  | 'content-entry-create'
  | 'content-entry-update'
  | 'content-entry-transition'
  | 'content-entry-revisions';

export interface CmsRecordRequest {
  action: CmsRecordAction;
  businessId: string;
  projectId?: string | null;
  siteId?: string | null;
  resource: string;
  recordId?: string;
  values?: Record<string, unknown>;
  expected?: Record<string, unknown>;
}

interface CmsRecordResponse {
  success: boolean;
  resource: string;
  records?: Array<Record<string, unknown>>;
  record?: Record<string, unknown>;
  error?: string;
}

async function throwInvokeError(error: unknown, operation: string): Promise<never> {
  const invokeError = error as { message?: string; context?: unknown };
  const context = invokeError.context as Response | undefined;
  let detail: string | undefined;
  try {
    if (context && typeof context.json === 'function') {
      const body = await context.json() as { error?: unknown; message?: unknown };
      const message = body?.error ?? body?.message;
      if (typeof message === 'string' && message.trim()) detail = message.trim();
    }
  } catch {
    detail = undefined;
  }
  const status = context?.status;
  const statusText = typeof status === 'number' && status > 0 ? ` (${status})` : '';
  throw new Error(`${operation}${statusText}: ${detail || invokeError.message || 'CMS request failed'}`);
}

function resolveResource(resource: string): CatalogSurface {
  const surface = getCatalogSurface(resource);
  if (!surface || surface.editableFields.length === 0) {
    throw new Error(`Unknown or non-editable CMS resource: ${resource}`);
  }
  return surface;
}

export async function mutateCmsRecord(request: CmsRecordRequest): Promise<CmsRecordResponse> {
  const surface = resolveResource(request.resource);
  const { data, error } = await supabase.functions.invoke('cms-records', {
    body: {
      ...request,
      resource: surface.surfaceId,
      projectId: request.projectId ?? undefined,
      siteId: request.siteId ?? undefined,
    },
  });
  const response = (data ?? {}) as CmsRecordResponse;
  if (error) await throwInvokeError(error, `CMS ${request.action} ${request.resource}`);
  if (!response.success) throw new Error(response.error || 'CMS request failed');
  return response;
}

export async function listCmsRecords(input: {
  businessId: string;
  projectId?: string | null;
  siteId?: string | null;
  resource: string;
}): Promise<Array<Record<string, unknown>>> {
  const response = await mutateCmsRecord({ action: 'list', ...input });
  return response.records ?? [];
}

export async function getCmsRecord(input: {
  businessId: string;
  projectId?: string | null;
  siteId?: string | null;
  resource: string;
  recordId: string;
}): Promise<Record<string, unknown>> {
  const response = await mutateCmsRecord({ action: 'get', ...input });
  if (!response.record) throw new Error('CMS did not return the requested record');
  return response.record;
}

export async function createCmsRecord(input: {
  businessId: string;
  projectId?: string | null;
  siteId?: string | null;
  resource: string;
  values: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const response = await mutateCmsRecord({ action: 'create', ...input });
  if (!response.record) throw new Error('CMS did not return the created record');
  return response.record;
}

export async function updateCmsRecord(input: {
  businessId: string;
  projectId?: string | null;
  siteId?: string | null;
  resource: string;
  recordId: string;
  values: Record<string, unknown>;
  expected?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const response = await mutateCmsRecord({ action: 'update', ...input });
  if (!response.record) throw new Error('CMS did not return the updated record');
  return response.record;
}

export async function removeCmsRecord(input: {
  businessId: string;
  projectId?: string | null;
  siteId?: string | null;
  resource: string;
  recordId: string;
}): Promise<void> {
  await mutateCmsRecord({ action: 'delete', ...input });
}

export interface ContentCmsRequest {
  action: ContentCmsAction;
  businessId: string;
  projectId?: string | null;
  siteId?: string | null;
  recordId?: string;
  contentTypeId?: string;
  status?: 'draft' | 'review' | 'published' | 'archived';
  changeSummary?: string;
  expectedUpdatedAt?: string;
  idempotencyKey?: string;
  values?: Record<string, unknown>;
}

export async function mutateContentRecord(request: ContentCmsRequest): Promise<CmsRecordResponse> {
  const idempotentAction = ['content-entry-create', 'content-entry-update', 'content-entry-transition'].includes(request.action);
  const idempotencyKey = request.idempotencyKey ?? (idempotentAction ? crypto.randomUUID() : undefined);
  const { data, error } = await supabase.functions.invoke('cms-records', {
    body: {
      ...request,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      projectId: request.projectId ?? undefined,
      siteId: request.siteId ?? undefined,
    },
  });
  const response = (data ?? {}) as CmsRecordResponse;
  if (error) await throwInvokeError(error, `Content CMS ${request.action}`);
  if (!response.success) throw new Error(response.error || 'Content CMS request failed');
  return response;
}

export async function listContentRecords(input: Omit<ContentCmsRequest, 'action'>): Promise<Array<Record<string, unknown>>> {
  const response = await mutateContentRecord({ action: 'content-entry-list', ...input });
  return response.records ?? [];
}

export async function listContentTypes(input: Omit<ContentCmsRequest, 'action' | 'values'>): Promise<Array<Record<string, unknown>>> {
  const response = await mutateContentRecord({ action: 'content-type-list', ...input });
  return response.records ?? [];
}

export async function listContentRevisions(input: Omit<ContentCmsRequest, 'action' | 'values'>): Promise<Array<Record<string, unknown>>> {
  const response = await mutateContentRecord({ action: 'content-entry-revisions', ...input });
  return response.records ?? [];
}

export async function getContentRecord(input: Omit<ContentCmsRequest, 'action'>): Promise<Record<string, unknown>> {
  const response = await mutateContentRecord({ action: 'content-entry-get', ...input });
  if (!response.record) throw new Error('Content CMS did not return the requested entry');
  return response.record;
}

export async function createContentRecord(input: Omit<ContentCmsRequest, 'action'>): Promise<Record<string, unknown>> {
  const response = await mutateContentRecord({ action: 'content-entry-create', ...input });
  if (!response.record) throw new Error('Content CMS did not return the created entry');
  return response.record;
}

export async function updateContentRecord(input: Omit<ContentCmsRequest, 'action'>): Promise<Record<string, unknown>> {
  const response = await mutateContentRecord({ action: 'content-entry-update', ...input });
  if (!response.record) throw new Error('Content CMS did not return the updated entry');
  return response.record;
}

export async function transitionContentRecord(input: Omit<ContentCmsRequest, 'action'>): Promise<Record<string, unknown>> {
  const response = await mutateContentRecord({ action: 'content-entry-transition', ...input });
  if (!response.record) throw new Error('Content CMS did not return the transitioned entry');
  return response.record;
}