'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface PaygMetrics {
  totalPaygClients: number;
  avgJobsPerClient: number;
  avgSpendPerBooking: number;
  churnedClients: number;
  totalServiceFeeRevenue: number;
  bookingsThisMonth: number;
}

interface ServiceFeeByPromo {
  promoName: string;
  count: number;
  totalServiceFee: number;
  avgServiceFee: number;
}

export default function AdminPaygMetricsPage() {
  const [metrics, setMetrics] = useState<PaygMetrics | null>(null);
  const [promoBreakdown, setPromoBreakdown] = useState<ServiceFeeByPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthStartIso = monthStart.toISOString();

      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

      const [
        paygClientsRes,
        paygJobsRes,
        churnRes,
        feeRevenueRes,
        promoFeesRes,
      ] = await Promise.all([
        supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('client_service_tier', 'payg'),
        supabase
          .from('jobs')
          .select('client_id, hourly_rate, number_of_guards')
          .eq('is_deleted', false)
          .gte('created_at', monthStartIso),
        supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('client_service_tier', 'payg')
          .lt('total_jobs_posted', 1)
          .lt('updated_at', sixtyDaysAgo),
        supabase
          .from('transactions')
          .select('amount, metadata')
          .eq('status', 'completed')
          .gte('created_at', monthStartIso),
        supabase
          .from('transactions')
          .select('amount, metadata, created_at')
          .eq('status', 'completed')
          .gte('created_at', monthStartIso)
          .not('metadata', 'is', null),
      ]);

      if (paygClientsRes.error) throw new Error(paygClientsRes.error.message);
      if (paygJobsRes.error) throw new Error(paygJobsRes.error.message);
      if (churnRes.error) throw new Error(churnRes.error.message);
      if (feeRevenueRes.error) throw new Error(feeRevenueRes.error.message);
      if (promoFeesRes.error) throw new Error(promoFeesRes.error.message);

      const totalPaygClients = paygClientsRes.count ?? 0;
      const jobsData = paygJobsRes.data ?? [];
      const avgJobsPerClient = totalPaygClients > 0 ? Math.round((jobsData.length / totalPaygClients) * 10) / 10 : 0;

      const transactions = feeRevenueRes.data ?? [];
      const totalServiceFeeRevenue = transactions.reduce((sum: number, t: any) => {
        const fee = t.metadata?.service_fee ?? 0;
        return sum + (Number(fee) || 0);
      }, 0);

      const avgSpendPerBooking = transactions.length > 0
        ? Math.round((transactions.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0) / transactions.length) * 100) / 100
        : 0;

      const churnedClients = churnRes.count ?? 0;
      const bookingsThisMonth = jobsData.length;

      const promoMap = new Map<string, { count: number; totalServiceFee: number }>();
      const promoTxns = promoFeesRes.data ?? [];
      for (const t of promoTxns) {
        const discount = t.metadata?.discount_pct ?? 0;
        const key = discount > 0 ? `Promo ${discount}% Off` : 'No Promo';
        const existing = promoMap.get(key) || { count: 0, totalServiceFee: 0 };
        existing.count += 1;
        existing.totalServiceFee += Number(t.metadata?.service_fee ?? 0);
        promoMap.set(key, existing);
      }

      const breakdown: ServiceFeeByPromo[] = Array.from(promoMap.entries()).map(([promoName, data]) => ({
        promoName,
        count: data.count,
        totalServiceFee: data.totalServiceFee,
        avgServiceFee: data.count > 0 ? Math.round((data.totalServiceFee / data.count) * 100) / 100 : 0,
      }));

      setMetrics({
        totalPaygClients,
        avgJobsPerClient,
        avgSpendPerBooking,
        churnedClients,
        totalServiceFeeRevenue,
        bookingsThisMonth,
      });
      setPromoBreakdown(breakdown);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to load PAYG metrics');
      showToast('Failed to load PAYG metrics', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (n: number) => '\u00a3' + (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-slate-50">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            <i className={`${toast.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} text-lg`}></i>
            {toast.message}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm shadow-teal-200">
                <i className="ri-money-pound-circle-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">PAYG Metrics</h1>
                <p className="text-xs text-slate-400">Pay-As-You-Go client analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchMetrics}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                <div className="w-5 h-5 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
                Refresh
              </button>
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-teal-200 whitespace-nowrap"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-8">
        {loading ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 font-medium">Loading PAYG metrics...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-10 text-center">
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-red-50 text-red-400 mx-auto mb-4">
              <i className="ri-error-warning-line text-3xl"></i>
            </div>
            <h3 className="text-base font-semibold text-red-600 mb-1">Failed to load metrics</h3>
            <p className="text-sm text-red-400 mb-4">{error}</p>
            <button
              onClick={fetchMetrics}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors cursor-pointer"
            >
              <i className="ri-refresh-line"></i> Retry
            </button>
          </div>
        ) : metrics ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-100 text-teal-600">
                    <i className="ri-user-line text-xl"></i>
                  </div>
                  <span className="text-sm font-medium text-slate-500">PAYG Clients</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{metrics.totalPaygClients.toLocaleString()}</div>
                <p className="text-xs text-slate-400 mt-1">Active on Pay-As-You-Go tier</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                    <i className="ri-briefcase-line text-xl"></i>
                  </div>
                  <span className="text-sm font-medium text-slate-500">Avg Jobs / Client</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{metrics.avgJobsPerClient}</div>
                <p className="text-xs text-slate-400 mt-1">This month</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                    <i className="ri-money-pound-circle-line text-xl"></i>
                  </div>
                  <span className="text-sm font-medium text-slate-500">Avg Spend / Booking</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{formatCurrency(metrics.avgSpendPerBooking)}</div>
                <p className="text-xs text-slate-400 mt-1">Completed transactions this month</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                    <i className="ri-wallet-3-line text-xl"></i>
                  </div>
                  <span className="text-sm font-medium text-slate-500">Service Fee Revenue</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{formatCurrency(metrics.totalServiceFeeRevenue)}</div>
                <p className="text-xs text-slate-400 mt-1">This month from PAYG bookings</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                    <i className="ri-calendar-check-line text-xl"></i>
                  </div>
                  <span className="text-sm font-medium text-slate-500">Bookings This Month</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{metrics.bookingsThisMonth.toLocaleString()}</div>
                <p className="text-xs text-slate-400 mt-1">All PAYG client jobs posted</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-100 text-red-600">
                    <i className="ri-user-unfollow-line text-xl"></i>
                  </div>
                  <span className="text-sm font-medium text-slate-500">Churned (60d)</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{metrics.churnedClients.toLocaleString()}</div>
                <p className="text-xs text-slate-400 mt-1">0 jobs in last 60 days</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-100 text-teal-600">
                  <i className="ri-gift-line text-xl"></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Service Fee Revenue by Promo Tier</h2>
                  <p className="text-xs text-slate-400">How much fee revenue is discounted by active promotions</p>
                </div>
              </div>

              {promoBreakdown.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Promo</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Bookings</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Service Fee</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Fee / Booking</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {promoBreakdown.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3 text-sm font-medium text-slate-900">{p.promoName}</td>
                          <td className="px-6 py-3 text-sm text-slate-700 text-right">{p.count.toLocaleString()}</td>
                          <td className="px-6 py-3 text-sm font-bold text-slate-900 text-right">{formatCurrency(p.totalServiceFee)}</td>
                          <td className="px-6 py-3 text-sm text-slate-700 text-right">{formatCurrency(p.avgServiceFee)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-sm text-slate-500">No completed PAYG transactions this month.</p>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}