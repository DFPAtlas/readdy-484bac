
'use client';

import PayoutTimeline from './PayoutTimeline';

interface PayoutDetailModalProps {
  earning: any;
  payout: any;
  onClose: () => void;
  calculateEarnings: (assignment: any) => number;
}

export default function PayoutDetailModal({
  earning,
  payout,
  onClose,
  calculateEarnings,
}: PayoutDetailModalProps) {
  const amount = payout?.net_amount ?? calculateEarnings(earning);
  const grossAmount = payout?.amount ?? calculateEarnings(earning);
  const fee = payout?.fee_deducted ?? 0;
  const status = payout?.status ?? earning.payment_status ?? 'pending';

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'paid':
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-orange-100 text-orange-700';
      case 'processing':
      case 'initiated':
        return 'bg-blue-100 text-blue-700';
      case 'held':
        return 'bg-red-100 text-red-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (d: string) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111d35] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#1e2d4d]">
        <div className="sticky top-0 bg-[#111d35] border-b border-[#1e2d4d] px-8 py-5 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-white">Payout Details</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Ref:{' '}
              {payout?.reference_number ||
                `PO-${(earning.id || '').slice(0, 8).toUpperCase()}`}
            </p>
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
                <p className="text-teal-200 text-sm mb-1">Net Payout</p>
                <p className="text-4xl font-bold">£{amount.toFixed(2)}</p>
              </div>
              <div className="w-14 h-14 flex items-center justify-center bg-white/20 rounded-full">
                <i className="ri-money-pound-circle-line text-3xl"></i>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  status === 'paid' || status === 'completed'
                    ? 'bg-emerald-400/30 text-emerald-100'
                    : status === 'processing'
                    ? 'bg-blue-400/30 text-blue-100'
                    : status === 'held' || status === 'failed'
                    ? 'bg-red-400/30 text-red-100'
                    : 'bg-amber-400/30 text-amber-100'
                }`}
              >
                {status.toUpperCase()}
              </span>
              <span className="text-teal-200 text-xs">
                {payout?.payout_method === 'stripe'
                  ? 'via Stripe'
                  : 'via Bank Transfer'}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Payout Progress
            </h3>
            <div className="bg-[#0B1933] rounded-xl p-5 border border-[#1e2d4d]">
              <PayoutTimeline payout={{ status, payment_status: status }} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Earnings Breakdown
            </h3>
            <div className="bg-[#0B1933] rounded-xl p-5 space-y-3 border border-[#1e2d4d]">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Gross Earnings</span>
                <span className="font-semibold text-white">
                  £{grossAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Platform Fee</span>
                <span className="font-semibold text-red-400">
                  -£{fee.toFixed(2)}
                </span>
              </div>
              <div className="border-t border-[#1e2d4d] pt-3 flex justify-between items-center">
                <span className="font-semibold text-white">Net Payout</span>
                <span className="font-bold text-lg text-emerald-400">
                  £{amount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Job Information
            </h3>
            <div className="bg-[#0B1933] rounded-xl p-5 space-y-3 border border-[#1e2d4d]">
              <div>
                <p className="text-xs text-slate-500">Job Title</p>
                <p className="font-semibold text-white">
                  {earning.jobs?.job_title || 'N/A'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#1e2d4d]">
                <div>
                  <p className="text-xs text-slate-500">Location</p>
                  <p className="font-medium text-white">
                    {earning.jobs?.location || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Hourly Rate</p>
                  <p className="font-medium text-white">
                    £{earning.jobs?.hourly_rate?.toFixed(2) ?? '0.00'}/hr
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#1e2d4d]">
                <div>
                  <p className="text-xs text-slate-500">Date</p>
                  <p className="font-medium text-white">
                    {formatDate(earning.jobs?.start_date)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Shift</p>
                  <p className="font-medium text-white">
                    {earning.jobs?.shift_start_time || ''} -{' '}
                    {earning.jobs?.shift_end_time || ''}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Client
            </h3>
            <div className="bg-[#0B1933] rounded-xl p-5 border border-[#1e2d4d]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center bg-teal-500/15 rounded-full">
                  <i className="ri-building-line text-teal-400"></i>
                </div>
                <div>
                  <p className="font-semibold text-white">
                    {earning.jobs?.clients?.company_name || 'N/A'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {earning.jobs?.clients?.contact_name || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Key Dates
            </h3>
            <div className="bg-[#0B1933] rounded-xl p-5 space-y-3 border border-[#1e2d4d]">
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Job Assigned</span>
                <span className="text-sm font-medium text-white">
                  {formatDate(earning.assigned_at)}
                </span>
              </div>
              {earning.completed_at && (
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Job Completed</span>
                  <span className="text-sm font-medium text-white">
                    {formatDate(earning.completed_at)}
                  </span>
                </div>
              )}
              {payout?.created_at && (
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Payout Initiated</span>
                  <span className="text-sm font-medium text-white">
                    {formatDate(payout.created_at)}
                  </span>
                </div>
              )}
              {payout?.expected_date && (
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Expected Arrival</span>
                  <span className="text-sm font-medium text-teal-400">
                    {formatDate(payout.expected_date)}
                  </span>
                </div>
              )}
              {payout?.completed_date && (
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Payout Completed</span>
                  <span className="text-sm font-medium text-emerald-400">
                    {formatDate(payout.completed_date)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {payout?.failure_reason && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-error-warning-line text-red-400"></i>
                <h3 className="font-semibold text-red-400">Payout Issue</h3>
              </div>
              <p className="text-sm text-red-300">{payout.failure_reason}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 bg-[#162036] text-slate-300 py-3 rounded-lg font-semibold hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap"
            >
              Close
            </button>
            {(status === 'held' || status === 'failed') && (
              <button className="flex-1 bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-customer-service-line mr-2"></i>Contact Support
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
