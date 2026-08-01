'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useGuardGuard } from '@/hooks/useGuardGuard';
import { clearBadStoredRedirects } from '@/lib/safe-redirect';

const POLL_INTERVAL = 30;

export default function VerificationPendingPage() {
  const router = useRouter();
  const { loading: authLoading, allowed } = useGuardGuard();
  const [userEmail, setUserEmail] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [nextCheckIn, setNextCheckIn] = useState(POLL_INTERVAL);
  const [isPolling, setIsPolling] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendCooldown, setResendCooldown] = useState(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userIdRef = useRef<string | null>(null);

  const checkVerificationStatus = async (silent = false) => {
    if (!silent) setCheckingStatus(true);
    setIsPolling(true);
    try {
      const userId = userIdRef.current;
      if (!userId) return;

      const { data: guardData, error } = await supabase
        .from('guards')
        .select('verification_status')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) return;

      setLastChecked(new Date());

      if (guardData?.verification_status === 'approved' || guardData?.verification_status === 'verified') {
        clearBadStoredRedirects();
        router.push('/guard/dashboard');
        return;
      } else if (guardData?.verification_status === 'rejected') {
        router.push('/guard/verification-failed');
        return;
      }
    } finally {
      if (!silent) setCheckingStatus(false);
      setIsPolling(false);
      setNextCheckIn(POLL_INTERVAL);
    }
  };

  const startPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    pollIntervalRef.current = setInterval(() => {
      checkVerificationStatus(true);
    }, POLL_INTERVAL * 1000);

    countdownRef.current = setInterval(() => {
      setNextCheckIn(prev => {
        if (prev <= 1) return POLL_INTERVAL;
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
        userIdRef.current = user.id;
        await checkVerificationStatus(true);
        startPolling();
      }
    };
    init();

    const timer = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setInterval(() => setResendCooldown(c => c - 1), 1000);
      return () => clearInterval(t);
    }
  }, [resendCooldown]);

  const handleResendVerification = async () => {
    if (!userEmail || resendCooldown > 0) return;
    setResendStatus('sending');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: userEmail,
    });
    if (error) {
      setResendStatus('error');
    } else {
      setResendStatus('sent');
      setResendCooldown(60);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleManualCheck = async () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    await checkVerificationStatus(false);
    startPolling();
  };

  if (authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col">
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-2xl w-full">
          <div className="mb-6">
            <Link href="/guard/login" className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap">
              <div className="w-8 h-8 flex items-center justify-center">
                <i className="ri-arrow-left-line text-lg"></i>
              </div>
              Back to Login
            </Link>
          </div>
          <div className="bg-[#111d35] rounded-2xl shadow-xl border border-[#1e2d4d] p-8 text-center">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 bg-teal-500/20 rounded-full animate-ping opacity-75"></div>
              <div className="relative w-24 h-24 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center">
                <i className="ri-shield-check-line text-4xl text-white w-10 h-10 flex items-center justify-center"></i>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-white mb-3">SIA License Verification in Progress</h1>

            <p className="text-lg text-slate-300 mb-2">
              We're verifying your SIA license details
            </p>

            {userEmail && (
              <p className="text-sm text-slate-500 mb-6">
                Registered email: <span className="font-medium text-slate-300">{userEmail}</span>
              </p>
            )}

            <div className="bg-[#162036] border border-[#1e2d4d] rounded-xl p-6 mb-6">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>

              <p className="text-sm font-medium text-teal-300 mb-2">Verification Process</p>
              <div className="space-y-2 text-left max-w-md mx-auto">
                <div className="flex items-center gap-3 text-sm text-slate-300">
                  <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className="ri-check-line text-emerald-400 text-sm w-4 h-4 flex items-center justify-center"></i>
                  </div>
                  <span>Account created successfully</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-300">
                  <div className="w-6 h-6 bg-teal-500/20 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                    <i className="ri-loader-4-line text-teal-400 text-sm w-4 h-4 flex items-center justify-center animate-spin"></i>
                  </div>
                  <span>Verifying SIA license with official database</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <div className="w-6 h-6 bg-slate-700/50 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className="ri-mail-line text-slate-400 text-sm w-4 h-4 flex items-center justify-center"></i>
                  </div>
                  <span>Email confirmation will be sent</span>
                </div>
              </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isPolling ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-500'}`}></div>
                  <span className="text-sm font-medium text-emerald-300">
                    {isPolling ? 'Checking status...' : 'Auto-checking every 30 seconds'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  {!isPolling && (
                    <>
                      <i className="ri-time-line w-4 h-4 flex items-center justify-center"></i>
                      <span>Next check in <span className="font-mono font-bold">{nextCheckIn}s</span></span>
                    </>
                  )}
                  {isPolling && (
                    <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                  )}
                </div>
              </div>
              {lastChecked && (
                <p className="text-xs text-emerald-500 mt-1.5 text-left pl-5">
                  Last checked: {lastChecked.toLocaleTimeString()}
                </p>
              )}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 mb-6">
              <div className="flex items-start gap-3">
                <i className="ri-time-line text-amber-400 text-xl mt-0.5 w-5 h-5 flex items-center justify-center"></i>
                <div className="text-left">
                  <p className="font-semibold text-white mb-1">Expected Wait Time</p>
                  <p className="text-sm text-slate-400 mb-2">Typically takes <strong className="text-slate-200">2–5 minutes</strong></p>
                  <p className="text-xs text-slate-500">Time elapsed: <span className="font-mono font-medium text-slate-300">{formatTime(timeElapsed)}</span></p>
                </div>
              </div>
            </div>

            <div className="bg-[#162036] border border-[#1e2d4d] rounded-xl p-5 mb-6 text-left">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <i className="ri-information-line text-teal-400 w-5 h-5 flex items-center justify-center"></i>
                What Happens Next?
              </h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <i className="ri-checkbox-circle-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center"></i>
                  <span>We'll verify your SIA license number with the official SIA database</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-checkbox-circle-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center"></i>
                  <span>You'll receive an email notification once verification is complete</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-checkbox-circle-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center"></i>
                  <span>Once verified, you can access your dashboard and start applying for jobs</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-checkbox-circle-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center"></i>
                  <span>If there are any issues, we'll contact you via email</span>
                </li>
              </ul>
            </div>

            <button
              onClick={handleManualCheck}
              disabled={checkingStatus}
              className="w-full bg-teal-500 text-slate-900 py-3 rounded-xl font-semibold hover:bg-teal-400 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap mb-4 cursor-pointer"
            >
              {checkingStatus ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                  Checking Status...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-refresh-line w-5 h-5 flex items-center justify-center"></i>
                  Check Now
                </span>
              )}
            </button>

            <div className="bg-[#162036] border border-[#1e2d4d] rounded-xl p-5 mb-6 text-left">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <i className="ri-mail-send-line text-teal-400 w-5 h-5 flex items-center justify-center"></i>
                Didn't receive the confirmation email?
              </h3>
              <p className="text-sm text-slate-400 mb-3">
                Check your spam folder first. If it's not there, you can resend the verification email to <span className="text-slate-300 font-medium">{userEmail || 'your registered address'}</span>.
              </p>
              <button
                onClick={handleResendVerification}
                disabled={resendStatus === 'sending' || resendCooldown > 0}
                className="w-full bg-[#1e2d4d] border border-[#2a3f6b] text-white py-2.5 rounded-xl font-medium hover:bg-[#253554] transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
              >
                {resendStatus === 'sending' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : resendCooldown > 0 ? (
                  <>
                    <i className="ri-time-line w-4 h-4 flex items-center justify-center"></i>
                    Resend available in {resendCooldown}s
                  </>
                ) : resendStatus === 'sent' ? (
                  <>
                    <i className="ri-check-line text-emerald-400 w-4 h-4 flex items-center justify-center"></i>
                    Verification email resent
                  </>
                ) : (
                  <>
                    <i className="ri-mail-send-line w-4 h-4 flex items-center justify-center"></i>
                    Resend Verification Email
                  </>
                )}
              </button>
              {resendStatus === 'error' && (
                <p className="text-sm text-red-400 mt-2">Failed to resend. Please try again or contact support.</p>
              )}
            </div>

            <div className="flex items-center justify-center gap-4 text-sm">
              <Link
                href="/guard/login"
                className="text-slate-400 hover:text-white font-medium flex items-center gap-1"
              >
                <i className="ri-login-box-line w-4 h-4 flex items-center justify-center"></i>
                Go to Login
              </Link>
              <span className="text-slate-600">|</span>
              <Link
                href="/contact"
                className="text-slate-400 hover:text-white font-medium flex items-center gap-1"
              >
                <i className="ri-customer-service-2-line w-4 h-4 flex items-center justify-center"></i>
                Contact Support
              </Link>
            </div>
          </div>

          <div className="mt-6 bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <i className="ri-question-line text-slate-400 w-5 h-5 flex items-center justify-center"></i>
              Frequently Asked Questions
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-slate-200 mb-1">How long does verification take?</p>
                <p className="text-slate-400">Most verifications are completed within 2–5 minutes. In rare cases, it may take up to 24 hours.</p>
              </div>
              <div>
                <p className="font-medium text-slate-200 mb-1">What if my verification fails?</p>
                <p className="text-slate-400">You'll receive an email explaining the reason. You can then update your information or contact support for assistance.</p>
              </div>
              <div>
                <p className="font-medium text-slate-200 mb-1">Can I use the platform while waiting?</p>
                <p className="text-slate-400">You can log in and view your profile, but you'll need to complete verification before applying for jobs.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
