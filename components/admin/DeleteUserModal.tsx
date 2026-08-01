'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface DeleteSummary {
  tables: { name: string; rowCount: number }[];
  storageFiles: string[];
  financialRowsAnonymised: { table: string; rowCount: number }[];
  totalRows: number;
  totalFiles: number;
}

interface DeleteUserModalProps {
  userId: string;
  userName: string;
  userEmail: string;
  userType: 'guard' | 'client';
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteUserModal({ userId, userName, userEmail, userType, onClose, onDeleted }: DeleteUserModalProps) {
  const [step, setStep] = useState<'reason' | 'dryrun' | 'confirm' | 'deleting' | 'done' | 'error'>('reason');
  const [reason, setReason] = useState('');
  const [summary, setSummary] = useState<DeleteSummary | null>(null);
  const [confirmationText, setConfirmationText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const requiredPhrase = userType === 'guard' ? 'DELETE GUARD' : 'DELETE CLIENT';

  const handleDryRun = async () => {
    if (!reason.trim()) return;
    setError(null);
    setStep('dryrun');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        setStep('error');
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            user_id: userId,
            user_type: userType,
            reason: reason.trim(),
            dry_run: true,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Dry run failed');
        setStep('error');
        return;
      }

      setSummary(data.summary);
      setStep('confirm');
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
      setStep('error');
    }
  };

  const handleDelete = async () => {
    if (confirmationText !== requiredPhrase) return;
    setError(null);
    setStep('deleting');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        setStep('error');
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            user_id: userId,
            user_type: userType,
            reason: reason.trim(),
            dry_run: false,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Deletion failed');
        setStep('error');
        return;
      }

      setResult(data);
      setStep('done');
      setTimeout(() => {
        onDeleted();
      }, 2000);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
      setStep('error');
    }
  };

  const tableLabel = (name: string): string => {
    const labels: Record<string, string> = {
      guards: 'Guard Profile',
      clients: 'Client Profile',
      users: 'User Account',
      guard_bank_details: 'Bank Details',
      guard_payouts: 'Payout Records',
      job_applications: 'Job Applications',
      job_assignments: 'Job Assignments',
      job_matches: 'Job Matches',
      job_invites: 'Job Invites',
      saved_jobs: 'Saved Jobs',
      job_completion_requests: 'Completion Requests',
      job_completion_tasks: 'Completion Tasks',
      jobs: 'Posted Jobs',
      reviews: 'Reviews',
      client_reviews: 'Client Reviews',
      messages: 'Messages',
      notifications: 'Notifications',
      notification_preferences: 'Notification Settings',
      push_subscriptions: 'Push Subscriptions',
      support_tickets: 'Support Tickets',
      sia_verifications: 'SIA Verifications',
      announcement_reads: 'Announcement Reads',
      consent_records: 'Consent Records',
      tax_disclaimers_accepted: 'Tax Disclaimers',
      user_entitlements: 'User Entitlements',
      client_activity_log: 'Activity Logs',
      client_contacts: 'Contacts',
      client_documents: 'Documents',
      client_favorites: 'Favorites',
      client_responses: 'Responses',
    };
    return labels[name] || name;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[#0a1628] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl border border-red-500/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-500 px-6 py-6 text-white relative">
          <button
            onClick={onClose}
            disabled={step === 'deleting'}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition-colors cursor-pointer disabled:opacity-50"
          >
            <div className="w-5 h-5 flex items-center justify-center"><i className="ri-close-line text-xl"></i></div>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center bg-white/15 rounded-full ring-1 ring-white/20">
              <i className="ri-alert-line text-2xl"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold">Delete {userType === 'guard' ? 'Guard' : 'Client'} Permanently</h2>
              <p className="text-white/70 text-sm mt-0.5">{userName} — {userEmail}</p>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Step: Reason */}
          {step === 'reason' && (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-error-warning-line text-red-400 text-xl"></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-300 mb-1">This action is permanent</p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      It will remove the user account, profile, documents, images, applications, assignments, notifications, and related records. Financial records will be retained and anonymised. This cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Reason for deletion</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this user is being deleted..."
                  className="w-full h-24 px-4 py-3 text-sm border border-[#1a2b4a] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-transparent resize-none bg-[#111d35] text-slate-200 placeholder:text-slate-500"
                  maxLength={500}
                />
                <p className="text-xs text-slate-500 mt-1 text-right">{reason.length}/500</p>
              </div>
            </div>
          )}

          {/* Step: Dry Run Summary */}
          {step === 'confirm' && summary && (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <p className="text-sm font-medium text-emerald-300 mb-2">Impact Summary</p>
                <p className="text-xs text-slate-400">The following will be permanently deleted:</p>
              </div>

              <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl divide-y divide-[#1a2b4a] max-h-[260px] overflow-y-auto">
                {summary.tables.map((t) => (
                  <div key={t.name} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 flex items-center justify-center"><i className="ri-delete-bin-line text-red-400 text-sm"></i></div>
                      <span className="text-sm text-slate-300">{tableLabel(t.name)}</span>
                    </div>
                    <span className="text-xs font-medium text-slate-400 bg-[#0a1628] px-2 py-0.5 rounded-full">{t.rowCount} record{t.rowCount !== 1 ? 's' : ''}</span>
                  </div>
                ))}
                {summary.financialRowsAnonymised.length > 0 && (
                  <div className="px-4 py-3 bg-amber-500/5">
                    <p className="text-xs font-medium text-amber-400 mb-2">Financial records will be retained &amp; anonymised:</p>
                    {summary.financialRowsAnonymised.map((f) => (
                      <div key={f.table} className="flex items-center justify-between px-1 py-1">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 flex items-center justify-center"><i className="ri-shield-check-line text-amber-400 text-xs"></i></div>
                          <span className="text-xs text-slate-400">{tableLabel(f.table)}</span>
                        </div>
                        <span className="text-xs text-slate-500">{f.rowCount} row{f.rowCount !== 1 ? 's' : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {summary.totalFiles > 0 && (
                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 flex items-center justify-center"><i className="ri-folder-close-line text-red-400 text-sm"></i></div>
                    <span className="text-sm text-slate-300">{summary.totalFiles} storage file{summary.totalFiles !== 1 ? 's' : ''} will be deleted</span>
                  </div>
                </div>
              )}

              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-300 mb-2">
                  Type <span className="font-mono bg-red-500/20 px-2 py-0.5 rounded">{requiredPhrase}</span> to confirm
                </p>
                <input
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder={requiredPhrase}
                  className="w-full px-4 py-2.5 text-sm border border-red-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-transparent bg-[#0a1628] text-white placeholder:text-slate-500 font-mono"
                />
              </div>
            </div>
          )}

          {/* Step: Deleting */}
          {step === 'deleting' && (
            <div className="flex flex-col items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-red-500 border-t-transparent mb-4"></div>
              <p className="text-sm font-medium text-slate-300">Deleting {userType} account...</p>
              <p className="text-xs text-slate-500 mt-1">This may take a moment</p>
            </div>
          )}

          {/* Step: Error */}
          {step === 'error' && (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-close-circle-line text-red-400 text-xl"></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-300 mb-1">Deletion Failed</p>
                    <p className="text-xs text-slate-400">{error}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setStep('reason'); setError(null); }}
                className="w-full px-4 py-2.5 border border-[#1a2b4a] text-slate-300 rounded-xl hover:bg-[#1a2b4a] transition-colors cursor-pointer text-sm font-medium whitespace-nowrap"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <div className="flex flex-col items-center py-8">
              <div className="w-16 h-16 flex items-center justify-center bg-emerald-500/10 rounded-full mb-4 ring-1 ring-emerald-500/20">
                <i className="ri-checkbox-circle-fill text-emerald-400 text-3xl"></i>
              </div>
              <p className="text-lg font-semibold text-white mb-1">{userType === 'guard' ? 'Guard' : 'Client'} Deleted</p>
              <p className="text-sm text-slate-400">The account has been permanently removed.</p>
              {result?.failed_items && result.failed_items.length > 0 && (
                <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 w-full">
                  <p className="text-xs font-medium text-amber-400 mb-1">Some items could not be deleted:</p>
                  <ul className="text-xs text-slate-400 space-y-0.5">
                    {result.failed_items.map((f: string, i: number) => (
                      <li key={i} className="truncate">{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Step: Dry Run Loading */}
          {step === 'dryrun' && (
            <div className="flex flex-col items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-teal-500 border-t-transparent mb-4"></div>
              <p className="text-sm font-medium text-slate-300">Analysing impact...</p>
              <p className="text-xs text-slate-500 mt-1">Checking all related records</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'deleting' && step !== 'done' && step !== 'dryrun' && (
          <div className="border-t border-[#1a2b4a] px-6 py-4 bg-[#0a1628]/80 flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-[#1a2b4a] text-slate-300 rounded-xl hover:bg-[#1a2b4a] transition-colors cursor-pointer text-sm font-medium whitespace-nowrap"
            >
              Cancel
            </button>
            {step === 'reason' && (
              <button
                onClick={handleDryRun}
                disabled={!reason.trim()}
                className="px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors cursor-pointer text-sm font-medium whitespace-nowrap disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-search-eye-line"></i></div>
                  Check Impact
                </div>
              </button>
            )}
            {step === 'confirm' && (
              <button
                onClick={handleDelete}
                disabled={confirmationText !== requiredPhrase}
                className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors cursor-pointer text-sm font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-delete-bin-line"></i></div>
                  Permanently Delete
                </div>
              </button>
            )}
            {step === 'error' && (
              <button
                onClick={onClose}
                className="px-4 py-2 border border-[#1a2b4a] text-slate-300 rounded-xl hover:bg-[#1a2b4a] transition-colors cursor-pointer text-sm font-medium whitespace-nowrap"
              >
                Close
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}