'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { supabase } from '@/lib/supabase';
import { logAdminAction } from '@/lib/admin-logger';

interface FailedPayment {
  id: string;
  subscription_id: string;
  stripe_subscription_id: string | null;
  client_name: string;
  client_email: string;
  plan_name: string;
  amount: number;
  failure_reason: string;
  failed_at: string | null;
  created_at: string;
  status: string;
}

const PAGE_SIZE = 10;

export default function FailedPayments() {
  const [payments, setPayments] = useState<FailedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [confirmModal, setConfirmModal] = useState<FailedPayment | null>(null);
  const safeRouter = useSafeRouter();
  const admin = useAdminAuth();
  const canRetry = admin.role === 'super_admin' || admin.role === 'finance_admin';

  const fetchFailedPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: spData, error: spError, count } = await supabase
        .from('subscription_payments')
        .select('id, subscription_id, amount, status, failure_reason, failed_at, created_at', { count: 'exact' })
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (spError) {
        setError(spError.message);
        console.error('subscription_payments error:', spError);
        setLoading(false);
        return;
      }

      setTotalCount(count || 0);

      if (!spData || spData.length === 0) {
        setPayments([]);
        setLoading(false);
        return;
      }

      const subscriptionIds = [...new Set(spData.map(p => p.subscription_id).filter(Boolean))];

      let subsMap = new Map<string, any>();
      if (subscriptionIds.length > 0) {
        const { data: subsData, error: subsError } = await supabase
          .from('subscriptions')
          .select('id, stripe_subscription_id, plan_name, user_id, client_id')
          .in('id', subscriptionIds);

        if (subsError) console.error('subscriptions fetch error:', subsError);
        (subsData || []).forEach(s => subsMap.set(s.id, s));
      }

      const clientIds = [...new Set(
        Array.from(subsMap.values()).map((s: any) => s.client_id).filter(Boolean)
      )];
      const userIds = [...new Set(
        Array.from(subsMap.values()).map((s: any) => s.user_id).filter(Boolean)
      )];

      let clientsMap = new Map<string, any>();
      let usersMap = new Map<string, any>();

      if (clientIds.length > 0) {
        const { data: cData } = await supabase
          .from('clients')
          .select('id, company_name, email, first_name, last_name')
          .in('id', clientIds);
        (cData || []).forEach(c => clientsMap.set(c.id, c));
      }

      if (userIds.length > 0) {
        const { data: uData } = await supabase
          .from('clients')
          .select('user_id, company_name, email, first_name, last_name')
          .in('user_id', userIds);
        (uData || []).forEach(u => usersMap.set(u.user_id, u));
      }

      const formatted: FailedPayment[] = spData.map(p => {
        const sub = p.subscription_id ? subsMap.get(p.subscription_id) : null;
        const client = sub?.client_id ? clientsMap.get(sub.client_id) : null;
        const clientByUser = sub?.user_id ? usersMap.get(sub.user_id) : null;

        const resolvedClient = client || clientByUser;
        const clientName = resolvedClient?.company_name ||
          (resolvedClient?.first_name && resolvedClient?.last_name
            ? `${resolvedClient.first_name} ${resolvedClient.last_name}`
            : null) ||
          'Unknown Client';
        const clientEmail = resolvedClient?.email || '—';

        return {
          id: p.id,
          subscription_id: p.subscription_id || '',
          stripe_subscription_id: sub?.stripe_subscription_id || null,
          client_name: clientName,
          client_email: clientEmail,
          plan_name: sub?.plan_name || '—',
          amount: Number(p.amount) || 0,
          failure_reason: p.failure_reason || 'Unknown error',
          failed_at: p.failed_at || p.created_at,
          created_at: p.created_at,
          status: p.status,
        };
      });

      setPayments(formatted);
    } catch (err: any) {
      console.error('Error fetching failed payments:', err);
      setError(err?.message || 'Failed to load failed payments');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchFailedPayments();
  }, [fetchFailedPayments]);

  const handleRetryPayment = async (payment: FailedPayment) => {
    if (!payment.stripe_subscription_id) {
      setToast({ message: 'No Stripe subscription ID available', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setConfirmModal(null);

    try {
      setRetrying(payment.stripe_subscription_id);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/retry-failed-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            subscription_id: payment.stripe_subscription_id,
            payment_id: payment.id,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        await logAdminAction({
          actionType: 'payment_retry',
          actionDescription: `Retried failed payment for ${payment.client_name} (${payment.plan_name}) — Success`,
          targetType: 'subscription',
          targetName: payment.client_name,
          metadata: {
            stripe_subscription_id: payment.stripe_subscription_id,
            client_email: payment.client_email,
            amount: payment.amount,
            plan_name: payment.plan_name,
          },
        });

        setToast({ message: `Payment retry successful — ${result.client_name || payment.client_name}`, type: 'success' });
        setTimeout(() => setToast(null), 3000);
        fetchFailedPayments();
      } else {
        await logAdminAction({
          actionType: 'payment_retry',
          actionDescription: `Retried failed payment for ${payment.client_name} (${payment.plan_name}) — Failed: ${result.message || 'Unknown error'}`,
          targetType: 'subscription',
          targetName: payment.client_name,
          metadata: {
            stripe_subscription_id: payment.stripe_subscription_id,
            error_message: result.message,
            client_email: payment.client_email,
            amount: payment.amount,
          },
        });

        setToast({ message: result.message || 'Failed to retry payment', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (error: any) {
      console.error('Error retrying payment:', error);

      await logAdminAction({
        actionType: 'payment_retry',
        actionDescription: `Retried failed payment for ${payment.client_name} (${payment.plan_name}) — Failed: ${error?.message || 'Unknown error'}`,
        targetType: 'subscription',
        targetName: payment.client_name,
        metadata: {
          stripe_subscription_id: payment.stripe_subscription_id,
          error_message: error?.message,
          client_email: payment.client_email,
          amount: payment.amount,
        },
      });

      setToast({ message: error?.message || 'Failed to retry payment', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setRetrying(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  if (loading && payments.length === 0) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading failed payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] py-8">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="p-6 border-b border-[#1a2b4a]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                  <i className="ri-error-warning-line text-amber-400 text-xl w-5 h-5 flex items-center justify-center"></i>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Confirm Payment Retry</h3>
                  <p className="text-sm text-slate-400">This will attempt a real Stripe charge</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-[#0a1628] rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Client</span>
                  <span className="text-sm font-medium text-white">{confirmModal.client_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Plan</span>
                  <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-full whitespace-nowrap">{confirmModal.plan_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Amount</span>
                  <span className="text-sm font-semibold text-white">£{Number(confirmModal.amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Stripe Subscription</span>
                  <span className="text-xs text-slate-500 font-mono">{confirmModal.stripe_subscription_id}</span>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
                <i className="ri-information-line text-amber-400 w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5"></i>
                <p className="text-sm text-amber-300">The customer&apos;s default payment method will be charged. If the payment method is expired, the retry will fail.</p>
              </div>
            </div>

            <div className="p-6 border-t border-[#1a2b4a] flex gap-3 justify-end">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-5 py-2.5 bg-[#1a2b4a] text-slate-300 rounded-lg hover:bg-[#243656] transition-colors whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRetryPayment(confirmModal)}
                className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line text-sm"></i></div>
                Confirm Retry
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#111d35] border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => safeRouter.push('/admin/dashboard')}
                className="w-10 h-10 flex items-center justify-center hover:bg-[#1a2b4a] rounded-lg transition-colors"
              >
                <i className="ri-arrow-left-line text-xl w-5 h-5 flex items-center justify-center text-slate-400"></i>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Failed Payments</h1>
                <p className="text-sm text-slate-400">Manage and retry failed subscription payments</p>
              </div>
            </div>
            <button
              onClick={fetchFailedPayments}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line text-sm"></i></div>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
            <div className="w-5 h-5 flex items-center justify-center mt-0.5">
              <i className="ri-error-warning-line text-red-400 text-lg"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-400">Error loading payments</p>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        )}

        <div className="bg-[#111d35] rounded-xl border border-[#1a2b4a] overflow-hidden">
          {payments.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-checkbox-circle-line text-3xl text-emerald-400 w-8 h-8 flex items-center justify-center"></i>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No Failed Payments</h3>
              <p className="text-slate-400">All subscription payments are processing successfully.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#0a1628] border-b border-[#1a2b4a]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Client</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Failure Reason</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Failed Date</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2b4a]">
                    {payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-[#0a1628]">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-white">{payment.client_name}</div>
                            <div className="text-sm text-slate-400">{payment.client_email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-sm font-medium rounded-full whitespace-nowrap">
                            {payment.plan_name}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-white">£{Number(payment.amount).toFixed(2)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-2">
                            <div className="w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0">
                              <i className="ri-error-warning-line text-red-400 text-sm"></i>
                            </div>
                            <span className="text-sm text-slate-300">{payment.failure_reason}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400 whitespace-nowrap">
                          {payment.failed_at
                            ? new Date(payment.failed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              if (!payment.stripe_subscription_id) {
                                setToast({ message: 'No Stripe subscription ID available', type: 'error' });
                                setTimeout(() => setToast(null), 3000);
                                return;
                              }
                              if (!canRetry) {
                                setToast({ message: 'Only super_admin or finance_admin can retry payments', type: 'error' });
                                setTimeout(() => setToast(null), 3000);
                                return;
                              }
                              setConfirmModal(payment);
                            }}
                            disabled={retrying === payment.stripe_subscription_id || !payment.stripe_subscription_id}
                            title={!canRetry ? 'Only super_admin or finance_admin can retry payments' : 'Retry this payment'}
                            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ml-auto whitespace-nowrap"
                          >
                            {retrying === payment.stripe_subscription_id ? (
                              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Retrying...</>
                            ) : (
                              <><div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line text-sm"></i></div>Retry Payment</>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalCount > 0 && (
                <div className="border-t border-[#1a2b4a] px-6 py-4 flex items-center justify-between">
                  <div className="text-sm text-slate-400">
                    Showing <span className="text-white font-medium">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)}</span> of <span className="text-white font-medium">{totalCount}</span> failed payments
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(0)}
                      disabled={page === 0}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="ri-skip-left-line text-slate-400 w-4 h-4 flex items-center justify-center"></i>
                    </button>
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="ri-arrow-left-s-line text-slate-400 w-4 h-4 flex items-center justify-center"></i>
                    </button>
                    <span className="text-sm text-slate-400 px-2">
                      Page {page + 1} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="ri-arrow-right-s-line text-slate-400 w-4 h-4 flex items-center justify-center"></i>
                    </button>
                    <button
                      onClick={() => setPage(totalPages - 1)}
                      disabled={page >= totalPages - 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="ri-skip-right-line text-slate-400 w-4 h-4 flex items-center justify-center"></i>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {!canRetry && payments.length > 0 && (
          <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="ri-eye-line text-blue-400 w-5 h-5 flex items-center justify-center"></i>
            </div>
            <div>
              <div className="font-medium text-blue-400 mb-1">View Only</div>
              <p className="text-sm text-blue-300">You need super_admin or finance_admin permissions to retry failed payments. Your current role is: <span className="font-semibold">{admin.role || 'unknown'}</span>.</p>
            </div>
          </div>
        )}

        <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="ri-information-line text-blue-400 w-5 h-5 flex items-center justify-center"></i>
            </div>
            <div>
              <div className="font-medium text-blue-400 mb-1">Payment Retry Information</div>
              <p className="text-sm text-blue-300 leading-relaxed">
                Failed payments can be retried manually from this page. The system will attempt to charge the customer&apos;s default payment method.
                If the payment method needs to be updated, the client should do so from their dashboard before retrying.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}