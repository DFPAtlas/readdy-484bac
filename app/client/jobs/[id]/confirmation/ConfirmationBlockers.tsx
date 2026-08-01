interface Blocker {
  icon: string;
  text: string;
}

interface ConfirmationBlockersProps {
  blockers: Blocker[];
}

export default function ConfirmationBlockers({ blockers }: ConfirmationBlockersProps) {
  if (blockers.length === 0) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 flex items-center justify-center bg-emerald-500/15 rounded-xl shrink-0">
          <i className="ri-checkbox-circle-line text-emerald-500 text-xl"></i>
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-400">All requirements met</p>
          <p className="text-xs text-emerald-500">You can confirm this booking now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 flex items-center justify-center bg-amber-500/15 rounded-xl shrink-0">
          <i className="ri-error-warning-line text-amber-500 text-xl"></i>
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-400">
            {blockers.length} confirmation blocker{blockers.length !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-amber-500">Please resolve the following before confirming your booking.</p>
        </div>
      </div>
      <div className="space-y-2">
        {blockers.map((blocker, index) => (
          <div key={index} className="flex items-center gap-3 p-3 bg-[#162036] rounded-xl border border-[#1e2d4d]">
            <div className="w-8 h-8 flex items-center justify-center bg-amber-500/15 rounded-lg flex-shrink-0">
              <i className={`${blocker.icon} text-amber-400 text-sm`}></i>
            </div>
            <p className="text-sm text-slate-300">{blocker.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}