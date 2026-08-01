interface StatsCardProps {
  icon: string;
  iconBg: string;
  iconColor: string;
  value: string | number;
  label: string;
  sub?: string;
  subColor?: string;
  href?: string;
}

import Link from 'next/link';

export default function StatsCard({ icon, iconBg, iconColor, value, label, sub, subColor, href }: StatsCardProps) {
  const content = (
    <div className="bg-[#111d35] rounded-2xl p-6 border border-[#1a2b4a] shadow-sm hover:shadow-md transition-all group cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center`}>
          <i className={`${icon} text-2xl ${iconColor}`}></i>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-white">{value}</p>
          {sub && <p className={`text-xs font-medium mt-0.5 ${subColor || 'text-slate-500'}`}>{sub}</p>}
        </div>
      </div>
      <p className="text-sm font-medium text-slate-400">{label}</p>
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}
