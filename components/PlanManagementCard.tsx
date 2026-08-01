"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PlanSwitchToast from '@/components/PlanSwitchToast';

interface SubscriptionData {
  plan_name: string;
  plan_slug: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  monthly_price_pence: number;
  stripe_subscription_id: string | null;
}

interface EntitlementData {
  plan_slug: string;
  plan_name: string;
  subscription_status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  monthly_price_pence: number;
  stripe_subscription_id: string | null;
  is_free_tier: boolean;
}

interface Plan {
  slug: string;
  name: string;
  monthly_price_pence: number;
  audience: string;
  stripe_price_id: string | null;
}

export default function PlanManagementCard({ userId, audience }: { userId: string; audience: 'client' | 'guard' }) {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [toastData, setToastData] = useState<{ show: boolean; oldPlanName: string; newPlanName: string }>({ show: false, oldPlanName: '', newPlanName: '' });
  const prevPlanSlug = useRef<string>('');

  const load = useCallback(async () => {
    const { data: entData } = await supabase
      .from('user_entitlements_data')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: subData } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (entData) {
      const d = entData as EntitlementData;
      const newPlanSlug = d.plan_slug;
      const newPlanName = d.plan_name;

      if (prevPlanSlug.current && prevPlanSlug.current !== newPlanSlug && prevPlanSlug.current !== '') {
        const oldPlan = allPlans.find(p => p.slug === prevPlanSlug.current);
        setToastData({ show: true, oldPlanName: oldPlan?.name || prevPlanSlug.current, newPlanName: newPlanName });
      }

      prevPlanSlug.current = newPlanSlug;

      setSubscription({
        plan_name: newPlanName,
        plan_slug: newPlanSlug,
        status: d.subscription_status || 'active',
        current_period_end: d.current_period_end,
        cancel_at_period_end: d.cancel_at_period_end || false,
        monthly_price_pence: d.monthly_price_pence,
        stripe_subscription_id: subData?.stripe_subscription_id || null,
      });
    } else if (subData) {
      const { data: planData } = await supabase
        .from('plans')
        .select('name, monthly_price_pence')
        .eq('slug', subData.plan_slug || '')
        .maybeSingle();
      setSubscription({
        plan_name: planData?.name || 'Unknown',
        plan_slug: subData.plan_slug || '',
        status: 'active',
        current_period_end: subData.current_period_end || '',
        cancel_at_period_end: subData.cancel_at_period_end || false,
        monthly_price_pence: planData?.monthly_price_pence || 0,
        stripe_subscription_id: subData.stripe_subscription_id,
      });
    }

    const { data: planData } = await supabase
      .from('plans')
      .select('*')
      .eq('audience', audience)
      .eq('active', true)
      .order('monthly_price_pence', { ascending: true });

    if (planData) setAllPlans(planData as Plan[]);
    setLoading(false);
  }, [userId, audience, allPlans]);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`plan-mgmt-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'app', table: 'subscriptions', filter: `user_id=eq.${userId}` },
        () => { load(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'app', table: 'user_entitlements_data', filter: `user_id=eq.${userId}` },
        () => { load(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, load]);

  const handleCancel = async () => {
    if (!subscription?.stripe_subscription_id) return;
    setCancelling(true);

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;
      if (!accessToken) {
        alert('Your session has expired. Please log in again.');
        setCancelling(false);
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cancel-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            stripeSubscriptionId: subscription.stripe_subscription_id,
            userId,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setCancelSuccess(true);
        setSubscription((prev) =>
          prev ? { ...prev, cancel_at_period_end: true, status: 'canceling' } : null
        );
        setTimeout(() => setCancelSuccess(false), 5000);
      } else {
        alert(data.error || 'Failed to cancel subscription. Please try again.');
      }
    } catch {
      alert('Failed to cancel subscription. Please try again.');
    } finally {
      setCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  const handleResume = async () => {
    if (!subscription?.stripe_subscription_id) return;
    setCancelling(true);

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;
      if (!accessToken) {
        alert('Your session has expired. Please log in again.');
        setCancelling(false);
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resume-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            stripeSubscriptionId: subscription.stripe_subscription_id,
            userId,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setSubscription((prev) =>
          prev ? { ...prev, cancel_at_period_end: false, status: 'active' } : null
        );
      } else {
        alert(data.error || 'Failed to resume subscription.');
      }
    } catch {
      alert('Failed to resume subscription.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-slate-200 dark:bg-[#1e2d4d] rounded w-1/3"></div>
          <div className="h-3 bg-slate-200 dark:bg-[#1e2d4d] rounded w-2/3"></div>
          <div className="h-8 bg-slate-200 dark:bg-[#1e2d4d] rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Your Subscription</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          No active subscription found.
        </p>
        <Link
          href="/pricing"
          prefetch={false}
          className="block w-full text-center bg-teal-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap"
        >
          View Plans
        </Link>
      </div>
    );
  }

  const periodEnd = new Date(subscription.current_period_end).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const daysLeft = Math.max(0, Math.ceil(
    (new Date(subscription.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  ));

  const isFree = subscription.monthly_price_pence === 0;
  const isActive = subscription.status === 'active' || subscription.status === 'trialing';
  const isCanceled = subscription.cancel_at_period_end || subscription.status === 'canceled' || subscription.status === 'cancelled';
  const hasStripeSub = !!subscription.stripe_subscription_id;

  const currentPlanDetails = allPlans.find((p) => p.slug === subscription.plan_slug);
  const currentPlanFeatures = (currentPlanDetails?.features || []) as string[];
  const hasAnalytics = currentPlanFeatures.some((f) => f.includes('analytics'));

  const analyticsUpgradePlan = allPlans.find((p) =>
    p.monthly_price_pence > subscription.monthly_price_pence &&
    (p.features || []).some((f: string) => f.includes('analytics'))
  );

  const higherPlans = allPlans.filter((p) => p.monthly_price_pence > subscription.monthly_price_pence);
  const lowerPlans = allPlans.filter((p) => p.monthly_price_pence < subscription.monthly_price_pence && p.monthly_price_pence > 0);

  const gradient = isCanceled
    ? 'from-slate-600 to-slate-700'
    : isFree
    ? 'from-blue-600 to-indigo-700'
    : 'from-teal-500 to-emerald-700';

  const statusLabel = isCanceled
    ? 'Cancelling at period end'
    : isFree
    ? 'Free Plan'
    : isActive
    ? 'Active'
    : subscription.status;

  return (
    <>
      <PlanSwitchToast
        show={toastData.show}
        oldPlanName={toastData.oldPlanName}
        newPlanName={toastData.newPlanName}
        onClose={() => setToastData({ show: false, oldPlanName: '', newPlanName: '' })}
      />
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm overflow-hidden">
        <div className={`bg-gradient-to-br ${gradient} p-6 text-white relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">Current Plan</p>
                <h3 className="text-2xl font-bold">{subscription.plan_name}</h3>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/20 whitespace-nowrap">
                {statusLabel}
              </span>
            </div>

            {!isFree && (
              <p className="text-white/80 text-sm">
                {isCanceled
                  ? `Access ends ${periodEnd} (${daysLeft} days left)`
                  : `Renews ${periodEnd} (${daysLeft} days left)`}
              </p>
            )}
            {!isFree && (
              <p className="text-white/60 text-xs mt-1">
                £{(subscription.monthly_price_pence / 100).toFixed(0)}/month
              </p>
            )}
          </div>
        </div>

        <div className="p-6">
          {cancelSuccess && (
            <div className="mb-4 bg-emerald-500/10 border border-emerald-400/20 rounded-xl px-4 py-3 flex items-center gap-2">
              <i className="ri-checkbox-circle-fill text-emerald-400" />
              <p className="text-sm text-emerald-400 font-medium">
                Your subscription will cancel at the end of the current period.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {!hasAnalytics && analyticsUpgradePlan && (
              <Link
                href={`/upgrade?reason=client.analytics_dashboard&plan=${analyticsUpgradePlan.slug}`}
                prefetch={false}
                className="w-full flex items-center justify-center gap-2 bg-[#162036] text-teal-400 text-sm font-semibold py-2.5 rounded-xl border border-teal-500/30 hover:bg-teal-500/10 hover:border-teal-400 transition-colors whitespace-nowrap"
              >
                <i className="ri-bar-chart-2-line" />
                Unlock Analytics — Upgrade to {analyticsUpgradePlan.name}
              </Link>
            )}

            {higherPlans.length > 0 && (
              <Link
                href={`/upgrade?plan=${higherPlans[0]?.slug}`}
                prefetch={false}
                className="w-full flex items-center justify-center gap-2 bg-teal-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap"
              >
                <i className="ri-arrow-up-circle-line" />
                Upgrade to {higherPlans[0]?.name}
              </Link>
            )}

            {lowerPlans.length > 0 && !isFree && !isCanceled && (
              <Link
                href={`/upgrade?plan=${lowerPlans[lowerPlans.length - 1]?.slug}`}
                prefetch={false}
                className="w-full flex items-center justify-center gap-2 bg-white dark:bg-[#162036] text-slate-600 dark:text-slate-300 text-sm font-semibold py-2.5 rounded-xl border border-slate-200 dark:border-[#1e2d4d] hover:bg-slate-50 dark:hover:bg-[#1a2642] transition-colors whitespace-nowrap"
              >
                <i className="ri-arrow-down-circle-line" />
                Downgrade to {lowerPlans[lowerPlans.length - 1]?.name}
              </Link>
            )}

            {hasStripeSub && isActive && !isCanceled && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                disabled={cancelling}
                className="w-full flex items-center justify-center gap-2 bg-red-500/10 text-red-400 text-sm font-semibold py-2.5 rounded-xl border border-red-400/20 hover:bg-red-500/20 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-close-circle-line" />
                {cancelling ? 'Processing...' : 'Cancel Subscription'}
              </button>
            )}

            {hasStripeSub && isCanceled && (
              <button
                onClick={handleResume}
                disabled={cancelling}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-400 text-sm font-semibold py-2.5 rounded-xl border border-emerald-400/20 hover:bg-emerald-500/20 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-restart-line" />
                {cancelling ? 'Processing...' : 'Resume Subscription'}
              </button>
            )}

            {isFree && (
              <Link
                href="/pricing"
                prefetch={false}
                className="w-full flex items-center justify-center gap-2 bg-white dark:bg-[#162036] text-slate-600 dark:text-slate-300 text-sm font-semibold py-2.5 rounded-xl border border-slate-200 dark:border-[#1e2d4d] hover:bg-slate-50 dark:hover:bg-[#1a2642] transition-colors whitespace-nowrap"
              >
                <i className="ri-arrow-right-line" />
                Browse Paid Plans
              </Link>
            )}
          </div>
        </div>

        {showCancelConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                  <i className="ri-alert-line text-2xl text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cancel Subscription?</h3>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Your access will continue until {periodEnd}. After that, you will revert to the free plan and lose access to paid features.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#1e2d4d] hover:bg-slate-50 dark:hover:bg-[#162036] transition-colors whitespace-nowrap cursor-pointer"
                >
                  Keep My Plan
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
                >
                  {cancelling ? 'Processing...' : 'Cancel Subscription'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}