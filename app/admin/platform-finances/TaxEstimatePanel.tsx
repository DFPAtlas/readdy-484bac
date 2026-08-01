'use client';

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

interface Props {
  grossRevenue: number;
  netRevenue: number;
  vatEstimate: number;
  runningCosts: number;
  estimatedProfit: number;
}

export default function TaxEstimatePanel({
  grossRevenue,
  netRevenue,
  vatEstimate,
  runningCosts,
  estimatedProfit,
}: Props) {
  const rows = [
    { label: 'Gross Revenue', value: grossRevenue, color: 'text-white' },
    { label: 'Net Revenue (after Stripe fees)', value: netRevenue, color: 'text-white' },
    { label: 'VAT Estimate (20%)', value: vatEstimate, color: 'text-amber-400' },
    { label: 'Running Costs', value: runningCosts, color: 'text-red-400' },
    { label: 'Estimated Profit', value: estimatedProfit, color: estimatedProfit >= 0 ? 'text-teal-400' : 'text-red-400' },
  ];

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4a] shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1e2d4a]">
        <h3 className="text-sm font-bold text-white">UK Tax Estimate</h3>
        <p className="text-xs text-slate-400 mt-0.5">Current period calculations</p>
      </div>
      <div className="px-6 py-4 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <span className="text-sm text-slate-400">{r.label}</span>
            <span className={`text-sm font-bold ${r.color}`}>{formatCurrency(r.value)}</span>
          </div>
        ))}
      </div>
      <div className="px-6 py-3 bg-amber-400/5 border-t border-amber-400/20">
        <div className="flex items-start gap-2">
          <div className="w-4 h-4 flex items-center justify-center text-amber-400 mt-0.5">
            <i className="ri-error-warning-line text-xs"></i>
          </div>
          <p className="text-xs text-amber-300/80 leading-relaxed">
            For estimation purposes only. Consult your accountant for official tax filings.
          </p>
        </div>
      </div>
    </div>
  );
}