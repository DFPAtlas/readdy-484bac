import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface EarningsSummary {
  availableBalance: number;
  pendingBalance: number;
  thisMonthEarnings: number;
  lifetimeEarnings: number;
  nextEstimatedPayout: string;
}

interface StripeStatus {
  connected: boolean;
  stripeAccountId: string | null;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  status: string;
  requirementsDue: string[];
  restrictedReason: string | null;
  lastCheckedAt: string | null;
}

interface JobPayment {
  id: string;
  date: string;
  jobTitle: string;
  clientName: string;
  grossAmount: number;
  platformFee: number;
  netPayout: number;
  paymentStatus: string;
  transferStatus: string;
  assignmentId: string;
  payoutId: string | null;
  receiptUrl: string | null;
}

interface GuardPayout {
  id: string;
  amount: number;
  feeDeducted: number;
  netAmount: number;
  status: string;
  stripeTransferId: string | null;
  referenceNumber: string;
  created_at: string;
}

export function useGuardPaymentCentre() {
  const [loading, setLoading] = useState(true);
  const [guardId, setGuardId] = useState<string | null>(null);
  const [earningsSummary, setEarningsSummary] = useState<EarningsSummary>({
    availableBalance: 0,
    pendingBalance: 0,
    thisMonthEarnings: 0,
    lifetimeEarnings: 0,
    nextEstimatedPayout: '—',
  });
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [jobPayments, setJobPayments] = useState<JobPayment[]>([]);
  const [payouts, setPayouts] = useState<GuardPayout[]>([]);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: guard } = await supabase
        .from('guards')
        .select('id, stripe_account_id, stripe_account_status, stripe_details_submitted, stripe_charges_enabled, stripe_payouts_enabled, stripe_requirements_due, stripe_last_checked_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!guard) { setLoading(false); return; }
      setGuardId(guard.id);

      const [assignmentsRes, payoutsRes] = await Promise.all([
        supabase
          .from('job_assignments')
          .select('id, job_id, guard_id, payment_status, payment_amount, created_at, payout_id')
          .eq('guard_id', guard.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('guard_payouts')
          .select('*')
          .eq('guard_id', guard.id)
          .order('created_at', { ascending: false }),
      ]);

      const assignments = assignmentsRes.data || [];
      const payoutData = payoutsRes.data || [];

      const jobIds = [...new Set(assignments.map((a: any) => a.job_id).filter(Boolean))];
      let jobsMap: Record<string, any> = {};
      let clientMap: Record<string, string> = {};
      if (jobIds.length > 0) {
        const { data: jobsData } = await supabase
          .from('jobs')
          .select('id, job_title, start_date, client_id')
          .in('id', jobIds);
        if (jobsData) {
          jobsMap = Object.fromEntries(jobsData.map((j: any) => [j.id, j]));
          const clientIds = [...new Set(jobsData.map((j: any) => j.client_id).filter(Boolean))];
          if (clientIds.length > 0) {
            const { data: clientsData } = await supabase
              .from('clients')
              .select('id, company_name')
              .in('id', clientIds as string[]);
            if (clientsData) {
              clientMap = Object.fromEntries(clientsData.map((c: any) => [c.id, c.company_name || 'Unknown Client']));
            }
          }
        }
      }

      const payoutMap: Record<string, any> = {};
      payoutData.forEach((p: any) => {
        if (p.assignment_id) payoutMap[p.assignment_id] = p;
      });

      let lifetime = 0;
      let thisMonth = 0;
      let pending = 0;
      let available = 0;

      const jobPaymentsList: JobPayment[] = assignments.map((a: any) => {
        const payout = payoutMap[a.id];
        const gross = Number(a.payment_amount) || 0;
        const fee = payout ? Number(payout.fee_deducted) || 0 : 0;
        const net = payout ? Number(payout.net_amount) || 0 : gross - fee;

        const isPaid = payout && (payout.status === 'paid' || payout.status === 'completed');
        const isPending = !payout || payout.status === 'pending' || payout.status === 'initiated' || payout.status === 'processing';

        if (isPaid) {
          lifetime += gross;
          available += net;
          const d = new Date(jobsMap[a.job_id]?.start_date || a.created_at);
          if (d >= new Date(monthStart)) thisMonth += gross;
        }
        if (isPending) {
          pending += gross;
        }

        return {
          id: a.id,
          date: a.created_at,
          jobTitle: jobsMap[a.job_id]?.job_title || 'Unknown Job',
          clientName: clientMap[jobsMap[a.job_id]?.client_id] || 'Unknown Client',
          grossAmount: gross,
          platformFee: fee,
          netPayout: net,
          paymentStatus: a.payment_status || 'pending',
          transferStatus: payout?.status || 'pending',
          assignmentId: a.id,
          payoutId: payout?.id || null,
          receiptUrl: null,
        };
      });

      const nextFriday = new Date();
      nextFriday.setDate(nextFriday.getDate() + ((5 + 7 - nextFriday.getDay()) % 7 || 7));
      const nextPayoutStr = nextFriday.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

      setEarningsSummary({
        availableBalance: available,
        pendingBalance: pending,
        thisMonthEarnings: thisMonth,
        lifetimeEarnings: lifetime,
        nextEstimatedPayout: nextPayoutStr,
      });

      setJobPayments(jobPaymentsList);

      setPayouts(payoutData.map((p: any) => ({
        id: p.id,
        amount: Number(p.amount) || 0,
        feeDeducted: Number(p.fee_deducted) || 0,
        netAmount: Number(p.net_amount) || 0,
        status: p.status,
        stripeTransferId: p.stripe_transfer_id,
        referenceNumber: p.reference_number || '',
        created_at: p.created_at,
      })));

      if (guard.stripe_account_id) {
        setStripeStatus({
          connected: true,
          stripeAccountId: guard.stripe_account_id,
          detailsSubmitted: guard.stripe_details_submitted || false,
          chargesEnabled: guard.stripe_charges_enabled || false,
          payoutsEnabled: guard.stripe_payouts_enabled || false,
          status: guard.stripe_account_status || 'not_started',
          requirementsDue: Array.isArray(guard.stripe_requirements_due) ? guard.stripe_requirements_due : [],
          restrictedReason: null,
          lastCheckedAt: guard.stripe_last_checked_at,
        });
      }
    } catch (err) {
      setError('Failed to load payment data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const refreshStripeStatus = useCallback(async () => {
    setStripeLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-guard-stripe-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      if (res.ok) {
        const status = await res.json();
        setStripeStatus(status);
      }
    } catch (err) {
      console.error('Error refreshing stripe status:', err);
    } finally {
      setStripeLoading(false);
    }
  }, []);

  const handleConnectStripe = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Session expired');
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-guard-connect-account`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` } }
    );
    if (!res.ok) throw new Error('Failed to connect');
    const { url } = await res.json();
    return url;
  }, []);

  const handleOnboardingLink = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Session expired');
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-guard-onboarding-link`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` } }
    );
    if (!res.ok) throw new Error('Failed to get onboarding link');
    const { url } = await res.json();
    return url;
  }, []);

  const handleDashboardLink = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Session expired');
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-guard-dashboard-link`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` } }
    );
    if (!res.ok) throw new Error('Failed to get dashboard link');
    const { url } = await res.json();
    return url;
  }, []);

  const exportCsv = useCallback(() => {
    const headers = ['Date', 'Job Title', 'Client', 'Gross Amount', 'Platform Fee', 'Net Payout', 'Payment Status', 'Transfer Status'];
    const rows = jobPayments.map(p => [
      p.date,
      p.jobTitle,
      p.clientName,
      p.grossAmount.toFixed(2),
      p.platformFee.toFixed(2),
      p.netPayout.toFixed(2),
      p.paymentStatus,
      p.transferStatus,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guard-payment-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [jobPayments]);

  return {
    loading,
    error,
    guardId,
    earningsSummary,
    stripeStatus,
    stripeLoading,
    jobPayments,
    payouts,
    refreshStripeStatus,
    handleConnectStripe,
    handleOnboardingLink,
    handleDashboardLink,
    exportCsv,
    refetch: fetchAll,
  };
}