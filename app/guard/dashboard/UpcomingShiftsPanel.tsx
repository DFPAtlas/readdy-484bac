'use client';

import Link from 'next/link';
import { ShiftItem } from './types';
import FundedBadge from './FundedBadge';

interface Props {
  shifts: ShiftItem[];
  onConfirm: (id: string) => void;
  onCheckIn: (id: string) => void;
  onCheckOut: (id: string) => void;
  onMarkComplete?: (id: string, jobId: string) => void;
  markingJobId?: string | null;
}

function getShiftAction(shift: ShiftItem) {
  const today = new Date().toISOString().split('T')[0];
  const isToday = shift.start_date === today;
  if (shift.source === 'application') return { label: 'Confirm', action: 'confirm', variant: 'emerald' };
  if (shift.status === 'confirmed' && isToday) return { label: 'Check In', action: 'checkin', variant: 'teal' };
  if (shift.status === 'in_progress') return { label: 'Check Out', action: 'checkout', variant: 'amber' };
  if (shift.status === 'completed') return { label: 'Awaiting Approval', action: 'awaiting', variant: 'slate' };
  return { label: 'View Shift', action: 'view', variant: 'slate' };
}

const variantClasses: Record<string, string> = {
  emerald: 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-emerald-500/20',
  teal: 'bg-teal-500 text-white hover:bg-teal-400 shadow-teal-500/20',
  amber: 'bg-amber-500 text-white hover:bg-amber-400 shadow-amber-500/20',
  slate: 'bg-[#162036] text-slate-300 hover:bg-[#1a2b4a] border border-[#1e2d4d]',
};

export default function UpcomingShiftsPanel({ shifts, onConfirm, onCheckIn, onCheckOut, onMarkComplete, markingJobId }: Props) {
  return (
    <div className="bg-[#0d1b36] rounded-2xl border border-[#1a2b4a] shadow-lg p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-calendar-check-line text-teal-400"></i>
          </div>
          Upcoming Shifts
        </h2>
        {shifts.length > 0 && (
          <Link href="/guard/dashboard#upcoming" className="text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors whitespace-nowrap">
            View All
          </Link>
        )}
      </div>
      {shifts.length === 0 ? (
        <div className="text-center py-10 px-4">
          <div className="w-16 h-16 mx-auto mb-4 bg-[#111d35] rounded-2xl border border-[#1a2b4a] flex items-center justify-center">
            <i className="ri-calendar-line text-3xl text-slate-600"></i>
          </div>
          <p className="text-sm font-semibold text-white mb-1">No Upcoming Shifts</p>
          <p className="text-xs text-slate-500 mb-4">Apply to jobs to start filling your schedule</p>
          <Link href="/guard/jobs" className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/20 whitespace-nowrap cursor-pointer">
            <i className="ri-briefcase-line"></i>
            Browse Jobs
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {shifts.map(shift => {
            const action = getShiftAction(shift);
            const isFunded = (shift as any).payment_status === 'funded';
            const isAwaitingPayment = (shift as any).payment_status === 'payment_pending' || (shift as any).payment_status === 'unpaid';
            return (
              <div key={shift.id} className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border transition-all hover:shadow-md ${isFunded ? 'bg-emerald-500/5 border-emerald-500/15' : isAwaitingPayment ? 'bg-amber-500/5 border-amber-500/15' : 'bg-[#0B1933] border-[#1a2b4a]'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <p className="text-sm font-semibold text-white truncate">{shift.job_title}</p>
                    <FundedBadge paymentStatus={(shift as any).payment_status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1"><i className="ri-map-pin-line text-slate-600"></i>{shift.location}</span>
                    <span className="flex items-center gap-1"><i className="ri-calendar-line text-slate-600"></i>{shift.start_date ? new Date(shift.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'N/A'}</span>
                    <span className="flex items-center gap-1"><i className="ri-time-line text-slate-600"></i>{shift.start_time}</span>
                  </div>
                  {shift.client_name && (
                    <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                      <i className="ri-building-line text-slate-600"></i>{shift.client_name}
                    </p>
                  )}
                  {isAwaitingPayment && (
                    <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1">
                      <i className="ri-time-line"></i>Waiting for client payment to confirm
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                  {action.action === 'confirm' && (
                    <button onClick={() => onConfirm(shift.id)} className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shadow-lg transition-all ${variantClasses.emerald}`}>Confirm Shift</button>
                  )}
                  {action.action === 'checkin' && isFunded && (
                    <button onClick={() => onCheckIn(shift.id)} className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shadow-lg transition-all ${variantClasses.teal}`}>Check In</button>
                  )}
                  {action.action === 'checkin' && !isFunded && (
                    <span className="px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-[#162036] text-slate-500 border border-[#1a2b4a] cursor-not-allowed" title="Waiting for payment">Awaiting Payment</span>
                  )}
                  {action.action === 'checkout' && (
                    <button onClick={() => onCheckOut(shift.id)} className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shadow-lg transition-all ${variantClasses.amber}`}>Check Out</button>
                  )}
                  {action.action === 'checkout' && onMarkComplete && (
                    <button
                      onClick={() => onMarkComplete(shift.id, shift.job_id)}
                      disabled={markingJobId === shift.id}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${markingJobId === shift.id ? 'bg-[#162036] text-slate-500 border border-[#1a2b4a] cursor-not-allowed' : 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'}`}
                    >
                      {markingJobId === shift.id ? (
                        <div className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                      ) : (
                        'Mark Complete'
                      )}
                    </button>
                  )}
                  {action.action === 'awaiting' && (
                    <span className="px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <i className="ri-time-line mr-1"></i>Pending Approval
                    </span>
                  )}
                  <Link href={`/jobs/${shift.job_id}`} className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${variantClasses.slate}`}>View</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}