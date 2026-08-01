"use client";

import { useState } from 'react';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { supabase } from '@/lib/supabase';
import { logAdminAction } from '@/lib/admin-logger';
import Link from 'next/link';
import AdminMarketingPanel from '@/components/login/AdminMarketingPanel';

const mobileBg = "https://readdy.ai/api/search-image?query=Dark%20subtle%20abstract%20gradient%20background%20with%20faint%20navy%20blue%20and%20cyan%20mesh%20lines%2C%20minimal%20technology%20pattern%2C%20very%20low%20contrast%20and%20opacity%2C%20suitable%20for%20dark%20mode%20mobile%20login%20screen%20background%2C%20soft%20glowing%20particles%2C%20premium%20SaaS%20aesthetic&width=800&height=1200&seq=2&orientation=portrait";

export default function AdminLogin() {
  const router = useSafeRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [resetMessage, setResetMessage] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.session) {
        setError(authError?.message || 'Invalid email or password');
        setLoading(false);
        return;
      }

      const { data: adminCheck, error: adminErr } = await supabase
        .from('admin_users')
        .select('id, user_id, email, role, full_name, is_active')
        .eq('user_id', authData.session.user.id)
        .maybeSingle();

      if (adminCheck && adminCheck.is_active && ['super_admin', 'admin', 'finance_admin'].includes(adminCheck.role)) {
        router.push('/admin/dashboard');
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authData.session.access_token}`,
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        await supabase.auth.signOut();
        const debugInfo = data.debug || {};
        const debugMsg = debugInfo.message || '';
        setError(`${data.error || 'You do not have admin access'}${debugMsg ? ` - ${debugMsg}` : ''}`);
        setLoading(false);
        return;
      }

      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    setResetStatus('idle');
    setResetMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth/confirm`,
      });

      if (error) {
        setResetStatus('error');
        setResetMessage(error.message);
      } else {
        setResetStatus('success');
        setResetMessage('Password reset link sent! Check your email inbox.');

        await logAdminAction({
          actionType: 'password_reset',
          actionDescription: `Password reset requested for ${resetEmail}`,
          targetType: 'admin_user',
          targetName: resetEmail,
          metadata: { email: resetEmail, stage: 'reset_requested', timestamp: new Date().toISOString() },
        });

        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-admin-password-reset-alert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: resetEmail,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {});
      }
    } catch (err: any) {
      setResetStatus('error');
      setResetMessage(err.message || 'Something went wrong. Please try again.');
    } finally {
      setResetLoading(false);
    }
  }

  const inputBaseStyle = {
    background: "rgba(7,19,33,0.6)",
    border: "1px solid rgba(255,255,255,0.08)",
  };

  const inputBaseClass = "w-full px-4 py-3 rounded-xl text-white text-sm placeholder-[#AAB7C4]/30 outline-none transition-all duration-200";

  return (
    <div className="min-h-screen flex bg-[#071321] relative">
      <AdminMarketingPanel />

      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-12 relative overflow-hidden">
        {/* Mobile background */}
        <div
          className="absolute inset-0 lg:hidden bg-cover bg-center opacity-[0.08]"
          style={{ backgroundImage: `url(${mobileBg})` }}
        />
        <div className="lg:hidden absolute inset-0 bg-[#071321]/90" />

        <div className="lg:hidden absolute top-6 left-6 z-20">
          <Link href="/" className="inline-flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1DA1F2]/15 border border-[#1DA1F2]/20">
              <i className="ri-shield-check-fill text-[#1DA1F2] text-base" />
            </div>
            <span className="font-[family-name:var(--font-pacifico)] text-lg text-white">QuickGuard</span>
          </Link>
        </div>

        <div className="relative z-10 w-full max-w-[440px]">
          <div
            className="rounded-[20px] border p-8 md:p-10"
            style={{
              background: "rgba(14,27,46,0.85)",
              borderColor: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div className="flex flex-col items-center mb-6">
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mb-5"
                style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.18)" }}
              >
                <i className="ri-shield-user-line mr-1.5 text-xs" />
                Admin Access
              </span>

              <div className="w-14 h-14 flex items-center justify-center rounded-full mb-5" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <i className={`text-2xl text-amber-400 ${mode === 'forgot' ? 'ri-lock-password-line' : 'ri-shield-user-line'}`} />
              </div>

              <h2 className="text-2xl font-bold text-white text-center">
                {mode === 'login' ? 'Admin Login' : 'Reset Password'}
              </h2>
              <p className="text-sm text-[#AAB7C4] text-center mt-1.5">
                {mode === 'login' ? 'QuickGuard Admin Portal' : "We'll send a reset link to your email"}
              </p>
            </div>

            {mode === 'login' && (
              <>
                {error && (
                  <div className="mb-5 p-3.5 rounded-xl border flex items-start gap-2.5" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.18)" }}>
                    <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                      <i className="ri-error-warning-line text-red-400 text-sm" />
                    </div>
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-[#AAB7C4] mb-2">Email Address</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <i className="ri-mail-line text-[#AAB7C4]/40" />
                        </div>
                      </div>
                      <input
                        id="email" name="email" type="email" required
                        value={email} onChange={(e) => setEmail(e.target.value)}
                        className={`${inputBaseClass} pl-10`}
                        style={inputBaseStyle}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)";
                          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,158,11,0.08)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                        placeholder="Enter your admin email"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="password" className="block text-sm font-medium text-[#AAB7C4]">Password</label>
                      <button
                        type="button"
                        onClick={() => { setMode('forgot'); setResetEmail(email); setResetStatus('idle'); setResetMessage(''); }}
                        className="text-sm font-medium transition-colors hover:text-[#FBBF24]"
                        style={{ color: "#F59E0B" }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <i className="ri-lock-line text-[#AAB7C4]/40" />
                        </div>
                      </div>
                      <input
                        id="password" name="password" type={showPassword ? 'text' : 'password'} required
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        className={`${inputBaseClass} pl-10 pr-11`}
                        style={inputBaseStyle}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)";
                          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,158,11,0.08)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center cursor-pointer"
                      >
                        <div className="w-5 h-5 flex items-center justify-center">
                          <i className={`text-[#AAB7C4]/50 hover:text-[#AAB7C4] transition-colors ${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}`} />
                        </div>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit" disabled={loading}
                    className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
                    style={{
                      background: "linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)",
                      color: "#0B1933",
                      boxShadow: "0 4px 20px rgba(245,158,11,0.25)",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 6px 28px rgba(245,158,11,0.4)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(245,158,11,0.25)"; }}
                  >
                    {loading ? (
                      <><div className="w-4 h-4 border-2 border-[#0B1933]/30 border-t-[#0B1933] rounded-full animate-spin" />Signing in...</>
                    ) : (
                      <><i className="ri-login-box-line" />Sign In</>
                    )}
                  </button>
                </form>
              </>
            )}

            {mode === 'forgot' && (
              <>
                {resetStatus === 'success' ? (
                  <div className="text-center py-4">
                    <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 rounded-full" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)" }}>
                      <i className="ri-mail-check-line text-3xl text-emerald-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-white mb-2">Check your inbox</h2>
                    <p className="text-[#AAB7C4] text-sm mb-6">
                      We've sent a password reset link to <span className="font-medium text-white">{resetEmail}</span>. It may take a minute to arrive.
                    </p>
                    <button
                      onClick={() => { setMode('login'); setResetStatus('idle'); setResetMessage(''); }}
                      className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                      style={{ background: "linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)", color: "#0B1933" }}
                    >
                      <i className="ri-arrow-left-line mr-2" />Back to Login
                    </button>
                  </div>
                ) : (
                  <>
                    {resetStatus === 'error' && (
                      <div className="mb-5 p-3.5 rounded-xl border flex items-start gap-2.5" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.18)" }}>
                        <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                          <i className="ri-error-warning-line text-red-400 text-sm" />
                        </div>
                        <p className="text-sm text-red-300">{resetMessage}</p>
                      </div>
                    )}

                    <form onSubmit={handleForgotPassword} className="space-y-5">
                      <div>
                        <label htmlFor="reset-email" className="block text-sm font-medium text-[#AAB7C4] mb-2">Admin Email Address</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <div className="w-5 h-5 flex items-center justify-center">
                              <i className="ri-mail-line text-[#AAB7C4]/40" />
                            </div>
                          </div>
                          <input
                            id="reset-email" name="email" type="email" required
                            value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                            className={`${inputBaseClass} pl-10`}
                            style={inputBaseStyle}
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)";
                              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,158,11,0.08)";
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                              e.currentTarget.style.boxShadow = "none";
                            }}
                            placeholder="Enter your admin email"
                          />
                        </div>
                        <p className="mt-2 text-xs text-[#AAB7C4]/40">Enter the email address associated with your admin account.</p>
                      </div>

                      <button
                        type="submit" disabled={resetLoading}
                        className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
                        style={{
                          background: "linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)",
                          color: "#0B1933",
                          boxShadow: "0 4px 20px rgba(245,158,11,0.25)",
                        }}
                      >
                        {resetLoading ? (
                          <><div className="w-4 h-4 border-2 border-[#0B1933]/30 border-t-[#0B1933] rounded-full animate-spin" />Sending link...</>
                        ) : (
                          <><i className="ri-send-plane-line" />Send Reset Link</>
                        )}
                      </button>
                    </form>

                    <div className="mt-6 text-center">
                      <button
                        onClick={() => { setMode('login'); setResetStatus('idle'); setResetMessage(''); }}
                        className="text-sm font-medium transition-colors hover:text-[#FBBF24] cursor-pointer"
                        style={{ color: "#F59E0B" }}
                      >
                        <i className="ri-arrow-left-line mr-1" />Back to Login
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="mt-6 text-center space-y-3">
              <p className="text-xs text-[#AAB7C4]/40">
                <i className="ri-shield-check-line mr-1" />
                Secure admin access only
              </p>
              <button
                onClick={() => {
                  const el = document.querySelector('#vapi-widget-floating-button') as HTMLElement;
                  if (el) el.click();
                }}
                className="text-sm transition-colors hover:text-[#FBBF24] font-medium inline-flex items-center gap-1.5 cursor-pointer"
                style={{ color: "#F59E0B" }}
              >
                <i className="ri-customer-service-2-line" />
                Need help signing in? Chat with us
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}