'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface ReplacementRequestModalProps {
  jobId: string;
  jobTitle: string;
  assignmentId?: string;
  guardName?: string;
  guardId?: string;
  clientId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const URGENCY_OPTIONS = [
  { value: 'normal', label: 'Normal', icon: 'ri-arrow-right-line', color: 'text-blue-400', border: 'border-blue-500/25', bg: 'bg-blue-500/10' },
  { value: 'urgent', label: 'Urgent', icon: 'ri-fire-line', color: 'text-orange-400', border: 'border-orange-500/25', bg: 'bg-orange-500/10' },
  { value: 'emergency', label: 'Emergency Cover Needed', icon: 'ri-alarm-warning-line', color: 'text-red-400', border: 'border-red-500/25', bg: 'bg-red-500/10' },
];

const REASON_OPTIONS = [
  { value: 'no_show', label: 'Guard No-Show', icon: 'ri-user-unfollow-line' },
  { value: 'late', label: 'Late Arrival', icon: 'ri-time-line' },
  { value: 'cancelled', label: 'Guard Cancelled', icon: 'ri-close-circle-line' },
  { value: 'not_confirmed', label: 'Not Confirmed Before Shift', icon: 'ri-question-line' },
  { value: 'other', label: 'Other Issue', icon: 'ri-error-warning-line' },
];

export default function ReplacementRequestModal({
  jobId,
  jobTitle,
  assignmentId,
  guardName,
  guardId,
  clientId,
  onClose,
  onSuccess,
}: ReplacementRequestModalProps) {
  const router = useRouter();
  const [urgency, setUrgency] = useState('urgent');
  const [reason, setReason] = useState('no_show');
  const [requiredArrivalTime, setRequiredArrivalTime] = useState('');
  const [notes, setNotes] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(1);
  const [createTicket, setCreateTicket] = useState(true);

  const handleSubmit = async () => {
    setError('');
    if (!reason) { setError('Please select a reason.'); return; }
    if (!requiredArrivalTime) { setError('Please specify when the replacement guard is needed.'); return; }
    if (urgency === 'emergency' && !contactPhone) { setError('Please provide a contact phone for emergency cover.'); return; }

    setSubmitting(true);
    try {
      // Insert replacement request
      const { data: requestData, error: reqError } = await supabase
        .from('replacement_requests')
        .insert({
          client_id: clientId,
          job_id: jobId,
          assignment_id: assignmentId || null,
          guard_id: guardId || null,
          reason,
          urgency,
          required_arrival_time: requiredArrivalTime,
          notes: notes.trim() || null,
          contact_phone: contactPhone.trim() || null,
          status: 'requested',
        })
        .select('id')
        .single();

      if (reqError) throw reqError;

      // If urgent or emergency, create a support ticket
      let supportTicketId: string | null = null;
      if (createTicket && (urgency === 'urgent' || urgency === 'emergency')) {
        const { data: ticketData, error: ticketError } = await supabase
          .from('support_tickets')
          .insert({
            client_id: clientId,
            related_job_id: jobId,
            category: 'guard_no_show',
            subject: `Replacement Request: ${guardName || 'Guard'} - ${urgency === 'emergency' ? 'Emergency Cover' : 'Urgent Cover'}`,
            description: `Replacement request submitted for job "${jobTitle}".\n\nReason: ${REASON_OPTIONS.find(r => r.value === reason)?.label}\nUrgency: ${URGENCY_OPTIONS.find(u => u.value === urgency)?.label}\nRequired by: ${requiredArrivalTime}\nNotes: ${notes || 'None'}\nContact: ${contactPhone || 'Not provided'}`,
            priority: urgency === 'emergency' ? 'urgent' : 'high',
            status: 'open',
            contact_preference: 'phone',
          })
          .select('id')
          .single();

        if (!ticketError && ticketData) {
          supportTicketId = ticketData.id;
          // Update the replacement request with the ticket link
          await supabase
            .from('replacement_requests')
            .update({ support_ticket_id: ticketData.id })
            .eq('id', requestData.id);
        }
      }

      // Create notification for client
      await supabase.from('notifications').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        user_type: 'client',
        type: 'replacement_requested',
        title: 'Replacement Request Submitted',
        message: `Your request for a replacement guard for "${jobTitle}" has been received. We are working on finding a suitable replacement.`,
        link: `/client/jobs/${jobId}`,
        is_read: false,
      });

      // If assignment exists, update it to mark replacement requested
      if (assignmentId) {
        await supabase
          .from('job_assignments')
          .update({
            replacement_requested: true,
            issue_reported: true,
            issue_type: 'replacement_needed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', assignmentId);
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit replacement request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const urgencyCfg = URGENCY_OPTIONS.find(u => u.value === urgency);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#111d35] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[#1e2d4d]">
        {/* Header */}
        <div className="sticky top-0 bg-[#111d35] border-b border-[#1e2d4d] px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-violet-500/10 rounded-xl">
              <i className="ri-refresh-line text-violet-400 text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Request Replacement Guard</h2>
              <p className="text-xs text-slate-500">{jobTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#162036] transition-colors cursor-pointer">
            <i className="ri-close-line text-slate-500 text-xl"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 flex items-center gap-2">
              <i className="ri-error-warning-line text-red-400"></i>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 flex items-center gap-2">
              <i className="ri-checkbox-circle-fill text-emerald-400 text-lg"></i>
              <p className="text-sm text-emerald-400 font-medium">Replacement request submitted successfully. QuickGuard is working on it.</p>
            </div>
          )}

          {!success && (
            <>
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-2">
                <div className={`flex-1 h-1 rounded-full ${step >= 1 ? 'bg-teal-500' : 'bg-[#162036]'}`}></div>
                <div className={`flex-1 h-1 rounded-full ${step >= 2 ? 'bg-teal-500' : 'bg-[#162036]'}`}></div>
              </div>

              {step === 1 && (
                <>
                  {/* Guard info */}
                  {guardName && (
                    <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#111d35] flex items-center justify-center border border-[#1e2d4d]">
                        <i className="ri-shield-user-line text-teal-400 text-lg"></i>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{guardName}</p>
                        <p className="text-xs text-slate-500">Current assigned guard</p>
                      </div>
                    </div>
                  )}

                  {/* Reason */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Why do you need a replacement? <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {REASON_OPTIONS.map((r) => (
                        <button
                          key={r.value}
                          onClick={() => setReason(r.value)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                            reason === r.value
                              ? 'border-teal-500 bg-teal-500/10'
                              : 'border-[#1e2d4d] hover:border-slate-600'
                          }`}
                        >
                          <div className="w-8 h-8 flex items-center justify-center bg-[#111d35] rounded-lg border border-[#1e2d4d]">
                            <i className={`${r.icon} text-slate-400`}></i>
                          </div>
                          <span className="text-sm font-medium text-slate-200">{r.label}</span>
                          {reason === r.value && (
                            <i className="ri-checkbox-circle-fill text-teal-500 ml-auto text-lg"></i>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Urgency */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Urgency Level <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {URGENCY_OPTIONS.map((u) => (
                        <button
                          key={u.value}
                          onClick={() => setUrgency(u.value)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                            urgency === u.value
                              ? 'border-teal-500 bg-teal-500/10'
                              : 'border-[#1e2d4d] hover:border-slate-600'
                          }`}
                        >
                          <div className={`w-8 h-8 flex items-center justify-center rounded-lg border ${u.border} ${u.bg}`}>
                            <i className={`${u.icon} ${u.color}`}></i>
                          </div>
                          <div className="flex-1">
                            <span className="text-sm font-medium text-slate-200">{u.label}</span>
                            <p className="text-xs text-slate-500">
                              {u.value === 'normal' && 'Standard replacement within 24 hours'}
                              {u.value === 'urgent' && 'Replacement needed within 2-4 hours'}
                              {u.value === 'emergency' && 'Immediate cover required — our team will call you'}
                            </p>
                          </div>
                          {urgency === u.value && (
                            <i className="ri-checkbox-circle-fill text-teal-500 text-lg"></i>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setStep(2)}
                      className="bg-teal-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Next <i className="ri-arrow-right-line ml-1"></i>
                    </button>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  {/* Required arrival time */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      When does the replacement need to arrive? <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={requiredArrivalTime}
                      onChange={(e) => setRequiredArrivalTime(e.target.value)}
                      className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">Specify the exact time the guard must be on site</p>
                  </div>

                  {/* Contact phone */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Contact Phone Number {urgency === 'emergency' && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500"
                      placeholder="+44 7123 456789"
                    />
                    <p className="text-xs text-slate-500 mt-1">We may call you directly for urgent or emergency requests</p>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Notes for QuickGuard
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any special instructions, access details, or context about the site..."
                      maxLength={500}
                      className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 min-h-[100px] resize-none"
                    />
                    <p className="text-xs text-slate-500 mt-1 text-right">{notes.length}/500</p>
                  </div>

                  {/* Support ticket checkbox */}
                  {(urgency === 'urgent' || urgency === 'emergency') && (
                    <div className="flex items-center gap-3 bg-[#162036] rounded-xl border border-[#1e2d4d] p-3">
                      <div className="w-9 h-9 flex items-center justify-center bg-violet-500/10 rounded-lg">
                        <i className="ri-customer-service-2-line text-violet-400"></i>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-200">Create support ticket</p>
                        <p className="text-xs text-slate-500">A ticket will be opened so you can track progress</p>
                      </div>
                      <button
                        onClick={() => setCreateTicket(!createTicket)}
                        className={`w-10 h-6 rounded-full transition-colors relative ${createTicket ? 'bg-teal-500' : 'bg-[#162036] border border-[#1e2d4d]'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${createTicket ? 'left-5' : 'left-1'}`}></span>
                      </button>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Request Summary</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Job</span>
                      <span className="text-slate-200 font-medium truncate max-w-[200px]">{jobTitle}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Reason</span>
                      <span className="text-slate-200 font-medium">{REASON_OPTIONS.find(r => r.value === reason)?.label}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Urgency</span>
                      <span className={`font-semibold ${urgencyCfg?.color}`}>{urgencyCfg?.label}</span>
                    </div>
                    {guardName && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Guard</span>
                        <span className="text-slate-200 font-medium">{guardName}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => setStep(1)}
                      className="px-4 py-2.5 border border-[#1e2d4d] text-slate-400 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-arrow-left-line mr-1"></i> Back
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 px-4 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <i className="ri-refresh-line"></i>
                      )}
                      {submitting ? 'Submitting…' : 'Request Replacement'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}