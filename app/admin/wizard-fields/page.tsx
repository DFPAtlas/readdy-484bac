'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface WizardField {
  id: string;
  wizard_type: string;
  field_key: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  is_enabled: boolean;
  sort_order: number;
  placeholder: string | null;
  help_text: string | null;
  options: any;
  created_at: string;
  updated_at: string;
}

const fieldTypeIcons: Record<string, string> = {
  text: 'ri-text',
  email: 'ri-mail-line',
  tel: 'ri-phone-line',
  password: 'ri-lock-password-line',
  textarea: 'ri-article-line',
  select: 'ri-list-unordered',
  checkbox: 'ri-checkbox-line',
  date: 'ri-calendar-line',
  number: 'ri-hashtag',
};

const fieldTypeLabels: Record<string, string> = {
  text: 'Text',
  email: 'Email',
  tel: 'Phone',
  password: 'Password',
  textarea: 'Textarea',
  select: 'Dropdown',
  checkbox: 'Checkbox',
  date: 'Date',
  number: 'Number',
};

const fieldTypeEntries = Object.entries(fieldTypeLabels);

function FieldTypeDropdown({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 text-sm border border-[#2a3d5e] rounded-lg px-2 py-1.5 bg-[#0a1628] text-white cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed hover:border-[#3a4d6e] transition min-w-[110px]"
      >
        <div className="w-5 h-5 flex items-center justify-center text-slate-400">
          <i className={fieldTypeIcons[value] || 'ri-text'}></i>
        </div>
        <span className="flex-1 text-left">{fieldTypeLabels[value] || value}</span>
        <div className="w-4 h-4 flex items-center justify-center text-slate-500">
          <i className="ri-arrow-down-s-line"></i>
        </div>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-[#0d1b33] border border-[#2a3d5e] rounded-xl shadow-lg z-50 py-1 min-w-[160px]">
          {fieldTypeEntries.map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => { onChange(k); setOpen(false); }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left whitespace-nowrap cursor-pointer transition ${
                k === value ? 'bg-teal-600/20 text-teal-400' : 'text-slate-300 hover:bg-[#162544] hover:text-white'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className={fieldTypeIcons[k] || 'ri-text'}></i>
              </div>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PreviewPanel({ activeTab, fields }: { activeTab: 'client' | 'guard' | 'client_profile' | 'guard_profile'; fields: WizardField[] }) {
  const previewFields = fields
    .filter((f) => f.wizard_type === activeTab && f.is_enabled)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4a] shadow-sm p-6 sticky top-20">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
          <i className="ri-eye-line text-white text-sm"></i>
        </div>
        <h3 className="text-sm font-bold text-white">Live Preview</h3>
        <span className="ml-auto text-xs px-2 py-0.5 bg-teal-500/10 text-teal-400 rounded-full font-medium">
          {activeTab === 'client' ? 'Client Signup' : activeTab === 'guard' ? 'Guard Signup' : activeTab === 'client_profile' ? 'Client Profile' : 'Guard Profile'}
        </span>
      </div>

      <div className="bg-[#0a0f1c] rounded-xl p-5 space-y-4 max-h-[600px] overflow-y-auto border border-[#1e2d4a]">
        <div className="text-center mb-4">
          <h4 className="text-white font-bold text-sm">
            {activeTab === 'client' ? 'Register as Client' : activeTab === 'guard' ? 'Create Your Guard Account' : activeTab === 'client_profile' ? 'Complete Client Profile' : 'Complete Guard Profile'}
          </h4>
          <p className="text-slate-400 text-xs mt-1">This is how users will see your form</p>
        </div>

        {previewFields.map((field) => (
          <div key={field.id}>
            {field.field_type !== 'checkbox' && (
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                {field.field_label}
                {field.is_required && <span className="text-red-400 ml-1">*</span>}
              </label>
            )}
            {field.field_type === 'textarea' ? (
              <div className="w-full h-20 bg-[#1a2b4a] border border-[#2a3d5e] rounded-lg"></div>
            ) : field.field_type === 'select' ? (
              <div className="w-full h-10 bg-[#1a2b4a] border border-[#2a3d5e] rounded-lg flex items-center px-3">
                <span className="text-xs text-slate-500">{field.placeholder || 'Select...'}</span>
              </div>
            ) : field.field_type === 'checkbox' ? (
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded bg-[#1a2b4a] border border-[#2a3d5e] mt-0.5 flex-shrink-0"></div>
                <span className="text-xs text-slate-400 leading-relaxed">{field.help_text || field.field_label}</span>
              </div>
            ) : (
              <div className="w-full h-10 bg-[#1a2b4a] border border-[#2a3d5e] rounded-lg flex items-center px-3">
                <span className="text-xs text-slate-500">{field.placeholder || field.field_label}</span>
              </div>
            )}
          </div>
        ))}

        {previewFields.length === 0 && (
          <div className="text-center py-6">
            <div className="w-10 h-10 bg-[#1a2b4a] rounded-full mx-auto mb-2 flex items-center justify-center">
              <i className="ri-file-list-3-line text-slate-600 text-sm"></i>
            </div>
            <p className="text-xs text-slate-500">No fields enabled</p>
          </div>
        )}

        {previewFields.length > 0 && (
          <div className="h-10 bg-teal-500 rounded-lg mt-2"></div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-[#1e2d4a]">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">
            <span className="font-semibold text-white">{previewFields.length}</span> fields visible
          </span>
          <span className="text-slate-400">
            <span className="font-semibold text-white">{previewFields.filter(f => f.is_required).length}</span> required
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AdminWizardFields() {
  const [activeTab, setActiveTab] = useState<'client' | 'guard' | 'client_profile' | 'guard_profile'>('client');
  const [fields, setFields] = useState<WizardField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WizardField | null>(null);

  const dirtyFieldIds = useRef<Set<string>>(new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allFieldsRef = useRef<WizardField[]>([]);

  useEffect(() => {
    async function checkRole() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setRoleChecked(true);
        return;
      }
      const { data: adminCheck } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (adminCheck?.role === 'super_admin') {
        setIsSuperAdmin(true);
      }
      setRoleChecked(true);
    }
    checkRole();
  }, []);

  const fetchFields = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from('wizard_fields')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) {
      setFetchError('Failed to load wizard fields.');
      showToast('Failed to load wizard fields.', 'error');
      setLoading(false);
      return;
    }
    setFields(data || []);
    allFieldsRef.current = data || [];
    dirtyFieldIds.current.clear();
    setLoading(false);
  }, []);

  useEffect(() => { fetchFields(); }, [fetchFields]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  function markDirty(id: string) {
    dirtyFieldIds.current.add(id);
  }

  function markDirtyMany(ids: string[]) {
    ids.forEach((id) => dirtyFieldIds.current.add(id));
  }

  const filteredFields = fields
    .filter((f) => f.wizard_type === activeTab)
    .sort((a, b) => a.sort_order - b.sort_order);

  function updateLocal(id: string, patch: Partial<WizardField>) {
    markDirty(id);
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function moveField(id: string, direction: 'up' | 'down') {
    const list = [...filteredFields];
    const idx = list.findIndex((f) => f.id === id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const temp = list[idx].sort_order;
    list[idx].sort_order = list[swapIdx].sort_order;
    list[swapIdx].sort_order = temp;
    markDirtyMany([list[idx].id, list[swapIdx].id]);
    setFields((prev) =>
      prev.map((f) => {
        const match = list.find((l) => l.id === f.id);
        return match ? { ...f, sort_order: match.sort_order } : f;
      })
    );
  }

  async function saveChanges() {
    setSaving(true);
    const dirtyIds = Array.from(dirtyFieldIds.current);
    if (dirtyIds.length === 0) {
      showToast('No changes to save.', 'success');
      setSaving(false);
      return;
    }
    const currentFields = allFieldsRef.current.reduce((map, f) => { map[f.id] = f; return map; }, {} as Record<string, WizardField>);
    const changedFields = fields.filter((f) => dirtyIds.includes(f.id));

    for (const field of changedFields) {
      const original = currentFields[field.id];
      if (!original) continue;
      const { error } = await supabase
        .from('wizard_fields')
        .update({
          field_label: field.field_label,
          field_type: field.field_type,
          is_required: field.is_required,
          is_enabled: field.is_enabled,
          sort_order: field.sort_order,
          placeholder: field.placeholder,
          help_text: field.help_text,
        })
        .eq('id', field.id);
      if (error) {
        showToast(`Failed to save "${field.field_label}".`, 'error');
        setSaving(false);
        return;
      }
    }
    allFieldsRef.current = [...fields];
    dirtyFieldIds.current.clear();
    showToast('All changes saved successfully.', 'success');
    setSaving(false);
  }

  async function addField() {
    const maxOrder = filteredFields.reduce((max, f) => Math.max(max, f.sort_order), 0);
    const { data, error } = await supabase
      .from('wizard_fields')
      .insert({
        wizard_type: activeTab,
        field_key: `new_field_${Date.now()}`,
        field_label: 'New Field',
        field_type: 'text',
        is_required: true,
        is_enabled: true,
        sort_order: maxOrder + 1,
        placeholder: null,
        help_text: null,
        options: null,
      })
      .select()
      .single();
    if (error) {
      showToast('Failed to add field.', 'error');
      return;
    }
    if (data) {
      setFields((prev) => [...prev, data]);
      allFieldsRef.current = [...allFieldsRef.current, data];
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);

    const { error } = await supabase
      .from('wizard_fields')
      .delete()
      .eq('id', target.id);
    if (error) {
      showToast('Failed to remove field.', 'error');
      return;
    }
    setFields((prev) => prev.filter((f) => f.id !== target.id));
    allFieldsRef.current = allFieldsRef.current.filter((f) => f.id !== target.id);
    dirtyFieldIds.current.delete(target.id);

    const { data: { session } } = await supabase.auth.getSession();
    const adminUserId = session?.user?.id;
    if (adminUserId) {
      supabase.from('admin_activity_log').insert({
        admin_user_id: adminUserId,
        action: 'wizard_field_deleted',
        details: JSON.stringify({
          field_id: target.id,
          field_key: target.field_key,
          field_label: target.field_label,
          wizard_type: target.wizard_type,
        }),
      }).then(({ error: logError }) => {
        if (logError) {
          supabase.from('admin_activity_log').insert({
            admin_user_id: adminUserId,
            action: 'wizard_field_deleted',
            target_id: target.id,
            target_type: 'wizard_fields',
            metadata: { field_key: target.field_key, field_label: target.field_label, wizard_type: target.wizard_type },
          }).then(() => {});
        }
      });
    }
    showToast(`"${target.field_label}" deleted.`, 'success');
  }

  const dirtyCount = dirtyFieldIds.current.size;
  const canEdit = roleChecked && isSuperAdmin;

  if (!roleChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0f1c]">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1c]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0d1629]/80 backdrop-blur-md border-b border-[#1e2d4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm shadow-teal-500/20">
                <i className="ri-file-list-3-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Portal Editor</h1>
                <p className="text-xs text-slate-400">Configure registration forms and profile wizards for clients and guards</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {dirtyCount > 0 && canEdit && (
                <span className="text-xs text-amber-400 font-medium px-2 py-1 bg-amber-400/10 rounded-lg">
                  {dirtyCount} unsaved change{dirtyCount !== 1 ? 's' : ''}
                </span>
              )}
              <button
                onClick={fetchFields}
                className="flex items-center gap-2 px-4 py-2 border border-[#2a3d5e] rounded-xl text-sm font-medium text-slate-300 hover:bg-[#111d35] cursor-pointer whitespace-nowrap transition-colors"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
                Refresh
              </button>
              {canEdit && (
                <button
                  onClick={saveChanges}
                  disabled={saving || dirtyCount === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-500 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-save-line"></i></div>
                  )}
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        {/* Role restriction banner */}
        {!canEdit && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="ri-lock-line text-white"></i>
            </div>
            <div>
              <p className="text-sm font-medium text-amber-300 mb-0.5">Read-only mode</p>
              <p className="text-sm text-amber-200/80 leading-relaxed">
                Only super admins can edit wizard fields. You are viewing this page in read-only mode. Contact a super admin if changes are needed.
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 bg-[#111d35] border border-[#1e2d4a] rounded-xl p-1 w-fit">
          {[
            { key: 'client', icon: 'ri-building-line', label: 'Client Signup' },
            { key: 'guard', icon: 'ri-shield-user-line', label: 'Guard Signup' },
            { key: 'client_profile', icon: 'ri-building-2-line', label: 'Client Profile Wizard' },
            { key: 'guard_profile', icon: 'ri-shield-star-line', label: 'Guard Profile Wizard' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
              activeTab === tab.key ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white hover:bg-[#1a2b4a]'
            }`}
            >
              <div className="w-4 h-4 flex items-center justify-center"><i className={tab.icon}></i></div>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Info banner */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="ri-information-line text-white"></i>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-300 mb-0.5">How it works</p>
            <p className="text-sm text-blue-200/80 leading-relaxed">
              Toggle fields on/off to control which inputs appear on the public signup forms. You can rename labels, change the order, and mark fields as required or optional. The registration pages automatically render whatever fields you enable here. Changes are live immediately after saving.
            </p>
          </div>
        </div>

        {/* Fetch error banner */}
        {fetchError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ri-error-warning-line text-white"></i>
              </div>
              <p className="text-sm font-medium text-red-300">{fetchError}</p>
            </div>
            <button
              onClick={fetchFields}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-500 transition cursor-pointer whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Editor */}
            <div className="lg:col-span-2 bg-[#111d35] rounded-2xl border border-[#1e2d4a] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0d1b33] border-b border-[#1e2d4a]">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-16">Order</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Field Label</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Field Key</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Required</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Enabled</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Placeholder</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2d4a]">
                  {filteredFields.map((field, idx) => (
                    <tr key={field.id} className="hover:bg-[#162544]/60 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveField(field.id, 'up')}
                            disabled={idx === 0 || !canEdit}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#1e2d4a] text-slate-500 hover:text-slate-300 transition disabled:opacity-30 cursor-pointer"
                          >
                            <i className="ri-arrow-up-line"></i>
                          </button>
                          <span className="text-xs font-medium text-slate-400 w-5 text-center">{idx + 1}</span>
                          <button
                            onClick={() => moveField(field.id, 'down')}
                            disabled={idx === filteredFields.length - 1 || !canEdit}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#1e2d4a] text-slate-500 hover:text-slate-300 transition disabled:opacity-30 cursor-pointer"
                          >
                            <i className="ri-arrow-down-line"></i>
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <input
                          type="text"
                          value={field.field_label}
                          onChange={(e) => updateLocal(field.id, { field_label: e.target.value })}
                          disabled={!canEdit}
                          className="w-full px-3 py-1.5 text-sm border border-[#2a3d5e] rounded-lg bg-[#0a1628] text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs text-slate-400 bg-[#0d1b33] px-2 py-1 rounded">{field.field_key}</span>
                      </td>
                      <td className="px-5 py-4">
                        <FieldTypeDropdown
                          value={field.field_type}
                          onChange={(v) => updateLocal(field.id, { field_type: v })}
                          disabled={!canEdit}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <label className={`inline-flex items-center ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                          <input
                            type="checkbox"
                            checked={field.is_required}
                            onChange={(e) => updateLocal(field.id, { is_required: e.target.checked })}
                            disabled={!canEdit}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5 bg-[#2a3d5e] rounded-full peer peer-checked:bg-teal-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-5 relative"></div>
                        </label>
                      </td>
                      <td className="px-5 py-4">
                        <label className={`inline-flex items-center ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                          <input
                            type="checkbox"
                            checked={field.is_enabled}
                            onChange={(e) => updateLocal(field.id, { is_enabled: e.target.checked })}
                            disabled={!canEdit}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5 bg-[#2a3d5e] rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-5 relative"></div>
                        </label>
                      </td>
                      <td className="px-5 py-4">
                        <input
                          type="text"
                          value={field.placeholder || ''}
                          onChange={(e) => updateLocal(field.id, { placeholder: e.target.value })}
                          disabled={!canEdit}
                          className="w-full px-3 py-1.5 text-sm border border-[#2a3d5e] rounded-lg bg-[#0a1628] text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
                          placeholder="Placeholder text..."
                        />
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setDeleteTarget(field)}
                          disabled={!canEdit}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Remove field"
                        >
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredFields.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center">
                        <div className="w-12 h-12 flex items-center justify-center bg-[#1a2b4a] rounded-full mx-auto mb-3">
                          <i className="ri-file-list-3-line text-xl text-slate-600"></i>
                        </div>
                        <p className="text-sm text-slate-400 font-medium">No fields configured</p>
                        <p className="text-xs text-slate-500 mt-1">Add your first field below</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {canEdit && (
                <div className="px-5 py-4 border-t border-[#1e2d4a] bg-[#0d1b33]/60">
                  <button
                    onClick={addField}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1a2b4a] border border-[#2a3d5e] rounded-xl text-sm font-medium text-slate-300 hover:bg-[#1e2d4a] hover:border-[#3a4d6e] hover:text-white transition cursor-pointer whitespace-nowrap"
                  >
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-add-line"></i></div>
                    Add New Field
                  </button>
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="hidden lg:block">
              <PreviewPanel activeTab={activeTab} fields={fields} />
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center" onClick={() => setDeleteTarget(null)}>
          <div className="bg-[#111d35] border border-[#1e2d4a] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="ri-delete-bin-line text-red-400 text-lg"></i>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Field</h3>
                <p className="text-xs text-slate-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <div className="bg-[#0d1b33] rounded-xl p-4 mb-5 border border-[#1e2d4a]">
              <p className="text-sm text-slate-300">
                Are you sure you want to delete <span className="text-white font-semibold">&ldquo;{deleteTarget.field_label}&rdquo;</span>?
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                <span className="font-mono bg-[#0a1628] px-2 py-0.5 rounded">{deleteTarget.field_key}</span>
                <span className="px-2 py-0.5 bg-[#1a2b4a] rounded capitalize">{deleteTarget.wizard_type.replace(/_/g, ' ')}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 border border-[#2a3d5e] rounded-xl text-sm font-medium text-slate-300 hover:bg-[#1a2b4a] transition cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-500 transition cursor-pointer whitespace-nowrap"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile preview floating button */}
      {!loading && (
        <div className="lg:hidden fixed bottom-6 right-6 z-40">
          <button
            onClick={() => {
              const el = document.getElementById('mobile-preview');
              if (el) el.classList.toggle('hidden');
            }}
            className="w-12 h-12 bg-teal-600 text-white rounded-full shadow-lg shadow-teal-500/20 flex items-center justify-center cursor-pointer"
          >
            <i className="ri-eye-line text-lg"></i>
          </button>
        </div>
      )}

      {/* Mobile preview drawer */}
      <div id="mobile-preview" className="hidden lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) document.getElementById('mobile-preview')?.classList.add('hidden'); }}>
        <div className="absolute bottom-0 left-0 right-0 bg-[#111d35] rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto border-t border-[#1e2d4a]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">Live Preview</h3>
            <button
              onClick={() => document.getElementById('mobile-preview')?.classList.add('hidden')}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] text-slate-400 cursor-pointer"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
          <PreviewPanel activeTab={activeTab} fields={fields} />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          <div className="w-5 h-5 flex items-center justify-center">
            <i className={toast.type === 'success' ? 'ri-check-line text-base' : 'ri-error-warning-line text-base'}></i>
          </div>
          {toast.message}
        </div>
      )}
    </div>
  );
}