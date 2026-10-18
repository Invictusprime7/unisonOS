import { supabase } from '@/integrations/supabase/client';

const GUEST_USER_STORAGE_KEY = 'unison_guest_demo_user_id';

/** Remember the anonymous demo user so a later signup can claim their project. */
export function stashGuestDemoUser(userId: string | null, isAnonymous: boolean): void {
  try {
    if (isAnonymous && userId) {
      window.localStorage.setItem(GUEST_USER_STORAGE_KEY, userId);
    }
  } catch {
    // Storage unavailable; claiming is best-effort.
  }
}

export function peekGuestDemoUser(): string | null {
  try {
    return window.localStorage.getItem(GUEST_USER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export interface GuestDemoClaimResult {
  claimed: boolean;
  projectId: string | null;
}

/**
 * After signup/sign-in, transfer a previous guest demo project to the new
 * account. Best-effort: failures never block the auth flow.
 */
export async function claimGuestDemoIfNeeded(currentUserId: string): Promise<GuestDemoClaimResult> {
  const guestUserId = peekGuestDemoUser();
  if (!guestUserId || guestUserId === currentUserId) {
    return { claimed: false, projectId: null };
  }
  try {
    const { data, error } = await supabase.rpc('claim_guest_demo', { p_guest_user_id: guestUserId });
    if (error) return { claimed: false, projectId: null };
    const result = data as { claimed?: boolean; project_id?: string | null; reason?: string } | null;
    if (result?.claimed) {
      window.localStorage.removeItem(GUEST_USER_STORAGE_KEY);
      return { claimed: true, projectId: result.project_id ?? null };
    }
    if (result?.reason === 'already_claimed' || result?.reason === 'session_expired') {
      window.localStorage.removeItem(GUEST_USER_STORAGE_KEY);
    }
    return { claimed: false, projectId: null };
  } catch {
    return { claimed: false, projectId: null };
  }
}
