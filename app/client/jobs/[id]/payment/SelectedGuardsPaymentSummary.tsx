'use client';

interface SelectedGuard {
  id: string;
  guard_id: string;
  status: string;
  payment_status: string | null;
  agreed_hourly_rate: number | null;
  agreed_hours: number | null;
  gross_guard_amount: number | null;
  currency: string | null;
  guards: {
    id: string;
    full_name: string;
    profile_image_url: string;
    hourly_rate: number;
    rating: number;
    sia_verified: boolean;
    sia_licence_number: string | null;
    licence_types: string[] | null;
  };
}

interface Props {
  assignments: SelectedGuard[];
}

const money = (n: number | null | undefined, symbol: string) =>
  `${symbol}${Number(n || 0).toFixed(2)}`;

export default function SelectedGuardsPaymentSummary({ assignments }: Props) {
  const provisional = assignments.filter(
    (a) => a.status === 'selected' || a.status === 'awaiting_payment'
  );
  const symbol = provisional[0]?.currency === 'USD' ? '$' : '£';

  if (provisional.length === 0) {
    return (
      <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-6 text-center">
        <div className="w-16 h-16 bg-[#162036] rounded-full flex items-center justify-center mx-auto mb-3">
          <i className="ri-user-line text-3xl text-slate-500"></i>
        </div>
        <p className="text-slate-400">No guards selected for this job</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <i className="ri-team-line text-teal-400"></i>
          Selected Guards ({provisional.length})
        </h3>
        <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-full whitespace-nowrap">
          Selected — Awaiting Client Payment
        </span>
      </div>

      <div className="space-y-3">
        {provisional.map((a) => {
          const g = a.guards || {};
          const rate = a.agreed_hourly_rate ?? g.hourly_rate ?? 0;
          const hours = a.agreed_hours ?? 0;
          const gross = a.gross_guard_amount ?? (rate * hours);
          const licence = g.licence_types?.length ? g.licence_types.join(', ') : null;

          return (
            <div key={a.id} className="p-4 bg-[#162036] rounded-xl border border-[#1e2d4d]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative flex-shrink-0">
                    {g.profile_image_url ? (
                      <img
                        src={g.profile_image_url}
                        alt={g.full_name || ''}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-lg">{(g.full_name || 'G').charAt(0)}</span>
                      </div>
                    )}
                    {g.sia_verified && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[#162036]">
                        <i className="ri-check-line text-white text-xs"></i>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-200 truncate">{g.full_name || 'Security Guard'}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {g.sia_verified && (
                        <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-medium border border-emerald-500/25 whitespace-nowrap">
                          SIA Verified
                        </span>
                      )}
                      {licence && (
                        <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-medium border border-blue-500/25 whitespace-nowrap">
                          {licence}
                        </span>
                      )}
                      {g.sia_licence_number && (
                        <span className="text-xs text-slate-500 whitespace-nowrap">SIA: {g.sia_licence_number}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-full whitespace-nowrap">
                    Awaiting Payment
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#1e2d4d]">
                <div>
                  <p className="text-xs text-slate-500">Agreed Hours</p>
                  <p className="text-sm font-semibold text-slate-200">{Number(hours).toFixed(1)}h</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Hourly Rate</p>
                  <p className="text-sm font-semibold text-slate-200">{money(rate, symbol)}/hr</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Guard Amount</p>
                  <p className="text-sm font-bold text-teal-400">{money(gross, symbol)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}