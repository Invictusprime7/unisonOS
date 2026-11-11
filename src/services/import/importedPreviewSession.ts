import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_REMOTE_URL } from '@/integrations/supabase/env';
import { isImportRecordPath, toVfsPath, type ImportedSourceRecords } from './importedSourceRecords';

const MAX_FILE_BYTES = 1_000_000;
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const SESSION_ID = /^[a-zA-Z0-9_-]{8,128}$/;

function previewApiBase(): string {
  const explicit = import.meta.env.VITE_PREVIEW_API_URL;
  const legacyGateway = import.meta.env.DEV === true ? import.meta.env.VITE_PREVIEW_GATEWAY_URL : '';
  const configured = explicit || legacyGateway;
  if (!configured) return '/api/preview';
  const base = configured.replace(/\/+$/, '');
  return /\/api\/preview$/i.test(base) ? base : `${base}/api/preview`;
}

export interface ImportedPreviewSession {
  id: string;
  iframeUrl: string;
  status: 'starting' | 'running';
}

function safeIframeUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Preview worker returned no preview URL.');
  const url = new URL(value, typeof window === 'undefined' ? 'https://localhost' : window.location.origin);
  const isLocalHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !isLocalHttp) throw new Error('Preview worker returned an unsafe preview URL.');
  if (url.username || url.password) throw new Error('Preview worker returned an invalid preview URL.');
  if (typeof window !== 'undefined' && url.origin === window.location.origin) {
    throw new Error('Imported preview must use a separate origin from the Unison application.');
  }
  return url.toString();
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token
    ? { Authorization: `Bearer ${data.session.access_token}` }
    : {};
}

function sourceFiles(files: Record<string, string>): Record<string, string> {
  const source: Record<string, string> = {};
  for (const [rawPath, content] of Object.entries(files)) {
    const path = toVfsPath(rawPath);
    if (isImportRecordPath(path)) continue;
    const segments = path.split('/').filter(Boolean);
    const name = segments[segments.length - 1] ?? '';
    if (segments.includes('.git') || segments.includes('node_modules')) continue;
    if (/^\.env(?:\.|$)/i.test(name) && !/^\.env\.(?:example|sample|template)$/i.test(name)) continue;
    if (!content || typeof content !== 'string') continue;
    if (path.split('/').some((part) => part === '..')) throw new Error(`Unsafe imported file path: ${path}`);
    if (new TextEncoder().encode(content).byteLength > MAX_FILE_BYTES) {
      throw new Error(`Imported file exceeds the preview limit: ${path}`);
    }
    source[path] = content;
  }
  if (Object.keys(source).length === 0) throw new Error('The imported project has no source files to preview.');
  return source;
}

function safeAssetUrl(value: string): string {
  const url = new URL(value);
  const storageHost = new URL(SUPABASE_REMOTE_URL).hostname;
  if (url.protocol !== 'https:' || url.hostname !== storageHost || url.username || url.password) {
    throw new Error('Imported preview assets must use signed URLs from the configured Supabase project.');
  }
  return url.toString();
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await response.json();
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

/** Starts an isolated worker with original source files; no canonical preview rewrite is applied. */
export async function startImportedPreviewSession(input: {
  projectId: string;
  records: ImportedSourceRecords;
  files: Record<string, string>;
  assetUrls?: Record<string, string>;
}): Promise<ImportedPreviewSession> {
  if (!input.projectId.trim()) throw new Error('A project identity is required to start imported preview.');
  const files = sourceFiles(input.files);
  const startScript = ['dev', 'start'].find((name) => Boolean(input.records.profile.scripts[name])) ?? null;
  if (!startScript) throw new Error(`${input.records.profile.framework} has no detected dev, start, or preview script.`);

  const assets = input.records.assets.assets.flatMap((asset) => {
    const url = input.assetUrls?.[toVfsPath(asset.path)];
    return asset.status === 'stored' && url ? [{ path: toVfsPath(asset.path), url: safeAssetUrl(url), mime: asset.mime }] : [];
  });
  const payload = {
    projectId: input.projectId,
    files,
    importedRuntime: {
      protocolVersion: 1,
      framework: input.records.profile.framework,
      packageManager: input.records.profile.packageManager,
      startScript,
      entrypoints: input.records.profile.entrypoints,
    },
    assets,
  };
  const body = JSON.stringify(payload);
  if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) {
    throw new Error('Imported project is too large for this preview gateway.');
  }

  const response = await fetch(`${previewApiBase()}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    credentials: 'same-origin',
    body,
  });
  const result = await responseJson(response);
  if (!response.ok || result.success !== true) {
    const reason = typeof result.error === 'string' ? result.error : `Preview worker request failed (${response.status}).`;
    if (response.status === 410) throw new Error('No isolated preview worker is configured in this environment.');
    if (response.status === 404) throw new Error('The isolated preview API is not available in this environment.');
    throw new Error(reason);
  }

  const session = result.session as Record<string, unknown> | undefined;
  if (!session || typeof session.id !== 'string' || !SESSION_ID.test(session.id)) {
    throw new Error('Preview worker returned an invalid session.');
  }
  if (session.status !== 'starting' && session.status !== 'running') {
    throw new Error('Preview worker did not start the imported project.');
  }
  return { id: session.id, iframeUrl: safeIframeUrl(session.iframeUrl), status: session.status };
}

export async function stopImportedPreviewSession(sessionId: string): Promise<void> {
  if (!SESSION_ID.test(sessionId)) return;
  await fetch(`${previewApiBase()}/${sessionId}/stop`, {
    method: 'POST',
    headers: await authHeaders(),
    credentials: 'same-origin',
  });
}