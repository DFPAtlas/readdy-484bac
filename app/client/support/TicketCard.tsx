'use client';

import Link from 'next/link';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';

interface Ticket {
  id: string;
  ticket_reference: string;
  category: string;
  subject: string;
  priority: string;
  status: string;
  related_job_id?: string;
  job_title?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  description: string;
  requested_refund_amount?: number;
  payment_amount?: number;
}

interface TicketCardProps {
  ticket: Ticket;
  onOpen: (ticket: Ticket) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

const categoryLabels: Record<string, string> = {
  general_support: 'General Support',
  payment_issue: 'Payment Issue',
  guard_no_show: 'Guard No-Show',
  late_arrival: 'Late Arrival',
  poor_performance: 'Poor Performance',
  refund_request: 'Refund Request',
  job_cancellation: 'Job Cancellation',
  technical_issue: 'Technical Issue',
  account_billing: 'Account/Billing Help',
};

const categoryIcons: Record<string, string> = {
  general_support: 'ri-customer-service-2-line',
  payment_issue: 'ri-secure-payment-line',
  guard_no_show: 'ri-user-unfollow-line',
  late_arrival: 'ri-time-line',
  poor_performance: 'ri-emotion-unhappy-line',
  refund_request: 'ri-refund-line',
  job_cancellation: 'ri-close-circle-line',
  technical_issue: 'ri-bug-line',
  account_billing: 'ri-bank-card-line',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TicketCard({ ticket, onOpen, selectable, selected, onToggleSelect }: TicketCardProps) {
  const isRefund = ticket.category === 'refund_request';
  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';

  return (
    <div
      className={`bg-[#111d35] rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
        isResolved ? 'border-slate-500/15 opacity-80' : 'border-[#1e2d4d]'
      } ${selectable && selected ? 'ring-2 ring-teal-500/30' : ''}`}
      onClick={() => selectable && onToggleSelect?.()}
    >
      <div className="hidden md:block p-5">
        <div className="flex items-start gap-4">
          {selectable && (
            <label className="flex items-center pt-1 cursor-pointer flex-shrink-0" onClick={e => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={selected}
                onChange={onToggleSelect}
                className="w-4 h-4 rounded border-[#1e2d4d] bg-[#162036] text-teal-500 focus:ring-teal-500/20 cursor-pointer"
              />
            </label>
          )}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isResolved ? 'bg-slate-500/10' : 'bg-teal-500/15'}`}>
            <i className={`${categoryIcons[ticket.category] || 'ri-feedback-line'} text-xl ${isResolved ? 'text-slate-500' : 'text-teal-400'}`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="text-base font-bold text-slate-200 truncate">{ticket.subject}</h3>
                  <StatusBadge status={ticket.status} compact />
                  <PriorityBadge priority={ticket.priority} compact />
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <i className="ri-hashtag text-slate-600"></i>
                    {ticket.ticket_reference}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-price-tag-3-line text-slate-600"></i>
                    {categoryLabels[ticket.category] || ticket.category}
                  </span>
                  {ticket.job_title && (
                    <span className="flex items-center gap-1">
                      <i className="ri-briefcase-line text-slate-600"></i>
                      {ticket.job_title}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <i className="ri-calendar-line text-slate-600"></i>
                    {formatDate(ticket.created_at)}
                  </span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-slate-500">Last updated</p>
                <p className="text-sm text-slate-400 font-medium">{formatDateTime(ticket.updated_at)}</p>
              </div>
            </div>

            <p className="text-sm text-slate-500 mt-2 line-clamp-2">{ticket.description}</p>

            {isRefund && (
              <div className="flex flex-wrap gap-3 mt-3">
                {ticket.payment_amount !== undefined && (
                  <span className="text-sm text-slate-500">
                    Paid: <span className="font-semibold text-slate-300">£{ticket.payment_amount}</span>
                  </span>
                )}
                {ticket.requested_refund_amount !== undefined && (
                  <span className="text-sm text-slate-500">
                    Requested Refund: <span className="font-semibold text-orange-400">£{ticket.requested_refund_amount}</span>
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 pt-3 border-t border-[#1e2d4d] mt-3">
              <button
                onClick={() => onOpen(ticket)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#162036] text-slate-300 text-xs font-semibold border border-[#1e2d4d] hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-eye-line"></i>View Details
              </button>
              {ticket.related_job_id && (
                <Link href={`/client/jobs/${ticket.related_job_id}`}>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#162036] text-teal-400 text-xs font-semibold border border-[#1e2d4d] hover:bg-teal-500/10 transition-colors cursor-pointer whitespace-nowrap">
                    <i className="ri-briefcase-line"></i>Go to Job
                  </button>
                </Link>
              )}
              {ticket.status === 'open' && (
                <span className="text-xs text-slate-500 ml-auto">
                  <i className="ri-time-line mr-0.5"></i>Awaiting response
                </span>
              )}
              {ticket.status === 'awaiting_client' && (
                <span className="text-xs text-amber-400 font-medium ml-auto">
                  <i className="ri-reply-line mr-0.5"></i>Reply needed
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isResolved ? 'bg-slate-500/10' : 'bg-teal-500/15'}`}>
            <i className={`${categoryIcons[ticket.category] || 'ri-feedback-line'} text-lg ${isResolved ? 'text-slate-500' : 'text-teal-400'}`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-200 truncate">{ticket.subject}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <StatusBadge status={ticket.status} compact />
              <PriorityBadge priority={ticket.priority} compact />
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm text-slate-500 mb-3">
          <div className="flex items-center gap-1.5">
            <i className="ri-hashtag text-slate-600"></i>
            {ticket.ticket_reference}
          </div>
          <div className="flex items-center gap-1.5">
            <i className="ri-price-tag-3-line text-slate-600"></i>
            {categoryLabels[ticket.category] || ticket.category}
          </div>
          {ticket.job_title && (
            <div className="flex items-center gap-1.5">
              <i className="ri-briefcase-line text-slate-600"></i>
              {ticket.job_title}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <i className="ri-calendar-line text-slate-600"></i>
            {formatDate(ticket.created_at)}
          </div>
        </div>

        <p className="text-sm text-slate-500 mb-3 line-clamp-2">{ticket.description}</p>

        {isRefund && (
          <div className="flex items-center gap-4 text-sm mb-3">
            {ticket.payment_amount !== undefined && (
              <span className="text-slate-500">Paid: <span className="font-semibold text-slate-300">£{ticket.payment_amount}</span></span>
            )}
            {ticket.requested_refund_amount !== undefined && (
              <span className="text-slate-500">Refund: <span className="font-semibold text-orange-400">£{ticket.requested_refund_amount}</span></span>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-3 border-t border-[#1e2d4d]">
          <button
            onClick={() => onOpen(ticket)}
            className="flex-1 min-w-[80px] flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-[#162036] text-slate-300 text-xs font-semibold border border-[#1e2d4d] cursor-pointer whitespace-nowrap"
          >
            <i className="ri-eye-line"></i>Details
          </button>
          {ticket.related_job_id && (
            <Link href={`/client/jobs/${ticket.related_job_id}`} className="flex-1 min-w-[80px]">
              <button className="w-full flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-[#162036] text-teal-400 text-xs font-semibold border border-[#1e2d4d] cursor-pointer whitespace-nowrap">
                <i className="ri-briefcase-line"></i>Job
              </button>
            </Link>
          )}
          {ticket.status === 'awaiting_client' && (
            <span className="flex-1 text-center text-xs text-amber-400 font-medium py-2">
              <i className="ri-reply-line mr-0.5"></i>Reply needed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}