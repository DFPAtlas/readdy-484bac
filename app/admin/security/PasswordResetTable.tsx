'use client';

import { ActivityEntry } from './SecurityDashboardClient';

interface Props {
  events: ActivityEntry[];
}

function ResetStatusBadge({ type }: { type: string }) {
  if (type === 'password_reset_completed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
        <i className="ri-checkbox-circle-fill text-xs"></i> Completed
      </span>
    );
  }
  if (type === 'password_reset_failed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
        <i className="ri-close-circle-fill text-xs"></i> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
      <i className="ri-time-line text-xs"></i> Requested
    </span>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function PasswordResetTable({ events }: Props) {
  return (
    <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1a2b4a] flex items-center justify-between">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center bg-amber-500/10 rounded-lg">
            <i className="ri-key-2-line text-amber-400 text-sm"></i>
          </div>
          Password Reset History
        </h2>
        <span className="text-xs text-slate-500">Last 50 events</span>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <i className="ri-key-2-line text-4xl mb-2"></i>
          <p className="text-sm">No password reset activity recorded yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0a1628] border-b border-[#1a2b4a]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Admin</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Stage</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Details</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a2b4a]">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-[#0a1628] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 flex items-center justify-center bg-amber-500/10 rounded-full flex-shrink-0">
                        <i className="ri-user-line text-amber-400 text-xs"></i>
                      </div>
                      <div>
                        <p className="font-medium text-slate-200 text-xs">{event.admin_name || event.admin_username || '—'}</p>
                        <p className="text-slate-500 text-xs">{event.admin_username || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ResetStatusBadge type={event.action_type} />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-slate-400 max-w-[160px] truncate" title={event.action_description}>
                      {event.action_description || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-xs text-slate-300" suppressHydrationWarning>{timeAgo(event.created_at)}</p>
                      <p className="text-xs text-slate-500" suppressHydrationWarning>
                        {new Date(event.created_at).toLocaleString()}
                      </p>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}