'use client';

  import { useState, useEffect, useMemo } from 'react';
  import Link from 'next/link';
  import { supabase } from '@/lib/supabase';
  import PortalSidebar from '@/components/PortalSidebar';
  import Footer from '@/components/Footer';
  import EarningsSummaryCards from './EarningsSummaryCards';
  import EarningsChart from './EarningsChart';
  import PayoutTable from './PayoutTable';
  import PayoutDetailModal from './PayoutDetailModal';
  import PayoutHistoryTable from './PayoutHistoryTable';
  import PayoutReceiptModal from './PayoutReceiptModal';
  import LiveIndicator from '@/components/LiveIndicator';
  import { useRouteGuard } from '@/hooks/useRouteGuard';
  import UpgradePrompt from '@/components/UpgradePrompt';

  export default function GuardEarningsPage() {
    const [earnings, setEarnings] = useState<any[]>([]);
    const [payouts, setPayouts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'processing' | 'paid' | 'held'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEarning, setSelectedEarning] = useState<any>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [sidebarInfo, setSidebarInfo] = useState({ displayName: 'Guard', subtitle: 'Free', initials: 'GU' });
    const [viewMode, setViewMode] = useState<'earnings' | 'history'>('earnings');
    const [selectedPayout, setSelectedPayout] = useState<any>(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const { checking, blocked } = useRouteGuard();
    const authLoading = false;
    const allowed = true;

    useEffect(() => {
      fetchGuardAndEarnings();

      const channels: any[] = [];

      const assignmentsChannel = supabase
        .channel('earnings-assignments')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_assignments' }, () => {
          fetchGuardAndEarnings();
        })
        .subscribe();
      channels.push(assignmentsChannel);

      const payoutsChannel = supabase
        .channel('earnings-payouts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'guard_payouts' }, () => {
          fetchGuardAndEarnings();
        })
        .subscribe();
      channels.push(payoutsChannel);

      return () => {
        channels.forEach(ch => supabase.removeChannel(ch));
      };
    }, []);

    const fetchGuardAndEarnings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: guard } = await supabase
          .from('guards')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (guard) {
          const [assignmentsRes, payoutsRes] = await Promise.all([
            supabase
              .from('job_assignments')
              .select(
                `*, jobs (job_title, location, start_date, end_date, shift_start_time, shift_end_time, hourly_rate, clients (company_name, contact_name))`
              )
              .eq('guard_id', guard.id)
              .order('created_at', { ascending: false }),
            supabase
              .from('guard_payouts')
              .select('*')
              .eq('guard_id', guard.id)
              .order('created_at', { ascending: false })
          ]);

          setEarnings(assignmentsRes.data || []);
          setPayouts(payoutsRes.data || []);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    };

    const calculateEarnings = (assignment: any) => {
      if (assignment.payment_amount) return parseFloat(assignment.payment_amount);
      if (assignment.jobs) {
        const s = new Date(`2000-01-01 ${assignment.jobs.shift_start_time}`);
        const e = new Date(`2000-01-01 ${assignment.jobs.shift_end_time}`);
        const hours = (e.getTime() - s.getTime()) / (1000 * 60 * 60);
        return assignment.jobs.hourly_rate * Math.max(hours, 0);
      }
      return 0;
    };

    const payoutsMap = useMemo(() => {
      const map: Record<string, any> = {};
      payouts.forEach(p => {
        if (p.assignment_id) map[p.assignment_id] = p;
      });
      return map;
    }, [payouts]);

    const getEffectiveStatus = (earning: any) => {
      const payout = payoutsMap[earning.id];
      if (payout) return payout.status;
      return earning.payment_status || 'pending';
    };

    const filteredEarnings = useMemo(() => {
      let filtered = earnings.filter(e => {
        const status = getEffectiveStatus(e);
        const matchesTab =
          activeTab === 'all' ||
          (activeTab === 'paid' && (status === 'paid' || status === 'completed')) ||
          (activeTab === 'pending' && status === 'pending') ||
          (activeTab === 'processing' && (status === 'processing' || status === 'initiated')) ||
          (activeTab === 'held' && (status === 'held' || status === 'failed'));
        const matchesSearch =
          e.jobs?.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.jobs?.clients?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.jobs?.location?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesTab && matchesSearch;
      });

      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'oldest':
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          case 'highest':
            return calculateEarnings(b) - calculateEarnings(a);
          case 'lowest':
            return calculateEarnings(a) - calculateEarnings(b);
          default:
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      });

      return filtered;
    }, [earnings, activeTab, searchTerm, sortBy, payoutsMap]);

    const filteredPayouts = useMemo(() => {
      let filtered = [...payouts];
      if (searchTerm) {
        filtered = filtered.filter(p =>
          p.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.payout_method?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.status?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'oldest':
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          case 'highest':
            return (b.amount || 0) - (a.amount || 0);
          case 'lowest':
            return (a.amount || 0) - (b.amount || 0);
          default:
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      });
      return filtered;
    }, [payouts, searchTerm, sortBy]);

    const totalEarned = earnings
      .filter(e => {
        const s = getEffectiveStatus(e);
        return s === 'paid' || s === 'completed';
      })
      .reduce((sum, e) => sum + calculateEarnings(e), 0);
    const pendingPayouts = earnings
      .filter(e => getEffectiveStatus(e) === 'pending')
      .reduce((sum, e) => sum + calculateEarnings(e), 0);
    const processingPayouts = earnings
      .filter(e => {
        const s = getEffectiveStatus(e);
        return s === 'processing' || s === 'initiated';
      })
      .reduce((sum, e) => sum + calculateEarnings(e), 0);
    const heldPayouts = earnings
      .filter(e => {
        const s = getEffectiveStatus(e);
        return s === 'held' || s === 'failed';
      })
      .reduce((sum, e) => sum + calculateEarnings(e), 0);

    const paidCount = earnings.filter(e => {
      const s = getEffectiveStatus(e);
      return s === 'paid' || s === 'completed';
    }).length;
    const pendingCount = earnings.filter(e => getEffectiveStatus(e) === 'pending').length;
    const processingCount = earnings.filter(e => {
      const s = getEffectiveStatus(e);
      return s === 'processing' || s === 'initiated';
    }).length;
    const heldCount = earnings.filter(e => {
      const s = getEffectiveStatus(e);
      return s === 'held' || s === 'failed';
    }).length;

    const totalNetPaid = payouts
      .filter(p => p.status === 'completed' || p.status === 'paid')
      .reduce((sum, p) => sum + (p.net_amount || 0), 0);
    const totalFees = payouts
      .filter(p => p.status === 'completed' || p.status === 'paid')
      .reduce((sum, p) => sum + (p.fee_deducted || 0), 0);
    const totalGross = payouts
      .filter(p => p.status === 'completed' || p.status === 'paid')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const completedPayoutCount = payouts.filter(p => p.status === 'completed' || p.status === 'paid').length;

    const monthlyData = useMemo(() => {
      const months: { month: string; earned: number; pending: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const label = d.toLocaleDateString('en-GB', { month: 'short' });
        const year = d.getFullYear();
        const month = d.getMonth();
        let earned = 0;
        let pending = 0;
        earnings.forEach(e => {
          const jobDate = new Date(e.jobs?.start_date || e.created_at);
          if (jobDate.getFullYear() === year && jobDate.getMonth() === month) {
            const amt = calculateEarnings(e);
            const s = getEffectiveStatus(e);
            if (s === 'paid' || s === 'completed') earned += amt;
            else pending += amt;
          }
        });
        months.push({ month: label, earned, pending });
      }
      return months;
    }, [earnings, payoutsMap]);

    const handleExport = () => {
      const headers = ['Job Title', 'Client', 'Date', 'Amount', 'Status', 'Reference'];
      const rows = filteredEarnings.map(e => {
        const payout = payoutsMap[e.id];
        return [
          e.jobs?.job_title || '',
          e.jobs?.clients?.company_name || '',
          e.jobs?.start_date || '',
          calculateEarnings(e).toFixed(2),
          getEffectiveStatus(e),
          payout?.reference_number ||
            `PO-${(e.id || '').toString().slice(0, 8).toUpperCase()}`
        ];
      });
      const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `earnings-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

    const handleExportPayouts = () => {
      const headers = ['Reference', 'Date', 'Gross Amount', 'Fee', 'Net Amount', 'Status', 'Method'];
      const rows = filteredPayouts.map(p => [
        p.reference_number || `P-${(p.id || '').toString().slice(0, 8).toUpperCase()}`,
        p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB') : '',
        (p.amount || 0).toFixed(2),
        (p.fee_deducted || 0).toFixed(2),
        (p.net_amount || 0).toFixed(2),
        p.status,
        p.payout_method || 'bank'
      ]);
      const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payout-history-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

    useEffect(() => {
      async function loadSidebarInfo() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: guard } = await supabase
          .from('guards')
          .select('full_name, verification_status')
          .eq('user_id', user.id)
          .maybeSingle();
        if (guard) {
          setSidebarInfo({
            displayName: guard.full_name || 'Guard',
            subtitle: guard.verification_status === 'approved' ? 'Verified' : 'Guard',
            initials: (guard.full_name || 'Guard').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
          });
        }
      }
      loadSidebarInfo();
    }, []);

    if (loading || authLoading || !allowed || checking) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 dark:text-slate-400">Loading earnings...</p>
          </div>
        </div>
      );
    }

    if (blocked) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex items-center justify-center px-6">
          <div className="w-full max-w-lg">
            <UpgradePrompt feature="guard.performance_analytics" />
          </div>
        </div>
      );
    }

    const tabs = [
      { key: 'all', label: 'All Payouts', count: earnings.length },
      { key: 'pending', label: 'Pending', count: pendingCount },
      { key: 'processing', label: 'Processing', count: processingCount },
      { key: 'paid', label: 'Paid', count: paidCount },
      { key: 'held', label: 'On Hold', count: heldCount }
    ];

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933]">
        <div className="flex">
          <PortalSidebar
            role="guard"
            displayName={sidebarInfo.displayName}
            subtitle={sidebarInfo.subtitle}
            initials={sidebarInfo.initials}
            accentColor="emerald"
          />
          <div className="flex-1 ml-72 min-h-screen pt-8 pb-12 px-6">
            <div className="max-w-7xl mx-auto px-6">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <Link
                    href="/guard/dashboard"
                    className="text-teal-500 dark:text-teal-400 hover:text-teal-600 dark:hover:text-teal-300 font-medium mb-4 inline-flex items-center cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-arrow-left-line mr-2"></i>Back to Dashboard
                  </Link>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-3">Earnings &amp; Payouts</h1>
                  <p className="text-slate-500 dark:text-slate-400 mt-1">Track your job payments and payout status</p>
                </div>
                <div className="mt-8">
                  <LiveIndicator />
                </div>
                <div className="mt-8 flex items-center gap-3">
                  <Link
                    href="/guard/bank-settings"
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#111d35] border border-[#1e2d4d] rounded-lg text-sm font-medium text-slate-300 hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-bank-line"></i>Bank Settings
                  </Link>
                  <button
                    onClick={viewMode === 'earnings' ? handleExport : handleExportPayouts}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#111d35] border border-[#1e2d4d] rounded-lg text-sm font-medium text-slate-300 hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-download-line"></i>Export CSV
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-1 mb-6 inline-flex">
                <button
                  onClick={() => setViewMode('earnings')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    viewMode === 'earnings'
                      ? 'bg-teal-500 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <i className="ri-briefcase-line mr-1.5"></i>Job Earnings
                </button>
                <button
                  onClick={() => setViewMode('history')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    viewMode === 'history'
                      ? 'bg-teal-500 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <i className="ri-receipt-line mr-1.5"></i>Payout History
                  {payouts.length > 0 && (
                    <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-white/20">
                      {payouts.length}
                    </span>
                  )}
                </button>
              </div>

              {viewMode === 'earnings' ? (
                <>
                  <EarningsSummaryCards
                    totalEarned={totalEarned}
                    pendingPayouts={pendingPayouts}
                    processingPayouts={processingPayouts}
                    heldPayouts={heldPayouts}
                    paidCount={paidCount}
                    pendingCount={pendingCount}
                    processingCount={processingCount}
                    heldCount={heldCount}
                  />

                  <EarningsChart monthlyData={monthlyData} />

                  <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4 mb-6">
                    <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                      <div className="flex gap-1 bg-slate-50 dark:bg-[#0B1933] rounded-lg p-1">
                        {tabs.map(tab => (
                          <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                              activeTab === tab.key
                                ? 'bg-white dark:bg-[#162036] text-teal-500 dark:text-teal-400 shadow-sm border border-slate-200 dark:border-[#1e2d4d]'
                                : 'text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white'
                            }`}
                          >
                            {tab.label}
                            {tab.count > 0 && (
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded-full ${
                                  activeTab === tab.key ? 'bg-teal-50 dark:bg-teal-500/15 text-teal-500 dark:text-teal-400 border border-teal-200 dark:border-teal-500/25' : 'bg-slate-100 dark:bg-[#162036] text-slate-400 dark:text-slate-500'
                                }`}
                              >
                                {tab.count}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-3 w-full lg:w-auto">
                        <div className="relative flex-1 lg:w-64">
                          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
                          <input
                            type="text"
                            placeholder="Search jobs, clients..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </div>
                        <div className="relative">
                          <button
                            onClick={() => setShowSortDropdown(!showSortDropdown)}
                            className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#162036] cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-sort-desc"></i>Sort
                          </button>
                          {showSortDropdown && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-[#111d35] rounded-lg shadow-lg border border-slate-200 dark:border-[#1e2d4d] py-1 z-20">
                              {[
                                { key: 'newest', label: 'Newest First' },
                                { key: 'oldest', label: 'Oldest First' },
                                { key: 'highest', label: 'Highest Amount' },
                                { key: 'lowest', label: 'Lowest Amount' }
                              ].map(opt => (
                                <button
                                  key={opt.key}
                                  onClick={() => {
                                    setSortBy(opt.key as any);
                                    setShowSortDropdown(false);
                                  }}
                                  className={`w-full text-left px-4 py-2 text-sm cursor-pointer ${
                                    sortBy === opt.key ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-500 dark:text-teal-400 font-medium' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#162036]'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <PayoutTable
                    earnings={filteredEarnings}
                    payoutsMap={payoutsMap}
                    calculateEarnings={calculateEarnings}
                    onViewDetails={earning => {
                      setSelectedEarning(earning);
                      setShowDetailModal(true);
                    }}
                  />

                  {filteredEarnings.length > 0 && (
                    <div className="mt-4 text-center text-sm text-slate-500">
                      Showing {filteredEarnings.length} of {earnings.length} payouts
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-[#111d35] rounded-xl p-6 border border-[#1e2d4d] relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full -translate-y-8 translate-x-8" />
                      <div className="relative">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 flex items-center justify-center bg-emerald-500/15 rounded-lg">
                            <i className="ri-check-double-line text-xl text-emerald-400" />
                          </div>
                          <span className="text-sm font-medium text-slate-400">Total Net Received</span>
                        </div>
                        <div className="text-3xl font-bold text-white">£{totalNetPaid.toFixed(2)}</div>
                        <p className="text-xs text-slate-500 mt-1">
                          {completedPayoutCount} completed payout{completedPayoutCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="bg-[#111d35] rounded-xl p-6 border border-[#1e2d4d] relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/10 rounded-full -translate-y-8 translate-x-8" />
                      <div className="relative">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 flex items-center justify-center bg-teal-500/15 rounded-lg">
                            <i className="ri-funds-box-line text-xl text-teal-400" />
                          </div>
                          <span className="text-sm font-medium text-slate-400">Total Gross</span>
                        </div>
                        <div className="text-3xl font-bold text-white">£{totalGross.toFixed(2)}</div>
                        <p className="text-xs text-slate-500 mt-1">Before fees</p>
                      </div>
                    </div>

                    <div className="bg-[#111d35] rounded-xl p-6 border border-[#1e2d4d] relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full -translate-y-8 translate-x-8" />
                      <div className="relative">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 flex items-center justify-center bg-red-500/15 rounded-lg">
                            <i className="ri-percent-line text-xl text-red-400" />
                          </div>
                          <span className="text-sm font-medium text-slate-400">Total Fees</span>
                        </div>
                        <div className="text-3xl font-bold text-white">£{totalFees.toFixed(2)}</div>
                        <p className="text-xs text-slate-500 mt-1">Platform fees deducted</p>
                      </div>
                    </div>

                    <div className="bg-[#111d35] rounded-xl p-6 border border-[#1e2d4d] relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -translate-y-8 translate-x-8" />
                      <div className="relative">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 flex items-center justify-center bg-blue-500/15 rounded-lg">
                            <i className="ri-receipt-line text-xl text-blue-400" />
                          </div>
                          <span className="text-sm font-medium text-slate-400">Avg Payout</span>
                        </div>
                        <div className="text-3xl font-bold text-white">
                          £{completedPayoutCount > 0 ? (totalNetPaid / completedPayoutCount).toFixed(2) : '0.00'}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Per completed payout</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4 mb-6">
                    <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 flex items-center justify-center bg-teal-50 dark:bg-teal-500/15 rounded-lg">
                          <i className="ri-receipt-line text-xl text-teal-500 dark:text-teal-400"></i>
                        </div>
                        <div>
                          <h2 className="font-semibold text-slate-900 dark:text-white">Payout Receipts</h2>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Detailed breakdown of every payout</p>
                        </div>
                      </div>
                      <div className="flex gap-3 w-full lg:w-auto">
                        <div className="relative flex-1 lg:w-64">
                          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
                          <input
                            type="text"
                            placeholder="Search reference, status..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </div>
                        <div className="relative">
                          <button
                            onClick={() => setShowSortDropdown(!showSortDropdown)}
                            className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#162036] cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-sort-desc"></i>Sort
                          </button>
                          {showSortDropdown && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-[#111d35] rounded-lg shadow-lg border border-slate-200 dark:border-[#1e2d4d] py-1 z-20">
                              {[
                                { key: 'newest', label: 'Newest First' },
                                { key: 'oldest', label: 'Oldest First' },
                                { key: 'highest', label: 'Highest Amount' },
                                { key: 'lowest', label: 'Lowest Amount' }
                              ].map(opt => (
                                <button
                                  key={opt.key}
                                  onClick={() => {
                                    setSortBy(opt.key as any);
                                    setShowSortDropdown(false);
                                  }}
                                  className={`w-full text-left px-4 py-2 text-sm cursor-pointer ${
                                    sortBy === opt.key ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-500 dark:text-teal-400 font-medium' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#162036]'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <PayoutHistoryTable
                    payouts={filteredPayouts}
                    onViewReceipt={payout => {
                      setSelectedPayout(payout);
                      setShowReceiptModal(true);
                    }}
                  />

                  {filteredPayouts.length > 0 && (
                    <div className="mt-4 text-center text-sm text-slate-500">
                      Showing {filteredPayouts.length} of {payouts.length} payout receipts
                    </div>
                  )}
                </>
              )}

              <div className="mt-8 bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 flex items-center justify-center bg-teal-50 dark:bg-teal-500/15 rounded-lg flex-shrink-0">
                    <i className="ri-information-line text-xl text-teal-500 dark:text-teal-400"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">How Payouts Work</h3>
                    <ul className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
                      <li className="flex items-center gap-2">
                        <i className="ri-check-line text-teal-400"></i>Payouts are initiated once the client completes payment for the job
                      </li>
                      <li className="flex items-center gap-2">
                        <i className="ri-check-line text-teal-400"></i>Processing typically takes 3-5 business days via bank transfer
                      </li>
                      <li className="flex items-center gap-2">
                        <i className="ri-check-line text-teal-400"></i>A small platform fee is deducted from each payout
                      </li>
                      <li className="flex items-center gap-2">
                        <i className="ri-check-line text-teal-400"></i>Contact support if a payout is on hold or has failed
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {showDetailModal && selectedEarning && (
            <PayoutDetailModal
              earning={selectedEarning}
              payout={payoutsMap[selectedEarning.id] || null}
              onClose={() => setShowDetailModal(false)}
              calculateEarnings={calculateEarnings}
            />
          )}

          {showReceiptModal && selectedPayout && (
            <PayoutReceiptModal
              payout={selectedPayout}
              onClose={() => setShowReceiptModal(false)}
            />
          )}
        </div>

        <Footer />
      </div>
    );
  }