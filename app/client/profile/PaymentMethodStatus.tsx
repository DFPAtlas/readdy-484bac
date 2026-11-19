import Link from 'next/link';
import { ClientPaymentMethodState, paymentMethodView } from '@/lib/client-payment-method';

export default function PaymentMethodStatus({ state, onRefresh }: { state: ClientPaymentMethodState; onRefresh: () => void }) {
  const view = paymentMethodView(state);
  return <div className="space-y-2" aria-live="polite">
    <p className="text-sm font-semibold text-slate-900 dark:text-white">{view.label}</p>
    <p className={`text-xs ${view.complete ? 'text-emerald-500' : 'text-slate-500'}`}>{view.badge}</p>
    {view.needsReview && <p className="text-sm text-amber-600 dark:text-amber-400">Your billing records need checking before payment methods can be managed. <Link href="/client/support" className="underline">Contact support</Link>.</p>}
    <button type="button" onClick={onRefresh} disabled={state.status === 'loading'} className="text-xs font-semibold text-teal-600 dark:text-teal-400 underline disabled:opacity-50">
      {state.status === 'error' ? 'Retry payment method check' : 'Refresh payment method status'}
    </button>
  </div>;
}
