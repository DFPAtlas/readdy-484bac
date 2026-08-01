import Link from 'next/link';

interface PaymentRequiredStateProps {
  title?: string;
  message?: string;
  amount?: string;
  payHref?: string;
  onPay?: () => void;
  compact?: boolean;
}

export default function PaymentRequiredState({
  title = 'Payment Required',
  message = 'Complete payment to confirm your guards and secure the booking.',
  amount,
  payHref,
  onPay,
  compact = false,
}: PaymentRequiredStateProps) {
  const padding = compact ? 'p-6 md:p-8' : 'p-10 md:p-16';

  return (
    <div className={`bg-[#111d35] rounded-2xl border border-amber-500/20 shadow-sm ${padding} text-center`}>
      <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
        <i className="ri-secure-payment-line text-3xl text-amber-400"></i>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-500 text-sm mb-4 max-w-md mx-auto">{message}</p>
      {amount && (
        <p className="text-2xl font-bold text-amber-400 mb-6">{amount}</p>
      )}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {payHref && (
          <Link
            href={payHref}
            className="inline-flex items-center gap-2 bg-amber-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-amber-600 transition-colors cursor-pointer whitespace-nowrap w-full sm:w-auto justify-center"
          >
            <i className="ri-secure-payment-line"></i>
            Pay Now
          </Link>
        )}
        {onPay && (
          <button
            onClick={onPay}
            className="inline-flex items-center gap-2 bg-amber-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-amber-600 transition-colors cursor-pointer whitespace-nowrap w-full sm:w-auto justify-center"
          >
            <i className="ri-secure-payment-line"></i>
            Pay Now
          </button>
        )}
        <Link
          href="/client/support"
          className="inline-flex items-center gap-2 bg-[#162036] text-slate-300 text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d] w-full sm:w-auto justify-center"
        >
          <i className="ri-question-line"></i>
          Need Help?
        </Link>
      </div>
    </div>
  );
}