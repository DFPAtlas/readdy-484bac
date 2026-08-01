'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import GuardPromoBanner from './GuardPromoBanner';
import TaxDisclaimerCheckbox from '@/components/TaxDisclaimerCheckbox';
import RegisterMarketingPanel from '@/components/login/RegisterMarketingPanel';
import RegisterFormCard from '@/components/login/RegisterFormCard';
import QGExitIntentPopup from '@/components/qg-rewards/QGExitIntentPopup';

const mobileBg = "https://readdy.ai/api/search-image?query=Dark%20subtle%20abstract%20gradient%20background%20with%20faint%20navy%20blue%20and%20cyan%20mesh%20lines%2C%20minimal%20technology%20pattern%2C%20very%20low%20contrast%20and%20opacity%2C%20suitable%20for%20dark%20mode%20mobile%20login%20screen%20background%2C%20soft%20glowing%20particles%2C%20premium%20SaaS%20aesthetic&width=800&height=1200&seq=2&orientation=portrait";

export default function GuardRegister() {
  const [formData, setFormData] = useState<Record<string, string>>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [taxDisclaimerAccepted, setTaxDisclaimerAccepted] = useState(false);
  const [wizardFields, setWizardFields] = useState<any[]>([]);
  const [wizardLoading, setWizardLoading] = useState(true);
  const [portalDefaults, setPortalDefaults] = useState<any>(null);
  const [roleSwitchModal, setRoleSwitchModal] = useState<'idle' | 'checking' | 'client' | 'guard' | 'none'>('checking');
  const [sentEmail, setSentEmail] = useState('');
  const router = useRouter();
  const appleAuthEnabled = process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED === 'true';

  useEffect(() => {
    async function load() {
      setWizardLoading(true);
      const [fieldsRes, portalRes] = await Promise.all([
        supabase
          .from('wizard_fields')
          .select('*')
          .eq('wizard_type', 'guard')
          .eq('is_enabled', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('settings')
          .select('value')
          .eq('key', 'portal_guard_signup')
          .maybeSingle(),
      ]);
      if (fieldsRes.data) {
        setWizardFields(fieldsRes.data);
        const initial: Record<string, string> = {};
        fieldsRes.data.forEach((f: any) => { initial[f.field_key] = ''; });
        setFormData(initial);
      }
      if (portalRes.data?.value) {
        try { setPortalDefaults(JSON.parse(portalRes.data.value)); } catch {}
      }
      setWizardLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('qg_referral_code', ref);
      sessionStorage.setItem('qg_referral_code', ref);
    }
  }, []);

  useEffect(() => {
    async function checkRole() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setRoleSwitchModal('none');
        return;
      }
      const userId = session.user.id;
      const [{ data: guardData }, { data: clientData }] = await Promise.all([
        supabase.from('guards').select('id').eq('user_id', userId).maybeSingle(),
        supabase.from('clients').select('id').eq('user_id', userId).maybeSingle(),
      ]);
      if (guardData) {
        setRoleSwitchModal('guard');
      } else if (clientData) {
        setRoleSwitchModal('client');
      } else {
        setRoleSwitchModal('none');
      }
    }
    checkRole();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSocialLogin = async (provider: 'google' | 'apple' | 'linkedin_oidc') => {
    try {
      setSocialLoading(provider);
      setError('');

      sessionStorage.setItem('oauth_callback_intent', JSON.stringify({ type: 'guard', isNewUser: true, useWizard: true }));

      const redirectTo = `${window.location.origin}/auth/callback`;
      console.log('[OAuth] Guard register redirectTo:', redirectTo);
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
      setError(err.message || `Failed to sign up with ${provider}`);
      setSocialLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const firstName = formData.first_name || formData.firstName || '';
      const lastName = formData.last_name || formData.lastName || '';
      const email = formData.email;

      if (!email) {
        throw new Error('Email is required');
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/register-magic-link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email,
            role: 'guard',
            first_name: firstName,
            last_name: lastName,
            wizard_data: formData,
            referral_code: typeof window !== 'undefined' ? (localStorage.getItem('qg_referral_code') || sessionStorage.getItem('qg_referral_code') || '') : '',
            source: 'qg_launch_rewards',
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || `Registration failed (${response.status})`);
      }

      if (!result?.session) {
        throw new Error('Registration failed: No session returned');
      }

      await supabase.auth.signOut({ scope: 'local' });
      await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });

      if (taxDisclaimerAccepted) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('tax_disclaimers_accepted').insert({
            user_id: user.id,
            user_type: 'guard',
            disclaimer_type: 'general',
            accepted_at: new Date().toISOString(),
          });
        }
      }

      setSentEmail(email);
      router.push('/guard/complete-profile-wizard');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
      setLoading(false);
    }
  };

  const renderField = (field: any) => {
    const key = field.field_key;
    const value = formData[key] || '';

    const baseInputStyle = {
      background: "rgba(7,19,33,0.6)",
      border: "1px solid rgba(255,255,255,0.08)",
    };

    const baseInputClass = "w-full px-4 py-3 rounded-xl text-white text-sm placeholder-[#AAB7C4]/30 outline-none transition-all duration-200";

    const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = "rgba(29,161,242,0.4)";
      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(29,161,242,0.08)";
    };
    const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
      e.currentTarget.style.boxShadow = "none";
    };

    switch (field.field_type) {
      case 'textarea':
        return <textarea id={key} name={key} value={value} onChange={handleChange} className={`${baseInputClass} min-h-[100px] resize-none`} style={baseInputStyle} onFocus={onFocus} onBlur={onBlur} placeholder={field.placeholder || ''} required={field.is_required} />;
      case 'select':
        return (
          <select id={key} name={key} value={value} onChange={handleChange} className={baseInputClass + ' pr-8'} style={baseInputStyle} onFocus={onFocus} onBlur={onBlur} required={field.is_required}>
            <option value="">{field.placeholder || 'Select...'}</option>
            {(field.options || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );
      case 'checkbox':
        return (
          <label className="flex items-start gap-3 cursor-pointer">
            <input id={key} name={key} type="checkbox" checked={value === 'true'} onChange={(e) => { const synthetic = { target: { name: key, value: e.target.checked ? 'true' : 'false' } } as React.ChangeEvent<HTMLInputElement>; handleChange(synthetic); }} className="mt-1 w-4 h-4 flex-shrink-0 cursor-pointer" style={{ accentColor: "#1DA1F2" }} required={field.is_required} />
            <span className="text-sm text-[#AAB7C4] leading-relaxed">{field.help_text || field.field_label}</span>
          </label>
        );
      case 'date':
        return <input id={key} name={key} type="date" value={value} onChange={handleChange} className={baseInputClass} style={baseInputStyle} onFocus={onFocus} onBlur={onBlur} required={field.is_required} />;
      case 'number':
        return <input id={key} name={key} type="number" value={value} onChange={handleChange} className={baseInputClass} style={baseInputStyle} onFocus={onFocus} onBlur={onBlur} placeholder={field.placeholder || ''} required={field.is_required} />;
      default:
        return <input id={key} name={key} type={field.field_type} value={value} onChange={handleChange} className={baseInputClass} style={baseInputStyle} onFocus={onFocus} onBlur={onBlur} placeholder={field.placeholder || ''} required={field.is_required} />;
    }
  };

  const enabledFields = wizardFields.filter((f) => f.is_enabled && f.field_key !== 'password' && f.field_key !== 'confirm_password');

  const heroTitle = portalDefaults?.hero_title || 'Become a Verified QuickGuard Security Professional';
  const heroSubtitle = portalDefaults?.hero_subtitle || 'Earn 15-30 per hour Flexible shifts Fast payments Full HMRC support';
  const ctaPrimaryText = portalDefaults?.cta_primary_text || "Start Application - It's Free";
  const socialEnabled = portalDefaults?.social_login_enabled !== false;
  const trustBadges = portalDefaults?.trust_badges || [
    { icon: 'ri-shield-star-line', text: 'SIA Approved' },
    { icon: 'ri-money-pound-circle-line', text: 'Weekly Payouts' },
    { icon: 'ri-verified-badge-line', text: 'HMRC Compliant' },
  ];

  // Role switch interstitials take over the full screen
  if (roleSwitchModal === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#071321]">
        <div className="w-8 h-8 border-2 border-[#1DA1F2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (roleSwitchModal === 'client') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#071321] px-4">
        <div className="w-full max-w-md" style={{ background: "rgba(14,27,46,0.85)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)", borderRadius: "20px", padding: "32px" }}>
          <div className="w-16 h-16 flex items-center justify-center mx-auto mb-6 rounded-full" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <i className="ri-shield-user-fill text-2xl text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3 text-center">Client Account Detected</h2>
          <p className="text-[#AAB7C4] mb-6 leading-relaxed text-center">
            Your current account is set up as a <strong className="text-white">client</strong>. To register as a security guard, you need a separate guard profile with your SIA licence and work history.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                sessionStorage.setItem('oauth_callback_intent', JSON.stringify({ type: 'guard', isNewUser: true, useWizard: true }));
                router.push('/guard/login');
              }}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
              style={{ background: "linear-gradient(135deg, #1DA1F2 0%, #3B82F6 100%)", color: "#fff" }}
            >
              Create Guard Account
            </button>
            <Link href="/client/dashboard" className="w-full py-3 rounded-xl font-medium text-sm text-center transition-colors hover:bg-white/5 cursor-pointer" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#AAB7C4" }}>
              Back to Client Dashboard
            </Link>
          </div>
          <p className="mt-4 text-xs text-[#AAB7C4]/40 text-center">
            You can have both a client and guard account using the same email.
          </p>
        </div>
      </div>
    );
  }

  // Normal register page content
  return (
    <div className="min-h-screen flex bg-[#071321] relative">
      <QGExitIntentPopup />
      <RegisterMarketingPanel />

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
          <GuardPromoBanner />

          <div
            className="rounded-[20px] border p-8 md:p-10 mt-4"
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
                style={{ background: "rgba(16,185,129,0.12)", color: "#10B981", border: "1px solid rgba(16,185,129,0.18)" }}
              >
                <i className="ri-user-add-line mr-1.5 text-xs" />
                New Guard
              </span>

              <div className="flex items-center gap-3 mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold" style={{ background: "#10B981", color: "#fff" }}>1</div>
                  <span className="text-xs font-medium text-white">Register</span>
                </div>
                <div className="w-8 h-px bg-[rgba(255,255,255,0.12)]" />
                <div className="flex items-center gap-2 opacity-40">
                  <div className="w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold border" style={{ borderColor: "rgba(255,255,255,0.15)", color: "#AAB7C4" }}>2</div>
                  <span className="text-xs font-medium text-[#AAB7C4]">Dashboard</span>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-white text-center">{heroTitle}</h2>
              <p className="text-sm text-[#AAB7C4] text-center mt-1.5">{heroSubtitle}</p>

              {trustBadges.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
                  {trustBadges.map((badge: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <i className={`${badge.icon} text-[#1DA1F2] text-xs`} />
                      <span className="text-xs text-[#AAB7C4]">{badge.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl border flex items-start gap-2.5" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.18)" }}>
                <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                  <i className="ri-error-warning-line text-red-400 text-sm" />
                </div>
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {sentEmail && (
              <div className="mb-5 p-3.5 rounded-xl border flex items-start gap-2.5" style={{ background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.18)" }}>
                <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                  <i className="ri-check-line text-emerald-400 text-sm" />
                </div>
                <p className="text-sm text-emerald-300">Account created successfully! You are now logged in.</p>
              </div>
            )}

            {socialEnabled && (
              <div className="space-y-3 mb-6">
                <button onClick={() => handleSocialLogin('google')} disabled={socialLoading !== null || loading} className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
                  {socialLoading === 'google' ? <div className="w-5 h-5 border-2 border-slate-500 border-t-white rounded-full animate-spin" /> : <i className="ri-google-fill text-xl text-red-400" />}
                  <span className="font-medium text-sm text-[#AAB7C4] whitespace-nowrap">Continue with Google</span>
                </button>
                {appleAuthEnabled && (
                  <button onClick={() => handleSocialLogin('apple')} disabled={socialLoading !== null || loading} className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
                    {socialLoading === 'apple' ? <div className="w-5 h-5 border-2 border-slate-500 border-t-white rounded-full animate-spin" /> : <i className="ri-apple-fill text-xl text-white" />}
                    <span className="font-medium text-sm text-[#AAB7C4] whitespace-nowrap">Continue with Apple</span>
                  </button>
                )}
                <button onClick={() => handleSocialLogin('linkedin_oidc')} disabled={socialLoading !== null || loading} className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
                  {socialLoading === 'linkedin_oidc' ? <div className="w-5 h-5 border-2 border-slate-500 border-t-blue-400 rounded-full animate-spin" /> : <i className="ri-linkedin-fill text-xl text-blue-400" />}
                  <span className="font-medium text-sm text-[#AAB7C4] whitespace-nowrap">Continue with LinkedIn</span>
                </button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} /></div>
                  <div className="relative flex justify-center text-sm"><span className="px-3 text-[#AAB7C4]/50 text-xs" style={{ background: "rgba(14,27,46,0.85)" }}>Or register with email</span></div>
                </div>
              </div>
            )}

            {wizardLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-[#1DA1F2] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <form id="guard-register-form" onSubmit={handleSubmit} className="space-y-5">
                {enabledFields.map((field) => (
                  <div key={field.id}>
                    {field.field_type !== 'checkbox' && (
                      <label htmlFor={field.field_key} className="block text-sm font-medium text-[#AAB7C4] mb-2">
                        {field.field_label}
                        {field.is_required && <span className="text-red-400 ml-1">*</span>}
                      </label>
                    )}
                    {renderField(field)}
                  </div>
                ))}

                <div className="flex items-start gap-3">
                  <input id="terms" type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 w-4 h-4 flex-shrink-0 cursor-pointer" style={{ accentColor: "#1DA1F2" }} required />
                  <label htmlFor="terms" className="text-sm text-[#AAB7C4] cursor-pointer leading-relaxed">
                    I have read and agree to the <Link href="/terms" className="font-medium transition-colors hover:text-[#3B82F6]" style={{ color: "#1DA1F2" }} target="_blank">Terms &amp; Conditions</Link> and <Link href="/privacy" className="font-medium transition-colors hover:text-[#3B82F6]" style={{ color: "#1DA1F2" }} target="_blank">Privacy Policy</Link>
                  </label>
                </div>

                <TaxDisclaimerCheckbox userType="guard" accepted={taxDisclaimerAccepted} onChange={setTaxDisclaimerAccepted} variant="signup" />

                <button
                  type="submit"
                  disabled={loading || socialLoading !== null || !termsAccepted || !taxDisclaimerAccepted}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #1DA1F2 0%, #3B82F6 100%)",
                    color: "#fff",
                    boxShadow: "0 4px 20px rgba(29,161,242,0.25)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 6px 28px rgba(29,161,242,0.4)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(29,161,242,0.25)"; }}
                >
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating Account...</>
                  ) : (
                    <>{ctaPrimaryText}<i className="ri-arrow-right-line" /></>
                  )}
                </button>
              </form>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-[#AAB7C4]">
                Already have an account? <Link href="/guard/login" className="font-medium transition-colors hover:text-[#3B82F6]" style={{ color: "#1DA1F2" }}>Sign In</Link>
              </p>
            </div>

            <div className="mt-5 text-center">
              <Link href="/client/register" className="text-sm text-[#AAB7C4]/60 hover:text-white transition-colors">
                Need to hire guards? <span className="font-medium" style={{ color: "#1DA1F2" }}>Register as Client</span>
              </Link>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-[#AAB7C4]/30">
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-shield-check-fill text-[#1DA1F2] text-sm" /></div>
              <span>Powered by</span>
              <span className="font-[family-name:var(--font-pacifico)] text-sm" style={{ color: "#1DA1F2" }}>QuickGuard</span>
              <span className="mx-1 text-[#AAB7C4]/20">&middot;</span>
              <i className="ri-lock-line text-[#AAB7C4]/20 text-xs" />
              <span>Secure &amp; SIA Verified</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}