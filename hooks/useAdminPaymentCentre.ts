import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface PlatformOverview {
  totalClientPayments: number;
  fundedPayments: number;
  pendingTransfers: number;
  completedTransfers: number;
  platformFees: number;
  refundsTotal: number;
  disputesCount: number;
  failedTransfers: number;
}

interface StripeHealth {
  totalGuards: number;
  guardsWithStripe: number;
  guardsReady: number;
  guardsPending: number;
  guardsRestricted: number;
  guardsNotStarted: number;
}

interface GuardPayoutRow {
  id: string;
  guardName: string;
  guardEmail: string;
  stripeAccountStatus: string;
  payoutsEnabled: boolean;
  requirementsDueCount: number;
  pendingPayoutAmount: number;
  paidOutAmount: number;
  lastStripeSync: string | null;
  actionRequired: boolean;
}

interface AdminJobPayment {
  id: string;
  jobTitle: string;
  clientName: string;
  guardName: string;
  grossAmount: number;
  platformFee: number;
  netPayout: number;
  paymentStatus: string;
  transferStatus: string;
  stripePaymentIntent: string | null;
  stripeTransferId: string | null;
  createdDate: string;
}

export function useAdminPaymentCentre() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<PlatformOverview>({
    totalClientPayments: 0,
    fundedPayments: 0,
    pendingTransfers: 0,
    completedTransfers: 0,
    platformFees: 0,
    refundsTotal: 0,
    disputesCount: 0,
    failedTransfers: 0,
  });
  const [stripeHealth, setStripeHealth] = useState<StripeHealth>({
    totalGuards: 0,
    guardsWithStripe: 0,
    guardsReady: 0,
    guardsPending: 0,
    guardsRestricted: 0,
    guardsNotStarted: 0,
  });
  const [guardPayouts, setGuardPayouts] = useState<GuardPayoutRow[]>([]);
  const [jobPayments, setJobPayments] = useState<AdminJobPayment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        transRes,
        jobsRes,
        disputesRes,
        guardCountRes,
        guardsWithStripeRes,
        guardsReadyRes,
        guardsPendingRes,
        guardsRestrictedRes,
        guardsNotStartedRes,
        failedPayoutsRes,
        guardListRes,
        payoutsRes,
        assignmentsRes,
      ] = await Promise.all([
        supabase.from('transactions').select('amount, status, refunded, refund_amount').order('created_at', { ascending: false }),
        supabase.from('jobs').select('id, job_title, payment_status, platform_fee, stripe_payment_intent_id, agreed_amount, client_id').eq('is_deleted', false).order('created_at', { ascending: false }),
        supabase.from('disputes').select('*', { count: 'exact', head: true }).in('status', ['open', 'under_review']),
        supabase.from('guards').select('*', { count: 'exact', head: true }),
        supabase.from('guards').select('*', { count: 'exact', head: true }).not('stripe_account_id', 'is', null),
        supabase.from('guards').select('*', { count: 'exact', head: true }).eq('stripe_account_status', 'ready'),
        supabase.from('guards').select('*', { count: 'exact', head: true }).eq('stripe_account_status', 'pending'),
        supabase.from('guards').select('*', { count: 'exact', head: true }).eq('stripe_account_status', 'restricted'),
        supabase.from('guards').select('*', { count: 'exact', head: true }).eq('stripe_account_status', 'not_started').not('stripe_account_id', 'is', null),
        supabase.from('guard_payouts').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('guards').select('id, full_name, email, stripe_account_id, stripe_account_status, stripe_payouts_enabled, stripe_requirements_due, stripe_last_checked_at').order('full_name'),
        supabase.from('guard_payouts').select('guard_id, amount, net_amount, status').order('created_at', { ascending: false }),
        supabase.from('job_assignments').select('id, job_id, guard_id, payment_status, payment_amount').order('created_at', { ascending: false }),
      ]);

      const transactions = transRes.data || [];
      let totalClientPayments = 0;
      let refundsTotal = 0;
      transactions.forEach((t: any) => {
        const amt = Number(t.amount) || 0;
        if (t.status === 'completed' || t.status === 'succeeded') totalClientPayments += amt;
        if (t.refunded) refundsTotal += Number(t.refund_amount) || 0;
      });

      const jobs = jobsRes.data || [];
      const fundedPayments = jobs.filter((j: any) => j.payment_status === 'funded').length;
      const platformFees = jobs.reduce((s: number, j: any) => s + (Number(j.platform_fee) || 0), 0);

      const allPayouts = payoutsRes.data || [];
      const completedTransfers = allPayouts.filter((p: any) => p.status === 'paid' || p.status === 'completed').length;
      const pendingTransfers = allPayouts.filter((p: any) => p.status === 'pending' || p.status === 'initiated' || p.status === 'processing').length;
      const failedTransfers = allPayouts.filter((p: any) => p.status === 'failed').length;

      setOverview({
        totalClientPayments,
        fundedPayments,
        pendingTransfers,
        completedTransfers,
        platformFees,
        refundsTotal,
        disputesCount: disputesRes.count ?? 0,
        failedTransfers,
      });

      setStripeHealth({
        totalGuards: guardCountRes.count ?? 0,
        guardsWithStripe: guardsWithStripeRes.count ?? 0,
        guardsReady: guardsReadyRes.count ?? 0,
        guardsPending: guardsPendingRes.count ?? 0,
        guardsRestricted: guardsRestrictedRes.count ?? 0,
        guardsNotStarted: guardsNotStartedRes.count ?? 0,
      });

      const guards = guardListRes.data || [];
      const payoutAgg: Record<string, { pending: number; paid: number }> = {};
      allPayouts.forEach((p: any) => {
        if (!p.guard_id) return;
        if (!payoutAgg[p.guard_id]) payoutAgg[p.guard_id] = { pending: 0, paid: 0 };
        const net = Number(p.net_amount) || 0;
        if (p.status === 'paid' || p.status === 'completed') payoutAgg[p.guard_id].paid += net;
        else payoutAgg[p.guard_id].pending += net;
      });

      const guardPayoutRows: GuardPayoutRow[] = guards.map((g: any) => {
        const agg = payoutAgg[g.id] || { pending: 0, paid: 0 };
        const reqDue = Array.isArray(g.stripe_requirements_due) ? g.stripe_requirements_due : [];
        return {
          id: g.id,
          guardName: g.full_name || 'Unknown',
          guardEmail: g.email || '—',
          stripeAccountStatus: g.stripe_account_status || 'not_started',
          payoutsEnabled: g.stripe_payouts_enabled || false,
          requirementsDueCount: reqDue.length,
          pendingPayoutAmount: agg.pending,
          paidOutAmount: agg.paid,
          lastStripeSync: g.stripe_last_checked_at,
          actionRequired: g.stripe_account_status === 'restricted' || (g.stripe_account_id && g.stripe_account_status === 'not_started'),
        };
      });
      setGuardPayouts(guardPayoutRows);

      const clientIds = [...new Set(jobs.map((j: any) => j.client_id).filter(Boolean))];
      const guardIds = [...new Set((assignmentsRes.data || []).map((a: any) => a.guard_id).filter(Boolean))];
      let clientMap: Record<string, string> = {};
      let guardMap: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase.from('clients').select('id, company_name').in('id', clientIds as string[]);
        (clients || []).forEach((c: any) => { clientMap[c.id] = c.company_name || 'Unknown'; });
      }
      if (guardIds.length > 0) {
        const { data: gList } = await supabase.from('guards').select('id, full_name').in('id', guardIds as string[]);
        (gList || []).forEach((g: any) => { guardMap[g.id] = g.full_name || 'Unknown'; });
      }

      const assignMap: Record<string, { guardId: string; paymentStatus: string; paymentAmount: number }[]> = {};
      (assignmentsRes.data || []).forEach((a: any) => {
        if (!assignMap[a.job_id]) assignMap[a.job_id] = [];
        assignMap[a.job_id].push({ guardId: a.guard_id, paymentStatus: a.payment_status, paymentAmount: Number(a.payment_amount) || 0 });
      });

      const payoutByJobGuard: Record<string, { transferId: string | null; netAmount: number; status: string }> = {};
      allPayouts.forEach((p: any) => {
        if (p.assignment_id) {
          const key = `${p.job_id || ''}_${p.assignment_id}`;
          payoutByJobGuard[key] = { transferId: p.stripe_transfer_id, netAmount: Number(p.net_amount) || 0, status: p.status };
        }
      });

      const adminJobPayments: AdminJobPayment[] = jobs.slice(0, 200).map((j: any) => {
        const assigns = assignMap[j.id] || [];
        const guardName = assigns.map(a => guardMap[a.guardId] || '—').join(', ') || '—';
        const gross = Number(j.agreed_amount) || assigns.reduce((s, a) => s + a.paymentAmount, 0);
        const fee = Number(j.platform_fee) || 0;
        const firstAssign = assigns[0];
        const payoutKey = firstAssign ? `${j.id}_${firstAssign.guardId}` : '';
        const payoutInfo = payoutByJobGuard[payoutKey];
        return {
          id: j.id,
          jobTitle: j.job_title || 'Untitled',
          clientName: clientMap[j.client_id] || '—',
          guardName,
          grossAmount: gross,
          platformFee: fee,
          netPayout: gross - fee,
          paymentStatus: j.payment_status || 'unpaid',
          transferStatus: payoutInfo?.status || '—',
          stripePaymentIntent: j.stripe_payment_intent_id || null,
          stripeTransferId: payoutInfo?.transferId || null,
          createdDate: j.created_at || '',
        };
      });
      setJobPayments(adminJobPayments);
    } catch (err) {
      setError('Failed to load admin payment data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const exportGuardPayoutsCsv = useCallback(() => {
    const headers = ['Guard Name', 'Email', 'Stripe Status', 'Payouts Enabled', 'Requirements Due', 'Pending Payout', 'Paid Out', 'Action Required'];
    const rows = guardPayouts.map(g => [
      g.guardName,
      g.guardEmail,
      g.stripeAccountStatus,
      g.payoutsEnabled ? 'Yes' : 'No',
      g.requirementsDueCount,
      g.pendingPayoutAmount.toFixed(2),
      g.paidOutAmount.toFixed(2),
      g.actionRequired ? 'Yes' : 'No',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-guard-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [guardPayouts]);

  const exportJobPaymentsCsv = useCallback(() => {
    const headers = ['Job', 'Client', 'Guard', 'Gross', 'Platform Fee', 'Net', 'Payment Status', 'Transfer Status', 'Stripe PI', 'Stripe Transfer', 'Date'];
    const rows = jobPayments.map(p => [
      p.jobTitle,
      p.clientName,
      p.guardName,
      p.grossAmount.toFixed(2),
      p.platformFee.toFixed(2),
      p.netPayout.toFixed(2),
      p.paymentStatus,
      p.transferStatus,
      p.stripePaymentIntent || '—',
      p.stripeTransferId || '—',
      p.createdDate,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-job-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [jobPayments]);

  return {
    loading,
    error,
    overview,
    stripeHealth,
    guardPayouts,
    jobPayments,
    refetch: fetchAll,
    exportGuardPayoutsCsv,
    exportJobPaymentsCsv,
  };
}