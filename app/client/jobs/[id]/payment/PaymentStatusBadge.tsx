"use client";

interface Props {
  status: string;
  size?: "sm" | "md" | "lg";
}

const statusConfig: Record<string, { bg: string; text: string; border: string; icon: string; label: string }> = {
  funded: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/25", icon: "ri-shield-check-line", label: "Funded — Job Confirmed" },
  not_required: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/25", icon: "ri-forbid-line", label: "Not Required" },
  pending_payment: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/25", icon: "ri-time-line", label: "Pending Payment" },
  processing: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/25", icon: "ri-loader-4-line", label: "Processing" },
  paid: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/25", icon: "ri-check-double-line", label: "Paid" },
  failed: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/25", icon: "ri-close-circle-line", label: "Failed" },
  refunded: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/25", icon: "ri-refund-line", label: "Refunded" },
  disputed: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/25", icon: "ri-shield-flash-line", label: "Disputed" },
  invoice_sent: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/25", icon: "ri-mail-send-line", label: "Invoice Sent" },
};

export default function PaymentStatusBadge({ status, size = "md" }: Props) {
  const config = statusConfig[status] || statusConfig.pending_payment;
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };
  const iconSize = { sm: "text-xs", md: "text-sm", lg: "text-base" };

  return (
    <span className={`${config.bg} ${config.text} ${config.border} ${sizeClasses[size]} rounded-full font-semibold border inline-flex items-center gap-1.5 whitespace-nowrap`}>
      <i className={`${config.icon} ${iconSize[size]}`}></i>
      {config.label}
    </span>
  );
}