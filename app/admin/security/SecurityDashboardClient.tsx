'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import SecurityStatsBar from './SecurityStatsBar';
import LoginActivityTable from './LoginActivityTable';
import PasswordResetTable from './PasswordResetTable';
import SecurityAlerts from './SecurityAlerts';

export interface ActivityEntry {
  id: string;
  admin_username: string;
  admin_name: string;
  action_type: string;
  action_description: string;
  ip_address: string;
  metadata: any;
  created_at: string;
  user_agent: string;
}

export default function SecurityDashboardClient() {
  const [loginEvents, setLoginEvents] = useState<ActivityEntry[]>([]);
  const [resetEvents, setResetEvents] = useState<ActivityEntry[]>([]);
  const [stats, setStats] = useState({
    loginsToday: 0,
    failedLogins: 0,
    resetsToday: 0,
    uniqueAdmins: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('security-dashboard', {
        body: { action: 'security_data' },
      });

      if (error) {
        throw new Error(error.message);
      }

      setLoginEvents(data.loginEvents || []);
      setResetEvents(data.resetEvents || []);
      setStats(data.stats || { loginsToday: 0, failedLogins: 0, resetsToday: 0, uniqueAdmins: 0 });
      setLastRefresh(new Date());
    } catch (err: any) {
      console.error('[SecurityDashboard] fetch error:', err.message);
      setStats({ loginsToday: 0, failedLogins: 0, resetsToday: 0, uniqueAdmins: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel('security-dashboard')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'app', table: 'admin_activity_log' },
        () => fetchData()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0B1933]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500 mb-4"></div>
        <p className="text-sm text-slate-400 font-medium">Loading security data...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#0B1933]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Security Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time admin login activity and password reset history
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-teal-500 animate-pulse' : 'bg-slate-500'}`}></span>
            <span suppressHydrationWarning>
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer whitespace-nowrap ${
              autoRefresh
                ? 'bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20'
                : 'bg-[#1a2b4a] border-[#1a2b4a] text-slate-400 hover:bg-[#1e2d4d] hover:text-white'
            }`}
          >
            <i className={`${autoRefresh ? 'ri-pause-line' : 'ri-play-line'} mr-1`}></i>
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#1a2b4a] bg-[#111d35] text-slate-400 hover:bg-[#1a2b4a] hover:text-white transition cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line mr-1"></i>
            Refresh
          </button>
        </div>
      </div>

      <SecurityStatsBar stats={stats} />
      <SecurityAlerts loginEvents={loginEvents} resetEvents={resetEvents} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LoginActivityTable events={loginEvents} />
        <PasswordResetTable events={resetEvents} />
      </div>
    </div>
  );
}
