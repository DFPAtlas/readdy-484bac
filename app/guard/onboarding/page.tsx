'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useGuardGuard } from '@/hooks/useGuardGuard';
import { clearBadStoredRedirects, sanitizeRedirectPath } from '@/lib/safe-redirect';
import { goToGuardWizardEdit, isDashboardAllowedStatus } from '@/lib/guard-wizard-edit';

const POLL_INTERVAL = 15;

export default function GuardOnboardingPage() {
  const router = useRouter();
  const { loading: authLoading, allowed } = useGuardGuard();
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [guardId, setGuardId] = useState('');
  const [step, setStep] = useState(1);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [nextCheckIn, setNextCheckIn] = useState(POLL_INTERVAL);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string>('pending');
  const [siaCheckStatus, setSiaCheckStatus] = useState<string | null>(null);
  const [siaCheckedAt, setSiaCheckedAt] = useState<string | null>(null);
  const [missingItems, setMissingItems] = useState<string[]>([]);
  const [adminNote, setAdminNote] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const checkVerificationStatus = async () => {
    const userId = userIdRef.current;
    if (!userId) return;

    const { data: guardData } = await supabase
      .from('guards')
      .select('verification_status, full_name, sia_check_status, sia_checked_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (!mountedRef.current || !guardData) return;

    setLastChecked(new Date());
    setVerificationStatus(guardData.verification_status || 'pending');
    setSiaCheckStatus(guardData.sia_check_status || null);
    setSiaCheckedAt(guardData.sia_checked_at || null);

    if (isDashboardAllowedStatus(guardData.verification_status)) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      clearBadStoredRedirects();
      router.push('/guard/dashboard');
      return;
    }

    if (guardData.verification_status === 'rejected') {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      router.push('/guard/verification-failed');
      return;
    }
  };

  const startPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    pollIntervalRef.current = setInterval(() => {
      checkVerificationStatus();
    }, POLL_INTERVAL * 1000);

    countdownRef.current = setInterval(() => {
      setNextCheckIn(prev => {
        if (prev <= 1) return POLL_INTERVAL;
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/guard/login');
        return;
      }

      userIdRef.current = user.id;
      setUserEmail(user.email || '');

      const { data: guardData } = await supabase
        .from('guards')
        .select('id, full_name, verification_status, subscription_status, profile_completed, sia_licence_number, sia_licence_front_url, driving_licence_front_url, profile_image_url, sia_check_status, sia_checked_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!mountedRef.current) return;

      if (!guardData) {
        router.push('/guard/complete-profile-wizard');
        return;
      }

      if (isDashboardAllowedStatus(guardData.verification_status)) {
        router.push('/guard/dashboard');
        return;
      }

      if (guardData.verification_status === 'rejected') {
        router.push('/guard/verification-failed');
        return;
      }

      if (!guardData.profile_completed) {
        router.push('/guard/complete-profile-wizard');
        return;
      }

      const { data: latestNudge } = await supabase
        .from('notifications')
        .select('data, created_at')
        .eq('user_id', user.id)
        .eq('type', 'verification')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestNudge?.data) {
        const nudgeData = latestNudge.data as any;
        if (Array.isArray(nudgeData.missing_items)) setMissingItems(nudgeData.missing_items);
        if (nudgeData.admin_note) setAdminNote(nudgeData.admin_note);
      }

      if (guardData.verification_status === 'suspended' || guardData.verification_status === 'expired') {
        setVerificationStatus(guardData.verification_status);
        setGuardId(guardData.id);
        setUserName(guardData.full_name || user.email?.split('@')[0] || 'Guard');
        return;
      }

      setGuardId(guardData.id);
      setUserName(guardData.full_name || user.email?.split('@')[0] || 'Guard');
      setVerificationStatus(guardData.verification_status || 'pending');
      setSiaCheckStatus(guardData.sia_check_status || null);
      setSiaCheckedAt(guardData.sia_checked_at || null);

      startPolling();
      await checkVerificationStatus();
    };

    init();

    return () => {
      mountedRef.current = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const handleManualCheck = async () => {
    setCheckingStatus(true);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    await checkVerificationStatus();
    startPolling();
    setCheckingStatus(false);
  };

  if (verificationStatus === 'suspended' || verificationStatus === 'expired') {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full">
          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-amber-500/15 rounded-full flex items-center justify-center">
              <i className="ri-error-warning-line text-4xl text-amber-400 w-10 h-10 flex items-center justify-center"></i>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Account {verificationStatus === 'suspended' ? 'Suspended' : 'Inactive'}</h1>
            <div className="inline-block px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full mb-4">
              <span className="text-sm font-semibold text-amber-300">Status: {verificationStatus === 'suspended' ? 'Suspended' : 'SIA Expired'}</span>
            </div>
            <p className="text-slate-400 mb-6 leading-relaxed">
              {verificationStatus === 'suspended' ? 'Your account has been temporarily suspended. Please contact support for more information.' : 'Your SIA licence appears to have expired. Please update your licence details to regain access.'}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="/contact" className="w-full sm:w-auto px-6 py-3 bg-teal-500 text-slate-900 rounded-xl font-semibold hover:bg-teal-400 transition whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer">
                <i className="ri-customer-service-2-line w-5 h-5 flex items-center justify-center"></i>
                Contact Support
              </a>
              <button onClick={async () => { await supabase.auth.signOut(); router.push('/guard/login'); }} className="w-full sm:w-auto px-6 py-3 border border-[#1e2d4d] text-slate-300 rounded-xl font-semibold hover:bg-[#162036] transition whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer">
                <i className="ri-logout-box-line w-5 h-5 flex items-center justify-center"></i>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const needsAction = verificationStatus === 'incomplete' || missingItems.length > 0 || !!adminNote;

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <div className="max-w-3xl mx-auto px-6 py-12">

        {needsAction && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="ri-error-warning-line text-amber-400 text-2xl w-6 h-6 flex items-center justify-center"></i>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-1">Action Required</h2>
                <p className="text-sm text-slate-300 mb-4">
                  Our team reviewed your application and needs a few more things before we can approve you.
                </p>

                {adminNote && (
                  <div className="bg-[#0B1933] border border-amber-500/20 rounded-xl p-4 mb-4">
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Note from our team</p>
                    <p className="text-sm text-slate-200">{adminNote}</p>
                  </div>
                )}

                {missingItems.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Please provide / update</p>
                    <ul className="space-y-1.5">
                      {missingItems.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm text-slate-200">
                          <i className="ri-arrow-right-s-line text-amber-400 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={goToGuardWizardEdit}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-slate-900 rounded-xl font-semibold text-sm hover:bg-teal-400 transition whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-edit-line w-4 h-4 flex items-center justify-center"></i>
                  Update application
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/20">
            <i className="ri-check-line text-4xl text-white w-10 h-10 flex items-center justify-center"></i>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            You&apos;re all set, {userName}!
          </h1>
          <p className="text-lg text-slate-400 max-w-lg mx-auto">
            Your profile is complete and we&apos;re now verifying your credentials. Here&apos;s what to expect.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-5 text-center">
            <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center mx-auto mb-3">
              <i className="ri-user-line text-emerald-400 text-lg w-5 h-5 flex items-center justify-center"></i>
            </div>
            <p className="text-sm text-slate-400 mb-1">Profile</p>
            <p className="text-white font-semibold">Complete</p>
          </div>
          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-5 text-center">
            <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center mx-auto mb-3">
              <i className="ri-shield-check-line text-emerald-400 text-lg w-5 h-5 flex items-center justify-center"></i>
            </div>
            <p className="text-sm text-slate-400 mb-1">SIA Licence</p>
            <p className="text-white font-semibold">Uploaded</p>
          </div>
          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-5 text-center">
            <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center mx-auto mb-3">
              <i className="ri-file-list-3-line text-emerald-400 text-lg w-5 h-5 flex items-center justify-center"></i>
            </div>
            <p className="text-sm text-slate-400 mb-1">Documents</p>
            <p className="text-white font-semibold">Submitted</p>
          </div>
        </div>

        <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-8 mb-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500/15 rounded-xl flex items-center justify-center">
              <i className="ri-timer-line text-teal-400 text-lg w-5 h-5 flex items-center justify-center"></i>
            </div>
            Verification Timeline
          </h2>

          <div className="space-y-0">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="ri-check-line text-white text-sm w-4 h-4 flex items-center justify-center"></i>
                </div>
                <div className="w-0.5 flex-1 bg-emerald-500/30 my-1"></div>
              </div>
              <div className="pb-6">
                <h3 className="text-white font-semibold mb-1">Account Created</h3>
                <p className="text-sm text-slate-400">Your guard profile has been saved and your documents are securely stored.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                {(() => {
                  if (siaCheckStatus === 'passed') {
                    return <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0"><i className="ri-check-double-line text-white text-sm w-4 h-4 flex items-center justify-center"></i></div>;
                  }
                  if (siaCheckStatus === 'failed') {
                    return <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0"><i className="ri-close-line text-white text-sm w-4 h-4 flex items-center justify-center"></i></div>;
                  }
                  if (siaCheckStatus === 'webhook_missing' || siaCheckStatus === 'webhook_error' || verificationStatus === 'manual_review') {
                    return <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0"><i className="ri-user-voice-line text-white text-sm w-4 h-4 flex items-center justify-center"></i></div>;
                  }
                  return <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse"><i className="ri-loader-4-line text-white text-sm w-4 h-4 flex items-center justify-center animate-spin"></i></div>;
                })()}
                <div className="w-0.5 flex-1 bg-teal-500/20 my-1"></div>
              </div>
              <div className="pb-6">
                {(() => {
                  if (siaCheckStatus === 'passed') {
                    return <>
                      <h3 className="text-white font-semibold mb-1">Automated SIA Check: Passed</h3>
                      <p className="text-sm text-slate-400">Your SIA licence has been verified automatically. Moving on to final approval.</p>
                    </>;
                  }
                  if (siaCheckStatus === 'failed') {
                    return <>
                      <h3 className="text-white font-semibold mb-1">Automated SIA Check: Failed</h3>
                      <p className="text-sm text-slate-400">We couldn&apos;t verify your licence automatically. An admin will review your documents manually.</p>
                    </>;
                  }
                  if (siaCheckStatus === 'webhook_missing' || siaCheckStatus === 'webhook_error' || verificationStatus === 'manual_review') {
                    return <>
                      <h3 className="text-white font-semibold mb-1">Manual Review Required</h3>
                      <p className="text-sm text-slate-400">
                        {siaCheckStatus === 'webhook_missing'
                          ? 'The automated verification system is not configured. '
                          : siaCheckStatus === 'webhook_error'
                          ? 'The automated verification system encountered an error. '
                          : ''}
                        Your documents are awaiting admin review. This usually takes <strong className="text-teal-300">within 24 hours</strong>.
                      </p>
                      {siaCheckedAt && (
                        <p className="text-xs text-slate-500 mt-1">Checked: {new Date(siaCheckedAt).toLocaleString()}</p>
                      )}
                    </>;
                  }
                  return <>
                    <h3 className="text-white font-semibold mb-1">SIA Verification in Progress</h3>
                    <p className="text-sm text-slate-400">We&apos;re cross-checking your SIA licence number and documents with the official SIA database. Most verifications complete within <strong className="text-teal-300">2–5 minutes</strong>.</p>
                  </>;
                })()}
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-[#162236] border-2 border-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="ri-mail-line text-slate-500 text-sm w-4 h-4 flex items-center justify-center"></i>
                </div>
                <div className="w-0.5 flex-1 bg-transparent my-1"></div>
              </div>
              <div className="pb-6">
                <h3 className="text-white font-semibold mb-1">Approval Notification</h3>
                <p className="text-sm text-slate-400">We&apos;ll email you at <strong className="text-slate-300">{userEmail}</strong> the moment your application is approved. You can then start applying for jobs right away.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-[#162236] border-2 border-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="ri-briefcase-line text-slate-500 text-sm w-4 h-4 flex items-center justify-center"></i>
                </div>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Start Working</h3>
                <p className="text-sm text-slate-400">Access your dashboard, browse available jobs near you, and start earning £15–£30 per hour.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse flex-shrink-0"></div>
                <span className="text-sm font-medium text-emerald-300">Auto-checking every 15 seconds</span>
              </div>
              <p className="text-xs text-slate-500">
                Next check in <span className="font-mono font-bold text-slate-300">{nextCheckIn}s</span>
                {lastChecked && <> · Last checked: {lastChecked.toLocaleTimeString()}</>}
              </p>
            </div>
            <button
              onClick={handleManualCheck}
              disabled={checkingStatus}
              className="px-5 py-2.5 bg-teal-500 text-slate-900 rounded-xl font-semibold text-sm hover:bg-teal-400 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer flex items-center gap-2"
            >
              {checkingStatus ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                  Checking...
                </>
              ) : (
                <>
                  <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
                  Check Now
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="ri-information-line text-amber-400 text-lg w-5 h-5 flex items-center justify-center"></i>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">While You Wait</h3>
                <p className="text-sm text-slate-400">Here&apos;s what you can do in the meantime:</p>
              </div>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <i className="ri-arrow-right-s-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
                <span>Explore the <Link href="/guard/dashboard" className="text-teal-400 hover:text-teal-300 underline">guard dashboard</Link> once verified</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <i className="ri-arrow-right-s-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
                <span>Read our <Link href="/guide/guard" className="text-teal-400 hover:text-teal-300 underline">guard guide</Link> for tips on getting hired</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <i className="ri-arrow-right-s-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
                <span>Check out <Link href="/how-it-works" className="text-teal-400 hover:text-teal-300 underline">how the platform works</Link></span>
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <i className="ri-arrow-right-s-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
                <span>Make sure your phone number is up to date in your profile</span>
              </li>
            </ul>
          </div>

          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="ri-question-line text-blue-400 text-lg w-5 h-5 flex items-center justify-center"></i>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Frequently Asked</h3>
                <p className="text-sm text-slate-400">Common questions about verification:</p>
              </div>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-slate-200 mb-1">How long does verification take?</p>
                <p className="text-slate-400">Most are done within 2–5 minutes. In rare cases where manual review is needed, it can take up to 24 hours.</p>
              </div>
              <div>
                <p className="font-medium text-slate-200 mb-1">What if my licence doesn&apos;t verify?</p>
                <p className="text-slate-400">Double-check your licence number and expiry date. If they&apos;re correct, contact support — sometimes it&apos;s just a database sync delay.</p>
              </div>
              <div>
                <p className="font-medium text-slate-200 mb-1">Will I be notified?</p>
                <p className="text-slate-400">Yes! We&apos;ll send an email to {userEmail || 'your registered address'} the moment verification completes.</p>
              </div>
              <div>
                <p className="font-medium text-slate-200 mb-1">Can I start applying now?</p>
                <p className="text-slate-400">As soon as your application is approved or verified, you can start browsing and applying for jobs from your dashboard.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-teal-500/10 to-emerald-500/10 border border-teal-500/20 rounded-2xl p-6 mb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-white font-semibold mb-1">Got questions or need help?</h3>
              <p className="text-sm text-slate-400">Our support team is ready to assist you with anything.</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/contact"
                className="px-5 py-2.5 bg-white/10 border border-white/20 text-white rounded-xl font-medium text-sm hover:bg-white/20 transition whitespace-nowrap cursor-pointer"
              >
                Contact Support
              </Link>
              <button
                onClick={() => {
                  const widget = document.querySelector('#vapi-widget-floating-button') as HTMLElement;
                  if (widget) widget.click();
                }}
                className="px-5 py-2.5 bg-teal-500 text-slate-900 rounded-xl font-medium text-sm hover:bg-teal-400 transition whitespace-nowrap cursor-pointer"
              >
                Chat with Us
              </button>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-slate-600 mb-4">
            This page auto-updates &mdash; we&apos;ll redirect you as soon as your application is processed. No need to refresh.
          </p>
          <p className="text-sm text-slate-500 mb-3">
            Need to update your details, documents, or SIA licence?
          </p>
          <button
            onClick={goToGuardWizardEdit}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#162236] border border-[#1e2d4d] text-slate-300 rounded-xl font-medium text-sm hover:bg-[#1e2d4d] hover:text-white transition whitespace-nowrap cursor-pointer"
          >
            <i className="ri-edit-line w-4 h-4 flex items-center justify-center"></i>
            Edit Application / Upload Missing Documents
          </button>
        </div>
      </div>
    </div>
  );
}