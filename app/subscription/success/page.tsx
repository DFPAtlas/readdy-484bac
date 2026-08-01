'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { logClientActivity } from '@/lib/client-activity';

function SuccessContent() {
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<'verifying' | 'updating' | 'redirecting' | 'error'>('verifying');
  const [error, setError] = useState('');
  const [planName, setPlanName] = useState('');
  const [planSlug, setPlanSlug] = useState('');
  const [accountType, setAccountType] = useState<'client' | 'guard' | null>(null);
  const [trialEnd, setTrialEnd] = useState<string | null>(null);
  const [redirectTarget, setRedirectTarget] = useState('');
  const [statusMessage, setStatusMessage] = useState('Verifying your payment with Stripe...');
  const [retrying, setRetrying] = useState(false);
  const [deadEnd, setDeadEnd] = useState(false);
  const hasStarted = useRef(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);

  const callCheckStripeSession = useCallback(async (sessionId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/check-stripe-session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ sessionId }),
      }
    );
    return res.json().catch(() => null);
  }, []);

  const getGuardRedirectTarget = useCallback(async (userId: string) => {
    const { data: guardData } = await supabase
      .from('guards')
      .select('verification_status')
      .eq('user_id', userId)
      .maybeSingle();

    const status = guardData?.verification_status;
    if (status === 'approved') return { target: '/guard/dashboard', label: 'Guard Dashboard' };
    if (status === 'rejected') return { target: '/guard/verification-failed', label: 'Verification Status' };
    return { target: '/guard/onboarding', label: 'Verification Status' };
  }, []);

  const handleSuccess = useCallback(async (data: any) => {
    const type = data.account_type || data.accountType || 'guard';
    const userId = data.user_id || data.userId;
    const name = data.plan_name || data.planName || 'Your Plan';
    const slug = data.plan_id || data.planId || data.planSlug || '';
    const trial = data.trial_end || null;

    setPlanName(name);
    setPlanSlug(slug);
    setAccountType(type as 'client' | 'guard');
    if (trial) setTrialEnd(trial);
    setPhase('updating');
    setStatusMessage('Setting up your account...');

    logClientActivity({
      action_type: 'client_feature_unlocked_after_upgrade',
      action_description: `Features unlocked via ${name} (${slug})`,
      category: 'entitlement',
      metadata: { plan_slug: slug, plan_name: name, account_type: type },
    }).catch(() => {});

    let redirectTo: string;

    if (type === 'guard') {
      const { target } = await getGuardRedirectTarget(userId);
      redirectTo = target;
    } else {
      redirectTo = '/client/dashboard';
    }

    setRedirectTarget(redirectTo);
    setPhase('redirecting');
    setStatusMessage('Redirecting you now...');

    redirectTimer.current = setTimeout(() => {
      if (!cancelledRef.current) {
        window.location.href = redirectTo;
      }
    }, 2500);
  }, [getGuardRedirectTarget]);

  const redirectToDashboard = useCallback((target: string) => {
    setRedirectTarget(target);
    setPhase('redirecting');
    setStatusMessage('Redirecting you now...');
    redirectTimer.current = setTimeout(() => {
      if (!cancelledRef.current) {
        window.location.href = target;
      }
    }, 2500);
  }, []);

  const checkDbFallback = useCallback(async (userId: string, sid: string) => {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan_name, status, trial_end, plan_slug')
      .eq('stripe_session_id', sid)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    if (sub) {
      const { data: userData } = await supabase
        .from('users')
        .select('user_type')
        .eq('id', userId)
        .maybeSingle();

      const type = (userData?.user_type || 'guard') as 'client' | 'guard';

      setPlanName(sub.plan_name);
      setPlanSlug(sub.plan_slug || '');
      setAccountType(type);
      if (sub.trial_end) setTrialEnd(sub.trial_end);
      setPhase('updating');
      setStatusMessage('Subscription confirmed via webhook. Setting up your account...');

      logClientActivity({
        action_type: 'client_feature_unlocked_after_upgrade',
        action_description: `Features unlocked via ${sub.plan_name} (${sub.plan_slug || ''})`,
        category: 'entitlement',
        metadata: { plan_slug: sub.plan_slug || '', plan_name: sub.plan_name, account_type: type },
      }).catch(() => {});

      let redirectTo: string;
      if (type === 'guard') {
        const { target } = await getGuardRedirectTarget(userId);
        redirectTo = target;
      } else {
        redirectTo = '/client/dashboard';
      }

      redirectToDashboard(redirectTo);
      return true;
    }
    return false;
  }, [getGuardRedirectTarget, redirectToDashboard]);

  const runConfirmation = useCallback(async (sid: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setPhase('error');
      setError('You must be logged in. Please log in and try again.');
      setDeadEnd(true);
      return;
    }

    const result = await callCheckStripeSession(sid);

    if (result?.success && result?.activated) {
      await handleSuccess(result);
      return;
    }

    if (cancelledRef.current) return;

    setPhase('verifying');
    setStatusMessage('Waiting for payment confirmation...');

    let pollAttempt = 0;
    const maxPollAttempts = 30;

    const poll = () => {
      return new Promise<void>(async (resolve) => {
        const runPoll = async () => {
          if (cancelledRef.current) { resolve(); return; }

          pollAttempt++;
          if (pollAttempt > maxPollAttempts) {
            setPhase('error');
            setError('We could not confirm your subscription. If your card was charged, please try the retry button below or contact support.');
            setDeadEnd(false);
            resolve();
            return;
          }

          if (!cancelledRef.current && pollAttempt <= 3) {
            setStatusMessage(`Waiting for payment confirmation${'.'.repeat(pollAttempt)}`);
          }

          const retryResult = await callCheckStripeSession(sid);

          if (retryResult?.success && retryResult?.activated) {
            await handleSuccess(retryResult);
            resolve();
            return;
          }

          if (pollAttempt >= 4 && user) {
            const found = await checkDbFallback(user.id, sid);
            if (found) { resolve(); return; }
          }

          if (!cancelledRef.current) {
            setTimeout(runPoll, 2000);
          } else {
            resolve();
          }
        };
        runPoll();
      });
    };

    poll();
  }, [callCheckStripeSession, handleSuccess, checkDbFallback]);

  const handleRetry = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    setRetrying(true);
    setPhase('verifying');
    setError('');
    setStatusMessage('Retrying verification with Stripe...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPhase('error');
        setError('Your session has expired. Please log in again.');
        setDeadEnd(true);
        setRetrying(false);
        return;
      }

      const result = await callCheckStripeSession(sid);

      if (result?.success && result?.activated) {
        await handleSuccess(result);
        setRetrying(false);
        return;
      }

      const found = await checkDbFallback(user.id, sid);
      if (found) {
        setRetrying(false);
        return;
      }

      setPhase('error');
      setError('Still unable to confirm your subscription. The payment may still be processing — please wait a moment and try again, or contact support.');
      setDeadEnd(false);
    } catch {
      setPhase('error');
      setError('Something went wrong during retry. Please try again.');
      setDeadEnd(false);
    } finally {
      setRetrying(false);
    }
  }, [callCheckStripeSession, handleSuccess, checkDbFallback]);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    let sessionId = searchParams.get('session_id');
    if (!sessionId && typeof window !== 'undefined') {
      const raw = new URLSearchParams(window.location.search).get('session_id');
      if (raw) sessionId = raw;
    }

    if (!sessionId) {
      setPhase('error');
      setError('No session ID found. Please return to pricing and try your payment again.');
      setDeadEnd(true);
      return;
    }

    sessionIdRef.current = sessionId;
    runConfirmation(sessionId);

    return () => {
      cancelledRef.current = true;
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, [searchParams, runConfirmation]);

  const trialEndFormatted = trialEnd
    ? new Date(trialEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const steps = [
    { label: 'Payment Verified', icon: 'ri-checkbox-circle-fill', done: phase !== 'verifying' || phase === 'error' },
    { label: 'Account Setup', icon: 'ri-user-settings-line', done: phase === 'redirecting' },
    { label: 'Redirecting', icon: 'ri-login-circle-line', done: false },
  ];

  const currentStepIndex = phase === 'verifying' ? 0 : phase === 'updating' ? 1 : phase === 'redirecting' ? 2 : -1;

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-6">
        <div className="text-center max-w-md w-full">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-400/20">
            <i className="ri-error-warning-line text-4xl text-red-400 w-10 h-10 flex items-center justify-center" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Something went wrong</h1>
          <p className="text-slate-400 mb-8 leading-relaxed">{error}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {!deadEnd && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-slate-900 px-6 py-3.5 rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer shadow-lg shadow-teal-500/20"
              >
                {retrying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <i className="ri-refresh-line w-5 h-5 flex items-center justify-center" />
                    Retry Confirmation
                  </>
                )}
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-6 py-3.5 rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer"
            >
              <i className="ri-restart-line w-5 h-5 flex items-center justify-center" />
              Refresh Page
            </button>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-slate-700 px-6 py-3.5 rounded-xl font-semibold transition-all whitespace-nowrap"
            >
              <i className="ri-arrow-left-line w-5 h-5 flex items-center justify-center" />
              Back to Pricing
            </Link>
          </div>
          {!deadEnd && (
            <p className="text-slate-500 text-xs mt-6 leading-relaxed">
              If your card was charged, our system will automatically process your subscription within a few minutes. The retry button checks again immediately.
            </p>
          )}
          <a
            href="mailto:support@quickguard.uk"
            className="inline-flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300 text-sm mt-4 transition-colors whitespace-nowrap"
          >
            <i className="ri-mail-line w-4 h-4 flex items-center justify-center" />
            support@quickguard.uk
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 bg-teal-500/10 rounded-full border border-teal-400/20" />
            <div className="absolute inset-0 flex items-center justify-center">
              <i className={`${phase === 'redirecting' ? 'ri-check-double-fill text-emerald-400' : 'ri-shield-check-line text-teal-400'} text-3xl w-8 h-8 flex items-center justify-center`} />
            </div>
            {phase !== 'redirecting' && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center">
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">
            {phase === 'redirecting' ? 'All Set!' : 'Confirming Your Subscription'}
          </h1>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            {phase === 'redirecting'
              ? 'Taking you to your dashboard now.'
              : 'Please hold tight while we set everything up. Do not close this window.'}
          </p>
        </div>

        <div className="bg-[#111d35] rounded-2xl border border-slate-700/50 p-6 mb-8">
          <div className="flex items-center gap-1 mb-6">
            {steps.map((step, i) => (
              <div key={step.label} className="flex-1 flex items-center">
                <div className={`flex items-center gap-2 px-2 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  i < currentStepIndex
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-400/20'
                    : i === currentStepIndex
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-400/20'
                    : 'bg-slate-800/50 text-slate-600 border border-slate-700/30'
                }`}>
                  <i className={`${step.icon} text-xs w-4 h-4 flex items-center justify-center`} />
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-px mx-1 ${i < currentStepIndex ? 'bg-emerald-400/30' : 'bg-slate-700/30'}`} />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-teal-500/10 rounded-xl border border-teal-400/20 flex items-center justify-center flex-shrink-0">
              <i className="ri-shield-check-line text-teal-400 text-lg w-5 h-5 flex items-center justify-center" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Subscription Plan</p>
              <p className="text-white font-semibold truncate">
                {planName || <span className="text-slate-500">Confirming...</span>}
              </p>
            </div>
          </div>

          {trialEndFormatted && (
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-violet-500/10 rounded-xl border border-violet-400/20 flex items-center justify-center flex-shrink-0">
                <i className="ri-calendar-check-line text-violet-400 text-lg w-5 h-5 flex items-center justify-center" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Trial Period</p>
                <p className="text-violet-400 text-sm font-medium">
                  90 days free · Ends {trialEndFormatted}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-700/50 rounded-xl border border-slate-600/50 flex items-center justify-center flex-shrink-0">
              <i className="ri-user-3-line text-slate-400 text-lg w-5 h-5 flex items-center justify-center" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Account Type</p>
              <p className="text-slate-300 text-sm font-medium capitalize">
                {accountType || '...'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#111d35] rounded-2xl border border-slate-700/50 p-5 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            phase === 'redirecting' ? 'bg-emerald-500/10 border border-emerald-400/20' : 'bg-teal-500/10 border border-teal-400/20'
          }`}>
            {phase === 'redirecting' ? (
              <i className="ri-check-line text-emerald-400 text-xl w-5 h-5 flex items-center justify-center" />
            ) : (
              <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium">{statusMessage}</p>
            <p className="text-slate-500 text-xs mt-0.5">
              {phase === 'redirecting'
                ? 'If nothing happens, click the button below'
                : 'This usually takes under a minute'}
            </p>
          </div>
        </div>

        {redirectTarget && (
          <div className="mt-6 text-center">
            <a
              href={redirectTarget}
              className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-3.5 rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer shadow-lg shadow-teal-500/20"
            >
              <i className="ri-dashboard-line w-5 h-5 flex items-center justify-center" />
              Go to Dashboard
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SubscriptionSuccess() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading...</p>
          </div>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}