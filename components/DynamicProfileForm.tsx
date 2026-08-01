'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

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

interface DynamicProfileFormProps {
  wizardType: 'client_profile' | 'guard_profile';
  initialData?: Record<string, any>;
  onDataChange?: (data: Record<string, any>) => void;
}

const MULTI_SELECT_KEYS = ['security_needs', 'certifications', 'available_days'];

function isMultiSelect(field: WizardField): boolean {
  return MULTI_SELECT_KEYS.includes(field.field_key) ||
    (field.help_text && field.help_text.toLowerCase().includes('select all'));
}

export function useProfileWizardFields(wizardType: 'client_profile' | 'guard_profile') {
  const [fields, setFields] = useState<WizardField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFields = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('wizard_fields')
      .select('*')
      .eq('wizard_type', wizardType)
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('Failed to load wizard fields:', error);
      setError(error.message);
    }
    if (!error && data) {
      setFields(data);
    }
    setLoading(false);
  }, [wizardType]);

  useEffect(() => { loadFields(); }, [loadFields]);

  return { fields, loading, error, refresh: loadFields };
}

export function useProfileFormData(fields: WizardField[], initialData?: Record<string, any>) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const initial: Record<string, any> = {};
    fields.forEach((f) => {
      if (initialData && initialData[f.field_key] !== undefined) {
        initial[f.field_key] = initialData[f.field_key];
      } else if (isMultiSelect(f)) {
        initial[f.field_key] = [];
      } else {
        initial[f.field_key] = '';
      }
    });
    setFormData(initial);
    setErrors({});
  }, [fields, initialData]);

  const setValue = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const toggleMultiValue = (key: string, value: string) => {
    setFormData((prev) => {
      const current = prev[key] || [];
      const next = current.includes(value)
        ? current.filter((v: string) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    fields.forEach((field) => {
      if (!field.is_enabled) return;
      if (field.is_required) {
        const val = formData[field.field_key];
        if (val === '' || val === null || val === undefined ||
            (Array.isArray(val) && val.length === 0)) {
          newErrors[field.field_key] = `${field.field_label} is required`;
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return { formData, errors, setValue, toggleMultiValue, validate };
}

export default function DynamicProfileForm({
  wizardType,
  initialData,
  onDataChange,
}: DynamicProfileFormProps) {
  const { fields, loading, error } = useProfileWizardFields(wizardType);
  const { formData, errors, setValue, toggleMultiValue } = useProfileFormData(fields, initialData);

  useEffect(() => {
    if (onDataChange) {
      onDataChange(formData);
    }
  }, [formData, onDataChange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 bg-[#162236] rounded-full mx-auto mb-3 flex items-center justify-center">
          <i className="ri-file-list-3-line text-slate-500 text-xl"></i>
        </div>
        <p className="text-sm text-slate-400">No profile fields configured</p>
      </div>
    );
  }

  // Group fields into sections for better visual organization
  const personalFields = fields.filter(f =>
    ['first_name','last_name','phone'].includes(f.field_key)
  );
  const companyFields = fields.filter(f =>
    ['company_name','industry','company_size','website'].includes(f.field_key)
  );
  const locationFields = fields.filter(f =>
    ['address_line1','address_line2','city','postcode'].includes(f.field_key)
  );
  const otherFields = fields.filter(f =>
    !['first_name','last_name','phone','company_name','industry','company_size','website',
      'address_line1','address_line2','city','postcode'].includes(f.field_key)
  );

  const hasPersonal = personalFields.length > 0;
  const hasCompany = companyFields.length > 0;
  const hasLocation = locationFields.length > 0;
  const hasOther = otherFields.length > 0;

  const renderField = (field: WizardField) => {
    const key = field.field_key;
    const value = formData[key];
    const error = errors[key];
    const multi = isMultiSelect(field);
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
            {field.help_text && (
              <p className="text-xs text-slate-500 mt-2">{field.help_text}</p>
            )}
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
            <span className="text-sm text-slate-400 leading-relaxed">
              {field.help_text || field.field_label}
            </span>
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
              error ? 'border-red-500' : 'border-slate-600'
            }`}
            placeholder={field.placeholder || ''}
            required={field.is_required}
            min={field.field_type === 'number' ? 0 : undefined}
            step={field.field_type === 'number' ? 'any' : undefined}
          />
        )}

        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        {field.field_type === 'textarea' && (
          <p className="text-xs text-slate-500 text-right">
            {(value || '').length}/500
          </p>
        )}
      </div>
    );
  };

  const SectionCard = ({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) => (
    <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg">
          <i className={`${icon} text-teal-400 text-lg`}></i>
        </div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      {hasPersonal && (
        <SectionCard title="Personal Details" icon="ri-user-line">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {personalFields.map(renderField)}
          </div>
        </SectionCard>
      )}

      {hasCompany && (
        <SectionCard title="Company Information" icon="ri-building-line">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {companyFields.map(renderField)}
          </div>
        </SectionCard>
      )}

      {hasLocation && (
        <SectionCard title="Business Location" icon="ri-map-pin-line">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {locationFields.map(renderField)}
          </div>
        </SectionCard>
      )}

      {hasOther && (
        <SectionCard title="Additional Information" icon="ri-settings-3-line">
          <div className="space-y-5">
            {otherFields.map(renderField)}
          </div>
        </SectionCard>
      )}
    </div>
  );
}