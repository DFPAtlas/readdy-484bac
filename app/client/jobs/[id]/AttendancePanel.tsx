'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import GuardAttendanceCard from './GuardAttendanceCard';
import AttendanceSummary from './AttendanceSummary';
import AttendanceWarnings from './AttendanceWarnings';
import ReplacementRequestModal from './ReplacementRequestModal';
import ReplacementGuardSuggestions from './ReplacementGuardSuggestions';
import ReplacementStatusTracker from './ReplacementStatusTracker';

// ... existing code ...

interface AttendancePanelProps {
  job: any;
  assignments: Assignment[];
  clientId?: string;
  onMessageGuard?: (guardId: string, guardName: string, guardUserId: string) => void;
}

export default function AttendancePanel({ job, assignments, clientId, onMessageGuard }: AttendancePanelProps) {
  const router = useRouter();
  const [reportingAssignment, setReportingAssignment] = useState<string | null>(null);
  const [reportType, setReportType] = useState('no_show');
  const [reportNotes, setReportNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [replacementModal, setReplacementModal] = useState<{
    assignmentId?: string;
    guardName?: string;
    guardId?: string;
  } | null>(null);

  const handleReport = async () => {
    if (!reportingAssignment) return;
    setSubmitting(true);
    try {
      await supabase
        .from('job_assignments')
        .update({
          issue_reported: true,
          issue_type: reportType,
          issue_notes: reportNotes,
          attendance_status: reportType === 'no_show' ? 'no_show' : 'late',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportingAssignment);
      setSuccessMsg('Issue reported successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
      setReportingAssignment(null);
      setReportNotes('');
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReplacement = async (assignmentId: string, guardName: string) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    setReplacementModal({
      assignmentId,
      guardName,
      guardId: assignment?.guards?.id,
    });
  };

  const handleMarkResolved = async (assignmentId: string) => {
    try {
      await supabase
        .from('job_assignments')
        .update({
          issue_reported: false,
          issue_type: null,
          issue_notes: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignmentId);
      setSuccessMsg('Issue marked as resolved');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
    }
  };

  const handleReplacementSuccess = () => {
    setSuccessMsg('Replacement request submitted successfully');
    setTimeout(() => setSuccessMsg(''), 3000);
    setReplacementModal(null);
  };

  const formatTime = (d: string) => {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const isActive = job.status === 'in_progress' || job.status === 'awaiting_payment';
  const isUpcoming = job.status === 'open' || job.status === 'awaiting_guard_selection';

  const noShowOrLate = assignments.filter(a => a.attendance_status === 'no_show' || a.attendance_status === 'late');
  const hasReplacementRequests = assignments.some(a => a.replacement_requested);

  return (
    <div className="space-y-6">
      {/* Success Toast */}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-5 py-3 flex items-center gap-3">
          <i className="ri-checkbox-circle-fill text-emerald-500 text-lg"></i>
          <p className="text-sm font-medium text-emerald-400">{successMsg}</p>
        </div>
      )}

      {/* Shift Header */}
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center">
              <i className="ri-pulse-line text-teal-400 text-lg"></i>
            </div>
            Active Shift
          </h2>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
            isActive
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
              : isUpcoming
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/25'
              : 'bg-slate-500/10 text-slate-400 border-slate-500/25'
          }`}>
            {isActive ? 'Shift Active' : isUpcoming ? 'Upcoming' : 'Shift Ended'}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-3">
            <p className="text-xs text-slate-500 font-medium mb-1">Site</p>
            <p className="text-sm font-semibold text-slate-200 truncate">{job.venue_name || job.venue_city || '—'}</p>
          </div>
          <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-3">
            <p className="text-xs text-slate-500 font-medium mb-1">Shift Date</p>
            <p className="text-sm font-semibold text-slate-200">{formatDate(job.start_date)}</p>
          </div>
          <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-3">
            <p className="text-xs text-slate-500 font-medium mb-1">Time</p>
            <p className="text-sm font-semibold text-slate-200">{job.start_time?.slice(0, 5) || '—'} – {job.end_time?.slice(0, 5) || '—'}</p>
          </div>
          <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-3">
            <p className="text-xs text-slate-500 font-medium mb-1">Guards</p>
            <p className="text-sm font-semibold text-slate-200">{assignments.length} / {job.number_of_guards || 0} assigned</p>
          </div>
        </div>
      </div>

      {/* Warnings */}
      <AttendanceWarnings
        assignments={assignments}
        jobStartDate={job.start_date}
        jobStartTime={job.start_time}
        guardsRequired={job.number_of_guards || 0}
      />

      {/* Replacement Status Tracker */}
      {clientId && <ReplacementStatusTracker jobId={job.id} clientId={clientId} />}

      {/* Replacement Guard Suggestions */}
      {noShowOrLate.length > 0 && clientId && (
        <ReplacementGuardSuggestions
          jobId={job.id}
          job={job}
          currentAssignments={assignments}
          onRequestMore={() => router.push('/client/support?new=guard_no_show&job=' + job.id)}
        />
      )}

      {/* Summary */}
      <AttendanceSummary
        assignments={assignments}
        guardsRequired={job.number_of_guards || 0}
        jobStatus={job.status}
        jobStartDate={job.start_date}
        jobStartTime={job.start_time}
      />

      {/* Quick Actions */}
      {assignments.length > 0 && (
        <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <i className="ri-tools-line text-teal-400 text-lg"></i>
            Quick Actions
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push('/client/messages')}
              className="flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 px-4 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-message-3-line"></i>
              Message All Guards
            </button>
            <button
              onClick={() => router.push('/client/support')}
              className="flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 px-4 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-customer-service-2-line"></i>
              Contact Support
            </button>
            {hasReplacementRequests && (
              <button
                onClick={() => router.push('/client/support')}
                className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-refresh-line"></i>
                Check Replacement Status
              </button>
            )}
          </div>
        </div>
      )}

      {/* Guard Cards */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <i className="ri-shield-user-line text-teal-400 text-lg"></i>
          Guard Attendance
          <span className="ml-1 bg-teal-500/15 text-teal-400 text-xs font-bold px-2 py-0.5 rounded-full">{assignments.length}</span>
        </h3>
        {assignments.length === 0 ? (
          <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-16 text-center">
            <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-shield-user-line text-3xl text-slate-600"></i>
            </div>
            <h3 className="text-base font-semibold text-slate-300 mb-1">No guards assigned yet</h3>
            <p className="text-sm text-slate-500">Guards will appear here once they have been selected for this job.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignments.map(assignment => (
              <GuardAttendanceCard
                key={assignment.id}
                assignment={assignment}
                jobStartTime={job.start_time}
                jobEndTime={job.end_time}
                jobStartDate={job.start_date}
                onMessageGuard={onMessageGuard}
                onReportIssue={(id, name) => {
                  setReportingAssignment(id);
                  setReportType('no_show');
                  setReportNotes(`${name} did not show up for the shift.`);
                }}
                onRequestReplacement={handleRequestReplacement}
                onMarkResolved={handleMarkResolved}
              />
            ))}
          </div>
        )}
      </div>

      {/* Report Modal */}
      {reportingAssignment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111d35] rounded-2xl shadow-2xl w-full max-w-md p-6 border border-[#1e2d4d]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 flex items-center justify-center bg-red-500/10 rounded-xl">
                <i className="ri-error-warning-line text-red-500 text-xl"></i>
              </div>
              <h2 className="text-lg font-bold text-white">Report Issue</h2>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Issue Type</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'no_show', label: 'No-Show', icon: 'ri-user-unfollow-line' },
                    { key: 'late', label: 'Late Arrival', icon: 'ri-time-line' },
                    { key: 'poor_performance', label: 'Poor Performance', icon: 'ri-emotion-unhappy-line' },
                    { key: 'other', label: 'Other', icon: 'ri-question-line' },
                  ].map(type => (
                    <button
                      key={type.key}
                      onClick={() => setReportType(type.key)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        reportType === type.key
                          ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                          : 'bg-[#162036] text-slate-400 border border-[#1e2d4d] hover:text-slate-300'
                      }`}
                    >
                      <i className={type.icon}></i>
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Notes</label>
                <textarea
                  value={reportNotes}
                  onChange={e => setReportNotes(e.target.value)}
                  placeholder="Describe the issue..."
                  maxLength={500}
                  className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 placeholder:text-slate-500 min-h-[100px] resize-none"
                />
                <p className="text-xs text-slate-500 mt-1 text-right">{reportNotes.length}/500</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setReportingAssignment(null); setReportNotes(''); }}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <i className="ri-error-warning-line"></i>
                )}
                Report Issue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replacement Request Modal */}
      {replacementModal && clientId && (
        <ReplacementRequestModal
          jobId={job.id}
          jobTitle={job.job_title}
          assignmentId={replacementModal.assignmentId}
          guardName={replacementModal.guardName}
          guardId={replacementModal.guardId}
          clientId={clientId}
          onClose={() => setReplacementModal(null)}
          onSuccess={handleReplacementSuccess}
        />
      )}
    </div>
  );
}