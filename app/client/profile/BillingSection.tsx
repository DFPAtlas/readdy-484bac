import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface SubscriptionInfo {
  plan_name: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  trial_end_date: string | null;
  billing_cycle: string | null;
  amount_paid: number;
  payment_status: string;
  stripe_subscription_id: string;
  next_payment_date: string | null;
}

interface Profile {
  stripe_customer_id: string;
  subscription_status: string;
  trial_end_date: string | null;
  current_period_end: string | null;
  plan_name: string;
  total_spent: number;
  client_promo_tier: string;
  client_promo_jobs_remaining: number;
  founding_client_badge: boolean;
  client_lifetime_fee_discount: number;
}

interface Props {
  subscription: SubscriptionInfo | null;
  profile: Profile;
  onMessage: (type: "success" | "error", text: string) => void;
}

function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const now = new Date();
  const target = new Date(dateStr);
  const days = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return days;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    active: { label: "Active", bg: "bg-emerald-500/15", color: "text-emerald-500" },
    trialing: { label: "Trial", bg: "bg-violet-500/15", color: "text-violet-500" },
    past_due: { label: "Past Due", bg: "bg-amber-500/15", color: "text-amber-500" },
    cancelled: { label: "Cancelled", bg: "bg-slate-500/15", color: "text-slate-500" },
    paused: { label: "Paused", bg: "bg-blue-500/15", color: "text-blue-500" },
    incomplete: { label: "Incomplete", bg: "bg-red-500/15", color: "text-red-500" },
  };
  return map[status] || { label: status, bg: "bg-slate-500/15", color: "text-slate-500" };
}

export default function BillingSection({ subscription, profile, onMessage }: Props) {
  const [portalLoading, setPortalLoading] = useState(false);
  const sub = subscription;
  const daysLeft = sub ? getDaysUntil(sub.current_period_end) : null;
  const trialDaysLeft = sub?.trial_end_date ? getDaysUntil(sub.trial_end_date) : null;

  const status = sub ? statusBadge(sub.status) : { label: "Free", bg: "bg-slate-500/15", color: "text-slate-500" };

  const planInfo = [
    { label: "Current Plan", value: sub?.plan_name || profile.plan_name || "Free" },
    { label: "Status", value: status.label, badge: true },
    { label: "Trial Status", value: trialDaysLeft !== null ? `${trialDaysLeft} days left` : "Not on trial" },
    { label: "Trial End Date", value: formatDate(sub?.trial_end_date || profile.trial_end_date) },
    { label: "Next Billing Date", value: formatDate(sub?.next_payment_date || sub?.current_period_end || profile.current_period_end) },
    { label: "Billing Cycle", value: sub?.billing_cycle ? sub.billing_cycle.charAt(0).toUpperCase() + sub.billing_cycle.slice(1) : "—" },
    { label: "Auto Renew", value: sub?.cancel_at_period_end ? "Off" : "On" },
    { label: "Amount Paid", value: sub?.amount_paid ? `£${sub.amount_paid.toFixed(2)}` : "—" },
  ];

  const promoInfo = [
    { label: "Promo Tier", value: profile.client_promo_tier || "Standard" },
    { label: "Free Jobs Remaining", value: profile.client_promo_jobs_remaining ?? 0 },
    { label: "Lifetime Discount", value: profile.client_lifetime_fee_discount ? `${Math.round(profile.client_lifetime_fee_discount * 100)}%` : "—" },
    { label: "Founding Badge", value: profile.founding_client_badge ? "Active" : "—" },
  ];

  const handleBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        onMessage("error", "Session expired. Please log in again.");
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-client-billing-portal`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Failed (${res.status})`);
      }

      const { url } = await res.json();
      if (!url) throw new Error("No URL returned");
      window.open(url, "_blank");
    } catch (err: any) {
      onMessage("error", err.message || "Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div>
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Subscription</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Your current plan and billing details
            </p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${status.bg} ${status.color}`}>
            {status.label}
          </span>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-5 text-white mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10">
            <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">Current Plan</p>
            <h3 className="text-2xl font-bold">{sub?.plan_name || profile.plan_name || "Free"}</h3>
            {daysLeft !== null && (
              <p className="text-white/80 text-sm mt-2">
                {daysLeft > 0 ? `${daysLeft} days until next billing` : "Expired — renewal required"}
              </p>
            )}
            {trialDaysLeft !== null && trialDaysLeft > 0 && (
              <p className="text-white/80 text-sm mt-1">Trial ends in {trialDaysLeft} days</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {planInfo.map((item) => (
            <div key={item.label} className="p-3 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d]">
              <p className="text-xs text-slate-500 mb-0.5">{item.label}</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white text-sm font-semibold rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-up-circle-line w-4 h-4 flex items-center justify-center"></i>
            Upgrade Plan
          </Link>
          <Link
            href="/client/payment-history"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-[#162036] text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap border border-slate-200 dark:border-[#1e2d4d]"
          >
            <i className="ri-receipt-line w-4 h-4 flex items-center justify-center"></i>
            View Invoices
          </Link>
          <button
            onClick={() => onMessage("error", "Subscription cancellation is not yet available. Please contact support.")}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-500 text-sm font-semibold rounded-xl hover:bg-red-500/20 transition-colors cursor-pointer whitespace-nowrap border border-red-500/20"
          >
            <i className="ri-close-circle-line w-4 h-4 flex items-center justify-center"></i>
            Cancel Plan
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6 mb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Billing & Payment Method</h2>
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d] mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Payment Method</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                {profile.stripe_customer_id ? "Card on file" : "No payment method added"}
              </p>
            </div>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${profile.stripe_customer_id ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
              {profile.stripe_customer_id ? (
                <><div className="w-3 h-3 flex items-center justify-center"><i className="ri-check-line"></i></div>Active</>
              ) : (
                <><div className="w-3 h-3 flex items-center justify-center"><i className="ri-add-line"></i></div>Not Set Up</>
              )}
            </span>
          </div>
        </div>
        <button
          onClick={handleBillingPortal}
          disabled={portalLoading}
          className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap w-full justify-center"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-bank-card-line"></i>
          </div>
          {portalLoading ? "Loading..." : profile.stripe_customer_id ? "Manage Payment Method" : "Add Payment Method"}
        </button>
        <p className="text-xs text-slate-500 mt-3 text-center">
          Opens the secure Stripe Billing Portal. Payment details are managed securely via Stripe. No card data is stored on our servers.
        </p>
      </div>

      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6 mb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Promo Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {promoInfo.map((item) => (
            <div key={item.label} className="p-3 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d]">
              <p className="text-xs text-slate-500 mb-0.5">{item.label}</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Payment Summary</h2>
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-500">Total Spent</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">£{Number(profile.total_spent || 0).toFixed(2)}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Payment Method</p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {profile.stripe_customer_id ? "Card on file" : "None added"}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Payment details are managed securely via Stripe. No card data is stored on our servers.
        </p>
      </div>
    </div>
  );
}