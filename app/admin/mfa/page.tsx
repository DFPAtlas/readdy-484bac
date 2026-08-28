'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { clearAdminAuthCache } from '@/hooks/useAdminAuth';
import { resolveAdminMfaRoute, mapMfaErrorMessage } from '@/lib/admin-mfa';
import AdminMfaShell from '@/components/admin/AdminMfaShell';
import SixDigitCodeInput from '@/components/admin/SixDigitCodeInput';

const VALID_ROLES = ['super_admin', 'admin', 'finance_admin'];

export default function AdminMfaChallenge() {
  const router = useSafeRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (!session?.user) {
          router.push('/admin/login');
          return;
        }

        const { data: adminCheck } = await supabase
          .from('admin_users')
          .select('id, role, is_active')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!adminCheck || !adminCheck.is_active || !VALID_ROLES.includes(adminCheck.role)) {
          await supabase.auth.signOut();
          clearAdminAuthCache();
          router.push('/admin/login');
          return;
        }

        const route = await resolveAdminMfaRoute();
        if (cancelled) return;

        if (route === 'authorized') {
          router.push('/admin/dashboard');
          return;
        }
        if (route === 'setup') {
          router.push('/admin/mfa/setup');
          return;
        }
        if (route === 'deny') {
          setLoadError('Unable to establish secure multi-factor authentication. Please sign in again.');
          setLoading(false);
          return;
        }

        const { data: factors, error: factorsErr } = await supabase.auth.mfa.listFactors();

        if (factorsErr) {
          if (!cancelled) {
            setLoadError(mapMfaErrorMessage(factorsErr.message));
            setLoading(false);
          }
          return;
        }

        const totpFactor = (factors?.totp || []).find((f) => f.status === 'verified');

        if (!totpFactor) {
          if (!cancelled) {
            setLoadError('No multi-factor authentication method is enrolled. Please set up MFA.');
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setFactorId(totpFactor.id);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoadError('Unable to establish secure multi-factor authentication. Please sign in again.');
          setLoading(false);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Please enter the 6-digit code from your authenticator app.');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });

      if (challengeErr || !challengeData) {
        setError(mapMfaErrorMessage(challengeErr?.message));
        setVerifying(false);
        return;
      }

      const { data: verifyData, error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyErr) {
        setError(mapMfaErrorMessage(verifyErr.message));
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
        setError('Verification incomplete. Please try again.');
        setVerifying(false);
        return;
      }

      router.push('/admin/dashboard');
    } catch {
      setError('An error occurred during verification. Please try again.');
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#071321]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-slate-400 text-sm font-medium">Verifying your session...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminMfaShell
      title="Two-step verification"
      subtitle="Enter the 6-digit code from your authenticator app."
      icon="ri-smartphone-line"
    >
      {loadError ? (
        <div className="p-3.5 rounded-xl border flex items-start gap-2.5" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.18)' }}>
          <div className="w-5 h-5 flex items-center justify-center mt-0.5">
            <i className="ri-error-warning-line text-red-400 text-sm" />
          </div>
          <p className="text-sm text-red-300">{loadError}</p>
        </div>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl border flex items-start gap-2.5" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.18)' }}>
              <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                <i className="ri-error-warning-line text-red-400 text-sm" />
              </div>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="mfa-code" className="block text-sm font-medium text-[#AAB7C4] mb-2 text-center">
              Verification code
            </label>
            <SixDigitCodeInput value={code} onChange={setCode} disabled={verifying} autoFocus />
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
                Verify
              </>
            )}
          </button>
        </form>
      )}
    </AdminMfaShell>
  );
}