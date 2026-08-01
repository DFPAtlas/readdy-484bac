'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import CancellationStatusBadge from './CancellationStatusBadge';

interface RefundRequestModalProps {
  job: any;
  transaction: any;
  cancellation: any;
  onClose: () => void;
  onSuccess: () => void;
}

const REFUND_TYPES = [
  { value: 'full', label: 'Full Refund', icon: 'ri-money-pound-circle-line', desc: 'Refund the entire amount paid' },
  { value: 'partial', label: 'Partial Refund', icon: 'ri-percent-line', desc: 'Refund a portion of the amount paid' },
  { value: 'credit', label: 'Credit for Future Booking', icon: 'ri-coupon-line', desc: 'Receive credit toward a future job' },
  { value: 'admin_review', label: 'Request Admin Review', icon: 'ri-shield-user-line', desc: 'Escalate to QuickGuard admin for review' },
];

const REFUND_REASONS = [
  'No longer need cover',
  'Wrong job details',
  'Duplicate booking',
  'Guard issue',
  'Payment issue',
  'Site closed',
  'Emergency',
  'Other',
];

export default function RefundRequestModal({ job, transaction, cancellation, onClose, onSuccess }: RefundRequestModalProps) {
  const [type, setType] = useState('full');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  const paidAmount = transaction?.amount || 0;
  const platformFee = paidAmount * 0.15;
  const estimatedRefundable = paidAmount - platformFee;

  const handleSubmit = async () => {
    setError('');
    if (!reason) { setError('Please select a reason.'); return; }
    if (type === 'partial') {
      const num = parseFloat(amount);
      if (!num || num <= 0 || num > paidAmount) {
        setError(`Enter an amount between 0.01 and £${paidAmount.toFixed(2)}.`); return;
      }
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (!client) throw new Error('Client not found');

      const requestedAmount = type === 'full' ? paidAmount : type === 'partial' ? parseFloat(amount) : 0;

      const { error: insertError } = await supabase
        .schema('app')
        .from('refund_requests')
        .insert({
          job_id: job.id,
          client_id: client.id,
          cancellation_id: cancellation?.id || null,
          transaction_id: transaction?.id || null,
          requested_amount: requestedAmount,
          reason: reason,
          type: type,
          status: 'pending',
          notes: notes.trim() || null,
        });

      if (insertError) throw insertError;

      // Create linked support ticket for admin review
      if (type === 'admin_review' || type === 'partial') {
        await supabase.from('support_tickets').insert({
          client_id: client.id,
          related_job_id: job.id,
          category: 'refund_request',
          subject: `Refund Request: ${job.job_title}`,
          description: `Client requested a ${type} refund for job "${job.job_title}".\nReason: ${reason}\nNotes: ${notes || 'N/A'}`,
          priority: type === 'admin_review' ? 'high' : 'normal',
          status: 'open',
        });
      }

      // Send notification
      await supabase.from('notifications').insert({
        user_id: user?.id,
        user_type: 'client',
        type: 'refund_request',
        title: 'Refund Request Submitted',
        message: `Your ${type} refund request for "${job.job_title}" has been submitted and is pending review.`,
        link: `/client/jobs/${job.id}`,
        is_read: false,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit refund request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111d35] rounded-2xl shadow-2xl w-full max-w-lg border border-[#1e2d4d] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-[#1e2d4d]">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 flex items-center justify-center bg-violet-500/10 rounded-xl">
              <i className="ri-refund-line text-violet-400 text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Request Refund</h2>
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

          {step === 1 && (
            <>
              {/* Refund type */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Refund Type</label>
                <div className="space-y-2">
                  {REFUND_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setType(t.value)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                        type === t.value
                          ? 'border-teal-500 bg-teal-500/10'
                          : 'border-[#1e2d4d] hover:border-slate-600'
                      }`}
                    >
                      <div className="w-10 h-10 bg-[#162036] rounded-xl flex items-center justify-center flex-shrink-0">
                        <i className={`${t.icon} text-teal-400`}></i>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{t.label}</p>
                        <p className="text-xs text-slate-500">{t.desc}</p>
                      </div>
                      {type === t.value && (
                        <i className="ri-checkbox-circle-fill text-teal-500 text-lg ml-auto"></i>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Eligibility summary */}
              {paidAmount > 0 && (
                <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
                  <p className="text-sm font-semibold text-slate-300 mb-2">Payment Summary</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Amount Paid</span><span className="text-slate-200">£{paidAmount.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Platform Fee</span><span className="text-slate-200">-£{platformFee.toFixed(2)}</span></div>
                    <div className="flex justify-between pt-1 border-t border-[#1e2d4d]"><span className="text-white font-semibold">Estimated Refundable</span><span className="text-teal-400 font-bold">£{estimatedRefundable.toFixed(2)}</span></div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    <i className="ri-information-line mr-0.5"></i>
                    Refund eligibility depends on cancellation timing and policy. Actual refund may differ.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 bg-teal-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Continue
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {/* Reason */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Reason for Refund</label>
                <div className="flex flex-wrap gap-2">
                  {REFUND_REASONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setReason(r)}
                      className={`px-3 py-1.5 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
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

              {/* Partial amount */}
              {type === 'partial' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Requested Amount (£)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">£</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={paidAmount}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-7 pr-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#162036] text-white"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Max: £{paidAmount.toFixed(2)}</p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Additional Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none bg-[#162036] text-white"
                  placeholder="Provide any extra context to help us process your request..."
                />
                <p className="text-xs text-slate-500 mt-1 text-right">{notes.length}/500</p>
              </div>

              {/* Cancellation status */}
              {cancellation && (
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 flex items-center gap-3">
                  <i className="ri-information-line text-amber-400"></i>
                  <div>
                    <p className="text-sm text-amber-400 font-semibold">Linked Cancellation</p>
                    <p className="text-xs text-amber-400/80">This refund is linked to cancellation ID: {cancellation.id?.slice(0, 8)}</p>
                    <div className="mt-1">
                      <CancellationStatusBadge status={cancellation.status} size="sm" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 bg-teal-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Submitting…
                    </>
                  ) : (
                    <>
                      <i className="ri-send-plane-line"></i>
                      Submit Refund Request
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