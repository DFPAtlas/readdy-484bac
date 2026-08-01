'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logClientActivity, ACTIVITY_TYPES, ACTIVITY_CATEGORIES } from '@/lib/client-activity';

interface ComplaintModalProps {
  jobId: string;
  jobTitle: string;
  assignedGuards: any[];
  currentUserId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ComplaintModal({
  jobId,
  jobTitle,
  assignedGuards,
  currentUserId,
  onClose,
  onSuccess,
}: ComplaintModalProps) {
  const [form, setForm] = useState({
    filed_against_type: 'guard',
    filed_against_id: '',
    category: '',
    severity: 'medium',
    description: '',
    evidence_url: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!form.category) { setError('Please select a category.'); return; }
    if (!form.description.trim()) { setError('Please provide a description.'); return; }
    if (form.filed_against_type === 'guard' && !form.filed_against_id) {
      setError('Please select a guard.'); return;
    }

    setSubmitting(true);
    try {
      // Get client_id from the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not authenticated'); return; }

      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!client) { setError('Client profile not found'); return; }

      const { error: insertError } = await supabase.from('support_tickets').insert({
        client_id: client.id,
        guard_id: form.filed_against_type === 'guard' ? form.filed_against_id : null,
        related_job_id: jobId,
        category: mapOldCategory(form.category),
        subject: `${form.category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} — ${jobTitle}`,
        description: form.description,
        priority: mapSeverityToPriority(form.severity),
        status: 'open',
        contact_preference: 'email',
        evidence_url: form.evidence_url || null,
      });

      if (insertError) throw insertError;

      // Log complaint activity
      await logClientActivity({
        action_type: ACTIVITY_TYPES.COMPLAINT_RAISED,
        action_description: `Complaint raised: ${form.category.replace(/_/g, ' ')} — ${jobTitle}`,
        category: ACTIVITY_CATEGORIES.SUPPORT,
        related_job_id: jobId,
        metadata: { category: form.category, severity: form.severity, filed_against_type: form.filed_against_type },
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to submit complaint. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const mapOldCategory = (cat: string): string => {
    const map: Record<string, string> = {
      guard_behavior: 'poor_performance',
      no_show: 'guard_no_show',
      late_arrival: 'late_arrival',
      unprofessional_conduct: 'poor_performance',
      safety_issue: 'general_support',
      payment_dispute: 'payment_issue',
      service_quality: 'general_support',
      technical_issue: 'technical_issue',
      other: 'general_support',
    };
    return map[cat] || 'general_support';
  };

  const mapSeverityToPriority = (sev: string): string => {
    const map: Record<string, string> = {
      low: 'low',
      medium: 'normal',
      high: 'high',
      critical: 'urgent',
    };
    return map[sev] || 'normal';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111d35] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#1e2d4d]">
        <div className="sticky top-0 bg-[#111d35] border-b border-[#1e2d4d] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold text-white">Raise an Issue</h3>
            <p className="text-sm text-slate-500 mt-0.5 truncate max-w-xs">Job: {jobTitle}</p>
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

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Issue Against <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              {[
                { value: 'guard', label: 'A Guard', icon: 'ri-shield-user-line' },
                { value: 'quickguard', label: 'QuickGuard Service', icon: 'ri-customer-service-2-line' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setForm({ ...form, filed_against_type: opt.value, filed_against_id: '' })}
                  className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer ${
                    form.filed_against_type === opt.value
                      ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                      : 'border-[#1e2d4d] text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <i className={opt.icon}></i>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {form.filed_against_type === 'guard' && (
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Select Guard <span className="text-red-500">*</span>
              </label>
              {assignedGuards.length === 0 ? (
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 text-sm text-amber-400">
                  <i className="ri-information-line mr-1"></i>
                  No guards are assigned to this job yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {assignedGuards.map((a) => {
                    const g = a.guards;
                    const guardUserId = g?.user_id || a.guard_id;
                    const name = g ? `${g.first_name} ${g.last_name}` : 'Unknown Guard';
                    const sia = g?.sia_licence_number || 'N/A';
                    const photo = g?.profile_photo_url;
                    return (
                      <button
                        key={a.id}
                        onClick={() => setForm({ ...form, filed_against_id: guardUserId })}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                          form.filed_against_id === guardUserId
                            ? 'border-teal-500 bg-teal-500/10'
                            : 'border-[#1e2d4d] hover:border-slate-600'
                        }`}
                      >
                        {photo ? (
                          <img src={photo} alt={name} className="w-9 h-9 rounded-full object-cover object-top" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#162036] flex items-center justify-center text-teal-400 font-bold text-sm">
                            {name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-200">{name}</p>
                          <p className="text-xs text-slate-500">SIA: {sia}</p>
                        </div>
                        {form.filed_against_id === guardUserId && (
                          <div className="w-5 h-5 flex items-center justify-center">
                            <i className="ri-checkbox-circle-fill text-teal-500 text-lg"></i>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'guard_behavior', label: 'Guard Behaviour' },
                { value: 'no_show', label: 'No Show' },
                { value: 'late_arrival', label: 'Late Arrival' },
                { value: 'unprofessional_conduct', label: 'Unprofessional' },
                { value: 'safety_issue', label: 'Safety Issue' },
                { value: 'payment_dispute', label: 'Payment Dispute' },
                { value: 'service_quality', label: 'Service Quality' },
                { value: 'technical_issue', label: 'Technical Issue' },
                { value: 'other', label: 'Other' },
              ].map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setForm({ ...form, category: cat.value })}
                  className={`px-3 py-2 rounded-xl border-2 text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    form.category === cat.value
                      ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                      : 'border-[#1e2d4d] text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Severity <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {[
                { value: 'low', label: 'Low', color: 'border-slate-500 bg-[#162036] text-slate-400' },
                { value: 'medium', label: 'Medium', color: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
                { value: 'high', label: 'High', color: 'border-orange-500/30 bg-orange-500/10 text-orange-400' },
                { value: 'critical', label: 'Critical', color: 'border-red-500/30 bg-red-500/10 text-red-400' },
              ].map((sev) => (
                <button
                  key={sev.value}
                  onClick={() => setForm({ ...form, severity: sev.value })}
                  className={`flex-1 py-2 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    form.severity === sev.value
                      ? sev.color + ' border-opacity-100'
                      : 'border-[#1e2d4d] text-slate-500 hover:border-slate-600'
                  }`}
                >
                  {sev.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={5}
              maxLength={500}
              className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none bg-[#162036] text-white"
              placeholder="Describe the issue in detail — what happened, when, and any relevant context..."
            />
            <p className="text-xs text-slate-500 mt-1 text-right">{form.description.length}/500</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Evidence URL <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={form.evidence_url}
              onChange={(e) => setForm({ ...form, evidence_url: e.target.value })}
              className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#162036] text-white"
              placeholder="https://example.com/evidence.jpg"
            />
            <p className="text-xs text-slate-500 mt-1">Link to any supporting images or documents</p>
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
                  Submit Complaint
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
