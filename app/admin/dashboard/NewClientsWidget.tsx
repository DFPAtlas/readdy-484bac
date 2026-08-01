'use client';

interface Props {
  clientsToday: number;
  clientsThisWeek: number;
  clientsThisMonth: number;
  loading: boolean;
}

function SkeletonWidget() {
  return (
    <div className="bg-[#111d35] rounded-2xl p-5 shadow-sm border border-[#1a2b4a] animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-[#1a2b4a]"></div>
        <div className="w-24 h-5 bg-[#1a2b4a] rounded"></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-[#0e1a2d] rounded-xl p-3">
            <div className="w-8 h-5 bg-[#1a2b4a] rounded mb-2 mx-auto"></div>
            <div className="w-12 h-3 bg-[#1a2b4a] rounded mx-auto"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NewClientsWidget({ clientsToday, clientsThisWeek, clientsThisMonth, loading }: Props) {
  if (loading) return <SkeletonWidget />;

  return (
    <a
      href="/admin/accounts?tab=clients"
      className="bg-[#111d35] rounded-2xl p-5 shadow-sm border border-[#1a2b4a] hover:shadow-md hover:border-[#243a5e] transition-all duration-200 group relative block"
    >
      <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-100 animate-pulse"></span>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-500/10">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-user-add-line text-lg text-emerald-400"></i>
          </div>
        </div>
        <span className="text-sm font-semibold text-white">New Clients</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#0e1a2d] rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-white">{clientsToday}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium uppercase tracking-wider">Today</p>
        </div>
        <div className="bg-[#0e1a2d] rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-white">{clientsThisWeek}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium uppercase tracking-wider">This Week</p>
        </div>
        <div className="bg-[#0e1a2d] rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-white">{clientsThisMonth}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium uppercase tracking-wider">This Month</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-500 group-hover:text-emerald-400 transition-colors">
        <span>View all clients</span>
        <div className="w-3 h-3 flex items-center justify-center">
          <i className="ri-arrow-right-line"></i>
        </div>
      </div>
    </a>
  );
}