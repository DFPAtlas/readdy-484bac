'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MonthlyTrend {
  month: string;
  jobs: number;
  spend: number;
}

interface JobStatusBreakdown {
  status: string;
  count: number;
  color: string;
  icon: string;
}

interface TopVenue {
  venue: string;
  count: number;
}

interface AnalyticsData {
  monthlyTrends: MonthlyTrend[];
  statusBreakdown: JobStatusBreakdown[];
  topVenues: TopVenue[];
  totalJobs: number;
  totalSpend: number;
  avgFillTimeHours: number;
  completionRate: number;
  avgGuardsPerJob: number;
  repeatVenueRate: number;
}

interface AnalyticsWidgetProps {
  clientId: string;
}

function getLast6Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1]} '${y.slice(2)}`;
}

function formatCurrency(v: number): string {
  if (v >= 1000) return `£${(v / 1000).toFixed(1)}k`;
  return `£${v.toFixed(0)}`;
}

const STATUS_CONFIG: Record<string, { color: string; icon: string }> = {
  completed: { color: '#10B981', icon: 'ri-checkbox-circle-line' },
  active: { color: '#3B82F6', icon: 'ri-play-circle-line' },
  in_progress: { color: '#F59E0B', icon: 'ri-loader-4-line' },
  open: { color: '#06B6D4', icon: 'ri-briefcase-line' },
  payment_pending: { color: '#8B5CF6', icon: 'ri-money-pound-circle-line' },
  awaiting_payment: { color: '#8B5CF6', icon: 'ri-time-line' },
  draft: { color: '#6B7280', icon: 'ri-draft-line' },
  cancelled: { color: '#EF4444', icon: 'ri-close-circle-line' },
};

export default function AnalyticsWidget({ clientId }: AnalyticsWidgetProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const loadAnalytics = useCallback(async () => {
    if (!clientId) return;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const fromDate = sixMonthsAgo.toISOString().slice(0, 10);

    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, job_title, venue, venue_city, status, created_at, agreed_amount, number_of_guards, assigned_count')
      .eq('client_id', clientId)
      .eq('is_deleted', false)
      .gte('created_at', fromDate)
      .order('created_at', { ascending: false });

    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, created_at, status')
      .eq('client_id', clientId)
      .eq('status', 'completed')
      .gte('created_at', fromDate);

    const { data: oldJobs } = await supabase
      .from('jobs')
      .select('venue')
      .eq('client_id', clientId)
      .eq('is_deleted', false);

    const jobsList = jobs || [];
    const txList = transactions || [];
    const allVenues = (oldJobs || []).map(j => j.venue).filter(Boolean);

    const months = getLast6Months();
    const monthlyTrends: MonthlyTrend[] = months.map(ym => {
      const monthJobs = jobsList.filter(j => (j.created_at || '').startsWith(ym));
      const monthTx = txList.filter(t => (t.created_at || '').startsWith(ym));
      return {
        month: formatMonthLabel(ym),
        jobs: monthJobs.length,
        spend: monthTx.reduce((s, t) => s + (Number(t.amount) || 0), 0),
      };
    });

    const statusCounts: Record<string, number> = {};
    jobsList.forEach(j => {
      const s = j.status || 'unknown';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    const statusBreakdown: JobStatusBreakdown[] = Object.entries(statusCounts)
      .map(([status, count]) => ({
        status,
        count,
        color: STATUS_CONFIG[status]?.color || '#6B7280',
        icon: STATUS_CONFIG[status]?.icon || 'ri-question-line',
      }))
      .sort((a, b) => b.count - a.count);

    const venueCounts: Record<string, number> = {};
    allVenues.forEach(v => { venueCounts[v] = (venueCounts[v] || 0) + 1; });
    const topVenues: TopVenue[] = Object.entries(venueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([venue, count]) => ({ venue, count }));

    const completed = jobsList.filter(j => j.status === 'completed').length;
    const completionRate = jobsList.length > 0 ? Math.round((completed / jobsList.length) * 100) : 0;

    const totalSpend = txList.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const totalGuards = jobsList.reduce((s, j) => s + (j.assigned_count || 0), 0);
    const avgGuardsPerJob = jobsList.length > 0 ? (totalGuards / jobsList.length).toFixed(1) : '0';

    const uniqueVenues = new Set(allVenues);
    const multiJobVenues = Object.values(venueCounts).filter(c => c > 1).length;
    const repeatVenueRate = uniqueVenues.size > 0 ? Math.round((multiJobVenues / uniqueVenues.size) * 100) : 0;

    setData({
      monthlyTrends,
      statusBreakdown,
      topVenues,
      totalJobs: jobsList.length,
      totalSpend,
      avgFillTimeHours: 0,
      completionRate,
      avgGuardsPerJob: Number(avgGuardsPerJob),
      repeatVenueRate,
    });
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
        <div className="h-5 bg-[#162036] rounded w-40 mb-6 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-[#162036] rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-[#162036] rounded-xl animate-pulse" />
          <div className="h-64 bg-[#162036] rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data || data.totalJobs === 0) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center bg-violet-500/15 rounded-lg">
              <i className="ri-bar-chart-grouped-line text-violet-400 text-sm"></i>
            </div>
            <h2 className="text-base font-semibold text-white">Analytics</h2>
          </div>
        </div>
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-[#162036] rounded-xl flex items-center justify-center mx-auto mb-3">
            <i className="ri-bar-chart-grouped-line text-2xl text-slate-600"></i>
          </div>
          <p className="text-sm text-slate-400 mb-1">No analytics data yet</p>
          <p className="text-xs text-slate-500 mb-4">Analytics will appear once you start posting jobs</p>
          <Link
            href="/client/post-job"
            className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            Post Your First Job
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm">
      <div className="flex items-center justify-between p-6 pb-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center bg-violet-500/15 rounded-lg">
            <i className="ri-bar-chart-grouped-line text-violet-400 text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-white">Analytics</h2>
          <span className="text-xs text-slate-500 bg-[#162036] px-2 py-0.5 rounded-full">Last 6 months</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/client/reports"
            className="text-xs text-violet-400 hover:text-violet-300 font-semibold cursor-pointer whitespace-nowrap"
          >
            Full Reports
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer rounded-lg hover:bg-[#162036]"
          >
            <i className={`text-sm ${collapsed ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line'}`}></i>
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-6 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Jobs', value: data.totalJobs, icon: 'ri-briefcase-line', color: 'text-teal-400', bg: 'bg-teal-500/15' },
              { label: 'Total Spend', value: formatCurrency(data.totalSpend), icon: 'ri-money-pound-circle-line', color: 'text-violet-400', bg: 'bg-violet-500/15' },
              { label: 'Completion Rate', value: `${data.completionRate}%`, icon: 'ri-checkbox-circle-line', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
              { label: 'Avg Guards/Job', value: data.avgGuardsPerJob, icon: 'ri-team-line', color: 'text-blue-400', bg: 'bg-blue-500/15' },
            ].map(m => (
              <div key={m.label} className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-3">
                <div className={`w-8 h-8 ${m.bg} rounded-lg flex items-center justify-center mb-2`}>
                  <i className={`${m.icon} text-sm ${m.color}`}></i>
                </div>
                <p className="text-lg font-bold text-white">{m.value}</p>
                <p className="text-[10px] text-slate-500 font-medium">{m.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <i className="ri-line-chart-line text-violet-400"></i>
                Job Postings
              </h3>
              <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data.monthlyTrends} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="jobsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4d" />
                    <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={{ stroke: '#1e2d4d' }} tickLine={false} />
                    <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111d35', border: '1px solid #1e2d4d', borderRadius: '12px', color: '#e2e8f0', fontSize: '12px' }}
                      labelStyle={{ color: '#94a3b8', fontWeight: 600 }}
                    />
                    <Area type="monotone" dataKey="jobs" stroke="#8B5CF6" strokeWidth={2} fill="url(#jobsGradient)" dot={{ fill: '#8B5CF6', r: 3 }} activeDot={{ fill: '#8B5CF6', r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <i className="ri-money-pound-circle-line text-violet-400"></i>
                Total Spend
              </h3>
              <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data.monthlyTrends} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4d" />
                    <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={{ stroke: '#1e2d4d' }} tickLine={false} />
                    <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `£${(v / 1000).toFixed(0)}k` : `£${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111d35', border: '1px solid #1e2d4d', borderRadius: '12px', color: '#e2e8f0', fontSize: '12px' }}
                      labelStyle={{ color: '#94a3b8', fontWeight: 600 }}
                      formatter={(value: number) => [`£${value.toFixed(2)}`, 'Spend']}
                    />
                    <Area type="monotone" dataKey="spend" stroke="#10B981" strokeWidth={2} fill="url(#spendGradient)" dot={{ fill: '#10B981', r: 3 }} activeDot={{ fill: '#10B981', r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <i className="ri-pie-chart-line text-violet-400"></i>
                Job Status Breakdown
              </h3>
              <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
                {data.statusBreakdown.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">No job data available</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.statusBreakdown.map(s => {
                      const total = data.statusBreakdown.reduce((sum, x) => sum + x.count, 0);
                      const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                      return (
                        <div key={s.status} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${s.color}20` }}>
                            <i className={`${s.icon} text-sm`} style={{ color: s.color }}></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-slate-300 capitalize">{s.status.replace(/_/g, ' ')}</span>
                              <span className="text-xs text-slate-500">{s.count} ({pct}%)</span>
                            </div>
                            <div className="h-1.5 bg-[#0B1933] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: s.color }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <i className="ri-building-line text-violet-400"></i>
                Top Venues
              </h3>
              <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
                {data.topVenues.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">No venue data available</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.topVenues.map((v, i) => {
                      const maxCount = data.topVenues[0]?.count || 1;
                      const pct = Math.round((v.count / maxCount) * 100);
                      return (
                        <div key={v.venue} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-600 w-5 flex-shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-slate-300 truncate">{v.venue}</span>
                              <span className="text-xs text-slate-500 flex-shrink-0 ml-2">{v.count} job{v.count !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="h-1.5 bg-[#0B1933] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-violet-500 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-[#1e2d4d] flex items-center gap-2">
                  <div className="w-6 h-6 bg-violet-500/15 rounded flex items-center justify-center flex-shrink-0">
                    <i className="ri-repeat-line text-violet-400 text-xs"></i>
                  </div>
                  <span className="text-xs text-slate-400">
                    <span className="text-violet-400 font-semibold">{data.repeatVenueRate}%</span> of venues have repeat bookings
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}