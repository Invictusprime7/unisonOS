import {
  applyResourceOp,
  getResourceRecord,
  queryResource,
  validateResourceOp,
} from '@/services/resources/resourceRuntime';
import { getResource } from '@/services/resources/resourceRegistry';
import type { ResourceContext, ResourceDataOp } from '@/services/resources/resourceTypes';
import { projectBackendResolver } from './projectBackendResolver';
import type { ProjectBackendDescriptor } from './projectBackendTypes';

export type RuntimeActorKind = 'studio-user' | 'site-user' | 'visitor' | 'server';

export interface RuntimeContextV2 {
  protocolVersion: 2;
  projectId: string;
  siteId: string;
  businessId: string;
  /** Correlation only until the receiving store persists operation receipts. */
  operationId: string;
  /** Caller hint only; server authentication and membership checks remain authoritative. */
  actorKind: RuntimeActorKind;
  expectedRevisionId?: string;
}

export type BackendCommandV2 =
  | { kind: 'resource.list'; resourceKey: string; query?: Record<string, unknown> }
  | { kind: 'resource.get'; resourceKey: string; recordId: string }
  | { kind: 'resource.mutate'; resourceKey: string; action: 'create'; values: Record<string, unknown> }
  | { kind: 'resource.mutate'; resourceKey: string; action: 'update'; recordId: string; values: Record<string, unknown>; expectedRecordVersion?: string }
  | { kind: 'resource.mutate'; resourceKey: string; action: 'delete'; recordId: string }
  | { kind: 'asset.link'; assetId: string; targetId: string; property: string }
  | { kind: 'intent.execute'; intentId: string; payload: Record<string, unknown> }
  | { kind: 'runtime.health' };

export type BackendErrorCodeV2 =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'BACKEND_UNAVAILABLE'
  | 'CAPABILITY_NOT_INSTALLED'
  | 'INTERNAL'
  | 'UNSUPPORTED';

export type BackendResultV2<T> =
  | { ok: true; data: T; operationId: string; recordVersion?: string }
  | { ok: false; operationId: string; error: { code: BackendErrorCodeV2; message: string; retryable: boolean } };

type ResourceCommand = Extract<BackendCommandV2, { kind: `resource.${string}` }>;

function validIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateContext(context: RuntimeContextV2): void {
  if (!context || typeof context !== 'object') throw new ProtocolError('VALIDATION', 'A runtime context is required.');
  if (context.protocolVersion !== 2) throw new ProtocolError('VALIDATION', 'Unsupported runtime protocol version.');
  if (![context.projectId, context.siteId, context.businessId, context.operationId].every(validIdentity)) {
    throw new ProtocolError('VALIDATION', 'Project, site, business, and operation identities are required.');
  }
  if (context.operationId.length > 200) throw new ProtocolError('VALIDATION', 'operationId is too long.');
  if (!['studio-user', 'site-user', 'visitor', 'server'].includes(context.actorKind)) {
    throw new ProtocolError('VALIDATION', 'Unknown runtime actor kind.');
  }
}

function toResourceContext(context: RuntimeContextV2): ResourceContext {
  return {
    businessId: context.businessId,
    projectId: context.projectId,
    siteId: context.siteId,
    mode: context.actorKind === 'studio-user' || context.actorKind === 'server' ? 'builder' : 'published',
  };
}

class ProtocolError extends Error {
  constructor(readonly code: BackendErrorCodeV2, message: string) {
    super(message);
  }
}

function fail<T>(operationId: string, code: BackendErrorCodeV2, message: string, retryable = false): BackendResultV2<T> {
  return { ok: false, operationId, error: { code, message, retryable } };
}

function mapError(error: unknown): { code: BackendErrorCodeV2; message: string; retryable: boolean } {
  if (error instanceof ProtocolError) return { code: error.code, message: error.message, retryable: false };
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (/unauthorized|authentication required|sign in/.test(normalized)) return { code: 'UNAUTHORIZED', message, retryable: false };
  if (/forbidden|permission|don't have access|belongs to another|another site/.test(normalized)) return { code: 'FORBIDDEN', message, retryable: false };
  if (/not found|unknown resource/.test(normalized)) return { code: 'NOT_FOUND', message, retryable: false };
  if (/conflict|stale|version/.test(normalized)) return { code: 'CONFLICT', message, retryable: false };
  if (/could not find the function.*resolve_(?:project|published_site)_backend|resolve_(?:project|published_site)_backend.*does not exist/.test(normalized)) {
    return { code: 'BACKEND_UNAVAILABLE', message, retryable: false };
  }
  if (/(?:not|isn't) available|unsupported/.test(normalized)) return { code: 'UNSUPPORTED', message, retryable: false };
  if (/not ready|still being set up|could not be reached|temporarily unavailable|database setup failed/.test(normalized)) {
    return { code: 'BACKEND_UNAVAILABLE', message, retryable: true };
  }
  if (/invalid|editable field|already exists|can't be deleted|cannot be changed/.test(normalized)) {
    return { code: 'VALIDATION', message, retryable: false };
  }
  return { code: 'INTERNAL', message, retryable: false };
}

function buildResourceOp(command: Extract<BackendCommandV2, { kind: 'resource.mutate' }>): ResourceDataOp {
  if (command.action === 'create') return { op: 'create', resourceKey: command.resourceKey, values: command.values };
  const definition = getResource(command.resourceKey);
  if (!definition) throw new ProtocolError('NOT_FOUND', `Unknown resource "${command.resourceKey}".`);
  const ref = { resourceKey: definition.key, kind: definition.kind, catalogKind: definition.catalogKind, recordId: command.recordId };
  return command.action === 'update'
    ? { op: 'update', ref, values: command.values }
    : { op: 'delete', ref };
}

async function runResourceCommand(context: RuntimeContextV2, command: ResourceCommand): Promise<unknown> {
  const resourceKey = command.resourceKey;
  if (!getResource(resourceKey)) throw new ProtocolError('NOT_FOUND', `Unknown resource "${resourceKey}".`);
  const resourceContext = toResourceContext(context);

  if (command.kind === 'resource.list') {
    if (command.query && Object.keys(command.query).length > 0) {
      throw new ProtocolError('UNSUPPORTED', 'Resource filters are not supported by this runtime adapter yet.');
    }
    return queryResource(resourceKey, resourceContext);
  }
  if (command.kind === 'resource.get') {
    if (!validIdentity(command.recordId)) throw new ProtocolError('VALIDATION', 'A record ID is required.');
    return getResourceRecord(resourceKey, resourceContext, command.recordId);
  }

  if (context.actorKind !== 'studio-user' && context.actorKind !== 'server') {
    throw new ProtocolError('FORBIDDEN', 'Only studio operations can mutate resource records.');
  }
  if (command.action === 'update' && command.expectedRecordVersion) {
    throw new ProtocolError('UNSUPPORTED', 'Record-version checks are not supported by the current resource adapters.');
  }
  const op = buildResourceOp(command);
  const validation = validateResourceOp(op);
  if (validation.ok === false) throw new ProtocolError('VALIDATION', validation.reason);
  return applyResourceOp(op, resourceContext);
}

export async function executeBackendCommandV2<T = unknown>(
  context: RuntimeContextV2,
  command: BackendCommandV2,
): Promise<BackendResultV2<T>> {
  const operationId = typeof context?.operationId === 'string' ? context.operationId : '';
  try {
    validateContext(context);
    if (!command || typeof command !== 'object' || !('kind' in command)) {
      throw new ProtocolError('VALIDATION', 'A backend command is required.');
    }

    if (command.kind === 'runtime.health') {
      const backend: ProjectBackendDescriptor = await projectBackendResolver.resolve(context.projectId);
      if (backend.siteId && backend.siteId !== context.siteId) {
        throw new ProtocolError('FORBIDDEN', 'The project is bound to a different site.');
      }
      if (backend.status !== 'ready') {
        throw new ProtocolError('BACKEND_UNAVAILABLE', 'The project backend is not ready.');
      }
      return { ok: true, operationId, data: { mode: backend.mode, status: backend.status } as T };
    }

    if (command.kind === 'asset.link' || command.kind === 'intent.execute') {
      return fail(operationId, 'UNSUPPORTED', `${command.kind} is not wired to a v2 domain adapter yet.`);
    }

    return { ok: true, operationId, data: await runResourceCommand(context, command) as T };
  } catch (error) {
    const mapped = mapError(error);
    return fail(operationId, mapped.code, mapped.message, mapped.retryable);
  }
}

export function runtimeContextFromResourceContext(context: ResourceContext): RuntimeContextV2 | null {
  if (![context.projectId, context.siteId, context.businessId].every(validIdentity)) return null;
  return {
    protocolVersion: 2,
    projectId: context.projectId,
    siteId: context.siteId,
    businessId: context.businessId,
    operationId: newRuntimeOperationId(),
    actorKind: context.mode === 'builder' ? 'studio-user' : 'visitor',
  };
}

export async function executeResourceCommandCompatible<T>(
  context: ResourceContext,
  command: BackendCommandV2,
  legacy: () => Promise<T>,
): Promise<T> {
  const runtimeContext = runtimeContextFromResourceContext(context);
  if (!runtimeContext) return legacy();
  const result = await executeBackendCommandV2<T>(runtimeContext, command);
  if (result.ok === false) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.data;
}

export function newRuntimeOperationId(): string {
  return crypto.randomUUID();
}