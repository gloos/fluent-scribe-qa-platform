import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ResetStatus } from '@/components/auth/password-reset/ResetStatusDisplay';

export const usePasswordResetToken = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<ResetStatus>('validating');

  // Get tokens from URL
  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  const type = searchParams.get('type');
  const token = searchParams.get('token');

  useEffect(() => {
    const checkExistingSession = async (): Promise<boolean> => {
      try {
        const { supabase } = await import('../lib/supabase');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session && !error) {
          setStatus('valid');
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error checking session:', error);
        return false;
      }
    };
    
    const setupSession = async (accessToken: string, refreshToken: string): Promise<void> => {
      try {
        const { supabase } = await import('../lib/supabase');
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) {
          console.error('Error setting recovery session:', error);
          setStatus('expired');
        } else {
          setStatus('valid');
        }
      } catch (error) {
        console.error('Unexpected error setting session:', error);
        setStatus('error');
      }
    };

    const handleTokenReset = async (token: string): Promise<void> => {
      try {
        const { supabase } = await import('../lib/supabase');
        
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'recovery'
        });

        if (error) {
          console.error('Error verifying reset token:', error);
          if (error.message.includes('expired') || error.message.includes('invalid')) {
            setStatus('expired');
          } else {
            setStatus('invalid');
          }
        } else if (data?.session) {
          setStatus('valid');
        } else {
          setStatus('invalid');
        }
      } catch (error) {
        console.error('Unexpected error verifying token:', error);
        setStatus('error');
      }
    };

    const processResetRequest = async (): Promise<void> => {
      // First, check if Supabase already detected and set up the session
      const hasValidSession = await checkExistingSession();
      if (hasValidSession) {
        return;
      }
      
      // Check if we have a token in the URL hash (most common Supabase approach)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashAccessToken = hashParams.get('access_token');
      const hashRefreshToken = hashParams.get('refresh_token');
      const hashType = hashParams.get('type');
      const hashToken = hashParams.get('token');

      // Try different token approaches in order of preference
      if (hashAccessToken && hashRefreshToken && hashType === 'recovery') {
        await setupSession(hashAccessToken, hashRefreshToken);
      } else if (accessToken && refreshToken && type === 'recovery') {
        await setupSession(accessToken, refreshToken);
      } else if (hashToken && hashType === 'recovery') {
        await handleTokenReset(hashToken);
      } else if (token && type === 'recovery') {
        await handleTokenReset(token);
      } else {
        setStatus('invalid');
      }
    };

    // Add a small delay to allow Supabase's detectSessionInUrl to work first
    const timer = setTimeout(() => {
      processResetRequest();
    }, 100);

    return () => clearTimeout(timer);
  }, [accessToken, refreshToken, type, token]);

  return { status, setStatus };
}; 