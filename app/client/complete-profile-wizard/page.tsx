'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ensureEntitlement } from '@/lib/entitlements';
import ProfileWizard from '@/components/ProfileWizard';
import WizardNavigation from '@/components/WizardNavigation';
import WizardCard from '@/components/WizardCard';
import DynamicProfileForm, { useProfileWizardFields, useProfileFormData } from '@/components/DynamicProfileForm';

const WIZARD_STEPS = [
  { id: 1, title: 'Welcome', description: 'Get started', icon: 'ri-hand-heart-line' },
  { id: 2, title: 'Personal', description: 'Your details', icon: 'ri-user-line' },
  { id: 3, title: 'Company', description: 'Business info', icon: 'ri-building-line' },
  { id: 4, title: 'Location', description: 'Address', icon: 'ri-map-pin-line' },
  { id: 5, title: 'More Info', description: 'Preferences', icon: 'ri-settings-3-line' },
  { id: 6, title: 'Complete', description: 'Review', icon: 'ri-shield-check-line' }
];

function safeRedirect(url: string) {
  // no-op — use router.push instead to avoid breaking the iframe
}

const SECTION_MAP: Record<string, number> = {
  first_name: 2, last_name: 2, phone: 2,
  company_name: 3, industry: 3, company_size: 3, website: 3,
  address_line1: 4, address_line2: 4, city: 4, postcode: 4,
};

function getFieldStep(fieldKey: string): number {
  return SECTION_MAP[fieldKey] || 5;
}

export default function ClientCompleteProfileWizard() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [loadError, setLoadError] = useState('');
  const [existingData, setExistingData] = useState<Record<string, any>>({});
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const { fields, loading: fieldsLoading, error: fieldsError } = useProfileWizardFields('client_profile');
  const { formData, errors, setValue, toggleMultiValue, validate } = useProfileFormData(fields, existingData);

  function traceLog(msg: string, data?: Record<string, unknown>) {
    if (typeof window === 'undefined') return;
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[ClientWizard] ${msg}`, data || '');
      }
    } catch {}
  }

  useEffect(() => {
    mountedRef.current = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const initWizard = async () => {
      timeoutId = setTimeout(() => {
        if (!mountedRef.current) return;
        setLoadError('Loading timed out. Please refresh the page.');
        setLoading(false);
      }, 3000);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mountedRef.current) return;
        if (!session) {
          if (timeoutId) clearTimeout(timeoutId);
          traceLog('no session, redirecting to login');
          router.push('/client/login');
          return;
        }

        const user = session.user;
        setUserId(user.id);
        setUserEmail(user.email ?? '');
        setUserName(user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'there');

        traceLog('session loaded', { userId: user.id, email: user.email });

        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!mountedRef.current) return;

        if (clientError) {
          traceLog('client fetch error', { error: clientError.message });
          setLoadError('Failed to load your profile. Please refresh and try again.');
        }

        if (clientData?.profile_completed) {
          traceLog('profile already completed, checking entitlement');
          const ent = await ensureEntitlement(user.id, 'client');
          if (ent?.is_active) {
            traceLog('entitlement active, redirecting to dashboard');
            router.push('/client/dashboard');
            return;
          }
          traceLog('entitlement not active, showing wizard with notice');
          if (!mountedRef.current) {
            setLoadError('');
          }
        }

        if (clientData?.onboarding_status === 'awaiting_payment' && clientData?.profile_completed) {
          if (timeoutId) clearTimeout(timeoutId);
          traceLog('awaiting_payment + completed, redirecting to dashboard');
          router.push('/client/dashboard');
          return;
        }

        if (clientData) {
          const initial: Record<string, any> = {};
          const dbColumns = [
            'first_name','last_name','phone','company_name','industry',
            'company_size','website','address_line1','address_line2','city',
            'postcode','billing_email','vat_number','preferred_contact_method',
            'security_needs','hear_about_us','additional_notes'
          ];
          dbColumns.forEach((dbKey) => {
            if (clientData[dbKey] !== undefined && clientData[dbKey] !== null) {
              initial[dbKey] = clientData[dbKey];
            }
          });
          setExistingData(initial);
        }
      } catch (err) {
        if (mountedRef.current) {
          setLoadError('An unexpected error occurred. Please refresh the page.');
        }
      }

      if (mountedRef.current) {
        if (timeoutId) clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    initWizard();
    return () => {
      mountedRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const displayError = error || loadError || fieldsError || '';

  const fieldsForStep = (step: number) =>
    fields.filter((f) => f.is_enabled && getFieldStep(f.field_key) === step);

  const validateStep = (step: number): boolean => {
    setError('');
    const stepFields = fieldsForStep(step);
    const newErrors: Record<string, string> = {};

    stepFields.forEach((field) => {
      if (!field.is_required) return;
      const val = formData[field.field_key];
      if (val === '' || val === null || val === undefined || (Array.isArray(val) && val.length === 0)) {
        newErrors[field.field_key] = `${field.field_label} is required`;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0];
      setError(firstError);
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 || validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (!validate()) {
      setError('Please fill in all required fields');
      return;
    }
    if (!userId) {
      setError('User not authenticated');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (password || confirmPassword) {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setSaving(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setSaving(false);
          return;
        }
      }

      const updatePayload: Record<string, any> = {
        subscription_plan: 'client_free',
        profile_completed: true,
        onboarding_status: 'completed',
        subscription_status: 'active',
        updated_at: new Date().toISOString()
      };

      fields.forEach((field) => {
        if (formData[field.field_key] !== undefined) {
          updatePayload[field.field_key] = formData[field.field_key] || null;
        }
      });

      traceLog('saving profile', { userId, fieldsCount: fields.length, hasPassword: !!password });

      const { error: updateError } = await supabase
        .from('clients')
        .update(updatePayload)
        .eq('user_id', userId);

      if (updateError) throw updateError;

      traceLog('profile saved successfully');

      await ensureEntitlement(userId, 'client');
      const { error: entActivateError } = await supabase
        .from('user_entitlements_data')
        .update({ subscription_status: 'active', updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (entActivateError) traceLog('entitlement activation failed', { error: entActivateError.message });

      if (password) {
        const { error: pwdError } = await supabase.auth.updateUser({ password });
        if (pwdError) {
          const msg = pwdError.message || '';
          if (msg.toLowerCase().includes('new password should be different from the old password')) {
          } else {
            setError('Profile saved, but password update failed: ' + pwdError.message);
            setSaving(false);
            return;
          }
        }
        traceLog('password updated');
      }

      traceLog('redirecting to onboarding');
      router.push('/client/onboarding');
    } catch (err: any) {
      traceLog('save failed', { error: err.message });
      setError(err.message ?? 'Failed to save profile. Please try again.');
      setSaving(false);
    }
  };

  if (loading || fieldsLoading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-medium">Loading your profile...</p>
        </div>
      </div>
    );
  }

  const stepFields = fieldsForStep(currentStep);
  const hasFields = stepFields.length > 0;

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {displayError && (
          <div className="mb-6 bg-red-900/20 border border-red-700/40 rounded-xl p-4 flex items-start gap-3 animate-shake">
            <i className="ri-error-warning-line text-red-400 text-xl mt-0.5 w-5 h-5 flex items-center justify-center"></i>
            <div className="flex-1">
              <p className="text-red-300 font-medium">{displayError}</p>
            </div>
            <button onClick={() => { setError(''); setLoadError(''); }} className="text-red-400 hover:text-red-200 cursor-pointer">
              <i className="ri-close-line text-xl w-5 h-5 flex items-center justify-center"></i>
            </button>
          </div>
        )}

        <ProfileWizard steps={WIZARD_STEPS} currentStep={currentStep} onStepClick={setCurrentStep} allowSkipAhead={false} />

        {currentStep === 1 && (
          <WizardCard title={`Welcome, ${userName}!`} icon="ri-hand-heart-line" description="Let&apos;s set up your business profile">
            <div className="space-y-6">
              <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-8">
                <h3 className="text-2xl font-bold mb-4 text-white">Complete Your Profile in a Few Easy Steps</h3>
                <p className="text-slate-400 mb-6">Whether you run a venue, organise events, or manage a security company — set up your profile to start hiring SIA-licensed guards directly.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FeatureItem icon="ri-shield-star-line" title="Verified Guards" desc="All guards are SIA-licensed and checked" />
                  <FeatureItem icon="ri-time-line" title="Book in Minutes" desc="Post a job and get matched fast" />
                  <FeatureItem icon="ri-secure-payment-line" title="Held Job Payments with Stripe" desc="Pay only after the shift is done" />
                  <FeatureItem icon="ri-customer-service-2-line" title="No Contracts" desc="Book by the shift, no lock-in" />
                </div>
              </div>
              <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <i className="ri-time-line text-teal-400 text-xl w-5 h-5 flex items-center justify-center"></i>
                  <div>
                    <h4 className="font-semibold text-teal-300 mb-1">Takes About 3 Minutes</h4>
                    <p className="text-sm text-teal-400">Your information is saved automatically as you progress.</p>
                  </div>
                </div>
              </div>
            </div>
          </WizardCard>
        )}

        {currentStep >= 2 && currentStep <= 5 && hasFields && (
          <WizardCard
            title={WIZARD_STEPS[currentStep - 1].title}
            icon={WIZARD_STEPS[currentStep - 1].icon}
            description={WIZARD_STEPS[currentStep - 1].description}
          >
            <div className="space-y-5">
              {stepFields.map((field) => {
                const key = field.field_key;
                const value = formData[key];
                const err = errors[key];
                const multi = field.field_key === 'security_needs' ||
                  (field.help_text && field.help_text.toLowerCase().includes('select all'));
                const options: string[] = Array.isArray(field.options) ? field.options : [];

                return (
                  <div key={field.id} className="space-y-1.5">
                    {field.field_type !== 'checkbox' && (
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        {field.field_label}
                        {field.is_required && <span className="text-red-400 ml-1">*</span>}
                        {field.help_text && !multi && (
                          <span className="text-slate-500 font-normal ml-1">({field.help_text})</span>
                        )}
                      </label>
                    )}

                    {field.field_type === 'textarea' && (
                      <textarea
                        id={key}
                        name={key}
                        value={value || ''}
                        onChange={(e) => setValue(key, e.target.value)}
                        className="w-full px-4 py-3 bg-[#162236] border border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white placeholder-slate-500 outline-none resize-none min-h-[100px]"
                        placeholder={field.placeholder || ''}
                        maxLength={500}
                      />
                    )}

                    {field.field_type === 'select' && multi && (
                      <div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {options.map((opt) => {
                            const selected = (value || []).includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => toggleMultiValue(key, opt)}
                                className={`px-3 py-3 rounded-xl border-2 text-xs font-medium transition-all text-center cursor-pointer ${
                                  selected
                                    ? 'border-teal-500 bg-teal-500/15 text-teal-300'
                                    : 'border-slate-700/50 bg-[#162236] text-slate-400 hover:border-slate-600'
                                }`}
                              >
                                {selected && <i className="ri-check-line text-teal-400 mr-1"></i>}
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                        {field.help_text && <p className="text-xs text-slate-500 mt-2">{field.help_text}</p>}
                      </div>
                    )}

                    {field.field_type === 'select' && !multi && (
                      <div className="relative">
                        <select
                          id={key}
                          name={key}
                          value={value || ''}
                          onChange={(e) => setValue(key, e.target.value)}
                          className="w-full px-4 py-3 bg-[#162236] border border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white outline-none pr-8 appearance-none cursor-pointer"
                          required={field.is_required}
                        >
                          <option value="" className="bg-[#162236]">{field.placeholder || 'Select...'}</option>
                          {options.map((opt) => (
                            <option key={opt} value={opt} className="bg-[#162236]">{opt}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <i className="ri-arrow-down-s-line text-slate-500 w-4 h-4 flex items-center justify-center"></i>
                        </div>
                      </div>
                    )}

                    {field.field_type === 'checkbox' && (
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          id={key}
                          name={key}
                          type="checkbox"
                          checked={value === 'true' || value === true}
                          onChange={(e) => setValue(key, e.target.checked ? 'true' : 'false')}
                          className="mt-1 w-4 h-4 accent-teal-500 flex-shrink-0 rounded"
                          required={field.is_required}
                        />
                        <span className="text-sm text-slate-400 leading-relaxed">{field.help_text || field.field_label}</span>
                      </label>
                    )}

                    {field.field_type === 'date' && (
                      <input
                        id={key}
                        name={key}
                        type="date"
                        value={value || ''}
                        onChange={(e) => setValue(key, e.target.value)}
                        className="w-full px-4 py-3 bg-[#162236] border border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white outline-none"
                        required={field.is_required}
                      />
                    )}

                    {['text','email','tel','number','password'].includes(field.field_type) && (
                      <input
                        id={key}
                        name={key}
                        type={field.field_type}
                        value={value || ''}
                        onChange={(e) => setValue(key, e.target.value)}
                        className={`w-full px-4 py-3 bg-[#162236] border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white placeholder-slate-500 outline-none ${
                          err ? 'border-red-500' : 'border-slate-600'
                        }`}
                        placeholder={field.placeholder || ''}
                        required={field.is_required}
                        min={field.field_type === 'number' ? 0 : undefined}
                        step={field.field_type === 'number' ? 'any' : undefined}
                      />
                    )}

                    {err && <p className="text-xs text-red-400 mt-1">{err}</p>}
                    {field.field_type === 'textarea' && (
                      <p className="text-xs text-slate-500 text-right">{(value || '').length}/500</p>
                    )}
                  </div>
                );
              })}

              {currentStep === 2 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                  <div className="relative">
                    <input type="text" value={userEmail} disabled className="w-full px-4 py-3 pl-12 border border-slate-600 rounded-xl bg-slate-800/60 text-slate-400 text-sm" />
                    <i className="ri-mail-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xl w-5 h-5 flex items-center justify-center"></i>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">This is your registered email address</p>
                </div>
              )}
            </div>
          </WizardCard>
        )}

        {currentStep >= 2 && currentStep <= 5 && !hasFields && (
          <WizardCard
            title={WIZARD_STEPS[currentStep - 1].title}
            icon={WIZARD_STEPS[currentStep - 1].icon}
            description="No fields configured for this step"
          >
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-[#162236] rounded-full mx-auto mb-3 flex items-center justify-center">
                <i className="ri-file-list-3-line text-slate-500 text-xl"></i>
              </div>
              <p className="text-sm text-slate-400">No fields configured for this section</p>
              <p className="text-xs text-slate-500 mt-1">Admin can add fields in the wizard editor</p>
            </div>
          </WizardCard>
        )}

        {currentStep === 6 && (
          <WizardCard title="Review Your Profile" icon="ri-shield-check-line" description="You&apos;re all set! Review and continue.">
            <div className="space-y-6">
              <div className="bg-[#111d35] border border-teal-500/20 rounded-xl p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 flex items-center justify-center bg-teal-500 rounded-full flex-shrink-0">
                    <i className="ri-check-line text-slate-900 text-2xl"></i>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">You&apos;re Almost Done!</h3>
                    <p className="text-slate-400">Complete your profile to start posting jobs and hiring security professionals. You can choose a subscription plan later from your dashboard.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {['Post unlimited security jobs','Access verified SIA-licensed guards','Manage all your security needs in one place','Get matched with the best guards'].map(text => (
                    <div key={text} className="flex items-center gap-3 text-sm text-slate-400">
                      <i className="ri-check-double-line text-teal-400 w-5 h-5 flex items-center justify-center"></i>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {fields.length > 0 && (
                <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-6">
                  <h4 className="text-sm font-semibold text-white mb-3">Profile Summary</h4>
                  <div className="space-y-2">
                    {fields.filter(f => f.is_enabled && formData[f.field_key] && formData[f.field_key] !== '').map(field => (
                      <div key={field.id} className="flex items-start gap-3 text-sm">
                        <span className="text-slate-500 font-medium min-w-[140px]">{field.field_label}:</span>
                        <span className="text-slate-300">
                          {Array.isArray(formData[field.field_key])
                            ? formData[field.field_key].join(', ')
                            : String(formData[field.field_key])
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-6">
                <h4 className="text-sm font-semibold text-white mb-2">Set Your Password (Optional)</h4>
                <p className="text-xs text-slate-400 mb-4">Create a password so you can log in next time without a magic link. You can skip this if you prefer.</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                        placeholder="Enter a password"
                        className="w-full px-4 py-3 pr-10 bg-[#162236] border border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white placeholder-slate-500 outline-none"
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                      >
                        <div className="w-5 h-5 flex items-center justify-center">
                          <i className={`text-slate-400 hover:text-slate-300 ${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}`}></i>
                        </div>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                        placeholder="Confirm your password"
                        className="w-full px-4 py-3 pr-10 bg-[#162236] border border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white placeholder-slate-500 outline-none"
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                      >
                        <div className="w-5 h-5 flex items-center justify-center">
                          <i className={`text-slate-400 hover:text-slate-300 ${showConfirmPassword ? 'ri-eye-off-line' : 'ri-eye-line'}`}></i>
                        </div>
                      </button>
                    </div>
                  </div>
                  {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
                  {password && confirmPassword && password === confirmPassword && password.length >= 6 && (
                    <p className="text-xs text-teal-400 flex items-center gap-1">
                      <i className="ri-check-line"></i> Passwords match
                    </p>
                  )}
                </div>
              </div>
            </div>
          </WizardCard>
        )}

        <WizardNavigation
          currentStep={currentStep}
          totalSteps={WIZARD_STEPS.length}
          onBack={handleBack}
          onNext={handleNext}
          onSubmit={handleSubmit}
          isSubmitting={saving}
          submitLabel={saving ? 'Saving...' : 'Complete Profile & Go to Dashboard'}
        />
      </div>
    </div>
  );
}

function FeatureItem({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
        <i className={`${icon} text-teal-400 text-xl`}></i>
      </div>
      <div>
        <h4 className="font-semibold text-white mb-1">{title}</h4>
        <p className="text-sm text-slate-400">{desc}</p>
      </div>
    </div>
  );
}