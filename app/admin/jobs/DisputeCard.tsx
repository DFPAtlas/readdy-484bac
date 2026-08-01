'use client';

interface DisputeCardProps {
  id: string;
  jobTitle: string;
  status: string;
  statusLabel: string;
  statusBadgeClass: string;
  clientName: string;
  guardName: string;
  amount: number;
  currency: string;
  reason: string;
  createdAt: string;
  raisedBy: string;
  onClick: () => void;
}

export default function DisputeCard({
  jobTitle, status, statusLabel, statusBadgeClass,
  clientName, guardName, amount, currency,
  reason, createdAt, raisedBy, onClick,
}: DisputeCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-[#111d35] border border-[#1e2d4d] rounded-xl p-5 hover:border-teal-500/30 cursor-pointer transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="text-base font-semibold text-white truncate">{jobTitle}</h3>
            <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${statusBadgeClass}`}>
              {statusLabel}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <i className="ri-building-line text-slate-500"></i>
              {clientName}
            </div>
            <div className="flex items-center gap-2">
              <i className="ri-user-line text-slate-500"></i>
              {guardName}
            </div>
            <div className="flex items-center gap-2">
              <i className="ri-money-pound-circle-line text-slate-500"></i>
              £{amount.toFixed(2)} {currency}
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            <span className="font-medium text-slate-300">Reason:</span> {reason}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Raised {new Date(createdAt).toLocaleDateString('en-GB')} · {raisedBy}
          </p>
        </div>
        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
          <i className="ri-arrow-right-s-line text-slate-500"></i>
        </div>
      </div>
    </div>
  );
}