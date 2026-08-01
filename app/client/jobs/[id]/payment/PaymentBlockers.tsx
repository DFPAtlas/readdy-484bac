"use client";

interface Props {
  paymentStatus: string;
  jobStartDate?: string;
  jobStartTime?: string;
  transaction?: {
    failure_reason?: string | null;
    created_at?: string;
  } | null;
}

export default function PaymentBlockers({ paymentStatus, jobStartDate, jobStartTime, transaction }: Props) {
  const warnings: Array<{ type: "error" | "warning" | "info"; icon: string; title: string; message: string }> = [];

  if (paymentStatus === "pending_payment" || paymentStatus === "failed") {
    warnings.push({
      type: "error",
      icon: "ri-error-warning-line",
      title: "Guards cannot be confirmed until payment is complete",
      message: "Your selected guards are waiting for payment confirmation. Please complete payment to proceed.",
    });
  }

  if (paymentStatus === "failed") {
    const reason = transaction?.failure_reason || "Unknown error";
    warnings.push({
      type: "error",
      icon: "ri-close-circle-line",
      title: "Payment failed",
      message: `Your last payment attempt was unsuccessful. ${reason}. Please retry or update your payment method.`,
    });
  }

  if (jobStartDate && jobStartTime) {
    const start = new Date(`${jobStartDate}T${jobStartTime}`);
    const now = new Date();
    const hoursUntil = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60));
    if (hoursUntil <= 24 && hoursUntil > 0 && (paymentStatus === "pending_payment" || paymentStatus === "failed")) {
      warnings.push({
        type: "warning",
        icon: "ri-time-line",
        title: "Job starts soon — payment is still pending",
        message: `This job starts in ${hoursUntil} hours. Complete payment now to avoid delays and ensure guards are confirmed on time.`,
      });
    }
  }

  if (paymentStatus === "invoice_sent") {
    warnings.push({
      type: "warning",
      icon: "ri-file-warning-line",
      title: "Invoice is overdue",
      message: "Your invoice payment is past due. Please settle it immediately to avoid service disruption.",
    });
  }

  if (paymentStatus === "disputed") {
    warnings.push({
      type: "warning",
      icon: "ri-shield-flash-line",
      title: "Payment is under dispute",
      message: "This payment has been disputed. Please contact our support team to resolve this quickly.",
    });
  }

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-3">
      {warnings.map((w, i) => (
        <div key={i} className={`rounded-xl p-4 border ${
          w.type === "error" ? "bg-red-500/10 border-red-500/25" :
          w.type === "warning" ? "bg-amber-500/10 border-amber-500/25" :
          "bg-blue-500/10 border-blue-500/25"
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
              w.type === "error" ? "bg-red-500/15" :
              w.type === "warning" ? "bg-amber-500/15" :
              "bg-blue-500/15"
            }`}>
              <i className={`${w.icon} ${w.type === "error" ? "text-red-400" : w.type === "warning" ? "text-amber-400" : "text-blue-400"}`}></i>
            </div>
            <div>
              <h4 className={`text-sm font-semibold ${w.type === "error" ? "text-red-400" : w.type === "warning" ? "text-amber-400" : "text-blue-400"}`}>
                {w.title}
              </h4>
              <p className="text-xs text-slate-400 mt-1">{w.message}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}