/** §28 — browser client for sites with their own database. Secrets stay server-side. */
import { supabase } from '@/integrations/supabase/client';

export type ProjectBackendAction = 'list' | 'get' | 'create' | 'update' | 'delete';

export async function callProjectBackend<T = unknown>(req: {
  projectId: string; action: ProjectBackendAction; resource: string;
  recordId?: string; values?: Record<string, unknown>; expected?: Record<string, unknown>;
}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('project-backend', { body: req });
  if (error) throw new Error(error.message || 'This site’s database could not be reached.');
  if (!data?.success) throw new Error(data?.error || 'This site’s database could not be reached.');
  return data.data as T;
}
