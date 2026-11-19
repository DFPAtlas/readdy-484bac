'use client';

import { submitReplacementRequest, type ReplacementSubmission, type ReplacementReceipt } from '@/lib/replacement-submission';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ReplacementRequestModalProps {
  jobId: string;
  jobTitle: string;
  assignmentId?: string;
  guardName?: string;
  guardId?: string;
  preferredGuard?: { id: string; fullName: string };
  assignmentOptions?: { id: string; guardId?: string; guardName: string }[];
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
  clientId,
  preferredGuard,
  assignmentOptions,
  onClose,
  onSuccess,
}: ReplacementRequestModalProps) {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(assignmentId || '');
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

  const selectedAssignment = assignmentOptions?.find(a => a.id === selectedAssignmentId);
  const currentGuardName = selectedAssignment?.guardName || guardName;
  const requestNotes = [
    preferredGuard ? `Preferred replacement: ${preferredGuard.fullName} (guard ID: ${preferredGuard.id}). Availability and booking need confirmation.` : null,
    notes.trim() || null,
  ].filter(Boolean).join('\n\n');

  const [receipt, setReceipt] = useState<ReplacementReceipt | null>(null);
  const [attempted, setAttempted] = useState(false);
  const active = useRef(true);
  const busy = useRef(false);
  const confirmed = useRef(false);
  const finished = useRef(false);
  const payload = useRef<ReplacementSubmission | null>(null);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const finish = () => {
    if (!active.current || busy.current || finished.current) return;
    finished.current = true;
    if (confirmed.current) onSuccess(); else onClose();
  };

  const handleSubmit = async () => {
    if (!active.current || busy.current || confirmed.current) return;
    setError('');
    if (!payload.current) {
      if (!clientId || !jobId) { setError('Reload the job before requesting a replacement.'); return; }
      if (!selectedAssignmentId || (assignmentOptions && !selectedAssignment)) { setError('Please select the guard who needs replacing.'); return; }
      if (!REASON_OPTIONS.some(option => option.value === reason) || !URGENCY_OPTIONS.some(option => option.value === urgency)) { setError('Please select a reason and urgency.'); return; }
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(requiredArrivalTime)) { setError('Please specify when the replacement guard is needed.'); return; }
      if (urgency === 'emergency' && !contactPhone.trim()) { setError('Please provide a contact phone for emergency cover.'); return; }
      payload.current = {requestId: crypto.randomUUID(), clientId, jobId, assignmentId: selectedAssignmentId,
        reason, urgency, arrival: requiredArrivalTime, notes: requestNotes, phone: contactPhone.trim(), createTicket};
    }
    busy.current = true;
    setSubmitting(true);
    setAttempted(true);
    try {
      const saved = await submitReplacementRequest(supabase, payload.current, () => active.current);
      if (!active.current) return;
      confirmed.current = true;
      setReceipt(saved);
      setSuccess(true);
    } catch (error) {
      if (active.current) {
        const canEdit = error instanceof Error && 'canEdit' in error && error.canEdit === true;
        if (canEdit) { payload.current = null; setAttempted(false); }
        setError(canEdit ? 'The request was not accepted. Check the job and arrival details, then try again.' :
          'We could not confirm the request. Retry to check the same request. Check this job before starting another request.');
      }
    } finally {
      busy.current = false;
      if (active.current) setSubmitting(false);
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
          <button onClick={finish} disabled={submitting} aria-label="Close replacement request" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#162036] transition-colors cursor-pointer">
            <i className="ri-close-line text-slate-500 text-xl"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div role="alert" className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 flex items-center gap-2">
              <i className="ri-error-warning-line text-red-400"></i>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="space-y-3">
              <p role="status" className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 text-sm text-emerald-400">Replacement request recorded. Cover and booking require confirmation.</p>
              <p className="text-xs text-slate-400 break-all">Request reference: {receipt?.requestId}</p>
              {receipt?.supportSyncPending && <p role="alert" className="text-sm text-amber-400">Your request and support ticket were saved. Central support synchronisation is pending; your QuickGuard ticket remains available.</p>}
              <button onClick={finish} className="bg-teal-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold">Done</button>
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
                  {preferredGuard && (
                    <div className="bg-violet-500/10 border border-violet-500/25 rounded-xl p-3">
                      <p className="text-sm font-semibold text-violet-300">Preferred replacement: {preferredGuard.fullName}</p>
                      <p className="text-xs text-slate-400 mt-1">QuickGuard will check availability and arrange cover. This request does not confirm a booking.</p>
                    </div>
                  )}
                  {assignmentOptions && assignmentOptions.length > 1 && (
                    <div>
                      <label htmlFor="replacement-assignment" className="block text-sm font-semibold text-slate-300 mb-2">Guard to replace</label>
                      <select disabled={submitting || attempted} id="replacement-assignment" value={selectedAssignmentId} onChange={e => setSelectedAssignmentId(e.target.value)} className="w-full bg-[#162036] text-slate-200 border border-[#1e2d4d] rounded-xl p-3">
                        <option value="">Select assigned guard</option>
                        {assignmentOptions.map(a => <option key={a.id} value={a.id}>{a.guardName}</option>)}
                      </select>
                    </div>
                  )}
                  {/* Guard info */}
                  {currentGuardName && (
                    <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#111d35] flex items-center justify-center border border-[#1e2d4d]">
                        <i className="ri-shield-user-line text-teal-400 text-lg"></i>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{currentGuardName}</p>
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
                          disabled={submitting || attempted}
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
                          disabled={submitting || attempted}
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
                              {u.value === 'normal' && 'Cover needed later; availability needs confirmation'}
                              {u.value === 'urgent' && 'Urgent cover requested; response time depends on availability'}
                              {u.value === 'emergency' && 'Immediate cover requested; contact support for an update. Cover is not guaranteed'}
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
                      disabled={submitting || attempted}
                      value={requiredArrivalTime}
                      onChange={(e) => setRequiredArrivalTime(e.target.value)}
                      className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">Choose a future arrival in UK time (Europe/London). Availability still needs confirmation.</p>
                  </div>

                  {/* Contact phone */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Contact Phone Number {urgency === 'emergency' && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="tel"
                      maxLength={60}
                      disabled={submitting || attempted}
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
                      disabled={submitting || attempted}
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
                        disabled={submitting || attempted}
                        aria-label="Create support ticket"
                        aria-pressed={createTicket}
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
                    {preferredGuard && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Preferred replacement</span>
                        <span className="text-slate-200 font-medium">{preferredGuard.fullName}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Reason</span>
                      <span className="text-slate-200 font-medium">{REASON_OPTIONS.find(r => r.value === reason)?.label}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Urgency</span>
                      <span className={`font-semibold ${urgencyCfg?.color}`}>{urgencyCfg?.label}</span>
                    </div>
                    {currentGuardName && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Guard</span>
                        <span className="text-slate-200 font-medium">{currentGuardName}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => setStep(1)}
                      disabled={submitting || attempted}
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
                      {submitting ? 'Submitting…' : attempted ? 'Retry request' : 'Request Replacement'}
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
