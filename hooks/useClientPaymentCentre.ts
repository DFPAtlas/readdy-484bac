import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface SpendingSummary {
  thisMonthSpend: number;
  totalSpend: number;
  jobsPaid: number;
  outstandingAmount: number;
  refundsTotal: number;
}

interface BillingInfo {
  stripeCustomerId: string | null;
  stripeCustomerStatus: 'active' | 'not_set_up';
  billingPortalLastOpened: string | null;
  defaultPaymentMethod: string | null;
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
  refundStatus: string;
  receiptUrl: string | null;
  invoiceUrl: string | null;
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
    refundsTotal: 0,
  });
  const [billingInfo, setBillingInfo] = useState<BillingInfo>({
    stripeCustomerId: null,
    stripeCustomerStatus: 'not_set_up',
    billingPortalLastOpened: null,
    defaultPaymentMethod: null,
    subscriptionStatus: 'Free',
    planName: 'Free',
  });
  const [jobPayments, setJobPayments] = useState<JobPayment[]>([]);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: client } = await supabase
        .from('clients')
        .select('id, stripe_customer_id, stripe_customer_created_at, stripe_billing_portal_last_opened_at, subscription_status, subscription_tier, plan_name, total_spent')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!client) { setLoading(false); return; }
      setClientId(client.id);

      setBillingInfo({
        stripeCustomerId: client.stripe_customer_id || null,
        stripeCustomerStatus: client.stripe_customer_id ? 'active' : 'not_set_up',
        billingPortalLastOpened: client.stripe_billing_portal_last_opened_at || null,
        defaultPaymentMethod: client.stripe_customer_id ? 'Card on file' : null,
        subscriptionStatus: client.subscription_status || 'Free',
        planName: client.plan_name || client.subscription_tier || 'Free',
      });

      const { data: transactions } = await supabase
        .from('transactions')
        .select('id, job_id, amount, status, created_at, receipt_url, invoice_url, refunded, refund_amount, refunded_at')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      const txData = transactions || [];
      let totalSpend = 0;
      let thisMonthSpend = 0;
      let jobsPaid = 0;
      let outstanding = 0;
      let refundsTotal = 0;

      txData.forEach((t: any) => {
        const amt = Number(t.amount) || 0;
        if (t.status === 'completed' || t.status === 'succeeded') {
          totalSpend += amt;
          jobsPaid++;
          const d = new Date(t.created_at);
          if (d >= new Date(monthStart)) thisMonthSpend += amt;
        } else if (t.status === 'pending' || t.status === 'pending_payment') {
          outstanding += amt;
        }
        if (t.refunded) {
          refundsTotal += Number(t.refund_amount) || 0;
        }
      });

      setSpendingSummary({ thisMonthSpend, totalSpend, jobsPaid, outstandingAmount: outstanding, refundsTotal });

      const jobIds = txData.map((t: any) => t.job_id).filter(Boolean);
      let jobsMap: Record<string, any> = {};
      let guardMap: Record<string, string> = {};

      if (jobIds.length > 0) {
        const { data: jobsData } = await supabase
          .from('jobs')
          .select('id, job_title, payment_status')
          .in('id', jobIds);
        if (jobsData) jobsMap = Object.fromEntries(jobsData.map((j: any) => [j.id, j]));

        const { data: assignments } = await supabase
          .from('job_assignments')
          .select('job_id, guard_id')
          .in('job_id', jobIds);
        if (assignments && assignments.length > 0) {
          const guardIds = [...new Set(assignments.map((a: any) => a.guard_id).filter(Boolean))];
          if (guardIds.length > 0) {
            const { data: guardsData } = await supabase
              .from('guards')
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
        refundStatus: t.refunded ? 'Refunded' : '—',
        receiptUrl: t.receipt_url || null,
        invoiceUrl: t.invoice_url || null,
        jobId: t.job_id,
      }));

      setJobPayments(paymentsList);
    } catch (err) {
      setError('Failed to load payment data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
    const headers = ['Date', 'Job Title', 'Guard', 'Amount Paid', 'Payment Status', 'Release Status', 'Refund Status'];
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