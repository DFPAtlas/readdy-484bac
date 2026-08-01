'use client';

interface TrackerStatsBarProps {
  jobs: any[];
}

export default function TrackerStatsBar({ jobs }: TrackerStatsBarProps) {
  const total = jobs.length;
  const pending = jobs.filter(j => j.status === 'pending').length;
  const awaitingSelection = jobs.filter(j => j.status === 'awaiting_guard_selection').length;
  const awaitingPayment = jobs.filter(j => j.status === 'awaiting_payment').length;
  const inProgress = jobs.filter(j => j.status === 'in_progress').length;
  const completed = jobs.filter(j => j.status === 'completed').length;

  // Attendance stats across active jobs
  const checkedIn = jobs.reduce((sum, j) => sum + (j.checked_in_count || 0), 0);
  const late = jobs.reduce((sum, j) => sum + (j.late_count || 0), 0);
  const noShow = jobs.reduce((sum, j) => sum + (j.no_show_count || 0), 0);
  const issues = jobs.reduce((sum, j) => sum + (j.issue_count || 0), 0);

  const replacementNeeded = jobs.reduce((sum, j) => sum + (j.replacement_needed_count || 0), 0);
  const replacementOpen = jobs.reduce((sum, j) => sum + (j.replacement_open_count || 0), 0);

  const stats = [
    { label: 'Total Jobs', value: total, icon: 'ri-briefcase-4-line', bg: 'bg-[#162036]', color: 'text-teal-400', border: 'border-[#1e2d4d]' },
    { label: 'Awaiting Guards', value: awaitingSelection, icon: 'ri-user-search-line', bg: 'bg-[#162036]', color: 'text-amber-400', border: 'border-[#1e2d4d]' },
    { label: 'Awaiting Payment', value: awaitingPayment, icon: 'ri-secure-payment-line', bg: 'bg-[#162036]', color: 'text-orange-400', border: 'border-[#1e2d4d]' },
    { label: 'In Progress', value: inProgress, icon: 'ri-pulse-line', bg: 'bg-[#162036]', color: 'text-violet-400', border: 'border-[#1e2d4d]' },
    { label: 'Completed', value: completed, icon: 'ri-checkbox-circle-line', bg: 'bg-[#162036]', color: 'text-emerald-400', border: 'border-[#1e2d4d]' },
  ];

  const attendanceStats = [
    { label: 'Checked In', value: checkedIn, icon: 'ri-login-box-line', bg: 'bg-[#162036]', color: 'text-emerald-400', border: 'border-[#1e2d4d]' },
    { label: 'Late', value: late, icon: 'ri-time-line', bg: 'bg-[#162036]', color: 'text-amber-400', border: 'border-[#1e2d4d]' },
    { label: 'No-Show', value: noShow, icon: 'ri-user-unfollow-line', bg: 'bg-[#162036]', color: 'text-red-400', border: 'border-[#1e2d4d]' },
    { label: 'Issues', value: issues, icon: 'ri-error-warning-line', bg: 'bg-[#162036]', color: 'text-red-400', border: 'border-[#1e2d4d]' },
  ];

  const replacementStats = [
    { label: 'Replacements Needed', value: replacementNeeded, icon: 'ri-refresh-line', bg: 'bg-[#162036]', color: 'text-violet-400', border: 'border-[#1e2d4d]' },
    { label: 'Requests Open', value: replacementOpen, icon: 'ri-search-line', bg: 'bg-[#162036]', color: 'text-blue-400', border: 'border-[#1e2d4d]' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        {stats.map(s => (
          <div key={s.label} className={`bg-[#111d35] rounded-xl md:rounded-2xl border ${s.border} shadow-sm p-3 md:p-4 flex items-center gap-2 md:gap-3`}>
            <div className={`w-8 h-8 md:w-10 md:h-10 ${s.bg} rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0`}>
              <i className={`${s.icon} text-base md:text-lg ${s.color}`}></i>
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold text-slate-200">{s.value}</p>
              <p className="text-[10px] md:text-xs text-slate-500 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
      {(checkedIn > 0 || late > 0 || noShow > 0 || issues > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {attendanceStats.map(s => (
            <div key={s.label} className={`bg-[#111d35] rounded-xl border ${s.border} shadow-sm p-3 flex items-center gap-3`}>
              <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <i className={`${s.icon} text-base ${s.color}`}></i>
              </div>
              <div>
                <p className="text-xl font-bold text-slate-200">{s.value}</p>
                <p className="text-[10px] text-slate-500 font-medium">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {(replacementNeeded > 0 || replacementOpen > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4">
          {replacementStats.map(s => (
            <div key={s.label} className={`bg-[#111d35] rounded-xl border ${s.border} shadow-sm p-3 flex items-center gap-3`}>
              <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <i className={`${s.icon} text-base ${s.color}`}></i>
              </div>
              <div>
                <p className="text-xl font-bold text-slate-200">{s.value}</p>
                <p className="text-[10px] text-slate-500 font-medium">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
