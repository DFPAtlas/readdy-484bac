
'use client';

import * as React from 'react';

interface PayoutTableProps {
  earnings: any[];
  payoutsMap: Record<string, any>;
  calculateEarnings: (assignment: any) => number;
  onViewDetails: (earning: any) => void;
}

export default function PayoutTable({
  earnings,
  payoutsMap,
  calculateEarnings,
  onViewDetails,
}: PayoutTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
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

  const getStatusLabel = (earning: any) => {
    const payout = payoutsMap[earning.id];
    if (payout) return payout.status;
    return earning.payment_status || 'pending';
  };

  const getPayoutAmount = (earning: any) => {
    const payout = payoutsMap[earning.id];
    if (payout) return payout.net_amount;
    return calculateEarnings(earning);
  };

  const getExpectedDate = (earning: any) => {
    const payout = payoutsMap[earning.id];
    if (payout?.expected_date) {
      return new Date(payout.expected_date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      });
    }
    if (payout?.completed_date) {
      return new Date(payout.completed_date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      });
    }
    return null;
  };

  // Defensive check – protect against undefined/null earnings array
  if (!Array.isArray(earnings) || earnings.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-full mx-auto mb-4">
          <i className="ri-money-pound-circle-line text-3xl text-gray-400"></i>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No payouts found</h3>
        <p className="text-gray-600">Complete jobs to start earning</p>
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
                Job
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Client
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Date Worked
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Payout Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Expected
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2d4d]">
            {earnings.map((earning) => {
              const status = getStatusLabel(earning);
              const expected = getExpectedDate(earning);
              const amount = getPayoutAmount(earning);
              const formattedAmount = typeof amount === 'number' ? amount.toFixed(2) : '0.00';

              return (
                <tr key={earning.id} className="hover:bg-[#162036] transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white text-sm">
                      {earning.jobs?.job_title || 'Job'}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <i className="ri-map-pin-line"></i>
                      {earning.jobs?.location || 'N/A'}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-white">
                      {earning.jobs?.clients?.company_name || 'N/A'}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-300">
                      {earning.jobs?.start_date
                        ? new Date(earning.jobs.start_date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'N/A'}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {earning.jobs?.shift_start_time || ''} - {earning.jobs?.shift_end_time || ''}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-base font-bold text-white">£{formattedAmount}</div>
                    <div className="text-xs text-slate-500">
                      £{earning.jobs?.hourly_rate || 0}/hr
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        status,
                      )}`}
                    >
                      {status === 'paid' || status === 'completed' ? (
                        <>
                          <i className="ri-check-line mr-1"></i>Paid
                        </>
                      ) : status === 'processing' || status === 'initiated' ? (
                        <>
                          <i className="ri-loader-4-line mr-1 animate-spin"></i>Processing
                        </>
                      ) : status === 'held' ? (
                        <>
                          <i className="ri-pause-circle-line mr-1"></i>On Hold
                        </>
                      ) : status === 'failed' ? (
                        <>
                          <i className="ri-close-circle-line mr-1"></i>Failed
                        </>
                      ) : (
                        <>
                          <i className="ri-time-line mr-1"></i>Pending
                        </>
                      )}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    {expected ? (
                      <span className="text-sm text-slate-400">{expected}</span>
                    ) : status === 'paid' || status === 'completed' ? (
                      <span className="text-xs text-emerald-400 font-medium">Completed</span>
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => onViewDetails(earning)}
                      className="text-teal-400 hover:text-teal-300 font-medium text-sm cursor-pointer whitespace-nowrap"
                    >
                      Details
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
