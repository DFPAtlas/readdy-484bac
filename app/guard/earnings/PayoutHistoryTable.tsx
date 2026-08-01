'use client';

import React from 'react';

interface PayoutHistoryTableProps {
  payouts: any[];
  onViewReceipt: (payout: any) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
    case 'paid':
      return 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400';
    case 'pending':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400';
    case 'processing':
    case 'initiated':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400';
    case 'held':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400';
    case 'failed':
      return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-400';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'completed':
    case 'paid':
      return 'Completed';
    case 'initiated':
      return 'Initiated';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
    case 'paid':
      return 'ri-check-double-line';
    case 'pending':
      return 'ri-time-line';
    case 'processing':
    case 'initiated':
      return 'ri-loader-4-line';
    case 'held':
      return 'ri-pause-circle-line';
    case 'failed':
      return 'ri-close-circle-line';
    default:
      return 'ri-question-line';
  }
};

export default function PayoutHistoryTable({ payouts, onViewReceipt }: PayoutHistoryTableProps) {
  if (!Array.isArray(payouts) || payouts.length === 0) {
    return (
      <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-12 text-center">
        <div className="w-16 h-16 flex items-center justify-center bg-[#162036] rounded-full mx-auto mb-4">
          <i className="ri-receipt-line text-3xl text-slate-500"></i>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No payout receipts yet</h3>
        <p className="text-slate-500">Payout receipts appear here once payouts are initiated</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#0B1933] border-b border-[#1e2d4d]">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Reference
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Gross
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Fee
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Net
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Method
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2d4d]">
            {payouts.map((payout) => {
              const status = payout.status || 'pending';
              const reference = payout.reference_number || `P-${(payout.id || '').toString().slice(0, 8).toUpperCase()}`;
              const createdDate = payout.created_at
                ? new Date(payout.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'N/A';
              const gross = typeof payout.amount === 'number' ? payout.amount : 0;
              const fee = typeof payout.fee_deducted === 'number' ? payout.fee_deducted : 0;
              const net = typeof payout.net_amount === 'number' ? payout.net_amount : gross - fee;
              const method = payout.payout_method === 'stripe' ? 'Stripe' : 'Bank Transfer';
              const feePercent = gross > 0 ? ((fee / gross) * 100).toFixed(1) : '0.0';

              return (
                <tr key={payout.id} className="hover:bg-[#162036] transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white text-sm">{reference}</div>
                    <div className="text-xs text-slate-500 mt-0.5">ID: {payout.id?.toString().slice(0, 12)}...</div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-300">{createdDate}</div>
                    {payout.completed_date && (
                      <div className="text-xs text-emerald-400 mt-0.5">
                        Completed {new Date(payout.completed_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="text-sm font-semibold text-white">£{gross.toFixed(2)}</div>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="text-sm font-semibold text-red-400">-£{fee.toFixed(2)}</div>
                    <div className="text-xs text-slate-500">{feePercent}%</div>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="text-base font-bold text-emerald-400">£{net.toFixed(2)}</div>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(status)}`}>
                      <i className={`${getStatusIcon(status)}`}></i>
                      {getStatusLabel(status)}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-slate-400">
                      <i className={payout.payout_method === 'stripe' ? 'ri-bank-card-line' : 'ri-bank-line'}></i>
                      {method}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => onViewReceipt(payout)}
                      className="inline-flex items-center gap-1.5 text-teal-400 hover:text-teal-300 font-medium text-sm cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-receipt-line"></i>View Receipt
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}