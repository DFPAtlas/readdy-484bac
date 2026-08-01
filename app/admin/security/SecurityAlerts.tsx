'use client';

import { ActivityEntry } from './SecurityDashboardClient';

interface Props {
  loginEvents: ActivityEntry[];
  resetEvents: ActivityEntry[];
}

export default function SecurityAlerts({ loginEvents, resetEvents }: Props) {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const recentFailed = loginEvents.filter(
    (e) => e.action_type === 'login_failed' && new Date(e.created_at) >= oneHourAgo
  );
  const recentResets = resetEvents.filter(
    (e) => e.action_type === 'password_reset_requested' && new Date(e.created_at) >= oneHourAgo
  );

  const alerts = [
    ...recentFailed.map((e) => ({
      id: e.id,
      type: 'danger' as const,
      icon: 'ri-error-warning-fill',
      message: `Failed login attempt for ${e.admin_username || 'unknown'}`,
      time: e.created_at,
    })),
    ...recentResets.map((e) => ({
      id: e.id,
      type: 'warning' as const,
      icon: 'ri-key-2-fill',
      message: `Password reset requested for ${e.admin_username || 'unknown'}`,
      time: e.created_at,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  if (alerts.length === 0) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
        <div className="w-8 h-8 flex items-center justify-center bg-emerald-500/20 rounded-lg flex-shrink-0">
          <i className="ri-shield-check-fill text-emerald-400 text-lg"></i>
        </div>
        <p className="text-sm font-medium text-emerald-300">
          No security alerts in the last hour — all clear.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-5">
      <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <i className="ri-alarm-warning-line text-red-400"></i>
        Recent Security Alerts (last 1 hour)
        <span className="ml-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {alerts.length}
        </span>
      </h2>
      <div className="space-y-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
              alert.type === 'danger'
                ? 'bg-red-500/10 border border-red-500/20'
                : 'bg-amber-500/10 border border-amber-500/20'
            }`}
          >
            <div className={`w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 ${
              alert.type === 'danger' ? 'bg-red-500/20' : 'bg-amber-500/20'
            }`}>
              <i className={`${alert.icon} text-sm ${
                alert.type === 'danger' ? 'text-red-400' : 'text-amber-400'
              }`}></i>
            </div>
            <p className={`text-sm font-medium flex-1 ${
              alert.type === 'danger' ? 'text-red-300' : 'text-amber-300'
            }`}>
              {alert.message}
            </p>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {new Date(alert.time).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}