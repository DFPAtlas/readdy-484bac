'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Client {
  id: string;
  contact_name: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  postcode: string | null;
  address: string | null;
  company_type: string | null;
  industry: string | null;
  company_size: string | null;
  website: string | null;
  verified: boolean | null;
  profile_completed: boolean | null;
  total_jobs_posted: number | null;
  active_jobs: number | null;
  total_spent: number | null;
  created_at: string | null;
  last_login: string | null;
  notes: string | null;
  is_suspended?: boolean | null;
}

interface Props {
  client: Client;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ClientProfileDetailModal({ client, onClose, onUpdate }: Props) {
  const [local, setLocal] = useState(client);
  const [loading, setLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(client.notes || '');
  const [activeTab, setActiveTab] = useState<'overview' | 'company' | 'activity' | 'notes'>('overview');

  const callAdminApi = async (action: string, payload: Record<string, any>) => {
    const { data, error } = await supabase.functions.invoke('admin-clients', {
      body: { action, ...payload },
    });
    if (error) return { success: false, error: error.message };
    return data;
  };

  const displayName =
    local.first_name && local.last_name
      ? `${local.first_name} ${local.last_name}`
      : local.contact_name || 'Unknown';

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleVerify = async () => {
    setLoading('verify');
    setConfirm(null);
    const result = await callAdminApi('update', {
      id: local.id,
      updates: { verified: !local.verified },
    });
    if (result.success) {
      setLocal((p) => ({ ...p, verified: !p.verified }));
      showToast(local.verified ? 'Verification removed' : 'Client verified');
      onUpdate();
    } else {
      showToast(result.error || 'Failed to update verification');
    }
    setLoading(null);
  };

  const handleSuspend = async () => {
    setLoading('suspend');
    setConfirm(null);
    const result = await callAdminApi('update', {
      id: local.id,
      updates: { is_suspended: !local.is_suspended },
    });
    if (result.success) {
      setLocal((p) => ({ ...p, is_suspended: !p.is_suspended }));
      showToast(local.is_suspended ? 'Account reactivated' : 'Account suspended');
      onUpdate();
    } else {
      showToast(result.error || 'Failed to update suspension status');
    }
    setLoading(null);
  };

  const handleSaveNotes = async () => {
    setLoading('notes');
    const result = await callAdminApi('update', {
      id: local.id,
      updates: { notes: notes.trim() || null },
    });
    if (result.success) {
      setLocal((p) => ({ ...p, notes: notes.trim() || null }));
      setEditingNotes(false);
      showToast('Notes saved');
      onUpdate();
    } else {
      showToast(result.error || 'Failed to save notes');
    }
    setLoading(null);
  };

  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'ri-user-line' },
    { key: 'company', label: 'Company', icon: 'ri-building-line' },
    { key: 'activity', label: 'Activity', icon: 'ri-history-line' },
    { key: 'notes', label: 'Notes', icon: 'ri-sticky-note-line' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[#111d35] rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col border border-[#1a2b4a]"
        onClick={(e) => e.stopPropagation()}
      >
        {toast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium">
            <i className="ri-checkbox-circle-fill"></i>
            {toast}
          </div>
        )}

        {confirm && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 rounded-2xl">
            <div className="bg-[#111d35] rounded-xl p-6 m-4 max-w-sm shadow-xl border border-[#1a2b4a]">
              <div className="w-12 h-12 flex items-center justify-center bg-amber-500/10 rounded-full mx-auto mb-4">
                <i className="ri-error-warning-line text-2xl text-amber-400"></i>
              </div>
              <h3 className="text-lg font-semibold text-center mb-2 text-white">
                {confirm === 'verify'
                  ? local.verified ? 'Remove Verification?' : 'Verify Client?'
                  : local.is_suspended ? 'Reactivate Account?' : 'Suspend Account?'}
              </h3>
              <p className="text-sm text-slate-400 text-center mb-6">
                {confirm === 'verify'
                  ? local.verified
                    ? 'This will remove the verified badge from this client.'
                    : 'This will mark the client as verified.'
                  : local.is_suspended
                  ? 'This will restore full access to this account.'
                  : 'This will prevent the client from posting jobs.'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirm(null)}
                  className="flex-1 px-4 py-2 border border-[#1a2b4a] text-slate-300 rounded-lg hover:bg-[#1a2b4a] cursor-pointer whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  onClick={confirm === 'verify' ? handleVerify : handleSuspend}
                  className={`flex-1 px-4 py-2 rounded-lg text-white cursor-pointer whitespace-nowrap ${
                    confirm === 'suspend' && !local.is_suspended
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-teal-600 hover:bg-teal-500'
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-teal-600 to-cyan-700 px-6 py-6 text-white relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center bg-white/20 rounded-xl text-2xl font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold truncate">{displayName}</h2>
              <p className="text-white/70 text-sm truncate">{local.company_name || 'No company'}</p>
              <p className="text-white/60 text-xs truncate">{local.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {local.is_suspended ? (
                  <span className="px-2 py-0.5 bg-red-400/30 text-red-100 text-xs rounded-full flex items-center gap-1">
                    <i className="ri-forbid-line"></i> Suspended
                  </span>
                ) : local.verified ? (
                  <span className="px-2 py-0.5 bg-emerald-400/30 text-emerald-100 text-xs rounded-full flex items-center gap-1">
                    <i className="ri-checkbox-circle-fill"></i> Verified
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-white/20 text-white/70 text-xs rounded-full">Unverified</span>
                )}
                {local.profile_completed ? (
                  <span className="px-2 py-0.5 bg-teal-400/30 text-teal-100 text-xs rounded-full">Profile Complete</span>
                ) : (
                  <span className="px-2 py-0.5 bg-amber-400/30 text-amber-100 text-xs rounded-full">Incomplete Profile</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 px-6 py-4 bg-[#0a1628] border-b border-[#1a2b4a] flex-shrink-0">
          <div className="bg-[#111d35] rounded-xl p-3 text-center border border-[#1a2b4a]">
            <p className="text-2xl font-bold text-teal-400">{local.total_jobs_posted || 0}</p>
            <p className="text-xs text-slate-500">Jobs Posted</p>
          </div>
          <div className="bg-[#111d35] rounded-xl p-3 text-center border border-[#1a2b4a]">
            <p className="text-2xl font-bold text-emerald-400">{local.active_jobs || 0}</p>
            <p className="text-xs text-slate-500">Active Jobs</p>
          </div>
          <div className="bg-[#111d35] rounded-xl p-3 text-center border border-[#1a2b4a]">
            <p className="text-2xl font-bold text-purple-400">£{(local.total_spent || 0).toLocaleString()}</p>
            <p className="text-xs text-slate-500">Total Spent</p>
          </div>
        </div>

        <div className="flex border-b border-[#1a2b4a] px-6 flex-shrink-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === t.key
                  ? 'border-teal-500 text-teal-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <i className={t.icon}></i>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-[#0B1933]">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Contact Information</h3>
              <div className="bg-[#0a1628] rounded-xl p-4 space-y-3 border border-[#1a2b4a]">
                {[
                  { icon: 'ri-mail-line', label: 'Email', value: local.email },
                  { icon: 'ri-phone-line', label: 'Phone', value: local.phone || 'Not provided' },
                  {
                    icon: 'ri-map-pin-line',
                    label: 'Location',
                    value: [local.address, local.city, local.postcode].filter(Boolean).join(', ') || 'Not provided',
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-[#111d35] rounded-lg flex-shrink-0 border border-[#1a2b4a]">
                      <i className={`${row.icon} text-slate-400`}></i>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{row.label}</p>
                      <p className="text-sm font-medium text-white">{row.value}</p>
                    </div>
                  </div>
                ))}
                {local.website && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-[#111d35] rounded-lg flex-shrink-0 border border-[#1a2b4a]">
                      <i className="ri-global-line text-slate-400"></i>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Website</p>
                      <a
                        href={local.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-teal-400 hover:underline"
                      >
                        {local.website}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'company' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Company Details</h3>
              <div className="bg-[#0a1628] rounded-xl p-4 grid grid-cols-2 gap-4 border border-[#1a2b4a]">
                {[
                  { label: 'Company Name', value: local.company_name },
                  { label: 'Industry', value: local.industry },
                  { label: 'Company Type', value: local.company_type },
                  { label: 'Company Size', value: local.company_size },
                ].map((row) => (
                  <div key={row.label}>
                    <p className="text-xs text-slate-500 mb-0.5">{row.label}</p>
                    <p className="text-sm font-medium text-white">{row.value || 'Not provided'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Account Activity</h3>
              <div className="bg-[#0a1628] rounded-xl p-4 grid grid-cols-2 gap-4 border border-[#1a2b4a]">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Member Since</p>
                  <p className="text-sm font-medium text-white">
                    {local.created_at
                      ? new Date(local.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Last Login</p>
                  <p className="text-sm font-medium text-white">
                    {local.last_login
                      ? new Date(local.last_login).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'Never recorded'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Account ID</p>
                  <p className="text-sm font-mono text-slate-300">{local.id.slice(0, 12)}...</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Profile Status</p>
                  <p className="text-sm font-medium text-white">
                    {local.profile_completed ? 'Complete' : 'Incomplete'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Admin Notes</h3>
                {!editingNotes && (
                  <button
                    onClick={() => setEditingNotes(true)}
                    className="text-xs text-teal-400 hover:bg-teal-500/10 px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <i className="ri-edit-line"></i>
                    {local.notes ? 'Edit' : 'Add Note'}
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="bg-[#0a1628] border border-[#1a2b4a] rounded-xl p-4">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={500}
                    placeholder="Add internal notes about this client..."
                    className="w-full h-28 px-3 py-2 text-sm border border-[#1a2b4a] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none bg-[#0B1933] text-white placeholder:text-slate-500"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-500">{notes.length}/500</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setNotes(local.notes || ''); setEditingNotes(false); }}
                        className="px-3 py-1.5 text-sm text-slate-400 hover:bg-[#1a2b4a] rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveNotes}
                        disabled={loading === 'notes'}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-50 flex items-center gap-1"
                      >
                        {loading === 'notes' ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#0a1628] border border-[#1a2b4a] rounded-xl p-4 min-h-[80px]">
                  {local.notes ? (
                    <p className="text-sm text-slate-300">{local.notes}</p>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No notes yet. Click &quot;Add Note&quot; to add one.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-[#1a2b4a] px-6 py-4 bg-[#0a1628] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirm('verify')}
              disabled={loading !== null}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap disabled:opacity-50 transition-colors ${
                local.verified
                  ? 'bg-[#1a2b4a] text-slate-300 hover:bg-[#223555]'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              {loading === 'verify' ? (
                <i className="ri-loader-4-line animate-spin"></i>
              ) : (
                <i className={local.verified ? 'ri-close-circle-line' : 'ri-checkbox-circle-line'}></i>
              )}
              {local.verified ? 'Remove Verification' : 'Verify Client'}
            </button>
            <button
              onClick={() => setConfirm('suspend')}
              disabled={loading !== null}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap disabled:opacity-50 transition-colors ${
                local.is_suspended
                  ? 'bg-sky-600 text-white hover:bg-sky-500'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {loading === 'suspend' ? (
                <i className="ri-loader-4-line animate-spin"></i>
              ) : (
                <i className={local.is_suspended ? 'ri-user-follow-line' : 'ri-forbid-line'}></i>
              )}
              {local.is_suspended ? 'Reactivate' : 'Suspend'}
            </button>
            <a
              href={`mailto:${local.email}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500/10 text-sky-400 rounded-lg hover:bg-sky-500/20 text-sm font-medium cursor-pointer whitespace-nowrap transition-colors"
            >
              <i className="ri-mail-send-line"></i>
              Email Client
            </a>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:bg-[#1a2b4a] rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}