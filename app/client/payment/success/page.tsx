'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { computeBookingConfirmation } from '@/lib/payments/bookingConfirmationState';

interface Transaction {
  id: string;
  status: string;
  payment_status: string | null;
  amount: number;
  receipt_url: string | null;
  invoice_url: string | null;
  failure_reason: string | null;
  stripe_session_id: string | null;
  created_at: string;
  completed_at: string | null;
  metadata: any;
}

interface JobSummary {
  job_title: string;
  venue_name: string;
  venue_city: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string | null;
}

interface AssignmentSummary {
  id: string;
  status: string;
  payment_status: string | null;
}

type PageStatus = 'loading' | 'paid' | 'failed' | 'confirming' | 'reconciling' | 'error';

const MAX_POLLS = 15;
const POLL_MS = 5000;

function SuccessContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<PageStatus>('loading');
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [job, setJob] = useState<JobSummary | null>(null);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [error, setError] = useState('');
  const [pollCount, setPollCount] = useState(0);

  const jobId = searchParams.get('job_id');
  const sessionId = searchParams.get('session_id');

  const loadData = useCallback(async () => {
    if (!jobId) return null;

    const { data: jobData } = await supabase
      .from('jobs')
      .select('job_title, venue_name, venue_city, start_date, end_date, start_time, end_time, status, payment_status')
      .eq('id', jobId)
      .maybeSingle();

    const { data: assignmentData } = await supabase
      .from('job_assignments')
      .select('id, status, payment_status')
      .eq('job_id', jobId);

    let txnData: Transaction | null = null;
    if (sessionId) {
      const { data: match } = await supabase
        .from('transactions')
        .select('*')
        .eq('job_id', jobId)
        .eq('stripe_session_id', sessionId)
        .maybeSingle();
      if (match) txnData = match as Transaction;
    }
    if (!txnData) {
      const { data: latest } = await supabase
        .from('transactions')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest) txnData = latest as Transaction;
    }

    return { jobData, assignmentData, txnData };
  }, [jobId, sessionId]);

  const deriveStatus = useCallback(
    (jobData: JobSummary | null, assignmentData: AssignmentSummary[], txnData: Transaction | null): PageStatus => {
      if (!jobData) return 'error';

      if (txnData?.status === 'failed' || txnData?.payment_status === 'failed' || jobData.payment_status === 'failed') {
        return 'failed';
      }

      const confirmation = computeBookingConfirmation(
        { status: jobData.status, payment_status: jobData.payment_status },
        assignmentData
      );

      if (confirmation === 'confirmed') return 'paid';
      if (confirmation === 'reconciling') return 'reconciling';
      return 'confirming';
    },
    []
  );

  useEffect(() => {
    if (!jobId) {
      setStatus('error');
      setError('Missing job information in URL.');
      return;
    }

    let attempts = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const refresh = async () => {
      const result = await loadData();
      if (!result) return;

      const { jobData, assignmentData, txnData } = result;
      if (!jobData) {
        setStatus('error');
        setError('Job not found.');
        return;
      }

      setJob(jobData as JobSummary);
      setAssignments((assignmentData || []) as AssignmentSummary[]);
      if (txnData) setTransaction(txnData as Transaction);

      const next = deriveStatus(jobData as JobSummary, (assignmentData || []) as AssignmentSummary[], txnData as Transaction | null);
      setStatus(next);

      attempts++;
      setPollCount(attempts);

      if (next === 'paid' || next === 'failed' || next === 'error') {
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
      } else if (attempts >= MAX_POLLS) {
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
      }
    };

    refresh();
    intervalId = setInterval(() => {
      if (attempts >= MAX_POLLS) {
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
        return;
      }
      refresh();
    }, POLL_MS);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId, loadData, deriveStatus]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return 'N/A';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const metadata = transaction?.metadata || {};
  const guardFees = metadata?.guard_fees ?? 0;
  const serviceFee = metadata?.service_fee ?? 0;
  const total = transaction?.amount ?? 0;

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-semibold text-white mb-2">Confirming your payment...</h2>
          <p className="text-slate-400 text-sm">This usually takes a few seconds.</p>
        </div>
      </div>
    );
  }

  if (status === 'confirming' || status === 'reconciling') {
    const isReconciling = status === 'reconciling';
    const iconClass = isReconciling ? 'border-amber-400' : 'border-amber-400';
    const title = isReconciling ? 'Booking status is being reconciled' : 'Payment received — confirming your booking';
    const desc = isReconciling
      ? 'Your payment was received but the booking state is still settling. This usually resolves within a few seconds.'
      : 'Your payment was received. We are finalising your booking with the secure payment provider — this usually takes a few seconds.';

    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-6">
        <div className="text-center max-w-md mx-auto">
          <div className={`w-16 h-16 border-4 ${iconClass} border-t-transparent rounded-full animate-spin mx-auto mb-6`} />
          <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
          <p className="text-slate-400 text-sm">{desc}</p>
          <p className="text-slate-500 text-xs mt-3">Checking {pollCount}/{MAX_POLLS}</p>
          <button
            onClick={() => {
              setPollCount(0);
              window.location.reload();
            }}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-white rounded-xl font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line w-5 h-5 flex items-center justify-center" />
            Refresh Status
          </button>
          <p className="text-slate-500 text-xs mt-4">
            If this stays pending, your payment may still be processing. You can safely return to the job — you will not be charged twice.
          </p>
          <Link
            href={jobId ? `/client/jobs/${jobId}` : '/client/jobs'}
            className="mt-3 inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 text-sm font-medium transition-colors"
          >
            <i className="ri-arrow-left-line w-5 h-5 flex items-center justify-center" />
            Back to Job
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-6">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-400/20">
            <i className="ri-error-warning-line text-3xl text-red-400 w-6 h-6 flex items-center justify-center" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={jobId ? `/client/jobs/${jobId}/payment` : '/client/jobs'}
              className="inline-flex items-center justify-center gap-2 bg-teal-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-all whitespace-nowrap"
            >
              <i className="ri-arrow-left-line w-5 h-5 flex items-center justify-center" />
              {jobId ? 'Back to Payment' : 'Back to Jobs'}
            </Link>
            <Link
              href="/client/support"
              className="inline-flex items-center justify-center gap-2 bg-white/10 text-white border border-white/20 px-6 py-3 rounded-xl font-semibold hover:bg-white/20 transition-all whitespace-nowrap"
            >
              <i className="ri-customer-service-2-line w-5 h-5 flex items-center justify-center" />
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-6">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-400/20">
            <i className="ri-close-circle-line text-3xl text-red-400 w-6 h-6 flex items-center justify-center" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Payment Failed</h1>
          <p className="text-slate-400 mb-2">
            {transaction?.failure_reason || 'Your payment could not be processed.'}
          </p>
          <p className="text-slate-500 text-sm mb-6">Your selected guards remain provisionally reserved. You can retry safely.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={jobId ? `/client/jobs/${jobId}/payment` : '/client/jobs'}
              className="inline-flex items-center justify-center gap-2 bg-teal-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-all whitespace-nowrap"
            >
              <i className="ri-refresh-line w-5 h-5 flex items-center justify-center" />
              Retry Payment
            </Link>
            <Link
              href="/client/support"
              className="inline-flex items-center justify-center gap-2 bg-white/10 text-white border border-white/20 px-6 py-3 rounded-xl font-semibold hover:bg-white/20 transition-all whitespace-nowrap"
            >
              <i className="ri-customer-service-2-line w-5 h-5 flex items-center justify-center" />
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-400/20">
            <i className="ri-check-line text-4xl text-emerald-400 w-8 h-8 flex items-center justify-center" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Booking Confirmed</h1>
          <p className="text-slate-400">Your payment has been received and your booking is confirmed.</p>
        </div>

        <div className="bg-[#111d35] rounded-2xl border border-slate-700/50 p-6 mb-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <i className="ri-briefcase-line text-teal-400" />
            Job Details
          </h3>
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <span className="text-slate-400 text-sm">Job</span>
              <span className="text-white text-sm font-medium text-right">{job?.job_title || 'Job Payment'}</span>
            </div>
            <div className="flex items-start justify-between">
              <span className="text-slate-400 text-sm">Location</span>
              <span className="text-white text-sm text-right">
                {job?.venue_name || 'N/A'}
                {job?.venue_city && `, ${job.venue_city}`}
              </span>
            </div>
            <div className="flex items-start justify-between">
              <span className="text-slate-400 text-sm">Date</span>
              <span className="text-white text-sm">
                {formatDate(job?.start_date)}
                {job?.end_date && job.end_date !== job.start_date && ` - ${formatDate(job.end_date)}`}
              </span>
            </div>
            <div className="flex items-start justify-between">
              <span className="text-slate-400 text-sm">Time</span>
              <span className="text-white text-sm">{formatTime(job?.start_time)} - {formatTime(job?.end_time)}</span>
            </div>
            <div className="border-t border-slate-700/50 pt-3 mt-3">
              <div className="flex items-start justify-between">
                <span className="text-slate-400 text-sm">Guard Fees</span>
                <span className="text-white text-sm font-medium">£{Number(guardFees).toFixed(2)}</span>
              </div>
              <div className="flex items-start justify-between mt-1">
                <span className="text-slate-400 text-sm">Service Fee</span>
                <span className="text-white text-sm font-medium">£{Number(serviceFee).toFixed(2)}</span>
              </div>
              <div className="flex items-start justify-between mt-2 pt-2 border-t border-slate-700/50">
                <span className="text-white text-sm font-semibold">Total Paid</span>
                <span className="text-teal-400 text-sm font-bold">£{Number(total).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#111d35] rounded-2xl border border-slate-700/50 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-sm">Payment Status</span>
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-400/20">
              <i className="ri-checkbox-circle-fill w-4 h-4 flex items-center justify-center" />
              Paid
            </span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-sm">Transaction ID</span>
            <span className="text-slate-300 text-sm font-mono">{transaction?.id?.slice(0, 12).toUpperCase()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Date</span>
            <span className="text-slate-300 text-sm">
              {transaction?.completed_at
                ? new Date(transaction.completed_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : new Date(transaction?.created_at || '').toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href={jobId ? `/client/jobs/${jobId}` : '/client/jobs'}
            className="bg-teal-500 hover:bg-teal-600 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap shadow-lg inline-flex items-center justify-center gap-2"
          >
            <i className="ri-briefcase-line w-6 h-6 flex items-center justify-center" />
            View Job
          </Link>
          <Link
            href="/client/jobs"
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap backdrop-blur-sm inline-flex items-center justify-center gap-2"
          >
            <i className="ri-arrow-left-line w-6 h-6 flex items-center justify-center" />
            Back to Jobs
          </Link>
        </div>

        {transaction?.receipt_url && (
          <div className="mt-6 text-center">
            <a
              href={transaction.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 text-sm font-medium transition-colors"
            >
              <i className="ri-download-line w-5 h-5 flex items-center justify-center" />
              Download Receipt
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function JobPaymentSuccess() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading...</p>
          </div>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}