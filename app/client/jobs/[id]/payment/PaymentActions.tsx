"use client";

interface Props {
  paymentStatus: string;
  hasReceipt: boolean;
  receiptUrl?: string | null;
  invoiceUrl?: string | null;
  onPayNow: () => void;
  onRetry: () => void;
  onViewInvoice: () => void;
  onDownloadReceipt: () => void;
  onContactSupport: () => void;
  processing: boolean;
  agreedToTerms: boolean;
  paymentMethod: "card" | "invoice";
  totalAmount: string;
  retryCount?: number;
  maxRetriesReached?: boolean;
}

export default function PaymentActions({
  paymentStatus,
  hasReceipt,
  receiptUrl,
  invoiceUrl,
  onPayNow,
  onRetry,
  onViewInvoice,
  onDownloadReceipt,
  onContactSupport,
  processing,
  agreedToTerms,
  paymentMethod,
  totalAmount,
  retryCount = 0,
  maxRetriesReached = false,
}: Props) {
  return (
    <div className="space-y-3">
      {(paymentStatus === "pending_payment" || paymentStatus === "not_required") && (
        <button
          onClick={onPayNow}
          disabled={processing || !agreedToTerms}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 ${
            processing || !agreedToTerms
              ? "bg-[#162036] text-slate-600 cursor-not-allowed"
              : "bg-teal-500 text-white hover:bg-teal-600 shadow-lg"
          }`}
        >
          {processing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processing...
            </>
          ) : (
            <>
              <i className="ri-secure-payment-line"></i>
              {paymentMethod === "card" ? `Pay £${totalAmount}` : "Request Invoice"}
            </>
          )}
        </button>
      )}

      {paymentStatus === "failed" && (
        <>
          <button
            onClick={onRetry}
            disabled={processing || !agreedToTerms || maxRetriesReached}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 ${
              processing || !agreedToTerms || maxRetriesReached
                ? "bg-[#162036] text-slate-600 cursor-not-allowed"
                : "bg-red-500 text-white hover:bg-red-600 shadow-lg"
            }`}
          >
            {processing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Retrying...
              </>
            ) : (
              <>
                <i className="ri-refresh-line"></i>
                {maxRetriesReached ? "Max Retries Reached" : `Retry Payment (£${totalAmount})`}
              </>
            )}
          </button>
          {retryCount > 0 && (
            <p className="text-xs text-center text-red-400/70">
              {maxRetriesReached
                ? "You have used all 3 retry attempts. Contact support for help."
                : `Attempt ${retryCount} of 3`}
            </p>
          )}
        </>
      )}

      {(paymentStatus === "invoice_sent" || paymentStatus === "paid") && (
        <button
          onClick={onViewInvoice}
          className="w-full py-3 rounded-xl font-semibold border-2 border-[#1e2d4d] text-slate-300 hover:bg-[#162036] transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
        >
          <i className="ri-file-text-line"></i>
          View Invoice
        </button>
      )}

      {hasReceipt && receiptUrl && (
        <a
          href={receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 rounded-xl font-semibold border-2 border-[#1e2d4d] text-slate-300 hover:bg-[#162036] transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
        >
          <i className="ri-download-line"></i>
          Download Receipt
        </a>
      )}

      {paymentStatus === "failed" && (
        <button
          onClick={onContactSupport}
          className="w-full py-3 rounded-xl font-semibold bg-[#162036] text-slate-300 hover:bg-[#1a2642] transition-colors whitespace-nowrap cursor-pointer border border-[#1e2d4d] flex items-center justify-center gap-2"
        >
          <i className="ri-customer-service-2-line"></i>
          Contact Support
        </button>
      )}

      {paymentStatus === "disputed" && (
        <button
          onClick={onContactSupport}
          className="w-full py-4 rounded-xl font-bold text-lg bg-orange-500 text-white hover:bg-orange-600 shadow-lg transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
        >
          <i className="ri-customer-service-2-line"></i>
          Contact Support
        </button>
      )}
    </div>
  );
}