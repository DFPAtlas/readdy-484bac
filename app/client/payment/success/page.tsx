'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

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
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'paid' | 'failed' | 'error'>('loading');
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [job, setJob] = useState<JobSummary | null>(null);
  const [error, setError] = useState('');
  const [pollCount, setPollCount] = useState(0);

  const sessionId = searchParams.get('session_id');
  const jobId = searchParams.get('job_id');

  useEffect(() => {
    if (!sessionId || !jobId) {
      setStatus('error');
      setError('Missing session or job information in URL.');
      return;
    }

    let attempts = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };

    const loadJob = async () => {
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('job_title, venue_name, venue_city, start_date, end_date, start_time, end_time')
          .eq('id', jobId)
          .maybeSingle();
        if (!error && data) setJob(data as JobSummary);
      } catch {}
    };

    const checkTransaction = async () => {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('job_id', jobId)
          .eq('stripe_session_id', sessionId)
          .maybeSingle();

        if (error) throw new Error(error.message);

        if (!data) {
          attempts++;
          setPollCount(attempts);
          if (attempts >= 20) {
            clearTimers();
            setStatus('error');
            setError('Payment confirmation not found. Please check your payment history or contact support.');
          }
          return;
        }

        const txn = data as Transaction;
        setTransaction(txn);

        const isPaid =
          txn.status === 'completed' ||
          txn.status === 'succeeded' ||
          txn.payment_status === 'completed' ||
          txn.payment_status === 'succeeded' ||
          txn.payment_status === 'funded';

        const isFailed =
          txn.status === 'failed' ||
          txn.payment_status === 'failed';

        if (isPaid) {
          setStatus('paid');
          clearTimers();
          return;
        }

        if (isFailed) {
          setStatus('failed');
          clearTimers();
          return;
        }

        attempts++;
        setPollCount(attempts);
        if (attempts >= 20) {
          clearTimers();
          setStatus('error');
          setError('Payment is taking longer than expected. Please check your payment history or contact support.');
        }
      } catch (err: unknown) {
        clearTimers();
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Something went wrong confirming your payment.');
      }
    };

    loadJob();
    checkTransaction();

    intervalId = setInterval(() => {
      checkTransaction();
    }, 2500);

    return () => clearTimers();
  }, [sessionId, jobId]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
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
          {pollCount > 0 && (
            <p className="text-slate-500 text-xs mt-3">Retry {pollCount}/20</p>
          )}
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
          <p className="text-slate-500 text-sm mb-6">
            You can retry the payment or contact support for help.
          </p>
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
          <h1 className="text-3xl font-bold text-white mb-2">Payment Successful</h1>
          <p className="text-slate-400">
            Your payment has been received and your booking is confirmed.
          </p>
        </div>

        <div className="bg-[#111d35] rounded-2xl border border-slate-700/50 p-6 mb-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <i className="ri-briefcase-line text-teal-400" />
            Job Details
          </h3>
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <span className="text-slate-400 text-sm">Job</span>
              <span className="text-white text-sm font-medium text-right">
                {job?.job_title || 'Job Payment'}
              </span>
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
              <span className="text-white text-sm">
                {formatTime(job?.start_time)} - {formatTime(job?.end_time)}
              </span>
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
                ? new Date(transaction.completed_at).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : new Date(transaction?.created_at || '').toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
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