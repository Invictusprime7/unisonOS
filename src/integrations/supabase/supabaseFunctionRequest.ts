import { supabase } from './client';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './env';

export function getSupabaseFunctionUrl(functionName: string): string {
  const normalizedName = functionName.replace(/^\/+/, '');
  return `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/${normalizedName}`;
}

export async function getSupabaseFunctionHeaders(): Promise<Record<string, string>> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}