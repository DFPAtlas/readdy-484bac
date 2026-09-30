'use client';

import Link from 'next/link';

interface DashboardControlCentreProps {
  activeJobs: number;
  totalJobs: number;
  pendingVerifications: number;
  pendingSiaVerifications: number;
  openComplaints: number;
  failedPayments: number;
  heldPayments: number;
  openSupportTickets: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
}

function QueueItem({
  href,
  icon,
  label,
  description,
  count,
  tone = 'slate',
}: {
  href: string;
  icon: string;
  label: string;
  description: string;
  count: number;
  tone?: 'red' | 'amber' | 'teal' | 'slate';
}) {
  const toneClass = {
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    slate: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  }[tone];

  return (
    <Link
      href={href}
      prefetch={false}
      className="group flex items-center gap-3 rounded-xl border border-[#1a2b4a] bg-[#0f1c34] p-3 hover:border-teal-500/30 hover:bg-[#13213c] transition"
    >
      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${toneClass}`}>
        <i className={`${icon} text-base`}></i>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white truncate">{label}</p>
          {count > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1a2b4a] text-slate-300">
              {count}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{description}</p>
      </div>
      <i className="ri-arrow-right-s-line text-slate-600 group-hover:text-teal-400 transition"></i>
    </Link>
  );
}

export default function DashboardControlCentre({
  activeJobs,
  totalJobs,
  pendingVerifications,
  pendingSiaVerifications,
  openComplaints,
  failedPayments,
  heldPayments,
  openSupportTickets,
  activeSubscriptions,
  monthlyRevenue,
}: DashboardControlCentreProps) {
  const attentionCount =
    pendingVerifications +
    pendingSiaVerifications +
    openComplaints +
    failedPayments +
    heldPayments +
    openSupportTickets;

  const completedOrClosed = Math.max(totalJobs - activeJobs, 0);
  const activeShare = totalJobs > 0 ? Math.round((activeJobs / totalJobs) * 100) : 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <section className="xl:col-span-2 rounded-2xl border border-[#1a2b4a] bg-[#111d35] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-400">Operations</p>
            <h2 className="text-base font-bold text-white mt-1">Action queue</h2>
            <p className="text-xs text-slate-500 mt-1">Items that can block guards, jobs, payments or customer support.</p>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold border ${attentionCount > 0 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
            {attentionCount > 0 ? `${attentionCount} need attention` : 'Queue clear'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <QueueItem
            href="/admin/guard-verifications"
            icon="ri-shield-check-line"
            label="Guard verification"
            description="Profile and eligibility checks"
            count={pendingVerifications}
            tone={pendingVerifications > 0 ? 'amber' : 'teal'}
          />
          <QueueItem
            href="/admin/sia-verifications"
            icon="ri-id-card-line"
            label="SIA verification"
            description="Licence checks awaiting decision"
            count={pendingSiaVerifications}
            tone={pendingSiaVerifications > 0 ? 'amber' : 'teal'}
          />
          <QueueItem
            href="/admin/failed-payments"
            icon="ri-error-warning-line"
            label="Payment exceptions"
            description="Failed or interrupted payment flows"
            count={failedPayments}
            tone={failedPayments > 0 ? 'red' : 'teal'}
          />
          <QueueItem
            href="/admin/held-payments"
            icon="ri-hand-coin-line"
            label="Held payouts"
            description="Guard payouts requiring review"
            count={heldPayments}
            tone={heldPayments > 0 ? 'amber' : 'teal'}
          />
          <QueueItem
            href="/admin/complaints"
            icon="ri-feedback-line"
            label="Complaints"
            description="Open customer or guard complaints"
            count={openComplaints}
            tone={openComplaints > 0 ? 'red' : 'teal'}
          />
          <QueueItem
            href="/admin/support-tickets"
            icon="ri-customer-service-2-line"
            label="Support tickets"
            description="Open support workload"
            count={openSupportTickets}
            tone={openSupportTickets > 0 ? 'amber' : 'teal'}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[#1a2b4a] bg-[#111d35] p-5 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-400">Marketplace</p>
        <h2 className="text-base font-bold text-white mt-1">Job pipeline</h2>
        <p className="text-xs text-slate-500 mt-1">Operational view of live marketplace activity.</p>

        <div className="mt-5 space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-white">{activeJobs}</p>
              <p className="text-xs text-slate-500 mt-1">Active jobs</p>
            </div>
            <span className="text-xs font-semibold text-teal-400">{activeShare}% of all jobs</span>
          </div>

          <div className="h-2 rounded-full bg-[#0B1933] overflow-hidden">
            <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${activeShare}%` }} />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="rounded-xl bg-[#0f1c34] border border-[#1a2b4a] p-3">
              <p className="text-xl font-bold text-white">{totalJobs}</p>
              <p className="text-[11px] text-slate-500 mt-1">Total jobs</p>
            </div>
            <div className="rounded-xl bg-[#0f1c34] border border-[#1a2b4a] p-3">
              <p className="text-xl font-bold text-white">{completedOrClosed}</p>
              <p className="text-[11px] text-slate-500 mt-1">Not active</p>
            </div>
          </div>

          <Link href="/admin/jobs" prefetch={false} className="inline-flex items-center gap-2 text-sm font-semibold text-teal-400 hover:text-teal-300">
            Open jobs control
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>
      </section>

      <section className="xl:col-span-3 rounded-2xl border border-[#1a2b4a] bg-[#111d35] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-400">Control centre</p>
            <h2 className="text-base font-bold text-white mt-1">Launch, payments and system controls</h2>
            <p className="text-xs text-slate-500 mt-1">
              Quick access to the areas used for UAT, launch checks and live service monitoring.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/admin/live-test-checklist" prefetch={false} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition">
              <i className="ri-flask-line"></i>
              Launch & UAT
            </Link>
            <Link href="/admin/system-status" prefetch={false} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0f1c34] border border-[#1a2b4a] hover:border-teal-500/30 text-slate-300 hover:text-white text-sm font-semibold transition">
              <i className="ri-heart-pulse-line"></i>
              System health
            </Link>
            <Link href="/admin/stripe-sync" prefetch={false} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0f1c34] border border-[#1a2b4a] hover:border-teal-500/30 text-slate-300 hover:text-white text-sm font-semibold transition">
              <i className="ri-bank-card-2-line"></i>
              Stripe
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          <div className="rounded-xl bg-[#0f1c34] border border-[#1a2b4a] p-4">
            <p className="text-xs text-slate-500">Active subscriptions</p>
            <p className="text-2xl font-bold text-white mt-1">{activeSubscriptions}</p>
          </div>
          <div className="rounded-xl bg-[#0f1c34] border border-[#1a2b4a] p-4">
            <p className="text-xs text-slate-500">Revenue this month</p>
            <p className="text-2xl font-bold text-white mt-1">
              {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(monthlyRevenue)}
            </p>
          </div>
          <div className="rounded-xl bg-[#0f1c34] border border-[#1a2b4a] p-4">
            <p className="text-xs text-slate-500">Operational exceptions</p>
            <p className={`text-2xl font-bold mt-1 ${attentionCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {attentionCount}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
