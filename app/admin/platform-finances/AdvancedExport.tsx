'use client';

import { useState, useRef, useEffect } from 'react';

interface Payment {
  id: string;
  date: string;
  customer: string;
  email: string;
  plan: string;
  amount: number;
  stripe_fee: number;
  net_amount: number;
  status: string;
  invoice_id: string;
}

interface Cost {
  id: string;
  service_name: string;
  category: string;
  monthly_cost: number;
  supplier: string;
  billing_date: string;
  notes: string;
}

interface MonthlyData {
  month: string;
  revenue: number;
  costs: number;
  profit: number;
  stripe_fees: number;
  vat: number;
  subscriptions: number;
  trials: number;
  paid: number;
  new_guards: number;
  new_clients: number;
  cancelled: number;
  conversionRate: number;
}

interface Props {
  payments: Payment[];
  costs: Cost[];
  monthlyData: MonthlyData[];
  dateRange: string;
}

export default function AdvancedExport({ payments, costs, monthlyData, dateRange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const download = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const exportRevenueReport = () => {
    const headers = 'Date,Customer,Email,Plan,Amount,Stripe Fee,Net Amount,Status,Invoice ID\n';
    const rows = payments
      .map((p) => {
        const date = new Date(p.date).toLocaleDateString('en-GB');
        const customer = `"${(p.customer || '').replace(/"/g, '""')}"`;
        const email = `"${(p.email || '').replace(/"/g, '""')}"`;
        const plan = `"${(p.plan || '').replace(/"/g, '""')}"`;
        return `${date},${customer},${email},${plan},${p.amount},${p.stripe_fee},${p.net_amount},${p.status},${p.invoice_id}`;
      })
      .join('\n');
    download(
      `quickguard-revenue-report-${dateRange}.csv`,
      headers + rows,
      'text/csv'
    );
  };

  const exportCostReport = () => {
    const headers = 'Service,Category,Monthly Cost,Supplier,Billing Date,Notes\n';
    const rows = costs
      .map((c) => {
        const service = `"${(c.service_name || '').replace(/"/g, '""')}"`;
        const category = `"${(c.category || '').replace(/"/g, '""')}"`;
        const supplier = `"${(c.supplier || '').replace(/"/g, '""')}"`;
        const notes = `"${(c.notes || '').replace(/"/g, '""')}"`;
        const date = new Date(c.billing_date).toLocaleDateString('en-GB');
        return `${service},${category},${c.monthly_cost},${supplier},${date},${notes}`;
      })
      .join('\n');
    download(
      `quickguard-cost-report-${dateRange}.csv`,
      headers + rows,
      'text/csv'
    );
  };

  const exportTaxReport = () => {
    const headers = 'Month,Gross Revenue,Stripe Fees,Net Revenue,VAT Estimate (20%),Running Costs,Estimated Profit\n';
    const rows = monthlyData
      .map((m) => {
        return `${m.month},${m.revenue},${m.stripe_fees},${m.revenue - m.stripe_fees},${m.vat},${m.costs},${m.profit}`;
      })
      .join('\n');
    download(
      `quickguard-tax-report-${dateRange}.csv`,
      headers + rows,
      'text/csv'
    );
  };

  const exportSubscriptionReport = () => {
    const headers = 'Month,Total Subscriptions,Trial Accounts,Paid Accounts,New Guards,New Clients,Cancelled\n';
    const rows = monthlyData
      .map((m) => {
        return `${m.month},${m.subscriptions},${m.trials},${m.paid},${m.new_guards},${m.new_clients},${m.cancelled}`;
      })
      .join('\n');
    download(
      `quickguard-subscription-report-${dateRange}.csv`,
      headers + rows,
      'text/csv'
    );
  };

  const printReport = () => {
    window.print();
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 border border-[#1e2d4a] rounded-xl text-sm font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
      >
        <div className="w-4 h-4 flex items-center justify-center">
          <i className="ri-download-line"></i>
        </div>
        Export Reports
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-[#111d35] rounded-xl shadow-lg border border-[#1e2d4a] py-2 z-10">
          <button
            onClick={exportRevenueReport}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-[#1a2b4a] cursor-pointer flex items-center gap-2"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-money-pound-circle-line"></i>
            </div>
            Revenue Report
          </button>
          <button
            onClick={exportCostReport}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-[#1a2b4a] cursor-pointer flex items-center gap-2"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-price-tag-3-line"></i>
            </div>
            Cost Report
          </button>
          <button
            onClick={exportTaxReport}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-[#1a2b4a] cursor-pointer flex items-center gap-2"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-government-line"></i>
            </div>
            Tax Report
          </button>
          <button
            onClick={exportSubscriptionReport}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-[#1a2b4a] cursor-pointer flex items-center gap-2"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-vip-crown-line"></i>
            </div>
            Subscription Report
          </button>
          <div className="border-t border-[#1e2d4a] my-1"></div>
          <button
            onClick={printReport}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-[#1a2b4a] cursor-pointer flex items-center gap-2"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-printer-line"></i>
            </div>
            Print Report
          </button>
        </div>
      )}
    </div>
  );
}