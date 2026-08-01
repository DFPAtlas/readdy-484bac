'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { supabase } from '@/lib/supabase';
import StatsCards from './StatsCards';
import PaymentOverviewTable from './PaymentOverviewTable';
import PendingReleaseTable from './PendingReleaseTable';
import DisputeAdminPanel from './DisputeAdminPanel';
import StripeWebhookLog from './StripeWebhookLog';
import LiveIndicator from '@/components/LiveIndicator';
import GuardPayoutTable from './GuardPayoutTable';

type TabKey = 'overview' | 'pending' | 'disputes' | 'webhooks' | 'guardPayouts';

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Payment Overview', icon: 'ri-secure-payment-line' },
  { key: 'pending', label: 'Pending Release', icon: 'ri-hourglass-line' },
  { key: 'disputes', label: 'Disputes', icon: 'ri-alert-line' },
  { key: 'webhooks', label: 'Webhook Log', icon: 'ri-plug-line' },
  { key: 'guardPayouts', label: 'Guard Payouts', icon: 'ri-user-star-line' },
];

export default function PaymentsJobsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pathname = usePathname();
  const router = useSafeRouter();

  useEffect(() => {
    async function checkRole() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push('/admin/login');
          return;
        }

        const { data: adminCheck } = await supabase
          .from('admin_users')
          .select('id, role, is_active')
          .eq('user_id', session.user.id)
          .maybeSingle();

        const allowedRoles = ['super_admin', 'finance_admin'];
        if (adminCheck && adminCheck.is_active && allowedRoles.includes(adminCheck.role)) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } catch {
        setIsAuthorized(false);
      } finally {
        setCheckingRole(false);
      }
    }
    checkRole();
  }, [router]);

  const handleRefresh = () => {
    setLastUpdated(new Date());
  };

  if (checkingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B1933]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-teal-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-slate-400 text-sm font-medium">Checking admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 flex items-center justify-center bg-red-500/10 rounded-2xl mx-auto mb-4">
            <i className="ri-shield-keyhole-line text-3xl text-red-400"></i>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-sm text-slate-400 mb-6">
            This page is restricted to Super Admin and Finance Admin roles only.
          </p>
          <button
            onClick={() => router.push('/admin/dashboard')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-left-line"></i>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-900/50">
                <i className="ri-money-pound-circle-line text-xl"></i>
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg font-bold text-white leading-tight tracking-tight">Payments & Jobs</h1>
                  <LiveIndicator />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[11px] text-slate-500 font-medium">
                    {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Live payment data'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => { setLastUpdated(new Date()); handleRefresh(); }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-refresh-line text-base"></i>
                </div>
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-8">
        <StatsCards onRefresh={handleRefresh} lastUpdated={lastUpdated} />

        {/* Tabs */}
        <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.key
                    ? 'bg-teal-500/10 text-teal-400 shadow-sm ring-1 ring-teal-500/20'
                    : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
                }`}
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className={`${tab.icon} text-base`}></i>
                </div>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-6">
          {activeTab === 'overview' && <PaymentOverviewTable />}
          {activeTab === 'pending' && <PendingReleaseTable />}
          {activeTab === 'disputes' && <DisputeAdminPanel />}
          {activeTab === 'webhooks' && <StripeWebhookLog />}
          {activeTab === 'guardPayouts' && <GuardPayoutTable />}
        </div>
      </main>
    </div>
  );
}