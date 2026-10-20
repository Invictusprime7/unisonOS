/** §28 — browser client for sites with their own database. Secrets stay server-side. */
import { supabase } from '@/integrations/supabase/client';

export type ProjectBackendAction = 'list' | 'get' | 'create' | 'update' | 'delete' | 'check';

export async function callProjectBackend<T = unknown>(req: {
  projectId: string; action: ProjectBackendAction; resource: string;
  recordId?: string; values?: Record<string, unknown>; expected?: Record<string, unknown>;
}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('project-backend', { body: req });
  if (error) {
    let detail: string | undefined;
    const response = error.context;
    if (response && typeof response.json === 'function') {
      try {
        const body = await response.json();
        if (typeof body?.error === 'string') detail = body.error;
      } catch { /* retain the transport error when no structured response exists */ }
    }
    throw new Error(detail || error.message || 'This site’s database could not be reached.');
  }
  if (!data?.success) throw new Error(data?.error || 'This site’s database could not be reached.');
  return data.data as T;
}
