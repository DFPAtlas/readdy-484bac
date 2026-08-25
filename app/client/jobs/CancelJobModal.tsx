'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ClientJob } from '@/lib/client-types';
import CancellationStatusBadge from './CancellationStatusBadge';
import { useRouter } from 'next/navigation';

interface CancelJobModalProps {
  job: ClientJob;
  clientId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CANCEL_REASONS = [
  'No longer need cover',
  'Wrong job details',
  'Duplicate booking',
  'Guard issue',
  'Payment issue',
  'Site closed',
  'Emergency',
  'Other',
];

const RESOLUTIONS = [
  { value: 'full_refund', label: 'Full Refund', icon: 'ri-money-pound-circle-line' },
  { value: 'partial_refund', label: 'Partial Refund', icon: 'ri-percent-line' },
  { value: 'credit', label: 'Credit for Future Booking', icon: 'ri-coupon-line' },
  { value: 'admin_review', label: 'Request Admin Review', icon: 'ri-shield-user-line' },
];

const CONTACT_PREFS = [
  { value: 'email', label: 'Email', icon: 'ri-mail-line' },
  { value: 'phone', label: 'Phone', icon: 'ri-phone-line' },
];

const ALLOWED_CANCEL_STATUSES = ['draft', 'open', 'pending', 'awaiting_guard_selection', 'awaiting_payment', 'in_progress'];

export default function CancelJobModal({ job, clientId, onClose, onSuccess }: CancelJobModalProps) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [preferredResolution, setPreferredResolution] = useState('full_refund');
  const [contactPreference, setContactPreference] = useState('email');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [showRefundModal, setShowRefundModal] = useState(false);

  const canCancel = ALLOWED_CANCEL_STATUSES.includes(job.status);
  const isCompleted = job.status === 'completed';
  const isDisputed = job.status === 'disputed';
  const isAdminLocked = false; // TODO: Add admin lock field when backend supports it

  const handleCancel = async () => {
    setError('');
    if (!reason) { setError('Please select a cancellation reason.'); return; }

    setConfirming(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const cid = clientId;
      if (!cid) throw new Error('Client not found');

      // Insert cancellation record
      const { data: cancellationData, error: cancelError } = await supabase
        .schema('app')
        .from('job_cancellations')
        .insert({
          job_id: job.id,
          client_id: cid,
          reason: reason,
          notes: notes.trim() || null,
          preferred_resolution: preferredResolution,
          contact_preference: contactPreference,
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: 'client',
        })
        .select('id')
        .single();

      if (cancelError) throw cancelError;

      // Update job status
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', job.id);

      if (updateError) throw updateError;

      // Create support ticket for certain resolutions
      if (preferredResolution === 'admin_review' || preferredResolution === 'partial_refund') {
        await supabase.from('support_tickets').insert({
          client_id: cid,
          related_job_id: job.id,
          category: 'job_cancellation',
          subject: `Job Cancellation: ${job.job_title}`,
          description: `Client cancelled job "${job.job_title}".\nReason: ${reason}\nPreferred resolution: ${preferredResolution}\nNotes: ${notes || 'N/A'}`,
          priority: preferredResolution === 'admin_review' ? 'high' : 'normal',
          status: 'open',
        });
      }

      // Notify client
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          user_type: 'client',
          type: 'job_cancelled',
          title: 'Job Cancelled',
          message: `"${job.job_title}" has been cancelled.`,
          link: `/client/jobs/${job.id}`,
          is_read: false,
        });
      }

      // Call edge function with session token
      if (accessToken) {
        try {
          const efResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cancel-job`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              jobId: job.id,
              cancelledBy: 'client',
            }),
          });
          if (!efResponse.ok) {
            console.warn('Edge function cancel-job returned:', efResponse.status);
          }
        } catch {
          console.warn('Edge function cancel-job unreachable');
        }
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel job. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  if (isCompleted || isDisputed || isAdminLocked) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-[#111d35] rounded-2xl shadow-2xl w-full max-w-md border border-[#1e2d4d] p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 flex items-center justify-center bg-red-500/10 rounded-xl">
              <i className="ri-close-circle-line text-red-400 text-xl"></i>
            </div>
            <h2 className="text-lg font-bold text-white">Cannot Cancel Job</h2>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            {isCompleted
              ? 'This job is already completed and cannot be cancelled.'
              : isDisputed
              ? 'This job is under dispute and cannot be cancelled directly. Please contact support.'
              : 'This job is locked by admin review and cannot be cancelled.'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/client/support')}
              className="flex-1 bg-teal-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              Contact Support
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111d35] rounded-2xl shadow-2xl w-full max-w-lg border border-[#1e2d4d] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-[#1e2d4d]">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 flex items-center justify-center bg-red-500/10 rounded-xl">
              <i className="ri-close-circle-line text-red-400 text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Cancel Job</h2>
              <p className="text-sm text-slate-500">{job.job_title}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 flex items-center gap-2">
              <i className="ri-error-warning-line text-red-400"></i>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-teal-500' : 'bg-[#1e2d4d]'}`}></div>
            <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-teal-500' : 'bg-[#1e2d4d]'}`}></div>
          </div>

          {!canCancel && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4">
              <p className="text-sm text-amber-400 font-semibold mb-1">Warning</p>
              <p className="text-sm text-slate-400">
                This job is currently active. Cancellation may require admin review and may incur fees.
              </p>
            </div>
          )}

          {step === 1 && (
            <>
              {/* Reason */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Cancellation Reason <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {CANCEL_REASONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setReason(r)}
                      className={`px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                        reason === r
                          ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                          : 'border-[#1e2d4d] text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Additional Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none bg-[#162036] text-white"
                  placeholder="Provide any extra context about the cancellation..."
                />
                <p className="text-xs text-slate-500 mt-1 text-right">{notes.length}/500</p>
              </div>

              {/* Preferred resolution */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Preferred Resolution</label>
                <div className="grid grid-cols-2 gap-2">
                  {RESOLUTIONS.map((res) => (
                    <button
                      key={res.value}
                      onClick={() => setPreferredResolution(res.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                        preferredResolution === res.value
                          ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                          : 'border-[#1e2d4d] text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <i className={res.icon}></i>
                      {res.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact preference */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Preferred Contact</label>
                <div className="flex gap-2">
                  {CONTACT_PREFS.map((pref) => (
                    <button
                      key={pref.value}
                      onClick={() => setContactPreference(pref.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                        contactPreference === pref.value
                          ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                          : 'border-[#1e2d4d] text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <i className={pref.icon}></i>
                      {pref.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 bg-teal-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Review
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Keep Job
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {/* Review summary */}
              <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4 space-y-2">
                <p className="text-sm font-semibold text-white mb-2">Cancellation Summary</p>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Job</span>
                  <span className="text-slate-200 text-right truncate max-w-[200px]">{job.job_title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Reason</span>
                  <span className="text-slate-200">{reason}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Preferred Resolution</span>
                  <span className="text-slate-200">{RESOLUTIONS.find(r => r.value === preferredResolution)?.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Contact Preference</span>
                  <span className="text-slate-200 capitalize">{contactPreference}</span>
                </div>
                {notes && (
                  <div className="pt-2 border-t border-[#1e2d4d]">
                    <span className="text-xs text-slate-500">Notes</span>
                    <p className="text-sm text-slate-300 mt-1">{notes}</p>
                  </div>
                )}
              </div>

              {/* Impact warning */}
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4">
                <p className="text-sm text-amber-400 font-semibold mb-1 flex items-center gap-2">
                  <i className="ri-alert-line"></i>
                  Impact
                </p>
                <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
                  <li>Job will be removed from the guard marketplace</li>
                  <li>Any assigned guards will be notified</li>
                  <li>Refund eligibility depends on cancellation timing</li>
                  {!canCancel && <li>Active job cancellations may require admin approval</li>}
                </ul>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Back
                </button>
                <button
                  onClick={handleCancel}
                  disabled={confirming}
                  className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {confirming ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Cancelling…
                    </>
                  ) : (
                    <>
                      <i className="ri-close-circle-line"></i>
                      Confirm Cancellation
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}