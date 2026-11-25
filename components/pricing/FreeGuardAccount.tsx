import Link from 'next/link';

export default function FreeGuardAccount({ signedIn = false, print = false }: { signedIn?: boolean; print?: boolean }) {
  return (
    <section className={`rounded-2xl border p-6 ${print ? 'border-slate-200 text-slate-800' : 'border-blue-400/30 bg-blue-500/5 text-slate-300'}`} aria-labelledby="free-guard-heading">
      <h2 id="free-guard-heading" className={`text-2xl font-bold mb-3 ${print ? 'text-slate-900' : 'text-white'}`}>Free guard account</h2>
      <p className="font-semibold mb-3">£0 subscription for guard job access. No monthly application cap or paid job tiers.</p>
      <ul className="space-y-2 text-sm mb-4">
        <li>Create a profile, browse jobs and apply free.</li>
        <li>Paid membership does not determine discovery or applicant order.</li>
        <li>Account approval, a valid SIA licence and each job&apos;s requirements still apply.</li>
        <li>For new bookings, QuickGuard adds no platform or Stripe deduction to the agreed gross guard pay.</li>
      </ul>
      <p className="text-sm mb-4">Review any existing membership and historical invoices on your dashboard. Use its cancellation controls to stop renewal, or contact billing support for a credit or refund review. Existing payments, rewards and billing records are retained for review.</p>
      <div className="flex flex-wrap gap-4 print:hidden">
        <Link href={signedIn ? '/guard/jobs' : '/guard/register'} className="inline-block rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700">{signedIn ? 'Find Jobs' : 'Create Free Guard Account'}</Link>
        {signedIn && <Link href="/guard/dashboard#guard-membership" className="inline-block px-4 py-3 underline">Membership &amp; billing records</Link>}
      </div>
    </section>
  );
}
