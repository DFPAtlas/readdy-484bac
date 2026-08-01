'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import CancellationStatusBadge from '../CancellationStatusBadge';

interface CancellationRefundPanelProps {
  job: any;
  cancellation: any;
  refundRequests: any[];
  transaction: any;
  onRequestRefund: () => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pending', color: 'text-orange-400', icon: 'ri-hourglass-line' },
  approved: { label: 'Approved', color: 'text-emerald-400', icon: 'ri-check-double-line' },
  rejected: { label: 'Rejected', color: 'text-rose-400', icon: 'ri-forbid-line' },
  processed: { label: 'Processed', color: 'text-teal-400', icon: 'ri-checkbox-circle-line' },
  credit_issued: { label: 'Credit Issued', color: 'text-violet-400', icon: 'ri-coupon-line' },
};

export default function CancellationRefundPanel({ job, cancellation, refundRequests, transaction, onRequestRefund }: CancellationRefundPanelProps) {
  const [showDetails, setShowDetails] = useState(false);
  const paidAmount = transaction?.amount || 0;
  const isCancelled = job.status === 'cancelled';
  const isRefunded = transaction?.refunded || false;
  const hasPendingRefund = refundRequests.some((r) => r.status === 'pending');
  const hasApprovedRefund = refundRequests.some((r) => r.status === 'approved' || r.status === 'processed');
  const hasRejectedRefund = refundRequests.some((r) => r.status === 'rejected');
  const hasCredit = refundRequests.some((r) => r.status === 'credit_issued');

  const platformFee = paidAmount * 0.15;
  const estimatedRefundable = Math.max(0, paidAmount - platformFee);

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
          <i className="ri-close-circle-line text-red-400 text-xl"></i>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Cancellation & Refund</h3>
          <p className="text-xs text-slate-500">{isCancelled ? 'This job was cancelled' : 'No cancellation on record'}</p>
        </div>
      </div>

      {isCancelled && cancellation && (
        <div className="space-y-4">
          {/* Cancellation summary */}
          <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-200">Cancellation Status</p>
              <CancellationStatusBadge status={cancellation.status} />
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Reason</span><span className="text-slate-200">{cancellation.reason || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Cancelled</span><span className="text-slate-200">{new Date(cancellation.cancelled_at || cancellation.created_at).toLocaleDateString('en-GB')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Preferred Resolution</span><span className="text-slate-200 capitalize">{(cancellation.preferred_resolution || '—').replace(/_/g, ' ')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Contact</span><span className="text-slate-200 capitalize">{cancellation.contact_preference || '—'}</span></div>
              {cancellation.notes && (
                <div className="pt-1 border-t border-[#1e2d4d]">
                  <span className="text-xs text-slate-500">Notes</span>
                  <p className="text-sm text-slate-300 mt-0.5">{cancellation.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Payment summary */}
          {paidAmount > 0 && (
            <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
              <p className="text-sm font-semibold text-slate-200 mb-2">Payment Summary</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Amount Paid</span><span className="text-slate-200 font-semibold">£{paidAmount.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Platform Fee</span><span className="text-slate-200">£{platformFee.toFixed(2)}</span></div>
                <div className="flex justify-between pt-1 border-t border-[#1e2d4d]"><span className="text-white font-semibold">Estimated Refundable</span><span className="text-teal-400 font-bold">£{estimatedRefundable.toFixed(2)}</span></div>
              </div>
              {isRefunded && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <i className="ri-check-double-line text-emerald-400"></i>
                  <span className="text-emerald-400 font-semibold">£{transaction.refund_amount?.toFixed(2)} refunded</span>
                </div>
              )}
            </div>
          )}

          {/* Refund requests */}
          {refundRequests.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Refund Requests</p>
              <div className="space-y-2">
                {refundRequests.map((req) => {
                  const cfg = statusConfig[req.status] || statusConfig.pending;
                  return (
                    <div key={req.id} className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-200">£{req.requested_amount?.toFixed(2)}</span>
                          <span className="text-xs text-slate-500 capitalize">{req.type}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{req.reason}</p>
                        <p className="text-[10px] text-slate-600">{new Date(req.created_at).toLocaleDateString('en-GB')}</p>
                      </div>
                      <span className={`flex items-center gap-1 text-xs font-semibold ${cfg.color}`}>
                        <i className={cfg.icon}></i>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Admin review status */}
          {cancellation.status === 'under_admin_review' && (
            <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3">
              <p className="text-sm text-blue-400 font-semibold flex items-center gap-2">
                <i className="ri-shield-user-line"></i>
                Under Admin Review
              </p>
              <p className="text-xs text-blue-400/80 mt-1">Our team is reviewing this cancellation. You will be notified once a decision is made.</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {!isRefunded && !hasPendingRefund && !hasApprovedRefund && !hasCredit && (
              <button
                onClick={onRequestRefund}
                className="flex-1 min-w-[140px] bg-violet-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-600 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                <i className="ri-refund-line"></i>
                Request Refund
              </button>
            )}
            {hasPendingRefund && (
              <div className="flex-1 min-w-[140px] bg-orange-500/10 text-orange-400 py-2.5 rounded-xl text-sm font-semibold border border-orange-500/25 text-center flex items-center justify-center gap-2">
                <i className="ri-hourglass-line"></i>
                Refund Pending
              </div>
            )}
            {hasApprovedRefund && (
              <div className="flex-1 min-w-[140px] bg-emerald-500/10 text-emerald-400 py-2.5 rounded-xl text-sm font-semibold border border-emerald-500/25 text-center flex items-center justify-center gap-2">
                <i className="ri-check-double-line"></i>
                Refund Approved
              </div>
            )}
            {hasRejectedRefund && (
              <div className="flex-1 min-w-[140px] bg-rose-500/10 text-rose-400 py-2.5 rounded-xl text-sm font-semibold border border-rose-500/25 text-center flex items-center justify-center gap-2">
                <i className="ri-forbid-line"></i>
                Refund Rejected
              </div>
            )}
            {hasCredit && (
              <div className="flex-1 min-w-[140px] bg-violet-500/10 text-violet-400 py-2.5 rounded-xl text-sm font-semibold border border-violet-500/25 text-center flex items-center justify-center gap-2">
                <i className="ri-coupon-line"></i>
                Credit Issued
              </div>
            )}
            <Link href={`/client/support?new=general_support&job=${job.id}`}>
              <button className="px-4 py-2.5 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-customer-service-2-line"></i>
              </button>
            </Link>
          </div>
        </div>
      )}

      {!isCancelled && (
        <div className="text-center py-6">
          <div className="w-12 h-12 bg-[#162036] rounded-xl flex items-center justify-center mx-auto mb-3">
            <i className="ri-check-line text-2xl text-slate-600"></i>
          </div>
          <p className="text-sm text-slate-500">This job is not cancelled.</p>
          <p className="text-xs text-slate-600 mt-1">If you need to cancel, use the Cancel button on the Job Info tab.</p>
        </div>
      )}
    </div>
  );
}