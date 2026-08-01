"use client";

interface SelectedGuard {
  id: string;
  full_name: string;
  profile_image_url: string | null;
  hourly_rate: number | null;
  rating: number | null;
  sia_verified: boolean;
  confirmation_status?: string;
}

interface Props {
  guards: SelectedGuard[];
  guardsRequired: number;
  onRemove: (id: string) => void;
  onContact: (id: string) => void;
  onProceedToPayment: () => void;
}

export default function SelectedGuardsPanel({
  guards,
  guardsRequired,
  onRemove,
  onContact,
  onProceedToPayment,
}: Props) {
  const isUnderstaffed = guards.length < guardsRequired;
  const isOverstaffed = guards.length > guardsRequired;

  return (
    <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden">
      <div className="p-4 border-b border-[#1e2d4d]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">
            <i className="ri-user-star-line mr-1.5 text-teal-400"></i>
            Selected Guards ({guards.length}/{guardsRequired})
          </h3>
          {guards.length > 0 && (
            <span className="text-xs text-slate-500">
              {guards.length} selected
            </span>
          )}
        </div>
        {isUnderstaffed && (
          <p className="text-xs text-amber-400 mt-1">
            <i className="ri-error-warning-line mr-1"></i>
            {guardsRequired - guards.length} more guard
            {guardsRequired - guards.length !== 1 ? "s" : ""} needed
          </p>
        )}
        {isOverstaffed && (
          <p className="text-xs text-red-400 mt-1">
            <i className="ri-error-warning-line mr-1"></i>
            {guards.length - guardsRequired} guard
            {guards.length - guardsRequired !== 1 ? "s" : ""} over limit
          </p>
        )}
      </div>

      <div className="p-4">
        {guards.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-10 h-10 bg-[#162036] rounded-full flex items-center justify-center mx-auto mb-2 border border-[#1e2d4d]">
              <i className="ri-user-line text-slate-500"></i>
            </div>
            <p className="text-xs text-slate-500">
              No guards selected yet. Select guards from the list below.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {guards.map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-3 bg-[#162036] rounded-lg p-3 border border-[#1e2d4d]"
              >
                <div className="w-10 h-10 rounded-full bg-[#111d35] flex items-center justify-center overflow-hidden flex-shrink-0 border border-[#1e2d4d]">
                  {g.profile_image_url ? (
                    <img
                      src={g.profile_image_url}
                      alt={g.full_name}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <i className="ri-user-line text-xs text-slate-500"></i>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-300 truncate">
                    {g.full_name}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-teal-400">
                      £{g.hourly_rate || "—"}/hr
                    </span>
                    {g.rating && (
                      <span className="text-xs text-slate-500">
                        <i className="ri-star-fill text-amber-400 text-xs mr-0.5"></i>
                        {g.rating.toFixed(1)}
                      </span>
                    )}
                    {g.sia_verified && (
                      <span className="text-xs text-emerald-400">
                        <i className="ri-shield-check-line mr-0.5"></i>SIA
                      </span>
                    )}
                    <span className="text-xs text-blue-400">
                      {g.confirmation_status === "confirmed"
                        ? "Confirmed"
                        : g.confirmation_status === "pending"
                        ? "Pending"
                        : "Awaiting"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => onContact(g.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-teal-400 hover:bg-[#1a2642] transition-colors cursor-pointer"
                    title="Contact"
                  >
                    <i className="ri-message-3-line text-sm"></i>
                  </button>
                  <button
                    onClick={() => onRemove(g.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Remove"
                  >
                    <i className="ri-close-line text-sm"></i>
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={onProceedToPayment}
              className="w-full bg-teal-500 text-white py-2.5 rounded-lg hover:bg-teal-600 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap mt-2"
            >
              <i className="ri-check-double-line mr-1.5"></i>
              Proceed to Payment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}