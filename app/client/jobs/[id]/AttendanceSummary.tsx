'use client';

import { useState } from 'react';

interface Assignment {
  id: string;
  guards: Guard;
  attendance_status?: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  issue_reported?: boolean;
  replacement_requested?: boolean;
}

interface AttendanceSummaryProps {
  assignments: Assignment[];
  guardsRequired: number;
  jobStatus: string;
  jobStartDate?: string;
  jobStartTime?: string;
}

const statusOrder = ['awaiting_confirmation', 'confirmed', 'not_checked_in', 'checked_in', 'late', 'no_show', 'checked_out', 'completed'];

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  awaiting_confirmation: { label: 'Awaiting Confirmation', color: 'text-slate-400', bg: 'bg-slate-500' },
  confirmed: { label: 'Confirmed', color: 'text-blue-400', bg: 'bg-blue-500' },
  not_checked_in: { label: 'Not Checked In', color: 'text-orange-400', bg: 'bg-orange-500' },
  checked_in: { label: 'Checked In', color: 'text-emerald-400', bg: 'bg-emerald-500' },
  late: { label: 'Late', color: 'text-amber-400', bg: 'bg-amber-500' },
  no_show: { label: 'No-Show', color: 'text-red-400', bg: 'bg-red-500' },
  checked_out: { label: 'Checked Out', color: 'text-violet-400', bg: 'bg-violet-500' },
  completed: { label: 'Completed', color: 'text-teal-400', bg: 'bg-teal-500' },
};

function isShiftStarted(jobStartDate?: string, jobStartTime?: string): boolean {
  if (!jobStartDate || !jobStartTime) return false;
  const start = new Date(`${jobStartDate}T${jobStartTime}`);
  return new Date() >= start;
}

export default function AttendanceSummary({
  assignments,
  guardsRequired,
  jobStatus,
  jobStartDate,
  jobStartTime,
}: AttendanceSummaryProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const totalAssigned = assignments.length;
  const checkedIn = assignments.filter(a => a.attendance_status === 'checked_in' || a.attendance_status === 'checked_out' || a.attendance_status === 'completed').length;
  const late = assignments.filter(a => a.attendance_status === 'late').length;
  const noShow = assignments.filter(a => a.attendance_status === 'no_show').length;
  const completed = assignments.filter(a => a.attendance_status === 'completed').length;
  const issuesReported = assignments.filter(a => a.issue_reported).length;
  const replacementsNeeded = assignments.filter(a => a.replacement_requested).length;
  const openReplacementRequests = assignments.filter(a => a.replacement_requested && a.attendance_status !== 'completed').length;

  const shiftStarted = isShiftStarted(jobStartDate, jobStartTime);
  const notCheckedIn = shiftStarted ? assignments.filter(a => a.attendance_status === 'confirmed' || a.attendance_status === 'not_checked_in' || a.attendance_status === 'awaiting_confirmation').length : 0;

  const statusCounts: Record<string, number> = {};
  assignments.forEach(a => {
    const s = a.attendance_status || 'awaiting_confirmation';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  const isActive = jobStatus === 'in_progress' || jobStatus === 'awaiting_payment';

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center">
            <i className="ri-shield-check-line text-teal-400 text-lg"></i>
          </div>
          Attendance Summary
        </h2>
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="text-xs font-semibold text-teal-400 hover:text-teal-300 cursor-pointer whitespace-nowrap"
        >
          {showBreakdown ? 'Hide Breakdown' : 'Show Breakdown'}
        </button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-3 text-center">
          <p className="text-2xl font-bold text-slate-200">{totalAssigned}</p>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Assigned</p>
        </div>
        <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-3 text-center">
          <p className="text-2xl font-bold text-emerald-400">{checkedIn}</p>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Checked In</p>
        </div>
        <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-3 text-center">
          <p className="text-2xl font-bold text-amber-400">{late}</p>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Late</p>
        </div>
        <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{noShow}</p>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">No-Show</p>
        </div>
        <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-3 text-center">
          <p className="text-2xl font-bold text-teal-400">{completed}</p>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Completed</p>
        </div>
        <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{issuesReported}</p>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Issues</p>
        </div>
      </div>

      {/* Progress Bar */}
      {isActive && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-medium">Guards on site</span>
            <span className="text-xs font-semibold text-slate-300">
              {checkedIn} of {guardsRequired} required
            </span>
          </div>
          <div className="w-full h-2 bg-[#162036] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                checkedIn >= guardsRequired ? 'bg-emerald-500' : checkedIn >= guardsRequired * 0.5 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, (guardsRequired > 0 ? (checkedIn / guardsRequired) * 100 : 0))}%` }}
            />
          </div>
          {notCheckedIn > 0 && shiftStarted && (
            <p className="text-xs text-red-400 mt-1.5 font-medium">
              {notCheckedIn} guard{notCheckedIn !== 1 ? 's' : ''} still not checked in
            </p>
          )}
          {replacementsNeeded > 0 && (
            <p className="text-xs text-amber-400 mt-1.5 font-medium">
              {replacementsNeeded} replacement{replacementsNeeded !== 1 ? 's' : ''} requested
            </p>
          )}
          {openReplacementRequests > 0 && (
            <p className="text-xs text-violet-400 mt-1.5 font-medium">
              {openReplacementRequests} open replacement request{openReplacementRequests !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Breakdown */}
      {showBreakdown && (
        <div className="space-y-2 pt-3 border-t border-[#1e2d4d]">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Status Breakdown</p>
          {statusOrder.map(status => {
            const count = statusCounts[status] || 0;
            if (count === 0) return null;
            const cfg = statusConfig[status];
            return (
              <div key={status} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${cfg.bg}`}></span>
                  <span className="text-slate-300">{cfg.label}</span>
                </div>
                <span className={`font-bold ${cfg.color}`}>{count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}