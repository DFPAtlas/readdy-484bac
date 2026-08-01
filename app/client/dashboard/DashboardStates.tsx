'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ErrorState from '@/app/client/components/ErrorState';
import LoadingSkeleton from '@/app/client/components/LoadingSkeleton';
import PaymentRequiredState from '@/app/client/components/PaymentRequiredState';
import EmptyState from '@/app/client/components/EmptyState';

interface PaymentRequiredBannerProps {
  jobId: string;
  jobTitle: string;
  amount?: number;
  paymentStatus?: string | null;
}

export function PaymentRequiredBanner({ jobId, jobTitle, amount, paymentStatus }: PaymentRequiredBannerProps) {
  const [processing, setProcessing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = `payment_banner_dismissed_${jobId}`;
    const val = localStorage.getItem(key);
    if (val) {
      const dismissedAt = parseInt(val, 10);
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      if (now - dismissedAt < oneHour) {
        setDismissed(true);
      } else {
        localStorage.removeItem(key);
      }
    }
  }, [jobId]);

  const handlePayNow = useCallback(async () => {
    setProcessing(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-job-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ jobId }),
        }
      );
      const data = await response.json();
      if (data.url) {
        localStorage.setItem(`payment_banner_dismissed_${jobId}`, String(Date.now()));
        window.location.href = data.url;
      } else if (data.error === 'Payment already completed for this job') {
        localStorage.setItem(`payment_banner_dismissed_${jobId}`, String(Date.now()));
        setDismissed(true);
      } else {
        throw new Error(data.error || 'Failed to create payment session');
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [jobId]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(`payment_banner_dismissed_${jobId}`, String(Date.now()));
    setDismissed(true);
  }, [jobId]);

  if (dismissed) return null;

  const isFunded = paymentStatus === 'funded';
  if (isFunded) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
      <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
        <i className="ri-secure-payment-line text-amber-400 text-xl"></i>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-400">Payment required for: {jobTitle}</p>
        <p className="text-xs text-amber-500">
          Confirm your guard selection and pay to lock in the booking.
          {amount ? ` Estimated total: £${amount.toFixed(2)}` : ''}
        </p>
        {error && (
          <p className="text-xs text-red-400 mt-1">{error}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handlePayNow}
          disabled={processing}
          className={`inline-flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
            processing
              ? 'bg-amber-600/50 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-600'
          }`}
        >
          {processing ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <i className="ri-secure-payment-line"></i>
          )}
          {processing ? 'Processing...' : 'Pay Now'}
        </button>
        <Link
          href={`/client/jobs/${jobId}/payment`}
          className="inline-flex items-center gap-1.5 bg-[#162036] text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]"
        >
          <i className="ri-file-list-3-line"></i>
          Details
        </Link>
        <button
          onClick={handleDismiss}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-500/10 text-amber-500/60 hover:text-amber-400 transition-colors cursor-pointer"
          title="Dismiss"
        >
          <i className="ri-close-line"></i>
        </button>
      </div>
    </div>
  );
}

interface DashboardErrorBannerProps {
  message: string;
  onRetry: () => void;
}

export function DashboardErrorBanner({ message, onRetry }: DashboardErrorBannerProps) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
      <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
        <i className="ri-error-warning-line text-red-400 text-xl"></i>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-400">Could not load dashboard data</p>
        <p className="text-xs text-red-400/70">Some sections may be unavailable. Check your connection and try again.</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 bg-[#162036] text-teal-400 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]"
        >
          <i className="ri-refresh-line"></i>
          Retry
        </button>
        <Link
          href="/client/support"
          className="inline-flex items-center gap-1.5 bg-[#162036] text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]"
        >
          Support
        </Link>
      </div>
    </div>
  );
}