'use client';

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Legend, LineChart, Line,
} from 'recharts';

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatShortCurrency(n: number): string {
  if (n >= 1000) return '£' + (n / 1000).toFixed(1) + 'k';
  return '£' + n.toFixed(0);
}

interface MonthlyData {
  month: string;
  revenue: number;
  costs: number;
  profit: number;
  subscriptions: number;
  trials: number;
  paid: number;
  stripe_fees: number;
  vat: number;
  new_guards: number;
  new_clients: number;
  cancelled: number;
  conversionRate: number;
}

interface Props {
  monthlyData: MonthlyData[];
  loading: boolean;
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4a] shadow-sm p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4a] shadow-sm p-5">
      <div className="w-32 h-4 bg-[#1a2b4a] rounded mb-4 animate-pulse"></div>
      <div className="w-full h-64 bg-[#0d1b33] rounded-xl animate-pulse"></div>
    </div>
  );
}

export default function FinanceCharts({ monthlyData, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChart />
        <SkeletonChart />
        <SkeletonChart />
        <SkeletonChart />
        <SkeletonChart />
      </div>
    );
  }

  if (monthlyData.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {['Revenue by Month', 'Costs by Month', 'Profit by Month', 'Subscription Growth', 'Trial to Paid Conversion'].map((t) => (
          <div key={t} className="bg-[#111d35] rounded-2xl border border-[#1e2d4a] shadow-sm p-5">
            <h3 className="text-sm font-bold text-white mb-4">{t}</h3>
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">
              No historical data available
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChartCard title="Revenue by Month" subtitle="Gross revenue over time">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={formatShortCurrency} />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                contentStyle={{ borderRadius: '12px', border: '1px solid #1e2d4a', fontSize: '13px', backgroundColor: '#111d35', color: '#e2e8f0' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#14b8a6" strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Costs by Month" subtitle="Running costs and Stripe fees">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={formatShortCurrency} />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), '']}
                contentStyle={{ borderRadius: '12px', border: '1px solid #1e2d4a', fontSize: '13px', backgroundColor: '#111d35', color: '#e2e8f0' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
              <Bar dataKey="costs" name="Running Costs" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="stripe_fees" name="Stripe Fees" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Profit by Month" subtitle="Net profit after fees and costs">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={formatShortCurrency} />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Profit']}
                contentStyle={{ borderRadius: '12px', border: '1px solid #1e2d4a', fontSize: '13px', backgroundColor: '#111d35', color: '#e2e8f0' }}
              />
              <Area type="monotone" dataKey="profit" stroke="#6366f1" strokeWidth={2} fill="url(#profGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Subscription Growth" subtitle="Total vs trial vs paid">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #1e2d4a', fontSize: '13px', backgroundColor: '#111d35', color: '#e2e8f0' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
              <Line type="monotone" dataKey="subscriptions" name="Total" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="trials" name="Trials" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="paid" name="Paid" stroke="#14b8a6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Trial to Paid Conversion" subtitle="Paid as % of total new accounts">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Conversion Rate']}
                contentStyle={{ borderRadius: '12px', border: '1px solid #1e2d4a', fontSize: '13px', backgroundColor: '#111d35', color: '#e2e8f0' }}
              />
              <Bar dataKey="conversionRate" name="Conversion Rate" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}