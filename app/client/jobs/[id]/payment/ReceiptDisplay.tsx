interface Props {
  invoiceNumber: string;
  paymentDate: string;
  paymentMethod: string;
  billingName: string;
  billingEmail: string;
  amount: string;
  status: string;
  onDownload: () => void;
}

export default function ReceiptDisplay({
  invoiceNumber,
  paymentDate,
  paymentMethod,
  billingName,
  billingEmail,
  amount,
  status,
  onDownload,
}: Props) {
  const isRefunded = status === "refunded";
  const badgeConfig = isRefunded
    ? { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/25", icon: "ri-refund-line", label: "Refunded" }
    : { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/25", icon: "ri-check-line", label: "Paid" };

  return (
    <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden">
      <div className={`bg-gradient-to-r ${isRefunded ? "from-violet-500/20 to-purple-600/20" : "from-emerald-500/20 to-teal-600/20"} p-4 border-b border-[#1e2d4d] flex items-center justify-between`}>
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <i className={`ri-receipt-line ${isRefunded ? "text-violet-400" : "text-emerald-400"}`}></i>
          Payment Receipt
        </h3>
        <span className={`${badgeConfig.bg} ${badgeConfig.text} ${badgeConfig.border} px-3 py-1 rounded-full text-xs font-semibold border`}>
          <i className={`${badgeConfig.icon} mr-1`}></i>{badgeConfig.label}
        </span>
      </div>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Invoice No</p>
            <p className="text-sm font-semibold text-slate-200 font-mono">{invoiceNumber}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Payment Date</p>
            <p className="text-sm font-semibold text-slate-200">{paymentDate}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Payment Method</p>
            <p className="text-sm font-semibold text-slate-200">{paymentMethod}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Amount</p>
            <p className={`text-sm font-semibold ${isRefunded ? "text-violet-400" : "text-teal-400"}`}>{amount}</p>
          </div>
        </div>
        <div className="border-t border-[#1e2d4d] pt-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Billed To</p>
          <p className="text-sm font-semibold text-slate-200">{billingName}</p>
          <p className="text-sm text-slate-400">{billingEmail}</p>
        </div>
        <button
          onClick={onDownload}
          className="w-full py-2.5 bg-[#162036] text-slate-300 rounded-lg hover:bg-[#1a2642] transition-colors text-sm font-medium cursor-pointer flex items-center justify-center gap-2 border border-[#1e2d4d]"
        >
          <i className="ri-download-line"></i>
          Download Receipt
        </button>
      </div>
    </div>
  );
}