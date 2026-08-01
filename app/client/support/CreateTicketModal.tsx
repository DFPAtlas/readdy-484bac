'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logClientActivity, ACTIVITY_TYPES, ACTIVITY_CATEGORIES } from '@/lib/client-activity';
import PriorityBadge, { getSuggestedPriority } from './PriorityBadge';

interface CreateTicketModalProps {
  clientId: string;
  jobs: any[];
  prefillJobId?: string;
  prefillCategory?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  { value: 'general_support', label: 'General Support', icon: 'ri-customer-service-2-line' },
  { value: 'payment_issue', label: 'Payment Issue', icon: 'ri-secure-payment-line' },
  { value: 'guard_no_show', label: 'Guard No-Show', icon: 'ri-user-unfollow-line' },
  { value: 'late_arrival', label: 'Late Arrival', icon: 'ri-time-line' },
  { value: 'poor_performance', label: 'Poor Performance', icon: 'ri-emotion-unhappy-line' },
  { value: 'refund_request', label: 'Refund Request', icon: 'ri-refund-line' },
  { value: 'job_cancellation', label: 'Job Cancellation', icon: 'ri-close-circle-line' },
  { value: 'technical_issue', label: 'Technical Issue', icon: 'ri-bug-line' },
  { value: 'account_billing', label: 'Account/Billing Help', icon: 'ri-bank-card-line' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', icon: 'ri-arrow-down-line', color: 'border-slate-500 bg-[#162036] text-slate-400' },
  { value: 'normal', label: 'Normal', icon: 'ri-arrow-right-line', color: 'border-blue-500/30 bg-blue-500/10 text-blue-400' },
  { value: 'high', label: 'High', icon: 'ri-arrow-up-line', color: 'border-orange-500/30 bg-orange-500/10 text-orange-400' },
  { value: 'urgent', label: 'Urgent', icon: 'ri-fire-line', color: 'border-red-500/30 bg-red-500/10 text-red-400' },
];

const CONTACT_PREFS = [
  { value: 'email', label: 'Email', icon: 'ri-mail-line' },
  { value: 'phone', label: 'Phone', icon: 'ri-phone-line' },
];

export default function CreateTicketModal({ clientId, jobs, prefillJobId, prefillCategory, onClose, onSuccess }: CreateTicketModalProps) {
  const [category, setCategory] = useState(prefillCategory || '');
  const [relatedJobId, setRelatedJobId] = useState(prefillJobId || '');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [contactPreference, setContactPreference] = useState('email');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [requestedRefundAmount, setRequestedRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    setPriority(getSuggestedPriority(val));
    if (val === 'refund_request') {
      setStep(2);
    } else {
      setStep(1);
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!category) { setError('Please select a category.'); return; }
    if (!subject.trim()) { setError('Please enter a subject.'); return; }
    if (!description.trim()) { setError('Please provide a description.'); return; }

    if (category === 'refund_request') {
      if (!requestedRefundAmount || parseFloat(requestedRefundAmount) <= 0) {
        setError('Please enter a valid refund amount.'); return;
      }
    }

    setSubmitting(true);
    try {
      const insertData: any = {
        client_id: clientId,
        related_job_id: relatedJobId || null,
        category,
        subject: subject.trim(),
        description: description.trim(),
        priority,
        status: 'open',
        contact_preference: contactPreference,
        evidence_url: evidenceUrl || null,
      };

      if (category === 'refund_request') {
        insertData.requested_refund_amount = parseFloat(requestedRefundAmount);
        insertData.refund_reason = refundReason.trim() || null;
      }

      const { error: insertError } = await supabase
        .from('support_tickets')
        .insert(insertData);

      if (insertError) throw insertError;

      // Log activity
      await logClientActivity({
        action_type: ACTIVITY_TYPES.TICKET_CREATED,
        action_description: `Support ticket created: ${subject.trim()}`,
        category: ACTIVITY_CATEGORIES.SUPPORT,
        related_ticket_id: insertData.id || null,
        related_job_id: relatedJobId || null,
        metadata: { category, priority, contact_preference: contactPreference },
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to submit ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isRefund = category === 'refund_request';
  const isJobRelated = category === 'guard_no_show' || category === 'late_arrival' || category === 'poor_performance' || category === 'refund_request';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111d35] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#1e2d4d]">
        <div className="sticky top-0 bg-[#111d35] border-b border-[#1e2d4d] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold text-white">New Support Ticket</h3>
            <p className="text-sm text-slate-500 mt-0.5">Step {step} of {isRefund ? 2 : 1}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#162036] transition-colors cursor-pointer">
            <i className="ri-close-line text-slate-500 text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 flex items-center gap-2">
              <i className="ri-error-warning-line text-red-400"></i>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => handleCategoryChange(cat.value)}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border-2 text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    category === cat.value
                      ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                      : 'border-[#1e2d4d] text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <i className={cat.icon}></i>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Related Job */}
          {isJobRelated && (
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Related Job <span className="text-red-500">*</span>
              </label>
              {jobs.length === 0 ? (
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 text-sm text-amber-400">
                  <i className="ri-information-line mr-1"></i>
                  You have no jobs to link. <a href="/client/post-job" className="underline text-teal-400">Post a job</a> first.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {jobs.map((job: any) => (
                    <button
                      key={job.id}
                      onClick={() => setRelatedJobId(job.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                        relatedJobId === job.id
                          ? 'border-teal-500 bg-teal-500/10'
                          : 'border-[#1e2d4d] hover:border-slate-600'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#162036] flex items-center justify-center flex-shrink-0">
                        <i className="ri-briefcase-4-line text-teal-400"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">{job.job_title}</p>
                        <p className="text-xs text-slate-500">{job.venue_city} · {job.start_date}</p>
                      </div>
                      {relatedJobId === job.id && (
                        <div className="w-5 h-5 flex items-center justify-center">
                          <i className="ri-checkbox-circle-fill text-teal-500 text-lg"></i>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#162036] text-white"
              placeholder="Brief summary of the issue..."
              maxLength={100}
            />
            <p className="text-xs text-slate-500 mt-1 text-right">{subject.length}/100</p>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Priority
            </label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  className={`flex-1 py-2 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    priority === p.value
                      ? p.color + ' border-opacity-100'
                      : 'border-[#1e2d4d] text-slate-500 hover:border-slate-600'
                  }`}
                >
                  <i className={p.icon}></i> {p.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {category ? `Suggested priority: ${PRIORITIES.find(p => p.value === getSuggestedPriority(category))?.label}` : 'Select a category to see suggested priority'}
            </p>
          </div>

          {/* Refund Details */}
          {isRefund && (
            <div className="bg-orange-500/5 border border-orange-500/15 rounded-xl p-4 space-y-4">
              <p className="text-sm font-semibold text-orange-400 flex items-center gap-2">
                <i className="ri-refund-line"></i>Refund Details
              </p>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Requested Refund Amount (£) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">£</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={requestedRefundAmount}
                    onChange={(e) => setRequestedRefundAmount(e.target.value)}
                    className="w-full pl-7 pr-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#162036] text-white"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Reason for Refund
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none bg-[#162036] text-white"
                  placeholder="Explain why you are requesting a refund..."
                />
                <p className="text-xs text-slate-500 mt-1 text-right">{refundReason.length}/500</p>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={500}
              className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none bg-[#162036] text-white"
              placeholder="Describe the issue in detail — what happened, when, and any relevant context..."
            />
            <p className="text-xs text-slate-500 mt-1 text-right">{description.length}/500</p>
          </div>

          {/* Evidence */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Evidence URL <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#162036] text-white"
              placeholder="https://example.com/evidence.jpg"
            />
            <p className="text-xs text-slate-500 mt-1">Link to photos, documents, or other supporting evidence</p>
          </div>

          {/* Contact Preference */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Preferred Contact Method
            </label>
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
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-teal-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Submitting…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-send-plane-line"></i>
                  Submit Ticket
                </span>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-[#1e2d4d] text-slate-400 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}