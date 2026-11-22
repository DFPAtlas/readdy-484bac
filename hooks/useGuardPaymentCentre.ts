import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { loadGuardHistoryJobs } from '@/lib/guard-bookings';
import { useGuardPayoutSettings } from '@/hooks/useGuardPayoutSettings';
import { requestGuardStripe, type GuardStripeAction } from '@/lib/guard-payout-settings';
import { deriveGuardPaymentDisplayStatus } from '@/lib/payments/guardPaymentDisplay';

interface EarningsSummary {
  availableBalance: number;
  pendingBalance: number;
  thisMonthEarnings: number;
  lifetimeEarnings: number;
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
  jobStatus: string;
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
  const payoutSettings = useGuardPayoutSettings(true);
  const [loading, setLoading] = useState(true);
  const [guardId, setGuardId] = useState<string | null>(null);
  const [earningsSummary, setEarningsSummary] = useState<EarningsSummary>({
    availableBalance: 0,
    pendingBalance: 0,
    thisMonthEarnings: 0,
    lifetimeEarnings: 0,
  });
  const [jobPayments, setJobPayments] = useState<JobPayment[]>([]);
  const [payouts, setPayouts] = useState<GuardPayout[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: guard, error: guardError } = await supabase
        .from('guards')
        .select('id, stripe_account_id, stripe_account_status, stripe_details_submitted, stripe_charges_enabled, stripe_payouts_enabled, stripe_requirements_due, stripe_last_checked_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (guardError) throw guardError;
      if (!guard) throw new Error('Guard profile unavailable');
      setGuardId(guard.id);

      const [assignmentsRes, payoutsRes] = await Promise.all([
        supabase
          .from('job_assignments')
          .select('id, job_id, guard_id, payment_status, payment_amount, gross_guard_amount, guard_net_payout, assigned_at, payout_id, status')
          .eq('guard_id', guard.id)
          .order('assigned_at', { ascending: false }),
        supabase
          .from('guard_payouts')
          .select('*')
          .eq('guard_id', guard.id)
          .order('created_at', { ascending: false }),
      ]);

      const assignments = assignmentsRes.data || [];
      const payoutData = payoutsRes.data || [];

      if (assignmentsRes.error) throw assignmentsRes.error;
      if (payoutsRes.error) throw payoutsRes.error;
      const historyJobs = assignments.length ? await loadGuardHistoryJobs(supabase, guard.id) : [];
      const jobsMap: Record<string, any> = Object.fromEntries(historyJobs.map(job => [job.id, job]));
      if (assignments.some((a: any) => !jobsMap[a.job_id])) throw new Error('Booking data unavailable');

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
        const gross = Number(a.gross_guard_amount ?? a.payment_amount ?? jobsMap[a.job_id]?.guard_payout_amount ?? jobsMap[a.job_id]?.agreed_amount ?? 0);
        const fee = payout ? Number(payout.fee_deducted) || 0 : 0;
        const net = payout ? Number(payout.net_amount ?? gross - fee) : Number(a.guard_net_payout ?? gross - fee);

        const transferStatus = deriveGuardPaymentDisplayStatus({
          payoutStatus: payout?.status,
          jobStatus: jobsMap[a.job_id]?.status,
          jobPaymentStatus: jobsMap[a.job_id]?.payment_status,
          assignmentStatus: a.status,
          assignmentPaymentStatus: a.payment_status,
        });
        const isPaid = ['paid', 'completed', 'paid_out'].includes(transferStatus);
        const isPending = !['cancelled', 'refunded'].includes(a.status) && ['funded', 'completed', 'released'].includes(jobsMap[a.job_id]?.payment_status) && (!payout || ['pending', 'initiated', 'processing', 'held'].includes(payout.status));

        if (isPaid) {
          lifetime += gross;
          available += net;
          const d = new Date(jobsMap[a.job_id]?.start_date || a.assigned_at);
          if (d >= new Date(monthStart)) thisMonth += gross;
        }
        if (isPending) {
          pending += net;
        }

        return {
          id: a.id,
          date: a.assigned_at,
          jobTitle: jobsMap[a.job_id]?.job_title || 'Unknown Job',
          clientName: jobsMap[a.job_id]?.clients?.company_name || 'Unknown Client',
          grossAmount: gross,
          platformFee: fee,
          netPayout: net,
          paymentStatus: jobsMap[a.job_id]?.payment_status || a.payment_status || 'pending',
          jobStatus: jobsMap[a.job_id]?.status || a.status,
          transferStatus,
          assignmentId: a.id,
          payoutId: payout?.id || null,
          receiptUrl: null,
        };
      });

      setEarningsSummary({
        availableBalance: available,
        pendingBalance: pending,
        thisMonthEarnings: thisMonth,
        lifetimeEarnings: lifetime,
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


    } catch {
      setError('Failed to load payment data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openAccountLink = useCallback(async (action: GuardStripeAction): Promise<string | null> => {
    if (!payoutSettings.profile || !payoutSettings.status || payoutSettings.loading || payoutSettings.refreshing) {
      throw new Error('Refresh and verify your payout account before opening Stripe.');
    }
    if (action === 'create-guard-connect-account' ? payoutSettings.status.connected : !payoutSettings.status.connected) {
      throw new Error('Your payout setup has changed. Refresh its status.');
    }
    const data = await requestGuardStripe(supabase, action, payoutSettings.profile.userId, {
      baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!, publishableKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    });
    const after = await supabase.auth.getUser();
    if (after.error || after.data.user?.id !== payoutSettings.profile.userId) throw new Error("Your account changed. Please reload.");
    return data.url;
  }, [payoutSettings.profile, payoutSettings.status, payoutSettings.loading, payoutSettings.refreshing]);
  const handleConnectStripe = useCallback(() => openAccountLink('create-guard-connect-account'), [openAccountLink]);
  const handleOnboardingLink = useCallback(() => openAccountLink('create-guard-onboarding-link'), [openAccountLink]);
  const handleDashboardLink = useCallback(() => openAccountLink('create-guard-dashboard-link'), [openAccountLink]);

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
    stripeStatus: payoutSettings.status,
    stripeLoading: payoutSettings.loading || payoutSettings.refreshing,
    stripeError: payoutSettings.error || payoutSettings.statusError,
    jobPayments,
    payouts,
    refreshStripeStatus: payoutSettings.refresh,
    handleConnectStripe,
    handleOnboardingLink,
    handleDashboardLink,
    exportCsv,
    refetch: fetchAll,
  };
}
