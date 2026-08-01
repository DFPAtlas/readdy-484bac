'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Submission {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  category: string | null;
  status: string;
  source: string | null;
  created_at: string;
  user_id?: string | null;
}

interface Props {
  submission: Submission;
  onClose: () => void;
  onUpdated: (updated: Submission) => void;
}

const STATUS_OPTIONS = ['new', 'in progress', 'resolved', 'archived'];

function getStatusStyle(opt: string) {
  if (opt === 'new') return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
  if (opt === 'in progress') return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
  if (opt === 'resolved') return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
  return 'bg-slate-500/10 border-slate-500/30 text-slate-400';
}

export default function SubmissionDetailModal({ submission, onClose, onUpdated }: Props) {
  const [status, setStatus] = useState(submission.status);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === status) return;
    const previousStatus = status;
    setSavingStatus(newStatus);
    setErrorMsg(null);

    try {
      const { error } = await supabase
        .from('contact_submissions')
        .update({ status: newStatus })
        .eq('id', submission.id);

      if (error) throw new Error(error.message);

      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('admin_activity_log').insert({
        admin_user_id: user?.id ?? null,
        admin_username: user?.email ?? 'unknown',
        admin_name: user?.user_metadata?.full_name ?? null,
        action: 'status_change',
        action_type: 'status_change',
        action_description: `Changed contact submission status from "${previousStatus}" to "${newStatus}"`,
        entity_type: 'contact_submission',
        entity_id: submission.id,
        target_type: 'contact_submission',
        target_name: submission.name,
        changes: { status: { from: previousStatus, to: newStatus } },
        created_at: new Date().toISOString(),
      });

      setStatus(newStatus);
      setSavingStatus(null);
      onUpdated({ ...submission, status: newStatus });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      setErrorMsg(msg);
      setSavingStatus(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#111d35] rounded-2xl shadow-2xl border border-[#1a2b4a] w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-[#1a2b4a] flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Contact Submission</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] transition text-slate-400 hover:text-white cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Name</p>
              <p className="text-sm font-semibold text-white">{submission.name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Email</p>
              <p className="text-sm text-slate-300">{submission.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Phone</p>
              <p className="text-sm text-slate-300">{submission.phone ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Category</p>
              <p className="text-sm text-slate-300">{submission.category ?? '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Source</p>
              <p className="text-sm text-slate-300">{submission.source ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Submitted</p>
              <p className="text-sm text-slate-300">
                {new Date(submission.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Subject</p>
            <p className="text-sm text-white font-medium">{submission.subject ?? 'No subject'}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Message</p>
            <p className="text-sm text-slate-300 bg-[#0a1628] rounded-xl p-4 border border-[#1a2b4a] leading-relaxed whitespace-pre-wrap">{submission.message}</p>
          </div>

          <div className="pt-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Status</p>
            {errorMsg && (
              <div className="mb-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-center gap-2">
                <i className="ri-error-warning-line"></i>
                {errorMsg}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(opt => {
                const isActive = status === opt;
                const isSaving = savingStatus === opt;
                return (
                  <button
                    key={opt}
                    disabled={savingStatus !== null}
                    onClick={() => handleStatusChange(opt)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? getStatusStyle(opt)
                        : 'bg-[#0a1628] border-[#1a2b4a] text-slate-500 hover:border-[#2a3d5c] hover:text-slate-400'
                    } ${savingStatus !== null && !isSaving ? 'opacity-40' : ''}`}
                  >
                    {isSaving ? (
                      <span className="flex items-center gap-1.5">
                        <i className="ri-loader-4-line animate-spin text-xs"></i>
                        Saving...
                      </span>
                    ) : (
                      opt.charAt(0).toUpperCase() + opt.slice(1)
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#1a2b4a] bg-[#0a1628] rounded-b-2xl flex justify-between items-center">
          <span className="text-xs text-slate-500">ID: {submission.id.slice(0, 8)}...</span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-400 bg-[#111d35] border border-[#1a2b4a] rounded-xl hover:bg-[#1a2b4a] hover:text-white transition cursor-pointer whitespace-nowrap"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}