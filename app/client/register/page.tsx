'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import TaxDisclaimerCheckbox from '@/components/TaxDisclaimerCheckbox';
import { sanitizeRedirectPath } from '@/lib/safe-redirect';
import RegisterMarketingPanel from '@/components/login/RegisterMarketingPanel';
import RegisterFormCard from '@/components/login/RegisterFormCard';
import QGExitIntentPopup from '@/components/qg-rewards/QGExitIntentPopup';

const mobileBg = "https://readdy.ai/api/search-image?query=Dark%20subtle%20abstract%20gradient%20background%20with%20faint%20navy%20blue%20and%20cyan%20mesh%20lines%2C%20minimal%20technology%20pattern%2C%20very%20low%20contrast%20and%20opacity%2C%20suitable%20for%20dark%20mode%20mobile%20login%20screen%20background%2C%20soft%20glowing%20particles%2C%20premium%20SaaS%20aesthetic&width=800&height=1200&seq=2&orientation=portrait";

export default function ClientRegister() {
  const [formData, setFormData] = useState<Record<string, string>>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [wizardFields, setWizardFields] = useState<any[]>([]);
  const [wizardLoading, setWizardLoading] = useState(true);
  const [portalDefaults, setPortalDefaults] = useState<any>(null);
  const [sentEmail, setSentEmail] = useState('');
  const [taxDisclaimerAccepted, setTaxDisclaimerAccepted] = useState(false);
  const router = useRouter();
  const appleAuthEnabled = process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED === 'true';

  useEffect(() => {
    async function load() {
      setWizardLoading(true);
      const [fieldsRes, portalRes] = await Promise.all([
        supabase
          .from('wizard_fields')
          .select('*')
          .eq('wizard_type', 'client')
          .eq('is_enabled', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('settings')
          .select('value')
          .eq('key', 'portal_client_signup')
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
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (redirect) {
      const safe = sanitizeRedirectPath(redirect, 'client', '/client/dashboard');
      sessionStorage.setItem('post_auth_redirect', safe);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSocialLogin = async (provider: 'google' | 'apple' | 'linkedin_oidc') => {
    try {
      setSocialLoading(provider);
      setError('');

      sessionStorage.setItem('oauth_callback_intent', JSON.stringify({ type: 'client', isNewUser: true, useWizard: true }));

      const redirectTo = `${window.location.origin}/auth/callback`;
      console.log('[OAuth] Client register redirectTo:', redirectTo);
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
      const firstName = formData.first_name || formData.firstName || formData.contact_name || formData.contactName || '';
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
            role: 'client',
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

      const { data: { user } } = await supabase.auth.getUser();
      if (user && taxDisclaimerAccepted) {
        await supabase.from('tax_disclaimers_accepted').insert({
          user_id: user.id,
          user_type: 'client',
          disclaimer_type: 'general',
          accepted_at: new Date().toISOString(),
        });
      }

      setSentEmail(email);
      router.push('/client/complete-profile-wizard');
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
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
        return (
          <textarea
            id={key} name={key} value={value} onChange={handleChange}
            className={`${baseInputClass} min-h-[100px] resize-none`}
            style={baseInputStyle}
            onFocus={onFocus} onBlur={onBlur}
            placeholder={field.placeholder || ''}
            required={field.is_required}
          />
        );
      case 'select':
        return (
          <select
            id={key} name={key} value={value} onChange={handleChange}
            className={baseInputClass + ' pr-8'}
            style={baseInputStyle}
            onFocus={onFocus} onBlur={onBlur}
            required={field.is_required}
          >
            <option value="">{field.placeholder || 'Select...'}</option>
            {(field.options || []).map((opt: string) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'checkbox':
        return (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              id={key} name={key} type="checkbox"
              checked={value === 'true'}
              onChange={(e) => {
                const synthetic = {
                  target: { name: key, value: e.target.checked ? 'true' : 'false' }
                } as React.ChangeEvent<HTMLInputElement>;
                handleChange(synthetic);
              }}
              className="mt-1 w-4 h-4 flex-shrink-0 cursor-pointer"
              style={{ accentColor: "#1DA1F2" }}
              required={field.is_required}
            />
            <span className="text-sm text-[#AAB7C4] leading-relaxed">{field.help_text || field.field_label}</span>
          </label>
        );
      case 'date':
        return (
          <input
            id={key} name={key} type="date" value={value} onChange={handleChange}
            className={baseInputClass}
            style={baseInputStyle}
            onFocus={onFocus} onBlur={onBlur}
            required={field.is_required}
          />
        );
      case 'number':
        return (
          <input
            id={key} name={key} type="number" value={value} onChange={handleChange}
            className={baseInputClass}
            style={baseInputStyle}
            onFocus={onFocus} onBlur={onBlur}
            placeholder={field.placeholder || ''}
            required={field.is_required}
          />
        );
      default:
        return (
          <input
            id={key} name={key} type={field.field_type} value={value} onChange={handleChange}
            className={baseInputClass}
            style={baseInputStyle}
            onFocus={onFocus} onBlur={onBlur}
            placeholder={field.placeholder || ''}
            required={field.is_required}
          />
        );
    }
  };

  const visibleFields = wizardFields.filter((f) => f.is_enabled && f.field_key !== 'password' && f.field_key !== 'confirm_password');

  const title = portalDefaults?.hero_title || 'Register as Client';
  const subtitle = portalDefaults?.hero_subtitle || 'Join hundreds of businesses hiring verified security professionals';
  const socialEnabled = portalDefaults?.social_login_enabled !== false;
  const ctaPrimary = portalDefaults?.cta_primary_text || 'Create Account';

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

        <RegisterFormCard
          userTypeLabel="New Client"
          formId="client-register-form"
          heading={title}
          subtitle={subtitle}
        >
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
              <button
                onClick={() => handleSocialLogin('google')}
                disabled={socialLoading !== null || loading}
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
                  disabled={socialLoading !== null || loading}
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
                disabled={socialLoading !== null || loading}
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

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 text-[#AAB7C4]/50 text-xs" style={{ background: "rgba(14,27,46,0.85)" }}>Or register with email</span>
                </div>
              </div>
            </div>
          )}

          {wizardLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#1DA1F2] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <form id="client-register-form" onSubmit={handleSubmit} className="space-y-5">
              {visibleFields.map((field) => (
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

              <TaxDisclaimerCheckbox
                userType="client"
                accepted={taxDisclaimerAccepted}
                onChange={setTaxDisclaimerAccepted}
                variant="signup"
              />

              <button
                type="submit"
                disabled={loading || socialLoading !== null || !taxDisclaimerAccepted}
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
                    Creating Account...
                  </>
                ) : (
                  <>
                    {ctaPrimary}
                    <i className="ri-arrow-right-line" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-[#AAB7C4]">
              Already have an account?{' '}
              <Link href="/client/login" className="font-medium transition-colors hover:text-[#3B82F6]" style={{ color: "#1DA1F2" }}>
                Sign In
              </Link>
            </p>
          </div>

          <div className="mt-5 text-center">
            <Link href="/guard/register" className="text-sm text-[#AAB7C4]/60 hover:text-white transition-colors">
              Looking for work? <span className="font-medium" style={{ color: "#1DA1F2" }}>Register as Guard</span>
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
        </RegisterFormCard>
      </div>
    </div>
  );
}