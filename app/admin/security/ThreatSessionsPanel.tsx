'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SuspiciousActivity, SessionInfo } from './SecuritySOCClient';

interface Props {
  suspiciousActivity: SuspiciousActivity | null;
  activeSessions: SessionInfo[];
  onSessionChange?: () => void;
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === 'high') return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">HIGH</span>;
  if (severity === 'medium') return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">MED</span>;
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">LOW</span>;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <i className="ri-arrow-up-line text-red-400 text-xs"></i>;
  if (trend === 'down') return <i className="ri-arrow-down-line text-emerald-400 text-xs"></i>;
  return <i className="ri-subtract-line text-slate-500 text-xs"></i>;
}

function timeDiff(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export default function ThreatSessionsPanel({ suspiciousActivity, activeSessions, onSessionChange }: Props) {
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingId(sessionId);
    setSessionError(null);
    try {
      const { data, error } = await supabase.functions.invoke('security-dashboard', {
        body: { action: 'revoke_admin_session', session_id: sessionId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      onSessionChange?.();
    } catch (err: any) {
      setSessionError(err.message || 'Failed to revoke session');
      setTimeout(() => setSessionError(null), 5000);
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    setSessionError(null);
    try {
      const { data, error } = await supabase.functions.invoke('security-dashboard', {
        body: { action: 'revoke_all_other_admin_sessions' },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      onSessionChange?.();
    } catch (err: any) {
      setSessionError(err.message || 'Failed to revoke sessions');
      setTimeout(() => setSessionError(null), 5000);
    } finally {
      setRevokingAll(false);
    }
  };
  const sa = suspiciousActivity;

  const suspiciousEvents = sa ? [
    { type: 'Failed Logins', count: sa.failedLogins24h, trend: sa.failedLogins24h > 10 ? 'up' as const : 'steady' as const, icon: 'ri-login-box-line', severity: sa.failedLogins24h > 10 ? 'high' as const : sa.failedLogins24h > 3 ? 'medium' as const : 'low' as const },
    { type: 'Blocked IPs', count: sa.blockedIPs, trend: sa.blockedIPs > 3 ? 'up' as const : 'steady' as const, icon: 'ri-shield-flash-line', severity: sa.blockedIPs > 5 ? 'high' as const : sa.blockedIPs > 1 ? 'medium' as const : 'low' as const },
    { type: 'Rate Limit Hits', count: sa.rateLimitHits, trend: sa.rateLimitHits > 20 ? 'up' as const : 'steady' as const, icon: 'ri-speed-line', severity: sa.rateLimitHits > 20 ? 'high' as const : sa.rateLimitHits > 5 ? 'medium' as const : 'low' as const },
    { type: 'Multi-Country Logins', count: sa.multiCountryLogins, trend: 'steady' as const, icon: 'ri-global-line', severity: sa.multiCountryLogins > 0 ? 'high' as const : 'low' as const },
    { type: 'API Abuse', count: sa.apiAbuse, trend: 'steady' as const, icon: 'ri-terminal-box-line', severity: sa.apiAbuse > 0 ? 'high' as const : 'low' as const },
    { type: 'Password Reset Spikes', count: sa.passwordResetSpikes, trend: sa.passwordResetSpikes > 5 ? 'up' as const : 'steady' as const, icon: 'ri-key-2-line', severity: sa.passwordResetSpikes > 10 ? 'high' as const : sa.passwordResetSpikes > 3 ? 'medium' as const : 'low' as const },
  ] : [
    { type: 'Failed Logins', count: 0, trend: 'steady' as const, icon: 'ri-login-box-line', severity: 'low' as const },
    { type: 'Blocked IPs', count: 0, trend: 'steady' as const, icon: 'ri-shield-flash-line', severity: 'low' as const },
    { type: 'Rate Limit Hits', count: 0, trend: 'steady' as const, icon: 'ri-speed-line', severity: 'low' as const },
    { type: 'Multi-Country Logins', count: 0, trend: 'steady' as const, icon: 'ri-global-line', severity: 'low' as const },
    { type: 'API Abuse', count: 0, trend: 'steady' as const, icon: 'ri-terminal-box-line', severity: 'low' as const },
    { type: 'Password Reset Spikes', count: 0, trend: 'steady' as const, icon: 'ri-key-2-line', severity: 'low' as const },
  ];

  const threatLevel: 'green' | 'amber' | 'red' = suspiciousEvents.filter(e => e.severity === 'high').length > 0 ? 'red' : suspiciousEvents.filter(e => e.severity === 'medium' && e.trend === 'up').length > 1 ? 'amber' : 'green';

  const threatColors = {
    green: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'LOW' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', label: 'ELEVATED' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', label: 'HIGH' },
  };
  const tc = threatColors[threatLevel];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center bg-red-500/10 rounded-lg">
              <i className="ri-alarm-warning-line text-red-400 text-sm"></i>
            </div>
            <h2 className="text-base font-semibold text-white">Suspicious Activity (24h)</h2>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${tc.bg} ${tc.border}`}>
            <span className={`w-2 h-2 rounded-full ${threatLevel === 'green' ? 'bg-emerald-500' : threatLevel === 'amber' ? 'bg-amber-500 animate-pulse' : 'bg-red-500 animate-pulse'}`}></span>
            <span className={`text-xs font-bold ${tc.text}`}>{tc.label}</span>
          </div>
        </div>
        <div className="space-y-2">
          {suspiciousEvents.map((evt) => (
            <div key={evt.type} className="flex items-center justify-between bg-[#0a1628] rounded-lg px-4 py-3 border border-[#1a2b4a]">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${evt.severity === 'high' ? 'bg-red-500/10' : evt.severity === 'medium' ? 'bg-amber-500/10' : 'bg-slate-500/10'}`}>
                  <i className={`${evt.icon} text-sm ${evt.severity === 'high' ? 'text-red-400' : evt.severity === 'medium' ? 'text-amber-400' : 'text-slate-400'}`}></i>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">{evt.type}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <SeverityBadge severity={evt.severity} />
                    <TrendIcon trend={evt.trend} />
                  </div>
                </div>
              </div>
              <span className={`text-lg font-bold ${evt.count > 10 ? 'text-red-400' : evt.count > 3 ? 'text-amber-400' : 'text-slate-300'}`}>{evt.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center bg-purple-500/10 rounded-lg">
              <i className="ri-user-location-line text-purple-400 text-sm"></i>
            </div>
            <h2 className="text-base font-semibold text-white">Active Admin Sessions</h2>
          </div>
          <button
            onClick={handleRevokeAll}
            disabled={revokingAll || activeSessions.length === 0}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap flex items-center gap-1 ${revokingAll || activeSessions.length === 0 ? 'text-slate-500 bg-slate-500/10 border border-slate-500/20 cursor-not-allowed' : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 cursor-pointer'}`}
            title={activeSessions.length === 0 ? 'No active sessions to revoke' : 'Revoke all other admin sessions'}
          >
            {revokingAll ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border border-red-400 border-t-transparent"></div>
                Revoking...
              </>
            ) : (
              <>
                <i className="ri-shut-down-line"></i>End All Others
              </>
            )}
          </button>
        </div>
        {sessionError && (
          <div className="mb-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <i className="ri-error-warning-fill text-red-400 text-sm"></i>
            <p className="text-xs text-red-300">{sessionError}</p>
          </div>
        )}
        {activeSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-500">
            <i className="ri-user-location-line text-3xl mb-2"></i>
            <p className="text-sm">No active admin sessions tracked</p>
            <p className="text-xs text-slate-600 mt-1">Sessions appear here when admins log in with session tracking active</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeSessions.map((s) => (
              <div key={s.id} className={`bg-[#0a1628] rounded-lg border p-4 ${s.status === 'active' ? 'border-emerald-500/20' : 'border-[#1a2b4a]'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 flex items-center justify-center rounded-full ${s.status === 'active' ? 'bg-emerald-500/20' : 'bg-slate-500/20'}`}>
                      <i className={`ri-user-line text-xs ${s.status === 'active' ? 'text-emerald-400' : 'text-slate-400'}`}></i>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-200">{s.admin}</p>
                      <p className="text-[10px] text-slate-500">{s.role}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${s.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                    {s.status === 'active' ? 'Active' : 'Idle'}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-x-3 gap-y-1 text-[10px]">
                  <span className="text-slate-500">Activity: <span className="text-slate-400">{timeDiff(s.lastActivity)}</span></span>
                </div>
                <button
                  onClick={() => handleRevokeSession(s.id)}
                  disabled={revokingId === s.id}
                  className={`mt-2 text-[10px] transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${revokingId === s.id ? 'text-slate-600 cursor-not-allowed' : 'text-red-400/70 hover:text-red-400'}`}
                >
                  {revokingId === s.id ? (
                    <>
                      <div className="animate-spin rounded-full h-2.5 w-2.5 border border-red-400 border-t-transparent"></div>
                      Revoking...
                    </>
                  ) : (
                    <>
                      <i className="ri-close-line"></i>Terminate Session
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}