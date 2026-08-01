'use client';

import { useState } from 'react';
import PaymentRow from './PaymentRow';

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

interface Props {
  payments: Payment[];
  loading: boolean;
}

export default function StripePaymentsTable({ payments, loading }: Props) {
  const [page, setPage] = useState(1);
  const perPage = 20;
  const totalPages = Math.max(1, Math.ceil(payments.length / perPage));
  const paged = payments.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4a] shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1e2d4a] flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Stripe Payments</h3>
        <span className="text-xs text-slate-400">{payments.length} payments</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-[#0d1b33]">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Date</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Customer</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Email</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Plan</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Amount</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Stripe Fee</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Net</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Invoice ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2d4a]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={9} className="px-4 py-4">
                    <div className="h-4 bg-[#1a2b4a] rounded w-full"></div>
                  </td>
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">
                  No payments found for this period
                </td>
              </tr>
            ) : (
              paged.map((p) => <PaymentRow key={p.id} payment={p} />)
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-[#1e2d4a] flex items-center justify-between">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-sm border border-[#1e2d4a] text-slate-400 hover:bg-[#1a2b4a] hover:text-white disabled:opacity-40 cursor-pointer"
          >
            Previous
          </button>
          <span className="text-sm text-slate-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-sm border border-[#1e2d4a] text-slate-400 hover:bg-[#1a2b4a] hover:text-white disabled:opacity-40 cursor-pointer"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}