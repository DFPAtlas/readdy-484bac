'use client';

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useClientGuard } from '@/hooks/useClientGuard';
import { useRouteGuard } from '@/hooks/useRouteGuard';
import UpgradePrompt from '@/components/UpgradePrompt';
import PortalSidebar from '@/components/PortalSidebar';
import LiveIndicator from '@/components/LiveIndicator';
import ErrorState from '@/app/client/components/ErrorState';
import JobHistoryReport from './JobHistoryReport';
import FinanceReport from './FinanceReport';
import AttendanceReport from './AttendanceReport';
import ComplianceReport from './ComplianceReport';
import SupportReport from './SupportReport';

export interface ReportRange {
  from: string;
  to: string;
}

export interface ReportData {
  jobs: any[];
  transactions: any[];
  subscriptionPayments: any[];
  complaints: any[];
  jobAssignments: any[];
  guards: any[];
  client: any;
}

const REPORT_CATEGORIES = [
  {
    key: 'job_history',
    label: 'Job History',
    description: 'All jobs posted, dates, guards, status, and cost.',
    icon: 'ri-briefcase-4-line',
    color: 'from-teal-500/20 to-teal-600/20',
    iconColor: 'text-teal-400',
    borderColor: 'border-teal-500/25',
  },
  {
    key: 'guard_attendance',
    label: 'Guard Attendance',
    description: 'Shift schedules, check-in/check-out, and attendance status.',
    icon: 'ri-time-line',
    color: 'from-blue-500/20 to-indigo-600/20',
    iconColor: 'text-blue-400',
    borderColor: 'border-blue-500/25',
  },
  {
    key: 'finance',
    label: 'Payments & Invoices',
    description: 'Invoices, payment status, receipts, and VAT.',
    icon: 'ri-bill-line',
    color: 'from-violet-500/20 to-pink-600/20',
    iconColor: 'text-violet-400',
    borderColor: 'border-violet-500/25',
  },
  {
    key: 'compliance',
    label: 'Compliance Summary',
    description: 'Guard compliance, SIA status, and licence warnings.',
    icon: 'ri-shield-check-line',
    color: 'from-emerald-500/20 to-emerald-600/20',
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/25',
  },
  {
    key: 'support',
    label: 'Support & Disputes',
    description: 'Complaints, tickets, and resolution records.',
    icon: 'ri-customer-service-2-line',
    color: 'from-orange-500/20 to-red-600/20',
    iconColor: 'text-orange-400',
    borderColor: 'border-orange-500/25',
  },
] as const;

export default function ClientReportsPage() {
  const { loading: authLoading, allowed } = useClientGuard();
  const { checking, blocked } = useRouteGuard();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('Client');
  const [subscriptionTier, setSubscriptionTier] = useState('Free');
  const [initials, setInitials] = useState('CL');
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [reportRange, setReportRange] = useState<ReportRange>({
    from: '',
    to: '',
  });
  const [reportData, setReportData] = useState<ReportData>({
    jobs: [],
    transactions: [],
    subscriptionPayments: [],
    complaints: [],
    jobAssignments: [],
    guards: [],
    client: null,
  });
  const [toast, setToast] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: client } = await supabase
        .from('clients')
        .select('id, company_name, subscription_tier, contact_name, email, phone, address, city, postcode, vat_number')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!client) return;
      setClientId(client.id);
      setCompanyName(client.company_name || 'Client');
      setSubscriptionTier(client.subscription_tier || 'Free');
      const parts = (client.company_name || 'Client').trim().split(' ');
      setInitials(parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : (client.company_name || 'Client').slice(0, 2).toUpperCase());

      const { data: jobs } = await supabase
        .from('jobs')
        .select('*, job_assignments(id, status, assigned_at, completed_at, payment_status, payment_amount, guards(id, full_name, sia_licence_number, sia_expiry_date, sia_verified, licence_types))')
        .eq('client_id', client.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      const { data: subscriptionPayments } = await supabase
        .from('subscription_payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const { data: complaints } = await supabase
        .from('complaints')
        .select('*')
        .eq('filed_by_id', user.id)
        .eq('filed_by_type', 'client')
        .order('created_at', { ascending: false });

      const { data: assignments } = await supabase
        .from('job_assignments')
        .select('id, job_id, guard_id, status, assigned_at, completed_at, payment_status, payment_amount, guards(id, full_name, sia_licence_number, sia_expiry_date, sia_verified, licence_types, rating)')
        .in('job_id', (jobs || []).map(j => j.id));

      const { data: guards } = await supabase
        .from('guards')
        .select('id, full_name, sia_licence_number, sia_expiry_date, sia_verified, licence_types, rating, total_reviews, years_experience, is_active, verification_status')
        .in('id', [...new Set((assignments || []).map(a => a.guard_id).filter(Boolean))]);

      setReportData({
        jobs: jobs || [],
        transactions: transactions || [],
        subscriptionPayments: subscriptionPayments || [],
        complaints: complaints || [],
        jobAssignments: assignments || [],
        guards: guards || [],
        client,
      });
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setReportRange({ from: thirtyDaysAgo, to: today });
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const filteredJobs = reportData.jobs.filter(j => {
    if (!reportRange.from && !reportRange.to) return true;
    const d = j.start_date || j.created_at;
    if (reportRange.from && d < reportRange.from) return false;
    if (reportRange.to && d > reportRange.to) return false;
    return true;
  });

  const filteredTransactions = reportData.transactions.filter(t => {
    if (!reportRange.from && !reportRange.to) return true;
    const d = t.created_at?.slice(0, 10);
    if (reportRange.from && d < reportRange.from) return false;
    if (reportRange.to && d > reportRange.to) return false;
    return true;
  });

  const filteredComplaints = reportData.complaints.filter(c => {
    if (!reportRange.from && !reportRange.to) return true;
    const d = c.created_at?.slice(0, 10);
    if (reportRange.from && d < reportRange.from) return false;
    if (reportRange.to && d > reportRange.to) return false;
    return true;
  });

  const stats = {
    totalJobs: reportData.jobs.length,
    completedJobs: reportData.jobs.filter(j => j.status === 'completed').length,
    totalSpent: reportData.transactions.filter(t => t.status === 'completed').reduce((s, t) => s + (Number(t.amount) || 0), 0),
    totalSubscriptionSpent: reportData.subscriptionPayments.filter(p => p.status === 'succeeded').reduce((s, p) => s + (Number(p.amount) || 0), 0),
    openComplaints: reportData.complaints.filter(c => c.status === 'open').length,
    compliantGuards: reportData.guards.filter(g => g.sia_verified && g.sia_expiry_date && new Date(g.sia_expiry_date) > new Date()).length,
    expiringGuards: reportData.guards.filter(g => {
      if (!g.sia_expiry_date) return false;
      const days = (new Date(g.sia_expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return days <= 30 && days > 0;
    }).length,
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar
          role="client"
          displayName={companyName || 'Client'}
          subtitle={subscriptionTier || 'Free'}
          initials={initials}
        />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-lg">
            <div className="bg-[#111d35] rounded-2xl border border-red-500/20 shadow-sm p-10 md:p-16 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <i className="ri-error-warning-line text-4xl text-red-400"></i>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Failed to load reports</h3>
              <p className="text-slate-500 text-sm mb-6">We could not load your report data. Please check your connection and try again.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={loadData}
                  className="inline-flex items-center gap-2 bg-[#162036] text-teal-400 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]"
                >
                  <i className="ri-refresh-line"></i>
                  Retry
                </button>
                <Link
                  href="/client/support"
                  className="inline-flex items-center gap-2 bg-red-500/10 text-red-400 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-red-500/20 transition-colors cursor-pointer whitespace-nowrap border border-red-500/25"
                >
                  <i className="ri-customer-service-2-line"></i>
                  Contact Support
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading || authLoading || !allowed || checking) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar role="client" displayName="Client" subtitle="Free" initials="CL" />
        <div className="flex-1 min-h-screen flex flex-col pb-20 lg:pb-0">
          {/* Header Skeleton */}
          <header className="bg-[#111d35] border-b border-[#1e2d4d] px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-20">
            <div className="space-y-1">
              <div className="h-3 w-28 bg-[#162036] rounded animate-pulse"></div>
              <div className="h-7 sm:h-8 w-40 sm:w-48 bg-[#162036] rounded animate-pulse"></div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="h-8 sm:h-9 w-24 sm:w-32 bg-[#162036] rounded-xl animate-pulse"></div>
              <div className="h-8 sm:h-9 w-32 sm:w-36 bg-teal-500/20 rounded-xl animate-pulse"></div>
            </div>
          </header>

          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
            {/* Stats Bar Skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#162036] rounded-lg flex items-center justify-center flex-shrink-0 animate-pulse"></div>
                  <div className="space-y-1">
                    <div className="h-5 sm:h-6 w-10 sm:w-12 bg-[#162036] rounded animate-pulse"></div>
                    <div className="h-2 w-14 sm:w-16 bg-[#162036] rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Date Range Filter Skeleton */}
            <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-3 sm:p-4 mb-4 sm:mb-6 flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <div className="h-4 w-24 bg-[#162036] rounded animate-pulse"></div>
              <div className="flex flex-col sm:flex-row gap-2 flex-1">
                <div className="flex-1 h-9 bg-[#162036] rounded-lg animate-pulse"></div>
                <div className="h-4 w-4 bg-[#162036] rounded animate-pulse self-center"></div>
                <div className="flex-1 h-9 bg-[#162036] rounded-lg animate-pulse"></div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 sm:h-9 w-24 sm:w-28 bg-[#162036] rounded-lg animate-pulse"></div>
                <div className="h-8 sm:h-9 w-20 sm:w-24 bg-[#162036] rounded-lg animate-pulse"></div>
                <div className="h-8 sm:h-9 w-28 sm:w-32 bg-teal-500/20 rounded-lg animate-pulse"></div>
              </div>
            </div>

            {/* Report Category Cards Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 sm:p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#162036] rounded-xl animate-pulse"></div>
                    <div className="h-5 w-16 bg-[#162036] rounded-lg animate-pulse"></div>
                  </div>
                  <div className="h-5 sm:h-6 w-32 sm:w-40 bg-[#162036] rounded animate-pulse mb-1"></div>
                  <div className="h-3 w-full sm:w-3/4 bg-[#162036] rounded animate-pulse mb-4"></div>
                  <div className="h-4 w-24 bg-[#162036] rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar
          role="client"
          displayName={companyName || 'Client'}
          subtitle={subscriptionTier || 'Free'}
          initials={initials}
        />
        <div className="flex-1 min-h-screen flex items-center justify-center px-6">
          <div className="w-full max-w-lg">
            <UpgradePrompt feature="client.analytics_dashboard" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="client"
        displayName={companyName || 'Client'}
        subtitle={subscriptionTier || 'Free'}
        initials={initials}
      />

      <div className="flex-1 min-h-screen flex flex-col pb-20 lg:pb-0">
        <header className="bg-[#111d35] border-b border-[#1e2d4d] px-6 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-20">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Client Portal</p>
            <h1 className="text-xl font-bold text-white">Reports & Exports</h1>
          </div>
          <div className="flex items-center gap-3">
            <LiveIndicator />
            <Link
              href="/client/dashboard"
              className="flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-dashboard-line"></i>
              Dashboard
            </Link>
          </div>
        </header>

        <main className="flex-1 px-6 lg:px-8 py-8">
          {/* Stats overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Jobs', value: stats.totalJobs, icon: 'ri-briefcase-4-line', color: 'text-teal-400' },
              { label: 'Completed', value: stats.completedJobs, icon: 'ri-checkbox-circle-line', color: 'text-emerald-400' },
              { label: 'Job Spend', value: `£${stats.totalSpent.toFixed(2)}`, icon: 'ri-bill-line', color: 'text-violet-400' },
              { label: 'Subscription', value: `£${stats.totalSubscriptionSpent.toFixed(2)}`, icon: 'ri-vip-crown-line', color: 'text-blue-400' },
              { label: 'Open Disputes', value: stats.openComplaints, icon: 'ri-error-warning-line', color: 'text-orange-400' },
              { label: 'Compliant Guards', value: stats.compliantGuards, icon: 'ri-shield-check-line', color: 'text-emerald-400' },
              { label: 'SIA Expiring', value: stats.expiringGuards, icon: 'ri-timer-flash-line', color: 'text-amber-400' },
              { label: 'Grand Total', value: `£${(stats.totalSpent + stats.totalSubscriptionSpent).toFixed(2)}`, icon: 'ri-money-pound-circle-line', color: 'text-teal-400' },
            ].map((s) => (
              <div key={s.label} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-[#162036] rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className={`${s.icon} text-lg ${s.color}`}></i>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-200">{s.value}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Date Range Filter */}
          <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 mb-6 flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
              <i className="ri-calendar-line text-lg"></i>
              Date Range
            </div>
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <input
                type="date"
                value={reportRange.from}
                onChange={(e) => setReportRange(prev => ({ ...prev, from: e.target.value }))}
                className="flex-1 px-3 py-2 bg-[#162036] border border-[#1e2d4d] rounded-lg text-sm text-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
              <span className="text-slate-500 self-center">to</span>
              <input
                type="date"
                value={reportRange.to}
                onChange={(e) => setReportRange(prev => ({ ...prev, to: e.target.value }))}
                className="flex-1 px-3 py-2 bg-[#162036] border border-[#1e2d4d] rounded-lg text-sm text-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setReportRange({ from: thirtyDaysAgo, to: today })}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  reportRange.from === thirtyDaysAgo && reportRange.to === today
                    ? 'bg-teal-500 text-white'
                    : 'bg-[#162036] text-slate-400 border border-[#1e2d4d] hover:text-slate-300'
                }`}
              >
                Last 30 Days
              </button>
              <button
                onClick={() => setReportRange({ from: '', to: '' })}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-[#162036] text-slate-400 border border-[#1e2d4d] hover:text-slate-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                All Time
              </button>
              <Link
                href="/client/profile?tab=data"
                className="px-3 py-2 rounded-lg text-sm font-medium bg-[#162036] text-teal-400 border border-teal-500/30 hover:bg-teal-500/10 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
              >
                <i className="ri-download-cloud-line"></i>
                Export Data
              </Link>
            </div>
          </div>

          {/* Report Cards or Active Report */}
          {!activeReport ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {REPORT_CATEGORIES.map((cat) => {
                const count = cat.key === 'job_history' ? filteredJobs.length
                  : cat.key === 'finance' ? filteredTransactions.length + reportData.subscriptionPayments.length
                  : cat.key === 'support' ? filteredComplaints.length
                  : cat.key === 'compliance' ? reportData.guards.length
                  : cat.key === 'guard_attendance' ? reportData.jobAssignments.length
                  : 0;
                return (
                  <div
                    key={cat.key}
                    className={`bg-gradient-to-br ${cat.color} rounded-xl border ${cat.borderColor} p-6 relative group hover:scale-[1.01] transition-all cursor-pointer`}
                    onClick={() => setActiveReport(cat.key)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-[#0B1933]/40 rounded-xl flex items-center justify-center">
                        <i className={`${cat.icon} text-2xl ${cat.iconColor}`}></i>
                      </div>
                      <span className="text-xs font-bold text-slate-400 bg-[#0B1933]/40 px-2 py-1 rounded-lg">
                        {count} records
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">{cat.label}</h3>
                    <p className="text-sm text-slate-400 mb-4">{cat.description}</p>
                    <div className="flex items-center gap-2 text-sm font-semibold text-teal-400 group-hover:text-teal-300 transition-colors">
                      <span>View Report</span>
                      <i className="ri-arrow-right-line"></i>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setActiveReport(null)}
                  className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors cursor-pointer"
                >
                  <i className="ri-arrow-left-line"></i>
                  All Reports
                </button>
                <span className="text-slate-600">/</span>
                <span className="text-white font-semibold text-sm">
                  {REPORT_CATEGORIES.find(c => c.key === activeReport)?.label}
                </span>
              </div>

              {activeReport === 'job_history' && (
                <JobHistoryReport
                  jobs={filteredJobs}
                  reportRange={reportRange}
                  onToast={setToast}
                />
              )}
              {activeReport === 'guard_attendance' && (
                <AttendanceReport
                  assignments={reportData.jobAssignments}
                  jobs={reportData.jobs}
                  reportRange={reportRange}
                  onToast={setToast}
                />
              )}
              {activeReport === 'finance' && (
                <FinanceReport
                  transactions={filteredTransactions}
                  subscriptionPayments={reportData.subscriptionPayments}
                  client={reportData.client}
                  reportRange={reportRange}
                  onToast={setToast}
                />
              )}
              {activeReport === 'compliance' && (
                <ComplianceReport
                  guards={reportData.guards}
                  jobs={reportData.jobs}
                  assignments={reportData.jobAssignments}
                  onToast={setToast}
                />
              )}
              {activeReport === 'support' && (
                <SupportReport
                  complaints={filteredComplaints}
                  reportRange={reportRange}
                  onToast={setToast}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {toast && (
        <div className="fixed top-24 right-6 z-50 bg-[#111d35] text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-[#1e2d4d] animate-fade-in">
          <i className="ri-checkbox-circle-fill text-teal-400"></i>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
}