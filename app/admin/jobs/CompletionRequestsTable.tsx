'use client';

import Link from 'next/link';

interface CompletionRequest {
  id: string;
  job_id: string;
  guard_id: string;
  status: string;
  requested_at: string;
  dispute_reason: string | null;
  notes: string | null;
  jobs: { job_title: string; venue_city: string; agreed_amount: number | null } | null;
  guards: { full_name: string } | null;
}

interface CompletionRequestsTableProps {
  requests: CompletionRequest[];
  loading: boolean;
  filter: string;
  processing: string | null;
  onApprove: (requestId: string) => void;
}

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20',
  approved: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
  disputed: 'bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20',
  rejected: 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20',
};

export default function CompletionRequestsTable({ requests, loading, filter, processing, onApprove }: CompletionRequestsTableProps) {
  if (loading) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-12 text-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm text-slate-400">Loading requests...</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-12 text-center">
        <div className="w-12 h-12 bg-[#0a1527] rounded-xl flex items-center justify-center mx-auto mb-3 ring-1 ring-[#1e2d4d]">
          <i className="ri-checkbox-circle-line text-2xl text-slate-500"></i>
        </div>
        <p className="text-sm text-slate-400">No {filter !== 'all' ? filter : ''} requests</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#0a1527] border-b border-[#1e2d4d]">
              <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase">Guard</th>
              <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase">Job</th>
              <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase">Requested</th>
              <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase">Amount</th>
              <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase">Status</th>
              <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase">Dispute</th>
              <th className="px-4 py-3 text-right font-bold text-slate-500 text-xs uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(req => (
              <tr key={req.id} className="border-b border-[#1a2642] hover:bg-[#1a2642]/50">
                <td className="px-4 py-3 font-semibold text-white">{req.guards?.full_name || '—'}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{req.jobs?.job_title || '—'}</p>
                  <p className="text-xs text-slate-400">{req.jobs?.venue_city || ''}</p>
                </td>
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                  {new Date(req.requested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </td>
                <td className="px-4 py-3 font-bold text-white">
                  {req.jobs?.agreed_amount ? `£${Number(req.jobs.agreed_amount).toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${statusStyles[req.status] || 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20'}`}>
                    {req.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 max-w-xs truncate">
                  {req.dispute_reason || '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {(req.status === 'pending' || req.status === 'disputed') && (
                      <button
                        onClick={() => onApprove(req.id)}
                        disabled={processing === req.id}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 ring-1 ring-emerald-500/20 whitespace-nowrap disabled:opacity-50 cursor-pointer"
                      >
                        {processing === req.id ? '...' : 'Release Payment'}
                      </button>
                    )}
                    <Link
                      href={`/admin/jobs`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2642] text-slate-500 hover:text-slate-300"
                    >
                      <i className="ri-external-link-line text-sm"></i>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}