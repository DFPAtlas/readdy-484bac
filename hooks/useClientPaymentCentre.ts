import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { clientSpendingSummary, loadClientFinanceRecords, paymentRefundLabel } from '@/lib/client-finance';
import { planLabel } from '@/lib/client-journey';
import { paymentDocumentLink, paymentDocumentMode } from '@/lib/client-payment-documents';

interface SpendingSummary {
  thisMonthSpend: number;
  totalSpend: number;
  jobsPaid: number;
  outstandingAmount: number;
  outstandingUnknownJobs: number;
  refundsTotal: number;
  netSpend: number;
}

interface BillingInfo {
  stripeCustomerId: string | null;
  billingPortalLastOpened: string | null;
  subscriptionStatus: string;
  planName: string;
}

export interface JobPayment {
  id: string;
  date: string;
  jobTitle: string;
  guardName: string;
  amountPaid: number;
  paymentStatus: string;
  releaseStatus: string;
  jobStatus: string;
  refundStatus: string;
  receiptUrl: string | null;
  invoiceUrl: string | null;
  documentMode: 'live' | 'test' | 'unknown';
  jobId: string;
}

export function useClientPaymentCentre() {
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [spendingSummary, setSpendingSummary] = useState<SpendingSummary>({
    thisMonthSpend: 0,
    totalSpend: 0,
    jobsPaid: 0,
    outstandingAmount: 0,
    outstandingUnknownJobs: 0,
    refundsTotal: 0,
    netSpend: 0,
  });
  const [billingInfo, setBillingInfo] = useState<BillingInfo>({
    stripeCustomerId: null,
    billingPortalLastOpened: null,
    subscriptionStatus: 'Free',
    planName: 'Free',
  });
  const [jobPayments, setJobPayments] = useState<JobPayment[]>([]);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(false);
  const request = useRef(0);
  const invalidate = useCallback(() => { request.current++; }, []);
  const fetchAll = useCallback(async () => {
    const id = ++request.current;
    const current = () => mounted.current && request.current === id;
    if (!current()) return;

    setLoading(true);
    setClientId(null);
    setJobPayments([]);
    setError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!current()) return;
      if (authError || !user) throw new Error('Sign in to load payments.');

      const { data: client } = await supabase
        .from('clients')
        .select('id, stripe_customer_id, stripe_customer_created_at, stripe_billing_portal_last_opened_at, subscription_status, subscription_tier, plan_name, total_spent')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!current()) return;
      if (!client) throw new Error('Client payments unavailable.');
      setClientId(client.id);

      setBillingInfo({
        stripeCustomerId: client.stripe_customer_id || null,
        billingPortalLastOpened: client.stripe_billing_portal_last_opened_at || null,
        subscriptionStatus: client.subscription_status || 'Free',
        planName: planLabel(client.plan_name || client.subscription_tier),
      });

      const { transactions: txData, payableJobs } = await loadClientFinanceRecords(supabase, client.id, user.id);
      if (!current()) return;
      const summary = clientSpendingSummary(txData, payableJobs);

      const jobIds = txData.map((t: any) => t.job_id).filter(Boolean);
      const refundMap: Record<string, string> = {};
      let jobsMap: Record<string, any> = {};
      const guardMap: Record<string, string> = {};

      if (jobIds.length > 0) {
        const {data: requests, error: requestError} = await supabase.schema('app').from('refund_requests').select('job_id, status').in('job_id', jobIds).order('created_at', {ascending:false});
        if (requestError) throw requestError;
        (requests || []).forEach((request: any) => {if (!refundMap[request.job_id]) refundMap[request.job_id] = request.status;});
        const { data: jobsData } = await supabase
          .from('jobs')
          .select('id, job_title, payment_status, status')
          .in('id', jobIds).eq('client_id', client.id);
        if (jobsData) jobsMap = Object.fromEntries(jobsData.map((j: any) => [j.id, j]));

        const { data: assignments } = await supabase
          .from('job_assignments')
          .select('job_id, guard_id')
          .in('job_id', jobIds);
        if (assignments && assignments.length > 0) {
          const guardIds = [...new Set(assignments.map((a: any) => a.guard_id).filter(Boolean))];
          if (guardIds.length > 0) {
            const { data: guardsData } = await supabase
              .from('guard_public_profiles')
              .select('id, full_name')
              .in('id', guardIds as string[]);
            if (guardsData) {
              const gMap = Object.fromEntries(guardsData.map((g: any) => [g.id, g.full_name || 'Unknown']));
              assignments.forEach((a: any) => {
                if (gMap[a.guard_id]) guardMap[a.job_id] = gMap[a.guard_id];
              });
            }
          }
        }
      }

      const paymentsList: JobPayment[] = txData.map((t: any) => ({
        id: t.id,
        date: t.created_at,
        jobTitle: jobsMap[t.job_id]?.job_title || 'Job Payment',
        guardName: guardMap[t.job_id] || '—',
        amountPaid: Number(t.amount) || 0,
        paymentStatus: t.status,
        releaseStatus: jobsMap[t.job_id]?.payment_status || t.status,
        jobStatus: jobsMap[t.job_id]?.status || '',
        refundStatus: paymentRefundLabel(t) !== '—' ? paymentRefundLabel(t) : refundMap[t.job_id] === 'pending' ? 'Refund requested' : refundMap[t.job_id] === 'approved' ? 'Refund processing' : refundMap[t.job_id] === 'rejected' ? 'Refund declined' : '—',
        receiptUrl: paymentDocumentLink(t.receipt_url, 'receipt'),
        invoiceUrl: paymentDocumentLink(t.invoice_url, 'invoice'),
        documentMode: paymentDocumentMode(t.stripe_session_id),
        jobId: t.job_id,
      }));

      if (!current()) return;
      setSpendingSummary(summary);
      setJobPayments(paymentsList);
    } catch {
      if (current()) setError('Failed to load payment data');
    } finally {
      if (current()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void fetchAll();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        request.current++;
        setClientId(null);
        setJobPayments([]);
        setLoading(true);
        // Start outside the auth callback to avoid awaiting another auth call
        // while the Supabase auth lock is held.
        setTimeout(() => { if (mounted.current) void fetchAll(); }, 0);
      }
    });
    return () => { mounted.current = false; invalidate(); subscription.unsubscribe(); };
  }, [fetchAll, invalidate]);

  const handleBillingPortal = useCallback(async (): Promise<string | null> => {
    setPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-client-billing-portal`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` } }
      );
      if (!res.ok) throw new Error('Failed to open billing portal');
      const { url } = await res.json();
      return url;
    } finally {
      setPortalLoading(false);
    }
  }, []);

  const exportCsv = useCallback(() => {
    const headers = ['Date', 'Job Title', 'Guard', 'Payment Amount', 'Payment Status', 'Release Status', 'Refund Status'];
    const rows = jobPayments.map(p => [
      p.date,
      p.jobTitle,
      p.guardName,
      p.amountPaid.toFixed(2),
      p.paymentStatus,
      p.releaseStatus,
      p.refundStatus,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client-payment-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [jobPayments]);

  return {
    loading,
    error,
    clientId,
    spendingSummary,
    billingInfo,
    jobPayments,
    portalLoading,
    handleBillingPortal,
    exportCsv,
    refetch: fetchAll,
  };
}
