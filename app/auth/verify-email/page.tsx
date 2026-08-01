'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const userType = searchParams.get('role') || searchParams.get('type') || 'guard';
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResendEmail = async () => {
    if (countdown > 0 || !email) return;

    setResending(true);
    setResendError('');
    setResendSuccess(false);

    try {
      const redirectUrl = userType === 'guard'
        ? `${window.location.origin}/auth/confirm?role=guard&new=true`
        : `${window.location.origin}/auth/confirm?role=client&new=true&wizard=true`;

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) throw error;

      setResendSuccess(true);
      setCountdown(60);
    } catch (err: any) {
      setResendError(err.message || 'Failed to resend email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-teal-500/10 border border-teal-400/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i className="ri-mail-send-line text-3xl text-teal-400 w-10 h-10 flex items-center justify-center"></i>
          </div>

          <h1 className="text-2xl font-bold text-white mb-3">Check Your Email</h1>

          <p className="text-slate-400 mb-2">
            We've sent a verification link to:
          </p>

          {email && (
            <p className="text-lg font-semibold text-teal-400 mb-6 break-all">
              {email}
            </p>
          )}

          <div className="bg-[#0B1933] border border-slate-700/50 rounded-xl p-4 mb-6 text-left">
            <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
              <i className="ri-information-line w-5 h-5 flex items-center justify-center text-teal-400"></i>
              What to do next:
            </h3>
            <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
              <li>Open your email inbox</li>
              <li>Look for an email from QuickGuard</li>
              <li>Click the verification link in the email</li>
              <li>You'll be redirected to complete your registration</li>
            </ol>
          </div>

          <div className="bg-amber-500/10 border border-amber-400/20 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <i className="ri-spam-2-line text-amber-400 text-xl mt-0.5 w-5 h-5 flex items-center justify-center"></i>
              <div className="text-left">
                <p className="text-sm text-amber-300 font-medium">Can't find the email?</p>
                <p className="text-sm text-amber-400/70 mt-1">Check your spam or junk folder. The email may take a few minutes to arrive.</p>
              </div>
            </div>
          </div>

          {resendSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-400/20 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 text-emerald-400">
                <i className="ri-checkbox-circle-line w-5 h-5 flex items-center justify-center"></i>
                <span className="text-sm font-medium">Verification email sent successfully!</span>
              </div>
            </div>
          )}

          {resendError && (
            <div className="bg-red-500/10 border border-red-400/20 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 text-red-400">
                <i className="ri-error-warning-line w-5 h-5 flex items-center justify-center"></i>
                <span className="text-sm">{resendError}</span>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleResendEmail}
              disabled={resending || countdown > 0 || !email}
              className="w-full bg-teal-500 hover:bg-teal-400 text-slate-900 py-3 rounded-xl font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap hover:scale-[1.02] cursor-pointer"
            >
              {resending ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-loader-4-line animate-spin w-5 h-5 flex items-center justify-center"></i>
                  Sending...
                </span>
              ) : countdown > 0 ? (
                `Resend in ${countdown}s`
              ) : (
                'Resend Verification Email'
              )}
            </button>

            <Link
              href={userType === 'guard' ? '/guard/login' : '/client/login'}
              className="block w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 py-3 rounded-xl font-semibold transition-colors whitespace-nowrap text-center"
            >
              Back to Login
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-700/50">
            <p className="text-sm text-slate-400">
              Wrong email address?{' '}
              <Link
                href={userType === 'guard' ? '/guard/register' : '/client/register'}
                className="text-teal-400 hover:text-teal-300 font-medium"
              >
                Register again
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-300 flex items-center justify-center gap-2">
            <i className="ri-home-line w-4 h-4 flex items-center justify-center"></i>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-teal-400 animate-spin w-10 h-10 flex items-center justify-center mx-auto"></i>
          <p className="mt-4 text-slate-400">Loading...</p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
