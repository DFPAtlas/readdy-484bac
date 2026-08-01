'use client';

interface Props {
  label: string;
  value: string;
  icon: string;
  color: string;
  bgColor: string;
  trend?: string | null;
}

export default function StatCard({ label, value, icon, color, bgColor, trend }: Props) {
  return (
    <div className="bg-[#111d35] rounded-2xl p-5 shadow-sm border border-[#1e2d4a] hover:border-[#2a3a5c] transition-all duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${bgColor}`}>
          <div className="w-5 h-5 flex items-center justify-center">
            <i className={`${icon} ${color} text-lg`}></i>
          </div>
        </div>
        {trend && (
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap bg-[#1a2b4a] text-slate-400 ring-1 ring-slate-400/15">
            {trend}
          </span>
        )}
      </div>
      <div className="text-2xl font-extrabold text-white mb-1 tracking-tight">{value}</div>
      <div className="text-sm font-medium text-slate-400">{label}</div>
    </div>
  );
}