import type { SandboxStatus } from './types';

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });
}

export default function SandboxStatusPanel({ status }: { status: SandboxStatus }) {
  const { eligibility, trialBoundary, accountType } = status;
  const tone = eligibility.eligible
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 mb-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-semibold text-slate-900">Account check</h2>
        <span className="text-xs font-medium text-slate-500 capitalize whitespace-nowrap">
          {accountType ? `${accountType} account` : 'Account unknown'}
        </span>
      </div>

      <div className={`rounded-xl border px-4 py-3 mb-4 ${tone}`}>
        <div className="flex items-start gap-2.5">
          <i className={`${eligibility.eligible ? 'ri-checkbox-circle-line' : 'ri-information-line'} text-base w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5`} />
          <div className="min-w-0">
            <p className="text-sm font-medium leading-relaxed">{eligibility.message}</p>
            <p className="text-[11px] font-mono mt-1 opacity-70 break-all">{eligibility.code}</p>
          </div>
        </div>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-slate-500">First charge date</dt>
          <dd className="text-slate-900 font-medium text-right">{formatDate(trialBoundary.firstChargeIso)}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-slate-500">Offer closes (exclusive)</dt>
          <dd className="text-slate-900 font-medium text-right">
            {trialBoundary.offerEndIso ? formatDate(trialBoundary.offerEndIso) : '30 Dec 2026, 00:00'}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-slate-500">Last supported test sign-up</dt>
          <dd className="text-slate-900 font-medium text-right">{formatDate(trialBoundary.lastSupportedCheckoutIso)}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-slate-500">Stripe minimum lead time</dt>
          <dd className="text-slate-900 font-medium text-right">{trialBoundary.stripeMinimumLeadHours} hours</dd>
        </div>
      </dl>

      {trialBoundary.stripeMinimumAlreadyExceeded && (
        <p className="mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
          The 1 January 2027 date is inside Stripe&apos;s minimum trial lead time right now, so the test checkout will refuse to start rather than move the charge date.
        </p>
      )}
    </section>
  );
}