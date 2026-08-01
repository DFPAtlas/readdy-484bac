'use client';

import ChecklistProgress from '../guard-verifications/ChecklistProgress';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { logAdminAction } from '@/lib/admin-logger';
import DeleteUserModal from '@/components/admin/DeleteUserModal';

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

interface ClientDetailModalProps {
  client: Client;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function ClientDetailModal({ client, onClose, onUpdate }: ClientDetailModalProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [localClient, setLocalClient] = useState(client);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(client.notes || '');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const displayName = localClient.first_name && localClient.last_name
    ? `${localClient.first_name} ${localClient.last_name}`
    : localClient.contact_name;
  const initials = displayName
    ? displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleVerifyClient = async () => {
    setIsLoading('verify');
    setShowConfirm(null);
    try {
      const newVerified = !localClient.verified;
      const { error } = await supabase
        .from('clients')
        .update({ verified: newVerified })
        .eq('id', localClient.id);

      if (error) throw error;

      setLocalClient(prev => ({ ...prev, verified: newVerified }));
      await logAdminAction({
        actionType: 'user_status_changed',
        actionDescription: `Client ${newVerified ? 'verified' : 'unverified'}: ${displayName} (${localClient.email})`,
        targetType: 'client',
        targetName: displayName,
        metadata: { clientId: localClient.id, action: newVerified ? 'verify' : 'unverify' },
      });
      showToast(newVerified ? 'Client verified successfully' : 'Client verification removed', 'success');
      onUpdate?.();
    } catch (err) {
      console.error('Error verifying client:', err);
      showToast('Failed to update client verification', 'error');
    } finally {
      setIsLoading(null);
    }
  };

  const handleSuspendClient = async () => {
    setIsLoading('suspend');
    setShowConfirm(null);
    try {
      const newSuspended = !localClient.is_suspended;
      const { error } = await supabase
        .from('clients')
        .update({ is_suspended: newSuspended })
        .eq('id', localClient.id);

      if (error) throw error;

      setLocalClient(prev => ({ ...prev, is_suspended: newSuspended }));
      await logAdminAction({
        actionType: 'user_status_changed',
        actionDescription: `Client ${newSuspended ? 'suspended' : 'reactivated'}: ${displayName} (${localClient.email})`,
        targetType: 'client',
        targetName: displayName,
        metadata: { clientId: localClient.id, action: newSuspended ? 'suspend' : 'reactivate' },
      });
      showToast(newSuspended ? 'Client account suspended' : 'Client account reactivated', 'success');
      onUpdate?.();
    } catch (err) {
      console.error('Error suspending/reactivating client:', err);
      showToast('Failed to update client status', 'error');
    } finally {
      setIsLoading(null);
    }
  };

  const handleSendEmail = () => {
    window.location.href = `mailto:${localClient.email}`;
  };

  const handleSaveNotes = async () => {
    setIsLoading('notes');
    try {
      const { error } = await supabase
        .from('clients')
        .update({ notes: notesValue.trim() || null })
        .eq('id', localClient.id);

      if (error) throw error;

      setLocalClient(prev => ({ ...prev, notes: notesValue.trim() || null }));
      setIsEditingNotes(false);
      await logAdminAction({
        actionType: 'admin_note_added',
        actionDescription: `Note updated for client: ${displayName} (${localClient.email})`,
        targetType: 'client',
        targetName: displayName,
        metadata: { clientId: localClient.id },
      });
      showToast('Admin notes saved', 'success');
      onUpdate?.();
    } catch (err) {
      console.error('Error saving notes:', err);
      showToast('Failed to save notes', 'error');
    } finally {
      setIsLoading(null);
    }
  };

  const handleCancelNotes = () => {
    setNotesValue(localClient.notes || '');
    setIsEditingNotes(false);
  };

  useEffect(() => {
    async function checkSuperAdmin() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from('admin_users').select('role').eq('user_id', session.user.id).maybeSingle();
      if (data && data.role === 'super_admin') setIsSuperAdmin(true);
    }
    checkSuperAdmin();
  }, []);

  const profileItems = [
    { label: 'First name', checked: !!localClient.first_name?.trim() },
    { label: 'Last name', checked: !!localClient.last_name?.trim() },
    { label: 'Company name', checked: !!localClient.company_name?.trim() },
    { label: 'Phone', checked: !!localClient.phone?.trim() },
    { label: 'Email', checked: !!localClient.email?.trim() },
    { label: 'City', checked: !!localClient.city?.trim() },
    { label: 'Postcode', checked: !!localClient.postcode?.trim() },
    { label: 'Address', checked: !!localClient.address?.trim() },
    { label: 'Company type', checked: !!localClient.company_type?.trim() },
    { label: 'Industry', checked: !!localClient.industry?.trim() },
    { label: 'Company size', checked: !!localClient.company_size?.trim() },
    { label: 'Website', checked: !!localClient.website?.trim() },
  ];

  const profilePercent = Math.round((profileItems.filter(i => i.checked).length / profileItems.length) * 100);
  const incompleteFields = profileItems.filter(i => !i.checked).map(i => i.label);
  const isProfileIncomplete = profilePercent < 100;

  const handleNudgeProfile = async () => {
    setIsLoading('nudge');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        'https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/send-profile-nudge',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            client_email: localClient.email,
            client_name: displayName,
            incomplete_fields: incompleteFields,
            profile_percent: profilePercent,
            user_type: 'client',
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }
      showToast('Profile nudge email sent successfully', 'success');
    } catch (err) {
      console.error('Error sending nudge:', err);
      showToast('Failed to send nudge email', 'error');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-[#0a1628] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-[#1a2b4a] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {toast && (
          <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
            <div className="w-5 h-5 flex items-center justify-center"><i className={toast.type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'}></i></div>
            {toast.message}
          </div>
        )}

        {showConfirm && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 rounded-2xl">
            <div className="bg-[#0a1628] rounded-2xl p-6 m-4 max-w-sm shadow-xl border border-[#1a2b4a]">
              <div className="w-12 h-12 flex items-center justify-center bg-amber-500/10 rounded-full mx-auto mb-4 ring-1 ring-amber-500/20">
                <div className="w-6 h-6 flex items-center justify-center">
                  <i className={`text-2xl text-amber-400 ${showConfirm === 'suspend' ? 'ri-error-warning-line' : 'ri-question-line'}`}></i>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-center mb-2 text-white">
                {showConfirm === 'verify' && (localClient.verified ? 'Remove Verification?' : 'Verify Client?')}
                {showConfirm === 'suspend' && (localClient.is_suspended ? 'Reactivate Account?' : 'Suspend Account?')}
              </h3>
              <p className="text-sm text-slate-400 text-center mb-6">
                {showConfirm === 'verify' && (localClient.verified 
                  ? 'This will remove the verified badge from this client.'
                  : 'This will mark the client as verified and display a badge on their profile.')}
                {showConfirm === 'suspend' && (localClient.is_suspended
                  ? 'This will reactivate the client account and restore access.'
                  : 'This will suspend the client account and prevent them from posting jobs.')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(null)}
                  className="flex-1 px-4 py-2 border border-[#1a2b4a] text-slate-300 rounded-xl hover:bg-[#1a2b4a] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  onClick={showConfirm === 'verify' ? handleVerifyClient : handleSuspendClient}
                  disabled={isLoading !== null}
                  className={`flex-1 px-4 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap text-white disabled:opacity-50 ${
                    showConfirm === 'suspend' && !localClient.is_suspended
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-teal-600 hover:bg-teal-700'
                  }`}
                >
                  {isLoading === showConfirm ? 'Working...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-teal-600 to-sky-500 px-6 py-8 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition-colors cursor-pointer"
          >
            <div className="w-5 h-5 flex items-center justify-center"><i className="ri-close-line text-xl"></i></div>
          </button>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 flex items-center justify-center bg-white/15 rounded-full text-3xl font-bold ring-1 ring-white/20">
              {initials}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{displayName}</h2>
              <p className="text-white/80">{localClient.company_name || 'No company'}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {localClient.verified ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-400/30">
                    <div className="w-3 h-3 flex items-center justify-center"><i className="ri-checkbox-circle-fill text-xs"></i></div>
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/20 text-white/80 ring-1 ring-white/20">
                    Unverified
                  </span>
                )}
                {localClient.profile_completed ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-400/20 text-sky-200 ring-1 ring-sky-400/30">
                    Profile Complete
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/30">
                    Profile Incomplete
                  </span>
                )}
                {localClient.is_suspended && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-400/20 text-red-100 ring-1 ring-red-400/30">
                    <div className="w-3 h-3 flex items-center justify-center"><i className="ri-forbid-line text-xs"></i></div>
                    Suspended
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-280px)]">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-teal-500/10 rounded-2xl p-4 text-center ring-1 ring-teal-500/20">
              <p className="text-3xl font-bold text-teal-400">{localClient.total_jobs_posted || 0}</p>
              <p className="text-sm text-slate-400">Jobs Posted</p>
            </div>
            <div className="bg-emerald-500/10 rounded-2xl p-4 text-center ring-1 ring-emerald-500/20">
              <p className="text-3xl font-bold text-emerald-400">{localClient.active_jobs || 0}</p>
              <p className="text-sm text-slate-400">Active Jobs</p>
            </div>
            <div className="bg-sky-500/10 rounded-2xl p-4 text-center ring-1 ring-sky-500/20">
              <p className="text-3xl font-bold text-sky-400">
                &pound;{(localClient.total_spent || 0).toLocaleString()}
              </p>
              <p className="text-sm text-slate-400">Total Spent</p>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a2b4a] ring-1 ring-[#1a2b4a]">
                  <i className="ri-checkbox-circle-line text-sm text-slate-400"></i>
                </div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Profile Completeness</h3>
              </div>
              {isProfileIncomplete && (
                <button
                  onClick={handleNudgeProfile}
                  disabled={isLoading === 'nudge'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl transition-colors cursor-pointer ring-1 ring-amber-500/20 disabled:opacity-50"
                >
                  {isLoading === 'nudge' ? (
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-loader-4-line animate-spin"></i></div>
                  ) : (
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-mail-send-line"></i></div>
                  )}
                  Nudge: Complete Profile
                </button>
              )}
            </div>
            <ChecklistProgress
              title="Profile Fields"
              items={profileItems}
              color="teal"
              showList={true}
            />
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a2b4a] ring-1 ring-[#1a2b4a]">
                  <i className="ri-user-line text-sm text-slate-400"></i>
                </div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Contact Information</h3>
              </div>
              <div className="bg-[#111d35] rounded-2xl p-4 space-y-3 ring-1 ring-[#1a2b4a]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-[#0a1628] rounded-lg shadow-sm ring-1 ring-[#1a2b4a]">
                    <i className="ri-mail-line text-slate-400"></i>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="text-sm font-medium text-slate-200">{localClient.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-[#0a1628] rounded-lg shadow-sm ring-1 ring-[#1a2b4a]">
                    <i className="ri-phone-line text-slate-400"></i>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="text-sm font-medium text-slate-200">{localClient.phone || 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-[#0a1628] rounded-lg shadow-sm ring-1 ring-[#1a2b4a]">
                    <i className="ri-map-pin-line text-slate-400"></i>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Location</p>
                    <p className="text-sm font-medium text-slate-200">
                      {[localClient.address, localClient.city, localClient.postcode].filter(Boolean).join(', ') || 'Not provided'}
                    </p>
                  </div>
                </div>
                {localClient.website && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-[#0a1628] rounded-lg shadow-sm ring-1 ring-[#1a2b4a]">
                      <i className="ri-global-line text-slate-400"></i>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Website</p>
                      <a href={localClient.website} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-teal-600 hover:underline">
                        {localClient.website}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a2b4a] ring-1 ring-[#1a2b4a]">
                  <i className="ri-building-line text-sm text-slate-400"></i>
                </div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Company Details</h3>
              </div>
              <div className="bg-[#111d35] rounded-2xl p-4 grid grid-cols-2 gap-4 ring-1 ring-[#1a2b4a]">
                <div>
                  <p className="text-xs text-slate-500">Company Name</p>
                  <p className="text-sm font-medium text-slate-200">{localClient.company_name || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Industry</p>
                  <p className="text-sm font-medium text-slate-200">{localClient.industry || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Company Type</p>
                  <p className="text-sm font-medium text-slate-200">{localClient.company_type || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Company Size</p>
                  <p className="text-sm font-medium text-slate-200">{localClient.company_size || 'Not provided'}</p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a2b4a] ring-1 ring-[#1a2b4a]">
                  <i className="ri-time-line text-sm text-slate-400"></i>
                </div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Account Activity</h3>
              </div>
              <div className="bg-[#111d35] rounded-2xl p-4 grid grid-cols-2 gap-4 ring-1 ring-[#1a2b4a]">
                <div>
                  <p className="text-xs text-slate-500">Member Since</p>
                  <p className="text-sm font-medium text-slate-200">
                    {localClient.created_at
                      ? new Date(localClient.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Last Login</p>
                  <p className="text-sm font-medium text-slate-200">
                    {localClient.last_login
                      ? new Date(localClient.last_login).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'Never'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Account ID</p>
                  <p className="text-sm font-medium text-slate-200 font-mono">{localClient.id.slice(0, 8)}...</p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a2b4a] ring-1 ring-[#1a2b4a]">
                    <i className="ri-sticky-note-line text-sm text-slate-400"></i>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Admin Notes</h3>
                </div>
                {!isEditingNotes && (
                  <button
                    onClick={() => setIsEditingNotes(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-teal-400 hover:bg-teal-500/10 rounded-xl transition-colors cursor-pointer ring-1 ring-teal-500/20"
                  >
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-edit-line"></i></div>
                    {localClient.notes ? 'Edit' : 'Add Note'}
                  </button>
                )}
              </div>
              {isEditingNotes ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 ring-1 ring-amber-500/20">
                  <textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    placeholder="Add internal notes about this client..."
                    className="w-full h-24 px-3 py-2 text-sm border border-amber-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent resize-none bg-[#0a1628] text-slate-200 placeholder:text-slate-500"
                    maxLength={500}
                  />
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-slate-400">{notesValue.length}/500 characters</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCancelNotes}
                        disabled={isLoading === 'notes'}
                        className="px-3 py-1.5 text-sm text-slate-400 hover:bg-[#1a2b4a] rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveNotes}
                        disabled={isLoading === 'notes'}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                      >
                        {isLoading === 'notes' ? (
                          <div className="w-4 h-4 flex items-center justify-center"><i className="ri-loader-4-line animate-spin"></i></div>
                        ) : (
                          <div className="w-4 h-4 flex items-center justify-center"><i className="ri-save-line"></i></div>
                        )}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 min-h-[60px] ring-1 ring-amber-500/20">
                  {localClient.notes ? (
                    <p className="text-sm text-slate-200">{localClient.notes}</p>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No admin notes yet. Click &quot;Add Note&quot; to add one.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="border-t border-[#1a2b4a]">
            <div className="px-6 py-4 bg-red-500/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-400">Danger Zone</p>
                  <p className="text-xs text-slate-500 mt-0.5">Permanently delete this client and all associated data</p>
                </div>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors cursor-pointer whitespace-nowrap text-sm font-medium ring-1 ring-red-500/20"
                >
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-delete-bin-line"></i></div>
                  Delete Client Permanently
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-[#1a2b4a] px-6 py-4 bg-[#0a1628]/80">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowConfirm('verify')}
                disabled={isLoading !== null}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap text-sm font-medium ${
                  localClient.verified
                    ? 'bg-[#1a2b4a] text-slate-300 hover:bg-[#243553]'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                } disabled:opacity-50`}
              >
                {isLoading === 'verify' ? (
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-loader-4-line animate-spin"></i></div>
                ) : (
                  <div className="w-4 h-4 flex items-center justify-center"><i className={localClient.verified ? 'ri-close-circle-line' : 'ri-checkbox-circle-line'}></i></div>
                )}
                {localClient.verified ? 'Remove Verification' : 'Verify Client'}
              </button>
              <button
                onClick={() => setShowConfirm('suspend')}
                disabled={isLoading !== null}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap text-sm font-medium ${
                  localClient.is_suspended
                    ? 'bg-teal-600 text-white hover:bg-teal-700'
                    : 'bg-red-500 text-white hover:bg-red-600'
                } disabled:opacity-50`}
              >
                {isLoading === 'suspend' ? (
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-loader-4-line animate-spin"></i></div>
                ) : (
                  <div className="w-4 h-4 flex items-center justify-center"><i className={localClient.is_suspended ? 'ri-user-follow-line' : 'ri-forbid-line'}></i></div>
                )}
                {localClient.is_suspended ? 'Reactivate' : 'Suspend'}
              </button>
              <button
                onClick={handleSendEmail}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500/10 text-teal-400 rounded-xl hover:bg-teal-500/20 transition-colors cursor-pointer whitespace-nowrap text-sm font-medium ring-1 ring-teal-500/20"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-mail-send-line"></i></div>
                Send Email
              </button>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:bg-[#1a2b4a] hover:text-white rounded-xl transition-colors font-medium cursor-pointer whitespace-nowrap"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteUserModal
          userId={localClient.id}
          userName={localClient.first_name && localClient.last_name ? `${localClient.first_name} ${localClient.last_name}` : localClient.contact_name}
          userEmail={localClient.email}
          userType="client"
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => {
            setShowDeleteModal(false);
            onClose();
            onUpdate?.();
          }}
        />
      )}
    </div>
  );
}