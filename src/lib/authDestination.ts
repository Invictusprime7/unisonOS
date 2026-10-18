import { supabase } from '@/integrations/supabase/client';

/** Shared password, OAuth and email-confirmation destination policy. */
export async function resolveAuthDestination(userId: string, isNewAccount = false): Promise<'/home' | '/demo'> {
  if (isNewAccount) return '/demo';
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const lookup = supabase.from('onboarding_state').select('completed')
      .eq('user_id', userId).abortSignal(controller.signal).maybeSingle()
      .then(({ data, error }) => error ? '/home' as const : data?.completed ? '/home' as const : '/demo' as const);
    const fallback = new Promise<'/home'>(resolve => {
      timer = setTimeout(() => { resolve('/home'); controller.abort(); }, 4000);
    });
    return await Promise.race([lookup, fallback]);
  } catch {
    return '/home';
  } finally {
    clearTimeout(timer);
  }
}
