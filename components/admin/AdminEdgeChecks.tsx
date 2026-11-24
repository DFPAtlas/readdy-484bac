import { ADMIN_EDGE_FUNCTIONS, edgeStatusBadge, type AdminEdgePing } from '@/lib/adminEdgeHealth';

export default function AdminEdgeChecks({ pings, loading }: { pings: AdminEdgePing[]; loading: boolean }) {
  return (
    <section aria-label="Edge function reachability">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Edge Functions</h2>
        {loading && <span className="text-[11px] text-slate-600 flex items-center gap-1.5"><i className="ri-loader-4-line animate-spin text-xs"></i>Checking…</span>}
      </div>
      <p className="text-xs text-slate-500 mb-4">Reachability checks do not confirm successful payments or worker completion. Retired and server-only routes are not invoked.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ADMIN_EDGE_FUNCTIONS.map((fn) => {
          const ping = pings.find((p) => p.slug === fn.slug);
          const status = fn.probe === 'get' ? ping?.status : fn.probe;
          const badge = edgeStatusBadge(status);
          const detail = fn.probe === 'retired'
            ? 'Legacy route excluded from active checks. Payouts use Create Guard Payout.'
            : fn.probe === 'server_only'
              ? 'Not invoked by this page. See Scheduled Jobs for dispatch history; worker completion is not verified here.'
              : loading ? 'Checking endpoint reachability…' : ping?.detail || 'No check result is available.';
          return (
            <div key={fn.slug} className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#0a1628] text-slate-400">
                    <i className={`${fn.type === 'payment' ? 'ri-money-pound-circle-line' : fn.type === 'stripe' ? 'ri-bank-card-line' : fn.type === 'storage' ? 'ri-database-2-line' : 'ri-tools-line'} text-lg`}></i>
                  </div>
                  <span className="text-sm font-bold text-white">{fn.name}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${badge.color}`}>{loading && fn.probe === 'get' ? 'Checking' : badge.label}</span>
              </div>
              {fn.probe === 'get' && !loading && ping?.httpStatus != null && ping.latency != null && (
                <p className="text-xs text-slate-500">{ping.latency}ms · HTTP {ping.httpStatus}</p>
              )}
              <p className="text-[10px] mt-2 leading-relaxed text-slate-400">{detail}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
