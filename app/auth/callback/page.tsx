'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ensureUserRow,
  ensureGuardProfile,
  ensureClientProfile,
  ensureSubscriptionRow,
} from '@/lib/auth-helpers';
import { useRouter } from 'next/navigation';
import { sanitizeRedirectPath, clearBadStoredRedirects } from '@/lib/safe-redirect';

function CallbackContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const hasExchanged = useRef(false);
  const hasRun = useRef(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const extractNames = (metadata: any) => {
    const firstName =
      metadata?.first_name ||
      metadata?.given_name ||
      metadata?.name?.split(' ')[0] ||
      metadata?.full_name?.split(' ')[0] ||
      '';
    const lastName =
      metadata?.last_name ||
      metadata?.family_name ||
      metadata?.name?.split(' ').slice(1).join(' ') ||
      metadata?.full_name?.split(' ').slice(1).join(' ') ||
      '';
    const fullName = `${firstName} ${lastName}`.trim() || metadata?.full_name || metadata?.name || '';
    return { firstName, lastName, fullName };
  };

  const handleRedirect = async (session: any, params: URLSearchParams, intent: any) => {
    const errorParam = params.get('error');
    const errorDescription = params.get('error_description');
    const type = params.get('type');
    const next = params.get('next');
    const isNewUser = intent?.isNewUser ?? (params.get('new') === 'true');

    if (errorParam) throw new Error(errorDescription || errorParam);
    if (!session) throw new Error('No session available for redirect.');

    const userId = session.user.id;
    const userEmail = session.user.email;
    const meta = session.user.user_metadata;
    const metadataRole = meta?.role || meta?.user_type;

    if (type === 'recovery') {
      setStatus('success');
      setMessage('Identity verified. Redirecting to reset your password...');
      setTimeout(() => {
        if (metadataRole === 'client') {
          router.push('/client/reset-password');
        } else {
          router.push('/guard/reset-password');
        }
      }, 1500);
      return;
    }

    if (next) {
      const safeNext = sanitizeRedirectPath(next, 'guard', '/guard/dashboard');
      setStatus('success');
      setMessage('Authenticated! Redirecting...');
      setTimeout(() => { router.push(safeNext); }, 1500);
      return;
    }

    const userType: 'guard' | 'client' =
      (type === 'guard' || type === 'client') ? type :
      (intent?.type === 'guard' || intent?.type === 'client') ? intent.type :
      (metadataRole === 'guard' || metadataRole === 'client') ? metadataRole :
      'guard';

    if (isNewUser || intent?.type) {
      const { fullName } = extractNames(meta);
      await ensureUserRow(userId, userEmail, userType, fullName);

      if (userType === 'guard') {
        const { profile: existing } = await ensureGuardProfile(userId, userEmail, meta);
        await ensureSubscriptionRow(userId, 'guard');
        clearBadStoredRedirects();
        const storedRedirect = sessionStorage.getItem('post_auth_redirect');
        if (storedRedirect) {
          sessionStorage.removeItem('post_auth_redirect');
          const safeRedirect = sanitizeRedirectPath(storedRedirect, 'guard', '/guard/dashboard');
          setStatus('success');
          setMessage('Account ready! Redirecting...');
          setTimeout(() => { router.push(safeRedirect); }, 1500);
          return;
        }
        setStatus('success');
        setMessage('Account created successfully! Redirecting...');
        setTimeout(() => {
          if (existing?.profile_completed) {
            const vs = (existing as any).verification_status;
            if (vs === 'approved' || vs === 'verified') {
              router.push('/guard/dashboard');
            } else if (vs === 'rejected') {
              router.push('/guard/verification-failed');
            } else {
              router.push('/guard/onboarding');
            }
          } else {
            router.push('/guard/complete-profile-wizard');
          }
        }, 2500);
        return;
      } else {
        const { profile: existing } = await ensureClientProfile(userId, userEmail, meta);
        await ensureSubscriptionRow(userId, 'client');
        clearBadStoredRedirects();
        const storedRedirect = sessionStorage.getItem('post_auth_redirect');
        if (storedRedirect) {
          sessionStorage.removeItem('post_auth_redirect');
          const safeRedirect = sanitizeRedirectPath(storedRedirect, 'client', '/client/dashboard');
          setStatus('success');
          setMessage('Account ready! Redirecting...');
          setTimeout(() => { router.push(safeRedirect); }, 1500);
          return;
        }
        setStatus('success');
        setMessage('Account created successfully! Redirecting...');
        setTimeout(() => {
          router.push(existing?.profile_completed ? '/client/onboarding' : '/client/complete-profile-wizard');
        }, 2500);
        return;
      }
    }

    if (intent?.type === 'client') {
      const { fullName } = extractNames(meta);
      await ensureUserRow(userId, userEmail, 'client', fullName);
      const { created, profile } = await ensureClientProfile(userId, userEmail, meta);
      await ensureSubscriptionRow(userId, 'client');
      setStatus('success');
      setMessage(created ? 'Client account created! Redirecting...' : 'Signed in successfully! Redirecting...');
      setTimeout(() => {
        router.push(profile?.profile_completed ? (created ? '/client/onboarding' : '/client/dashboard') : '/client/complete-profile-wizard');
      }, created ? 2500 : 1500);
      return;
    }

    if (intent?.type === 'guard') {
      const { fullName } = extractNames(meta);
      await ensureUserRow(userId, userEmail, 'guard', fullName);
      const { created, profile } = await ensureGuardProfile(userId, userEmail, meta);
      await ensureSubscriptionRow(userId, 'guard');
      setStatus('success');
      setMessage(created ? 'Guard account created! Redirecting...' : 'Signed in successfully! Redirecting...');
      setTimeout(() => {
        if (!profile?.profile_completed) {
          router.push('/guard/complete-profile-wizard');
        } else if ((profile as any)?.verification_status === 'rejected') {
          router.push('/guard/verification-failed');
        } else if ((profile as any)?.verification_status === 'approved' || (profile as any)?.verification_status === 'verified') {
          router.push('/guard/dashboard');
        } else {
          router.push('/guard/onboarding');
        }
      }, created ? 2500 : 1500);
      return;
    }

    const effectiveRole = metadataRole || userType;

    if (effectiveRole === 'client') {
      const { data: clientData } = await supabase
        .from('clients')
        .select('profile_completed')
        .eq('user_id', userId)
        .maybeSingle();
      if (clientData) {
        setStatus('success');
        setMessage('Signed in successfully! Redirecting...');
        setTimeout(async () => {
          if (!clientData.profile_completed) {
            router.push('/client/complete-profile-wizard');
            return;
          }
          const { data: ent } = await supabase
            .from('user_entitlements_data')
            .select('is_active')
            .eq('user_id', userId)
            .maybeSingle();
          if (!ent || !ent.is_active) {
            router.push('/client/complete-profile-wizard');
            return;
          }
          const isMobileClient = typeof window !== 'undefined' && window.innerWidth < 768;
          router.push(isMobileClient ? '/client/mobile' : '/client/dashboard');
        }, 1500);
        return;
      }
    }

    const { data: guardData } = await supabase
      .from('guards')
      .select('profile_completed, verification_status')
      .eq('user_id', userId)
      .maybeSingle();
    if (guardData) {
      setStatus('success');
      setMessage('Signed in successfully! Redirecting...');
      setTimeout(async () => {
        if (!guardData.profile_completed) {
          router.push('/guard/complete-profile-wizard');
          return;
        }
        const { data: ent } = await supabase
          .from('user_entitlements_data')
          .select('is_active')
          .eq('user_id', userId)
          .maybeSingle();
        if (!ent || !ent.is_active) {
          router.push('/guard/complete-profile-wizard');
          return;
        }
        if (guardData.verification_status === 'rejected') {
          router.push('/guard/verification-failed');
        } else if (guardData.verification_status === 'approved' || guardData.verification_status === 'verified') {
          const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
          router.push(isMobile ? '/guard/mobile' : '/guard/dashboard');
        } else {
          const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
          router.push(isMobile ? '/guard/mobile' : '/guard/dashboard');
        }
      }, 1500);
      return;
    }

    const { data: clientFallback } = await supabase
      .from('clients')
      .select('profile_completed')
      .eq('user_id', userId)
      .maybeSingle();
    if (clientFallback) {
      setStatus('success');
      setMessage('Signed in successfully! Redirecting...');
      setTimeout(async () => {
        if (!clientFallback.profile_completed) {
          router.push('/client/complete-profile-wizard');
          return;
        }
        const { data: ent } = await supabase
          .from('user_entitlements_data')
          .select('is_active')
          .eq('user_id', userId)
          .maybeSingle();
        if (!ent || !ent.is_active) {
          router.push('/client/complete-profile-wizard');
          return;
        }
        router.push('/client/dashboard');
      }, 1500);
      return;
    }

    const { fullName } = extractNames(meta);
    await ensureUserRow(userId, userEmail, userType, fullName);
    if (userType === 'guard') {
      await ensureGuardProfile(userId, userEmail, meta);
      await ensureSubscriptionRow(userId, 'guard');
      setStatus('success');
      setMessage('Account created! Redirecting to complete your profile...');
      setTimeout(() => { router.push('/guard/complete-profile-wizard'); }, 2500);
    } else {
      await ensureClientProfile(userId, userEmail, meta);
      await ensureSubscriptionRow(userId, 'client');
      setStatus('success');
      setMessage('Account created! Redirecting to complete your profile...');
      setTimeout(() => { router.push('/client/complete-profile-wizard'); }, 2500);
    }
  };

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    let intent: any = null;
    try {
      const stored = sessionStorage.getItem('oauth_callback_intent');
      if (stored) {
        intent = JSON.parse(stored);
        sessionStorage.removeItem('oauth_callback_intent');
      }
    } catch {}

    const timeoutId = setTimeout(() => {
      setStatus('error');
      setMessage('Authentication timed out. Please try signing in again.');
    }, 15000);

    const isInvalidTokenError = (err: any) => {
      const msg = err?.message || String(err);
      return msg.includes('Invalid Refresh Token') || msg.includes('Refresh Token Not Found');
    };

    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const errorParam = params.get('error');
        const errorDescription = params.get('error_description');

        if (errorParam) {
          clearTimeout(timeoutId);
          throw new Error(errorDescription || errorParam);
        }

        let session = null;
        let lastError = '';

        const { data: { session: existingSession }, error: existingError } = await supabase.auth.getSession();
        if (existingSession) {
          session = existingSession;
          setDebugInfo('step:existing-session');
        }
        if (existingError) {
          lastError = existingError.message;
          setDebugInfo('step:getSession-error:' + existingError.message);
          if (isInvalidTokenError(existingError)) {
            await supabase.auth.signOut({ scope: 'local' });
            setDebugInfo('step:cleared-stale-session');
          }
        }

        if (!session) {
          const code = params.get('code');
          if (code && !hasExchanged.current) {
            hasExchanged.current = true;
            setDebugInfo('step:code-exchange-start');
            const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeData?.session) {
              session = exchangeData.session;
              setDebugInfo('step:code-exchange-success');
            } else if (exchangeError) {
              lastError = exchangeError.message;
              setDebugInfo('step:code-exchange-error:' + exchangeError.message);
            }
          }
        }

        if (!session) {
          const hash = window.location.hash;
          if (hash && hash.includes('access_token=')) {
            setDebugInfo('step:hash-fragment-start');
            const hashParams = new URLSearchParams(hash.replace('#', ''));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            if (accessToken) {
              const { data: setData, error: setError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              });
              if (setData?.session) {
                session = setData.session;
                setDebugInfo('step:hash-fragment-success');
              } else if (setError) {
                lastError = setError.message;
                setDebugInfo('step:hash-fragment-error:' + setError.message);
              }
            }
          }
        }

        if (!session) {
          const { data: finalCheck } = await supabase.auth.getSession();
          if (finalCheck?.session) {
            session = finalCheck.session;
          }
        }

        if (!session) {
          throw new Error(lastError || 'No session could be established. Please try signing in again.');
        }

        clearTimeout(timeoutId);
        await handleRedirect(session, params, intent);
      } catch (err: any) {
        clearTimeout(timeoutId);
        console.error('Auth callback error:', err);
        setStatus('error');
        setMessage(err.message || 'Authentication failed. Please try again.');
      }
    };

    handleCallback();
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {status === 'loading' && (
          <div>
            <div className="w-16 h-16 border-4 border-gray-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-6"></div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Authenticating...</h1>
            <p className="text-gray-500">Please wait while we verify your identity.</p>
            {debugInfo && <p className="mt-4 text-xs text-gray-400 font-mono break-all">{debugInfo}</p>}
          </div>
        )}
        {status === 'success' && (
          <div>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ri-checkbox-circle-fill text-3xl text-green-600"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Success!</h1>
            <p className="text-gray-500">{message}</p>
            <div className="mt-4 w-8 h-8 border-4 border-gray-200 border-t-teal-600 rounded-full animate-spin mx-auto"></div>
          </div>
        )}
        {status === 'error' && (
          <div>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ri-close-circle-fill text-3xl text-red-600"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h1>
            <p className="text-gray-500 mb-8">{message}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => { router.push('/guard/login'); }} className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer font-medium">Guard Login</button>
              <button onClick={() => { router.push('/client/login'); }} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer font-medium">Client Login</button>
            </div>
            <div className="mt-4">
              <button onClick={() => { router.push('/'); }} className="text-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">Back to Homepage</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-gray-200 border-t-teal-600 rounded-full animate-spin"></div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}