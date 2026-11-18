'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PortalSidebar from '@/components/PortalSidebar';
import { useGuardGuard } from '@/hooks/useGuardGuard';
import { useGuardPayoutSettings } from '@/hooks/useGuardPayoutSettings';
import { stripeReturnNotice } from '@/lib/guard-payout-settings';
import { PAYMENT_RELEASE_GUIDANCE } from '@/lib/customer-guidance';
import BankPayoutTracker from '@/app/guard/earnings/BankPayoutTracker';

export default function BankSettingsPage() {
  const router = useRouter();
  const { loading: authLoading, allowed, roleSwitch } = useGuardGuard();
  const settings = useGuardPayoutSettings(!authLoading && allowed);
  const [activeTab, setActiveTab] = useState<'setup' | 'guide' | 'history'>('setup');
  const [notice, setNotice] = useState('');
  const { profile, status } = settings;
  const displayName = profile?.fullName || 'Guard';
  const initials = displayName.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  const busy = !!settings.busyAction || settings.refreshing;

  useEffect(() => {
    if (!authLoading && !allowed) router.replace(roleSwitch === 'client' ? '/client/dashboard' : '/guard/login');
    else if (settings.requiresLogin) router.replace('/guard/login');
  }, [authLoading, allowed, roleSwitch, settings.requiresLogin, router]);

  useEffect(() => {
    const result = stripeReturnNotice(window.location.href);
    if (result) {
      setNotice(result.notice);
      window.history.replaceState(window.history.state, '', result.path);
    }
  }, []);

  return <div className="min-h-screen bg-[#0B1933] text-white flex">
    <PortalSidebar role="guard" displayName={displayName} subtitle="Guard" initials={initials} />
    <main className="flex-1 ml-72 pt-20">
      <div className="border-b border-[#1e2d4d] bg-[#111d35] py-10">
        <div className="max-w-5xl mx-auto px-6">
          <Link href="/guard/earnings" className="text-teal-400 text-sm">Back to Earnings</Link>
          <h1 className="text-3xl font-bold mt-4">Bank Account Settings</h1>
          <p className="text-slate-400 mt-2">Manage your payout account and bank details securely through Stripe.</p>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {authLoading || !allowed || settings.requiresLogin ? <p role="status" className="text-slate-300">Checking your guard account…</p> : settings.loading ? <p role="status" className="text-slate-300">Loading payout account…</p> : settings.error ? <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6">
          <p>{settings.error}</p>
          <button type="button" onClick={() => void settings.load()} className="text-teal-300 underline mt-4">Retry account</button>
          <Link href="/guard/support" className="text-teal-300 underline ml-6">Contact support</Link>
        </div> : profile && <>
          {notice && <p role="status" className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-sky-200">{notice}</p>}
          <nav aria-label="Payout settings" className="flex flex-wrap gap-2 rounded-xl border border-[#1e2d4d] bg-[#111d35] p-2">
            {([{ id: 'setup', label: 'Payout Account' }, { id: 'guide', label: 'How Payouts Work' }, { id: 'history', label: 'Bank Payout History' }] as const).map(tab => <button
              key={tab.id} type="button" id={`tab-${tab.id}`} aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)} className={`flex-1 px-4 py-3 rounded-lg text-sm font-semibold ${activeTab === tab.id ? 'bg-teal-500 text-slate-950' : 'text-slate-300 hover:bg-[#162036]'}`}>
              {tab.label}
            </button>)}
          </nav>
          {activeTab === 'setup' && <section role="region" id="panel-setup" aria-labelledby="tab-setup" className="rounded-xl border border-[#1e2d4d] bg-[#111d35] p-6 space-y-6">
            <div className="flex flex-wrap justify-between gap-4 items-start">
              <div><h2 className="text-xl font-bold">Stripe Payout Account</h2><p className="text-sm text-slate-400 mt-2">Use Stripe to add or update your bank account and complete verification.</p></div>
              <button type="button" onClick={() => void settings.refresh()} disabled={busy} className="px-4 py-2 border border-slate-600 rounded-lg text-sm text-teal-300 disabled:opacity-50">{settings.refreshing ? 'Checking…' : 'Refresh Status'}</button>
            </div>
            {settings.statusError && <p role="alert" className="text-amber-300">{settings.statusError}</p>}
            {!status ? <p role="status" className="text-slate-300">{settings.refreshing ? 'Checking Stripe account status…' : 'Account status is unavailable. Refresh before starting or changing your payout setup.'}</p> : <>
              <div className={`rounded-xl border p-5 ${status.status === 'ready' ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
                <h3 className="font-semibold">{!status.connected ? 'Payout setup not started' : status.status === 'ready' ? 'Stripe account enabled for payouts' : status.status === 'pending' ? 'Stripe account review pending' : status.status === 'restricted' ? 'Stripe account needs attention' : 'Stripe setup incomplete'}</h3>
                <p className="text-sm text-slate-300 mt-2">{!status.connected ? 'Set up a Stripe Express account to receive eligible job earnings.' : status.status === 'ready' ? 'Your account can receive eligible transfers and bank payouts. This status does not confirm that an individual job or bank deposit has been paid.' : 'Open Stripe to review your account information and any outstanding requirements. Verification and bank-arrival times vary.'}</p>
                {status.requirementsDue.length > 0 && <p className="text-sm text-amber-200 mt-3">Stripe needs {status.requirementsDue.length} additional {status.requirementsDue.length === 1 ? 'item' : 'items'}. Review the details in Stripe.</p>}
              </div>
              {status.connected && <dl className="grid sm:grid-cols-3 gap-3 text-sm">
                {[['Details submitted', status.detailsSubmitted], ['Transfers enabled', status.transfersEnabled], ['Bank payouts enabled', status.payoutsEnabled]].map(([label, enabled]) => <div key={String(label)} className="rounded-lg bg-[#0B1933] border border-[#1e2d4d] p-4">
                  <dt className="text-slate-400">{label}</dt><dd className={`mt-1 font-semibold ${enabled ? 'text-emerald-300' : 'text-amber-300'}`}>{enabled ? 'Yes' : 'No'}</dd>
                </div>)}
              </dl>}
              <div className="flex flex-wrap gap-3">
                {!status.connected ? <button type="button" onClick={() => void settings.openStripe('create-guard-connect-account')} disabled={busy} className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold disabled:opacity-50">{settings.busyAction ? 'Opening Stripe…' : 'Set Up Payouts'}</button> : <>
                  {status.status !== 'ready' && <button type="button" onClick={() => void settings.openStripe('create-guard-onboarding-link')} disabled={busy} className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold disabled:opacity-50">{settings.busyAction === 'create-guard-onboarding-link' ? 'Opening Stripe…' : 'Continue Stripe Setup'}</button>}
                  <button type="button" onClick={() => void settings.openStripe('create-guard-dashboard-link')} disabled={busy} className="px-5 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold disabled:opacity-50">{settings.busyAction === 'create-guard-dashboard-link' ? 'Opening Stripe…' : 'Manage Bank Account in Stripe'}</button>
                </>}
              </div>
              {status.lastCheckedAt && <p className="text-xs text-slate-500">Last checked {new Date(status.lastCheckedAt).toLocaleString('en-GB')}</p>}
            </>}
            {settings.actionError && <p role="alert" className="text-amber-300">{settings.actionError}</p>}
          </section>}
          {activeTab === 'guide' && <section role="region" id="panel-guide" aria-labelledby="tab-guide" className="rounded-xl border border-[#1e2d4d] bg-[#111d35] p-6 space-y-5">
            <h2 className="text-xl font-bold">From completed job to bank deposit</h2>
            <div><h3 className="font-semibold">1. Job payment release</h3><p className="text-sm text-slate-300 mt-2">{PAYMENT_RELEASE_GUIDANCE}</p></div>
            <div><h3 className="font-semibold">2. Stripe account and bank deposit</h3><p className="text-sm text-slate-300 mt-2">After eligible earnings reach your Stripe account, Stripe processes bank deposits according to the account&apos;s available balance, schedule and requirements. Review the available payout settings and bank details in Stripe.</p></div>
            <p className="text-sm text-slate-300">For a payout review or a request to hold a payment, contact support. The team will check its current state; a support request does not itself stop a payment already in progress.</p>
            <p className="text-sm text-slate-300">Check the bank payout history for each deposit. A completed job transfer and a paid bank deposit are separate events.</p>
            <Link href="/guard/support" className="inline-block text-teal-300 underline">Ask about a payout</Link>
          </section>}
          {activeTab === 'history' && <div role="region" id="panel-history" aria-labelledby="tab-history">
            <BankPayoutTracker key={profile.id} guardId={profile.id} />
            <p className="text-sm text-slate-400">Bank deposits can combine earnings from several jobs. <Link href="/guard/earnings" className="text-teal-300 underline">View job earnings and receipts</Link>.</p>
          </div>}
        </>}
      </div>
    </main>
  </div>;
}
