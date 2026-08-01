'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PaymentFlowIndicator from './PaymentFlowIndicator';
import { getPaymentFlowStatus, FlowSourceData } from '@/lib/payments/paymentFlowStatus';

interface Props {
  guardId: string;
  guardUserId: string;
}

interface EnrichedAssignment {
  id: string;
  jobId: string;
  jobTitle: string;
  venueCity: string;
  clientName: string;
  startDate: string;
  amount: number | null;
  currency: string;
  flowData: FlowSourceData;
}

export default function PaymentFlowCard({ guardId, guardUserId }: Props) {
  const [jobs, setJobs] = useState<EnrichedAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        const { data: assignments, error: assignError } = await supabase
          .from('job_assignments')
          .select(`
            id,
            status,
            payment_amount,
            payment_status,
            payout_released,
            payout_released_at,
            payout_id,
            assigned_at,
            job_id,
            jobs!inner (
              id,
              job_title,
              venue_city,
              start_date,
              payment_status,
              completion_status,
              disputed,
              agreed_amount,
              currency,
              guard_payout_amount,
              clients (
                company_name
              )
            )
          `)
          .eq('guard_id', guardId)
          .in('status', ['confirmed', 'in_progress', 'completed', 'pending'])
          .order('assigned_at', { ascending: false })
          .limit(5);

        if (assignError) throw assignError;
        if (!mounted) return;

        const valid = (assignments || []).filter(a => a.jobs);
        if (valid.length === 0) {
          setJobs([]);
          setLoading(false);
          return;
        }

        const jobIds = valid.map(a => a.job_id);
        const assignmentIds = valid.map(a => a.id);

        const [{ data: completions }, { data: payouts }] = await Promise.all([
          supabase
            .from('job_completion_requests')
            .select('id, job_id, guard_id, status, client_approved_at, client_disputed_at, dispute_reason')
            .in('job_id', jobIds)
            .eq('guard_id', guardId),
          supabase
            .from('guard_payouts')
            .select('id, assignment_id, job_id, amount, net_amount, status, stripe_transfer_status, failure_reason, completed_date, expected_date')
            .in('assignment_id', assignmentIds)
            .eq('guard_id', guardId),
        ]);

        if (!mounted) return;

        const completionMap = new Map<string, any>();
        (completions || []).forEach((c: any) => {
          const key = `${c.job_id}_${c.guard_id}`;
          if (!completionMap.has(key)) completionMap.set(key, c);
        });

        const payoutMap = new Map<string, any>();
        (payouts || []).forEach((p: any) => {
          if (!payoutMap.has(p.assignment_id)) payoutMap.set(p.assignment_id, p);
        });

        const enriched: EnrichedAssignment[] = valid.map((a: any) => {
          const job = a.jobs;
          const completion = completionMap.get(`${a.job_id}_${guardId}`);
          const payout = payoutMap.get(a.id);

          const flowData: FlowSourceData = {
            assignmentStatus: a.status,
            assignmentPaymentStatus: a.payment_status,
            assignmentPaymentAmount: a.payment_amount,
            assignmentPayoutReleased: a.payout_released,
            assignmentPayoutReleasedAt: a.payout_released_at,
            assignmentPayoutId: a.payout_id,
            jobPaymentStatus: job?.payment_status || null,
            jobCompletionStatus: job?.completion_status || null,
            jobDisputed: job?.disputed || null,
            jobAgreedAmount: job?.agreed_amount || null,
            jobCurrency: job?.currency || null,
            jobGuardPayoutAmount: job?.guard_payout_amount || null,
            completionRequestStatus: completion?.status || null,
            completionRequestClientApprovedAt: completion?.client_approved_at || null,
            completionRequestClientDisputedAt: completion?.client_disputed_at || null,
            completionRequestDisputeReason: completion?.dispute_reason || null,
            payoutStatus: payout?.status || null,
            payoutAmount: payout?.amount || null,
            payoutNetAmount: payout?.net_amount || null,
            payoutStripeTransferStatus: payout?.stripe_transfer_status || null,
            payoutFailureReason: payout?.failure_reason || null,
            payoutCompletedDate: payout?.completed_date || null,
            payoutExpectedDate: payout?.expected_date || null,
          };

          return {
            id: a.id,
            jobId: job?.id || '',
            jobTitle: job?.job_title || 'Untitled Job',
            venueCity: job?.venue_city || '',
            clientName: job?.clients?.company_name || '',
            startDate: job?.start_date || '',
            amount: a.payment_amount || job?.agreed_amount || job?.guard_payout_amount || null,
            currency: job?.currency || 'GBP',
            flowData,
          };
        });

        setJobs(enriched);
      } catch {
        if (mounted) setError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchData();
    return () => { mounted = false; };
  }, [guardId, guardUserId]);

  if (loading) {
    return (
      <div className="bg-[#0d1b36] rounded-2xl border border-[#1a2b4a] shadow-lg p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-exchange-funds-line text-teal-400"></i>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white">Payment Flow</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#0B1933] rounded-xl border border-[#1a2b4a] p-4 animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-2/3 mb-3"></div>
              <div className="h-2 bg-slate-700 rounded w-full mb-2"></div>
              <div className="h-8 bg-slate-700 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#0d1b36] rounded-2xl border border-[#1a2b4a] shadow-lg p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-exchange-funds-line text-teal-400"></i>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white">Payment Flow</h2>
        </div>
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 bg-red-500/10 rounded-full flex items-center justify-center">
            <i className="ri-error-warning-line text-red-400 text-xl"></i>
          </div>
          <p className="text-sm text-slate-400">Could not load payment data</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-[#162036] text-slate-300 border border-[#1a2b4a] rounded-xl text-xs font-semibold hover:bg-[#1e2d4d] transition whitespace-nowrap"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0d1b36] rounded-2xl border border-[#1a2b4a] shadow-lg p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-exchange-funds-line text-teal-400"></i>
          </div>
          Payment Flow
        </h2>
        {jobs.length > 0 && (
          <Link href="/guard/earnings" className="text-xs text-teal-400 hover:text-teal-300 font-medium whitespace-nowrap transition-colors">
            View Earnings
          </Link>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-10 px-4">
          <div className="w-16 h-16 mx-auto mb-4 bg-[#111d35] rounded-2xl border border-[#1a2b4a] flex items-center justify-center">
            <i className="ri-exchange-funds-line text-3xl text-slate-600"></i>
          </div>
          <p className="text-sm font-semibold text-white mb-1">No payment flows yet</p>
          <p className="text-xs text-slate-500 mb-4">Once you complete a paid job, your payment progress will appear here.</p>
          <Link href="/guard/jobs" className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/20 whitespace-nowrap cursor-pointer">
            <i className="ri-briefcase-line"></i>
            Browse Jobs
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map(job => {
            const flow = getPaymentFlowStatus(job.flowData);
            const jobDate = job.startDate ? new Date(job.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '';
            return (
              <div key={job.id} className="bg-[#0B1933] rounded-xl border border-[#1a2b4a] p-4 hover:border-teal-500/20 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{job.jobTitle}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                      {job.clientName && (
                        <span className="flex items-center gap-1">
                          <i className="ri-building-line"></i>
                          {job.clientName}
                        </span>
                      )}
                      {job.venueCity && (
                        <span className="flex items-center gap-1">
                          <i className="ri-map-pin-line"></i>
                          {job.venueCity}
                        </span>
                      )}
                      {jobDate && (
                        <span className="flex items-center gap-1">
                          <i className="ri-calendar-line"></i>
                          {jobDate}
                        </span>
                      )}
                    </div>
                    {job.amount !== null && (
                      <p className="text-sm font-bold text-emerald-400 mt-1.5">
                        {job.currency === 'GBP' ? '£' : job.currency === 'EUR' ? '€' : '$'}{Number(job.amount).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/guard/jobs/${job.jobId}`}
                    className="px-3 py-1.5 border border-[#1a2b4a] text-slate-400 rounded-lg text-[11px] font-semibold hover:bg-[#162036] transition-colors whitespace-nowrap flex-shrink-0"
                  >
                    View Details
                  </Link>
                </div>
                <PaymentFlowIndicator flow={flow} compact />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}