'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Guard {
  id: string;
  full_name: string;
  profile_photo_url?: string;
  sia_licence_number?: string;
  phone?: string;
  user_id?: string;
  sia_verified?: boolean;
  sia_expiry_date?: string | null;
  average_rating?: number | null;
  total_reviews?: number | null;
  total_jobs_completed?: number | null;
}

interface Assignment {
  id: string;
  guards: Guard;
  status: string;
  attendance_status?: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  late_minutes?: number;
  guard_confirmed_at?: string | null;
  issue_reported?: boolean;
  issue_type?: string;
  issue_notes?: string;
  replacement_requested?: boolean;
}

interface GuardAttendanceCardProps {
  assignment: Assignment;
  jobStartTime?: string;
  jobEndTime?: string;
  jobStartDate?: string;
  onMessageGuard?: (guardId: string, guardName: string, guardUserId: string) => void;
  onReportIssue?: (assignmentId: string, guardName: string) => void;
  onRequestReplacement?: (assignmentId: string, guardName: string) => void;
  onMarkResolved?: (assignmentId: string) => void;
}

const attendanceStatusConfig: Record<string, { label: string; bg: string; text: string; border: string; icon: string }> = {
  awaiting_confirmation: { label: 'Awaiting Confirmation', bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/25', icon: 'ri-time-line' },
  confirmed: { label: 'Confirmed', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/25', icon: 'ri-check-line' },
  not_checked_in: { label: 'Not Checked In', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/25', icon: 'ri-login-circle-line' },
  checked_in: { label: 'Checked In', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/25', icon: 'ri-login-box-line' },
  late: { label: 'Late', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/25', icon: 'ri-time-line' },
  no_show: { label: 'No-Show', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/25', icon: 'ri-user-unfollow-line' },
  checked_out: { label: 'Checked Out', bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/25', icon: 'ri-logout-box-line' },
  completed: { label: 'Completed', bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/25', icon: 'ri-checkbox-circle-line' },
};

function formatTime(d: string | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function isShiftStarted(jobStartDate?: string, jobStartTime?: string): boolean {
  if (!jobStartDate || !jobStartTime) return false;
  const start = new Date(`${jobStartDate}T${jobStartTime}`);
  return new Date() >= start;
}

function isShiftWithin30Min(jobStartDate?: string, jobStartTime?: string): boolean {
  if (!jobStartDate || !jobStartTime) return false;
  const start = new Date(`${jobStartDate}T${jobStartTime}`);
  const now = new Date();
  const diff = start.getTime() - now.getTime();
  return diff > 0 && diff <= 30 * 60 * 1000;
}

export default function GuardAttendanceCard({
  assignment,
  jobStartTime,
  jobEndTime,
  jobStartDate,
  onMessageGuard,
  onReportIssue,
  onRequestReplacement,
  onMarkResolved,
}: GuardAttendanceCardProps) {
  const router = useRouter();
  const g = assignment.guards;
  const status = assignment.attendance_status || 'awaiting_confirmation';
  const config = attendanceStatusConfig[status] || attendanceStatusConfig.awaiting_confirmation;
  const initials = g?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '??';
  const [showActions, setShowActions] = useState(false);
  const [markingResolved, setMarkingResolved] = useState(false);

  const shiftStarted = isShiftStarted(jobStartDate, jobStartTime);
  const within30Min = isShiftWithin30Min(jobStartDate, jobStartTime);

  const handleMarkResolved = async () => {
    setMarkingResolved(true);
    try {
      await supabase
        .from('job_assignments')
        .update({ issue_reported: false, issue_type: null, issue_notes: null, updated_at: new Date().toISOString() })
        .eq('id', assignment.id);
      onMarkResolved?.(assignment.id);
    } catch {
    } finally {
      setMarkingResolved(false);
      setShowActions(false);
    }
  };

  return (
    <div className={`flex flex-col gap-3 p-4 bg-[#162036] rounded-xl border transition-all ${assignment.issue_reported ? 'border-red-500/40 ring-1 ring-red-500/15' : 'border-[#1e2d4d]'}`}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#111d35] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#1e2d4d]">
          {g?.profile_photo_url ? (
            <img src={g.profile_photo_url} alt={initials} className="w-full h-full object-cover" />
          ) : (
            <span className="text-teal-400 font-bold text-sm">{initials}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-200 truncate">{g?.full_name || 'Unknown Guard'}</p>
          {g?.sia_licence_number && (
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <i className="ri-shield-check-line text-emerald-400"></i>
              SIA: {g.sia_licence_number}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          <span className={`${config.bg} ${config.text} ${config.border} border text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1`}>
            <i className={config.icon}></i>
            {config.label}
          </span>
          {assignment.late_minutes && assignment.late_minutes > 0 && (
            <span className="text-[10px] font-semibold text-amber-400">
              {assignment.late_minutes} min late
            </span>
          )}
        </div>
      </div>

      {/* Warnings */}
      {within30Min && status === 'awaiting_confirmation' && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 flex items-center gap-2">
          <i className="ri-alert-line text-amber-400 text-sm"></i>
          <p className="text-xs text-amber-400 font-medium">Shift starts soon — guard hasn't confirmed</p>
        </div>
      )}
      {shiftStarted && (status === 'not_checked_in' || status === 'confirmed') && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2 flex items-center gap-2">
          <i className="ri-error-warning-line text-red-400 text-sm"></i>
          <p className="text-xs text-red-400 font-medium">Shift has started — guard not checked in</p>
        </div>
      )}
      {assignment.issue_reported && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <i className="ri-error-warning-line text-red-400 text-sm"></i>
            <p className="text-xs text-red-400 font-semibold">Issue Reported: {assignment.issue_type || 'General Issue'}</p>
          </div>
          {assignment.issue_notes && (
            <p className="text-xs text-red-400/80 ml-5">{assignment.issue_notes}</p>
          )}
          {assignment.replacement_requested && (
            <p className="text-xs text-red-400 font-semibold ml-5 mt-1">Replacement requested</p>
          )}
        </div>
      )}

      {/* Times */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-[#111d35] rounded-lg p-2 border border-[#1e2d4d]">
          <p className="text-slate-500 mb-0.5">Scheduled</p>
          <p className="text-slate-300 font-semibold">{jobStartTime?.slice(0, 5) || '—'}</p>
        </div>
        <div className="bg-[#111d35] rounded-lg p-2 border border-[#1e2d4d]">
          <p className="text-slate-500 mb-0.5">Confirmed</p>
          <p className="text-slate-300 font-semibold">{formatDateTime(assignment.guard_confirmed_at)}</p>
        </div>
        <div className="bg-[#111d35] rounded-lg p-2 border border-[#1e2d4d]">
          <p className="text-slate-500 mb-0.5">Check In</p>
          <p className={`font-semibold ${assignment.check_in_time ? 'text-emerald-400' : 'text-slate-600'}`}>
            {formatTime(assignment.check_in_time) || 'Pending'}
          </p>
        </div>
        <div className="bg-[#111d35] rounded-lg p-2 border border-[#1e2d4d]">
          <p className="text-slate-500 mb-0.5">Check Out</p>
          <p className={`font-semibold ${assignment.check_out_time ? 'text-violet-400' : 'text-slate-600'}`}>
            {formatTime(assignment.check_out_time) || 'Pending'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-[#1e2d4d] flex-wrap">
        {g?.user_id && (
          <button
            onClick={() => onMessageGuard?.(g.id, g.full_name || 'Guard', g.user_id)}
            className="flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-message-3-line"></i>
            Message
          </button>
        )}
        {g?.phone && (
          <a
            href={`tel:${g.phone}`}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-300 bg-[#111d35] hover:bg-[#1a2642] px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-phone-line"></i>
            Call
          </a>
        )}
        <button
          onClick={() => setShowActions(!showActions)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-300 bg-[#111d35] hover:bg-[#1a2642] px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ml-auto"
        >
          <i className="ri-more-2-line"></i>
          Actions
        </button>
      </div>

      {showActions && (
        <div className="flex flex-col gap-2 bg-[#111d35] rounded-lg p-3 border border-[#1e2d4d]">
          <button
            onClick={() => {
              onReportIssue?.(assignment.id, g?.full_name || 'Guard');
              setShowActions(false);
            }}
            className="flex items-center gap-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-user-unfollow-line"></i>
            Report No-Show
          </button>
          <button
            onClick={() => {
              onRequestReplacement?.(assignment.id, g?.full_name || 'Guard');
              setShowActions(false);
            }}
            className="flex items-center gap-2 text-xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 px-3 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line"></i>
            Request Replacement
          </button>
          <button
            onClick={() => router.push('/client/support')}
            className="flex items-center gap-2 text-xs font-semibold text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 px-3 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-customer-service-2-line"></i>
            Contact QuickGuard Support
          </button>
          {assignment.issue_reported && (
            <button
              onClick={handleMarkResolved}
              disabled={markingResolved}
              className="flex items-center gap-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-3 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {markingResolved ? (
                <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <i className="ri-check-line"></i>
              )}
              Mark Issue Resolved
            </button>
          )}
        </div>
      )}
    </div>
  );
}