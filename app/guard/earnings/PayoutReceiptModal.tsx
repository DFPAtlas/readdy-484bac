import React from 'react';

interface PayoutReceiptModalProps {
  payout: any;
  onClose: () => void;
}

export default function PayoutReceiptModal({ payout, onClose }: PayoutReceiptModalProps) {
  const gross = typeof payout.amount === 'number' ? payout.amount : 0;
  const fee = typeof payout.fee_deducted === 'number' ? payout.fee_deducted : 0;
  const net = typeof payout.net_amount === 'number' ? payout.net_amount : gross - fee;
  const feePercent = gross > 0 ? ((fee / gross) * 100).toFixed(1) : '0.0';
  const reference = payout.reference_number || `P-${(payout.id || '').toString().slice(0, 8).toUpperCase()}`;
  const status = payout.status || 'pending';

  const formatDate = (d: string | null) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'completed':
      case 'paid':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25';
      case 'pending':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/25';
      case 'processing':
      case 'initiated':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/25';
      case 'held':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/25';
      case 'failed':
        return 'bg-red-500/15 text-red-400 border-red-500/25';
      default:
        return 'bg-gray-500/15 text-gray-400 border-gray-500/25';
    }
  };

  const getStatusLabel = (s: string) => {
    switch (s) {
      case 'completed':
      case 'paid':
        return 'COMPLETED';
      case 'initiated':
        return 'INITIATED';
      default:
        return s.toUpperCase();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111d35] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#1e2d4d]">
        <div className="sticky top-0 bg-[#111d35] border-b border-[#1e2d4d] px-8 py-5 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-white">Payout Receipt</h2>
            <p className="text-sm text-slate-500 mt-0.5">Ref: {reference}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#162036] cursor-pointer"
            aria-label="Close"
          >
            <i className="ri-close-line text-xl text-slate-400"></i>
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-gradient-to-br from-teal-600 to-teal-800 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-teal-200 text-sm mb-1">Net Amount</p>
                <p className="text-4xl font-bold">£{net.toFixed(2)}</p>
              </div>
              <div className="w-14 h-14 flex items-center justify-center bg-white/20 rounded-full">
                <i className="ri-receipt-line text-3xl"></i>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(status)}`}>
                {getStatusLabel(status)}
              </span>
              <span className="text-teal-200 text-xs">
                {payout.payout_method === 'stripe' ? 'via Stripe' : 'via Bank Transfer'}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Fee Breakdown
            </h3>
            <div className="bg-[#0B1933] rounded-xl p-5 space-y-3 border border-[#1e2d4d]">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Gross Earnings</span>
                <span className="font-semibold text-white">£{gross.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Platform Fee ({feePercent}%)</span>
                <span className="font-semibold text-red-400">-£{fee.toFixed(2)}</span>
              </div>
              {payout.promo_tier && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-teal-400">
                    <i className="ri-star-line mr-1"></i>Promo Tier Applied
                  </span>
                  <span className="text-teal-400 font-medium">{payout.promo_tier}</span>
                </div>
              )}
              <div className="border-t border-[#1e2d4d] pt-3 flex justify-between items-center">
                <span className="font-semibold text-white">Net Payout</span>
                <span className="font-bold text-lg text-emerald-400">£{net.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Payout Details
            </h3>
            <div className="bg-[#0B1933] rounded-xl p-5 space-y-3 border border-[#1e2d4d]">
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Reference Number</span>
                <span className="text-sm font-medium text-white font-mono">{reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Payout ID</span>
                <span className="text-sm font-medium text-white font-mono">{payout.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Payout Method</span>
                <span className="text-sm font-medium text-white">{payout.payout_method === 'stripe' ? 'Stripe Transfer' : 'Bank Transfer'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Transfer ID</span>
                <span className="text-sm font-medium text-white font-mono">{payout.transfer_id || 'N/A'}</span>
              </div>
              <div className="border-t border-[#1e2d4d] pt-3 flex justify-between">
                <span className="text-slate-400 text-sm">Date Initiated</span>
                <span className="text-sm font-medium text-white">{formatDate(payout.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Expected Arrival</span>
                <span className="text-sm font-medium text-teal-400">{formatDate(payout.expected_date)}</span>
              </div>
              {payout.completed_date && (
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Completed Date</span>
                  <span className="text-sm font-medium text-emerald-400">{formatDate(payout.completed_date)}</span>
                </div>
              )}
            </div>
          </div>

          {payout.failure_reason && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-error-warning-line text-red-400"></i>
                <h3 className="font-semibold text-red-400">Payout Issue</h3>
              </div>
              <p className="text-sm text-red-300">{payout.failure_reason}</p>
            </div>
          )}

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 flex items-center justify-center bg-amber-500/15 rounded-full flex-shrink-0 mt-0.5">
                <i className="ri-error-warning-line text-amber-400"></i>
              </div>
              <div>
                <h3 className="font-semibold text-amber-300 mb-1">Your Tax Responsibility</h3>
                <p className="text-sm text-amber-200/80 leading-relaxed">
                  You are receiving this payout as an independent contractor, not as an employee of QuickGuard.
                  You are responsible for declaring this income to HMRC and paying any Income Tax, National Insurance
                  contributions, and VAT (if applicable). QuickGuard does not deduct PAYE or tax on your behalf.
                  Keep this receipt for your self-assessment records.
                </p>
                <p className="text-xs text-amber-400/70 mt-2">
                  If you are unsure about your tax obligations, visit gov.uk/self-assessment or speak to an accountant.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#0B1933] rounded-xl p-5 border border-[#1e2d4d]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-full">
                <i className="ri-shield-check-line text-teal-400"></i>
              </div>
              <div>
                <p className="font-semibold text-white text-sm">QuickGuard Platform</p>
                <p className="text-xs text-slate-500">Registered security services provider</p>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-3 pt-3 border-t border-[#1e2d4d]">
              This receipt serves as proof of payout. For any disputes, please contact support within 14 days.
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 bg-[#162036] text-slate-300 py-3 rounded-lg font-semibold hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap"
            >
              Close
            </button>
            <button
              onClick={() => {
                const receiptData = [
                  `QuickGuard Payout Receipt`,
                  ``,
                  `Reference: ${reference}`,
                  `Payout ID: ${payout.id}`,
                  `Date: ${formatDate(payout.created_at)}`,
                  `Status: ${getStatusLabel(status)}`,
                  ``,
                  `Gross Amount: £${gross.toFixed(2)}`,
                  `Platform Fee: -£${fee.toFixed(2)} (${feePercent}%)`,
                  `Net Payout: £${net.toFixed(2)}`,
                  ``,
                  `Method: ${payout.payout_method === 'stripe' ? 'Stripe' : 'Bank Transfer'}`,
                  `Transfer ID: ${payout.transfer_id || 'N/A'}`,
                  ``,
                  `---`,
                  `QuickGuard Platform`,
                ].join('\n');
                const blob = new Blob([receiptData], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `receipt-${reference}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex-1 bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-download-line mr-2"></i>Download Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}