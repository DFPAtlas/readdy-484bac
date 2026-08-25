'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getSuggestedPriority } from './PriorityBadge';

interface CreateTicketModalProps {
  guardId: string;
  prefillCategory?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  { value: 'general_support', label: 'General Support', icon: 'ri-customer-service-2-line' },
  { value: 'payment_issue', label: 'Payment Issue', icon: 'ri-secure-payment-line' },
  { value: 'late_payment', label: 'Late Payment', icon: 'ri-time-line' },
  { value: 'client_no_show', label: 'Client No-Show', icon: 'ri-user-unfollow-line' },
  { value: 'job_dispute', label: 'Job Dispute', icon: 'ri-emotion-unhappy-line' },
  { value: 'technical_issue', label: 'Technical Issue', icon: 'ri-bug-line' },
  { value: 'account_billing', label: 'Account/Billing', icon: 'ri-bank-card-line' },
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

export default function CreateTicketModal({ guardId, prefillCategory, onClose, onSuccess }: CreateTicketModalProps) {
  const [category, setCategory] = useState(prefillCategory || '');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(prefillCategory ? getSuggestedPriority(prefillCategory) : 'normal');
  const [contactPreference, setContactPreference] = useState('email');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    setPriority(getSuggestedPriority(val));
  };

  const handleSubmit = async () => {
    setError('');
    if (!category) { setError('Please select a category.'); return; }
    if (!subject.trim()) { setError('Please enter a subject.'); return; }
    if (!description.trim()) { setError('Please provide a description.'); return; }

    setSubmitting(true);
    try {
      const { error: insertError } = await supabase
        .from('support_tickets')
        .insert({
          guard_id: guardId,
          client_id: null,
          related_job_id: null,
          category,
          subject: subject.trim(),
          description: description.trim(),
          priority,
          status: 'open',
          contact_preference: contactPreference,
          evidence_url: evidenceUrl || null,
        });

      if (insertError) throw insertError;

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to submit ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111d35] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#1e2d4d]">
        <div className="sticky top-0 bg-[#111d35] border-b border-[#1e2d4d] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold text-white">New Support Ticket</h3>
            <p className="text-sm text-slate-500 mt-0.5">Tell us what you need help with</p>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                      ? p.color
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