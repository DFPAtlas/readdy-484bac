'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import PasswordStrengthIndicator from '@/components/PasswordStrengthIndicator';

interface WizardField {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  is_enabled: boolean;
  sort_order: number;
  placeholder: string | null;
  help_text: string | null;
  options: any;
}

interface DynamicSignupFormProps {
  wizardType: 'client' | 'guard';
  theme: 'dark' | 'light';
  onSubmit: (formData: Record<string, string>) => void;
  loading: boolean;
  socialButtons?: React.ReactNode;
  error?: string | null;
  extraFormContent?: React.ReactNode;
}

function camelCase(str: string) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export default function DynamicSignupForm({
  wizardType,
  theme,
  onSubmit,
  loading,
  socialButtons,
  error,
  extraFormContent,
}: DynamicSignupFormProps) {
  const [fields, setFields] = useState<WizardField[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [passwordsMatch, setPasswordsMatch] = useState<boolean | null>(null);
  const [fetching, setFetching] = useState(true);

  const isDark = theme === 'dark';

  const inputBase = isDark
    ? 'w-full px-4 py-3 bg-[#162236] border border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white placeholder-slate-500 outline-none'
    : 'w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900 placeholder-slate-400 outline-none';

  const labelBase = isDark
    ? 'block text-sm font-medium text-slate-300 mb-2'
    : 'block text-sm font-medium text-slate-700 mb-2';

  const loadFields = useCallback(async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from('wizard_fields')
      .select('*')
      .eq('wizard_type', wizardType)
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true });
    if (!error && data) {
      setFields(data);
      const initial: Record<string, string> = {};
      data.forEach((f: WizardField) => { initial[f.field_key] = ''; });
      setFormData(initial);
    }
    setFetching(false);
  }, [wizardType]);

  useEffect(() => { loadFields(); }, [loadFields]);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));

    if (key === 'password' || key === 'confirm_password') {
      const pwd = key === 'password' ? value : formData.password || '';
      const confirmPwd = key === 'confirm_password' ? value : formData.confirm_password || '';
      if (confirmPwd.length > 0) {
        setPasswordsMatch(pwd === confirmPwd);
      } else {
        setPasswordsMatch(null);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const renderField = (field: WizardField) => {
    const key = field.field_key;
    const value = formData[key] || '';

    switch (field.field_type) {
      case 'textarea':
        return (
          <textarea
            id={key}
            name={key}
            value={value}
            onChange={(e) => handleChange(key, e.target.value)}
            className={`${inputBase} min-h-[100px] resize-none`}
            placeholder={field.placeholder || ''}
            required={field.is_required}
          />
        );
      case 'select':
        return (
          <select
            id={key}
            name={key}
            value={value}
            onChange={(e) => handleChange(key, e.target.value)}
            className={inputBase + ' pr-8'}
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
              id={key}
              name={key}
              type="checkbox"
              checked={value === 'true'}
              onChange={(e) => handleChange(key, e.target.checked ? 'true' : 'false')}
              className="mt-1 w-4 h-4 accent-teal-500 flex-shrink-0"
              required={field.is_required}
            />
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
              {field.help_text || field.field_label}
            </span>
          </label>
        );
      case 'date':
        return (
          <input
            id={key}
            name={key}
            type="date"
            value={value}
            onChange={(e) => handleChange(key, e.target.value)}
            className={inputBase}
            required={field.is_required}
          />
        );
      case 'number':
        return (
          <input
            id={key}
            name={key}
            type="number"
            value={value}
            onChange={(e) => handleChange(key, e.target.value)}
            className={inputBase}
            placeholder={field.placeholder || ''}
            required={field.is_required}
          />
        );
      default:
        return (
          <input
            id={key}
            name={key}
            type={field.field_type}
            value={value}
            onChange={(e) => handleChange(key, e.target.value)}
            className={
              key === 'confirm_password' && passwordsMatch === false
                ? inputBase.replace('border-slate-600', 'border-red-700').replace('border-slate-200', 'border-red-400')
                : inputBase
            }
            placeholder={field.placeholder || ''}
            required={field.is_required}
            minLength={field.field_type === 'password' ? 6 : undefined}
          />
        );
    }
  };

  const enabledFields = fields.filter((f) => f.is_enabled);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className={`mb-4 p-4 rounded-lg ${isDark ? 'bg-red-900/30 border border-red-700/40' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>
        </div>
      )}

      {enabledFields.map((field) => (
        <div key={field.id}>
          {field.field_type !== 'checkbox' && (
            <label htmlFor={field.field_key} className={labelBase}>
              {field.field_label}
              {field.is_required && <span className="text-red-400 ml-1">*</span>}
            </label>
          )}
          {renderField(field)}
          {field.field_type === 'password' && field.field_key === 'password' && (
            <PasswordStrengthIndicator password={formData.password || ''} />
          )}
          {field.field_type === 'password' && field.field_key === 'confirm_password' && (
            <>
              {passwordsMatch === false && (
                <p className={`mt-1 text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>Passwords do not match</p>
              )}
              {passwordsMatch === true && (
                <p className={`mt-1 text-sm ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>Passwords match</p>
              )}
            </>
          )}
        </div>
      ))}

      {extraFormContent}

      <button
        type="submit"
        disabled={loading}
        className={`w-full py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
          isDark
            ? 'bg-teal-500 text-slate-900 hover:bg-teal-400'
            : 'bg-teal-600 text-white hover:bg-teal-700'
        }`}
      >
        {loading ? 'Creating Account...' : 'Create Account'}
      </button>
    </form>
  );
}