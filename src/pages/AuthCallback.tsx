/**
 * Auth Callback Page
 * 
 * Handles OAuth redirects and email confirmation callbacks.
 * Processes the auth tokens and redirects to the appropriate page.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { auditLogger } from '@/services/auditLogger';

type CallbackStatus = 'loading' | 'success' | 'error';

interface CallbackState {
  status: CallbackStatus;
  message: string;
  type?: 'signin' | 'signup' | 'recovery' | 'email_change';
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<CallbackState>({
    status: 'loading',
    message: 'Processing authentication...',
  });

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the hash fragment which contains the auth tokens
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type') as CallbackState['type'];
        const errorCode = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');

        // Handle error from OAuth provider
        if (errorCode) {
          setState({
            status: 'error',
            message: errorDescription || 'Authentication failed. Please try again.',
          });
          return;
        }

        // Handle different callback types
        if (type === 'recovery') {
          // Password recovery - redirect to reset password page
          navigate('/auth/reset-password', { replace: true });
          return;
        }

        if (type === 'email_change') {
          // Email change confirmation
          const { error } = await supabase.auth.refreshSession();
          if (error) {
            setState({
              status: 'error',
              message: 'Failed to confirm email change. Please try again.',
            });
            return;
          }

          await auditLogger.logSecurityEvent('mfa_enabled', {
            event: 'email_change_confirmed',
          }, 'medium');

          setState({
            status: 'success',
            message: 'Your email has been updated successfully!',
            type: 'email_change',
          });

          setTimeout(() => {
            navigate('/settings?tab=security', { replace: true });
          }, 2000);
          return;
        }

        // Handle signup/signin with tokens
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            setState({
              status: 'error',
              message: error.message || 'Failed to complete authentication.',
            });
            return;
          }

          await auditLogger.log({
            action: 'login',
            resourceType: 'user',
            metadata: { method: 'oauth' },
          });

          setState({
            status: 'success',
            message: type === 'signup' 
              ? 'Account created successfully! Redirecting...'
              : 'Signed in successfully! Redirecting...',
            type: type || 'signin',
          });

          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 1500);
          return;
        }

        // Check for existing session (email confirmation)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          setState({
            status: 'error',
            message: 'Failed to verify session. Please sign in again.',
          });
          return;
        }

        if (session) {
          await auditLogger.log({
            action: 'login',
            resourceType: 'user',
            metadata: { method: 'email_confirmation' },
          });

          setState({
            status: 'success',
            message: 'Email confirmed! Redirecting to dashboard...',
            type: 'signup',
          });

          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 1500);
          return;
        }

        // No tokens or session found
        setState({
          status: 'error',
          message: 'No authentication data found. Please try signing in again.',
        });
      } catch (err) {
        console.error('Auth callback error:', err);
        setState({
          status: 'error',
          message: 'An unexpected error occurred. Please try again.',
        });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {state.status === 'loading' && (
            <>
              <div className="mx-auto mb-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <CardTitle>Authenticating</CardTitle>
              <CardDescription>{state.message}</CardDescription>
            </>
          )}

          {state.status === 'success' && (
            <>
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>
                {state.type === 'signup' ? 'Welcome!' : 
                 state.type === 'email_change' ? 'Email Updated!' : 
                 'Welcome Back!'}
              </CardTitle>
              <CardDescription>{state.message}</CardDescription>
            </>
          )}

          {state.status === 'error' && (
            <>
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Authentication Failed</CardTitle>
              <CardDescription>{state.message}</CardDescription>
            </>
          )}
        </CardHeader>

        {state.status === 'error' && (
          <CardContent className="space-y-3">
            <Button onClick={() => navigate('/auth')} className="w-full">
              Try Again
            </Button>
            <Button variant="ghost" onClick={() => navigate('/')} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        )}

        {state.status === 'success' && (
          <CardContent>
            <div className="flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
