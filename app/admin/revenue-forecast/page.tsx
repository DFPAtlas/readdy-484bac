'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface ForecastData {
  current_mrr: number;
  annual_recurring_revenue: number;
  active_subscriptions: number;
  average_subscription_value: number;
  new_mrr: number;
  new_count: number;
  churned_mrr: number;
  churned_count: number;
  net_upgrade_mrr: number;
  growth_rate: number;
  churn_rate: number;
  currency: string;
}

interface PlanBreakdownItem {
  plan_name: string;
  count: number;
  mrr: number;
  percentage: number;
}

function formatCurrency(amount: number, currency: string): string {
  const symbol = currency === 'gbp' ? '£' : currency === 'usd' ? '$' : currency === 'eur' ? '€' : '£';
  return `${symbol}${amount.toFixed(2)}`;
}

function formatCurrencyShort(currency: string): string {
  if (currency === 'gbp') return '£';
  if (currency === 'usd') return '$';
  if (currency === 'eur') return '€';
  return '£';
}

export default function RevenueForecast() {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [breakdown, setBreakdown] = useState<PlanBreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'30' | '60' | '90'>('30');
  const [exporting, setExporting] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchForecastData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('get_revenue_forecast');

      if (rpcError) throw rpcError;
      if (!data) throw new Error('No data returned from server');

      if (!mountedRef.current) return;

      const fc: ForecastData = {
        current_mrr: data.current_mrr ?? 0,
        annual_recurring_revenue: data.annual_recurring_revenue ?? 0,
        active_subscriptions: data.active_subscriptions ?? 0,
        average_subscription_value: data.average_subscription_value ?? 0,
        new_mrr: data.new_mrr ?? 0,
        new_count: data.new_count ?? 0,
        churned_mrr: data.churned_mrr ?? 0,
        churned_count: data.churned_count ?? 0,
        net_upgrade_mrr: data.net_upgrade_mrr ?? 0,
        growth_rate: data.growth_rate ?? 0,
        churn_rate: data.churn_rate ?? 0,
        currency: data.currency ?? 'gbp',
      };

      setForecast(fc);
      setBreakdown(data.plan_breakdown ?? []);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to load forecast data';
      setError(message);
      console.error('Error fetching forecast:', err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchForecastData();
  }, [fetchForecastData]);

  const getProjectedValue = () => {
    if (!forecast) return 0;
    const rate = forecast.growth_rate / 100;
    const months = timeRange === '30' ? 1 : timeRange === '60' ? 2 : 3;
    let projected = forecast.current_mrr;
    for (let i = 0; i < months; i++) {
      projected = projected * (1 + rate);
    }
    return projected;
  };

  const handleExportCSV = () => {
    if (!forecast) return;
    setExporting(true);

    const currencySymbol = formatCurrencyShort(forecast.currency);
    const rows: string[] = [];
    rows.push('Metric,Value');
    rows.push(`Current MRR,${currencySymbol}${forecast.current_mrr.toFixed(2)}`);
    rows.push(`Annual Recurring Revenue,${currencySymbol}${forecast.annual_recurring_revenue.toFixed(2)}`);
    rows.push(`Active Subscriptions,${forecast.active_subscriptions}`);
    rows.push(`Average Subscription Value,${currencySymbol}${forecast.average_subscription_value.toFixed(2)}`);
    rows.push(`New MRR (30d),${currencySymbol}${forecast.new_mrr.toFixed(2)}`);
    rows.push(`New Subscriptions (30d),${forecast.new_count}`);
    rows.push(`Churned MRR (30d),${currencySymbol}${forecast.churned_mrr.toFixed(2)}`);
    rows.push(`Churned Subscriptions (30d),${forecast.churned_count}`);
    rows.push(`Net Upgrade MRR (30d),${currencySymbol}${forecast.net_upgrade_mrr.toFixed(2)}`);
    rows.push(`Growth Rate,${forecast.growth_rate.toFixed(1)}%`);
    rows.push(`Churn Rate,${forecast.churn_rate.toFixed(1)}%`);
    rows.push(`30-Day Projection,${currencySymbol}${forecast.current_mrr * (1 + forecast.growth_rate / 100)}`);
    rows.push(`60-Day Projection,${currencySymbol}${forecast.current_mrr * Math.pow(1 + forecast.growth_rate / 100, 2)}`);
    rows.push(`90-Day Projection,${currencySymbol}${forecast.current_mrr * Math.pow(1 + forecast.growth_rate / 100, 3)}`);
    rows.push('');
    rows.push('Plan Breakdown');
    rows.push('Plan Name,Clients,MRR,Percentage');
    breakdown.forEach((item) => {
      rows.push(`"${item.plan_name}",${item.count},${currencySymbol}${item.mrr.toFixed(2)},${item.percentage.toFixed(1)}%`);
    });

    const bom = '\uFEFF';
    const csv = bom + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-forecast-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading forecast data...</p>
        </div>
      </div>
    );
  }

  if (error && !forecast) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-error-warning-line text-3xl text-red-400"></i>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Failed to Load Data</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <button
            onClick={fetchForecastData}
            className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors flex items-center gap-2 mx-auto whitespace-nowrap text-sm"
          >
            <i className="ri-refresh-line"></i>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const safe = forecast!;
  const currencySymbol = formatCurrencyShort(safe.currency);

  return (
    <div className="min-h-screen bg-[#0a0f1c]">
      <div className="bg-[#111d35]/80 border-b border-[#1e2d4a] backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin/dashboard"
                className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-lg transition-colors"
              >
                <i className="ri-arrow-left-line text-xl text-slate-300"></i>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white">Revenue Forecast</h1>
                <p className="text-sm text-slate-400">
                  Subscription revenue projections and analytics
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className="px-4 py-2 bg-[#0a1628] text-slate-300 rounded-lg hover:bg-[#152238] transition-colors flex items-center gap-2 whitespace-nowrap text-sm border border-[#1e2d4a] cursor-pointer"
              >
                <i className={`${exporting ? 'ri-loader-4-line animate-spin' : 'ri-download-line'}`}></i>
                {exporting ? 'Exporting...' : 'Export CSV'}
              </button>
              <button
                onClick={fetchForecastData}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors flex items-center gap-2 whitespace-nowrap text-sm cursor-pointer"
              >
                <i className="ri-refresh-line"></i>
                Refresh Data
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#1e2d4a]">
            <Link
              href="/admin/subscription-tracking"
              className="text-xs text-slate-400 hover:text-teal-400 transition-colors flex items-center gap-1"
            >
              <i className="ri-dashboard-line"></i>
              Subscription Tracking
            </Link>
            <Link
              href="/admin/subscription-analytics"
              className="text-xs text-slate-400 hover:text-teal-400 transition-colors flex items-center gap-1"
            >
              <i className="ri-bar-chart-line"></i>
              Analytics
            </Link>
            <Link
              href="/admin/subscription-management"
              className="text-xs text-slate-400 hover:text-teal-400 transition-colors flex items-center gap-1"
            >
              <i className="ri-settings-3-line"></i>
              Subscription Management
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ri-error-warning-line text-red-400"></i>
              </div>
              <div>
                <p className="text-sm font-medium text-red-300">Data fetch failed</p>
                <p className="text-xs text-red-400/70">{error}</p>
              </div>
            </div>
            <button
              onClick={fetchForecastData}
              className="px-4 py-2 bg-red-600/30 text-red-300 rounded-lg hover:bg-red-600/50 transition-colors flex items-center gap-2 whitespace-nowrap text-sm cursor-pointer"
            >
              <i className="ri-refresh-line"></i>
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#111d35] rounded-xl p-6 border border-[#1e2d4a]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Current MRR</span>
              <div className="w-10 h-10 bg-teal-500/15 rounded-lg flex items-center justify-center">
                <i className="ri-money-pound-circle-line text-xl text-teal-400"></i>
              </div>
            </div>
            <div className="text-3xl font-bold text-white">
              {formatCurrency(safe.current_mrr, safe.currency)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Monthly Recurring Revenue</p>
          </div>

          <div className="bg-[#111d35] rounded-xl p-6 border border-[#1e2d4a]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Annual ARR</span>
              <div className="w-10 h-10 bg-blue-500/15 rounded-lg flex items-center justify-center">
                <i className="ri-line-chart-line text-xl text-blue-400"></i>
              </div>
            </div>
            <div className="text-3xl font-bold text-white">
              {formatCurrency(safe.annual_recurring_revenue, safe.currency)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Annual Recurring Revenue</p>
          </div>

          <div className="bg-[#111d35] rounded-xl p-6 border border-[#1e2d4a]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Active Subscriptions</span>
              <div className="w-10 h-10 bg-green-500/15 rounded-lg flex items-center justify-center">
                <i className="ri-user-star-line text-xl text-green-400"></i>
              </div>
            </div>
            <div className="text-3xl font-bold text-white">
              {safe.active_subscriptions}
            </div>
            <p className="text-xs text-slate-500 mt-1">Total active clients</p>
          </div>

          <div className="bg-[#111d35] rounded-xl p-6 border border-[#1e2d4a]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Avg Subscription</span>
              <div className="w-10 h-10 bg-purple-500/15 rounded-lg flex items-center justify-center">
                <i className="ri-calculator-line text-xl text-purple-400"></i>
              </div>
            </div>
            <div className="text-3xl font-bold text-white">
              {formatCurrency(safe.average_subscription_value, safe.currency)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Per subscription/month</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-[#111d35] rounded-xl p-6 border border-[#1e2d4a]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Revenue Projection</h2>
              <div className="flex gap-1 bg-[#0a1628] rounded-lg p-1">
                <button
                  onClick={() => setTimeRange('30')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    timeRange === '30'
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  30 Days
                </button>
                <button
                  onClick={() => setTimeRange('60')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    timeRange === '60'
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  60 Days
                </button>
                <button
                  onClick={() => setTimeRange('90')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    timeRange === '90'
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  90 Days
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Current MRR</span>
                  <span className="text-lg font-bold text-white">
                    {formatCurrency(safe.current_mrr, safe.currency)}
                  </span>
                </div>
                <div className="h-3 bg-[#0a1628] rounded-full overflow-hidden">
                  <div className="h-full bg-slate-500" style={{ width: '100%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">
                    Projected MRR ({timeRange} days)
                  </span>
                  <span className="text-lg font-bold text-teal-400">
                    {formatCurrency(getProjectedValue(), safe.currency)}
                  </span>
                </div>
                <div className="h-3 bg-[#0a1628] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-600 to-teal-400"
                    style={{
                      width: `${Math.min(
                        (getProjectedValue() / (safe.current_mrr || 1)) * 100,
                        100
                      )}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#1e2d4a]">
                <div>
                  <div className="text-sm text-slate-400 mb-1">Growth Rate</div>
                  <div
                    className={`text-2xl font-bold ${
                      safe.growth_rate >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {safe.growth_rate >= 0 ? '+' : ''}
                    {safe.growth_rate.toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    New {currencySymbol}{safe.new_mrr.toFixed(2)} · Churned {currencySymbol}{safe.churned_mrr.toFixed(2)}
                    {safe.net_upgrade_mrr !== 0 ? ` · Net upgrade ${currencySymbol}${safe.net_upgrade_mrr.toFixed(2)}` : ''}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-400 mb-1">Churn Rate</div>
                  <div className="text-2xl font-bold text-orange-400">
                    {safe.churn_rate.toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {safe.churned_count} cancelled in 30 days
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="ri-information-line text-white"></i>
                  </div>
                  <div>
                    <div className="font-medium text-blue-300 mb-1">Forecast Methodology</div>
                    <p className="text-sm text-blue-200/70 leading-relaxed">
                      Projections are based on current MRR, 30-day net growth rate (new MRR minus churned
                      MRR plus upgrade/downgrade net), compounded monthly. Churn tracks subscriptions
                      cancelled in the last 30 days regardless of when they were created. Actual results
                      may vary based on market conditions and business performance.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#111d35] rounded-xl p-6 border border-[#1e2d4a]">
            <h2 className="text-lg font-bold text-white mb-6">Subscription Breakdown</h2>
            {breakdown.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <i className="ri-pie-chart-line text-2xl text-slate-500"></i>
                </div>
                <p className="text-sm text-slate-500">No active subscriptions</p>
              </div>
            ) : (
              <div className="space-y-4">
                {breakdown.map((item, index) => (
                  <div
                    key={index}
                    className="border-b border-[#1e2d4a] pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-white">{item.plan_name}</span>
                      <span className="text-sm text-slate-400">{item.count} clients</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">
                        {formatCurrency(item.mrr, safe.currency)}/mo
                      </span>
                      <span className="text-sm font-medium text-teal-400">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-[#0a1628] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500"
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#111d35] rounded-xl p-6 border border-[#1e2d4a]">
          <h2 className="text-lg font-bold text-white mb-6">Key Metrics Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border-l-4 border-teal-500 pl-4">
              <div className="text-sm text-slate-400 mb-1">30-Day Projection</div>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(safe.current_mrr * (1 + safe.growth_rate / 100), safe.currency)}
              </div>
              <div className="text-xs text-teal-400 mt-1">
                {safe.growth_rate >= 0 ? '+' : ''}
                {formatCurrency(safe.current_mrr * (safe.growth_rate / 100), safe.currency)} increase
              </div>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <div className="text-sm text-slate-400 mb-1">60-Day Projection</div>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(safe.current_mrr * Math.pow(1 + safe.growth_rate / 100, 2), safe.currency)}
              </div>
              <div className="text-xs text-blue-400 mt-1">
                {safe.growth_rate >= 0 ? '+' : ''}
                {formatCurrency(safe.current_mrr * Math.pow(1 + safe.growth_rate / 100, 2) - safe.current_mrr, safe.currency)} increase
              </div>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <div className="text-sm text-slate-400 mb-1">90-Day Projection</div>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(safe.current_mrr * Math.pow(1 + safe.growth_rate / 100, 3), safe.currency)}
              </div>
              <div className="text-xs text-purple-400 mt-1">
                {safe.growth_rate >= 0 ? '+' : ''}
                {formatCurrency(safe.current_mrr * Math.pow(1 + safe.growth_rate / 100, 3) - safe.current_mrr, safe.currency)} increase
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}