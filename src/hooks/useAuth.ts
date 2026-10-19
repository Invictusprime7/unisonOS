/**
 * Enterprise Authentication Hook
 * 
 * Provides authentication state and methods for:
 * - Session management
 * - Login/Logout
 * - Password reset
 * - Profile access
 * - Security event logging
 */

import { useState, useEffect, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { auditLogger } from '@/services/auditLogger';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: AuthError | null;
}

export interface SignUpOptions {
  email: string;
  password: string;
  fullName?: string;
  organizationName?: string;
}

export interface SignInOptions {
  email: string;
  password: string;
}

export interface PasswordResetOptions {
  email: string;
  redirectTo?: string;
}

export interface UpdatePasswordOptions {
  newPassword: string;
}

export interface AuthActions {
  signUp: (options: SignUpOptions) => Promise<{ error: AuthError | null }>;
  signIn: (options: SignInOptions) => Promise<{ error: AuthError | null }>;
  signInWithOAuth: (provider: 'google' | 'github' | 'azure') => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPassword: (options: PasswordResetOptions) => Promise<{ error: AuthError | null }>;
  updatePassword: (options: UpdatePasswordOptions) => Promise<{ error: AuthError | null }>;
  refreshSession: () => Promise<void>;
}

export function useAuth(): AuthState & AuthActions {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });

  // Initialize auth state
  useEffect(() => {
    let active = true;
    let receivedAuthEvent = false;
    const auditTimers = new Set<ReturnType<typeof setTimeout>>();
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!active || receivedAuthEvent) return;
        
        if (error) {
          setState(prev => ({ ...prev, loading: false, error }));
          return;
        }

        setState({
          user: session?.user ?? null,
          session,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (!active || receivedAuthEvent) return;
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: err as AuthError 
        }));
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;
        receivedAuthEvent = true;
        setState(prev => ({
          ...prev,
          user: session?.user ?? null,
          session,
          loading: false,
        }));

        // Never await auth-backed audit work under the SDK's session lock.
        const timer = setTimeout(() => {
          auditTimers.delete(timer);
          if (!active) return;
        if (event === 'SIGNED_IN') {
          void auditLogger.log({
            action: 'login',
            resourceType: 'user',
            resourceId: session?.user?.id,
            metadata: { method: 'password' }
          });
        } else if (event === 'SIGNED_OUT') {
          void auditLogger.log({
            action: 'logout',
            resourceType: 'user',
          });
        } else if (event === 'PASSWORD_RECOVERY') {
          void auditLogger.logSecurityEvent('password_change', {
            event: 'password_recovery_initiated'
          }, 'medium');
        }
        }, 0);
        auditTimers.add(timer);
      }
    );

    return () => {
      active = false;
      auditTimers.forEach(clearTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // Sign up with email and password
  const signUp = useCallback(async (options: SignUpOptions) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    const { data, error } = await supabase.auth.signUp({
      email: options.email,
      password: options.password,
      options: {
        data: {
          full_name: options.fullName,
          organization_name: options.organizationName,
        },
      },
    });

    if (error) {
      setState(prev => ({ ...prev, loading: false, error }));
      await auditLogger.logSecurityEvent('login_failure', {
        email: options.email,
        reason: error.message,
        event: 'signup_failed'
      }, 'medium');
    } else {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        user: data.user,
        session: data.session 
      }));
    }

    return { error };
  }, []);

  // Sign in with email and password
  const signIn = useCallback(async (options: SignInOptions) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    const { data, error } = await supabase.auth.signInWithPassword({
      email: options.email,
      password: options.password,
    });

    if (error) {
      setState(prev => ({ ...prev, loading: false, error }));
      await auditLogger.logSecurityEvent('login_failure', {
        email: options.email,
        reason: error.message
      }, 'medium');
    } else {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        user: data.user,
        session: data.session 
      }));
    }

    return { error };
  }, []);

  // Sign in with OAuth provider
  const signInWithOAuth = useCallback(async (provider: 'google' | 'github' | 'azure') => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setState(prev => ({ ...prev, loading: false, error }));
      await auditLogger.logSecurityEvent('login_failure', {
        provider,
        reason: error.message
      }, 'medium');
    }

    return { error };
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    const { error } = await supabase.auth.signOut();

    if (error) {
      setState(prev => ({ ...prev, loading: false, error }));
    } else {
      setState({
        user: null,
        session: null,
        loading: false,
        error: null,
      });
    }

    return { error };
  }, []);

  // Request password reset email
  const resetPassword = useCallback(async (options: PasswordResetOptions) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    const { error } = await supabase.auth.resetPasswordForEmail(options.email, {
      redirectTo: options.redirectTo || `${window.location.origin}/auth/reset-password`,
    });

    setState(prev => ({ ...prev, loading: false, error }));

    if (!error) {
      await auditLogger.logSecurityEvent('password_change', {
        email: options.email,
        event: 'reset_requested'
      }, 'low');
    }

    return { error };
  }, []);

  // Update password (after reset or when logged in)
  const updatePassword = useCallback(async (options: UpdatePasswordOptions) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    const { error } = await supabase.auth.updateUser({
      password: options.newPassword,
    });

    setState(prev => ({ ...prev, loading: false, error }));

    if (!error) {
      await auditLogger.logSecurityEvent('password_change', {
        event: 'password_updated'
      }, 'medium');
    }

    return { error };
  }, []);

  // Refresh session
  const refreshSession = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    // Retryable failures are not sign-out; the SDK emits definitive removal.
    if (error || !session) {
      setState(prev => ({ ...prev, error: error ?? prev.error }));
      return;
    }
    setState(prev => ({
      ...prev,
      session,
      user: session?.user ?? null,
    }));
  }, []);

  return {
    ...state,
    signUp,
    signIn,
    signInWithOAuth,
    signOut,
    resetPassword,
    updatePassword,
    refreshSession,
  };
}

/**
 * Hook to get the current user ID
 */
export function useUserId(): string | null {
  const { user } = useAuth();
  return user?.id ?? null;
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { user, loading } = useAuth();
  return !loading && user !== null;
}

/**
 * Hook to require authentication (redirects if not authenticated)
 */
export function useRequireAuth(redirectTo: string = '/login'): AuthState {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      window.location.href = redirectTo;
    }
  }, [auth.loading, auth.user, redirectTo]);

  return auth;
}
