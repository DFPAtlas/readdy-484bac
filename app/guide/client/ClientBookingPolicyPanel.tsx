import Link from 'next/link';
import { CANCELLATION_WINDOWS } from '@/lib/help-content';

const toneStyles: Record<string, { card: string; badge: string; text: string }> = {
  good: {
    card: 'bg-emerald-500/5 border-emerald-400/15',
    badge: 'bg-emerald-500/10 border-emerald-400/25',
    text: 'text-emerald-400',
  },
  warn: {
    card: 'bg-amber-500/5 border-amber-400/15',
    badge: 'bg-amber-500/10 border-amber-400/25',
    text: 'text-amber-400',
  },
  bad: {
    card: 'bg-red-500/5 border-red-400/15',
    badge: 'bg-red-500/10 border-red-400/25',
    text: 'text-red-400',
  },
};

const policyLinks = [
  { href: '/help', icon: 'ri-question-line', title: 'Cancellation & refunds', desc: 'Help Centre guidance' },
  { href: '/terms#payments', icon: 'ri-secure-payment-line', title: 'Payment terms', desc: 'Fees and refund handling' },
  { href: '/terms#termination', icon: 'ri-file-shield-line', title: 'Cancellation terms', desc: 'Account and booking closure' },
];

export default function ClientBookingPolicyPanel() {
  return (
    <section id="booking-policy" className="bg-[#111d35] rounded-3xl border border-slate-700/50 p-10">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-2xl flex-shrink-0">
          <i className="ri-calendar-check-line text-teal-400 text-2xl" />
        </div>
        <div>
          <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Booking Policy</span>
          <h2 className="text-2xl font-bold text-white">Cancellations & Refunds</h2>
          <p className="text-slate-400 mt-2 max-w-2xl">
            Posting a job does not charge you. Card payment is taken through Stripe when you confirm your guard, and any
            cancellation is reviewed against the original payment and the circumstances of the booking.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {CANCELLATION_WINDOWS.map((window) => {
          const tone = toneStyles[window.tone] ?? toneStyles.warn;
          return (
            <div key={window.label} className={`rounded-2xl border p-5 ${tone.card}`}>
              <div className={`inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border mb-3 ${tone.badge} ${tone.text}`}>
                <div className="w-3 h-3 flex items-center justify-center">
                  <i className="ri-time-line text-[10px]" />
                </div>
                {window.label}
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{window.outcome}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{window.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="pt-6 border-t border-slate-700/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-2 text-sm text-slate-400 max-w-xl">
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
            <i className="ri-information-line text-slate-500 text-base" />
          </div>
          <span>
            Once a guard payout has started, cancellation may not be possible. Raise any issue through support as early
            as you can.
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          {policyLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0e1628] border border-slate-700/50 rounded-xl hover:border-teal-500/40 hover:bg-[#0e1628]/80 transition-all whitespace-nowrap cursor-pointer"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className={`${link.icon} text-teal-400 text-sm`} />
              </div>
              <span className="text-sm font-semibold text-white">{link.title}</span>
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-arrow-right-line text-slate-500 text-sm" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}