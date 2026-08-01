'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ActivityLog {
  id: string;
  admin_username: string;
  admin_name: string | null;
  action_type: string;
  action_description: string;
  target_type: string | null;
  target_name: string | null;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  password_reset: { icon: 'ri-lock-password-line', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  user_created: { icon: 'ri-user-add-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  user_deleted: { icon: 'ri-user-unfollow-line', color: 'text-red-400', bg: 'bg-red-500/10' },
  user_status_changed: { icon: 'ri-user-settings-line', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  login: { icon: 'ri-login-box-line', color: 'text-teal-400', bg: 'bg-teal-500/10' },
  logout: { icon: 'ri-logout-box-line', color: 'text-slate-400', bg: 'bg-slate-500/10' },
  guard_verified: { icon: 'ri-shield-check-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  guard_rejected: { icon: 'ri-shield-cross-line', color: 'text-red-400', bg: 'bg-red-500/10' },
  job_deleted: { icon: 'ri-delete-bin-line', color: 'text-red-400', bg: 'bg-red-500/10' },
  maintenance_toggled: { icon: 'ri-tools-line', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  data_reset: { icon: 'ri-refresh-line', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  default: { icon: 'ri-history-line', color: 'text-slate-400', bg: 'bg-slate-500/10' },
};

export default function RecentActivityLog() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_activity_log')
        .select('*')
        .in('target_type', ['client', 'guard'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getConfig = (type: string) => ACTION_CONFIG[type] || ACTION_CONFIG.default;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-slate-700 animate-pulse"></div>
          <div className="h-4 w-32 bg-slate-700 rounded animate-pulse"></div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-700 animate-pulse flex-shrink-0"></div>
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-slate-700 rounded w-3/4 animate-pulse"></div>
                <div className="h-2.5 bg-slate-700 rounded w-1/2 animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const displayLogs = expanded ? logs : logs.slice(0, 5);

  return (
    <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1a2b4a] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20">
            <i className="ri-history-line text-xl text-violet-400"></i>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Recent Admin Activity</h3>
            <p className="text-xs text-slate-500">{logs.length} account-related actions</p>
          </div>
        </div>
        <button
          onClick={fetchLogs}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#1a2b4a] text-slate-400 hover:bg-[#1a2b4a] hover:text-white transition-colors cursor-pointer"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-refresh-line"></i>
          </div>
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="py-12 text-center">
          <div className="w-12 h-12 flex items-center justify-center bg-[#1a2b4a] rounded-full mx-auto mb-3">
            <i className="ri-history-line text-2xl text-slate-500"></i>
          </div>
          <p className="text-sm font-medium text-slate-400">No recent activity</p>
          <p className="text-xs text-slate-500 mt-1">Account actions will appear here</p>
        </div>
      ) : (
        <div className="divide-y divide-[#1a2b4a]">
          {displayLogs.map((log) => {
            const config = getConfig(log.action_type);
            return (
              <div key={log.id} className="px-5 py-3 hover:bg-[#0f1b30] transition-colors flex items-center gap-3">
                <div className={`w-9 h-9 flex items-center justify-center ${config.bg} rounded-lg flex-shrink-0`}>
                  <div className="w-4.5 h-4.5 flex items-center justify-center">
                    <i className={`${config.icon} ${config.color}`}></i>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{log.action_description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">{log.admin_name || log.admin_username}</span>
                    {log.target_name && (
                      <>
                        <span className="text-slate-600">·</span>
                        <span className="text-xs text-slate-500 truncate">{log.target_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-xs text-slate-600 whitespace-nowrap flex-shrink-0" suppressHydrationWarning={true}>
                  {formatTime(log.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {logs.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-5 py-3 border-t border-[#1a2b4a] text-sm font-medium text-teal-400 hover:bg-teal-500/5 transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          {expanded ? (
            <>
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-arrow-up-s-line"></i>
              </div>
              Show Less
            </>
          ) : (
            <>
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-arrow-down-s-line"></i>
              </div>
              Show All ({logs.length})
            </>
          )}
        </button>
      )}
    </div>
  );
}