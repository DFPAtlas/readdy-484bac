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

function ConfirmContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const searchParams = useSearchParams();
  const hasRun = useRef(false);
  const hasExchanged = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const handleRedirect = async (session: any) => {
      const metadataRole = session.user.user_metadata?.role || session.user.user_metadata?.user_type;
      const userType = searchParams.get('type') || metadataRole || 'guard';
      const userId = session.user.id;
      const urlType = searchParams.get('type');
      const isNewUser = searchParams.get('new') === 'true';

      // Read stored OAuth intent (set by login/register pages before redirect)
      let intent: any = null;
      try {
        const stored = sessionStorage.getItem('oauth_callback_intent');
        if (stored) {
          intent = JSON.parse(stored);
        }
      } catch { /* ignore */ }

      // Stored redirect (used by registration flows)
      const storedRedirect = sessionStorage.getItem('post_auth_redirect');
      clearBadStoredRedirects();

      if (urlType === 'recovery') {
        setStatus('success');
        setMessage('Identity verified. Redirecting to reset your password...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (metadataRole === 'client') {
          router.push('/client/reset-password');
        } else if (metadataRole === 'admin') {
          router.push('/guard/reset-password');
        } else {
          router.push('/guard/reset-password');
        }
        return;
      }

      if (urlType === 'email_change') {
        setStatus('success');
        setMessage('Email updated successfully! Redirecting...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (metadataRole === 'client') {
          if (storedRedirect) {
            sessionStorage.removeItem('post_auth_redirect');
            router.push(sanitizeRedirectPath(storedRedirect, 'client', '/client/dashboard'));
            return;
          }
          router.push('/client/dashboard');
        } else {
          router.push('/guard/dashboard');
        }
        return;
      }

      const effectiveType = searchParams.get('role') || intent?.type || metadataRole || 'guard';

      // ── NEW USER or ROLE SWITCH: create missing profile first ──
      if (isNewUser || urlType === 'signup' || intent?.type) {
        const metaFull = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';
        const metaFirst = session.user.user_metadata?.first_name || metaFull.split(' ')[0] || '';
        const metaLast = session.user.user_metadata?.last_name || metaFull.split(' ').slice(1).join(' ') || '';
        const resolvedName = `${metaFirst} ${metaLast}`.trim() || metaFull;
        await ensureUserRow(userId, session.user.email || '', effectiveType as 'guard' | 'client', resolvedName);

        if (effectiveType === 'guard') {
          const { profile: existingGuard } = await ensureGuardProfile(userId, session.user.email || '', session.user.user_metadata);
          await ensureSubscriptionRow(userId, 'guard');
          const existing = existingGuard;

          if (storedRedirect) {
            sessionStorage.removeItem('post_auth_redirect');
            setStatus('success');
            setMessage('Account ready! Redirecting...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            router.push(sanitizeRedirectPath(storedRedirect, 'guard', '/guard/dashboard'));
            return;
          }

          setStatus('success');
          setMessage('Account created successfully! Redirecting to complete your profile...');
          await new Promise(resolve => setTimeout(resolve, 2500));
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
          return;
        } else {
          const { profile: existingClient } = await ensureClientProfile(userId, session.user.email || '', session.user.user_metadata);
          await ensureSubscriptionRow(userId, 'client');

          if (storedRedirect) {
            sessionStorage.removeItem('post_auth_redirect');
            setStatus('success');
            setMessage('Account ready! Redirecting...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            router.push(sanitizeRedirectPath(storedRedirect, 'client', '/client/dashboard'));
            return;
          }

          setStatus('success');
          setMessage('Account created successfully! Redirecting...');
          await new Promise(resolve => setTimeout(resolve, 2500));
          router.push(existingClient?.profile_completed ? '/client/dashboard' : '/client/complete-profile-wizard');
          return;
        }
      }

      // ── RETURNING USERS: detect role & create missing profile if needed ──

      // If intent says client but no client row exists, auto-create it (guard switching roles)
      if (intent?.type === 'client') {
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id, profile_completed')
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingClient) {
          const firstName = session.user.user_metadata.first_name || session.user.user_metadata.full_name?.split(' ')[0] || '';
          const lastName = session.user.user_metadata.last_name || session.user.user_metadata.full_name?.split(' ').slice(1).join(' ') || '';
          const contactName = `${firstName} ${lastName}`.trim() || session.user.user_metadata.full_name || session.user.user_metadata.contact_name || session.user.user_metadata.contactName || session.user.email?.split('@')[0] || 'Client';
          await supabase.from('clients').insert({
            user_id: userId,
            email: session.user.email,
            contact_name: contactName,
            first_name: firstName,
            last_name: lastName,
            company_name: session.user.user_metadata.company_name || '',
            phone: session.user.user_metadata.phone || '',
            profile_completed: false,
          });
          setStatus('success');
          setMessage('Client account created! Redirecting...');
          await new Promise(resolve => setTimeout(resolve, 2500));
          router.push('/client/complete-profile-wizard');
          return;
        }

        setStatus('success');
        setMessage('Signed in successfully! Redirecting...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        router.push(existingClient.profile_completed ? '/client/dashboard' : '/client/complete-profile-wizard');
        return;
      }

      // If intent says guard but no guard row exists, auto-create it
      if (intent?.type === 'guard') {
        const { data: existingGuard } = await supabase
          .from('guards')
          .select('id, profile_completed, verification_status')
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingGuard) {
          const firstName = session.user.user_metadata.first_name || session.user.user_metadata.full_name?.split(' ')[0] || '';
          const lastName = session.user.user_metadata.last_name || session.user.user_metadata.full_name?.split(' ').slice(1).join(' ') || '';
          const fullName = `${firstName} ${lastName}`.trim() || session.user.user_metadata.full_name || 'Guard';
          await supabase.from('guards').insert({
            user_id: userId,
            email: session.user.email,
            full_name: fullName,
            phone: session.user.user_metadata.phone || '',
            verification_status: 'manual_review',
            profile_completed: false,
          });
          setStatus('success');
          setMessage('Guard account created! Redirecting...');
          await new Promise(resolve => setTimeout(resolve, 2500));
          router.push('/guard/complete-profile-wizard');
          return;
        }

        setStatus('success');
        setMessage('Signed in successfully! Redirecting...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (!existingGuard.profile_completed) {
          router.push('/guard/complete-profile-wizard');
        } else if (existingGuard.verification_status === 'rejected') {
          router.push('/guard/verification-failed');
        } else if (existingGuard.verification_status === 'approved' || existingGuard.verification_status === 'verified') {
          router.push('/guard/dashboard');
        } else {
          router.push('/guard/onboarding');
        }
        return;
      }

      // Fallback: detect by probing tables
      if (effectiveType === 'guard') {
        const { data: guardData } = await supabase
          .from('guards')
          .select('verification_status, profile_completed')
          .eq('user_id', userId)
          .maybeSingle();

        setStatus('success');
        setMessage('Verified successfully! Redirecting...');

        let redirectPath = '/guard/dashboard';
        if (!guardData) {
          redirectPath = '/guard/complete-profile-wizard';
        } else if (guardData.verification_status === 'approved' || guardData.verification_status === 'verified') {
          redirectPath = '/guard/dashboard';
        } else if (guardData.verification_status === 'rejected') {
          redirectPath = '/guard/verification-failed';
        } else if (!guardData.profile_completed) {
          redirectPath = '/guard/complete-profile-wizard';
        }

        await new Promise(resolve => setTimeout(resolve, 2500));
        router.push(redirectPath);
      } else {
        const { data: clientData } = await supabase
          .from('clients')
          .select('profile_completed')
          .eq('user_id', userId)
          .maybeSingle();

        setStatus('success');
        setMessage('Verified successfully! Redirecting...');

        const redirectPath = clientData?.profile_completed
          ? '/client/dashboard'
          : '/client/complete-profile-wizard';

        await new Promise(resolve => setTimeout(resolve, 2500));
        router.push(redirectPath);
      }
    };

    const isInvalidTokenError = (err: any) => {
      const msg = err?.message || String(err);
      return msg.includes('Invalid Refresh Token') || msg.includes('Refresh Token Not Found');
    };

    const handleConfirmation = async () => {
      try {
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam) {
          throw new Error(errorDescription || errorParam);
        }

        let session = null;
        let lastError = '';

        // 1. Check for existing session first
        const { data: { session: existingSession }, error: existingError } = await supabase.auth.getSession();
        if (existingSession) {
          session = existingSession;
        }
        if (existingError) {
          lastError = existingError.message;
          setDebugInfo(prev => prev + ' getSession error: ' + existingError.message);
          if (isInvalidTokenError(existingError)) {
            await supabase.auth.signOut({ scope: 'local' });
            setDebugInfo(prev => prev + ' cleared stale session.');
          }
        }

        // 2. Try code exchange (OAuth callback or email confirmation with code)
        if (!session) {
          const code = searchParams.get('code');
          if (code && !hasExchanged.current) {
            hasExchanged.current = true;
            setDebugInfo(prev => prev + ' attempting code exchange...');
            const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeData?.session) {
              session = exchangeData.session;
              setDebugInfo(prev => prev + ' code exchange success.');
            } else if (exchangeError) {
              lastError = exchangeError.message;
              setDebugInfo(prev => prev + ' code exchange error: ' + exchangeError.message);
            }
          }
        }

        // 3. Try token_hash verification (email confirmation links)
        if (!session) {
          const tokenHash = searchParams.get('token_hash');
          const rawType = searchParams.get('type') || '';
          const validOtpTypes = ['signup','email','recovery','invite','email_change','magiclink','phone_change','sms'];
          const verifyType = validOtpTypes.includes(rawType) ? rawType : 'email';
          if (tokenHash) {
            setDebugInfo(prev => prev + ' attempting token_hash verify...');
            const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: verifyType as any,
            });
            if (verifyData?.session) {
              session = verifyData.session;
              setDebugInfo(prev => prev + ' token_hash verify success.');
            } else if (verifyError) {
              lastError = verifyError.message;
              setDebugInfo(prev => prev + ' token_hash error: ' + verifyError.message);
            }
          }
        }

        // 4. Try hash fragment (legacy implicit flow)
        if (!session && typeof window !== 'undefined') {
          const hash = window.location.hash;
          if (hash && hash.includes('access_token=')) {
            setDebugInfo(prev => prev + ' attempting hash fragment...');
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
                setDebugInfo(prev => prev + ' hash fragment success.');
              } else if (setError) {
                lastError = setError.message;
                setDebugInfo(prev => prev + ' hash fragment error: ' + setError.message);
              }
            }
          }
        }

        // 5. Final session check
        if (!session) {
          const { data: finalCheck } = await supabase.auth.getSession();
          if (finalCheck?.session) {
            session = finalCheck.session;
          }
        }

        if (!session) {
          const errMsg = lastError || 'No session could be established. Please try signing in again.';
          throw new Error(errMsg);
        }

        await handleRedirect(session);
      } catch (err: any) {
        console.error('Auth confirm error:', err);
        setStatus('error');
        setMessage(err.message || 'Verification failed. Please try signing in again.');
      }
    };

    handleConfirmation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {status === 'loading' && (
          <div>
            <div className="w-16 h-16 border-4 border-gray-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-6"></div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verifying your account...</h1>
            <p className="text-gray-600">Please wait while we confirm your identity</p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ri-checkbox-circle-fill text-3xl text-green-600"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Success!</h1>
            <p className="text-gray-600 mb-4">{message}</p>
            <div className="w-8 h-8 border-4 border-gray-200 border-t-teal-600 rounded-full animate-spin mx-auto"></div>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ri-close-circle-fill text-3xl text-red-600"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => { router.push('/guard/login'); }}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer font-medium"
              >
                Guard Login
              </button>
              <button
                onClick={() => { router.push('/client/login'); }}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer font-medium"
              >
                Client Login
              </button>
            </div>
            <div className="mt-4">
              <button
                onClick={() => { router.push('/'); }}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                Back to Homepage
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-gray-200 border-t-teal-600 rounded-full animate-spin"></div>
      </div>
    }>
      <ConfirmContent />
    </Suspense>
  );
}
