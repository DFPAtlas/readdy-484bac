'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clearBadStoredRedirects } from '@/lib/safe-redirect';
import LoginMarketingPanel from '@/components/login/LoginMarketingPanel';
import LoginFormCard from '@/components/login/LoginFormCard';

const mobileBg = "https://readdy.ai/api/search-image?query=Dark%20subtle%20abstract%20gradient%20background%20with%20faint%20navy%20blue%20and%20cyan%20mesh%20lines%2C%20minimal%20technology%20pattern%2C%20very%20low%20contrast%20and%20opacity%2C%20suitable%20for%20dark%20mode%20mobile%20login%20screen%20background%2C%20soft%20glowing%20particles%2C%20premium%20SaaS%20aesthetic&width=800&height=1200&seq=2&orientation=portrait";

export default function GuardLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const router = useRouter();
  const appleAuthEnabled = process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED === 'true';

  useEffect(() => {
    const savedEmail = localStorage.getItem('guardRememberEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSocialLogin = async (provider: 'google' | 'apple' | 'linkedin_oidc') => {
    try {
      setSocialLoading(provider);
      setError('');

      sessionStorage.setItem('oauth_callback_intent', JSON.stringify({ type: 'guard', isNewUser: false }));

      const redirectTo = `${window.location.origin}/auth/callback`;
      console.log('[OAuth] Guard login redirectTo:', redirectTo);
      const oauthOptions: any = {
        redirectTo,
      };
      if (provider === 'google') {
        oauthOptions.queryParams = { access_type: 'offline', prompt: 'consent' };
      } else if (provider === 'linkedin_oidc') {
        oauthOptions.scopes = 'openid profile email';
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: oauthOptions,
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('Social login error:', err);
      setError(err.message || `Failed to sign in with ${provider}`);
      setSocialLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitStatus('idle');
    setLoading(true);

    if (!email || !password) {
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user || !authData.session) {
        throw new Error('Login failed. Please try again.');
      }

      if (!authData.user?.email_confirmed_at) {
        setError('Your email is not verified. Please check your inbox for the verification link, or use Forgot Password to set a new password and log in.');
        setLoading(false);
        return;
      }

      const userId = authData.user.id;

      const { data: guardData, error: guardError } = await supabase
        .from('guards')
        .select('verification_status, profile_completed')
        .eq('user_id', userId)
        .maybeSingle();

      if (guardError) throw guardError;

      if (!guardData) {
        setError('Guard profile not found. Please contact support.');
        setLoading(false);
        await supabase.auth.signOut();
        return;
      }

      if (rememberMe) {
        localStorage.setItem('guardRememberEmail', email);
      } else {
        localStorage.removeItem('guardRememberEmail');
      }

      setSubmitStatus('success');

      await new Promise(resolve => setTimeout(resolve, 500));

      clearBadStoredRedirects();

      let redirectParam = '';
      try {
        redirectParam = new URLSearchParams(window.location.search).get('redirect') || '';
      } catch {}
      const wizardEdit = localStorage.getItem('guard_wizard_edit');
      if (redirectParam.startsWith('/guard/complete-profile-wizard') || wizardEdit === '1') {
        router.push('/guard/complete-profile-wizard?edit=1');
        return;
      }

      const status = guardData.verification_status || '';

      if (status === 'approved' || status === 'verified') {
        const isMobile = window.innerWidth < 768;
        router.push(isMobile ? '/guard/mobile' : '/guard/dashboard');
        return;
      }

      if (status === 'rejected') {
        router.push('/guard/verification-failed');
        return;
      }

      if (!guardData.profile_completed) {
        router.push('/guard/complete-profile-wizard');
        return;
      }

      router.push('/guard/onboarding');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      setSubmitStatus('error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#071321] relative">
      <LoginMarketingPanel />

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

        <LoginFormCard userTypeLabel="Returning Guard" formId="guard-login-form">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl border flex items-start gap-2.5" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.18)" }}>
              <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                <i className="ri-error-warning-line text-red-400 text-sm" />
              </div>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {submitStatus === 'success' && (
            <div className="mb-5 p-3.5 rounded-xl border flex items-start gap-2.5" style={{ background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.18)" }}>
              <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                <i className="ri-check-line text-emerald-400 text-sm" />
              </div>
              <p className="text-sm text-emerald-300">Login successful! Redirecting...</p>
            </div>
          )}

          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleSocialLogin('google')}
              disabled={socialLoading !== null}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
            >
              {socialLoading === 'google' ? (
                <div className="w-5 h-5 border-2 border-slate-500 border-t-white rounded-full animate-spin" />
              ) : (
                <i className="ri-google-fill text-xl text-red-400" />
              )}
              <span className="font-medium text-sm text-[#AAB7C4] whitespace-nowrap">Continue with Google</span>
            </button>

            {appleAuthEnabled && (
              <button
                onClick={() => handleSocialLogin('apple')}
                disabled={socialLoading !== null}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
              >
                {socialLoading === 'apple' ? (
                  <div className="w-5 h-5 border-2 border-slate-500 border-t-white rounded-full animate-spin" />
                ) : (
                  <i className="ri-apple-fill text-xl text-white" />
                )}
                <span className="font-medium text-sm text-[#AAB7C4] whitespace-nowrap">Continue with Apple</span>
              </button>
            )}

            <button
              onClick={() => handleSocialLogin('linkedin_oidc')}
              disabled={socialLoading !== null}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
            >
              {socialLoading === 'linkedin_oidc' ? (
                <div className="w-5 h-5 border-2 border-slate-500 border-t-blue-400 rounded-full animate-spin" />
              ) : (
                <i className="ri-linkedin-fill text-xl text-blue-400" />
              )}
              <span className="font-medium text-sm text-[#AAB7C4] whitespace-nowrap">Continue with LinkedIn</span>
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 text-[#AAB7C4]/50 text-xs" style={{ background: "rgba(14,27,46,0.85)" }}>Or continue with email</span>
            </div>
          </div>

          <form id="guard-login-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#AAB7C4] mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-mail-line text-[#AAB7C4]/40" />
                  </div>
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-white text-sm placeholder-[#AAB7C4]/30 outline-none transition-all duration-200 focus:ring-2"
                  style={{
                    background: "rgba(7,19,33,0.6)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "rgba(29,161,242,0.4)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(29,161,242,0.08)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#AAB7C4] mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-lock-line text-[#AAB7C4]/40" />
                  </div>
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 rounded-xl text-white text-sm placeholder-[#AAB7C4]/30 outline-none transition-all duration-200 focus:ring-2"
                  style={{
                    background: "rgba(7,19,33,0.6)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "rgba(29,161,242,0.4)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(29,161,242,0.08)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  placeholder="Enter your password"
                  required
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

            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input
                  name="remember_me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer"
                  style={{ accentColor: "#1DA1F2" }}
                />
                <span className="ml-2.5 text-sm text-[#AAB7C4]">Remember me</span>
              </label>

              <Link href="/guard/forgot-password" className="text-sm font-medium transition-colors hover:text-[#3B82F6]" style={{ color: "#1DA1F2" }}>
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading || socialLoading !== null}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #1DA1F2 0%, #3B82F6 100%)",
                color: "#fff",
                boxShadow: "0 4px 20px rgba(29,161,242,0.25)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 6px 28px rgba(29,161,242,0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 20px rgba(29,161,242,0.25)";
              }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <i className="ri-arrow-right-line" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#AAB7C4]">
              Don't have an account?{' '}
              <Link href="/guard/register" className="font-medium transition-colors hover:text-[#3B82F6]" style={{ color: "#1DA1F2" }}>
                Create account
              </Link>
            </p>
          </div>

          <div className="mt-4 text-center pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs text-[#AAB7C4]/40">
              Registered with a magic link? Use <Link href="/guard/forgot-password" className="transition-colors hover:text-[#3B82F6]" style={{ color: "#1DA1F2" }}>Forgot Password</Link> to set your own password.
            </p>
          </div>

          <div className="mt-5 text-center">
            <Link href="/client/login" className="text-sm text-[#AAB7C4]/60 hover:text-white transition-colors">
              Are you a client? <span className="font-medium" style={{ color: "#1DA1F2" }}>Login here</span>
            </Link>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-[#AAB7C4]/30">
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-shield-check-fill text-[#1DA1F2] text-sm" />
            </div>
            <span>Powered by</span>
            <span className="font-[family-name:var(--font-pacifico)] text-sm" style={{ color: "#1DA1F2" }}>QuickGuard</span>
            <span className="mx-1 text-[#AAB7C4]/20">&middot;</span>
            <i className="ri-lock-line text-[#AAB7C4]/20 text-xs" />
            <span>Secure &amp; SIA Verified</span>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => {
                const widget = document.querySelector('#vapi-widget-floating-button') as HTMLElement;
                if (widget) widget.click();
              }}
              className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[#3B82F6] cursor-pointer"
              style={{ color: "#1DA1F2" }}
            >
              <i className="ri-customer-service-line" />
              Need help signing in? Chat with us
            </button>
          </div>
        </LoginFormCard>
      </div>
    </div>
  );
}