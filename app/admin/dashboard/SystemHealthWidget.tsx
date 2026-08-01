'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vnywjfpkepjgclkbcmsj.supabase.co';

interface HealthData {
  status: string;
  timestamp: string;
  checks: Record<string, { status: string }>;
  metrics: {
    failed_emails_24h: number;
    failed_payments_24h: number;
    unread_admin_alerts: number;
  };
}

export default function SystemHealthWidget() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/system-health`);
        if (!res.ok) throw new Error('Health check failed');
        const data = await res.json();
        setHealth(data);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchHealth();
    const interval = setInterval(fetchHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  const getStatusStyle = (status: string | undefined) => {
    switch (status) {
      case 'healthy': return 'bg-emerald-500';
      case 'degraded': return 'bg-amber-500';
      case 'critical': case 'unhealthy': return 'bg-red-500';
      case 'configured': return 'bg-emerald-500';
      case 'not_configured': return 'bg-slate-500';
      default: return 'bg-slate-500';
    }
  };

  const getOverallStatus = () => {
    if (loading) return { label: 'Checking...', color: 'bg-slate-500', badge: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' };
    if (error || !health) return { label: 'Unknown', color: 'bg-red-500', badge: 'bg-red-500/10 text-red-400 border border-red-500/20' };
    switch (health.status) {
      case 'healthy': return { label: 'Healthy', color: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
      case 'degraded': return { label: 'Warning', color: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' };
      default: return { label: 'Critical', color: 'bg-red-500', badge: 'bg-red-500/10 text-red-400 border border-red-500/20' };
    }
  };

  const overall = getOverallStatus();
  const criticalCount = health && (health.metrics.failed_emails_24h > 0 || health.metrics.failed_payments_24h > 0 || health.metrics.unread_admin_alerts > 0);

  return (
    <Link
      href="/admin/system-status"
      className="block bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5 hover:border-teal-500/30 transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 flex items-center justify-center rounded-xl ${overall.color === 'bg-emerald-500' ? 'bg-emerald-500/10 text-emerald-400' : overall.color === 'bg-amber-500' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
            {loading ? (
              <i className="ri-loader-4-line text-lg animate-spin"></i>
            ) : (
              <i className={`${health?.status === 'healthy' ? 'ri-heart-pulse-line' : health?.status === 'degraded' ? 'ri-error-warning-line' : 'ri-close-circle-line'} text-lg`}></i>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">System Health</h3>
            <p className="text-[11px] text-slate-500 font-medium">Infrastructure status</p>
          </div>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${overall.badge}`}>
          {overall.label}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {['database', 'stripe', 'email'].map(service => {
          const check = health?.checks?.[service];
          const color = getStatusStyle(check?.status);
          return (
            <div key={service} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${color}`}></div>
              <span className="text-[10px] font-medium text-slate-400 capitalize">{service}</span>
            </div>
          );
        })}
        {criticalCount && (
          <span className="ml-auto text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">
            {health && health.metrics.unread_admin_alerts > 0 && `${health.metrics.unread_admin_alerts} alerts`}
            {health && health.metrics.failed_emails_24h > 0 && ` ${health.metrics.failed_emails_24h} email fails`}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-slate-600 font-medium">
          {health ? `Checked ${new Date(health.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
        </span>
        <span className="text-[11px] text-teal-400 font-medium group-hover:underline whitespace-nowrap">
          View Details
        </span>
      </div>
    </Link>
  );
}