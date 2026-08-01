"use client";

interface Warning {
  type: "expired_sia" | "near_expiry_sia" | "understaffed" | "overstaffed" | "payment_required" | "already_booked";
  message: string;
  guardName?: string;
}

interface Props {
  warnings: Warning[];
}

export default function WarningBanner({ warnings }: Props) {
  if (warnings.length === 0) return null;

  const icons: Record<string, string> = {
    expired_sia: "ri-error-warning-line",
    near_expiry_sia: "ri-time-line",
    understaffed: "ri-user-unfollow-line",
    overstaffed: "ri-user-add-line",
    payment_required: "ri-bank-card-line",
    already_booked: "ri-calendar-close-line",
  };

  const getBgClass = (type: string) => {
    switch (type) {
      case "expired_sia": return "bg-red-500/10";
      case "near_expiry_sia": return "bg-amber-500/10";
      case "understaffed": return "bg-amber-500/10";
      case "overstaffed": return "bg-red-500/10";
      case "payment_required": return "bg-amber-500/10";
      case "already_booked": return "bg-amber-500/10";
      default: return "bg-slate-500/10";
    }
  };

  const getBorderClass = (type: string) => {
    switch (type) {
      case "expired_sia": return "border-red-500/25";
      case "near_expiry_sia": return "border-amber-500/25";
      case "understaffed": return "border-amber-500/25";
      case "overstaffed": return "border-red-500/25";
      case "payment_required": return "border-amber-500/25";
      case "already_booked": return "border-amber-500/25";
      default: return "border-slate-500/25";
    }
  };

  const getIconBgClass = (type: string) => {
    switch (type) {
      case "expired_sia": return "bg-red-500/15";
      case "near_expiry_sia": return "bg-amber-500/15";
      case "understaffed": return "bg-amber-500/15";
      case "overstaffed": return "bg-red-500/15";
      case "payment_required": return "bg-amber-500/15";
      case "already_booked": return "bg-amber-500/15";
      default: return "bg-slate-500/15";
    }
  };

  const getIconTextClass = (type: string) => {
    switch (type) {
      case "expired_sia": return "text-red-400";
      case "near_expiry_sia": return "text-amber-400";
      case "understaffed": return "text-amber-400";
      case "overstaffed": return "text-red-400";
      case "payment_required": return "text-amber-400";
      case "already_booked": return "text-amber-400";
      default: return "text-slate-400";
    }
  };

  const getMessageTextClass = (type: string) => {
    switch (type) {
      case "expired_sia": return "text-red-400";
      case "near_expiry_sia": return "text-amber-400";
      case "understaffed": return "text-amber-400";
      case "overstaffed": return "text-red-400";
      case "payment_required": return "text-amber-400";
      case "already_booked": return "text-amber-400";
      default: return "text-slate-400";
    }
  };

  return (
    <div className="space-y-2">
      {warnings.map((w, i) => {
        return (
          <div
            key={i}
            className={`${getBgClass(w.type)} ${getBorderClass(w.type)} rounded-xl px-4 py-3 flex items-center gap-3`}
          >
            <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${getIconBgClass(w.type)} flex-shrink-0`}>
              <i className={`${icons[w.type]} ${getIconTextClass(w.type)} text-lg`}></i>
            </div>
            <div className="flex-1">
              <p className={`text-sm ${getMessageTextClass(w.type)} font-medium`}>
                {w.message}
              </p>
              {w.guardName && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Guard: {w.guardName}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}