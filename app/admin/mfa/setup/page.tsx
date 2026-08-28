'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { clearAdminAuthCache } from '@/hooks/useAdminAuth';
import { resolveAdminMfaRoute, mapMfaErrorMessage } from '@/lib/admin-mfa';
import AdminMfaShell from '@/components/admin/AdminMfaShell';
import SixDigitCodeInput from '@/components/admin/SixDigitCodeInput';

const VALID_ROLES = ['super_admin', 'admin', 'finance_admin'];

export default function AdminMfaSetup() {
  const router = useSafeRouter();
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState('');
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [copied, setCopied] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const enrollStartedRef = useRef(false);

  const rawSecret = secret.replace(/\s/g, '');
  const otpauthUrl = userEmail && rawSecret
    ? `otpauth://totp/QuickGuard:${encodeURIComponent(userEmail)}?secret=${rawSecret}&issuer=QuickGuard`
    : '';

  useEffect(() => {
    const checkMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(checkMobile);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (!session?.user) {
          window.location.href = '/admin/login';
          return;
        }

        if (!cancelled) setUserEmail(session.user.email || '');

        const { data: adminCheck } = await supabase
          .from('admin_users')
          .select('id, role, is_active')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!adminCheck || !adminCheck.is_active || !VALID_ROLES.includes(adminCheck.role)) {
          await supabase.auth.signOut();
          clearAdminAuthCache();
          window.location.href = '/admin/login';
          return;
        }

        const route = await resolveAdminMfaRoute();
        if (cancelled) return;

        if (route === 'authorized') {
          window.location.href = '/admin/dashboard';
          return;
        }
        if (route === 'mfa') {
          window.location.href = '/admin/mfa';
          return;
        }
        if (route === 'deny') {
          setSetupError('Unable to establish secure multi-factor authentication. Please sign in again.');
          setLoading(false);
          return;
        }

        if (!enrollStartedRef.current) {
          enrollStartedRef.current = true;

          // Inspect factors for the CURRENT authenticated user only.
          // listFactors() may return empty for unverified factors in some versions;
          // use getUser() which always includes the factors array from the server.
          try {
            const { data: userData } = await supabase.auth.getUser();
            const userFactors: Array<{ id: string; factor_type: string; status: string }> =
              (userData?.user as unknown as { factors?: Array<{ id: string; factor_type: string; status: string }> })?.factors || [];

            // Also check via listFactors as a fallback
            const { data: mfaFactors } = await supabase.auth.mfa.listFactors();
            const listFactorItems = (mfaFactors?.totp || []) as Array<{ id: string; factor_type: string; status: string }>;

            // Merge both sources, deduplicating by id
            const allFactors = [...userFactors, ...listFactorItems].filter(
              (f, idx, arr) => arr.findIndex((x) => x.id === f.id) === idx
            );

            const totpFactors = allFactors.filter((f) => f.factor_type === 'totp');

            const verifiedTotp = totpFactors.find((f) => f.status === 'verified');
            if (verifiedTotp) {
              if (!cancelled) window.location.href = '/admin/mfa';
              return;
            }

            const unverifiedTotps = totpFactors.filter((f) => f.status === 'unverified');
            for (const f of unverifiedTotps) {
              try {
                await supabase.auth.mfa.unenroll({ factorId: f.id });
              } catch {
                // ignore individual cleanup failures — proceed to enroll either way
              }
            }
          } catch {
            // ignore list/cleanup errors — proceed to enroll either way
          }

          const { data: enrollData, error: enrollErr } = await supabase.auth.mfa.enroll({ factorType: 'totp' });

          if (enrollErr || !enrollData) {
            if (!cancelled) {
              const msg = (enrollErr?.message || '').toLowerCase();
              const disabledByConfig =
                msg.includes('disabled') &&
                (msg.includes('mfa') || msg.includes('factor') || msg.includes('enroll') || msg.includes('totp'));

              if (disabledByConfig) {
                setSetupError('Multi-factor authentication enrollment is disabled for this project. Please contact your administrator.');
              } else {
                setSetupError('Unable to start MFA setup. Please try again.');
              }
              setLoading(false);
            }
            return;
          }

          const qr = enrollData.totp?.qr_code || '';
          const sec = enrollData.totp?.secret || '';

          if (!cancelled) {
            setFactorId(enrollData.id);
            setQrCode(qr);
            setSecret(sec);

            if (!qr && !sec) {
              setSetupError('The QR code failed to generate. Please refresh the page and try again.');
            }
          }
        }

        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setSetupError('Unable to establish secure multi-factor authentication. Please sign in again.');
          setLoading(false);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const handleRegenerate = async () => {
    if (!factorId) {
      handleRefresh();
      return;
    }
    setLoading(true);
    setSetupError('');
    try {
      await supabase.auth.mfa.unenroll({ factorId });
    } catch {
      // ignore — factor may already be gone
    }
    enrollStartedRef.current = false;

    try {
      const { data: enrollData, error: enrollErr } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (enrollErr || !enrollData) {
        setSetupError(mapMfaErrorMessage(enrollErr?.message) || 'Unable to start MFA enrollment. Please try again.');
        setLoading(false);
        return;
      }
      const qr = enrollData.totp?.qr_code || '';
      const sec = enrollData.totp?.secret || '';
      setFactorId(enrollData.id);
      setQrCode(qr);
      setSecret(sec);
      if (!qr && !sec) {
        setSetupError('The QR code failed to generate. Please try again.');
      }
    } catch {
      setSetupError('Unable to regenerate QR code. Please refresh the page.');
    }
    setLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setVerifyError('Please enter the 6-digit code from your authenticator app.');
      return;
    }

    setVerifying(true);
    setVerifyError('');

    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });

      if (challengeErr || !challengeData) {
        setVerifyError(mapMfaErrorMessage(challengeErr?.message) || 'Challenge failed. Please try again.');
        setVerifying(false);
        return;
      }

      const { data: verifyData, error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyErr) {
        setVerifyError(mapMfaErrorMessage(verifyErr.message));
        setVerifying(false);
        return;
      }

      const verifySession = verifyData as { access_token?: string; refresh_token?: string } | null;
      if (verifySession?.access_token) {
        try {
          await supabase.auth.setSession({
            access_token: verifySession.access_token,
            refresh_token: verifySession.refresh_token || '',
          });
        } catch {
          // session is typically saved automatically; continue to AAL check
        }
      }

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aal?.currentLevel !== 'aal2') {
        setVerifyError('Verification incomplete. Please try again.');
        setVerifying(false);
        return;
      }

      setEnabled(true);
      setTimeout(() => router.push('/admin/dashboard'), 1400);
    } catch {
      setVerifyError('An error occurred during verification. Please try again.');
      setVerifying(false);
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(rawSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleRefresh = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#071321]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-slate-400 text-sm font-medium">Preparing secure setup...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminMfaShell
      title="Secure your admin account"
      subtitle="QuickGuard requires multi-factor authentication for administrator accounts."
      icon="ri-shield-user-line"
    >
      {enabled ? (
        <div className="text-center py-4">
          <div
            className="w-16 h-16 flex items-center justify-center mx-auto mb-4 rounded-full"
            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}
          >
            <i className="ri-shield-check-fill text-3xl text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Multi-factor authentication enabled</h3>
          <p className="text-sm text-[#AAB7C4]">Redirecting you to the admin dashboard...</p>
        </div>
      ) : (
        <>
          {setupError && (
            <div className="mb-5 p-3.5 rounded-xl border flex items-start gap-2.5" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.18)' }}>
              <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                <i className="ri-error-warning-line text-red-400 text-sm" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-red-300 mb-2">{setupError}</p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-refresh-line" />
                  Refresh the page and try again
                </button>
              </div>
            </div>
          )}

          {!setupError && (
            <>
              <div className="mb-5 p-3 rounded-xl border flex items-start gap-2.5" style={{ background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.14)' }}>
                <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                  <i className="ri-information-line text-blue-400 text-sm" />
                </div>
                <p className="text-xs text-[#AAB7C4]/80">
                  If the code is ever rejected, make sure the time on your phone and computer are both set to automatic (Settings &rarr; Date & Time &rarr; Set Automatically).
                </p>
              </div>

              {isMobile && otpauthUrl && (
                <a
                  href={otpauthUrl}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 mb-5 inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
                    color: '#0B1933',
                    boxShadow: '0 4px 20px rgba(245,158,11,0.25)',
                  }}
                >
                  <i className="ri-smartphone-line" />
                  Open in Authenticator App
                </a>
              )}

              <div className="flex flex-col items-center mb-5">
                {qrCode ? (
                  <div className="bg-white p-5 rounded-2xl inline-block shadow-lg">
                    <img src={qrCode} alt="MFA setup QR code" className="w-64 h-64" />
                  </div>
                ) : secret ? (
                  <div className="w-64 h-64 rounded-2xl bg-[#111d35] flex flex-col items-center justify-center p-4 text-center gap-3">
                    <i className="ri-qr-code-line text-3xl text-amber-400/40" />
                    <p className="text-xs text-[#AAB7C4]/60">QR code unavailable — use the setup key below</p>
                    <button
                      type="button"
                      onClick={handleRefresh}
                      className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-refresh-line" />
                      Refresh
                    </button>
                  </div>
                ) : (
                  <div className="w-64 h-64 rounded-2xl bg-[#111d35] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent"></div>
                  </div>
                )}

                {qrCode && (
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    className="mt-3 text-xs font-medium text-[#AAB7C4]/60 hover:text-amber-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-refresh-line" />
                    Generate new QR code
                  </button>
                )}
              </div>

              {!isMobile && otpauthUrl && (
                <a
                  href={otpauthUrl}
                  className="w-full py-2.5 rounded-xl font-medium text-sm transition-all duration-200 hover:-translate-y-0.5 mb-5 inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  style={{
                    background: 'rgba(245,158,11,0.12)',
                    color: '#F59E0B',
                    border: '1px solid rgba(245,158,11,0.2)',
                  }}
                >
                  <i className="ri-smartphone-line" />
                  Open in Authenticator App (same device only)
                </a>
              )}

              {secret && (
                <div className="mb-6">
                  <p className="text-center text-xs text-[#AAB7C4]/60 mb-2">
                    Can&apos;t scan the QR code? Copy this key and paste it into your app manually.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2.5 rounded-xl text-sm text-white tracking-wider text-center break-all" style={{ background: 'rgba(7,19,33,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {rawSecret}
                    </code>
                    <button
                      type="button"
                      onClick={copySecret}
                      className="px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5"
                      style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}
                    >
                      <i className={copied ? 'ri-check-line' : 'ri-file-copy-line'} />
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              <ol className="space-y-3 mb-6">
                {[
                  'Open your authenticator app (Google Authenticator, Microsoft Authenticator, or Authy).',
                  isMobile ? 'Tap the yellow button above to add the account automatically.' : 'Scan the QR code with your phone, or copy the setup key above and paste it into your app.',
                  'Your app will now show a 6-digit code that changes every 30 seconds.',
                  'Enter the current 6-digit code below and select Enable MFA.',
                ].map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                      {idx + 1}
                    </span>
                    <span className="text-sm text-[#AAB7C4] pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>

              <form onSubmit={handleVerify} className="space-y-4">
                {verifyError && (
                  <div className="p-3.5 rounded-xl border flex items-start gap-2.5" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.18)' }}>
                    <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                      <i className="ri-error-warning-line text-red-400 text-sm" />
                    </div>
                    <p className="text-sm text-red-300">{verifyError}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="mfa-setup-code" className="block text-sm font-medium text-[#AAB7C4] mb-2 text-center">
                    Verification code
                  </label>
                  <SixDigitCodeInput value={code} onChange={setCode} disabled={verifying} />
                </div>

                <button
                  type="submit"
                  disabled={verifying || code.length !== 6 || !factorId}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
                    color: '#0B1933',
                    boxShadow: '0 4px 20px rgba(245,158,11,0.25)',
                  }}
                >
                  {verifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#0B1933]/30 border-t-[#0B1933] rounded-full animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <i className="ri-shield-check-line" />
                      Enable MFA
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </>
      )}
    </AdminMfaShell>
  );
}