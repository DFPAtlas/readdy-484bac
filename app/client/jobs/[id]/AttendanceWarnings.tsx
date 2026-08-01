'use client';

interface AttendanceWarningProps {
  assignments: any[];
  jobStartDate?: string;
  jobStartTime?: string;
  guardsRequired?: number;
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

export default function AttendanceWarnings({
  assignments,
  jobStartDate,
  jobStartTime,
  guardsRequired = 0,
}: AttendanceWarningProps) {
  const shiftStarted = isShiftStarted(jobStartDate, jobStartTime);
  const within30Min = isShiftWithin30Min(jobStartDate, jobStartTime);

  const unconfirmed = assignments.filter(
    a => (a.attendance_status === 'awaiting_confirmation' || a.attendance_status === 'confirmed') && within30Min
  );
  const notCheckedIn = assignments.filter(
    a => shiftStarted && (a.attendance_status === 'confirmed' || a.attendance_status === 'not_checked_in' || a.attendance_status === 'awaiting_confirmation')
  );
  const lateGuards = assignments.filter(a => a.attendance_status === 'late');
  const noShows = assignments.filter(a => a.attendance_status === 'no_show');
  const checkedIn = assignments.filter(a => a.attendance_status === 'checked_in' || a.attendance_status === 'checked_out' || a.attendance_status === 'completed');
  const issues = assignments.filter(a => a.issue_reported);
  const replacementRequests = assignments.filter(a => a.replacement_requested);

  const warnings: { type: 'urgent' | 'warning' | 'info'; icon: string; message: string; action?: { label: string; href: string } }[] = [];

  if (noShows.length > 0) {
    warnings.push({
      type: 'urgent',
      icon: 'ri-user-unfollow-line',
      message: `${noShows.length} guard${noShows.length !== 1 ? 's' : ''} marked as no-show. You may need replacement guards.`,
      action: { label: 'Request Replacement', href: '#' },
    });
  }

  if (lateGuards.length > 0) {
    warnings.push({
      type: 'warning',
      icon: 'ri-time-line',
      message: `${lateGuards.length} guard${lateGuards.length !== 1 ? 's' : ''} checked in late.`,
      action: { label: 'Request Replacement', href: '#' },
    });
  }

  if (notCheckedIn.length > 0 && shiftStarted) {
    warnings.push({
      type: 'urgent',
      icon: 'ri-error-warning-line',
      message: `${notCheckedIn.length} guard${notCheckedIn.length !== 1 ? 's' : ''} still not checked in after shift start.`,
      action: { label: 'Request Replacement', href: '#' },
    });
  }

  if (unconfirmed.length > 0 && within30Min) {
    warnings.push({
      type: 'warning',
      icon: 'ri-alert-line',
      message: `${unconfirmed.length} guard${unconfirmed.length !== 1 ? 's' : ''} not confirmed with shift starting within 30 minutes.`,
      action: { label: 'Request Replacement', href: '#' },
    });
  }

  if (shiftStarted && checkedIn.length < guardsRequired && guardsRequired > 0) {
    warnings.push({
      type: 'urgent',
      icon: 'ri-shield-cross-line',
      message: `Only ${checkedIn.length} of ${guardsRequired} required guards are on site.`,
      action: { label: 'Request Replacement', href: '#' },
    });
  }

  if (replacementRequests.length > 0) {
    warnings.push({
      type: 'info',
      icon: 'ri-refresh-line',
      message: `${replacementRequests.length} replacement request${replacementRequests.length !== 1 ? 's' : ''} submitted. QuickGuard is working on it.`,
    });
  }

  if (issues.length > 0) {
    warnings.push({
      type: 'warning',
      icon: 'ri-flashlight-line',
      message: `${issues.length} issue${issues.length !== 1 ? 's' : ''} reported for this job.`,
    });
  }

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-3">
      {warnings.map((w, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
            w.type === 'urgent'
              ? 'bg-red-500/10 border-red-500/25'
              : w.type === 'warning'
              ? 'bg-amber-500/10 border-amber-500/25'
              : 'bg-blue-500/10 border-blue-500/25'
          }`}
        >
          <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0">
            <i className={`${w.icon} text-lg ${
              w.type === 'urgent' ? 'text-red-400' : w.type === 'warning' ? 'text-amber-400' : 'text-blue-400'
            }`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${
              w.type === 'urgent' ? 'text-red-400' : w.type === 'warning' ? 'text-amber-400' : 'text-blue-400'
            }`}>
              {w.message}
            </p>
          </div>
          {w.action && w.type !== 'info' && (
            <span className="text-xs font-semibold text-slate-500 flex-shrink-0">
              {w.action.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}