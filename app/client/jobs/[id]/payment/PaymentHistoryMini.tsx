"use client";

interface Payment {
  id: string;
  date: string;
  jobTitle: string;
  amount: string;
  status: string;
  receiptUrl?: string | null;
}

interface Props {
  payments: Payment[];
  onViewReceipt: (payment: Payment) => void;
}

export default function PaymentHistoryMini({ payments, onViewReceipt }: Props) {
  if (payments.length === 0) return null;

  return (
    <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden">
      <div className="bg-gradient-to-r from-[#162036] to-[#1a2642] p-4 border-b border-[#1e2d4d]">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <i className="ri-history-line text-teal-400"></i>
          Payment History
        </h3>
      </div>
      <div className="divide-y divide-[#1e2d4d]">
        {payments.map((p) => (
          <div key={p.id} className="p-4 flex items-center justify-between hover:bg-[#162036] transition-colors">
            <div>
              <p className="text-sm font-semibold text-slate-200">{p.jobTitle}</p>
              <p className="text-xs text-slate-500">{p.date}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-teal-400">{p.amount}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                p.status === "completed" || p.status === "paid" || p.status === "succeeded"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                  : p.status === "failed"
                  ? "bg-red-500/10 text-red-400 border border-red-500/25"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/25"
              }`}>
                {p.status === "completed" || p.status === "succeeded" ? "Paid" : p.status === "failed" ? "Failed" : "Pending"}
              </span>
              {p.receiptUrl && (
                <button
                  onClick={() => onViewReceipt(p)}
                  className="text-teal-400 hover:text-teal-300 text-xs font-medium cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-file-text-line mr-1"></i>Receipt
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}